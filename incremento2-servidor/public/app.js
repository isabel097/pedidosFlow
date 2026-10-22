// PedidosFlow – interfaz del encargado (plataforma) y del cliente (chat), sobre la API real.
import {
  $, api, badge, colorLinea, dot, entregaCorta, entregaLarga, esc, fechaCorta, horaCorta,
  lineaDeTiempo, personas, ruleRow, statusBadge
} from './util.js';
import { montarChat } from './chat.js';

const S = { modo: 'plataforma', nav: 'pedidos', pedidoId: null, panelNotif: false, notif: { noLeidas: 0, items: [] }, resumen: null, revisionAbierta: null, cfgBorrador: null };

const NAV = [
  { id: 'pedidos', etiqueta: 'Pedidos' },
  { id: 'cambios', etiqueta: 'Cambios pendientes' },
  { id: 'produccion', etiqueta: 'Producción' },
  { id: 'clientes', etiqueta: 'Clientes' },
  { id: 'historial', etiqueta: 'Historial' },
  { id: 'configuracion', etiqueta: 'Configuración' }
];

// ─── Estructura general ───────────────────────────────────────────────────────
function pintarEstructura() {
  $('#app').innerHTML = `
  <header class="bg-white border-b border-slate-200 flex items-center px-4 h-14 flex-shrink-0 relative z-40">
    <div class="flex items-center gap-2 mr-6">
      <div class="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-white font-bold text-xs font-mono-data">PF</div>
      <span class="font-display font-bold text-slate-800">PedidosFlow</span>
    </div>
    <div id="selectorModo" class="flex bg-slate-100 rounded-lg p-1 gap-1 mr-auto"></div>
    <button data-accion="campana" class="relative p-2 rounded-lg hover:bg-slate-100 transition-colors" aria-label="Notificaciones">
      <span class="text-base font-mono-data text-slate-500 select-none">[n]</span>
      <span id="contadorNotif"></span>
    </button>
    <div id="panelNotif"></div>
  </header>
  <div class="flex flex-1 overflow-hidden">
    <aside id="lateral" class="w-52 bg-slate-800 flex-shrink-0 flex flex-col py-4"></aside>
    <main class="flex-1 overflow-hidden flex flex-col"><div id="contenido" class="flex-1 overflow-y-auto custom-scroll p-6"></div></main>
  </div>`;
}

function pintarSelector() {
  $('#selectorModo').innerHTML = [['plataforma', 'Plataforma'], ['whatsapp', 'WhatsApp + Bot']]
    .map(([id, texto]) => `<button data-accion="modo" data-id="${id}" class="px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${S.modo === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">${texto}</button>`)
    .join('');
}

function pintarLateral() {
  const aside = $('#lateral');
  aside.classList.toggle('hidden', S.modo !== 'plataforma');
  if (S.modo !== 'plataforma') return;
  const r = S.resumen;
  const insignia = { pedidos: r?.pedidosActivos, cambios: r ? r.cambiosPendientes + r.revisionesPendientes : 0, produccion: r?.enProduccion };
  aside.innerHTML = `<nav class="space-y-0.5 px-2 flex-1">${NAV.map(item => {
    const activo = S.nav === item.id && !S.pedidoId;
    const n = insignia[item.id];
    return `<button data-accion="nav" data-id="${item.id}" class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${activo ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}">
      <span class="flex-1">${item.etiqueta}</span>
      ${n > 0 ? `<span class="text-xs font-mono-data px-1.5 py-0.5 rounded bg-white/10 text-slate-300">${n}</span>` : ''}
    </button>`;
  }).join('')}</nav>`;
}

function pintarNotificaciones() {
  const n = S.notif;
  $('#contadorNotif').innerHTML = n.noLeidas > 0 ? `<span class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">${n.noLeidas}</span>` : '';
  const tipoPunto = { info: 'info', warning: 'warning', success: 'success', danger: 'danger' };
  $('#panelNotif').innerHTML = !S.panelNotif ? '' : `
  <div class="absolute right-4 top-14 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-slide-in">
    <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
      <span class="font-display font-semibold text-slate-800 text-sm">Notificaciones</span>
      <div class="flex items-center gap-3">
        ${n.noLeidas > 0 ? '<button data-accion="leer-todas" class="text-xs text-blue-600 hover:underline">Marcar todas</button>' : ''}
        <button data-accion="campana" class="text-slate-400 hover:text-slate-600 text-sm">×</button>
      </div>
    </div>
    <div class="max-h-96 overflow-y-auto custom-scroll divide-y divide-slate-50">
      ${n.items.length ? n.items.map(x => `
        <button data-accion="leer-notif" data-id="${x.id}" class="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors ${x.leida ? '' : 'bg-blue-50/40'}">
          <span class="mt-1.5">${dot(tipoPunto[x.tipo])}</span>
          <span class="flex-1">
            <span class="block text-sm ${x.leida ? 'text-slate-600' : 'font-semibold text-slate-800'}">${esc(x.texto)}</span>
            <span class="block text-xs text-slate-500 mt-0.5">${esc(x.sub)}</span>
            <span class="block text-xs text-slate-400 font-mono-data mt-0.5">${fechaCorta(x.fecha)} – ${horaCorta(x.fecha)}</span>
          </span>
        </button>`).join('') : '<div class="px-4 py-8 text-center text-sm text-slate-400">No hay notificaciones.</div>'}
    </div>
  </div>`;
}

async function refrescarContadores() {
  try {
    [S.resumen, S.notif] = await Promise.all([api('/api/dashboard'), api('/api/notificaciones')]);
  } catch { /* el siguiente pintado mostrará el error */ }
  pintarLateral();
  pintarNotificaciones();
}

