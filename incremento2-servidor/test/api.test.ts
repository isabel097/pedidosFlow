import test from 'node:test';
import assert from 'node:assert/strict';
import { FOTO_PNG, iniciarEntorno, marcarPasos, pedir } from './ayudas.js';

// Cada prueba usa una carpeta de datos temporal propia: no dependen unas de otras.
async function conEntorno(fn: (e: Awaited<ReturnType<typeof iniciarEntorno>>) => Promise<void>) {
  const e = await iniciarEntorno();
  try {
    await fn(e);
  } finally {
    await e.cerrar();
  }
}

// ── Flujo principal: cambio de cantidad (historia del Incremento 1) ───────────
test('CP-01 cantidad: #154 antes de producción → se aplica y queda en el historial', () =>
  conEntorno(async e => {
    const r = await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Cantidad', valorNuevo: 25 });
    assert.equal(r.estado, 201);
    assert.equal(r.json.evaluacion.resultado, 'aplicado');
    assert.equal(r.json.pedido.cantidad, 25);
    assert.equal(r.json.cambio.detalleAnterior, '20 personas');
    assert.equal(r.json.cambio.detalleNuevo, '25 personas');

    const consulta = await pedir(e, 'GET', '/api/pedidos/154');
    assert.equal(consulta.json.cantidad, 25);
    const historial = await pedir(e, 'GET', '/api/cambios');
    assert.equal(historial.json[0].pedidoId, '154');
    assert.equal(historial.json[0].resultado, 'aplicado');
  }));

test('CP-02 cantidad: acepta la cantidad escrita como texto', () =>
  conEntorno(async e => {
    const r = await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Cantidad', valorNuevo: '30' });
    assert.equal(r.estado, 201);
    assert.equal(r.json.pedido.cantidad, 30);
  }));

test('CP-03 cantidad: #155 en producción → queda pendiente de revisión y NO cambia el pedido', () =>
  conEntorno(async e => {
    const r = await pedir(e, 'POST', '/api/pedidos/155/cambios', { campo: 'Cantidad', valorNuevo: 30 });
    assert.equal(r.estado, 201);
    assert.equal(r.json.evaluacion.resultado, 'pendiente-revision');
    assert.equal(r.json.pedido.cantidad, 20);
    const pendientes = await pedir(e, 'GET', '/api/revisiones-pendientes');
    assert.ok(pendientes.json.some((x: any) => x.pedidoId === '155' && x.campo === 'Cantidad'));
  }));

test('CP-04 cantidad: control final → se rechaza con motivo y el pedido no cambia', () =>
  conEntorno(async e => {
    await marcarPasos(e, '154', 7);
    const r = await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Cantidad', valorNuevo: 30 });
    assert.equal(r.json.evaluacion.resultado, 'rechazado');
    assert.equal(r.json.evaluacion.etapa, 'Control final');
    assert.match(r.json.evaluacion.motivo, /no admite cambios de cantidad/);
    assert.equal(r.json.pedido.cantidad, 20);
  }));

test('CP-05 cantidad: el avance de producción cambia la decisión del mismo pedido', () =>
  conEntorno(async e => {
    const antes = await pedir(e, 'POST', '/api/pedidos/152/cambios', { campo: 'Cantidad', valorNuevo: 14 });
    assert.equal(antes.json.evaluacion.resultado, 'aplicado');
    await marcarPasos(e, '152', 2);
    const despues = await pedir(e, 'POST', '/api/pedidos/152/cambios', { campo: 'Cantidad', valorNuevo: 16 });
    assert.equal(despues.json.evaluacion.resultado, 'pendiente-revision');
  }));

test('CP-06 cantidad: pedido inexistente → 404 y no se registra nada', () =>
  conEntorno(async e => {
    const antes = (await pedir(e, 'GET', '/api/cambios')).json.length;
    const r = await pedir(e, 'POST', '/api/pedidos/999/cambios', { campo: 'Cantidad', valorNuevo: 25 });
    assert.equal(r.estado, 404);
    assert.equal(r.json.error, 'Pedido no encontrado.');
    assert.equal((await pedir(e, 'GET', '/api/cambios')).json.length, antes);
    assert.equal((await pedir(e, 'GET', '/api/pedidos/999')).estado, 404);
  }));

