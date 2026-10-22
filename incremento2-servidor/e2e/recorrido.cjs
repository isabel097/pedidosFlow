// Recorrido de punta a punta con Playwright (opcional). Uso: ver docs/PRUEBAS.md.
// Requiere un servidor recién iniciado con datos de demostración: PEDIDOSFLOW_DATOS=/tmp/pf-e2e npm start
const { chromium } = require('playwright');
const resultados = [];
const ok = (nombre, cond, detalle = '') => { resultados.push([cond ? 'OK ' : 'FALLA', nombre, detalle]); };
(async () => {
  const b = await chromium.launch();
  let p;
  try {
  p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_NAME_NOT_RESOLVED') && !m.text().includes('Failed to load resource')) errores.push(m.text()); });
  const URL = process.env.URL || 'http://127.0.0.1:3001/';
  const chat = () => p.locator('#chatMensajes');
  const opcion = t => p.locator('[data-op]', { hasText: t }).first();
  const escribir = async (sel, v) => { await p.fill(sel, v); await p.keyboard.press('Enter'); await p.waitForTimeout(250); };
  await p.goto(URL); await p.waitForTimeout(500);
  await p.locator('header button', { hasText: 'WhatsApp' }).click(); await p.waitForTimeout(300);

  // E2E-1: Flujo 1 – cambio de cantidad aprobado automáticamente (#154)
  await opcion('Modificar pedido').click(); await p.waitForTimeout(200);
  await escribir('#chatTexto', '999');
  ok('E2E-1a pedido inexistente se informa de inmediato', (await chat().innerText()).includes('No encontramos el pedido #999'));
  ok('E2E-1b sigue pidiendo el número (permite corregir)', await p.locator('#chatTexto').count() === 1);
  await escribir('#chatTexto', '#154'); await p.waitForTimeout(300);
  ok('E2E-1c pedido encontrado muestra sus datos', (await chat().innerText()).includes('Cantidad actual: 20 personas'));
  await opcion('Cambiar cantidad').click(); await p.waitForTimeout(200);
  await escribir('#chatTexto', 'abc');
  ok('E2E-1d cantidad no numérica se rechaza con mensaje', (await chat().innerText()).includes('La cantidad debe ser un número.'));
  await escribir('#chatTexto', '25'); await p.waitForTimeout(500);
  const t1 = await chat().innerText();
  ok('E2E-1e cambio aprobado automáticamente 20 → 25', t1.includes('Cambio aprobado automáticamente') && t1.includes('20 personas → 25 personas'));
  await p.screenshot({ path: 'e2e/capturas/e_01_cantidad_ok.png' });
  await p.locator('[data-nav]', { hasText: 'Ver pedido actualizado' }).click(); await p.waitForTimeout(600);
  const detalle = await p.locator('#contenido').innerText();
  ok('E2E-1f detalle muestra 25 personas y Motor de Validación', detalle.includes('25 personas') && detalle.includes('Motor de Validación') && detalle.includes('CAMBIO VIABLE'));
  ok('E2E-1g historial de versiones con Versión 2', detalle.includes('Versión 2'));
  await p.screenshot({ path: 'e2e/capturas/e_02_detalle_154.png' });

  // E2E-2: Flujo 2 – diseño rechazado en producción (#155) y revisión humana
  await p.locator('header button', { hasText: 'WhatsApp' }).click(); await p.waitForTimeout(300);
  if (await p.locator('[data-op="menu"]').count()) await p.locator('[data-op="menu"]').first().click(); await p.waitForTimeout(200);
  await opcion('Modificar pedido').click(); await p.waitForTimeout(200);
  await escribir('#chatTexto', '155'); await p.waitForTimeout(300);
  await opcion('Cambiar diseño').click(); await p.waitForTimeout(200);
  await opcion('Floral').click(); await p.waitForTimeout(500);
  const t2 = await chat().innerText();
  ok('E2E-2a cambio de diseño rechazado en producción', t2.includes('No es posible realizar este cambio') && t2.includes('no admite cambios de diseño'));
  await p.screenshot({ path: 'e2e/capturas/e_03_diseno_rechazado.png' });
  await p.locator('[data-nav]', { hasText: 'Ver alerta de revisión' }).click(); await p.waitForTimeout(600);
  const cp = await p.locator('#contenido').innerText();
  ok('E2E-2b aparece la alerta "Cambio requiere revisión – Pedido #155"', cp.includes('Cambio requiere revisión – Pedido #155') && cp.includes('RECHAZADO'));
  await p.screenshot({ path: 'e2e/capturas/e_04_cambios_pendientes.png' });
  await p.locator('[data-accion="revisar"]').first().click(); await p.waitForTimeout(400);
  ok('E2E-2c "Revisar solicitud" abre el panel de revisión manual', (await p.locator('#contenido').innerText()).includes('Revisión manual – Pedido #155'));
  await p.locator('[data-decision="aprobar"]', { hasText: 'Aprobar manualmente' }).first().click(); await p.waitForTimeout(600);
  const inicio = await p.locator('#contenido').innerText();
  ok('E2E-2d decisión manual registrada (Decisiones recientes)', inicio.includes('Cambio aprobado manualmente – Pedido #155'));
  await p.locator('aside button', { hasText: 'Historial' }).click(); await p.waitForTimeout(500);
  const h = await p.locator('#contenido').innerText();
  ok('E2E-2e historial muestra decisión automática y manual con responsable', h.includes('Decisión automática: rechazado') && h.includes('Decisión manual: aprobado') && h.includes('Responsable: Administrador'));
  await p.screenshot({ path: 'e2e/capturas/e_05_historial.png' });

  // E2E-3: pedido nuevo desde el chat
  await p.locator('header button', { hasText: 'WhatsApp' }).click(); await p.waitForTimeout(300);
  if (await p.locator('[data-op="menu"]').count()) await p.locator('[data-op="menu"]').first().click(); await p.waitForTimeout(200);
  await opcion('Nuevo pedido').click(); await p.waitForTimeout(200);
  await escribir('#chatTexto', 'Ana Ruiz');
  await escribir('#chatTexto', '+57 300 123 4567');
  await opcion('25').click(); await p.waitForTimeout(200);
  await opcion('Floral').click(); await p.waitForTimeout(200);
  const f = new Date(); f.setDate(f.getDate() + 20);
  const iso = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
  await p.fill('#chatFecha', iso); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
  await opcion('15:00').click(); await p.waitForTimeout(250);
  ok('E2E-3a resumen del pedido antes de confirmar', (await chat().innerText()).includes('¿Deseas confirmar?'));
  await opcion('Confirmar pedido').click(); await p.waitForTimeout(600);
  ok('E2E-3b pedido confirmado con el siguiente número', (await chat().innerText()).includes('Pedido #157 confirmado'));
  await p.screenshot({ path: 'e2e/capturas/e_06_pedido_nuevo.png' });
  await p.locator('[data-nav]', { hasText: 'Ver pedido en la plataforma' }).click(); await p.waitForTimeout(500);
  ok('E2E-3c el pedido aparece en la plataforma', (await p.locator('#contenido').innerText()).includes('Pedido #157'));

  // E2E-4: producción y reglas
  await p.locator('aside button', { hasText: 'Producción' }).click(); await p.waitForTimeout(500);
  await p.locator('input[data-accion="paso"][data-id="152"][data-indice="0"]').check(); await p.waitForTimeout(500);
  const prod = await p.locator('#contenido').innerText();
  ok('E2E-4a marcar un paso actualiza el avance (#152 1/7 · 14%)', prod.includes('1/7 etapas') && prod.includes('14%'));
  await p.locator('aside button', { hasText: 'Pedidos' }).first().click(); await p.waitForTimeout(400);
  ok('E2E-4b #152 pasa a En producción', (await p.locator('tr[data-id="152"]').innerText()).includes('En producción'));

  // E2E-5: configuración
  await p.locator('aside button', { hasText: 'Configuración' }).click(); await p.waitForTimeout(500);
  await p.locator('[data-regla="cantidad|En producción"]').selectOption('auto');
  await p.locator('[data-accion="guardar-config"]').click(); await p.waitForTimeout(500);
  ok('E2E-5a guardar configuración confirma el cambio', (await p.locator('#cfgMensaje').innerText()).includes('Cambios guardados'));
  await p.screenshot({ path: 'e2e/capturas/e_07_config.png' });
  await p.locator('header button', { hasText: 'WhatsApp' }).click(); await p.waitForTimeout(300);
  if (await p.locator('[data-op="menu"]').count()) await p.locator('[data-op="menu"]').first().click(); await p.waitForTimeout(200);
  await opcion('Modificar pedido').click(); await p.waitForTimeout(200);
  await escribir('#chatTexto', '153'); await p.waitForTimeout(300);
  await opcion('Cambiar cantidad').click(); await p.waitForTimeout(200);
  await escribir('#chatTexto', '30'); await p.waitForTimeout(500);
  ok('E2E-5b con la regla en Automático, #153 (en producción) se aprueba sin revisión', (await chat().innerText()).includes('Cambio aprobado automáticamente'));

  // E2E-6: notificaciones y mis pedidos
  if (await p.locator('[data-op="menu"]').count()) await p.locator('[data-op="menu"]').first().click(); await p.waitForTimeout(200);
  await opcion('Mis pedidos').click(); await p.waitForTimeout(200);
  await escribir('#chatTexto', '3001112233'); await p.waitForTimeout(400);
  ok('E2E-6a "Mis pedidos" lista los pedidos del teléfono', (await chat().innerText()).includes('Encontré 2 pedidos'));
  await p.locator('header button', { hasText: 'Plataforma' }).click(); await p.waitForTimeout(500);
  await p.locator('[data-accion="campana"]').click(); await p.waitForTimeout(400);
  const np = await p.locator('#panelNotif').innerText();
  ok('E2E-6b panel de notificaciones con eventos reales', np.includes('Cambio aprobado automáticamente') && np.includes('Cliente solicitó modificación'));
  await p.screenshot({ path: 'e2e/capturas/e_08_notificaciones.png' });
  await p.locator('[data-accion="leer-todas"]').click(); await p.waitForTimeout(400);
  ok('E2E-6c marcar todas como leídas deja el contador en 0', (await p.locator('#contadorNotif').innerHTML()).trim() === '');

  // E2E-8: chat más natural, sin depender únicamente de las opciones predeterminadas.
  await p.locator('header button', { hasText: 'WhatsApp' }).click(); await p.waitForTimeout(300);
  await escribir('#chatLibre', 'quiero cambiar la fecha del pedido #154'); await p.waitForTimeout(400);
  ok('E2E-8a reconoce una solicitud escrita con palabras propias', (await chat().innerText()).includes('¿Para qué nueva fecha de entrega?') && (await chat().innerText()).includes('#154'));
  ok('E2E-8b el flujo natural ofrece selector de fecha', await p.locator('#chatFecha').count() === 1);
  await p.locator('[data-op="menu"]').first().click(); await p.waitForTimeout(250);
  await escribir('#chatLibre', 'quiero consultar el pedido #154'); await p.waitForTimeout(400);
  ok('E2E-8c consulta directamente el pedido desde lenguaje natural', (await chat().innerText()).includes('Pedido encontrado') && (await chat().innerText()).includes('Laura Gómez'));
  await p.reload(); await p.waitForTimeout(500);
  await p.locator('header button', { hasText: 'WhatsApp' }).click(); await p.waitForTimeout(300);
  ok('E2E-8d conserva el historial de chat al recargar la pestaña', (await chat().innerText()).includes('quiero consultar el pedido #154'));

  // E2E-8e: una negación no debe confirmar ni crear el pedido.
  await escribir('#chatLibre', 'hacer un pedido nuevo');
  await escribir('#chatTexto', 'Prueba Cancelacion');
  await escribir('#chatTexto', '+57 300 888 7766');
  await escribir('#chatLibre', '25 personas');
  await escribir('#chatLibre', 'Floral');
  await escribir('#chatLibre', 'viernes');
  await escribir('#chatLibre', '3:30 pm');
  await escribir('#chatLibre', 'no quiero confirmar');
  const tNeg = await chat().innerText();
  ok('E2E-8e una respuesta negativa no crea un pedido', tNeg.includes('No he registrado el pedido') && !tNeg.includes('Pedido #158 confirmado'));
  if (await p.locator('[data-op="menu"]').count()) await p.locator('[data-op="menu"]').first().click(); await p.waitForTimeout(250);

  // E2E-8f: la frase completa debe cambiar el dato real, no solo responder en el chat.
  await escribir('#chatLibre', 'cambia la cantidad del pedido #154 a 30 personas'); await p.waitForTimeout(450);
  const naturalCantidad = await chat().innerText();
  const pedidoNatural = await p.evaluate(async () => (await fetch('/api/pedidos/154')).json());
  ok('E2E-8f frase libre actualiza y vuelve a consultar la cantidad persistida', naturalCantidad.includes('Cambio aprobado automáticamente y guardado') && naturalCantidad.includes('Cantidad actual: 30 personas') && pedidoNatural.cantidad === 30);

  // E2E-8g: una fecha pasada debe entrar a revisión y conservar la fecha anterior.
  await escribir('#chatLibre', 'cambia la fecha del pedido #154 a ayer'); await p.waitForTimeout(450);
  const naturalFecha = await chat().innerText();
  const pedidoFechaPendiente = await p.evaluate(async () => (await fetch('/api/pedidos/154')).json());
  const colaFecha = await p.evaluate(async () => (await fetch('/api/revisiones-pendientes')).json());
  ok('E2E-8g fecha pasada queda pendiente sin alterar la fecha guardada', naturalFecha.includes('enviada a revisión') && pedidoFechaPendiente.fechaEntrega === '2026-11-07' && colaFecha.some(c => c.pedidoId === '154' && c.campo === 'Fecha de entrega'));

  // E2E-8h: un diseño descrito fuera del catálogo debe esperar al encargado.
  await escribir('#chatLibre', 'cambia el diseño del pedido #154 a un dinosaurio morado con estrellas'); await p.waitForTimeout(450);
  const naturalDiseno = await chat().innerText();
  const pedidoDisenoPendiente = await p.evaluate(async () => (await fetch('/api/pedidos/154')).json());
  const colaDiseno = await p.evaluate(async () => (await fetch('/api/revisiones-pendientes')).json());
  ok('E2E-8h diseño libre pasa a pendientes y no cambia antes de aprobar', naturalDiseno.includes('enviada a revisión') && pedidoDisenoPendiente.disenoNombre === 'Clásica' && colaDiseno.some(c => c.pedidoId === '154' && c.campo === 'Diseño'));


  ok('E2E-9 sin errores de JavaScript en toda la sesión', errores.length === 0, JSON.stringify(errores));
  for (const [e, n, d] of resultados) console.log(e, n, d);
  console.log(`TOTAL: ${resultados.filter(r => r[0] === 'OK ').length}/${resultados.length}`);
  } catch (e) {
    console.log('EXCEPCION:', e.message.split('\n')[0]);
    try { console.log('CHAT:', await p.locator('#chatMensajes').innerText()); } catch {}
    await p.screenshot({ path: 'e2e/capturas/e_error.png' });
    for (const [e2, n, d] of resultados) console.log(e2, n, d);
  }
  await b.close();
})();