const encabezado = (titulo, sub) => `<div><h1 class="font-display font-bold text-xl text-slate-800">${titulo}</h1>${sub ? `<p class="text-sm text-slate-500 mt-0.5">${sub}</p>` : ''}</div>`;
const tarjeta = (interior, extra = '') => `<div class="bg-white rounded-xl border border-slate-200 overflow-hidden ${extra}">${interior}</div>`;

// ─── Vista: Pedidos (resumen) ─────────────────────────────────────────────────
function bannerDecision(c, pedidos) {
  if (!c) return '';
  const caja = (clase, tipo, titulo, texto) => `<div class="${clase} border rounded-xl p-4 flex items-start gap-3 animate-fade-in">${dot(tipo)}<div><div class="font-semibold text-sm">${titulo}</div><div class="text-sm">${texto}</div></div></div>`;
  if (c.origen === 'nuevo-pedido') {
    return c.decisionManual === 'aprobado'
      ? caja('bg-emerald-50 border-emerald-200 text-emerald-800', 'success', `Pedido #${c.pedidoId} confirmado`, 'Diseño personalizado aceptado.')
      : caja('bg-red-50 border-red-200 text-red-800', 'danger', `Pedido #${c.pedidoId} cancelado`, 'Diseño no viable informado al cliente.');
  }
  if (c.decisionManual === 'aprobado') return caja('bg-amber-50 border-amber-200 text-amber-800', 'warning', `Pedido #${c.pedidoId} – Cambio aprobado manualmente`, `El encargado aprobó el cambio de ${c.campo.toLowerCase()}. Decisión registrada.`);
  if (c.decisionManual === 'rechazo-mantenido') return caja('bg-red-50 border-red-200 text-red-800', 'danger', `Pedido #${c.pedidoId} – Rechazo mantenido`, 'El encargado confirmó el rechazo automático. Decisión registrada.');
  return caja('bg-emerald-50 border-emerald-200 text-emerald-800', 'success', `Pedido #${c.pedidoId} actualizado`, `Cambio aprobado automáticamente: ${esc(c.detalleAnterior)} → ${esc(c.detalleNuevo)}.`);
}

async function vistaPedidos() {
  const d = await api('/api/dashboard');
  const tarjetas = [
    { etiqueta: 'Pedidos activos', valor: d.pedidosActivos, clase: 'border-slate-200', texto: 'text-slate-700' },
    { etiqueta: 'Cambios pendientes', valor: d.cambiosPendientes, clase: 'border-amber-100', texto: 'text-amber-700' },
    { etiqueta: 'En producción', valor: d.enProduccion, clase: 'border-blue-100', texto: 'text-blue-700' },
    { etiqueta: 'Revisiones pendientes', valor: d.revisionesPendientes, clase: 'border-violet-100', texto: 'text-violet-700' }
  ];
  $('#contenido').innerHTML = `<div class="space-y-5">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">${tarjetas.map(t => `
      <div class="bg-white rounded-xl border ${t.clase} p-4"><div class="text-2xl font-bold font-display ${t.texto}">${t.valor}</div><div class="text-xs text-slate-500 font-medium mt-0.5">${t.etiqueta}</div></div>`).join('')}</div>
    ${bannerDecision(d.ultimaDecision)}
    ${tarjeta(`
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 class="font-semibold font-display text-slate-800">Pedidos recientes</h2>
        <span class="text-xs text-slate-400 font-mono-data">${d.pedidos.length} pedidos</span>
      </div>
      <div class="overflow-x-auto"><table class="w-full text-sm">
        <thead><tr class="bg-slate-50 border-b border-slate-100">${['Pedido', 'Cliente', 'Producto', 'Cantidad', 'Entrega', 'Estado', ''].map(h => `<th class="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">${h}</th>`).join('')}</tr></thead>
        <tbody class="divide-y divide-slate-50">${d.pedidos.map(p => `
          <tr class="hover:bg-slate-50 transition-colors cursor-pointer" data-accion="abrir-pedido" data-id="${p.id}">
            <td class="px-4 py-3 font-mono-data font-medium text-blue-600">#${p.id}</td>
            <td class="px-4 py-3 text-slate-700">${esc(p.cliente)}</td>
            <td class="px-4 py-3 text-slate-600">${esc(p.producto)}</td>
            <td class="px-4 py-3 text-slate-600">${personas(p.cantidad)}</td>
            <td class="px-4 py-3 font-mono-data text-slate-500 text-xs">${entregaCorta(p)}</td>
            <td class="px-4 py-3">${statusBadge(p.estado)}</td>
            <td class="px-4 py-3 text-slate-300 text-xs hover:text-blue-600 transition-colors">Ver →</td>
          </tr>`).join('')}</tbody>
      </table></div>`)}
  </div>`;
}

