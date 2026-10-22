import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decisionPara,
  derivarEtapaDesdeChecklist,
  detalleDiseno,
  estadoPedido,
  evaluarCambio,
  porcentajeProduccion,
  validarFormatoCantidad,
  validarFormatoFecha,
  validarFormatoHora
} from '../src/reglas.js';
import { crearConfiguracionInicial, crearPedidosIniciales } from '../src/datosIniciales.js';

const SIETE = (n: number) => Array.from({ length: 7 }, (_, i) => i < n);

// ── Etapa derivada del checklist ──────────────────────────────────────────────
test('etapa: sin pasos marcados es "Antes de producción"', () => {
  assert.equal(derivarEtapaDesdeChecklist(SIETE(0)), 'Antes de producción');
});
test('etapa: un paso marcado ya es "En producción"', () => {
  assert.equal(derivarEtapaDesdeChecklist(SIETE(1)), 'En producción');
});
test('etapa: tres pasos marcados es "En producción"', () => {
  assert.equal(derivarEtapaDesdeChecklist(SIETE(3)), 'En producción');
});
test('etapa: seis pasos marcados sigue en "En producción"', () => {
  assert.equal(derivarEtapaDesdeChecklist(SIETE(6)), 'En producción');
});
test('etapa: último paso marcado es "Control final"', () => {
  assert.equal(derivarEtapaDesdeChecklist(SIETE(7)), 'Control final');
});
test('etapa: checklist vacío se trata como "Antes de producción"', () => {
  assert.equal(derivarEtapaDesdeChecklist([]), 'Antes de producción');
});

test('porcentaje de producción', () => {
  assert.equal(porcentajeProduccion(SIETE(0)), 0);
  assert.equal(porcentajeProduccion(SIETE(3)), 43);
  assert.equal(porcentajeProduccion(SIETE(7)), 100);
  assert.equal(porcentajeProduccion([]), 0);
});

// ── Validación de formato ─────────────────────────────────────────────────────
test('cantidad: acepta enteros positivos (número o texto)', () => {
  assert.deepEqual(validarFormatoCantidad(25), { valido: true, valor: 25 });
  assert.deepEqual(validarFormatoCantidad('25'), { valido: true, valor: 25 });
  assert.deepEqual(validarFormatoCantidad(' 30 '), { valido: true, valor: 30 });
});
test('cantidad: rechaza texto no numérico', () => {
  const r = validarFormatoCantidad('abc');
  assert.equal(r.valido, false);
  if (!r.valido) assert.equal(r.motivo, 'La cantidad debe ser un número.');
});
test('cantidad: rechaza vacío, nulo e indefinido', () => {
  for (const v of ['', '   ', null, undefined]) assert.equal(validarFormatoCantidad(v).valido, false);
});
test('cantidad: rechaza cero y negativos', () => {
  for (const v of [0, -5, '-1']) {
    const r = validarFormatoCantidad(v);
    assert.equal(r.valido, false);
    if (!r.valido) assert.equal(r.motivo, 'La cantidad debe ser un número entero positivo.');
  }
});
test('cantidad: rechaza decimales', () => {
  assert.equal(validarFormatoCantidad(2.5).valido, false);
  assert.equal(validarFormatoCantidad('2.5').valido, false);
});
test('cantidad: rechaza más de 500', () => {
  assert.equal(validarFormatoCantidad(500).valido, true);
  assert.equal(validarFormatoCantidad(501).valido, false);
});

test('fecha: acepta una fecha futura válida', () => {
  assert.deepEqual(validarFormatoFecha('2026-12-24', '2026-10-21'), { valido: true, valor: '2026-12-24' });
});
test('fecha: acepta el mismo día', () => {
  assert.equal(validarFormatoFecha('2026-10-21', '2026-10-21').valido, true);
});
test('fecha: rechaza fechas pasadas', () => {
  assert.equal(validarFormatoFecha('2026-10-20', '2026-10-21').valido, false);
});
test('fecha: rechaza formato incorrecto', () => {
  assert.equal(validarFormatoFecha('24/12/2026', '2026-10-21').valido, false);
  assert.equal(validarFormatoFecha('', '2026-10-21').valido, false);
});
test('fecha: rechaza fechas que no existen', () => {
  assert.equal(validarFormatoFecha('2026-02-30', '2026-01-01').valido, false);
  assert.equal(validarFormatoFecha('2026-13-01', '2026-01-01').valido, false);
});
test('hora: valida el formato HH:MM', () => {
  assert.equal(validarFormatoHora('16:00').valido, true);
  assert.equal(validarFormatoHora('24:00').valido, false);
  assert.equal(validarFormatoHora('9:5').valido, false);
  assert.equal(validarFormatoHora('12:60').valido, false);
});

