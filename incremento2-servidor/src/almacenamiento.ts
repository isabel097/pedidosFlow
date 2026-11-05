import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Cambio, Configuracion, Notificacion, Pedido } from './tipos.js';
import {
  crearCambiosIniciales,
  crearConfiguracionInicial,
  crearNotificacionesIniciales,
  crearPedidosIniciales
} from './datosIniciales.js';

type Coleccion = 'pedidos' | 'cambios' | 'notificaciones' | 'configuracion';

function leerJson<T>(archivo: string, porDefecto: () => T): T {
  try {
    if (!fs.existsSync(archivo)) return porDefecto();
    return JSON.parse(fs.readFileSync(archivo, 'utf8')) as T;
  } catch {
    // Archivo dañado: se conserva una copia y se vuelve a los datos iniciales.
    try {
      fs.copyFileSync(archivo, `${archivo}.dañado-${Date.now()}`);
    } catch {
      /* sin copia */
    }
    return porDefecto();
  }
}

function escribirJson(archivo: string, valor: unknown): void {
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  // Un nombre temporal único evita colisiones entre escrituras seguidas o procesos distintos.
  const sufijo = `${process.pid}-${crypto.randomUUID()}`;
  const temporal = `${archivo}.${sufijo}.tmp`;
  const respaldo = `${archivo}.${sufijo}.bak`;
  const contenido = `${JSON.stringify(valor, null, 2)}\n`;
  let movioOriginal = false;

  try {
    fs.writeFileSync(temporal, contenido, { encoding: 'utf8', flag: 'wx' });
    try {
      // En Windows, renombrar encima de un archivo existente puede fallar según el sistema
      // de archivos. Se aparta el original y se restaura si la sustitución no termina.
      if (process.platform === 'win32' && fs.existsSync(archivo)) {
        fs.renameSync(archivo, respaldo);
        movioOriginal = true;
      }
      fs.renameSync(temporal, archivo);
      if (movioOriginal && fs.existsSync(respaldo)) {
        try { fs.unlinkSync(respaldo); } catch { /* archivo final escrito correctamente; respaldo temporal opcional */ }
      }
    } catch (error) {
      if (movioOriginal && fs.existsSync(respaldo) && !fs.existsSync(archivo)) {
        fs.renameSync(respaldo, archivo);
      }
      throw error;
    }
  } finally {
    if (fs.existsSync(temporal)) fs.unlinkSync(temporal);
    // Un respaldo que no se pudo retirar no debe ocultar un error de escritura posterior.
    if (fs.existsSync(respaldo) && fs.existsSync(archivo)) {
      try { fs.unlinkSync(respaldo); } catch { /* la siguiente ejecución podrá limpiarlo */ }
    }
  }
}

/** Completa con valores por defecto las claves que falten (por ejemplo, tras actualizar el programa). */
export function normalizarConfiguracion(c: Partial<Configuracion> | undefined): Configuracion {
  const base = crearConfiguracionInicial();
  if (!c) return base;
  return {
    reglas: {
      cantidad: { ...base.reglas.cantidad, ...c.reglas?.cantidad },
      diseno: { ...base.reglas.diseno, ...c.reglas?.diseno },
      fecha: { ...base.reglas.fecha, ...c.reglas?.fecha }
    },
    negocio: { ...base.negocio, ...c.negocio },
    pasosProduccion: Array.isArray(c.pasosProduccion) && c.pasosProduccion.length ? c.pasosProduccion : base.pasosProduccion,
    pedidosMaximosPorDia: typeof c.pedidosMaximosPorDia === 'number' && Number.isInteger(c.pedidosMaximosPorDia) && c.pedidosMaximosPorDia >= 1 && c.pedidosMaximosPorDia <= 100 ? c.pedidosMaximosPorDia : base.pedidosMaximosPorDia,
    catalogo: Array.isArray(c.catalogo) && c.catalogo.length ? c.catalogo : base.catalogo,
    bot: { ...base.bot, ...c.bot }
  };
}

export interface OpcionesAlmacen {
  /** Mantiene el conjunto de ejemplo para demostraciones académicas. */
  usarDatosDemo?: boolean;
}

export interface Almacen {
  readonly directorio: string;
  pedidos: Pedido[];
  cambios: Cambio[];
  notificaciones: Notificacion[];
  configuracion: Configuracion;
  guardar(...colecciones: Coleccion[]): void;
}

/**
 * Persistencia local en archivos JSON (carpeta `data/`). En modo demo se inicializa con cinco
 * pedidos y su solicitud pendiente asociada. Si un archivo de pedidos existente está vacío de una
 * ejecución anterior, vuelve a sembrar el conjunto para que siempre haya datos de prueba; después
 * conserva los cambios y no duplica ni reinicia pedidos ya existentes. usarDatosDemo=false inicia vacío.
 * Cada escritura es atómica (archivo temporal + renombrado).
 */
export function crearAlmacen(directorio: string, opciones: OpcionesAlmacen = {}): Almacen {
  const usarDatosDemo = opciones.usarDatosDemo ?? true;
  const archivos: Record<Coleccion, string> = {
    pedidos: path.join(directorio, 'pedidos.json'),
    cambios: path.join(directorio, 'cambios.json'),
    notificaciones: path.join(directorio, 'notificaciones.json'),
    configuracion: path.join(directorio, 'configuracion.json')
  };

  const pedidosLeidos = leerJson<Pedido[]>(archivos.pedidos, usarDatosDemo ? crearPedidosIniciales : () => []);
  // Si una versión anterior dejó un pedidos.json vacío, al activar el modo demo se
  // vuelve a sembrar el conjunto inicial. Una vez existen pedidos, no se duplican ni
  // se reemplazan al reiniciar; los cambios reales quedan persistidos.
  const reponerDemoPorqueNoHayPedidos = usarDatosDemo && pedidosLeidos.length === 0;
  const pedidos = reponerDemoPorqueNoHayPedidos ? crearPedidosIniciales() : pedidosLeidos;

  const cambiosLeidos = leerJson<Cambio[]>(archivos.cambios, usarDatosDemo ? crearCambiosIniciales : () => []);
  const cambios = reponerDemoPorqueNoHayPedidos && cambiosLeidos.length === 0
    ? crearCambiosIniciales()
    : cambiosLeidos;

  const notificacionesLeidas = leerJson<Notificacion[]>(archivos.notificaciones, usarDatosDemo ? crearNotificacionesIniciales : () => []);
  const notificaciones = reponerDemoPorqueNoHayPedidos && notificacionesLeidas.length === 0
    ? crearNotificacionesIniciales()
    : notificacionesLeidas;

  const almacen: Almacen = {
    directorio,
    pedidos,
    cambios,
    notificaciones,
    configuracion: normalizarConfiguracion(leerJson<Partial<Configuracion> | undefined>(archivos.configuracion, () => undefined)),
    guardar(...colecciones: Coleccion[]) {
      const todas: Coleccion[] = colecciones.length ? colecciones : ['pedidos', 'cambios', 'notificaciones', 'configuracion'];
      for (const c of todas) escribirJson(archivos[c], almacen[c]);
    }
  };
  almacen.guardar();
  return almacen;
}