// ─── Vista: detalle del pedido ────────────────────────────────────────────────
function panelValidacion(c, p, total) {
  const regla = { aplicado: 'auto', 'pendiente-revision': 'review', rechazado: 'blocked' }[c.resultado];
  const estadoEtapa = { auto: 'ok', review: 'warn', blocked: 'no' }[regla];
  const valorEtapa = { auto: 'VIABLE', review: 'REVISIÓN', blocked: 'BLOQUEADO' }[regla];
  const permitido = { auto: 'SÍ', review: 'REVISIÓN', blocked: 'NO' }[regla];
  const banner = {
    aplicado: ['bg-emerald-50 border border-emerald-200', 'success', 'text-emerald-700', 'CAMBIO VIABLE – Aprobado automáticamente'],
    'pendiente-revision': ['bg-amber-50 border border-amber-200', 'warning', 'text-amber-700', 'REQUIERE REVISIÓN – Pendiente de decisión del encargado'],
    rechazado: ['bg-red-50 border border-red-200', 'danger', 'text-red-700', 'CAMBIO NO VIABLE – Rechazado automáticamente']
  }[c.resultado];
  const decision = c.decisionManual ? `
    <div class="mt-4 border rounded-xl p-4 ${c.decisionManual === 'aprobado' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}">
      <h4 class="font-display font-semibold text-slate-800 mb-3 text-sm">Decisión registrada</h4>
      <dl class="space-y-2 text-sm">
        ${[['Decisión automática', { aplicado: 'Aprobado', 'pendiente-revision': 'Enviado a revisión', rechazado: 'Rechazado' }[c.resultado], 'text-slate-700'],
          ['Decisión manual', c.decisionManual === 'aprobado' ? 'Aprobado' : 'Rechazo confirmado', c.decisionManual === 'aprobado' ? 'text-amber-600' : 'text-slate-600'],
          ['Responsable', c.responsable, 'text-slate-700'],
          ['Fecha y hora', `${fechaCorta(c.fechaDecisionManual)} – ${horaCorta(c.fechaDecisionManual)}`, 'text-slate-500 font-mono-data text-xs']]
          .map(([a, b, k]) => `<div class="flex justify-between"><dt class="text-slate-500">${a}</dt><dd class="font-medium ${k}">${esc(b)}</dd></div>`).join('')}
      </dl></div>` : '';
  return `<div class="bg-white border border-slate-200 rounded-xl p-5 animate-slide-in">
    <h3 class="font-display font-semibold text-slate-800 mb-1">Motor de Validación</h3>
    <p class="text-xs text-slate-500 mb-4">Último cambio solicitado: ${esc(c.campo)} ${esc(c.detalleAnterior)} → ${esc(c.detalleNuevo)} · Pedido #${p.id}</p>
    <div class="space-y-2 mb-4">
      ${ruleRow('Producción iniciada', c.pasosCompletados > 0 ? 'SÍ' : 'NO', c.pasosCompletados === 0 ? 'ok' : 'no')}
      ${ruleRow(`Etapa del pedido: ${c.etapa} (${c.pasosCompletados}/${total})`, valorEtapa, estadoEtapa)}
      ${ruleRow(`Cambio de ${c.campo.toLowerCase()} permitido en esta etapa`, permitido, estadoEtapa)}
    </div>
    <div class="${banner[0]} rounded-lg p-3 flex items-center gap-2">${dot(banner[1])}<span class="font-semibold text-sm ${banner[2]}">${banner[3]}</span></div>
    <p class="text-xs text-slate-500 mt-3">${esc(c.motivo)}</p>
    ${!c.decisionManual && c.resultado !== 'aplicado' ? '<button data-accion="nav" data-id="cambios" class="mt-4 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-lg text-sm border border-slate-200 transition-colors">Ver alerta de revisión →</button>' : ''}
    ${decision}
  </div>`;
}

function lineaHtml(entradas, ancha) {
  if (!ancha) {
    return `<div class="relative pl-4"><div class="absolute left-1.5 top-2 bottom-2 w-px bg-slate-100"></div>${entradas.map(e => {
      const k = colorLinea(e.color);
      return `<div class="relative mb-5 last:mb-0">
        <div class="absolute -left-2.5 top-1 w-3 h-3 rounded-full border-2 border-white ${k.punto}"></div>
        <div class="text-xs font-semibold mb-0.5 ${k.texto}">${esc(e.etiqueta)}</div>
        <div class="text-xs text-slate-400 font-mono-data mb-1">${fechaCorta(e.iso)} – ${horaCorta(e.iso)}</div>
        <div class="bg-slate-50 rounded-lg p-2 text-xs text-slate-600 border border-slate-100">${esc(e.detalle)}</div>
      </div>`;
    }).join('')}</div>`;
  }
  return `<div class="relative pl-4 pt-1"><div class="absolute left-1.5 top-2 bottom-2 w-px bg-slate-100"></div>${entradas.map(e => {
    const k = colorLinea(e.color);
    return `<div class="relative mb-4 last:mb-0 flex gap-4">
      <div class="w-24 flex-shrink-0 text-right pt-0.5"><div class="text-xs font-mono-data text-slate-500">${fechaCorta(e.iso)}</div><div class="text-xs font-mono-data text-slate-400">${horaCorta(e.iso)}</div></div>
      <div class="flex flex-col items-center flex-shrink-0 z-10"><div class="w-3 h-3 rounded-full mt-1 border-2 border-white ${k.punto}"></div></div>
      <div class="flex-1 pb-4"><div class="text-xs font-semibold mb-0.5 ${k.texto}">${esc(e.etiqueta)}</div><div class="text-sm text-slate-600">${esc(e.detalle)}</div></div>
    </div>`;
  }).join('')}</div>`;
}

