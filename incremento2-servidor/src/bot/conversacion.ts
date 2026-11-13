import {
  MENSAJE_SIN_CONEXION,
  TEXTO_AYUDA,
  enviarCambio,
  errorDeApi,
  formatearPedido,
  procesarMensaje,
  type ClienteApi
} from './comandos.js';
import {
  elegirDiseno,
  extraerCantidad,
  extraerIdEnRespuesta,
  extraerTelefono,
  interpretarFecha,
  interpretarHora,
  interpretarHoraPedido,
  interpretarMensaje,
  interpretarSiNo,
  limpiarNombre,
  pideElMismoPedido,
  quiereCancelar
} from './lenguaje.js';
import { hoyISO, validarFormatoCantidad, validarFormatoFecha, validarFormatoHora } from '../reglas.js';

export interface Respuesta {
  texto: string;
  /** Botones de respuesta rápida que Telegram muestra bajo el mensaje. */
  opciones?: string[];
}

type Intencion = 'consultar' | 'cantidad' | 'fecha';

interface Tramite {
  intencion: Intencion;
  id?: string;
  /** Datos del pedido, consultados una sola vez para verificar que existe. */
  info?: any;
  cantidad?: number;
  fecha?: string;
  hora?: string;
}

type PasoPedido = 'nombre' | 'telefono' | 'cantidad' | 'diseno' | 'diseno-detalle' | 'fecha' | 'hora' | 'confirmar';

/** Pedido que se está armando paso a paso. Se envía al servidor solo cuando la persona lo confirma. */
interface PedidoNuevo {
  paso: PasoPedido;
  nombre?: string;
  telefono?: string;
  cantidad?: number;
  disenoTipo?: 'catalogo' | 'personalizado';
  estiloId?: string;
  estiloNombre?: string;
  descripcion?: string;
  fotoUrl?: string;
  fecha?: string;
  hora?: string;
  catalogo?: Array<{ id: string; nombre: string; descripcion?: string }>;
}

interface Sesion {
  actualizada: number;
  ultimoPedido?: string;
  tramite?: Tramite;
  confirmacion?: { id: string; cuerpo: Record<string, unknown> };
  nuevo?: PedidoNuevo;
}

interface Avisos {
  confirmacionVencida: boolean;
  pedidoVencido: boolean;
}

const VIGENCIA_MS = 15 * 60 * 1000;
export const OPCIONES_CONFIRMAR = ['Sí, confirmar', 'No, cancelar'];

export const MENSAJE_FOTO_FUERA_DE_FLUJO =
  'Por ahora solo entiendo mensajes de texto (y la foto de un diseño personalizado cuando estamos registrando un pedido). Escribe /ayuda para ver los comandos.';
const TEXTO_NO_ENTENDI =
  'No logré entender tu mensaje. Puedes escribirme, por ejemplo, «quiero consultar el pedido 154» o «cambia la cantidad del pedido 154 a 40 personas». También sirve /ayuda.';
const TEXTO_ALCANCE = 'Por aquí puedo registrar pedidos nuevos, consultar un pedido y cambiar su cantidad o su fecha de entrega.';
const OPCION_PERSONALIZADO = 'Diseño personalizado';
const TEXTO_CANCELADO = 'Listo, no registré ningún pedido. Si quieres empezar de nuevo, escribe «quiero hacer un pedido».';

/**
 * Conversación del bot con lenguaje normal. Guarda en memoria, por chat, lo que falta para completar
 * una solicitud (número de pedido, cantidad o fecha) y pide confirmación antes de enviar un cambio.
 * No decide nada: toda decisión sobre el cambio la toma el motor de reglas del servidor.
 */
export class Conversaciones {
  private sesiones = new Map<string, Sesion>();

  constructor(
    private readonly api: ClienteApi,
    private readonly ahora: () => Date = () => new Date()
  ) {}

