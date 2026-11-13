import test from 'node:test';
import assert from 'node:assert/strict';
import type { UserFromGetMe } from 'grammy/types';
import { AHORA_FIJO, iniciarEntorno, pedir } from './ayudas.js';
import { crearClienteApi } from '../src/bot/clienteApi.js';
import type { ClienteApi } from '../src/bot/comandos.js';
import { Conversaciones, OPCIONES_CONFIRMAR, type Respuesta } from '../src/bot/conversacion.js';
import {
  elegirDiseno,
  extraerTelefono,
  interpretarHoraPedido,
  interpretarMensaje,
  limpiarNombre,
  quiereCancelar
} from '../src/bot/lenguaje.js';
import { MENSAJE_SOLO_TEXTO, crearBot } from '../src/bot/telegram.js';

const HOY = AHORA_FIJO; // miércoles 21 de octubre de 2026

// ── Intérpretes ──────────────────────────────────────────────────────────────
test('CP-108 pedido: reconoce frases para hacer un pedido nuevo y no las confunde con otras', () => {
  for (const texto of ['quiero hacer un pedido', 'quiero una torta', 'nuevo pedido', 'necesito una torta para el sábado', 'me gustaría pedir una torta', 'quisiera encargar una torta']) {
    assert.equal(interpretarMensaje(texto, HOY).tipo, 'crear', texto);
  }
  for (const texto of ['quiero consultar mi pedido 154', 'quiero cambiar la cantidad del pedido 154', 'cómo va mi pedido', 'cambia el diseño de una torta']) {
    assert.notEqual(interpretarMensaje(texto, HOY).tipo, 'crear', texto);
  }
});

test('CP-109 pedido: nombre, teléfono, hora y diseño se leen de frases normales', () => {
  assert.equal(limpiarNombre('me llamo Ana Pérez'), 'Ana Pérez');
  assert.equal(limpiarNombre('  María   José  '), 'María José');
  assert.equal(limpiarNombre('12345'), null);
  assert.equal(limpiarNombre('a'), null);
  assert.equal(extraerTelefono('mi número es 300 123 4567'), '300 123 4567');
  assert.equal(extraerTelefono('+57 300 111 2233'), '+57 300 111 2233');
  assert.equal(extraerTelefono('3101234567'), '3101234567');
  assert.equal(extraerTelefono('123'), null);
  assert.equal(extraerTelefono('abc'), null);
  assert.equal(interpretarHoraPedido('3 pm'), '15:00');
  assert.equal(interpretarHoraPedido('cualquiera'), '12:00');
  assert.equal(interpretarHoraPedido('me da igual'), '12:00');
  assert.equal(interpretarHoraPedido('tarde'), null);
  const catalogo = [{ id: 'clasica', nombre: 'Clásica' }, { id: 'floral', nombre: 'Floral' }];
  assert.deepEqual(elegirDiseno('Floral', catalogo), { tipo: 'catalogo', id: 'floral', nombre: 'Floral' });
  assert.deepEqual(elegirDiseno('quiero la clasica', catalogo), { tipo: 'catalogo', id: 'clasica', nombre: 'Clásica' });
  assert.deepEqual(elegirDiseno('Diseño personalizado', catalogo), { tipo: 'personalizado' });
  assert.equal(elegirDiseno('no sé cuál', catalogo), null);
  assert.equal(quiereCancelar('mejor cancelar'), true);
  assert.equal(quiereCancelar('sin azúcar, no quiero flores'), false);
});

// ── Flujo completo contra el servidor real ───────────────────────────────────
type Entorno = Awaited<ReturnType<typeof iniciarEntorno>>;
type Escribir = (texto: string, chat?: number) => Promise<Respuesta>;

async function conPedidos(fn: (e: Entorno, escribir: Escribir, avanzarMinutos: (m: number) => void, api: ClienteApi) => Promise<void>, envolver?: (api: ClienteApi) => ClienteApi) {
  const e = await iniciarEntorno();
  try {
    let instante = AHORA_FIJO.getTime();
    const api = envolver ? envolver(crearClienteApi(e.base)) : crearClienteApi(e.base);
    const conversaciones = new Conversaciones(api, () => new Date(instante));
    await fn(e, (texto, chat = 1) => conversaciones.atender(chat, texto), m => { instante += m * 60_000; }, api);
  } finally {
    await e.cerrar();
  }
}