async function vistaDetalle(id) {
  const [p, cambios] = await Promise.all([api('/api/pedidos/' + id), api(`/api/pedidos/${id}/cambios`)]);
  const ultimo = cambios.find(c => c.origen === 'cambio') || cambios[0];
  const entradas = lineaDeTiempo(p, cambios, p.disenoNombre);
  const datos = [
    ['Cliente', p.cliente], ['Teléfono', p.telefono], ['Producto', p.producto], ['Cantidad', personas(p.cantidad)],
    ['Diseño', p.disenoNombre], ['Fecha de entrega', entregaLarga(p)], ['Producción', `${p.pasosCompletados} / ${p.totalPasos} etapas completadas`], ['Etapa', p.etapa]
  ];
  $('#contenido').innerHTML = `<div class="space-y-5 animate-slide-in">
    <div class="flex items-center gap-3 flex-wrap">
      <button data-accion="volver" class="text-slate-400 hover:text-slate-600 text-sm transition-colors">← Volver</button>
      <span class="text-slate-200">|</span>
      <h1 class="font-display font-bold text-xl text-slate-800">Pedido #${p.id}</h1>
      ${statusBadge(p.estado)}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div class="lg:col-span-2 space-y-5">
        <div class="bg-white rounded-xl border border-slate-200 p-5">
          <h3 class="font-display font-semibold text-slate-800 mb-4">Datos del pedido</h3>
          <dl class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">${datos.map(([a, b]) => `<div><dt class="text-xs font-medium text-slate-400 uppercase tracking-wide">${a}</dt><dd class="text-slate-700 font-medium mt-0.5">${esc(b)}</dd></div>`).join('')}</dl>
          ${p.fotoUrl ? `<div class="mt-4"><div class="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Foto de referencia</div><img src="${esc(p.fotoUrl)}" alt="Diseño personalizado" class="w-40 h-40 object-cover rounded-lg border border-slate-200 bg-slate-100"></div>` : ''}
        </div>
        ${ultimo ? panelValidacion(ultimo, p, p.totalPasos) : '<div class="bg-slate-50 border border-slate-200 rounded-xl p-5 text-sm text-slate-500">Este pedido todavía no tiene solicitudes de cambio. Solicita una desde el chat de WhatsApp para ver aquí el motor de validación.</div>'}
      </div>
      <div><div class="bg-white rounded-xl border border-slate-200 p-4"><h3 class="font-display font-semibold text-slate-800 mb-4 text-sm">Historial de versiones</h3>${lineaHtml(entradas, false)}</div></div>
    </div>
  </div>`;
}

// ─── Vista: cambios pendientes ────────────────────────────────────────────────
function datosCambio(c) {
  const p = c.pedido;
  const celdas = [['Cliente', esc(p.cliente)], ['Cambio solicitado', `${esc(c.campo)}: ${esc(c.detalleAnterior)} → ${esc(c.detalleNuevo)}`],
    ['Decisión automática', c.resultado === 'rechazado' ? badge('danger', 'RECHAZADO') : badge('warning', 'EN REVISIÓN')], ['Motivo', esc(c.motivo)]];
  return `<div class="grid grid-cols-2 gap-4 text-sm">${celdas.map(([a, b]) => `<div><div class="text-xs text-slate-400 uppercase tracking-wide mb-1">${a}</div><div class="text-slate-700">${b}</div></div>`).join('')}</div>`;
}

function tarjetaFoto(c) {
  const p = c.pedido;
  const celdas = [['Cliente', esc(p.cliente), 'font-medium text-slate-700'], ['Pedido', `#${p.id}`, 'font-mono-data font-medium text-blue-600'], ['Producto', esc(p.producto), 'font-medium text-slate-700'], ['Cantidad', personas(p.cantidad), 'font-medium text-slate-700'], ['Entrega', entregaCorta(p), 'font-mono-data text-xs text-slate-600']];
  return `<div class="bg-white border border-violet-200 rounded-xl overflow-hidden animate-slide-in">
    <div class="bg-violet-50 px-5 py-3 border-b border-violet-100 flex items-center gap-2">${dot('info')}<span class="font-semibold text-violet-800 text-sm">Revisión de diseño personalizado requerida – Pedido #${p.id}</span></div>
    <div class="p-5"><div class="flex gap-5 flex-col sm:flex-row">
      <div class="flex-shrink-0"><div class="text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">${c.foto ? 'Foto de referencia enviada' : 'Propuesta de diseño'}</div>
        ${c.foto ? `<img src="${esc(c.foto)}" alt="Diseño de torta personalizada" class="w-40 h-40 object-cover rounded-lg border border-slate-200 bg-slate-100">` : `<div class="w-40 min-h-28 rounded-lg border border-violet-100 bg-violet-50 p-3 text-sm text-slate-700">${esc(c.valorNuevo?.descripcionDiseno || p.descripcionDiseno || 'El cliente solicita un diseño personalizado y debe describirlo con el encargado.')}</div>`}</div>
      <div class="flex-1 space-y-3">
        <div class="grid grid-cols-2 gap-3 text-sm">${celdas.map(([a, b, k]) => `<div><div class="text-xs text-slate-400 uppercase tracking-wide mb-1">${a}</div><div class="${k}">${b}</div></div>`).join('')}</div>
        <p class="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-100">El diseño está fuera del catálogo. Revisa si es técnicamente posible, si hay materiales y si existe capacidad antes de confirmar el pedido.</p>
        <div class="flex gap-2 pt-1">
          <button data-accion="decidir" data-id="${c.id}" data-decision="aprobar" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-lg text-sm transition-colors">Confirmar viabilidad</button>
          <button data-accion="decidir" data-id="${c.id}" data-decision="mantener-rechazo" class="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-semibold py-2 rounded-lg text-sm border border-red-200 transition-colors">Diseño no viable</button>
        </div>
      </div>
    </div></div></div>`;
}

function tarjetaRechazo(c) {
  const abierta = S.revisionAbierta === c.id;
  return `<div class="bg-white border border-red-200 rounded-xl overflow-hidden animate-slide-in">
    <div class="bg-red-50 px-5 py-3 border-b border-red-100 flex items-center gap-2">${dot('danger')}<span class="font-semibold text-red-800 text-sm">Cambio requiere revisión – Pedido #${c.pedido.id}</span></div>
    <div class="p-5 space-y-4">${datosCambio(c)}
      ${c.foto ? `<img src="${esc(c.foto)}" alt="Diseño propuesto" class="w-32 h-32 object-cover rounded-lg border border-slate-200">` : ''}
      ${!abierta ? `<div class="flex gap-2 pt-2 border-t border-slate-100">
        <button data-accion="revisar" data-id="${c.id}" class="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2 rounded-lg text-sm transition-colors">Revisar solicitud</button>
        <button data-accion="decidir" data-id="${c.id}" data-decision="mantener-rechazo" class="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-lg text-sm border border-slate-200 transition-colors">Mantener rechazo</button>
        <button data-accion="decidir" data-id="${c.id}" data-decision="aprobar" class="px-4 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold py-2 rounded-lg text-sm border border-amber-200 transition-colors">Aprobar manualmente</button>
      </div>` : `<div class="border border-slate-200 rounded-xl p-4 bg-slate-50 animate-slide-in">
        <h4 class="font-display font-semibold text-slate-700 mb-3 text-sm">Revisión manual – Pedido #${c.pedido.id}</h4>
        <div class="space-y-2 text-sm mb-4">
          <div class="flex justify-between"><span class="text-slate-500">Estado actual</span>${statusBadge(c.pedido.estado)}</div>
          <div class="flex justify-between"><span class="text-slate-500">Cambio solicitado</span><span class="font-medium text-slate-700">${esc(c.campo)}: ${esc(c.detalleNuevo)}</span></div>
          <div class="flex justify-between gap-4"><span class="text-slate-500">Motivo del rechazo automático</span><span class="text-slate-700 text-right">${esc(c.motivo)}</span></div>
        </div>
        <p class="text-xs text-slate-500 bg-white border border-slate-100 rounded-lg p-3 mb-4">Verifica si existe una excepción o situación especial que justifique aprobar este cambio. La decisión quedará registrada en el historial con el responsable.</p>
        <div class="flex gap-2">
          <button data-accion="decidir" data-id="${c.id}" data-decision="aprobar" class="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 rounded-lg text-sm transition-colors">Aprobar manualmente</button>
          <button data-accion="decidir" data-id="${c.id}" data-decision="mantener-rechazo" class="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-semibold py-2 rounded-lg text-sm border border-red-200 transition-colors">Mantener rechazo</button>
        </div></div>`}
    </div></div>`;
}

