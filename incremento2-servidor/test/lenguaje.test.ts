import test from 'node:test';
import assert from 'node:assert/strict';
import type { UserFromGetMe } from 'grammy/types';
import { AHORA_FIJO, iniciarEntorno, pedir } from './ayudas.js';
import { crearClienteApi } from '../src/bot/clienteApi.js';
import type { ClienteApi } from '../src/bot/comandos.js';
import { Conversaciones, OPCIONES_CONFIRMAR, type Respuesta } from '../src/bot/conversacion.js';
import {
  extraerCantidad,
  extraerIdPedido,
  interpretarFecha,
  interpretarHora,
  interpretarMensaje,
  interpretarSiNo
} from '../src/bot/lenguaje.js';
import { crearBot } from '../src/bot/telegram.js';

// AHORA_FIJO es el miércoles 21 de octubre de 2026.
const HOY = AHORA_FIJO;

// ── Intérprete: fechas, horas, números ───────────────────────────────────────
test('CP-77 lenguaje: fechas en palabras y formatos habituales', () => {
  assert.equal(interpretarFecha('mañana', HOY), '2026-10-22');
  assert.equal(interpretarFecha('pasado mañana', HOY), '2026-10-23');
  assert.equal(interpretarFecha('hoy', HOY), '2026-10-21');
  assert.equal(interpretarFecha('20 de noviembre', HOY), '2026-11-20');
  assert.equal(interpretarFecha('20/11/2026', HOY), '2026-11-20');
  assert.equal(interpretarFecha('2026-11-20', HOY), '2026-11-20');
  assert.equal(interpretarFecha('el viernes', HOY), '2026-10-23');
  assert.equal(interpretarFecha('el lunes', HOY), '2026-10-26');
  assert.equal(interpretarFecha('el 31 de febrero', HOY), null);
  assert.equal(interpretarFecha('hola', HOY), null);
});

test('CP-78 lenguaje: una fecha pasada sin año se toma del próximo año salvo que se pida un cambio', () => {
  assert.equal(interpretarFecha('7 de octubre', HOY), '2027-10-07');
  assert.equal(interpretarFecha('cambia la entrega al 7 de octubre', HOY), '2026-10-07');
});

test('CP-79 lenguaje: horas en 12 y 24 horas', () => {
  assert.equal(interpretarHora('3 pm'), '15:00');
  assert.equal(interpretarHora('a las 4 de la tarde'), '16:00');
  assert.equal(interpretarHora('15:30'), '15:30');
  assert.equal(interpretarHora('10:30 am'), '10:30');
  assert.equal(interpretarHora('hola'), null);
});

test('CP-80 lenguaje: número de pedido con o sin la palabra pedido, sin confundirlo con una cantidad', () => {
  assert.equal(extraerIdPedido('quiero consultar el #154'), '154');
  assert.equal(extraerIdPedido('el pedido número 154'), '154');
  assert.equal(extraerIdPedido('cambia la cantidad del 154 a 40'), '154');
  assert.equal(extraerIdPedido('cambia a 40 el pedido 154'), '154');
  assert.equal(extraerIdPedido('consulta el 154'), '154');
  assert.equal(extraerIdPedido('cambia la cantidad a 150'), null);
  assert.equal(extraerIdPedido('somos 150 personas'), null);
  assert.equal(extraerIdPedido('mueve la entrega al 20 de noviembre a las 15:30'), null);
});

test('CP-81 lenguaje: cantidad con unidad, con preposición o suelta, sin confundirla con el pedido ni con fechas', () => {
  assert.equal(extraerCantidad('40 personas'), 40);
  assert.equal(extraerCantidad('a 40'), 40);
  assert.equal(extraerCantidad('cambia la cantidad del 154 a 40', '154'), 40);
  assert.equal(extraerCantidad('pedido 154 cantidad 35'), 35);
  assert.equal(extraerCantidad('somos 120'), 120);
  assert.equal(extraerCantidad('40'), 40);
  assert.equal(extraerCantidad('quiero 30 personas para el 20 de noviembre'), 30);
  assert.equal(extraerCantidad('mueve la entrega al 20 de noviembre'), null);
});

