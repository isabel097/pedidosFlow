import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { iniciarEntorno, marcarPasos, pedir } from './ayudas.js';

test('CP-40 persistencia: los cambios sobreviven a un reinicio del servidor', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pedidosflow-persist-'));
  const e1 = await iniciarEntorno(dir);
  await pedir(e1, 'POST', '/api/pedidos/154/cambios', { campo: 'Cantidad', valorNuevo: 25 });
  await marcarPasos(e1, '152', 2);
  await e1.cerrar();

  const e2 = await iniciarEntorno(dir); // «reinicio»: nuevo almacén leyendo los mismos archivos
  assert.equal((await pedir(e2, 'GET', '/api/pedidos/154')).json.cantidad, 25);
  assert.equal((await pedir(e2, 'GET', '/api/pedidos/152')).json.etapa, 'En producción');
  const historial = (await pedir(e2, 'GET', '/api/cambios')).json;
  assert.equal(historial[0].pedidoId, '154');
  assert.equal(historial[0].detalleNuevo, '25 personas');
  await e2.cerrar();
});

test('CP-41 persistencia: la primera ejecución crea los archivos con los datos de demostración', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pedidosflow-inicial-'));
  const e = await iniciarEntorno(dir);
  for (const f of ['pedidos.json', 'cambios.json', 'notificaciones.json', 'configuracion.json']) {
    assert.ok(fs.existsSync(path.join(dir, f)), `falta ${f}`);
  }
  const pedidos = JSON.parse(fs.readFileSync(path.join(dir, 'pedidos.json'), 'utf8'));
  assert.equal(pedidos.length, 5);
  await e.cerrar();
});

test('CP-42 persistencia: un archivo dañado no tumba el programa y se conserva una copia', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pedidosflow-danado-'));
  fs.writeFileSync(path.join(dir, 'pedidos.json'), '{ esto no es json', 'utf8');
  const e = await iniciarEntorno(dir);
  assert.equal((await pedir(e, 'GET', '/api/pedidos')).json.length, 5);
  assert.ok(fs.readdirSync(dir).some(f => f.startsWith('pedidos.json.dañado-')));
  await e.cerrar();
});

test('CP-43 persistencia: una configuración antigua sin la regla de fecha se completa sola', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pedidosflow-migra-'));
  fs.writeFileSync(
    path.join(dir, 'configuracion.json'),
    JSON.stringify({ reglas: { cantidad: { 'Antes de producción': 'auto', 'En producción': 'blocked', 'Control final': 'blocked' }, diseno: {} } }),
    'utf8'
  );
  const e = await iniciarEntorno(dir);
  const cfg = (await pedir(e, 'GET', '/api/configuracion')).json;
  assert.equal(cfg.reglas.cantidad['En producción'], 'blocked'); // se respeta lo guardado
  assert.equal(cfg.reglas.fecha['En producción'], 'review'); // se completa lo que faltaba
  assert.ok(cfg.pasosProduccion.length >= 2);
  await e.cerrar();
});


test('CP-46 inicio sin datos demo: registra clientes reales en una carpeta nueva', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pedidosflow-sin-demo-'));
  const e = await iniciarEntorno(dir, { usarDatosDemo: false });
  assert.equal((await pedir(e, 'GET', '/api/pedidos')).json.length, 0);
  const r = await pedir(e, 'POST', '/api/pedidos', {
    cliente: 'Cliente Real', telefono: '+57 300 555 0101', cantidad: 18,
    fechaEntrega: '2026-11-30', horaEntrega: '14:00', tipo: 'catalogo', estiloId: 'floral'
  });
  assert.equal(r.estado, 201);
  assert.equal(r.json.id, '1');
  assert.equal(r.json.cliente, 'Cliente Real');
  await e.cerrar();
  const e2 = await iniciarEntorno(dir, { usarDatosDemo: false });
  const lista = (await pedir(e2, 'GET', '/api/pedidos')).json;
  assert.equal(lista.length, 1);
  assert.equal(lista[0].cliente, 'Cliente Real');
  await e2.cerrar();
});


test('CP-47 modo demo: si el archivo de pedidos está vacío repone cinco ejemplos y no los duplica en reinicios', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pedidosflow-reponer-demo-'));
  // Simula una carpeta que quedó de la versión anterior, donde se había guardado una lista vacía.
  for (const [f, v] of Object.entries({
    'pedidos.json': [],
    'cambios.json': [],
    'notificaciones.json': []
  })) {
    fs.writeFileSync(path.join(dir, f), JSON.stringify(v), 'utf8');
  }

  const e1 = await iniciarEntorno(dir); // modo demo predeterminado
  const primera = (await pedir(e1, 'GET', '/api/pedidos')).json;
  assert.equal(primera.length, 5);
  assert.deepEqual(new Set(primera.map((p: { id: string }) => p.id)), new Set(['152', '153', '154', '155', '156']));
  await pedir(e1, 'POST', '/api/pedidos/154/cambios', { campo: 'Cantidad', valorNuevo: 25 });
  await e1.cerrar();

  const e2 = await iniciarEntorno(dir);
  const segunda = (await pedir(e2, 'GET', '/api/pedidos')).json;
  assert.equal(segunda.length, 5, 'los pedidos no se duplican al reiniciar');
  const pedido154 = segunda.find((p: { id: string }) => p.id === '154');
  assert.ok(pedido154, 'el pedido #154 sigue presente');
  assert.equal(pedido154.cantidad, 25, 'el cambio guardado no se revierte');
  await e2.cerrar();
});