function tarjetaRevision(c) {
  return `<div class="bg-white border border-amber-200 rounded-xl overflow-hidden animate-slide-in">
    <div class="bg-amber-50 px-5 py-3 border-b border-amber-100 flex items-center gap-2">${dot('warning')}<span class="font-semibold text-amber-800 text-sm">Cambio pendiente de revisión – Pedido #${c.pedido.id}</span></div>
    <div class="p-5 space-y-4">${datosCambio(c)}
      ${c.foto ? `<img src="${esc(c.foto)}" alt="Diseño propuesto" class="w-32 h-32 object-cover rounded-lg border border-slate-200">` : ''}
      <div class="flex gap-2 pt-2 border-t border-slate-100">
        <button data-accion="decidir" data-id="${c.id}" data-decision="aprobar" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-lg text-sm transition-colors">Aprobar cambio</button>
        <button data-accion="decidir" data-id="${c.id}" data-decision="mantener-rechazo" class="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-semibold py-2 rounded-lg text-sm border border-red-200 transition-colors">Rechazar cambio</button>
      </div></div></div>`;
}

async function vistaCambios() {
  const [pendientes, todos] = await Promise.all([api('/api/revisiones-pendientes'), api('/api/cambios')]);
  const resueltos = todos.filter(c => c.decisionManual).slice(0, 6);
  const etiqueta = c => c.origen === 'nuevo-pedido'
    ? (c.decisionManual === 'aprobado' ? 'Diseño confirmado' : 'Diseño no viable – pedido cancelado')
    : (c.decisionManual === 'aprobado' ? 'Cambio aprobado manualmente' : 'Rechazo confirmado');
  $('#contenido').innerHTML = `<div class="space-y-5">
    <h1 class="font-display font-bold text-xl text-slate-800">Cambios pendientes</h1>
    ${pendientes.length ? pendientes.map(c => c.origen === 'nuevo-pedido' ? tarjetaFoto(c) : c.resultado === 'rechazado' ? tarjetaRechazo(c) : tarjetaRevision(c)).join('')
      : '<div class="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">No hay cambios pendientes de revisión.</div>'}
    ${resueltos.length ? `<h2 class="font-display font-semibold text-slate-700 text-sm pt-2">Decisiones recientes</h2>${resueltos.map(c => `
      <div class="rounded-xl border p-4 ${c.decisionManual === 'aprobado' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}">
        <div class="flex items-center gap-2">${dot(c.decisionManual === 'aprobado' ? 'warning' : 'danger')}<span class="font-semibold text-slate-700 text-sm">${etiqueta(c)} – Pedido #${c.pedidoId}</span></div>
        <p class="text-sm text-slate-500 mt-1 ml-4">${esc(c.campo)}: ${esc(c.detalleAnterior)} → ${esc(c.detalleNuevo)} · Decisión registrada en el historial del pedido.</p>
      </div>`).join('')}` : ''}
  </div>`;
}

// ─── Vista: producción ────────────────────────────────────────────────────────
async function vistaProduccion() {
  const lista = await api('/api/produccion');
  $('#contenido').innerHTML = `<div class="space-y-5">
    ${encabezado('Seguimiento de producción', 'Marque las etapas completadas. El motor de validación usa este avance para evaluar cambios.')}
    ${lista.map(p => {
      const actual = p.pasosCompletados === 0 ? 'No iniciada' : p.pasosCompletados === p.totalPasos ? 'Completada' : p.pasos[p.pasosCompletados - 1].nombre;
      return tarjeta(`
        <div class="px-5 py-4 border-b border-slate-100">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-3"><span class="font-mono-data font-semibold text-blue-600">#${p.id}</span><span class="text-slate-700 font-medium text-sm">${esc(p.producto)} – ${esc(p.cliente)}</span>${statusBadge(p.estado)}</div>
            <div class="flex items-center gap-3"><span class="text-xs text-slate-500 font-mono-data">${p.pasosCompletados}/${p.totalPasos} etapas</span><span class="text-xs text-slate-400 font-mono-data">Entrega: ${entregaCorta(p)}</span></div>
          </div>
          <div class="mt-3 flex items-center gap-3"><div class="flex-1 bg-slate-100 rounded-full h-1.5"><div class="bg-blue-500 h-1.5 rounded-full transition-all duration-300" style="width:${p.progreso}%"></div></div><span class="text-xs font-mono-data text-slate-500 w-10 text-right">${p.progreso}%</span></div>
          <div class="text-xs text-slate-400 mt-1">Etapa actual: ${esc(actual)}</div>
        </div>
        <div class="p-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${p.pasos.map((paso, i) => {
            const bloqueado = !paso.hecho && !p.pasos.slice(0, i).every(x => x.hecho);
            const clase = paso.hecho ? 'bg-emerald-50 border-emerald-200' : bloqueado ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-slate-300';
            return `<label class="flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer select-none ${clase}">
              <input type="checkbox" data-accion="paso" data-id="${p.id}" data-indice="${i}" ${paso.hecho ? 'checked' : ''} ${bloqueado ? 'disabled' : ''} class="w-4 h-4 rounded accent-emerald-600 cursor-pointer">
              <span class="text-sm flex-1 ${paso.hecho ? 'text-emerald-700 font-medium line-through decoration-emerald-400' : 'text-slate-700'}">${i + 1}. ${esc(paso.nombre)}</span>
              ${paso.hecho ? '<span class="text-xs font-mono-data text-emerald-500 font-bold">OK</span>' : ''}
            </label>`;
          }).join('')}</div>
          ${p.pasosCompletados > 0 && p.pasosCompletados < p.totalPasos ? `<div class="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2">${dot('warning')}<p class="text-xs text-amber-700"><strong>Aviso:</strong> Con ${p.pasosCompletados} etapas completadas, el pedido está en producción: las reglas de la configuración deciden si los cambios se aprueban, pasan a revisión o se rechazan.</p></div>` : ''}
        </div>`);
    }).join('')}
  </div>`;
}

