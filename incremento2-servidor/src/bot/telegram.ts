import { Bot } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import { procesarMensaje, type ClienteApi } from './comandos.js';

export const MENSAJE_SOLO_TEXTO = 'Por ahora solo entiendo mensajes de texto. Escribe /ayuda para ver los comandos.';

/** Menú de comandos que Telegram muestra al escribir "/" en el chat. */
export const COMANDOS_MENU = [
  { command: 'consultar', description: 'Ver el estado de un pedido' },
  { command: 'cantidad', description: 'Pedir un cambio de cantidad' },
  { command: 'fecha', description: 'Pedir un cambio de fecha de entrega' },
  { command: 'ayuda', description: 'Ver los comandos disponibles' }
];

/** Evita que el token aparezca en la consola si algún error de red lo incluye en su texto. */
export function ocultarToken(texto: string, token: string): string {
  return token ? texto.split(token).join('***') : texto;
}

/**
 * Conecta Telegram con la lógica del bot. Aquí no hay reglas de negocio:
 * cada mensaje de texto se entrega a procesarMensaje y su respuesta se envía al mismo chat.
 * botInfo solo se pasa en las pruebas, para no consultar a Telegram.
 */
export function crearBot(token: string, api: ClienteApi, botInfo?: UserFromGetMe): Bot {
  const bot = new Bot(token, botInfo ? { botInfo } : undefined);

  bot.on('message:text', async ctx => {
    await ctx.reply(await procesarMensaje(ctx.message.text, api));
  });

  // Fotos, stickers, audios, etc.: solo se responde en chats privados, para no molestar en grupos.
  bot.chatType('private').on('message', async ctx => {
    await ctx.reply(MENSAJE_SOLO_TEXTO);
  });

  bot.catch(err => {
    console.error('Error al atender un mensaje:', ocultarToken(String(err.message ?? err), token));
  });

  return bot;
}