  async atender(chatId: number | string, texto: string): Promise<Respuesta> {
    const instante = this.ahora().getTime();
    this.limpiarVencidas(instante);

    const clave = String(chatId);
    const previa = this.sesiones.get(clave);
    const vencida = previa !== undefined && instante - previa.actualizada > VIGENCIA_MS;
    const sesion: Sesion = vencida ? { actualizada: instante, ultimoPedido: previa?.ultimoPedido } : (previa ?? { actualizada: instante });
    const avisos: Avisos = {
      confirmacionVencida: vencida && previa?.confirmacion !== undefined,
      pedidoVencido: vencida && previa?.nuevo !== undefined
    };
    sesion.actualizada = instante;
    this.sesiones.set(clave, sesion);

    try {
      if (texto.trim().startsWith('/')) return await this.comando(sesion, texto);
      return await this.lenguaje(sesion, texto, avisos);
    } catch {
      return { texto: MENSAJE_SIN_CONEXION };
    }
  }

  /** Una foto solo se usa cuando se está pidiendo la referencia de un diseño personalizado. */
  async atenderFoto(chatId: number | string, obtenerFoto: () => Promise<string>, pie?: string): Promise<Respuesta> {
    const instante = this.ahora().getTime();
    const sesion = this.sesiones.get(String(chatId));
    if (!sesion || instante - sesion.actualizada > VIGENCIA_MS || !sesion.nuevo) return { texto: MENSAJE_FOTO_FUERA_DE_FLUJO };
    sesion.actualizada = instante;
    const p = sesion.nuevo;
    try {
      if (p.paso !== 'diseno-detalle') {
        const r = await this.preguntarPedido(sesion);
        return { ...r, texto: `Gracias por la foto, pero ahora necesito otro dato.\n${r.texto}` };
      }
      let foto: string;
      try {
        foto = await obtenerFoto();
      } catch {
        return { texto: 'No pude descargar la foto. Inténtalo de nuevo o describe el diseño con palabras.' };
      }
      p.fotoUrl = foto;
      const descripcion = (pie ?? '').trim();
      if (descripcion.length >= 4 && descripcion.length <= 600 && !p.descripcion) p.descripcion = descripcion;
      return await this.preguntarPedido(sesion);
    } catch {
      return { texto: MENSAJE_SIN_CONEXION };
    }
  }

  private limpiarVencidas(instante: number): void {
    if (this.sesiones.size < 200) return;
    for (const [clave, s] of this.sesiones) {
      if (instante - s.actualizada > VIGENCIA_MS) this.sesiones.delete(clave);
    }
  }

  private async comando(s: Sesion, texto: string): Promise<Respuesta> {
    s.tramite = undefined;
    s.confirmacion = undefined;
    s.nuevo = undefined;
    const nombre = texto.trim().split(/\s+/)[0].slice(1).split('@')[0].toLowerCase();
    if (nombre === 'pedido') return this.iniciarPedido(s);
    const respuesta = await procesarMensaje(texto, this.api);
    const id = /^\/\w+(?:@\w+)?\s+#?(\d{1,9})\b/.exec(texto.trim())?.[1];
    if (id && !respuesta.startsWith('No encontré')) s.ultimoPedido = id;
    return { texto: respuesta };
  }