// ─── Vista: clientes ──────────────────────────────────────────────────────────
async function vistaClientes() {
  const lista = await api('/api/clientes');
  $('#contenido').innerHTML = `<div class="space-y-5">${encabezado('Clientes', 'Clientes agregados a partir de los pedidos registrados.')}
    ${tarjeta(`<div class="overflow-x-auto"><table class="w-full text-sm">
      <thead><tr class="bg-slate-50 border-b border-slate-100">${['Cliente', 'Teléfono', 'Pedidos', 'Última entrega', 'Estado'].map(h => `<th class="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">${h}</th>`).join('')}</tr></thead>
      <tbody class="divide-y divide-slate-50">${lista.map(c => `<tr class="hover:bg-slate-50 transition-colors">
        <td class="px-4 py-3 text-slate-700 font-medium">${esc(c.nombre)}</td>
        <td class="px-4 py-3 font-mono-data text-slate-500 text-xs">${esc(c.telefono)}</td>
        <td class="px-4 py-3 text-slate-600">${c.totalPedidos} <span class="text-xs text-slate-400 font-mono-data">(${c.pedidos.map(x => '#' + x).join(', ')})</span></td>
        <td class="px-4 py-3 font-mono-data text-slate-500 text-xs">${c.ultimaEntrega.split('-').reverse().join('/')}</td>
        <td class="px-4 py-3">${badge('success', c.estado)}</td></tr>`).join('')}</tbody></table></div>`)}</div>`;
}

// ─── Vista: historial ─────────────────────────────────────────────────────────
async function vistaHistorial() {
  const [pedidos, cambios] = await Promise.all([api('/api/pedidos'), api('/api/cambios')]);
  $('#contenido').innerHTML = `<div class="space-y-5"><h1 class="font-display font-bold text-xl text-slate-800">Historial de pedidos</h1>
    ${[...pedidos].sort((a, b) => Number(b.id) - Number(a.id)).map(p => {
      const propios = cambios.filter(c => c.pedidoId === p.id);
      return tarjeta(`<div class="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <span class="font-mono-data font-semibold text-blue-600">#${p.id}</span><span class="text-slate-700 font-medium text-sm">${esc(p.producto)} – ${esc(p.cliente)}</span>${statusBadge(p.estado)}
        </div><div class="p-5">${lineaHtml(lineaDeTiempo(p, propios, p.disenoNombre), true)}</div>`);
    }).join('')}</div>`;
}

// ─── Vista: configuración ─────────────────────────────────────────────────────
const COLUMNAS = ['Antes de producción', 'En producción', 'Control final'];
const FILAS = [['cantidad', 'Cantidad'], ['diseno', 'Color / Diseño'], ['fecha', 'Fecha de entrega']];
const NOTIFICACIONES = [
  ['notificarNuevoPedido', 'Nuevo pedido recibido'], ['notificarCambio', 'Cliente solicita modificación'],
  ['notificarCambioAutomatico', 'Cambio aprobado o rechazado automáticamente'], ['notificarRevision', 'Cambio enviado a revisión o decidido por el encargado'],
  ['notificarProduccion', 'Actualización de etapa de producción']
];

const seccion = (titulo, interior) => tarjeta(`<div class="px-5 py-3.5 border-b border-slate-100 bg-slate-50"><h2 class="font-display font-semibold text-slate-700 text-sm">${titulo}</h2></div><div class="p-5">${interior}</div>`);
const interruptor = (clave, activo) => `<button type="button" role="switch" aria-checked="${activo}" data-accion="interruptor" data-clave="${clave}" class="relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${activo ? 'bg-emerald-500' : 'bg-slate-300'}"><span class="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-4' : 'translate-x-0.5'}"></span></button>`;
const campo = (id, etiqueta, valor) => `<div><label class="text-xs text-slate-400 uppercase tracking-wide font-semibold block mb-1">${etiqueta}</label><input id="${id}" value="${esc(valor)}" class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"></div>`;

