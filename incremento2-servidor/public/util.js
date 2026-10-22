// Utilidades compartidas por la plataforma y el chat.

export const $ = (selector, raiz = document) => raiz.querySelector(selector);

export function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function api(url, opciones = {}) {
  const respuesta = await fetch(url, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', ...(opciones.headers || {}) },
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo)
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(datos.error || 'Ocurrió un error inesperado.');
    error.estado = respuesta.status;
    throw error;
  }
  return datos;
}

// ─── Formato ──────────────────────────────────────────────────────────────────
export const personas = n => `${n} personas`;

export function entregaCorta(p) {
  const [, m, d] = p.fechaEntrega.split('-');
  return `${d}/${m} – ${p.horaEntrega}`;
}

export function entregaLarga(p) {
  const [y, m, d] = p.fechaEntrega.split('-');
  return `${d}/${m}/${y} – ${p.horaEntrega}`;
}

export function fechaCorta(iso) {
  const f = new Date(iso);
  return `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}`;
}

export function horaCorta(iso) {
  const f = new Date(iso);
  return `${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`;
}

export function horaActual() {
  return horaCorta(new Date().toISOString());
}

// ─── Componentes visuales (mismas clases del prototipo original) ──────────────
const PUNTO = { success: 'bg-emerald-500', danger: 'bg-red-500', warning: 'bg-amber-400', info: 'bg-blue-500' };
export const dot = tipo => `<span class="inline-block w-2 h-2 rounded-full flex-shrink-0 ${PUNTO[tipo]}"></span>`;

const INSIGNIA = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200'
};
export const badge = (tipo, texto) =>
  `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono-data border ${INSIGNIA[tipo]}">${esc(texto)}</span>`;

export function statusBadge(estado) {
  const tipo = { 'Confirmado': 'info', 'En producción': 'warning', 'Listo para entrega': 'success', 'Pendiente de revisión': 'neutral', 'Cancelado': 'danger' }[estado] || 'neutral';
  return badge(tipo, estado);
}

export function ruleRow(etiqueta, valor, estado) {
  const clase = { ok: 'bg-emerald-100 text-emerald-700', warn: 'bg-amber-100 text-amber-700', no: 'bg-red-100 text-red-700' }[estado];
  const texto = { ok: 'OK', warn: 'REV', no: 'NO' }[estado];
  return `<div class="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2.5 border border-slate-100">
    <span class="text-sm text-slate-700">${esc(etiqueta)}</span>
    <div class="flex items-center gap-2">
      <span class="font-mono-data text-xs font-medium text-slate-500">${esc(valor)}</span>
      <span class="text-xs font-bold px-1.5 py-0.5 rounded ${clase}">${texto}</span>
    </div>
  </div>`;
}

// ─── Línea de tiempo de un pedido (historial de versiones) ────────────────────
const COLOR = {
  blue: { punto: 'bg-blue-400', texto: 'text-blue-600' },
  amber: { punto: 'bg-amber-400', texto: 'text-amber-600' },
  emerald: { punto: 'bg-emerald-500', texto: 'text-emerald-600' },
  red: { punto: 'bg-red-400', texto: 'text-red-600' },
  slate: { punto: 'bg-slate-400', texto: 'text-slate-500' },
  violet: { punto: 'bg-violet-500', texto: 'text-violet-600' }
};
export const colorLinea = clave => COLOR[clave];

const ETIQUETA_RESULTADO = { aplicado: 'aprobado', 'pendiente-revision': 'enviado a revisión', rechazado: 'rechazado' };

/**
 * Reconstruye las versiones del pedido a partir de sus cambios.
 * El estado inicial se obtiene deshaciendo, del más nuevo al más antiguo, los cambios que sí se aplicaron.
 */
export function lineaDeTiempo(pedido, cambios, nombreDiseno) {
  const asc = [...cambios].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const aplicado = c => c.origen === 'cambio' && (c.resultado === 'aplicado' || c.decisionManual === 'aprobado');
  const v = { 'Cantidad': personas(pedido.cantidad), 'Diseño': nombreDiseno, 'Fecha de entrega': entregaLarga(pedido) };
  for (const c of [...asc].reverse()) if (aplicado(c)) v[c.campo] = c.detalleAnterior;
  const instantanea = () => `${v['Cantidad']} · Diseño ${v['Diseño']} · Entrega ${v['Fecha de entrega']}`;

  const entradas = [{ iso: pedido.creadoEn, etiqueta: 'Versión 1', detalle: instantanea(), color: 'blue' }];
  let version = 1;
  for (const c of asc) {
    if (c.origen === 'nuevo-pedido') {
      entradas.push({ iso: c.fecha, etiqueta: 'Revisión de diseño personalizado', detalle: c.motivo, color: 'violet' });
      if (c.decisionManual === 'aprobado') entradas.push({ iso: c.fechaDecisionManual, etiqueta: 'Diseño confirmado', detalle: 'Responsable: ' + c.responsable, color: 'emerald' });
      if (c.decisionManual === 'rechazo-mantenido') entradas.push({ iso: c.fechaDecisionManual, etiqueta: 'Diseño no viable – pedido cancelado', detalle: 'Responsable: ' + c.responsable, color: 'red' });
      continue;
    }
    entradas.push({ iso: c.fecha, etiqueta: 'Cambio solicitado', detalle: `${c.campo}: ${c.detalleAnterior} → ${c.detalleNuevo}`, color: 'amber' });
    if (c.resultado === 'aplicado') {
      v[c.campo] = c.detalleNuevo;
      version += 1;
      entradas.push({ iso: c.fecha, etiqueta: `Versión ${version}`, detalle: `${instantanea()} · Aprobado automáticamente`, color: 'emerald' });
    } else if (c.resultado === 'rechazado') {
      entradas.push({ iso: c.fecha, etiqueta: 'Cambio rechazado', detalle: `Decisión automática: rechazado · ${c.motivo}`, color: 'red' });
    } else {
      entradas.push({ iso: c.fecha, etiqueta: 'Enviado a revisión', detalle: c.motivo, color: 'amber' });
    }
    if (c.decisionManual === 'aprobado') {
      v[c.campo] = c.detalleNuevo;
      version += 1;
      entradas.push({ iso: c.fechaDecisionManual, etiqueta: 'Aprobado manualmente', detalle: `Decisión automática: ${ETIQUETA_RESULTADO[c.resultado]} · Decisión manual: aprobado · Responsable: ${c.responsable}`, color: 'amber' });
      entradas.push({ iso: c.fechaDecisionManual, etiqueta: `Versión ${version}`, detalle: instantanea(), color: 'emerald' });
    } else if (c.decisionManual === 'rechazo-mantenido') {
      entradas.push({ iso: c.fechaDecisionManual, etiqueta: 'Rechazo confirmado', detalle: `Decisión automática: ${ETIQUETA_RESULTADO[c.resultado]} · Decisión manual: rechazo · Responsable: ${c.responsable}`, color: 'slate' });
    }
  }
  return entradas;
}
