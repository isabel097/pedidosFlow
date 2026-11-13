import { Bot, Keyboard, type Context } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import type { ClienteApi } from './comandos.js';
import { Conversaciones, MENSAJE_FOTO_FUERA_DE_FLUJO, type Respuesta } from './conversacion.js';

export const MENSAJE_SOLO_TEXTO = MENSAJE_FOTO_FUERA_DE_FLUJO;

/** Menú de comandos que Telegram muestra al escribir "/" en el chat. */
export const COMANDOS_MENU = [
  { command: 'pedido', description: 'Hacer un pedido nuevo' },
  { command: 'consultar', description: 'Ver el estado de un pedido' },
  { command: 'cantidad', description: 'Pedir un cambio de cantidad' },
  { command: 'fecha', description: 'Pedir un cambio de fecha de entrega' },
  { command: 'ayuda', description: 'Ver los comandos disponibles' }
];

/** Fotos más pesadas que esto se descartan en favor de una versión más pequeña (el servidor acepta hasta ~3,7 MB). */
const LIMITE_BYTES_FOTO = 3_000_000;

export interface OpcionesBot {
  /** Reloj del bot (solo se cambia en las pruebas). */
  ahora?: () => Date;
  /** Descarga una foto de Telegram y la devuelve como data URI (solo se cambia en las pruebas). */
  descargarFoto?: (fileId: string) => Promise<string>;
}

/** Evita que el token aparezca en la consola si algún error de red lo incluye en su texto. */
export function ocultarToken(texto: string, token: string): string {
  return token ? texto.split(token).join('***') : texto;
}

function teclado(opciones: string[]): Keyboard {
  const t = new Keyboard();
  opciones.forEach((o, i) => {
    t.text(o);
    if (i % 2 === 1 && i < opciones.length - 1) t.row();
  });
  return t.oneTime().resized();
}

async function responder(ctx: Context, r: Respuesta): Promise<void> {
  await ctx.reply(r.texto, { reply_markup: r.opciones ? teclado(r.opciones) : { remove_keyboard: true as const } });
}

/**
 * Conecta Telegram con la lógica del bot. Aquí no hay reglas de negocio:
 * cada mensaje se entrega a la conversación (comandos o lenguaje normal) y su respuesta se envía al mismo chat.
 * botInfo y las opciones solo se pasan en las pruebas, para no consultar a Telegram y para fijar la fecha.
 */
export function crearBot(token: string, api: ClienteApi, botInfo?: UserFromGetMe, opciones: OpcionesBot = {}): Bot {
  const bot = new Bot(token, botInfo ? { botInfo } : undefined);
  const conversaciones = new Conversaciones(api, opciones.ahora);

  async function descargarDeTelegram(fileId: string): Promise<string> {
    const archivo = await bot.api.getFile(fileId);
    if (!archivo.file_path) throw new Error('Telegram no devolvió la ruta del archivo');
    const r = await fetch(`https://api.telegram.org/file/bot${token}/${archivo.file_path}`, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`Descarga fallida (${r.status})`);
    const tipo = /\.png$/i.test(archivo.file_path) ? 'image/png' : /\.webp$/i.test(archivo.file_path) ? 'image/webp' : 'image/jpeg';
    return `data:${tipo};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`;
  }
  const descargarFoto = opciones.descargarFoto ?? descargarDeTelegram;

  bot.on('message:text', async ctx => {
    await responder(ctx, await conversaciones.atender(ctx.chat.id, ctx.message.text));
  });

  bot.chatType('private').on('message:photo', async ctx => {
    const fotos = ctx.message.photo;
    const elegida = [...fotos].reverse().find(f => (f.file_size ?? 0) <= LIMITE_BYTES_FOTO) ?? fotos[0];
    await responder(ctx, await conversaciones.atenderFoto(ctx.chat.id, () => descargarFoto(elegida.file_id), ctx.message.caption));
  });

  // Stickers, audios, etc.: solo se responde en chats privados, para no molestar en grupos.
  bot.chatType('private').on('message', async ctx => {
    await ctx.reply(MENSAJE_SOLO_TEXTO);
  });

  bot.catch(err => {
    console.error('Error al atender un mensaje:', ocultarToken(String(err.message ?? err), token));
  });

  return bot;
}