  private async lenguaje(s: Sesion, texto: string, avisos: Avisos): Promise<Respuesta> {
    // 0. Se está armando un pedido nuevo: todo lo que escriba es la respuesta al paso actual.
    if (s.nuevo) return this.continuarPedido(s, texto);

    const siNo = interpretarSiNo(texto);

    // 1. Hay un cambio esperando confirmación.
    if (s.confirmacion) {
      if (siNo === 'si') {
        const { id, cuerpo } = s.confirmacion;
        s.confirmacion = undefined;
        return { texto: await enviarCambio(id, cuerpo, this.api) };
      }
      if (siNo === 'no') {
        s.confirmacion = undefined;
        return { texto: 'Listo, no hice ningún cambio. Si necesitas algo más, escríbeme.' };
      }
      if (!interpretarMensaje(texto, this.ahora()).explicita) {
        return { texto: 'Responde «sí» para confirmar el cambio o «no» para cancelarlo.', opciones: OPCIONES_CONFIRMAR };
      }
      s.confirmacion = undefined; // una solicitud nueva reemplaza a la anterior
    } else if (avisos.confirmacionVencida && siNo === 'si') {
      return { texto: 'Esa confirmación venció, por seguridad. Vuelve a pedirme el cambio y lo confirmamos.' };
    }

    // 2. Un «no» o «cancelar» mientras se piden datos deja la solicitud sin efecto.
    if (s.tramite && siNo === 'no') {
      s.tramite = undefined;
      return { texto: 'Listo, lo dejamos así. Si necesitas algo más, escríbeme.' };
    }

    const interp = interpretarMensaje(texto, this.ahora());

    if (avisos.pedidoVencido && !interp.explicita) {
      return { texto: 'Tu pedido anterior quedó sin terminar porque pasó mucho tiempo. Escribe «quiero hacer un pedido» para empezar de nuevo.' };
    }

    // 3. Es la respuesta a una pregunta del bot (un número, una fecha...), no una solicitud nueva.
    if (s.tramite && !interp.explicita) return this.completarDato(s, s.tramite, texto);

    switch (interp.tipo) {
      case 'consultar':
      case 'cantidad':
      case 'fecha': {
        const previo = s.tramite;
        s.tramite = {
          intencion: interp.tipo,
          id: interp.id ?? previo?.id,
          info: interp.id && interp.id !== previo?.id ? undefined : previo?.info,
          cantidad: interp.tipo === 'cantidad' ? (interp.cantidad ?? undefined) : undefined,
          fecha: interp.tipo === 'fecha' ? (interp.fecha ?? undefined) : undefined,
          hora: interp.tipo === 'fecha' ? (interp.hora ?? undefined) : undefined
        };
        return this.avanzar(s);
      }
      case 'diseno':
        s.tramite = undefined;
        return { texto: `Por este chat todavía no puedo cambiar el diseño de un pedido: comunícate directamente con la pastelería. ${TEXTO_ALCANCE}` };
      case 'crear':
        s.tramite = undefined;
        return this.iniciarPedido(s, interp);
      case 'cancelar':
        s.tramite = undefined;
        return { texto: `Cancelar pedidos no está disponible en este chat: comunícate directamente con la pastelería. ${TEXTO_ALCANCE}` };
      case 'varios':
        s.tramite = undefined;
        return { texto: 'Puedo ayudarte con una cosa a la vez. ¿Qué quieres cambiar primero: la cantidad o la fecha de entrega? (El diseño, por ahora, solo en el chat web.)' };
      case 'saludo':
      case 'ayuda':
        return { texto: TEXTO_AYUDA };
      case 'gracias':
        return { texto: '¡Con gusto! Si necesitas algo más, escríbeme.' };
      default:
        return { texto: TEXTO_NO_ENTENDI };
    }
  }

  /** Toma de la respuesta del cliente el dato que el bot acaba de pedir. */
  private async completarDato(s: Sesion, t: Tramite, texto: string): Promise<Respuesta> {
    if (!t.id) {
      const id = pideElMismoPedido(texto) && s.ultimoPedido ? s.ultimoPedido : extraerIdEnRespuesta(texto);
      if (!id) return { texto: 'No encontré un número de pedido en tu mensaje. Escribe solo el número, por ejemplo 154.' };
      t.id = id;
      t.info = undefined;
      return this.avanzar(s);
    }
    if (t.intencion === 'cantidad') {
      const cantidad = extraerCantidad(texto, t.id);
      if (cantidad === null) return { texto: 'No logré ver la cantidad. Escribe solo el número de personas, por ejemplo 40.' };
      t.cantidad = cantidad;
      return this.avanzar(s);
    }
    if (t.intencion === 'fecha') {
      const fecha = interpretarFecha(texto, this.ahora());
      if (!fecha) return { texto: 'No logré entender la fecha. Prueba con «20 de noviembre», «mañana», «el viernes» o 2026-11-20.' };
      t.fecha = fecha;
      t.hora = interpretarHora(texto) ?? undefined;
      return this.avanzar(s);
    }
    return { texto: TEXTO_NO_ENTENDI };
  }