function selectorRegla(fila, columna, valor) {
  const colores = { auto: 'text-emerald-700 bg-emerald-50 border-emerald-200', review: 'text-amber-700 bg-amber-50 border-amber-200', blocked: 'text-red-700 bg-red-50 border-red-200' };
  return `<select data-regla="${fila}|${columna}" class="text-xs font-semibold border rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-400 ${colores[valor]}">
    ${[['auto', 'Automático'], ['review', 'Revisión'], ['blocked', 'Bloqueado']].map(([v, t]) => `<option value="${v}" ${v === valor ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
}

function pintarConfiguracion() {
  const c = S.cfgBorrador;
  $('#contenido').innerHTML = `<div class="space-y-5 pb-24">
    ${encabezado('Configuración', 'Ajusta las reglas de validación, el bot y el comportamiento del sistema.')}
    ${seccion('Información del negocio', `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      ${campo('cfgNombre', 'Nombre del negocio', c.negocio.nombre)}${campo('cfgCorreo', 'Correo electrónico', c.negocio.correo)}
      ${campo('cfgTelefono', 'Teléfono de contacto', c.negocio.telefono)}${campo('cfgZona', 'Zona horaria', c.negocio.zonaHoraria)}</div>`)}
    ${seccion('Reglas para modificaciones (Motor de validación)', `
      <p class="text-xs text-slate-500 mb-4">Define qué sucede cuando un cliente solicita un cambio según la etapa de producción actual. Estas reglas afectan directamente la decisión automática del sistema.</p>
      <div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="border-b border-slate-100"><th class="text-left py-2 pr-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Tipo de cambio</th>${COLUMNAS.map(x => `<th class="text-center py-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">${x}</th>`).join('')}</tr></thead>
      <tbody class="divide-y divide-slate-50">${FILAS.map(([k, nombre]) => `<tr class="hover:bg-slate-50 transition-colors"><td class="py-2.5 pr-4 font-medium text-slate-700 text-sm">${nombre}</td>${COLUMNAS.map(col => `<td class="py-2.5 px-3 text-center">${selectorRegla(k, col, c.reglas[k][col])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
        <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Automático = el sistema aprueba sin intervención</span>
        <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> Revisión = se envía alerta al encargado</span>
        <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-red-500 inline-block"></span> Bloqueado = rechazo automático (el encargado puede revisarlo)</span></div>`)}
    ${seccion('Capacidad diaria de pedidos', `
      <p class="text-xs text-slate-500 mb-3">Si una fecha ya tiene el número máximo de pedidos activos configurado aquí, los cambios de fecha se envían a revisión manual en vez de aprobarse automáticamente.</p>
      <label for="cfgMaxPedidos" class="block text-sm font-medium text-slate-700 mb-1">Máximo de pedidos por fecha antes de revisión</label>
      <input id="cfgMaxPedidos" type="number" min="1" max="100" step="1" value="${Number(c.pedidosMaximosPorDia || 3)}" class="w-40 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200">
      <p class="text-xs text-slate-400 mt-2">Valor inicial: 3. Se puede ajustar al volumen real del negocio.</p>`)}
    ${seccion('Etapas de producción', `
      <p class="text-xs text-slate-500 mb-3">El orden de estas etapas determina el avance en el checklist de producción y afecta las reglas de validación.</p>
      <div class="space-y-1.5 mb-3">${c.pasosProduccion.map((s, i) => `<div class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 text-sm text-slate-700"><span class="font-mono-data text-xs text-slate-400 w-5">${i + 1}.</span><span class="flex-1">${esc(s)}</span><button data-accion="quitar-etapa" data-indice="${i}" class="text-slate-300 hover:text-red-400 transition-colors text-xs">×</button></div>`).join('')}</div>
      <div class="flex gap-2"><input id="cfgNuevaEtapa" placeholder="Nueva etapa..." class="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"><button data-accion="agregar-etapa" class="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors">+ Agregar</button></div>`)}
    ${seccion('Productos y personalizaciones', `
      <p class="text-xs text-slate-500 mb-3">Producto activo en este incremento y catálogo de diseños que el bot ofrece al cliente.</p>
      <div class="flex items-start justify-between gap-4 py-2.5 px-3 bg-slate-50 rounded-lg border border-slate-100 mb-3"><div><div class="text-sm font-medium text-slate-700">Torta personalizada</div><div class="text-xs text-slate-400 mt-0.5">Cantidad de personas, diseño de catálogo o foto de referencia y fecha de entrega</div></div>${badge('success', 'Activo')}</div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${c.catalogo.map(e => `<div class="px-3 py-2 bg-slate-50 rounded-lg border border-slate-100"><div class="text-sm font-medium text-slate-700">${esc(e.nombre)}</div><div class="text-xs text-slate-400">${esc(e.descripcion || '')}</div></div>`).join('')}</div>`)}
    ${seccion('WhatsApp + Bot', `<div class="space-y-3">
      ${[['respuestasAutomaticas', 'Respuesta automática a mensajes', 'El bot inicia la conversación sin intervención del encargado']]
        .map(([k, t, s]) => `<div class="flex items-start justify-between gap-4 py-2 border-b border-slate-50 last:border-0"><div><div class="text-sm font-medium text-slate-700">${t}</div><div class="text-xs text-slate-400 mt-0.5">${s}</div></div>${interruptor(k, c.bot[k])}</div>`).join('')}</div>`)}
    ${seccion('Notificaciones', `<p class="text-xs text-slate-500 mb-3">Elige qué eventos generan una notificación en el panel de la plataforma.</p><div class="space-y-2">
      ${NOTIFICACIONES.map(([k, t]) => `<div class="flex items-center justify-between gap-4 py-2 border-b border-slate-50 last:border-0"><span class="text-sm text-slate-700">${t}</span>${interruptor(k, c.bot[k])}</div>`).join('')}</div>`)}
    <div class="fixed bottom-0 left-52 right-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between z-30">
      <span id="cfgMensaje" class="text-sm text-slate-500">Los cambios se aplican a las siguientes validaciones.</span>
      <div class="flex gap-2"><button data-accion="cancelar-config" class="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button><button data-accion="guardar-config" class="px-4 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">Guardar cambios</button></div>
    </div></div>`;
}

function leerFormularioConfig() {
  const c = S.cfgBorrador;
  c.negocio = { nombre: $('#cfgNombre').value.trim(), correo: $('#cfgCorreo').value.trim(), telefono: $('#cfgTelefono').value.trim(), zonaHoraria: $('#cfgZona').value.trim() };
  const maxPedidos = Number($('#cfgMaxPedidos')?.value);
  if (!Number.isInteger(maxPedidos) || maxPedidos < 1 || maxPedidos > 100) throw new Error('El máximo diario debe ser un entero entre 1 y 100.');
  c.pedidosMaximosPorDia = maxPedidos;
  document.querySelectorAll('[data-regla]').forEach(s => { const [fila, col] = s.dataset.regla.split('|'); c.reglas[fila][col] = s.value; });
}

async function vistaConfiguracion() {
  S.cfgBorrador = await api('/api/configuracion');
  pintarConfiguracion();
}

// ─── Navegación y render principal ────────────────────────────────────────────
const VISTAS = { pedidos: vistaPedidos, cambios: vistaCambios, produccion: vistaProduccion, clientes: vistaClientes, historial: vistaHistorial, configuracion: vistaConfiguracion };

async function renderizar() {
  pintarSelector();
  pintarLateral();
  const cont = $('#contenido');
  if (S.modo === 'whatsapp') {
    cont.className = 'flex-1 overflow-hidden flex flex-col';
    await montarChat(cont, ir);
    return;
  }
  cont.className = 'flex-1 overflow-y-auto custom-scroll p-6';
  try {
    if (S.pedidoId) await vistaDetalle(S.pedidoId);
    else await VISTAS[S.nav]();
  } catch (e) {
    cont.innerHTML = `<div class="bg-white rounded-xl border border-red-200 p-6 text-sm text-red-700">${esc(e.message)}</div>`;
  }
  await refrescarContadores();
}

function ir(destino) {
  S.modo = 'plataforma';
  S.panelNotif = false;
  if (destino.tipo === 'pedido') { S.nav = 'pedidos'; S.pedidoId = destino.id; }
  if (destino.tipo === 'cambios') { S.nav = 'cambios'; S.pedidoId = null; }
  renderizar();
}

// ─── Eventos ──────────────────────────────────────────────────────────────────
async function decidir(id, decision) {
  try {
    await api(`/api/revisiones-pendientes/${id}/decidir`, { method: 'PUT', cuerpo: { decision } });
    S.revisionAbierta = null;
    await renderizar();
  } catch (e) {
    alert(e.message);
  }
}

async function alternarPaso(id, indice, marcado) {
  try {
    const p = await api('/api/pedidos/' + id);
    const lista = Array.from({ length: p.totalPasos }, (_, i) => (i < p.pasosCompletados));
    if (marcado) lista[indice] = true;
    else for (let i = indice; i < lista.length; i++) lista[i] = false; // al desmarcar, se desmarcan las siguientes
    await api(`/api/pedidos/${id}/produccion`, { method: 'PATCH', cuerpo: { checklist: lista } });
  } catch (e) {
    alert(e.message);
  }
  await renderizar();
}

async function guardarConfiguracion() {
  const mensaje = $('#cfgMensaje');
  try {
    leerFormularioConfig();
    S.cfgBorrador = await api('/api/configuracion', { method: 'PUT', cuerpo: S.cfgBorrador });
    pintarConfiguracion();
    const m = $('#cfgMensaje');
    m.textContent = 'Cambios guardados correctamente.';
    m.className = 'text-sm text-emerald-600 font-medium';
  } catch (e) {
    mensaje.textContent = e.message;
    mensaje.className = 'text-sm text-red-600 font-medium';
  }
}

document.addEventListener('click', async ev => {
  const el = ev.target.closest('[data-accion]');
  if (!el) return;
  const { accion, id, decision, indice, clave } = el.dataset;
  if (el.tagName === 'INPUT') return; // los checkbox se manejan en 'change'
  if (accion === 'modo') { S.modo = id; S.pedidoId = null; S.panelNotif = false; return renderizar(); }
  if (accion === 'nav') { S.nav = id; S.pedidoId = null; S.panelNotif = false; return renderizar(); }
  if (accion === 'abrir-pedido') { S.pedidoId = id; return renderizar(); }
  if (accion === 'volver') { S.pedidoId = null; return renderizar(); }
  if (accion === 'campana') { S.panelNotif = !S.panelNotif; await refrescarContadores(); return; }
  if (accion === 'leer-notif') { await api(`/api/notificaciones/${id}/leer`, { method: 'POST' }); return refrescarContadores(); }
  if (accion === 'leer-todas') { await api('/api/notificaciones/leer-todas', { method: 'POST' }); return refrescarContadores(); }
  if (accion === 'revisar') { S.revisionAbierta = id; return renderizar(); }
  if (accion === 'decidir') return decidir(id, decision);
  if (accion === 'interruptor') { leerFormularioConfig(); S.cfgBorrador.bot[clave] = !S.cfgBorrador.bot[clave]; return pintarConfiguracion(); }
  if (accion === 'quitar-etapa') {
    leerFormularioConfig();
    if (S.cfgBorrador.pasosProduccion.length <= 2) return alert('Debe haber al menos 2 etapas de producción.');
    S.cfgBorrador.pasosProduccion.splice(Number(indice), 1);
    return pintarConfiguracion();
  }
  if (accion === 'agregar-etapa') {
    leerFormularioConfig();
    const nueva = $('#cfgNuevaEtapa').value.trim();
    if (nueva) S.cfgBorrador.pasosProduccion.push(nueva);
    return pintarConfiguracion();
  }
  if (accion === 'cancelar-config') return vistaConfiguracion();
  if (accion === 'guardar-config') return guardarConfiguracion();
});

document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.dataset?.accion === 'paso') alternarPaso(el.dataset.id, Number(el.dataset.indice), el.checked);
  if (el.dataset?.regla) leerFormularioConfig();
});

pintarEstructura();
renderizar();