test('CP-82 lenguaje: reconoce qué quiere hacer la persona', () => {
  const casos: Array<[string, string]> = [
    ['quiero consultar el pedido 154', 'consultar'],
    ['¿Cómo va mi pedido #155?', 'consultar'],
    ['en qué etapa va el 155', 'consultar'],
    ['¿cuándo es la entrega del pedido 154?', 'consultar'],
    ['¿para cuántas personas es el pedido 154?', 'consultar'],
    ['hola, quiero consultar el pedido 154', 'consultar'],
    ['cambia la cantidad del pedido 154 a 40 personas', 'cantidad'],
    ['somos 35 personas en el pedido 154', 'cantidad'],
    ['quiero cambiar la fecha de entrega del pedido 154 al 20 de noviembre', 'fecha'],
    ['pasa la entrega del 154 para mañana', 'fecha'],
    ['buenos días, quiero cambiar la fecha del pedido 154', 'fecha'],
    ['quiero cambiar el diseño de mi torta', 'diseno'],
    ['quiero hacer un pedido nuevo', 'crear'],
    ['quiero cancelar el pedido 154', 'cancelar'],
    ['cambia la cantidad a 40 y la fecha al 20 de noviembre del pedido 154', 'varios'],
    ['hola', 'saludo'],
    ['ayuda', 'ayuda'],
    ['muchas gracias', 'gracias'],
    ['asdf qwer', 'desconocido'],
    ['154', 'desconocido']
  ];
  for (const [texto, esperado] of casos) {
    assert.equal(interpretarMensaje(texto, HOY).tipo, esperado, texto);
  }
});

test('CP-83 lenguaje: sí y no, con la negación primero', () => {
  assert.equal(interpretarSiNo('Sí, confirmar'), 'si');
  assert.equal(interpretarSiNo('dale'), 'si');
  assert.equal(interpretarSiNo('No, cancelar'), 'no');
  assert.equal(interpretarSiNo('no, no confirmo'), 'no');
  assert.equal(interpretarSiNo('mejor no'), 'no');
  assert.equal(interpretarSiNo('tal vez'), null);
  assert.equal(interpretarSiNo('no sé'), null);
  assert.equal(interpretarSiNo('sí, pero primero cambia la fecha del pedido 154 por favor'), null);
});

// ── Conversaciones contra el servidor real ───────────────────────────────────
type Entorno = Awaited<ReturnType<typeof iniciarEntorno>>;
type Escribir = (texto: string, chat?: number) => Promise<Respuesta>;

async function conLenguaje(fn: (e: Entorno, escribir: Escribir, avanzarMinutos: (m: number) => void) => Promise<void>) {
  const e = await iniciarEntorno();
  try {
    let instante = AHORA_FIJO.getTime();
    const conversaciones = new Conversaciones(crearClienteApi(e.base), () => new Date(instante));
    await fn(e, (texto, chat = 1) => conversaciones.atender(chat, texto), m => { instante += m * 60_000; });
  } finally {
    await e.cerrar();
  }
}

const cambios = async (e: Entorno) => (await pedir(e, 'GET', '/api/cambios')).json as any[];
// Los datos de prueba ya traen un cambio inicial (el del pedido #156, pendiente de revisión).
const CAMBIOS_INICIALES = 1;
const cambiosNuevos = async (e: Entorno) => (await cambios(e)).length - CAMBIOS_INICIALES;
const pedido = async (e: Entorno, id: string) => (await pedir(e, 'GET', `/api/pedidos/${id}`)).json;