for (const valor of ['abc', '', 0, -3, 2.5, 501, null]) {
  test(`CP-07 cantidad: valor inválido (${JSON.stringify(valor)}) → 400 y no cambia nada`, () =>
    conEntorno(async e => {
      const r = await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Cantidad', valorNuevo: valor });
      assert.equal(r.estado, 400);
      assert.ok(r.json.error);
      assert.equal((await pedir(e, 'GET', '/api/pedidos/154')).json.cantidad, 20);
      assert.equal((await pedir(e, 'GET', '/api/cambios')).json.filter((c: any) => c.pedidoId === '154').length, 0);
    }));
}

test('CP-08 cantidad: pedir la misma cantidad actual → 400', () =>
  conEntorno(async e => {
    const r = await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Cantidad', valorNuevo: 20 });
    assert.equal(r.estado, 400);
    assert.match(r.json.error, /igual a la actual/);
  }));

test('CP-09 campo desconocido → 400', () =>
  conEntorno(async e => {
    const r = await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Color', valorNuevo: 'azul' });
    assert.equal(r.estado, 400);
  }));

test('CP-10 JSON mal formado → 400 con mensaje claro', () =>
  conEntorno(async e => {
    const r = await fetch(e.base + '/api/pedidos/154/cambios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{malo' });
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /JSON/);
  }));

// ── Diseño y fecha ────────────────────────────────────────────────────────────
test('CP-11 diseño de catálogo: antes de producción se aplica', () =>
  conEntorno(async e => {
    const r = await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Diseño', tipo: 'catalogo', estiloId: 'floral' });
    assert.equal(r.json.evaluacion.resultado, 'aplicado');
    assert.equal(r.json.pedido.disenoNombre, 'Floral');
  }));

test('CP-12 diseño: #155 en producción → se rechaza automáticamente y queda para revisión (Flujo 2)', () =>
  conEntorno(async e => {
    const r = await pedir(e, 'POST', '/api/pedidos/155/cambios', { campo: 'Diseño', tipo: 'catalogo', estiloId: 'floral' });
    assert.equal(r.json.evaluacion.resultado, 'rechazado');
    assert.equal(r.json.pedido.disenoNombre, 'Chocolate');
    const pendientes = (await pedir(e, 'GET', '/api/revisiones-pendientes')).json;
    assert.ok(pendientes.some((x: any) => x.id === r.json.cambio.id && x.resultado === 'rechazado'));
    const dash = (await pedir(e, 'GET', '/api/dashboard')).json;
    assert.equal(dash.cambiosPendientes, 1);
  }));

