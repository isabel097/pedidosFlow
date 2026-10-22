import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { Almacen, normalizarConfiguracion } from './almacenamiento.js';
import {
  decisionPara,
  derivarEtapaDesdeChecklist,
  detalleDiseno,
  estadoPedido,
  evaluarCambio,
  hoyISO,
  pasosCompletados,
  porcentajeProduccion,
  validarFormatoCantidad,
  validarFechaCalendario,
  validarFormatoFecha,
  validarFormatoHora
} from './reglas.js';
import {
  Cambio,
  Campo,
  Configuracion,
  DecisionRegla,
  ETAPAS,
  Pedido,
  TipoDiseno,
  TipoNotificacion,
  ValorNuevo
} from './tipos.js';

const RESPONSABLE = 'Administrador';
const LIMITE_FOTO = 5_000_000; // caracteres de la imagen (base64) aceptados
const CAMPOS: Campo[] = ['Cantidad', 'Diseño', 'Fecha de entrega'];

class ErrorHttp extends Error {
  constructor(public estado: number, mensaje: string) {
    super(mensaje);
  }
}

const esRevisable = (c: Cambio) => !c.decisionManual && (c.resultado === 'pendiente-revision' || c.resultado === 'rechazado');
const esRevisionNuevoPedido = (c: Cambio) => c.origen === 'nuevo-pedido' && esRevisable(c);

function formatoFecha(fecha: string, hora: string): string {
  const [y, m, d] = fecha.split('-');
  return `${d}/${m}/${y} – ${hora}`;
}

function fotoValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !valor) return false;
  if (valor.length > LIMITE_FOTO) return false;
  return /^data:image\/(png|jpe?g|webp|gif|svg\+xml)[;,]/i.test(valor) || /^https?:\/\//i.test(valor);
}

function validarConfiguracion(c: unknown): c is Configuracion {
  const x = c as Configuracion | undefined;
  const decisiones: DecisionRegla[] = ['auto', 'review', 'blocked'];
  if (!x || typeof x !== 'object' || !x.reglas || !x.negocio) return false;
  for (const clave of ['cantidad', 'diseno', 'fecha'] as const) {
    const fila = x.reglas[clave];
    if (!fila || !ETAPAS.every(e => decisiones.includes(fila[e]))) return false;
  }
  const n = x.negocio;
  if (![n.nombre, n.correo, n.telefono, n.zonaHoraria].every(v => typeof v === 'string' && v.trim())) return false;
  if (!Array.isArray(x.pasosProduccion) || x.pasosProduccion.length < 2 || x.pasosProduccion.length > 20) return false;
  if (!x.pasosProduccion.every(p => typeof p === 'string' && p.trim())) return false;
  if (!Number.isInteger(x.pedidosMaximosPorDia) || x.pedidosMaximosPorDia < 1 || x.pedidosMaximosPorDia > 100) return false;
  if (!Array.isArray(x.catalogo) || !x.catalogo.length) return false;
  if (!x.catalogo.every(e => e && typeof e.id === 'string' && e.id.trim() && typeof e.nombre === 'string' && e.nombre.trim())) return false;
  if (new Set(x.catalogo.map(e => e.id)).size !== x.catalogo.length) return false;
  if (!x.bot || typeof x.bot !== 'object') return false;
  return Object.values(x.bot).every(v => typeof v === 'boolean');
}

export interface OpcionesServidor {
  carpetaPublica?: string;
  ahora?: () => Date;
}

