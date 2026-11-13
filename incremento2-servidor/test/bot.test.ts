import test from 'node:test';
import assert from 'node:assert/strict';
import { iniciarEntorno, pedir } from './ayudas.js';
import { crearClienteApi } from '../src/bot/clienteApi.js';
import { procesarMensaje, TEXTO_AYUDA, type ClienteApi } from '../src/bot/comandos.js';

// Pruebas de integración: el bot habla con el servidor real (carpeta de datos temporal propia).
// Los mensajes de Telegram se simulan llamando directamente a procesarMensaje.
async function conBot(fn: (e: Awaited<ReturnType<typeof iniciarEntorno>>, bot: (texto: string) => Promise<string>) => Promise<void>) {
  const e = await iniciarEntorno();
  try {
    const api = crearClienteApi(e.base);
    await fn(e, texto => procesarMensaje(texto, api));
  } finally {
    await e.cerrar();
  }
}

// ── CA-1: consulta de un pedido ───────────────────────────────────────────────
test('CP-52 bot CA-1: /consultar 154 responde con el estado y la etapa de producción', () =>
  conBot(async (_e, bot) => {
    const r = await bot('/consultar 154');
    assert.match(r, /Pedido #154/);
    assert.match(r, /Estado: Confirmado/);
    assert.match(r, /Etapa de producción: Antes de producción \(0 de 7 pasos, 0 %\)/);
    assert.match(r, /Cantidad: 20 personas/);
  }));

test('CP-53 bot CA-1: /consultar 155 muestra el avance de un pedido en producción', () =>
  conBot(async (_e, bot) => {
    const r = await bot('/consultar 155');
    assert.match(r, /Estado: En producción/);
    assert.match(r, /Etapa de producción: En producción \(3 de 7 pasos/);
  }));

test('CP-54 bot: la consulta no muestra nombre ni teléfono del cliente', () =>
  conBot(async (_e, bot) => {
    const r = await bot('/consultar 154');
    assert.doesNotMatch(r, /Laura|Gómez|300/);
  }));

// ── CA-2: cambio aplicado y canal en el historial ─────────────────────────────
test('CP-55 bot CA-2: /cantidad 154 25 aplica el cambio y el historial lo muestra con el canal telegram', () =>
  conBot(async (e, bot) => {
    const r = await bot('/cantidad 154 25');
    assert.match(r, /el cambio fue aplicado/);
    assert.match(r, /20 personas → 25 personas/);
    assert.equal((await pedir(e, 'GET', '/api/pedidos/154')).json.cantidad, 25);
    const historial = (await pedir(e, 'GET', '/api/cambios')).json;
    assert.equal(historial[0].pedidoId, '154');
    assert.equal(historial[0].resultado, 'aplicado');
    assert.equal(historial[0].canal, 'telegram');
  }));

test('CP-56 bot: /fecha 154 aplica el cambio, con hora opcional, y queda con canal telegram', () =>
  conBot(async (e, bot) => {
    const r = await bot('/fecha 154 2026-11-20 10:30');
    assert.match(r, /el cambio fue aplicado/);
    const p = (await pedir(e, 'GET', '/api/pedidos/154')).json;
    assert.equal(p.fechaEntrega, '2026-11-20');
    assert.equal(p.horaEntrega, '10:30');
    assert.equal((await pedir(e, 'GET', '/api/cambios')).json[0].canal, 'telegram');
  }));

// ── CA-3: cambio que pasa a revisión ──────────────────────────────────────────
test('CP-57 bot CA-3: /cantidad 155 30 queda en revisión con el motivo y el pedido no cambia', () =>
  conBot(async (e, bot) => {
    const r = await bot('/cantidad 155 30');
    assert.match(r, /quedó en revisión/);
    assert.match(r, /Motivo: .*requiere revisión manual/);
    assert.match(r, /no se modifica hasta que el encargado decida/);
    assert.equal((await pedir(e, 'GET', '/api/pedidos/155')).json.cantidad, 20);
    const pendientes = (await pedir(e, 'GET', '/api/revisiones-pendientes')).json;
    assert.ok(pendientes.some((x: any) => x.pedidoId === '155' && x.canal === 'telegram'));
  }));

test('CP-58 bot: /fecha de un pedido en producción también queda en revisión', () =>
  conBot(async (e, bot) => {
    const r = await bot('/fecha 155 2026-11-25');
    assert.match(r, /quedó en revisión/);
    assert.equal((await pedir(e, 'GET', '/api/pedidos/155')).json.fechaEntrega, '2026-11-09');
  }));

test('CP-59 bot: un cambio rechazado por el motor se informa con el motivo', () =>
  conBot(async (e, bot) => {
    await pedir(e, 'PATCH', '/api/pedidos/154/produccion', { checklist: Array.from({ length: 7 }, () => true) });
    const r = await bot('/cantidad 154 30');
    assert.match(r, /no se pudo aplicar automáticamente/);
    assert.match(r, /no admite cambios de cantidad/);
    assert.equal((await pedir(e, 'GET', '/api/pedidos/154')).json.cantidad, 20);
  }));

// ── CA-4: pedido inexistente ──────────────────────────────────────────────────
test('CP-60 bot CA-4: un pedido inexistente se informa sin pedir más datos y sin registrar nada', () =>
  conBot(async (e, bot) => {
    const antes = (await pedir(e, 'GET', '/api/cambios')).json.length;
    for (const texto of ['/consultar 999', '/cantidad 999 10', '/fecha 999 2026-11-20']) {
      const r = await bot(texto);
      assert.match(r, /No encontré el pedido #999/);
      assert.doesNotMatch(r, /\?/);
    }
    assert.equal((await pedir(e, 'GET', '/api/cambios')).json.length, antes);
  }));

test('CP-61 bot: un pedido inexistente se detecta antes de revisar la cantidad escrita', () =>
  conBot(async (_e, bot) => {
    assert.match(await bot('/cantidad 999 abc'), /No encontré el pedido #999/);
  }));

// ── Entradas inválidas ────────────────────────────────────────────────────────
test('CP-62 bot: faltan o sobran datos → explica el uso y no llama al sistema', () =>
  conBot(async (e, bot) => {
    const antes = (await pedir(e, 'GET', '/api/cambios')).json.length;
    assert.match(await bot('/cantidad'), /Uso: \/cantidad 154 40/);
    assert.match(await bot('/cantidad 154'), /Uso: \/cantidad 154 40/);
    assert.match(await bot('/cantidad 154 40 50'), /Uso: \/cantidad 154 40/);
    assert.match(await bot('/fecha 154'), /Uso: \/fecha 154/);
    assert.match(await bot('/consultar'), /Uso: \/consultar 154/);
    assert.match(await bot('/consultar abc'), /Uso: \/consultar 154/);
    assert.equal((await pedir(e, 'GET', '/api/cambios')).json.length, antes);
  }));

test('CP-63 bot: valores inválidos muestran el motivo del sistema y no cambian el pedido', () =>
  conBot(async (e, bot) => {
    assert.match(await bot('/cantidad 154 abc'), /La cantidad debe ser un número/);
    assert.match(await bot('/cantidad 154 -5'), /entero positivo/);
    assert.match(await bot('/cantidad 154 20'), /igual a la actual/);
    assert.match(await bot('/fecha 154 2026-13-45'), /no existe en el calendario/);
    assert.match(await bot('/fecha 154 2026-11-20 25:99'), /formato HH:MM/);
    assert.equal((await pedir(e, 'GET', '/api/pedidos/154')).json.cantidad, 20);
  }));

test('CP-64 bot: un pedido cancelado informa que no admite cambios', () =>
  conBot(async (e, bot) => {
    const rev = (await pedir(e, 'GET', '/api/revisiones-pendientes')).json.find((x: any) => x.pedidoId === '156');
    await pedir(e, 'PUT', `/api/revisiones-pendientes/${rev.id}/decidir`, { decision: 'mantener-rechazo' });
    assert.equal((await pedir(e, 'GET', '/api/pedidos/156')).json.estado, 'Cancelado');
    assert.match(await bot('/cantidad 156 10'), /cancelado y no admite cambios/);
    assert.match(await bot('/consultar 156'), /Estado: Cancelado/);
  }));

// ── Formato de los comandos ───────────────────────────────────────────────────
test('CP-65 bot: acepta mayúsculas, el símbolo # y el nombre del bot en el comando', () =>
  conBot(async (_e, bot) => {
    assert.match(await bot('/CONSULTAR #154'), /Pedido #154/);
    assert.match(await bot('/consultar@PedidosFlowBot 154'), /Pedido #154/);
    assert.match(await bot('  /consultar   154  '), /Pedido #154/);
  }));

test('CP-66 bot: /start y /ayuda muestran los comandos; un texto o comando desconocido orienta al usuario', () =>
  conBot(async (_e, bot) => {
    assert.equal(await bot('/start'), TEXTO_AYUDA);
    assert.equal(await bot('/ayuda'), TEXTO_AYUDA);
    assert.match(TEXTO_AYUDA, /\/consultar/);
    assert.match(await bot('hola, quiero cambiar mi torta'), /Escribe \/ayuda/);
    assert.match(await bot('/borrar 154'), /No conozco ese comando/);
  }));

// ── Fallos de conexión ────────────────────────────────────────────────────────
test('CP-67 bot: si el sistema no responde, contesta con un mensaje amable y no lanza errores', async () => {
  const caido: ClienteApi = {
    consultarPedido: async () => { throw new Error('ECONNREFUSED'); },
    solicitarCambio: async () => { throw new Error('ECONNREFUSED'); },
    crearPedido: async () => { throw new Error('ECONNREFUSED'); },
    obtenerConfiguracion: async () => { throw new Error('ECONNREFUSED'); }
  };
  assert.match(await procesarMensaje('/consultar 154', caido), /No puedo comunicarme con el sistema/);
  assert.match(await procesarMensaje('/cantidad 154 30', caido), /No puedo comunicarme con el sistema/);
});

test('CP-68 bot: una respuesta inesperada del sistema (500) no se muestra tal cual', async () => {
  const roto: ClienteApi = {
    consultarPedido: async () => ({ estado: 500, json: { error: 'detalle interno' } }),
    solicitarCambio: async () => ({ estado: 500, json: null }),
    crearPedido: async () => ({ estado: 500, json: null }),
    obtenerConfiguracion: async () => ({ estado: 500, json: null })
  };
  const r = await procesarMensaje('/consultar 154', roto);
  assert.match(r, /Ocurrió un problema en el sistema/);
  assert.doesNotMatch(r, /detalle interno/);
});