test('CP-84 lenguaje CA-1: consultar un pedido escribiendo normal', () =>
  conLenguaje(async (_e, escribir) => {
    const r = await escribir('quiero consultar el pedido 154');
    assert.match(r.texto, /Pedido #154/);
    assert.match(r.texto, /Etapa de producción: Antes de producción/);
    assert.match((await escribir('¿cómo va mi pedido #155?')).texto, /Estado: En producción/);
  }));

test('CP-85 lenguaje CA-2: un cambio de cantidad pide confirmación y solo se aplica al confirmar', () =>
  conLenguaje(async (e, escribir) => {
    const r = await escribir('cambia la cantidad del pedido 154 a 40 personas');
    assert.match(r.texto, /Pedido #154 - Cantidad: 20 personas → 40 personas/);
    assert.deepEqual(r.opciones, OPCIONES_CONFIRMAR);
    assert.equal((await pedido(e, '154')).cantidad, 20);
    assert.equal(await cambiosNuevos(e), 0);

    const ok = await escribir('Sí, confirmar');
    assert.match(ok.texto, /el cambio fue aplicado/);
    assert.equal((await pedido(e, '154')).cantidad, 40);
    const historial = await cambios(e);
    assert.equal(historial[0].canal, 'telegram');
    assert.equal(historial[0].resultado, 'aplicado');
  }));

test('CP-86 lenguaje: si se responde que no, no se cambia nada', () =>
  conLenguaje(async (e, escribir) => {
    await escribir('cambia la cantidad del 154 a 40');
    const r = await escribir('No, cancelar');
    assert.match(r.texto, /no hice ningún cambio/);
    assert.equal((await pedido(e, '154')).cantidad, 20);
    assert.equal(await cambiosNuevos(e), 0);
    // y un «sí» posterior ya no aplica nada
    assert.match((await escribir('sí')).texto, /No logré entender/);
    assert.equal((await pedido(e, '154')).cantidad, 20);
  }));

test('CP-87 lenguaje: conversación en varios mensajes (pregunta el pedido y luego la cantidad)', () =>
  conLenguaje(async (e, escribir) => {
    assert.match((await escribir('quiero cambiar la cantidad')).texto, /¿De qué pedido\?/);
    const cantidad = await escribir('154');
    assert.match(cantidad.texto, /El pedido #154 tiene 20 personas/);
    const confirmar = await escribir('a 35');
    assert.match(confirmar.texto, /20 personas → 35 personas/);
    assert.match((await escribir('dale')).texto, /el cambio fue aplicado/);
    assert.equal((await pedido(e, '154')).cantidad, 35);
  }));

test('CP-88 lenguaje: cambio de fecha con fecha escrita en palabras', () =>
  conLenguaje(async (e, escribir) => {
    const r = await escribir('mueve la entrega del pedido 154 al 20 de noviembre');
    assert.match(r.texto, /Fecha de entrega: .* → 2026-11-20/);
    assert.match((await escribir('sí')).texto, /el cambio fue aplicado/);
    assert.equal((await pedido(e, '154')).fechaEntrega, '2026-11-20');
    assert.equal((await cambios(e))[0].canal, 'telegram');
  }));

test('CP-89 lenguaje: fecha relativa y hora se convierten con el reloj del bot', () =>
  conLenguaje(async (e, escribir) => {
    const r = await escribir('cambia la entrega del 154 para el viernes a las 3 pm');
    assert.match(r.texto, /→ 2026-10-23 15:00/);
    await escribir('sí');
    const p = await pedido(e, '154');
    assert.equal(p.fechaEntrega, '2026-10-23');
    assert.equal(p.horaEntrega, '15:00');
  }));

test('CP-90 lenguaje CA-3: un pedido en producción queda en revisión y no se modifica', () =>
  conLenguaje(async (e, escribir) => {
    await escribir('cambia la cantidad del pedido 155 a 30 personas');
    const r = await escribir('sí');
    assert.match(r.texto, /quedó en revisión/);
    assert.match(r.texto, /no se modifica hasta que el encargado decida/);
    assert.equal((await pedido(e, '155')).cantidad, 20);
  }));

test('CP-91 lenguaje CA-4: un pedido inexistente se informa sin pedir más datos', () =>
  conLenguaje(async (e, escribir) => {
    for (const texto of ['quiero consultar el pedido 999', 'cambia la cantidad del pedido 999 a 10', 'mueve la entrega del #999 al 20 de noviembre']) {
      const r = await escribir(texto);
      assert.match(r.texto, /No encontré el pedido #999/, texto);
      assert.doesNotMatch(r.texto, /\?/);
      assert.equal(r.opciones, undefined);
    }
    // también cuando el número llega en un segundo mensaje
    await escribir('quiero cambiar la fecha');
    assert.match((await escribir('999')).texto, /No encontré el pedido #999/);
    assert.equal(await cambiosNuevos(e), 0);
  }));

test('CP-92 lenguaje: cambiar el diseño o cancelar un pedido se deriva a la pastelería sin registrar nada', () =>
  conLenguaje(async (e, escribir) => {
    assert.match((await escribir('quiero cambiar el diseño de mi torta')).texto, /comunícate directamente con la pastelería/);
    assert.match((await escribir('quiero cancelar el pedido 154')).texto, /no está disponible en este chat/);
    assert.equal(await cambiosNuevos(e), 0);
  }));

test('CP-93 lenguaje: varias peticiones en un mensaje → se pide hacerlas de una en una', () =>
  conLenguaje(async (e, escribir) => {
    const r = await escribir('cambia la cantidad a 40 y la fecha al 20 de noviembre del pedido 154');
    assert.match(r.texto, /una cosa a la vez/);
    assert.equal((await pedido(e, '154')).cantidad, 20);
  }));

test('CP-94 lenguaje: saludo, agradecimiento y mensajes que no se entienden', () =>
  conLenguaje(async (_e, escribir) => {
    assert.match((await escribir('hola')).texto, /Puedes escribirme con tus palabras/);
    assert.match((await escribir('muchas gracias')).texto, /Con gusto/);
    assert.match((await escribir('asdf qwer')).texto, /No logré entender/);
  }));

test('CP-95 lenguaje: «el mismo» reutiliza el último pedido consultado', () =>
  conLenguaje(async (_e, escribir) => {
    await escribir('quiero consultar el pedido 154');
    const pregunta = await escribir('quiero cambiar la fecha');
    assert.match(pregunta.texto, /el mismo de antes \(#154\)/);
    assert.match((await escribir('el mismo')).texto, /El pedido #154 está para el/);
  }));

test('CP-96 lenguaje: respuestas que no sirven se repiten con una pista y no cambian nada', () =>
  conLenguaje(async (e, escribir) => {
    await escribir('quiero cambiar la cantidad del pedido 154');
    assert.match((await escribir('no sé')).texto, /No logré ver la cantidad/);
    assert.match((await escribir('20')).texto, /ya tiene 20 personas/);
    await escribir('quiero cambiar la fecha del pedido 154');
    assert.match((await escribir('cuando pueda')).texto, /No logré entender la fecha/);
    assert.equal(await cambiosNuevos(e), 0);
  }));

test('CP-97 lenguaje: decir que no mientras se piden datos deja la solicitud sin efecto', () =>
  conLenguaje(async (_e, escribir) => {
    await escribir('quiero cambiar la cantidad');
    assert.match((await escribir('no')).texto, /lo dejamos así/);
    assert.match((await escribir('154')).texto, /No logré entender/);
  }));

test('CP-98 lenguaje: una solicitud nueva reemplaza a la confirmación pendiente', () =>
  conLenguaje(async (e, escribir) => {
    await escribir('cambia la cantidad del pedido 154 a 40');
    assert.match((await escribir('mejor consulta el pedido 155')).texto, /Pedido #155/);
    await escribir('sí');
    assert.equal((await pedido(e, '154')).cantidad, 20);
    assert.equal(await cambiosNuevos(e), 0);
  }));

test('CP-99 lenguaje: ante una respuesta ambigua se vuelve a pedir la confirmación', () =>
  conLenguaje(async (e, escribir) => {
    await escribir('cambia la cantidad del pedido 154 a 40');
    const r = await escribir('tal vez');
    assert.match(r.texto, /Responde «sí» para confirmar/);
    assert.deepEqual(r.opciones, OPCIONES_CONFIRMAR);
    assert.equal((await pedido(e, '154')).cantidad, 20);
  }));

test('CP-100 lenguaje: una confirmación que tarda más de 15 minutos vence y no aplica el cambio', () =>
  conLenguaje(async (e, escribir, avanzarMinutos) => {
    await escribir('cambia la cantidad del pedido 154 a 40');
    avanzarMinutos(16);
    assert.match((await escribir('sí')).texto, /confirmación venció/);
    assert.equal((await pedido(e, '154')).cantidad, 20);
  }));

test('CP-101 lenguaje: un comando durante una solicitud la cancela y el chat sigue funcionando', () =>
  conLenguaje(async (_e, escribir) => {
    await escribir('quiero cambiar la cantidad');
    assert.match((await escribir('/consultar 154')).texto, /Pedido #154/);
    assert.match((await escribir('40')).texto, /No logré entender/);
  }));

test('CP-102 lenguaje: cada chat tiene su propia conversación', () =>
  conLenguaje(async (_e, escribir) => {
    await escribir('quiero cambiar la cantidad', 1);
    assert.match((await escribir('154', 2)).texto, /No logré entender/);
    assert.match((await escribir('154', 1)).texto, /El pedido #154 tiene 20 personas/);
  }));

test('CP-103 lenguaje: si el servidor no responde, el bot contesta con un mensaje amable', async () => {
  const caido: ClienteApi = {
    consultarPedido: async () => { throw new Error('ECONNREFUSED'); },
    solicitarCambio: async () => { throw new Error('ECONNREFUSED'); },
    crearPedido: async () => { throw new Error('ECONNREFUSED'); },
    obtenerConfiguracion: async () => { throw new Error('ECONNREFUSED'); }
  };
  const conversaciones = new Conversaciones(caido, () => AHORA_FIJO);
  assert.match((await conversaciones.atender(1, 'quiero consultar el pedido 154')).texto, /No puedo comunicarme con el sistema/);
  assert.match((await conversaciones.atender(1, 'cambia la cantidad del pedido 154 a 40')).texto, /No puedo comunicarme con el sistema/);
});

// ── Con Telegram (grammy) ────────────────────────────────────────────────────
test('CP-104 telegram: la confirmación llega con botones y el resto de respuestas los quita', () =>
  conLenguaje(async e => {
    const info = { id: 1, is_bot: true, first_name: 'PedidosFlow', username: 'PedidosFlowBot' } as unknown as UserFromGetMe;
    const bot = crearBot('123456:TOKEN-FALSO-SOLO-PARA-PRUEBAS', crearClienteApi(e.base), info, { ahora: () => AHORA_FIJO });
    const enviados: any[] = [];
    bot.api.config.use(async (_s, metodo, payload) => {
      enviados.push({ metodo, payload });
      return { ok: true, result: true } as any;
    });
    const escribir = (text: string) =>
      bot.handleUpdate({ update_id: 1, message: { message_id: 1, date: 1_700_000_000, chat: { id: 42, type: 'private', first_name: 'C' }, from: { id: 42, is_bot: false, first_name: 'C' }, text } } as any);

    await escribir('cambia la cantidad del pedido 154 a 40 personas');
    await escribir('Sí, confirmar');
    const [confirmacion, resultado] = enviados.filter(l => l.metodo === 'sendMessage');
    assert.match(JSON.stringify(confirmacion.payload.reply_markup), /Sí, confirmar/);
    assert.match(JSON.stringify(confirmacion.payload.reply_markup), /No, cancelar/);
    assert.match(resultado.payload.text, /el cambio fue aplicado/);
    assert.match(JSON.stringify(resultado.payload.reply_markup), /remove_keyboard/);
    assert.equal((await pedido(e, '154')).cantidad, 40);
  }));