export function crearServidor(almacen: Almacen, opciones: OpcionesServidor = {}) {
  const ahora = opciones.ahora ?? (() => new Date());
  const directorioProyecto = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const carpetaPublica = opciones.carpetaPublica ?? path.join(directorioProyecto, 'public');
  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use(express.static(carpetaPublica));

  // ─── utilidades ─────────────────────────────────────────────────────────────
  const buscarPedido = (id: string): Pedido => {
    const p = almacen.pedidos.find(x => x.id === id);
    if (!p) throw new ErrorHttp(404, 'Pedido no encontrado.');
    return p;
  };

  const notificar = (texto: string, sub: string, tipo: TipoNotificacion, activa: boolean) => {
    if (!activa) return;
    almacen.notificaciones.unshift({ id: crypto.randomUUID(), texto, sub, tipo, leida: false, fecha: ahora().toISOString() });
    if (almacen.notificaciones.length > 100) almacen.notificaciones.length = 100;
  };

  const resumenPedido = (p: Pedido) => {
    const { fotoUrl, ...resto } = p;
    const checklist = p.checklist;
    return {
      ...resto,
      tieneFoto: !!fotoUrl,
      etapa: derivarEtapaDesdeChecklist(checklist),
      pasosCompletados: pasosCompletados(checklist),
      totalPasos: checklist.length,
      progreso: porcentajeProduccion(checklist),
      estado: estadoPedido(p, almacen.cambios.some(c => c.pedidoId === p.id && esRevisionNuevoPedido(c))),
      disenoNombre: detalleDiseno(p, almacen.configuracion.catalogo)
    };
  };

  // ─── dashboard ──────────────────────────────────────────────────────────────
  app.get('/api/salud', (_req, res) => {
    res.json({ estado: 'ok', pedidos: almacen.pedidos.length });
  });

  app.get('/api/dashboard', (_req, res) => {
    const pedidos = almacen.pedidos.map(resumenPedido);
    const revisables = almacen.cambios.filter(esRevisable);
    const decididos = almacen.cambios
      .filter(c => c.resultado === 'aplicado' || c.decisionManual)
      .sort((a, b) => (b.fechaDecisionManual ?? b.fecha).localeCompare(a.fechaDecisionManual ?? a.fecha));
    res.json({
      pedidosActivos: pedidos.filter(p => p.estado !== 'Cancelado').length,
      cambiosPendientes: revisables.filter(c => c.origen === 'cambio').length,
      enProduccion: pedidos.filter(p => p.estado === 'En producción').length,
      revisionesPendientes: revisables.filter(c => c.origen === 'nuevo-pedido').length,
      ultimaDecision: decididos[0] ?? null,
      pedidos
    });
  });

  // ─── pedidos ────────────────────────────────────────────────────────────────
  app.get('/api/pedidos', (req, res) => {
    // ?telefono=... filtra los pedidos de un cliente (se compara por dígitos).
    const digitos = String(req.query.telefono ?? '').replace(/\D/g, '');
    if (req.query.telefono !== undefined && digitos.length < 7) throw new ErrorHttp(400, 'El teléfono no es válido.');
    const lista = digitos ? almacen.pedidos.filter(p => p.telefono.replace(/\D/g, '').endsWith(digitos) || digitos.endsWith(p.telefono.replace(/\D/g, ''))) : almacen.pedidos;
    res.json(lista.map(resumenPedido));
  });

  app.get('/api/pedidos/:id', (req, res) => {
    const p = buscarPedido(req.params.id);
    res.json({ ...resumenPedido(p), fotoUrl: p.fotoUrl ?? null });
  });

  app.post('/api/pedidos', (req, res) => {
    const b = req.body ?? {};
    const cliente = String(b.cliente ?? '').trim();
    const telefono = String(b.telefono ?? '').trim();
    if (cliente.length < 2 || cliente.length > 80) throw new ErrorHttp(400, 'El nombre del cliente es obligatorio (2 a 80 caracteres).');
    if (!/^\+?[\d\s-]{7,20}$/.test(telefono)) throw new ErrorHttp(400, 'El teléfono no es válido.');
    const cantidad = validarFormatoCantidad(b.cantidad);
    if (!cantidad.valido) throw new ErrorHttp(400, cantidad.motivo);
    const fecha = validarFormatoFecha(b.fechaEntrega, hoyISO(ahora()));
    if (!fecha.valido) throw new ErrorHttp(400, fecha.motivo);
    const hora = validarFormatoHora(b.horaEntrega ?? '12:00');
    if (!hora.valido) throw new ErrorHttp(400, hora.motivo);

    const cfg = almacen.configuracion;
    const tipo: TipoDiseno = b.tipo === 'personalizado' ? 'personalizado' : 'catalogo';
    let diseno: string;
    let fotoUrl: string | undefined;
    let descripcionDiseno: string | undefined;
    if (tipo === 'catalogo') {
      diseno = String(b.estiloId ?? '');
      if (!cfg.catalogo.some(e => e.id === diseno)) throw new ErrorHttp(400, 'El diseño seleccionado no existe en el catálogo.');
    } else {
      const descripcion = String(b.descripcionDiseno ?? '').trim();
      if (b.fotoUrl && !fotoValida(b.fotoUrl)) throw new ErrorHttp(400, 'La imagen del diseño personalizado no es válida o es demasiado grande.');
      if (!fotoValida(b.fotoUrl) && descripcion.length < 4) throw new ErrorHttp(400, 'Describe el diseño personalizado o adjunta una imagen de referencia.');
      if (descripcion.length > 600) throw new ErrorHttp(400, 'La descripción del diseño no puede superar 600 caracteres.');
      diseno = 'personalizado';
      fotoUrl = fotoValida(b.fotoUrl) ? b.fotoUrl : undefined;
      descripcionDiseno = descripcion || undefined;
    }

    const maxId = Math.max(0, ...almacen.pedidos.map(p => Number(p.id)).filter(Number.isFinite));
    const pedido: Pedido = {
      id: String(maxId + 1),
      cliente,
      telefono,
      producto: 'Torta personalizada',
      cantidad: cantidad.valor,
      fechaEntrega: fecha.valor,
      horaEntrega: hora.valor,
      checklist: cfg.pasosProduccion.map(() => false),
      diseno,
      disenoTipo: tipo,
      ...(fotoUrl ? { fotoUrl } : {}),
      ...(descripcionDiseno ? { descripcionDiseno } : {}),
      creadoEn: ahora().toISOString()
    };
    almacen.pedidos.unshift(pedido);
    notificar('Nuevo pedido recibido', `Pedido #${pedido.id} – ${pedido.cliente}`, 'info', cfg.bot.notificarNuevoPedido);

    if (tipo === 'personalizado') {
      // Cualquier diseño fuera del catálogo requiere siempre criterio humano, tenga foto o descripción.
      const requiereRevision = true;
      almacen.cambios.unshift({
        id: crypto.randomUUID(),
        pedidoId: pedido.id,
        campo: 'Diseño',
        origen: 'nuevo-pedido',
        etapa: 'Antes de producción',
        pasosCompletados: 0,
        detalleAnterior: 'Nuevo pedido',
        detalleNuevo: descripcionDiseno ? `Diseño personalizado: ${descripcionDiseno}` : 'Diseño personalizado',
        valorNuevo: { tipo: 'personalizado', ...(fotoUrl ? { fotoUrl } : {}), ...(descripcionDiseno ? { descripcionDiseno } : {}) },
        resultado: requiereRevision ? 'pendiente-revision' : 'aplicado',
        motivo: requiereRevision ? 'El diseño personalizado requiere revisión manual.' : 'Diseño personalizado aceptado sin revisión (revisión de fotos desactivada).',
        fecha: ahora().toISOString()
      });
      if (requiereRevision) notificar('Revisión de diseño requerida', `Pedido #${pedido.id} – ${pedido.cliente} · diseño personalizado`, 'info', cfg.bot.notificarRevision);
    }
    almacen.guardar('pedidos', 'cambios', 'notificaciones');
    res.status(201).json(resumenPedido(pedido));
  });

  // ─── cambios (flujo principal del incremento) ───────────────────────────────
  app.get('/api/pedidos/:id/cambios', (req, res) => {
    buscarPedido(req.params.id);
    res.json(almacen.cambios.filter(c => c.pedidoId === req.params.id));
  });

  app.post('/api/pedidos/:id/cambios', (req, res) => {
    const pedido = buscarPedido(req.params.id);
    if (pedido.cancelado) throw new ErrorHttp(409, 'El pedido está cancelado y no admite cambios.');

    const b = req.body ?? {};
    const campo = b.campo as Campo;
    if (!CAMPOS.includes(campo)) throw new ErrorHttp(400, 'Campo de cambio no válido. Use Cantidad, Diseño o Fecha de entrega.');
    const cfg = almacen.configuracion;

    let valorNuevo: ValorNuevo = {};
    let detalleAnterior = '';
    let detalleNuevo = '';
    let personalizado = false;

    if (campo === 'Cantidad') {
      const f = validarFormatoCantidad(b.valorNuevo);
      if (!f.valido) throw new ErrorHttp(400, f.motivo);
      if (f.valor === pedido.cantidad) throw new ErrorHttp(400, 'La cantidad solicitada es igual a la actual.');
      valorNuevo = { cantidad: f.valor };
      detalleAnterior = `${pedido.cantidad} personas`;
      detalleNuevo = `${f.valor} personas`;
    } else if (campo === 'Fecha de entrega') {
      // Para una modificación se validan primero formato y calendario. Una fecha pasada
      // no se aplica automáticamente: se registra como excepción para revisión humana.
      const f = validarFechaCalendario(b.valorNuevo);
      if (!f.valido) throw new ErrorHttp(400, f.motivo);
      const h = validarFormatoHora(b.hora ?? pedido.horaEntrega);
      if (!h.valido) throw new ErrorHttp(400, h.motivo);
      if (f.valor === pedido.fechaEntrega && h.valor === pedido.horaEntrega) throw new ErrorHttp(400, 'La fecha solicitada es igual a la actual.');
      valorNuevo = { fecha: f.valor, hora: h.valor };
      detalleAnterior = formatoFecha(pedido.fechaEntrega, pedido.horaEntrega);
      detalleNuevo = formatoFecha(f.valor, h.valor);
    } else {
      const tipo: TipoDiseno = b.tipo === 'personalizado' ? 'personalizado' : 'catalogo';
      detalleAnterior = detalleDiseno(pedido, cfg.catalogo);
      if (tipo === 'catalogo') {
        const estilo = cfg.catalogo.find(e => e.id === String(b.estiloId ?? ''));
        if (!estilo) throw new ErrorHttp(400, 'El diseño del catálogo no existe.');
        if (pedido.disenoTipo === 'catalogo' && pedido.diseno === estilo.id) throw new ErrorHttp(400, 'El diseño solicitado es igual al actual.');
        valorNuevo = { tipo, estiloId: estilo.id };
        detalleNuevo = estilo.nombre;
      } else {
        const descripcion = String(b.descripcionDiseno ?? '').trim();
        if (b.fotoUrl && !fotoValida(b.fotoUrl)) throw new ErrorHttp(400, 'La imagen del diseño personalizado no es válida o es demasiado grande.');
        if (!fotoValida(b.fotoUrl) && descripcion.length < 4) throw new ErrorHttp(400, 'Describe el diseño personalizado o adjunta una imagen de referencia.');
        if (descripcion.length > 600) throw new ErrorHttp(400, 'La descripción del diseño no puede superar 600 caracteres.');
        valorNuevo = { tipo, ...(fotoValida(b.fotoUrl) ? { fotoUrl: b.fotoUrl } : {}), ...(descripcion ? { descripcionDiseno: descripcion } : {}) };
        detalleNuevo = descripcion ? `Diseño personalizado: ${descripcion}` : 'Diseño personalizado';
        personalizado = true;
      }
    }

    const etapa = derivarEtapaDesdeChecklist(pedido.checklist);
    const regla = decisionPara(campo, etapa, cfg.reglas);
    let { resultado, motivo } = evaluarCambio(campo, etapa, regla);

    // Los diseños fuera del catálogo nunca se deciden automáticamente.
    if (campo === 'Diseño' && personalizado) {
      resultado = 'pendiente-revision';
      motivo = 'El diseño está fuera del catálogo y requiere que el encargado compruebe su viabilidad. El pedido no cambia hasta que se apruebe.';
    } else if (campo === 'Fecha de entrega' && valorNuevo.fecha && valorNuevo.fecha < hoyISO(ahora())) {
      // Una fecha pasada se guarda como excepción a revisar; no se aplica automáticamente.
      resultado = 'pendiente-revision';
      motivo = 'La fecha solicitada está en el pasado. Se envía al encargado como excepción y no se modifica el pedido hasta su decisión.';
    } else if (campo === 'Fecha de entrega' && valorNuevo.fecha) {
      const pedidosEnFecha = almacen.pedidos.filter(p => p.id !== pedido.id && !p.cancelado && p.fechaEntrega === valorNuevo.fecha).length;
      if (pedidosEnFecha >= cfg.pedidosMaximosPorDia) {
        resultado = 'pendiente-revision';
        motivo = `La fecha solicitada ya tiene ${pedidosEnFecha} pedido(s) activo(s), que alcanzan el límite de ${cfg.pedidosMaximosPorDia} por día. El encargado debe comprobar la capacidad antes de aceptar el cambio.`;
      }
    }

    const cambio: Cambio = {
      id: crypto.randomUUID(),
      pedidoId: pedido.id,
      campo,
      origen: 'cambio',
      etapa,
      pasosCompletados: pasosCompletados(pedido.checklist),
      detalleAnterior,
      detalleNuevo,
      valorNuevo,
      resultado,
      motivo,
      fecha: ahora().toISOString()
    };
    if (resultado === 'aplicado') aplicarValor(pedido, cambio);
    almacen.cambios.unshift(cambio);

    const sub = `Pedido #${pedido.id} – ${campo}: ${detalleAnterior} → ${detalleNuevo}`;
    notificar('Cliente solicitó modificación', sub, 'warning', cfg.bot.notificarCambio);
    if (resultado === 'aplicado') notificar('Cambio aprobado automáticamente', sub, 'success', cfg.bot.notificarCambioAutomatico);
    if (resultado === 'rechazado') notificar('Cambio rechazado automáticamente', sub, 'danger', cfg.bot.notificarCambioAutomatico);
    if (resultado === 'pendiente-revision') notificar('Cambio enviado a revisión', sub, 'warning', cfg.bot.notificarRevision);

    almacen.guardar('pedidos', 'cambios', 'notificaciones');
    res.status(201).json({ cambio, pedido: resumenPedido(pedido), evaluacion: { resultado, motivo, regla, etapa } });
  });

  function aplicarValor(pedido: Pedido, cambio: Cambio) {
    const v = cambio.valorNuevo;
    if (cambio.campo === 'Cantidad' && v.cantidad) pedido.cantidad = v.cantidad;
    if (cambio.campo === 'Fecha de entrega' && v.fecha) {
      pedido.fechaEntrega = v.fecha;
      if (v.hora) pedido.horaEntrega = v.hora;
    }
    if (cambio.campo === 'Diseño' && cambio.origen === 'cambio') {
      if (v.tipo === 'personalizado') {
        pedido.diseno = 'personalizado';
        pedido.disenoTipo = 'personalizado';
        if (v.fotoUrl) pedido.fotoUrl = v.fotoUrl; else delete pedido.fotoUrl;
        if (v.descripcionDiseno) pedido.descripcionDiseno = v.descripcionDiseno; else delete pedido.descripcionDiseno;
      } else if (v.estiloId) {
        pedido.diseno = v.estiloId;
        pedido.disenoTipo = 'catalogo';
        delete pedido.fotoUrl;
        delete pedido.descripcionDiseno;
      }
    }
  }

  app.get('/api/cambios', (_req, res) => {
    res.json(almacen.cambios.map(c => ({ ...c, valorNuevo: { ...c.valorNuevo, fotoUrl: c.valorNuevo.fotoUrl ? '[imagen]' : undefined } })));
  });

  // ─── revisión humana ────────────────────────────────────────────────────────
  app.get('/api/revisiones-pendientes', (_req, res) => {
    res.json(
      almacen.cambios.filter(esRevisable).map(c => {
        const p = almacen.pedidos.find(x => x.id === c.pedidoId);
        return { ...c, pedido: p ? resumenPedido(p) : null, foto: c.valorNuevo.fotoUrl ?? null };
      })
    );
  });

  app.put('/api/revisiones-pendientes/:id/decidir', (req, res) => {
    const cambio = almacen.cambios.find(c => c.id === req.params.id);
    if (!cambio) throw new ErrorHttp(404, 'Revisión no encontrada.');
    if (!esRevisable(cambio)) throw new ErrorHttp(409, 'La revisión ya fue resuelta.');
    const decision = req.body?.decision;
    if (decision !== 'aprobar' && decision !== 'mantener-rechazo') throw new ErrorHttp(400, 'Decisión no válida. Use aprobar o mantener-rechazo.');
    const pedido = buscarPedido(cambio.pedidoId);
    const cfg = almacen.configuracion;

    cambio.fechaDecisionManual = ahora().toISOString();
    cambio.responsable = RESPONSABLE;
    const sub = `Pedido #${pedido.id} – ${cambio.campo}`;
    if (decision === 'aprobar') {
      cambio.decisionManual = 'aprobado';
      if (cambio.origen === 'cambio') aplicarValor(pedido, cambio);
      notificar(cambio.origen === 'nuevo-pedido' ? 'Diseño personalizado confirmado' : 'Cambio aprobado manualmente', sub, 'success', cfg.bot.notificarRevision);
    } else {
      cambio.decisionManual = 'rechazo-mantenido';
      if (cambio.origen === 'nuevo-pedido') pedido.cancelado = true;
      notificar(cambio.origen === 'nuevo-pedido' ? 'Diseño no viable – pedido cancelado' : 'Rechazo mantenido por el encargado', sub, 'danger', cfg.bot.notificarRevision);
    }
    almacen.guardar('pedidos', 'cambios', 'notificaciones');
    res.json({ cambio, pedido: resumenPedido(pedido) });
  });

  // ─── producción ─────────────────────────────────────────────────────────────
  app.get('/api/produccion', (_req, res) => {
    const pasos = almacen.configuracion.pasosProduccion;
    res.json(
      almacen.pedidos
        .filter(p => !p.cancelado)
        .map(p => ({ ...resumenPedido(p), pasos: pasos.map((nombre, i) => ({ nombre, hecho: !!p.checklist[i] })) }))
    );
  });

  app.patch('/api/pedidos/:id/produccion', (req, res) => {
    const pedido = buscarPedido(req.params.id);
    if (pedido.cancelado) throw new ErrorHttp(409, 'El pedido está cancelado.');
    const pasos = almacen.configuracion.pasosProduccion;
    const lista = req.body?.checklist;
    if (!Array.isArray(lista) || lista.length !== pasos.length || lista.some((x: unknown) => typeof x !== 'boolean')) {
      throw new ErrorHttp(400, 'Checklist no válido.');
    }
    for (let i = 1; i < lista.length; i++) {
      if (lista[i] && !lista[i - 1]) throw new ErrorHttp(400, 'Las etapas deben completarse en orden.');
    }
    const antes = derivarEtapaDesdeChecklist(pedido.checklist);
    pedido.checklist = lista;
    const despues = derivarEtapaDesdeChecklist(lista);
    if (antes !== despues) {
      notificar('Etapa de producción actualizada', `Pedido #${pedido.id} – ${despues}`, 'info', almacen.configuracion.bot.notificarProduccion);
    }
    almacen.guardar('pedidos', 'notificaciones');
    res.json({ ...resumenPedido(pedido), pasos: pasos.map((nombre, i) => ({ nombre, hecho: lista[i] })) });
  });

  // ─── clientes ───────────────────────────────────────────────────────────────
  app.get('/api/clientes', (_req, res) => {
    const mapa = new Map<string, { nombre: string; telefono: string; totalPedidos: number; ultimaEntrega: string; pedidos: string[] }>();
    for (const p of almacen.pedidos) {
      const clave = p.telefono || p.cliente;
      const actual = mapa.get(clave);
      if (!actual) {
        mapa.set(clave, { nombre: p.cliente, telefono: p.telefono, totalPedidos: 1, ultimaEntrega: p.fechaEntrega, pedidos: [p.id] });
      } else {
        actual.totalPedidos += 1;
        actual.pedidos.push(p.id);
        if (p.fechaEntrega > actual.ultimaEntrega) actual.ultimaEntrega = p.fechaEntrega;
      }
    }
    res.json([...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)).map(c => ({ ...c, estado: 'Activo' })));
  });

  // ─── configuración ──────────────────────────────────────────────────────────
  app.get('/api/configuracion', (_req, res) => res.json(almacen.configuracion));

  app.put('/api/configuracion', (req, res) => {
    if (!validarConfiguracion(req.body)) throw new ErrorHttp(400, 'Configuración no válida.');
    const nueva = normalizarConfiguracion(req.body);
    const n = nueva.pasosProduccion.length;
    if (n !== almacen.configuracion.pasosProduccion.length) {
      for (const p of almacen.pedidos) {
        const hechos = pasosCompletados(p.checklist);
        p.checklist = Array.from({ length: n }, (_, i) => i < hechos);
      }
    }
    almacen.configuracion = nueva;
    almacen.guardar('configuracion', 'pedidos');
    res.json(almacen.configuracion);
  });

  // ─── notificaciones ─────────────────────────────────────────────────────────
  app.get('/api/notificaciones', (_req, res) => {
    res.json({ noLeidas: almacen.notificaciones.filter(n => !n.leida).length, items: almacen.notificaciones.slice(0, 30) });
  });

  app.post('/api/notificaciones/leer-todas', (_req, res) => {
    almacen.notificaciones.forEach(n => (n.leida = true));
    almacen.guardar('notificaciones');
    res.json({ noLeidas: 0 });
  });

  app.post('/api/notificaciones/:id/leer', (req, res) => {
    const n = almacen.notificaciones.find(x => x.id === req.params.id);
    if (!n) throw new ErrorHttp(404, 'Notificación no encontrada.');
    n.leida = true;
    almacen.guardar('notificaciones');
    res.json({ noLeidas: almacen.notificaciones.filter(x => !x.leida).length });
  });

  // ─── manejo de errores y rutas desconocidas ─────────────────────────────────
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada.' });
  });

  app.use((req, res) => {
    if (req.method !== 'GET') return res.status(404).json({ error: 'Ruta no encontrada.' });
    res.sendFile(path.join(carpetaPublica, 'index.html'));
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ErrorHttp) return res.status(err.estado).json({ error: err.message });
    const e = err as { type?: string; status?: number };
    if (e?.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo de la solicitud no es un JSON válido.' });
    if (e?.type === 'entity.too.large') return res.status(413).json({ error: 'La solicitud es demasiado grande.' });
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  });

  return app;
}