  /** Pide el siguiente dato que falta; cuando está todo, pide confirmación. */
  private async avanzar(s: Sesion): Promise<Respuesta> {
    const t = s.tramite!;

    if (!t.id) {
      const ultimo = s.ultimoPedido ? ` Si es el mismo de antes (#${s.ultimoPedido}), responde «el mismo».` : '';
      return { texto: `¿De qué pedido? Escribe el número, por ejemplo 154.${ultimo}` };
    }

    // Se verifica que el pedido exista antes de pedir más datos.
    if (!t.info || t.intencion === 'consultar') {
      const r = await this.api.consultarPedido(t.id);
      if (r.estado !== 200) {
        s.tramite = undefined;
        return { texto: errorDeApi(r, t.id) };
      }
      t.info = r.json;
      s.ultimoPedido = t.id;
    }
    const info = t.info;

    if (t.intencion === 'consultar') {
      s.tramite = undefined;
      return { texto: formatearPedido(info) };
    }

    if (t.intencion === 'cantidad') {
      if (t.cantidad === undefined) {
        return { texto: `El pedido #${t.id} tiene ${info.cantidad} personas. ¿A cuántas personas quieres cambiarlo?` };
      }
      if (t.cantidad === Number(info.cantidad)) {
        t.cantidad = undefined;
        return { texto: `El pedido #${t.id} ya tiene ${info.cantidad} personas. ¿A cuántas quieres cambiarlo?` };
      }
      s.confirmacion = { id: t.id, cuerpo: { campo: 'Cantidad', valorNuevo: t.cantidad } };
      s.tramite = undefined;
      return {
        texto: `Voy a pedir este cambio:\nPedido #${t.id} - Cantidad: ${info.cantidad} personas → ${t.cantidad} personas.\n¿Confirmas?`,
        opciones: OPCIONES_CONFIRMAR
      };
    }

    // fecha
    if (!t.fecha) {
      return {
        texto: `El pedido #${t.id} está para el ${info.fechaEntrega} a las ${info.horaEntrega}. ¿Para qué fecha lo quieres? Puedes escribir, por ejemplo, «20 de noviembre» o «el viernes».`
      };
    }
    const hora = t.hora ?? info.horaEntrega;
    const cuerpo: Record<string, unknown> = { campo: 'Fecha de entrega', valorNuevo: t.fecha };
    if (t.hora) cuerpo.hora = t.hora;
    s.confirmacion = { id: t.id, cuerpo };
    s.tramite = undefined;
    return {
      texto: `Voy a pedir este cambio:\nPedido #${t.id} - Fecha de entrega: ${info.fechaEntrega} ${info.horaEntrega} → ${t.fecha} ${hora}.\n¿Confirmas?`,
      opciones: OPCIONES_CONFIRMAR
    };
  }

  // ─── Pedido nuevo ───────────────────────────────────────────────────────────

  private async iniciarPedido(s: Sesion, interp?: ReturnType<typeof interpretarMensaje>): Promise<Respuesta> {
    s.tramite = undefined;
    s.confirmacion = undefined;
    const p: PedidoNuevo = { paso: 'nombre' };
    // Si el mensaje ya trae datos válidos («una torta para 30 personas el 20 de noviembre a las 3 pm»), se aprovechan.
    if (interp?.cantidad != null && validarFormatoCantidad(interp.cantidad).valido) p.cantidad = interp.cantidad;
    if (interp?.fecha && validarFormatoFecha(interp.fecha, hoyISO(this.ahora())).valido) p.fecha = interp.fecha;
    if (interp?.hora && p.fecha) p.hora = interp.hora;
    s.nuevo = p;
    const r = await this.preguntarPedido(s);
    return { ...r, texto: `¡Claro! Vamos a registrar tu pedido de torta personalizada. Puedes escribir «cancelar» en cualquier momento.\n\n${r.texto}` };
  }

