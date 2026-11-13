import { Bot, Keyboard } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import type { ClienteApi } from './comandos.js';
import { Conversaciones } from './conversacion.js';

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
 * cada mensaje de texto se entrega a la conversación (comandos o lenguaje normal) y su respuesta se envía al mismo chat.
 * botInfo y ahora solo se pasan en las pruebas, para no consultar a Telegram y para fijar la fecha.
 */
export function crearBot(token: string, api: ClienteApi, botInfo?: UserFromGetMe, ahora?: () => Date): Bot {
  const bot = new Bot(token, botInfo ? { botInfo } : undefined);
  const conversaciones = new Conversaciones(api, ahora);

  bot.on('message:text', async ctx => {
    const r = await conversaciones.atender(ctx.chat.id, ctx.message.text);
    const teclado = r.opciones
      ? new Keyboard().text(r.opciones[0]).text(r.opciones[1]).oneTime().resized()
      : { remove_keyboard: true as const };
    await ctx.reply(r.texto, { reply_markup: teclado });
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
