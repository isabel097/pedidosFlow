import type { Canal } from '../tipos.js';

export interface RespuestaApi {
  estado: number;
  json: any;
}

export interface ClienteApi {
  consultarPedido(id: string): Promise<RespuestaApi>;
  solicitarCambio(id: string, cuerpo: Record<string, unknown>): Promise<RespuestaApi>;
}

const CANAL: Canal = 'telegram';

export const TEXTO_AYUDA = [
  'Hola, soy el asistente de PedidosFlow. Puedes usar estos comandos:',
  '',
  '/consultar 154 - ver el estado de tu pedido',
  '/cantidad 154 40 - pedir cambiar la cantidad de personas',
  '/fecha 154 2026-11-20 - pedir cambiar la fecha de entrega (puedes agregar la hora, por ejemplo 15:00)',
  '',
  'Cambia 154 por el número de tu pedido.'
].join('\n');

const MENSAJE_SIN_CONEXION = 'No puedo comunicarme con el sistema en este momento. Inténtalo más tarde.';

function interpretar(texto: string): { comando: string; args: string[] } | null {
  const limpio = texto.trim();
  if (!limpio.startsWith('/')) return null;
  const [primero, ...args] = limpio.split(/\s+/);
  // En grupos Telegram agrega el nombre del bot: /consultar@MiBot 154
  const comando = primero.slice(1).split('@')[0].toLowerCase();
  return { comando, args };
}

function numeroPedido(texto: string | undefined): string | null {
  const m = /^#?(\d{1,9})$/.exec(texto ?? '');
  return m ? m[1] : null;
}

function noEncontrado(id: string): string {
  return `No encontré el pedido #${id}. Revisa el número.`;
}

function errorDeApi(r: RespuestaApi, id: string): string {
  if (r.estado === 404) return noEncontrado(id);
  const detalle = typeof r.json?.error === 'string' ? r.json.error : '';
  if (r.estado === 409 && detalle) return detalle;
  if (r.estado === 400 && detalle) return `No pude procesar la solicitud: ${detalle}`;
  return 'Ocurrió un problema en el sistema. Inténtalo más tarde.';
}

async function consultar(args: string[], api: ClienteApi): Promise<string> {
  const id = numeroPedido(args[0]);
  if (!id || args.length !== 1) return 'Uso: /consultar 154 (con el número de tu pedido).';
  const r = await api.consultarPedido(id);
  if (r.estado !== 200) return errorDeApi(r, id);
  const p = r.json;
  // No se muestran nombre ni teléfono del cliente: el bot aún no verifica quién escribe.
  return [
    `Pedido #${p.id}`,
    `Estado: ${p.estado}`,
    `Etapa de producción: ${p.etapa} (${p.pasosCompletados} de ${p.totalPasos} pasos, ${p.progreso} %)`,
    `Cantidad: ${p.cantidad} personas`,
    `Entrega: ${p.fechaEntrega} a las ${p.horaEntrega}`,
    `Diseño: ${p.disenoNombre}`
  ].join('\n');
}

async function solicitarCambio(id: string, cuerpo: Record<string, unknown>, api: ClienteApi): Promise<string> {
  const r = await api.solicitarCambio(id, { ...cuerpo, canal: CANAL });
  if (r.estado !== 201) return errorDeApi(r, id);
  const { cambio, evaluacion } = r.json;
  const resumen = `Pedido #${id} - ${cambio.campo}: ${cambio.detalleAnterior} → ${cambio.detalleNuevo}`;
  if (evaluacion.resultado === 'aplicado') {
    return `Listo, el cambio fue aplicado.\n${resumen}`;
  }
  if (evaluacion.resultado === 'pendiente-revision') {
    return `Tu solicitud quedó en revisión.\nMotivo: ${evaluacion.motivo}\nEl pedido no se modifica hasta que el encargado decida.\n${resumen}`;
  }
  return `El cambio no se pudo aplicar automáticamente.\nMotivo: ${evaluacion.motivo}\nQueda registrado y el encargado puede revisarlo.\n${resumen}`;
}

async function cantidad(args: string[], api: ClienteApi): Promise<string> {
  const id = numeroPedido(args[0]);
  if (!id || args.length !== 2) return 'Uso: /cantidad 154 40 (número de pedido y nueva cantidad de personas).';
  return solicitarCambio(id, { campo: 'Cantidad', valorNuevo: args[1] }, api);
}

async function fecha(args: string[], api: ClienteApi): Promise<string> {
  const id = numeroPedido(args[0]);
  if (!id || (args.length !== 2 && args.length !== 3)) {
    return 'Uso: /fecha 154 2026-11-20 (número de pedido y nueva fecha AAAA-MM-DD). Opcional: la hora, por ejemplo 15:00.';
  }
  const cuerpo: Record<string, unknown> = { campo: 'Fecha de entrega', valorNuevo: args[1] };
  if (args[2]) cuerpo.hora = args[2];
  return solicitarCambio(id, cuerpo, api);
}

/** Convierte un mensaje de Telegram en la respuesta que el bot debe enviar. Nunca lanza errores. */
export async function procesarMensaje(texto: string, api: ClienteApi): Promise<string> {
  const mensaje = interpretar(texto);
  if (!mensaje) return 'No entendí tu mensaje. Escribe /ayuda para ver los comandos.';
  try {
    switch (mensaje.comando) {
      case 'start':
      case 'ayuda':
        return TEXTO_AYUDA;
      case 'consultar':
        return await consultar(mensaje.args, api);
      case 'cantidad':
        return await cantidad(mensaje.args, api);
      case 'fecha':
        return await fecha(mensaje.args, api);
      default:
        return 'No conozco ese comando. Escribe /ayuda para ver los disponibles.';
    }
  } catch {
    return MENSAJE_SIN_CONEXION;
  }
}