  /** Recibe la respuesta de la persona al paso actual y avanza al siguiente. */
  private async continuarPedido(s: Sesion, texto: string): Promise<Respuesta> {
    const p = s.nuevo!;
    const libre = p.paso === 'nombre' || p.paso === 'diseno-detalle';
    const siNo = interpretarSiNo(texto);
    if (quiereCancelar(texto) || (!libre && siNo === 'no')) {
      s.nuevo = undefined;
      return { texto: TEXTO_CANCELADO };
    }

    switch (p.paso) {
      case 'nombre': {
        const nombre = limpiarNombre(texto);
        if (!nombre) return { texto: 'No logré tomar ese nombre. Escríbelo solo con letras, por ejemplo: Ana Pérez.' };
        p.nombre = nombre;
        break;
      }
      case 'telefono': {
        const telefono = extraerTelefono(texto);
        if (!telefono) return { texto: 'No logré ver un teléfono válido. Escríbelo con al menos 7 números, por ejemplo 300 123 4567.' };
        p.telefono = telefono;
        break;
      }
      case 'cantidad': {
        const cantidad = extraerCantidad(texto);
        if (cantidad === null) return { texto: 'Escribe solo el número de personas, por ejemplo 30.' };
        const v = validarFormatoCantidad(cantidad);
        if (!v.valido) return { texto: `${v.motivo} ¿Para cuántas personas es la torta?` };
        p.cantidad = v.valor;
        break;
      }
      case 'diseno': {
        const eleccion = elegirDiseno(texto, p.catalogo ?? []);
        if (!eleccion) {
          const r = await this.preguntarPedido(s);
          return { ...r, texto: `No reconocí ese diseño. Toca uno de los botones o escribe su nombre.\n${r.texto}` };
        }
        if (eleccion.tipo === 'personalizado') {
          p.disenoTipo = 'personalizado';
        } else {
          p.disenoTipo = 'catalogo';
          p.estiloId = eleccion.id;
          p.estiloNombre = eleccion.nombre;
        }
        break;
      }
      case 'diseno-detalle': {
        const descripcion = texto.trim();
        if (descripcion.length < 4) return { texto: 'Cuéntame un poco más sobre el diseño que quieres, o envíame una foto de referencia.' };
        if (descripcion.length > 600) return { texto: 'La descripción es muy larga (máximo 600 caracteres). ¿Puedes resumirla?' };
        p.descripcion = descripcion;
        break;
      }
      case 'fecha': {
        const fecha = interpretarFecha(texto, this.ahora());
        if (!fecha) return { texto: 'No logré entender la fecha. Prueba con «20 de noviembre», «mañana», «el viernes» o 2026-11-20.' };
        const v = validarFormatoFecha(fecha, hoyISO(this.ahora()));
        if (!v.valido) return { texto: `${v.motivo} ¿Para qué otra fecha la necesitas?` };
        p.fecha = v.valor;
        const hora = interpretarHora(texto);
        if (hora) p.hora = hora;
        break;
      }
      case 'hora': {
        const hora = interpretarHoraPedido(texto);
        if (!hora || !validarFormatoHora(hora).valido) {
          return { texto: 'No logré entender la hora. Escríbela, por ejemplo, «3 pm» o 15:30. Si te da igual, escribe «cualquiera».' };
        }
        p.hora = hora;
        break;
      }
      case 'confirmar': {
        if (siNo === 'si') return this.registrarPedido(s);
        return { texto: 'Responde «sí» para registrar el pedido o «no» para cancelarlo.', opciones: OPCIONES_CONFIRMAR };
      }
    }
    return this.preguntarPedido(s);
  }