test('CP-13 diseño: estilo inexistente o igual al actual → 400', () =>
  conEntorno(async e => {
    assert.equal((await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Diseño', tipo: 'catalogo', estiloId: 'nada' })).estado, 400);
    assert.equal((await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Diseño', tipo: 'catalogo', estiloId: 'clasica' })).estado, 400);
  }));

test('CP-14 diseño personalizado: va a revisión humana con su foto y el pedido no cambia', () =>
  conEntorno(async e => {
    const r = await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Diseño', tipo: 'personalizado', fotoUrl: FOTO_PNG });
    assert.equal(r.json.evaluacion.resultado, 'pendiente-revision');
    assert.equal(r.json.pedido.disenoNombre, 'Clásica');
    const rev = (await pedir(e, 'GET', '/api/revisiones-pendientes')).json.find((x: any) => x.id === r.json.cambio.id);
    assert.equal(rev.foto, FOTO_PNG);
  }));

test('CP-15 diseño personalizado sin imagen válida → 400', () =>
  conEntorno(async e => {
    assert.equal((await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Diseño', tipo: 'personalizado' })).estado, 400);
    assert.equal((await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Diseño', tipo: 'personalizado', fotoUrl: 'javascript:alert(1)' })).estado, 400);
  }));

test('CP-15b diseño fuera del catálogo con descripción → pendiente hasta aprobación humana', () =>
  conEntorno(async e => {
    const r = await pedir(e, 'POST', '/api/pedidos/154/cambios', {
      campo: 'Diseño', tipo: 'personalizado', descripcionDiseno: 'Dinosaurio azul con estrellas doradas'
    });
    assert.equal(r.estado, 201);
    assert.equal(r.json.evaluacion.resultado, 'pendiente-revision');
    assert.equal(r.json.pedido.disenoNombre, 'Clásica');
    assert.match(r.json.cambio.detalleNuevo, /Dinosaurio azul/);
    const revision = await pedir(e, 'PUT', `/api/revisiones-pendientes/${r.json.cambio.id}/decidir`, { decision: 'aprobar' });
    assert.equal(revision.estado, 200);
    assert.equal(revision.json.pedido.disenoNombre, 'Diseño personalizado: Dinosaurio azul con estrellas doradas');
  }));

test('CP-15c pedido nuevo con diseño fuera del catálogo descrito en texto queda pendiente', () =>
  conEntorno(async e => {
    const r = await pedir(e, 'POST', '/api/pedidos', {
      cliente: 'Cliente de prueba', telefono: '+57 300 555 6677', cantidad: 18,
      fechaEntrega: '2026-11-25', horaEntrega: '13:00', tipo: 'personalizado',
      descripcionDiseno: 'Torta espacial con planetas y estrellas'
    });
    assert.equal(r.estado, 201);
    assert.equal(r.json.estado, 'Pendiente de revisión');
    assert.match(r.json.disenoNombre, /Torta espacial/);
    const pend = await pedir(e, 'GET', '/api/revisiones-pendientes');
    assert.ok(pend.json.some((x: any) => x.pedidoId === r.json.id && /Torta espacial/.test(x.detalleNuevo)));
  }));

test('CP-16 fecha: antes de producción se aplica; en producción va a revisión', () =>
  conEntorno(async e => {
    const ok = await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Fecha de entrega', valorNuevo: '2026-11-20', hora: '10:30' });
    assert.equal(ok.json.evaluacion.resultado, 'aplicado');
    assert.equal(ok.json.pedido.fechaEntrega, '2026-11-20');
    assert.equal(ok.json.pedido.horaEntrega, '10:30');
    const rev = await pedir(e, 'POST', '/api/pedidos/155/cambios', { campo: 'Fecha de entrega', valorNuevo: '2026-11-25' });
    assert.equal(rev.json.evaluacion.resultado, 'pendiente-revision');
    assert.equal(rev.json.pedido.fechaEntrega, '2026-11-09');
  }));

test('CP-17 fecha pasada en un cambio → pendiente de revisión y no altera el pedido', () =>
  conEntorno(async e => {
    const r = await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Fecha de entrega', valorNuevo: '2026-10-01' });
    assert.equal(r.estado, 201);
    assert.equal(r.json.evaluacion.resultado, 'pendiente-revision');
    assert.match(r.json.evaluacion.motivo, /está en el pasado/);
    assert.equal(r.json.pedido.fechaEntrega, '2026-11-07');
  }));

test('CP-17b fecha o hora con formato inválido → 400', () =>
  conEntorno(async e => {
    assert.equal((await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Fecha de entrega', valorNuevo: 'mañana' })).estado, 400);
    assert.equal((await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Fecha de entrega', valorNuevo: '2026-12-01', hora: '99:00' })).estado, 400);
    assert.equal((await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Fecha de entrega', valorNuevo: '2026-02-30' })).estado, 400);
  }));

test('CP-17c fecha con carga llena → pendiente de revisión sin modificar la entrega', () =>
  conEntorno(async e => {
    // La fecha 2026-11-07 ya tiene los pedidos de demostración #154 y #153.
    e.almacen.configuracion.pedidosMaximosPorDia = 2;
    const r = await pedir(e, 'POST', '/api/pedidos/152/cambios', { campo: 'Fecha de entrega', valorNuevo: '2026-11-07', hora: '11:00' });
    assert.equal(r.estado, 201);
    assert.equal(r.json.evaluacion.resultado, 'pendiente-revision');
    assert.match(r.json.evaluacion.motivo, /límite de 2 por día/);
    assert.equal(r.json.pedido.fechaEntrega, '2026-11-08');
  }));

// ── Revisión humana ───────────────────────────────────────────────────────────
test('CP-18 aprobar manualmente un rechazo aplica el cambio y conserva la decisión automática', () =>
  conEntorno(async e => {
    const c = (await pedir(e, 'POST', '/api/pedidos/155/cambios', { campo: 'Diseño', tipo: 'catalogo', estiloId: 'floral' })).json.cambio;
    const r = await pedir(e, 'PUT', `/api/revisiones-pendientes/${c.id}/decidir`, { decision: 'aprobar' });
    assert.equal(r.estado, 200);
    assert.equal(r.json.cambio.resultado, 'rechazado'); // decisión automática intacta
    assert.equal(r.json.cambio.decisionManual, 'aprobado');
    assert.equal(r.json.cambio.responsable, 'Administrador');
    assert.ok(r.json.cambio.fechaDecisionManual);
    assert.equal(r.json.pedido.disenoNombre, 'Floral');
    assert.equal((await pedir(e, 'GET', '/api/revisiones-pendientes')).json.length, 1); // solo queda el #156 inicial
  }));

test('CP-19 mantener el rechazo no cambia el pedido y cierra la revisión', () =>
  conEntorno(async e => {
    const c = (await pedir(e, 'POST', '/api/pedidos/155/cambios', { campo: 'Diseño', tipo: 'catalogo', estiloId: 'floral' })).json.cambio;
    const r = await pedir(e, 'PUT', `/api/revisiones-pendientes/${c.id}/decidir`, { decision: 'mantener-rechazo' });
    assert.equal(r.json.cambio.decisionManual, 'rechazo-mantenido');
    assert.equal(r.json.pedido.disenoNombre, 'Chocolate');
  }));

test('CP-20 aprobar un cambio de cantidad en revisión lo aplica', () =>
  conEntorno(async e => {
    const c = (await pedir(e, 'POST', '/api/pedidos/155/cambios', { campo: 'Cantidad', valorNuevo: 30 })).json.cambio;
    const r = await pedir(e, 'PUT', `/api/revisiones-pendientes/${c.id}/decidir`, { decision: 'aprobar' });
    assert.equal(r.json.pedido.cantidad, 30);
  }));

test('CP-21 una revisión ya resuelta no se puede decidir otra vez (409)', () =>
  conEntorno(async e => {
    const c = (await pedir(e, 'POST', '/api/pedidos/155/cambios', { campo: 'Cantidad', valorNuevo: 30 })).json.cambio;
    await pedir(e, 'PUT', `/api/revisiones-pendientes/${c.id}/decidir`, { decision: 'mantener-rechazo' });
    const otra = await pedir(e, 'PUT', `/api/revisiones-pendientes/${c.id}/decidir`, { decision: 'aprobar' });
    assert.equal(otra.estado, 409);
  }));

test('CP-22 decisión inválida (400) o revisión inexistente (404)', () =>
  conEntorno(async e => {
    const c = (await pedir(e, 'POST', '/api/pedidos/155/cambios', { campo: 'Cantidad', valorNuevo: 30 })).json.cambio;
    assert.equal((await pedir(e, 'PUT', `/api/revisiones-pendientes/${c.id}/decidir`, { decision: 'quizás' })).estado, 400);
    assert.equal((await pedir(e, 'PUT', '/api/revisiones-pendientes/no-existe/decidir', { decision: 'aprobar' })).estado, 404);
  }));

test('CP-23 pedido #156 (diseño personalizado): confirmar viabilidad lo deja confirmado', () =>
  conEntorno(async e => {
    assert.equal((await pedir(e, 'GET', '/api/pedidos/156')).json.estado, 'Pendiente de revisión');
    const rev = (await pedir(e, 'GET', '/api/revisiones-pendientes')).json.find((x: any) => x.pedidoId === '156');
    await pedir(e, 'PUT', `/api/revisiones-pendientes/${rev.id}/decidir`, { decision: 'aprobar' });
    assert.equal((await pedir(e, 'GET', '/api/pedidos/156')).json.estado, 'Confirmado');
  }));

test('CP-24 pedido #156: diseño no viable lo cancela y no admite más cambios', () =>
  conEntorno(async e => {
    const rev = (await pedir(e, 'GET', '/api/revisiones-pendientes')).json.find((x: any) => x.pedidoId === '156');
    await pedir(e, 'PUT', `/api/revisiones-pendientes/${rev.id}/decidir`, { decision: 'mantener-rechazo' });
    assert.equal((await pedir(e, 'GET', '/api/pedidos/156')).json.estado, 'Cancelado');
    assert.equal((await pedir(e, 'POST', '/api/pedidos/156/cambios', { campo: 'Cantidad', valorNuevo: 10 })).estado, 409);
    assert.equal((await marcarPasos(e, '156', 1)).estado, 409);
  }));

// ── Producción ────────────────────────────────────────────────────────────────
test('CP-25 producción: marcar pasos recalcula etapa, avance y estado', () =>
  conEntorno(async e => {
    const r = await marcarPasos(e, '154', 3);
    assert.equal(r.estado, 200);
    assert.equal(r.json.etapa, 'En producción');
    assert.equal(r.json.progreso, 43);
    assert.equal(r.json.estado, 'En producción');
    const fin = await marcarPasos(e, '154', 7);
    assert.equal(fin.json.etapa, 'Control final');
    assert.equal(fin.json.estado, 'Listo para entrega');
  }));

test('CP-26 producción: checklist inválido o fuera de orden → 400', () =>
  conEntorno(async e => {
    assert.equal((await pedir(e, 'PATCH', '/api/pedidos/154/produccion', { checklist: [true] })).estado, 400);
    assert.equal((await pedir(e, 'PATCH', '/api/pedidos/154/produccion', { checklist: 'si' })).estado, 400);
    assert.equal((await pedir(e, 'PATCH', '/api/pedidos/154/produccion', { checklist: [false, true, false, false, false, false, false] })).estado, 400);
    assert.equal((await pedir(e, 'PATCH', '/api/pedidos/999/produccion', { checklist: [] })).estado, 404);
  }));

test('CP-27 producción: lista solo pedidos no cancelados con sus pasos', () =>
  conEntorno(async e => {
    const r = await pedir(e, 'GET', '/api/produccion');
    assert.equal(r.json.length, 5);
    assert.equal(r.json[0].pasos.length, 7);
  }));

// ── Pedido nuevo ──────────────────────────────────────────────────────────────
const NUEVO = { cliente: 'Ana Ruiz', telefono: '+57 300 123 4567', cantidad: 25, fechaEntrega: '2026-11-30', horaEntrega: '15:00', tipo: 'catalogo', estiloId: 'floral' };

test('CP-28 pedido nuevo de catálogo: queda confirmado con el siguiente número', () =>
  conEntorno(async e => {
    const r = await pedir(e, 'POST', '/api/pedidos', NUEVO);
    assert.equal(r.estado, 201);
    assert.equal(r.json.id, '157');
    assert.equal(r.json.estado, 'Confirmado');
    assert.equal(r.json.etapa, 'Antes de producción');
    assert.equal((await pedir(e, 'GET', '/api/pedidos')).json.length, 6);
  }));

test('CP-29 pedido nuevo con diseño personalizado: queda pendiente de revisión', () =>
  conEntorno(async e => {
    const r = await pedir(e, 'POST', '/api/pedidos', { ...NUEVO, tipo: 'personalizado', estiloId: undefined, fotoUrl: FOTO_PNG });
    assert.equal(r.estado, 201);
    assert.equal(r.json.estado, 'Pendiente de revisión');
    assert.equal((await pedir(e, 'GET', '/api/dashboard')).json.revisionesPendientes, 2);
  }));

test('CP-30 pedido nuevo con datos inválidos → 400 y no se crea', () =>
  conEntorno(async e => {
    const malos = [
      { ...NUEVO, cliente: '' },
      { ...NUEVO, telefono: 'abc' },
      { ...NUEVO, cantidad: 0 },
      { ...NUEVO, fechaEntrega: '2020-01-01' },
      { ...NUEVO, horaEntrega: '99:99' },
      { ...NUEVO, estiloId: 'inexistente' },
      { ...NUEVO, tipo: 'personalizado', estiloId: undefined, fotoUrl: 'nada' }
    ];
    for (const m of malos) assert.equal((await pedir(e, 'POST', '/api/pedidos', m)).estado, 400, JSON.stringify(m).slice(0, 80));
    assert.equal((await pedir(e, 'GET', '/api/pedidos')).json.length, 5);
  }));

// ── Dashboard, clientes, notificaciones ───────────────────────────────────────
test('CP-31 dashboard: contadores iniciales coherentes con los pedidos', () =>
  conEntorno(async e => {
    const d = (await pedir(e, 'GET', '/api/dashboard')).json;
    assert.equal(d.pedidosActivos, 5);
    assert.equal(d.cambiosPendientes, 0);
    assert.equal(d.enProduccion, 2);
    assert.equal(d.revisionesPendientes, 1);
    assert.equal(d.ultimaDecision, null);
  }));

test('CP-32 dashboard: la última decisión refleja el cambio aplicado', () =>
  conEntorno(async e => {
    await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Cantidad', valorNuevo: 25 });
    const d = (await pedir(e, 'GET', '/api/dashboard')).json;
    assert.equal(d.ultimaDecision.pedidoId, '154');
  }));

test('CP-33 clientes: agrupa los pedidos por teléfono', () =>
  conEntorno(async e => {
    const c = (await pedir(e, 'GET', '/api/clientes')).json;
    assert.equal(c.length, 4);
    const laura = c.find((x: any) => x.nombre === 'Laura Gómez');
    assert.equal(laura.totalPedidos, 2);
    assert.deepEqual(laura.pedidos.sort(), ['154', '155']);
  }));

test('CP-34 notificaciones: se generan con los cambios y se pueden marcar como leídas', () =>
  conEntorno(async e => {
    await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Cantidad', valorNuevo: 25 });
    let n = (await pedir(e, 'GET', '/api/notificaciones')).json;
    assert.ok(n.items.some((x: any) => x.texto === 'Cambio aprobado automáticamente'));
    assert.ok(n.items.some((x: any) => x.texto === 'Cliente solicitó modificación'));
    const total = n.noLeidas;
    assert.ok(total >= 3);
    const uno = await pedir(e, 'POST', `/api/notificaciones/${n.items[0].id}/leer`);
    assert.equal(uno.json.noLeidas, total - 1);
    assert.equal((await pedir(e, 'POST', '/api/notificaciones/leer-todas')).json.noLeidas, 0);
    assert.equal((await pedir(e, 'POST', '/api/notificaciones/no-existe/leer')).estado, 404);
  }));

// ── Configuración ─────────────────────────────────────────────────────────────
test('CP-35 configuración: cambiar una regla modifica la decisión siguiente sin reiniciar', () =>
  conEntorno(async e => {
    const cfg = (await pedir(e, 'GET', '/api/configuracion')).json;
    cfg.reglas.cantidad['En producción'] = 'auto';
    assert.equal((await pedir(e, 'PUT', '/api/configuracion', cfg)).estado, 200);
    const r = await pedir(e, 'POST', '/api/pedidos/155/cambios', { campo: 'Cantidad', valorNuevo: 30 });
    assert.equal(r.json.evaluacion.resultado, 'aplicado');
    cfg.reglas.cantidad['En producción'] = 'blocked';
    await pedir(e, 'PUT', '/api/configuracion', cfg);
    const r2 = await pedir(e, 'POST', '/api/pedidos/155/cambios', { campo: 'Cantidad', valorNuevo: 35 });
    assert.equal(r2.json.evaluacion.resultado, 'rechazado');
  }));

test('CP-36 configuración inválida → 400 y no se guarda', () =>
  conEntorno(async e => {
    const cfg = (await pedir(e, 'GET', '/api/configuracion')).json;
    const mala = { ...cfg, reglas: { ...cfg.reglas, cantidad: { ...cfg.reglas.cantidad, 'En producción': 'quizás' } } };
    assert.equal((await pedir(e, 'PUT', '/api/configuracion', mala)).estado, 400);
    assert.equal((await pedir(e, 'PUT', '/api/configuracion', { ...cfg, pasosProduccion: ['solo uno'] })).estado, 400);
    assert.equal((await pedir(e, 'PUT', '/api/configuracion', { ...cfg, negocio: { ...cfg.negocio, nombre: '' } })).estado, 400);
    assert.equal((await pedir(e, 'PUT', '/api/configuracion', { ...cfg, pedidosMaximosPorDia: 0 })).estado, 400);
    assert.equal((await pedir(e, 'GET', '/api/configuracion')).json.reglas.cantidad['En producción'], 'review');
  }));

test('CP-37 configuración: agregar una etapa de producción ajusta los checklists', () =>
  conEntorno(async e => {
    const cfg = (await pedir(e, 'GET', '/api/configuracion')).json;
    cfg.pasosProduccion.push('Entrega al cliente');
    assert.equal((await pedir(e, 'PUT', '/api/configuracion', cfg)).estado, 200);
    const p = (await pedir(e, 'GET', '/api/pedidos/155')).json;
    assert.equal(p.totalPasos, 8);
    assert.equal(p.pasosCompletados, 3);
  }));

test('CP-38 configuración: el ajuste heredado de revisión de fotos no evita revisar diseños personalizados', () =>
  conEntorno(async e => {
    const cfg = (await pedir(e, 'GET', '/api/configuracion')).json;
    cfg.bot.revisionFotos = false;
    await pedir(e, 'PUT', '/api/configuracion', cfg);
    const r = await pedir(e, 'POST', '/api/pedidos/154/cambios', { campo: 'Diseño', tipo: 'personalizado', fotoUrl: FOTO_PNG });
    assert.equal(r.json.evaluacion.resultado, 'pendiente-revision');
    assert.equal(r.json.pedido.disenoNombre, 'Clásica');
  }));

test('CP-39 rutas: /api desconocida → 404 JSON; salud responde ok', () =>
  conEntorno(async e => {
    const r = await pedir(e, 'GET', '/api/no-existe');
    assert.equal(r.estado, 404);
    assert.equal(r.json.error, 'Ruta no encontrada.');
    assert.equal((await pedir(e, 'GET', '/api/salud')).json.estado, 'ok');
  }));

// ── Mis pedidos (filtro por teléfono) ─────────────────────────────────────────
test('CP-44 mis pedidos: filtra por teléfono sin importar espacios ni el prefijo', () =>
  conEntorno(async e => {
    const r = await pedir(e, 'GET', '/api/pedidos?telefono=3001112233');
    assert.equal(r.estado, 200);
    assert.deepEqual(r.json.map((p: any) => p.id).sort(), ['154', '155']);
    const otro = await pedir(e, 'GET', '/api/pedidos?telefono=' + encodeURIComponent('+57 301 222 3344'));
    assert.deepEqual(otro.json.map((p: any) => p.id), ['156']);
    assert.equal((await pedir(e, 'GET', '/api/pedidos?telefono=3999999999')).json.length, 0);
  }));

test('CP-45 mis pedidos: teléfono inválido → 400 y no se filtra', () =>
  conEntorno(async e => {
    assert.equal((await pedir(e, 'GET', '/api/pedidos?telefono=12')).estado, 400);
    assert.equal((await pedir(e, 'GET', '/api/pedidos?telefono=abc')).estado, 400);
    assert.equal((await pedir(e, 'GET', '/api/pedidos')).json.length, 5);
  }));
