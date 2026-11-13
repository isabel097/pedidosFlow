import test from 'node:test';
import assert from 'node:assert/strict';
import type { Bot } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import { iniciarEntorno, pedir } from './ayudas.js';
import { crearClienteApi } from '../src/bot/clienteApi.js';
import { type ClienteApi } from '../src/bot/comandos.js';
import { Conversaciones } from '../src/bot/conversacion.js';
import { COMANDOS_MENU, MENSAJE_SOLO_TEXTO, crearBot, ocultarToken } from '../src/bot/telegram.js';

// Estas pruebas recorren el camino completo del bot (Telegram → grammy → lógica → servidor real),
// pero sin conectarse a Telegram: las llamadas a la API de Telegram se interceptan y se registran.
const TOKEN_PRUEBA = '123456:TOKEN-FALSO-SOLO-PARA-PRUEBAS';
const INFO_BOT = { id: 1, is_bot: true, first_name: 'PedidosFlow', username: 'PedidosFlowBot' } as unknown as UserFromGetMe;

interface LlamadaTelegram {
  metodo: string;
  payload: any;
}

function crearBotSimulado(api: ClienteApi): { bot: Bot; enviados: LlamadaTelegram[] } {
  const bot = crearBot(TOKEN_PRUEBA, api, INFO_BOT);
  const enviados: LlamadaTelegram[] = [];
  bot.api.config.use(async (_siguiente, metodo, payload) => {
    enviados.push({ metodo, payload });
    return { ok: true, result: true } as any;
  });
  return { bot, enviados };
}

function mensaje(extra: Record<string, unknown>, tipoChat: 'private' | 'group' = 'private'): any {
  return {
    update_id: 1,
    message: {
      message_id: 10,
      date: 1_700_000_000,
      chat: tipoChat === 'private' ? { id: 42, type: 'private', first_name: 'Cliente' } : { id: -100, type: 'group', title: 'Grupo' },
      from: { id: 42, is_bot: false, first_name: 'Cliente' },
      ...extra
    }
  };
}

const respuestas = (enviados: LlamadaTelegram[]) => enviados.filter(l => l.metodo === 'sendMessage');

async function conTelegram(fn: (e: Awaited<ReturnType<typeof iniciarEntorno>>, bot: Bot, enviados: LlamadaTelegram[]) => Promise<void>) {
  const e = await iniciarEntorno();
  try {
    const { bot, enviados } = crearBotSimulado(crearClienteApi(e.base));
    await fn(e, bot, enviados);
  } finally {
    await e.cerrar();
  }
}

test('CP-69 telegram CA-1: un mensaje de texto se responde en el mismo chat con la consulta del pedido', () =>
  conTelegram(async (_e, bot, enviados) => {
    await bot.handleUpdate(mensaje({ text: '/consultar 154' }));
    const r = respuestas(enviados);
    assert.equal(r.length, 1);
    assert.equal(r[0].payload.chat_id, 42);
    assert.match(r[0].payload.text, /Pedido #154/);
    assert.match(r[0].payload.text, /Etapa de producción: Antes de producción/);
  }));

test('CP-70 telegram CA-2: un cambio pedido por Telegram se aplica y el historial lo muestra con ese canal', () =>
  conTelegram(async (e, bot, enviados) => {
    await bot.handleUpdate(mensaje({ text: '/cantidad 154 25' }));
    assert.match(respuestas(enviados)[0].payload.text, /el cambio fue aplicado/);
    assert.equal((await pedir(e, 'GET', '/api/pedidos/154')).json.cantidad, 25);
    assert.equal((await pedir(e, 'GET', '/api/cambios')).json[0].canal, 'telegram');
  }));

test('CP-71 telegram CA-3 y CA-4: revisión para #155 y mensaje claro para un pedido inexistente', () =>
  conTelegram(async (e, bot, enviados) => {
    await bot.handleUpdate(mensaje({ text: '/cantidad 155 30' }));
    await bot.handleUpdate(mensaje({ text: '/consultar 999' }));
    const [revision, inexistente] = respuestas(enviados).map(l => l.payload.text as string);
    assert.match(revision, /quedó en revisión/);
    assert.match(inexistente, /No encontré el pedido #999/);
    assert.equal((await pedir(e, 'GET', '/api/pedidos/155')).json.cantidad, 20);
  }));

test('CP-72 telegram: una foto o sticker en un chat privado recibe el aviso de que solo se entiende texto', () =>
  conTelegram(async (e, bot, enviados) => {
    const antes = (await pedir(e, 'GET', '/api/cambios')).json.length;
    await bot.handleUpdate(mensaje({ sticker: { file_id: 'x', file_unique_id: 'y', type: 'regular', width: 1, height: 1, is_animated: false, is_video: false } }));
    await bot.handleUpdate(mensaje({ photo: [{ file_id: 'x', file_unique_id: 'y', width: 1, height: 1 }] }));
    const r = respuestas(enviados);
    assert.equal(r.length, 2);
    assert.ok(r.every(l => l.payload.text === MENSAJE_SOLO_TEXTO));
    assert.equal((await pedir(e, 'GET', '/api/cambios')).json.length, antes);
  }));

test('CP-73 telegram: en un grupo no responde a mensajes que no son texto', () =>
  conTelegram(async (_e, bot, enviados) => {
    await bot.handleUpdate(mensaje({ photo: [{ file_id: 'x', file_unique_id: 'y', width: 1, height: 1 }] }, 'group'));
    assert.equal(respuestas(enviados).length, 0);
  }));

test('CP-74 telegram: si el servidor no responde, el bot sigue contestando con un mensaje amable', async () => {
  const caido: ClienteApi = {
    consultarPedido: async () => { throw new Error('ECONNREFUSED'); },
    solicitarCambio: async () => { throw new Error('ECONNREFUSED'); },
    crearPedido: async () => { throw new Error('ECONNREFUSED'); },
    obtenerConfiguracion: async () => { throw new Error('ECONNREFUSED'); }
  };
  const { bot, enviados } = crearBotSimulado(caido);
  await bot.handleUpdate(mensaje({ text: '/consultar 154' }));
  assert.match(respuestas(enviados)[0].payload.text, /No puedo comunicarme con el sistema/);
});

test('CP-75 telegram: todos los comandos del menú de Telegram son comandos que el bot entiende', async () => {
  const api: ClienteApi = {
    consultarPedido: async () => ({ estado: 404, json: null }),
    solicitarCambio: async () => ({ estado: 404, json: null }),
    crearPedido: async () => ({ estado: 404, json: null }),
    obtenerConfiguracion: async () => ({ estado: 404, json: null })
  };
  assert.deepEqual(COMANDOS_MENU.map(c => c.command).sort(), ['ayuda', 'cantidad', 'consultar', 'fecha', 'pedido']);
  for (const c of COMANDOS_MENU) {
    const conversaciones = new Conversaciones(api);
    assert.doesNotMatch((await conversaciones.atender(1, `/${c.command}`)).texto, /No conozco ese comando/);
  }
});

test('CP-76 telegram: el token nunca se muestra en los mensajes de error', () => {
  const error = `request to https://api.telegram.org/bot${TOKEN_PRUEBA}/getMe failed`;
  const limpio = ocultarToken(error, TOKEN_PRUEBA);
  assert.doesNotMatch(limpio, /TOKEN-FALSO/);
  assert.match(limpio, /bot\*\*\*\/getMe/);
  assert.equal(ocultarToken('sin token', ''), 'sin token');
});