const cantidadPedidos = async (e: Entorno) => ((await pedir(e, 'GET', '/api/pedidos')).json as any[]).length;
const idRegistrado = (r: Respuesta) => /número #(\d+)/.exec(r.texto)?.[1] ?? '';

/** Responde los pasos hasta llegar al resumen de un pedido con diseño del catálogo. */
async function hastaElResumen(escribir: Escribir): Promise<Respuesta> {
  await escribir('quiero hacer un pedido');
  await escribir('me llamo Ana Pérez');
  await escribir('mi número es 300 123 4567');
  await escribir('somos 30');
  await escribir('Floral');
  await escribir('20 de noviembre');
  return escribir('3 pm');
}

test('CP-110 pedido: flujo completo con diseño del catálogo; se registra solo al confirmar y con canal telegram', () =>
  conPedidos(async (e, escribir) => {
    const antes = await cantidadPedidos(e);

    const inicio = await escribir('quiero hacer un pedido');
    assert.match(inicio.texto, /¡Claro!/);
    assert.match(inicio.texto, /¿A nombre de quién va el pedido\?/);
    assert.match((await escribir('me llamo Ana Pérez')).texto, /teléfono de contacto/);
    assert.match((await escribir('mi número es 300 123 4567')).texto, /¿Para cuántas personas es la torta\?/);
    const diseno = await escribir('somos 30');
    assert.match(diseno.texto, /¿Qué diseño quieres\?/);
    assert.ok(diseno.opciones?.includes('Floral') && diseno.opciones.includes('Diseño personalizado'));
    assert.match((await escribir('Floral')).texto, /¿Para qué fecha necesitas la torta\?/);
    assert.match((await escribir('20 de noviembre')).texto, /¿A qué hora quieres recibirla\?/);

    const resumen = await escribir('3 pm');
    assert.match(resumen.texto, /A nombre de: Ana Pérez/);
    assert.match(resumen.texto, /Teléfono: 300 123 4567/);
    assert.match(resumen.texto, /Torta personalizada para 30 personas/);
    assert.match(resumen.texto, /Diseño: Floral/);
    assert.match(resumen.texto, /Entrega: 2026-11-20 a las 15:00/);
    assert.deepEqual(resumen.opciones, OPCIONES_CONFIRMAR);
    assert.equal(await cantidadPedidos(e), antes, 'todavía no se registra nada');

    const listo = await escribir('Sí, confirmar');
    assert.match(listo.texto, /Tu pedido quedó registrado con el número #\d+/);
    assert.doesNotMatch(listo.texto, /encargado lo revisará/);
    const id = idRegistrado(listo);
    const p = (await pedir(e, 'GET', `/api/pedidos/${id}`)).json;
    assert.equal(p.cliente, 'Ana Pérez');
    assert.equal(p.telefono, '300 123 4567');
    assert.equal(p.cantidad, 30);
    assert.equal(p.diseno, 'floral');
    assert.equal(p.disenoTipo, 'catalogo');
    assert.equal(p.fechaEntrega, '2026-11-20');
    assert.equal(p.horaEntrega, '15:00');
    assert.equal(p.canal, 'telegram');
    assert.equal(await cantidadPedidos(e), antes + 1);

    // El pedido nuevo ya se puede consultar desde el mismo chat.
    assert.match((await escribir(`quiero consultar el pedido ${id}`)).texto, new RegExp(`Pedido #${id}`));
  }));

test('CP-111 pedido: con diseño personalizado queda pendiente de revisión del encargado', () =>
  conPedidos(async (e, escribir) => {
    await escribir('quiero una torta');
    await escribir('Luis Díaz');
    await escribir('3101234567');
    await escribir('12 personas');
    const detalle = await escribir('Diseño personalizado');
    assert.match(detalle.texto, /Cuéntame cómo quieres tu diseño personalizado/);
    assert.match((await escribir('Una torta de unicornio con arcoíris')).texto, /¿Para qué fecha necesitas la torta\?/);
    const resumen = await escribir('mañana a las 4 de la tarde');
    assert.match(resumen.texto, /Diseño: Personalizado: «Una torta de unicornio con arcoíris»/);
    assert.match(resumen.texto, /Entrega: 2026-10-22 a las 16:00/);

    const listo = await escribir('sí');
    assert.match(listo.texto, /el encargado lo revisará antes de confirmarlo/);
    const id = idRegistrado(listo);
    const p = (await pedir(e, 'GET', `/api/pedidos/${id}`)).json;
    assert.equal(p.disenoTipo, 'personalizado');
    assert.equal(p.descripcionDiseno, 'Una torta de unicornio con arcoíris');
    const cambio = (await pedir(e, 'GET', '/api/cambios')).json.find((c: any) => c.pedidoId === id);
    assert.equal(cambio.resultado, 'pendiente-revision');
    assert.equal(cambio.canal, 'telegram');
  }));

test('CP-112 pedido: aprovecha los datos que ya vienen en el primer mensaje y solo pregunta lo que falta', () =>
  conPedidos(async (_e, escribir) => {
    const primero = await escribir('quiero una torta para 30 personas el 20 de noviembre a las 3 pm');
    assert.match(primero.texto, /¿A nombre de quién va el pedido\?/);
    await escribir('Ana Pérez');
    assert.match((await escribir('300 123 4567')).texto, /¿Qué diseño quieres\?/); // no vuelve a preguntar la cantidad
    const resumen = await escribir('Clásica');
    assert.match(resumen.texto, /Torta personalizada para 30 personas/);
    assert.match(resumen.texto, /Entrega: 2026-11-20 a las 15:00/);
    assert.deepEqual(resumen.opciones, OPCIONES_CONFIRMAR);
  }));

test('CP-113 pedido: los datos inválidos se vuelven a pedir con una pista y el flujo sigue', () =>
  conPedidos(async (e, escribir) => {
    const antes = await cantidadPedidos(e);
    await escribir('quiero hacer un pedido');
    assert.match((await escribir('12345')).texto, /No logré tomar ese nombre/);
    await escribir('Ana');
    assert.match((await escribir('abc')).texto, /No logré ver un teléfono válido/);
    assert.match((await escribir('123')).texto, /No logré ver un teléfono válido/);
    await escribir('300 123 4567');
    assert.match((await escribir('muchas')).texto, /Escribe solo el número de personas/);
    assert.match((await escribir('0')).texto, /entero positivo/);
    assert.match((await escribir('501')).texto, /cantidad máxima por pedido es 500/);
    await escribir('20');
    assert.match((await escribir('no sé cuál')).texto, /No reconocí ese diseño/);
    await escribir('clásica');
    assert.match((await escribir('cuando pueda')).texto, /No logré entender la fecha/);
    assert.match((await escribir('31 de febrero')).texto, /No logré entender la fecha/);
    assert.match((await escribir('ayer')).texto, /no puede ser anterior a hoy/);
    await escribir('20 de noviembre');
    assert.match((await escribir('tarde')).texto, /No logré entender la hora/);
    const resumen = await escribir('cualquiera');
    assert.match(resumen.texto, /Entrega: 2026-11-20 a las 12:00/);
    assert.equal(await cantidadPedidos(e), antes);
  }));

test('CP-114 pedido: se puede cancelar en cualquier paso, con un comando o con «no» al confirmar, sin registrar nada', () =>
  conPedidos(async (e, escribir) => {
    const antes = await cantidadPedidos(e);

    await escribir('quiero hacer un pedido');
    assert.match((await escribir('cancelar')).texto, /no registré ningún pedido/);

    await escribir('quiero hacer un pedido');
    await escribir('Ana');
    await escribir('300 123 4567');
    assert.match((await escribir('no')).texto, /no registré ningún pedido/);

    await hastaElResumen(escribir);
    assert.match((await escribir('No, cancelar')).texto, /no registré ningún pedido/);
    assert.match((await escribir('sí')).texto, /No logré entender/); // ya no hay nada que confirmar

    await escribir('quiero hacer un pedido');
    await escribir('Ana');
    assert.match((await escribir('/consultar 154')).texto, /Pedido #154/);
    assert.match((await escribir('300 123 4567')).texto, /No logré entender/);

    assert.equal(await cantidadPedidos(e), antes);
  }));

test('CP-126 pedido: una respuesta ambigua al confirmar no registra el pedido y se vuelve a preguntar', () =>
  conPedidos(async (e, escribir) => {
    const antes = await cantidadPedidos(e);
    await hastaElResumen(escribir);
    for (const ambigua of ['tal vez', 'no sé', 'mmm']) {
      const r = await escribir(ambigua);
      assert.match(r.texto, /Responde «sí» para registrar el pedido o «no» para cancelarlo/, ambigua);
      assert.deepEqual(r.opciones, OPCIONES_CONFIRMAR);
    }
    assert.equal(await cantidadPedidos(e), antes);
    assert.match((await escribir('dale')).texto, /Tu pedido quedó registrado/);
    assert.equal(await cantidadPedidos(e), antes + 1);
  }));

test('CP-115 pedido: un «no» dentro de la descripción del diseño no cancela el pedido', () =>
  conPedidos(async (_e, escribir) => {
    await escribir('quiero hacer un pedido');
    await escribir('Ana');
    await escribir('300 123 4567');
    await escribir('20');
    await escribir('Diseño personalizado');
    assert.match((await escribir('sin flores, no quiero azúcar')).texto, /¿Para qué fecha necesitas la torta\?/);
  }));

test('CP-116 pedido: si pasan más de 15 minutos sin responder, el pedido a medias se descarta', () =>
  conPedidos(async (e, escribir, avanzarMinutos) => {
    const antes = await cantidadPedidos(e);
    await escribir('quiero hacer un pedido');
    await escribir('Ana');
    avanzarMinutos(16);
    assert.match((await escribir('300 123 4567')).texto, /Tu pedido anterior quedó sin terminar/);
    assert.equal(await cantidadPedidos(e), antes);
  }));

test('CP-117 pedido: el comando /pedido también inicia el registro', () =>
  conPedidos(async (_e, escribir) => {
    assert.match((await escribir('/pedido')).texto, /¿A nombre de quién va el pedido\?/);
    assert.match((await escribir('/pedido@PedidosFlowBot', 2)).texto, /¿A nombre de quién va el pedido\?/);
  }));

test('CP-118 pedido: después de registrar, «el mismo» reutiliza el número del pedido nuevo', () =>
  conPedidos(async (_e, escribir) => {
    await hastaElResumen(escribir);
    const id = idRegistrado(await escribir('sí'));
    const pregunta = await escribir('quiero cambiar la fecha');
    assert.match(pregunta.texto, new RegExp(`el mismo de antes \\(#${id}\\)`));
    assert.match((await escribir('el mismo')).texto, new RegExp(`El pedido #${id} está para el 2026-11-20 a las 15:00`));
  }));

test('CP-119 pedido: si el servidor rechaza el pedido, se informa el motivo y no queda nada a medias', () =>
  conPedidos(async (e, escribir) => {
    const antes = await cantidadPedidos(e);
    await hastaElResumen(escribir);
    const r = await escribir('sí');
    assert.match(r.texto, /No pude registrar el pedido\. El teléfono no es válido\./);
    assert.equal(await cantidadPedidos(e), antes);
    assert.match((await escribir('sí')).texto, /No logré entender/);
  }, api => ({ ...api, crearPedido: async () => ({ estado: 400, json: { error: 'El teléfono no es válido.' } }) })));

test('CP-120 pedido: si falla la conexión justo al confirmar, se puede repetir «sí» sin volver a empezar', () => {
  let intentos = 0;
  return conPedidos(async (e, escribir) => {
    const antes = await cantidadPedidos(e);
    await hastaElResumen(escribir);
    assert.match((await escribir('sí')).texto, /No puedo comunicarme con el sistema/);
    assert.equal(await cantidadPedidos(e), antes);
    assert.match((await escribir('sí')).texto, /Tu pedido quedó registrado/);
    assert.equal(await cantidadPedidos(e), antes + 1);
  }, api => ({
    ...api,
    crearPedido: async cuerpo => {
      intentos += 1;
      if (intentos === 1) throw new Error('ECONNREFUSED');
      return api.crearPedido(cuerpo);
    }
  }));
});

// ── Con Telegram (grammy): botones y foto de referencia ──────────────────────
const PNG_PEQUENO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

async function conTelegram(fn: (e: Entorno, texto: (t: string) => Promise<void>, foto: (caption?: string) => Promise<void>, enviados: any[]) => Promise<void>, descargarFoto = async () => PNG_PEQUENO) {
  const e = await iniciarEntorno();
  try {
    const info = { id: 1, is_bot: true, first_name: 'PedidosFlow', username: 'PedidosFlowBot' } as unknown as UserFromGetMe;
    const bot = crearBot('123456:TOKEN-FALSO-SOLO-PARA-PRUEBAS', crearClienteApi(e.base), info, { ahora: () => AHORA_FIJO, descargarFoto });
    const enviados: any[] = [];
    bot.api.config.use(async (_s, metodo, payload) => {
      enviados.push({ metodo, payload });
      return { ok: true, result: true } as any;
    });
    const base = { message_id: 1, date: 1_700_000_000, chat: { id: 42, type: 'private', first_name: 'C' }, from: { id: 42, is_bot: false, first_name: 'C' } };
    const texto = (text: string) => bot.handleUpdate({ update_id: 1, message: { ...base, text } } as any);
    const foto = (caption?: string) =>
      bot.handleUpdate({ update_id: 2, message: { ...base, photo: [{ file_id: 'f1', file_unique_id: 'u1', width: 10, height: 10, file_size: 100 }], ...(caption ? { caption } : {}) } } as any);
    await fn(e, texto, foto, enviados);
  } finally {
    await e.cerrar();
  }
}

const mensajes = (enviados: any[]) => enviados.filter(l => l.metodo === 'sendMessage').map(l => l.payload);

test('CP-121 telegram: las opciones de diseño llegan como botones en filas de dos', () =>
  conTelegram(async (_e, texto, _foto, enviados) => {
    for (const t of ['quiero hacer un pedido', 'Ana', '300 123 4567', '20']) await texto(t);
    const teclado = JSON.parse(JSON.stringify(mensajes(enviados).at(-1).reply_markup));
    assert.equal(teclado.one_time_keyboard, true);
    const etiquetas = teclado.keyboard.flat().map((b: any) => b.text ?? b);
    assert.deepEqual(etiquetas, ['Clásica', 'Chocolate', 'Floral', 'Minimalista', 'Elegante', 'Diseño personalizado']);
    assert.ok(teclado.keyboard.every((fila: unknown[]) => fila.length <= 2));
  }));

test('CP-122 telegram: la foto de referencia se adjunta al diseño personalizado y su pie de foto sirve de descripción', () =>
  conTelegram(async (e, texto, foto, enviados) => {
    for (const t of ['quiero hacer un pedido', 'Ana Pérez', '300 123 4567', '20', 'Diseño personalizado']) await texto(t);
    await foto('Como esta torta, pero en rosado');
    await texto('20 de noviembre');
    await texto('3 pm');
    const resumen = mensajes(enviados).at(-1).text as string;
    assert.match(resumen, /Personalizado: «Como esta torta, pero en rosado» \(con foto de referencia\)/);
    await texto('sí');
    const id = /número #(\d+)/.exec(mensajes(enviados).at(-1).text)![1];
    const p = (await pedir(e, 'GET', `/api/pedidos/${id}`)).json;
    assert.equal(p.tieneFoto, true);
    assert.equal(p.descripcionDiseno, 'Como esta torta, pero en rosado');
    assert.equal(p.canal, 'telegram');
  }));

test('CP-123 telegram: una foto sin pie de foto también sirve, y fuera del paso del diseño no se usa', () =>
  conTelegram(async (e, texto, foto, enviados) => {
    await texto('quiero hacer un pedido');
    await foto(); // todavía se pide el nombre
    assert.match(mensajes(enviados).at(-1).text, /ahora necesito otro dato\.\n¿A nombre de quién va el pedido\?/);
    for (const t of ['Ana Pérez', '300 123 4567', '20', 'Diseño personalizado']) await texto(t);
    await foto();
    assert.match(mensajes(enviados).at(-1).text, /¿Para qué fecha necesitas la torta\?/);
    await texto('20 de noviembre');
    await texto('3 pm');
    assert.match(mensajes(enviados).at(-1).text, /Diseño: Personalizado \(con foto de referencia\)/);
    await texto('sí');
    const id = /número #(\d+)/.exec(mensajes(enviados).at(-1).text)![1];
    assert.equal((await pedir(e, 'GET', `/api/pedidos/${id}`)).json.tieneFoto, true);
  }));

test('CP-124 telegram: si no se puede descargar la foto, se avisa y se puede describir el diseño con palabras', () =>
  conTelegram(async (_e, texto, foto, enviados) => {
    for (const t of ['quiero hacer un pedido', 'Ana Pérez', '300 123 4567', '20', 'Diseño personalizado']) await texto(t);
    await foto();
    assert.match(mensajes(enviados).at(-1).text, /No pude descargar la foto/);
    await texto('Una torta de mariposas');
    assert.match(mensajes(enviados).at(-1).text, /¿Para qué fecha necesitas la torta\?/);
  }, async () => { throw new Error('sin red'); }));

test('CP-125 telegram: una foto sin pedido en curso recibe el aviso de que solo se entiende texto', () =>
  conTelegram(async (_e, _texto, foto, enviados) => {
    await foto();
    assert.equal(mensajes(enviados).at(-1).text, MENSAJE_SOLO_TEXTO);
  }));