// ── Motor de reglas ───────────────────────────────────────────────────────────
const reglas = crearConfiguracionInicial().reglas;

test('reglas por defecto: cantidad auto / revisión / bloqueado', () => {
  assert.equal(decisionPara('Cantidad', 'Antes de producción', reglas), 'auto');
  assert.equal(decisionPara('Cantidad', 'En producción', reglas), 'review');
  assert.equal(decisionPara('Cantidad', 'Control final', reglas), 'blocked');
});
test('reglas por defecto: diseño solo se acepta antes de producción', () => {
  assert.equal(decisionPara('Diseño', 'Antes de producción', reglas), 'auto');
  assert.equal(decisionPara('Diseño', 'En producción', reglas), 'blocked');
  assert.equal(decisionPara('Diseño', 'Control final', reglas), 'blocked');
});
test('reglas por defecto: fecha auto / revisión / bloqueado', () => {
  assert.equal(decisionPara('Fecha de entrega', 'Antes de producción', reglas), 'auto');
  assert.equal(decisionPara('Fecha de entrega', 'En producción', reglas), 'review');
  assert.equal(decisionPara('Fecha de entrega', 'Control final', reglas), 'blocked');
});

test('evaluar: auto → aplicado', () => {
  const r = evaluarCambio('Cantidad', 'Antes de producción', 'auto');
  assert.equal(r.resultado, 'aplicado');
  assert.match(r.motivo, /Aprobado automáticamente/);
});
test('evaluar: review → pendiente de revisión', () => {
  const r = evaluarCambio('Cantidad', 'En producción', 'review');
  assert.equal(r.resultado, 'pendiente-revision');
  assert.match(r.motivo, /requiere revisión manual/);
});
test('evaluar: blocked → rechazado con el motivo', () => {
  const r = evaluarCambio('Diseño', 'En producción', 'blocked');
  assert.equal(r.resultado, 'rechazado');
  assert.equal(r.motivo, 'El pedido está en "En producción", que no admite cambios de diseño.');
});
test('evaluar: el motivo nombra el campo correcto', () => {
  assert.match(evaluarCambio('Fecha de entrega', 'Control final', 'blocked').motivo, /cambios de fecha de entrega/);
  assert.match(evaluarCambio('Cantidad', 'Control final', 'blocked').motivo, /cambios de cantidad/);
});

// ── Estado del pedido y nombres de diseño ─────────────────────────────────────
test('estado del pedido según avance de producción', () => {
  const base = crearPedidosIniciales()[0];
  assert.equal(estadoPedido({ ...base, checklist: SIETE(0) }, false), 'Confirmado');
  assert.equal(estadoPedido({ ...base, checklist: SIETE(2) }, false), 'En producción');
  assert.equal(estadoPedido({ ...base, checklist: SIETE(7) }, false), 'Listo para entrega');
  assert.equal(estadoPedido({ ...base, checklist: SIETE(2) }, true), 'Pendiente de revisión');
  assert.equal(estadoPedido({ ...base, cancelado: true }, true), 'Cancelado');
});
test('nombre de diseño: catálogo y personalizado', () => {
  const catalogo = crearConfiguracionInicial().catalogo;
  assert.equal(detalleDiseno({ diseno: 'floral', disenoTipo: 'catalogo' }, catalogo), 'Floral');
  assert.equal(detalleDiseno({ diseno: 'personalizado', disenoTipo: 'personalizado' }, catalogo), 'Diseño personalizado');
  assert.equal(detalleDiseno({ diseno: 'desconocido', disenoTipo: 'catalogo' }, catalogo), 'desconocido');
});

// ── Datos de demostración ─────────────────────────────────────────────────────
test('datos iniciales: #154 sin producción iniciada y #155 con 3 pasos', () => {
  const pedidos = crearPedidosIniciales();
  const p154 = pedidos.find(p => p.id === '154')!;
  const p155 = pedidos.find(p => p.id === '155')!;
  assert.equal(p154.cantidad, 20);
  assert.equal(derivarEtapaDesdeChecklist(p154.checklist), 'Antes de producción');
  assert.equal(derivarEtapaDesdeChecklist(p155.checklist), 'En producción');
  assert.equal(p155.checklist.filter(Boolean).length, 3);
});