  /** Pregunta el primer dato que falta; cuando está todo, muestra el resumen y pide confirmar. */
  private async preguntarPedido(s: Sesion): Promise<Respuesta> {
    const p = s.nuevo!;
    if (!p.nombre) {
      p.paso = 'nombre';
      return { texto: '¿A nombre de quién va el pedido?' };
    }
    if (!p.telefono) {
      p.paso = 'telefono';
      return { texto: '¿Cuál es tu teléfono de contacto?' };
    }
    if (p.cantidad === undefined) {
      p.paso = 'cantidad';
      return { texto: '¿Para cuántas personas es la torta?' };
    }
    if (!p.disenoTipo) {
      p.paso = 'diseno';
      if (!p.catalogo) {
        const r = await this.api.obtenerConfiguracion();
        if (r.estado !== 200 || !Array.isArray(r.json?.catalogo)) throw new Error('catálogo no disponible');
        p.catalogo = r.json.catalogo;
      }
      const lista = p.catalogo!.map(e => `• ${e.nombre}${e.descripcion ? `: ${e.descripcion}` : ''}`).join('\n');
      return {
        texto: `¿Qué diseño quieres? Elige uno del catálogo o toca «${OPCION_PERSONALIZADO}».\n${lista}`,
        opciones: [...p.catalogo!.map(e => e.nombre), OPCION_PERSONALIZADO]
      };
    }
    if (p.disenoTipo === 'personalizado' && !p.descripcion && !p.fotoUrl) {
      p.paso = 'diseno-detalle';
      return { texto: 'Cuéntame cómo quieres tu diseño personalizado, o envíame una foto de referencia. El encargado lo revisará antes de confirmarlo.' };
    }
    if (!p.fecha) {
      p.paso = 'fecha';
      return { texto: '¿Para qué fecha necesitas la torta? Por ejemplo «20 de noviembre» o «el viernes».' };
    }
    if (!p.hora) {
      p.paso = 'hora';
      return { texto: '¿A qué hora quieres recibirla? Por ejemplo «3 pm» o 15:30. Si te da igual, escribe «cualquiera» y será a las 12:00.' };
    }
    p.paso = 'confirmar';
    const diseno = p.disenoTipo === 'catalogo'
      ? p.estiloNombre
      : `Personalizado${p.descripcion ? `: «${p.descripcion}»` : ''}${p.fotoUrl ? ' (con foto de referencia)' : ''}`;
    return {
      texto: [
        'Este es tu pedido:',
        `• A nombre de: ${p.nombre}`,
        `• Teléfono: ${p.telefono}`,
        `• Torta personalizada para ${p.cantidad} personas`,
        `• Diseño: ${diseno}`,
        `• Entrega: ${p.fecha} a las ${p.hora}`,
        '¿Lo registro?'
      ].join('\n'),
      opciones: OPCIONES_CONFIRMAR
    };
  }

  private async registrarPedido(s: Sesion): Promise<Respuesta> {
    const p = s.nuevo!;
    const cuerpo: Record<string, unknown> = {
      cliente: p.nombre,
      telefono: p.telefono,
      cantidad: p.cantidad,
      fechaEntrega: p.fecha,
      horaEntrega: p.hora,
      tipo: p.disenoTipo,
      canal: 'telegram'
    };
    if (p.disenoTipo === 'catalogo') cuerpo.estiloId = p.estiloId;
    if (p.descripcion) cuerpo.descripcionDiseno = p.descripcion;
    if (p.fotoUrl) cuerpo.fotoUrl = p.fotoUrl;

    // Si la conexión falla aquí, el pedido sigue pendiente de confirmar y la persona puede repetir «sí».
    const r = await this.api.crearPedido(cuerpo);
    s.nuevo = undefined;
    if (r.estado !== 201) {
      const detalle = typeof r.json?.error === 'string' ? ` ${r.json.error}` : '';
      return { texto: `No pude registrar el pedido.${detalle} Puedes intentarlo de nuevo escribiendo «quiero hacer un pedido».` };
    }
    s.ultimoPedido = String(r.json.id);
    const revision = p.disenoTipo === 'personalizado' ? '\nComo el diseño es personalizado, el encargado lo revisará antes de confirmarlo.' : '';
    return {
      texto: `¡Listo! Tu pedido quedó registrado con el número #${r.json.id}.\nGuárdalo: lo necesitas para consultarlo o pedir cambios.${revision}`
    };
  }
}
