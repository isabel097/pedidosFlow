// Chat guiado estilo WhatsApp: crear, modificar y consultar pedidos contra la API real.
import { $, api, entregaLarga, esc, horaActual, personas } from './util.js';

const HORAS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];
const CANTIDADES = ['10', '20', '25', '30'];

const C = { msgs: [], fase: 'menu', d: {}, ultimo: null, catalogo: [], raiz: null, ir: () => {}, sesionRecuperada: false, avisoRecuperacion: false, esperandoDecision: [] };
const CLAVE_SESION = 'pedidosflow-chat-v2';
let temporizadorDecisiones = null;
let consultaDecisionesActiva = false;

const hoy = () => {
  const f = new Date();
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
};

function guardarSesionChat() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    // No se guardan imágenes base64 en el navegador; el archivo real queda en el pedido del servidor.
    const mensajes = C.msgs.slice(-120).map(m => ({
      de: m.de,
      texto: m.texto,
      hora: m.hora,
      ...(m.nav ? { nav: m.nav } : {}),
      ...(m.foto ? { imagenEnviada: true } : {})
    }));
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ mensajes, ultimo: C.ultimo, esperandoDecision: C.esperandoDecision }));
  } catch {
    // El chat debe seguir funcionando aunque el navegador bloquee el almacenamiento de sesión.
  }
}

function restaurarSesionChat() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const dato = JSON.parse(sessionStorage.getItem(CLAVE_SESION) || 'null');
    if (!dato || !Array.isArray(dato.mensajes)) return;
    C.msgs = dato.mensajes.filter(m => m && ['bot', 'yo'].includes(m.de) && typeof m.texto === 'string');
    C.ultimo = dato.ultimo == null ? null : String(dato.ultimo);
    C.esperandoDecision = Array.isArray(dato.esperandoDecision) ? dato.esperandoDecision.filter(x => x && typeof x.id === 'string' && x.pedidoId != null) : [];
    C.sesionRecuperada = C.msgs.length > 0;
    C.fase = 'menu';
    C.d = {};
  } catch {
    // Una sesión local inválida se ignora; los pedidos del servidor no se ven afectados.
  }
}

function bot(texto, extra = {}) {
  C.msgs.push({ de: 'bot', texto, hora: horaActual(), ...extra });
  if (C.msgs.length > 120) C.msgs.splice(0, C.msgs.length - 120);
  guardarSesionChat();
}

function yo(texto, extra = {}) {
  C.msgs.push({ de: 'yo', texto, hora: horaActual(), ...extra });
  if (C.msgs.length > 120) C.msgs.splice(0, C.msgs.length - 120);
  guardarSesionChat();
}

restaurarSesionChat();

function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
}

function detectarCampo(texto) {
  const n = normalizar(texto);
  if (/\b(cantidad|personas|porcion|porciones|tamano)\b/.test(n)) return 'Cantidad';
  if (/\b(diseno|decoracion|estilo|foto|imagen)\b/.test(n)) return 'Diseño';
  if (/\b(fecha|entrega|dia|reprogramar|adelantar|atrasar|hora)\b/.test(n)) return 'Fecha de entrega';
  if (n === 'cantidad' || n === 'diseno' || n === 'fecha de entrega') {
    return n === 'diseno' ? 'Diseño' : n === 'cantidad' ? 'Cantidad' : 'Fecha de entrega';
  }
  return null;
}

function extraerIdPedido(texto) {
  const t = String(texto ?? '');
  const conNumeral = t.match(/#\s*(\d{2,})/);
  if (conNumeral) return conNumeral[1];
  const asociado = t.match(/\bpedido\s*(?:numero|nro|n[uú]m)?\s*[:#-]?\s*(\d{2,})\b/i);
  if (asociado) return asociado[1];
  return null;
}

function fechaISO(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function interpretarFecha(texto) {
  const n = normalizar(texto);
  if (!n) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(n)) return n;
  const isoDentroDeFrase = n.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoDentroDeFrase) return isoDentroDeFrase[1];

  const relativa = new Date();
  const esSolicitudDeCambio = /\b(cambiar|cambia|cambiarle|cambiale|modificar|modifica|reprogramar|reprograma|mover|adelantar|atrasar)\b/.test(n);
  relativa.setHours(0, 0, 0, 0);
  // Reconocer fechas relativas también dentro de una frase completa como
  // «cambia la entrega del pedido #154 para mañana».
  if (/\banteayer\b/.test(n)) { relativa.setDate(relativa.getDate() - 2); return fechaISO(relativa); }
  if (/\bayer\b/.test(n)) { relativa.setDate(relativa.getDate() - 1); return fechaISO(relativa); }
  if (/\bpasado manana\b/.test(n)) { relativa.setDate(relativa.getDate() + 2); return fechaISO(relativa); }
  if (/\bhoy\b/.test(n)) return fechaISO(relativa);
  if (/\bmanana\b/.test(n)) { relativa.setDate(relativa.getDate() + 1); return fechaISO(relativa); }

  const numerica = n.match(/\b(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?\b/);
  if (numerica) {
    const dia = Number(numerica[1]);
    const mes = Number(numerica[2]);
    let anio = numerica[3] ? Number(numerica[3]) : new Date().getFullYear();
    if (anio < 100) anio += 2000;
    let fecha = new Date(anio, mes - 1, dia);
    if (!numerica[3] && fecha < relativa && !esSolicitudDeCambio) {
      anio += 1;
      fecha = new Date(anio, mes - 1, dia);
    }
    if (fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia) return fechaISO(fecha);
    return null;
  }

  const meses = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9,
    noviembre: 10, diciembre: 11
  };
  const verbal = n.match(/\b(\d{1,2})\s*(?:de\s*)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s*(?:de\s*)?(\d{4}))?\b/);
  if (verbal) {
    const dia = Number(verbal[1]);
    const mes = meses[verbal[2]];
    let anio = verbal[3] ? Number(verbal[3]) : relativa.getFullYear();
    let fecha = new Date(anio, mes, dia);
    if (!verbal[3] && fecha < relativa && !esSolicitudDeCambio) { anio += 1; fecha = new Date(anio, mes, dia); }
    if (fecha.getFullYear() === anio && fecha.getMonth() === mes && fecha.getDate() === dia) return fechaISO(fecha);
    return null;
  }

  const dias = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
  const nombreDia = Object.keys(dias).find(d => new RegExp(`\\b${d}\\b`).test(n));
  if (nombreDia) {
    const fecha = new Date(relativa);
    if (/pasado|anterior|ultima|ultimo/.test(n)) {
      let retroceso = (fecha.getDay() - dias[nombreDia] + 7) % 7;
      if (retroceso === 0) retroceso = 7;
      fecha.setDate(fecha.getDate() - retroceso);
    } else {
      let incremento = (dias[nombreDia] - fecha.getDay() + 7) % 7;
      if (incremento === 0 || /proximo|siguiente|que viene/.test(n)) incremento = incremento || 7;
      fecha.setDate(fecha.getDate() + incremento);
    }
    return fechaISO(fecha);
  }
  return null;
}

function interpretarHora(texto) {
  // Mantener los dos puntos durante el primer parseo: normalizar() los elimina para texto general.
  const original = String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  let m = original.match(/\b(\d{1,2}):(\d{2})(?:\s*(am|pm))?\b/);
  if (m) {
    let h = Number(m[1]);
    const min = Number(m[2]);
    const sufijo = m[3];
    if (sufijo === 'pm' && h < 12) h += 12;
    if (sufijo === 'am' && h === 12) h = 0;
    if (h <= 23 && min <= 59) return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  const n = normalizar(texto);
  m = n.match(/\b(?:a las?\s*)?(\d{1,2})(?:\s*(am|pm|de la manana|de la tarde|de la noche))\b/);
  if (m) {
    let h = Number(m[1]);
    const sufijo = m[2];
    if ((sufijo === 'pm' || sufijo.includes('tarde') || sufijo.includes('noche')) && h < 12) h += 12;
    if ((sufijo === 'am' || sufijo.includes('manana')) && h === 12) h = 0;
    if (h >= 0 && h <= 23) return `${String(h).padStart(2, '0')}:00`;
  }
  return null;
}

function normalizarRespuesta(valor, fase = C.fase) {
  const original = String(valor ?? '').trim();
  const n = normalizar(original);
  if (['n-fecha', 'm-fecha'].includes(fase)) return interpretarFecha(original) ?? original;
  if (['n-hora', 'm-hora'].includes(fase)) return interpretarHora(original) ?? original;
  if (['n-cantidad', 'n-cantidad-otra', 'm-cantidad'].includes(fase)) {
    if (/\botra\b/.test(n)) return 'otra';
    const match = original.match(/\b(\d{1,3})\b/);
    if (match) return match[1];
  }
  if (fase === 'mis-lista') {
    const id = extraerIdPedido(original);
    if (id) return `ver:${id}`;
  }
  return original;
}

function resolverEstilo(texto, excluir = null) {
  const original = String(texto ?? '').trim();
  const n = normalizar(original.replace(/^estilo:/i, ''));
  return C.catalogo.find(e => e.id === original.replace(/^estilo:/i, '') && e.id !== excluir)
    ?? C.catalogo.find(e => e.id !== excluir && normalizar(e.nombre) === n)
    ?? C.catalogo.find(e => e.id !== excluir && (n.includes(normalizar(e.nombre)) || normalizar(e.nombre).includes(n) && n.length > 2));
}

function esAfirmativo(texto) {
  return /\b(si|claro|dale|listo|correcto|de acuerdo|confirmo|confirmar|ok|okay|acepto|hazlo)\b/.test(normalizar(texto));
}

function esNegativo(texto) {
  const n = normalizar(texto);
  // La negación tiene prioridad sobre palabras como «confirmar» dentro de la misma frase.
  return /^(?:no\b.*|mejor no\b.*|por ahora no\b.*|cancelar(?:lo| pedido)?|cancelalo|rechazar)$/.test(n)
    || /\b(?:no quiero confirmar|no lo registres|no lo guardes|no confirmes|no quiero guardarlo|no crear el pedido|no lo crees)\b/.test(n);
}

function registrarDecisionPendiente(cambio) {
  if (!cambio?.id || C.esperandoDecision.some(x => x.id === cambio.id)) return;
  C.esperandoDecision.push({ id: cambio.id, pedidoId: String(cambio.pedidoId), campo: cambio.campo, origen: cambio.origen });
  guardarSesionChat();
}

async function revisarDecisionesDelEncargado() {
  if (consultaDecisionesActiva || !C.esperandoDecision.length || !C.raiz?.querySelector('#chatMensajes')) return;
  consultaDecisionesActiva = true;
  try {
    const cambios = await api('/api/cambios');
    const enEspera = [];
    let huboMensajes = false;
    for (const seguimiento of C.esperandoDecision) {
      const cambio = cambios.find(c => c.id === seguimiento.id);
      if (!cambio || !cambio.decisionManual) {
        enEspera.push(seguimiento);
        continue;
      }
      let pedido;
      try { pedido = await api(`/api/pedidos/${seguimiento.pedidoId}`); }
      catch { enEspera.push(seguimiento); continue; }

      const aprobado = cambio.decisionManual === 'aprobado';
      if (cambio.origen === 'nuevo-pedido') {
        bot(aprobado
          ? `¡Buenas noticias! El encargado revisó tu pedido #${pedido.id} y aprobó el diseño personalizado. El pedido queda confirmado.\n\n${resumenPedido(pedido)}`
          : `El encargado revisó el diseño personalizado de tu pedido #${pedido.id} y determinó que no es viable. El pedido fue cancelado. Si lo deseas, puedes registrar uno nuevo con un diseño del catálogo.\n\n${resumenPedido(pedido)}`);
      } else {
        bot(aprobado
          ? `El encargado revisó tu solicitud de ${String(cambio.campo).toLowerCase()} para el pedido #${pedido.id} y la aprobó. El cambio ya está guardado.\n\n${resumenPedido(pedido)}`
          : `El encargado revisó tu solicitud de ${String(cambio.campo).toLowerCase()} para el pedido #${pedido.id} y confirmó que no se puede aprobar. No se aplicó el cambio y se conservan los datos anteriores.\n\n${resumenPedido(pedido)}`);
      }
      C.ultimo = pedido.id;
      huboMensajes = true;
    }
    C.esperandoDecision = enEspera;
    guardarSesionChat();
    if (huboMensajes) pintar();
  } catch {
    // Un fallo temporal de red no elimina las revisiones; se reintenta en la próxima consulta.
  } finally {
    consultaDecisionesActiva = false;
  }
}

function vigilarDecisionesDelEncargado() {
  if (temporizadorDecisiones !== null || typeof window === 'undefined') return;
  temporizadorDecisiones = window.setInterval(() => { void revisarDecisionesDelEncargado(); }, 2500);
}

export async function montarChat(raiz, ir) {
  C.raiz = raiz;
  C.ir = ir;
  vigilarDecisionesDelEncargado();
  if (!C.catalogo.length) C.catalogo = (await api('/api/configuracion')).catalogo;
  if (!C.msgs.length) irAlMenu(false);
  else if (C.sesionRecuperada && !C.avisoRecuperacion) {
    bot('Conservé los mensajes de esta pestaña. Para continuar, dime qué necesitas hacer o elige una opción.');
    C.avisoRecuperacion = true;
  }
  pintar();
}

function irAlMenu(pintarAhora = true) {
  C.fase = 'menu';
  C.d = {};
  if (!C.msgs.length) bot('Hola. Soy el asistente de PedidosFlow.\n\n¿En qué puedo ayudarte hoy?');
  else bot('¿En qué más puedo ayudarte?');
  if (pintarAhora) pintar();
}

// ─── Pintado ──────────────────────────────────────────────────────────────────
const BOTON_OPCION = 'border border-[#128C7E]/40 text-[#128C7E] bg-white hover:bg-[#128C7E] hover:text-white font-medium px-2 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap';
const BOTON_CUADRO = 'border border-[#128C7E]/40 text-[#128C7E] hover:bg-[#128C7E] hover:text-white font-medium py-2 rounded-xl text-sm transition-colors';
const BOTON_PRIMARIO = 'w-full bg-[#128C7E] hover:bg-[#0e6b5e] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors';
const CAMPO = 'w-full border border-[#128C7E]/40 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#128C7E]/30';

const opciones = lista => lista.map(([texto, valor]) => `<button type="button" data-op="${esc(valor)}" class="${BOTON_OPCION}">${esc(texto)}</button>`).join('');

function opcionesRapidas() {
  const f = C.fase;
  const estilos = excluir => [...C.catalogo.filter(e => e.id !== excluir).map(e => [e.nombre, 'estilo:' + e.id]), ['Diseño personalizado (foto)', 'personalizado']];
  if (f === 'menu') return opciones([['Nuevo pedido', 'nuevo'], ['Modificar pedido', 'modificar'], ['Consultar pedido', 'consultar'], ['Mis pedidos', 'mis']]);
  if (f === 'mis-lista') return opciones((C.d.lista || []).map(p => [`#${p.id} · ${personas(p.cantidad)} · ${p.estado}`, 'ver:' + p.id]));
  if (f === 'n-cantidad') return opciones([...CANTIDADES.map(c => [c + ' personas', c]), ['Otra cantidad', 'otra']]);
  if (f === 'n-diseno') return opciones(estilos(null));
  if (f === 'm-diseno') return opciones(estilos(C.d.pedido?.disenoTipo === 'catalogo' ? C.d.pedido.diseno : null));
  if (f === 'n-hora') return opciones(HORAS.map(h => [h, h]));
  if (f === 'n-resumen') return opciones([['Confirmar pedido', 'confirmar'], ['Modificar pedido', 'reiniciar'], ['Cancelar pedido', 'cancelar-pedido']]);
  if (f === 'm-pedido' || f === 'c-pedido') return C.ultimo ? opciones([[`Usar pedido #${C.ultimo}`, 'usar:' + C.ultimo]]) : '';
  if (f === 'm-que') return opciones([['Cambiar cantidad', 'Cantidad'], ['Cambiar diseño', 'Diseño'], ['Cambiar fecha de entrega', 'Fecha de entrega']]);
  if (f === 'despues-m') return opciones([['Modificar otro dato de este pedido', 'otro-dato']]);
  if (f === 'despues-c') return opciones([['Modificar este pedido', 'modificar-este']]);
  return '';
}

function formularioLibre() {
  return `<form data-form-libre class="flex items-center gap-2 pt-2"><input id="chatLibre" placeholder="Escribe un mensaje..." autocomplete="off" class="${CAMPO} flex-1 min-w-0"><button type="submit" aria-label="Enviar mensaje" title="Enviar" class="bg-[#128C7E] hover:bg-[#0e6b5e] text-white rounded-xl px-3 py-2.5 font-semibold">➤</button></form>`;
}

function entrada() {
  const f = C.fase;
  const texto = (placeholder, modo = 'text') =>
    `<form data-form class="space-y-2"><input id="chatTexto" autofocus inputmode="${modo}" placeholder="${placeholder}" class="${CAMPO}"><button type="submit" class="${BOTON_PRIMARIO}">Continuar</button></form>`;
  const fecha = `<form data-form class="space-y-2"><input id="chatFecha" type="date" ${f === 'n-fecha' ? `min="${hoy()}"` : ''} class="${CAMPO}"><button type="submit" class="${BOTON_PRIMARIO}">Continuar</button></form>`;
  const foto = `<label class="block w-full border border-[#128C7E]/40 text-[#128C7E] hover:bg-slate-50 font-medium py-2 rounded-lg text-xs transition-colors text-center cursor-pointer">Adjuntar foto de referencia<input id="chatFoto" type="file" accept="image/*" class="hidden"></label>`;

  // Los botones quedan en el bloque de menú, separado visualmente del área de escritura.
  if (['menu', 'mis-lista', 'n-cantidad', 'n-diseno', 'm-diseno', 'n-hora', 'n-resumen', 'm-que', 'despues-m', 'despues-c'].includes(f)) return formularioLibre();
  if (f === 'n-nombre') return texto('Tu nombre completo');
  if (f === 'n-tel' || f === 'mis-tel') return texto('Ej. +57 300 123 4567', 'tel');
  if (f === 'n-cantidad-otra' || f === 'm-cantidad') return texto('Número de personas', 'numeric');
  if (f === 'n-foto' || f === 'm-foto') return `${foto}${formularioLibre()}`;
  if (f === 'n-fecha' || f === 'm-fecha') return `${fecha}${formularioLibre()}`;
  if (f === 'm-hora') return formularioLibre();
  if (f === 'm-pedido') return texto('Número de pedido, ej. 154', 'numeric');
  if (f === 'c-pedido') return texto('Número de pedido, ej. 154', 'numeric');
  return formularioLibre();
}

function pintar() {
  if (!C.raiz) return;
  const conMenu = C.fase !== 'menu';
  C.raiz.innerHTML = `
  <div class="flex-1 flex items-start justify-center py-6 bg-slate-100 overflow-y-auto custom-scroll">
    <div class="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-300 flex flex-col" style="min-height:600px;max-height:calc(100vh - 120px)">
      <div class="bg-[#128C7E] px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <div class="w-9 h-9 rounded-full bg-[#0e6b5e] flex items-center justify-center text-white font-bold text-xs font-mono-data border border-white/20">PF</div>
        <div class="flex-1">
          <div class="text-white font-semibold text-sm">PedidosFlow</div>
          <div class="text-white/60 text-xs">asistente de pedidos</div>
        </div>
        ${conMenu ? '<button data-op="menu" class="text-white/70 hover:text-white text-xs border border-white/30 px-2 py-1 rounded-lg transition-colors">Menu</button>' : ''}
      </div>
      <div id="chatMensajes" class="wa-bg flex flex-col p-3 gap-2 overflow-y-auto custom-scroll flex-1">
        ${C.msgs.map(m => `
        <div class="flex ${m.de === 'yo' ? 'justify-end' : 'justify-start'} animate-slide-in">
          <div class="max-w-[82%] rounded-2xl px-3 py-2 shadow-sm ${m.de === 'yo' ? 'bg-[#DCF8C6] rounded-tr-sm' : 'bg-white rounded-tl-sm'}">
            ${m.foto ? `<img src="${esc(m.foto)}" alt="Foto de referencia" class="rounded-lg mb-1 border border-slate-200 bg-slate-100" style="width:160px;height:160px;object-fit:cover">` : m.imagenEnviada ? '<span class="block text-xs text-slate-500 mb-1">Imagen adjunta en la conversación anterior</span>' : ''}
            <p class="text-slate-800 whitespace-pre-wrap leading-relaxed" style="font-size:13px">${esc(m.texto)}</p>
            <div class="text-right mt-1"><span class="text-slate-400" style="font-size:10px">${m.hora}${m.de === 'yo' ? ' ✓✓' : ''}</span></div>
            ${m.nav ? `<button data-nav="${esc(JSON.stringify(m.nav.destino))}" class="mt-2 w-full bg-[#128C7E] hover:bg-[#0e6b5e] text-white font-semibold py-2 rounded-xl text-xs transition-colors">${esc(m.nav.etiqueta)}</button>` : ''}
          </div>
        </div>`).join('')}
      </div>
      <div id="chatOpciones" class="bg-slate-50 border-t border-[#128C7E]/40 px-3 py-2 flex-shrink-0">
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <span class="text-xs font-bold uppercase tracking-wide text-slate-500">Menú de opciones</span>
          <span class="text-xs text-slate-400">O elige escribir abajo</span>
        </div>
        <div class="flex flex-wrap items-center gap-1.5 overflow-y-auto custom-scroll" style="max-height:6rem">
          ${opcionesRapidas()}
          ${conMenu ? '<button type="button" data-op="menu" class="border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium px-2 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap">← Volver al menú</button>' : ''}
        </div>
      </div>
      <div class="bg-white border-t border-slate-200 p-3 space-y-2 flex-shrink-0">
        <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Escribe tu mensaje</div>
        ${entrada()}
      </div>
    </div>
  </div>`;
  const caja = $('#chatMensajes', C.raiz);
  if (caja) caja.scrollTop = caja.scrollHeight;
  ($('#chatTexto', C.raiz) || $('#chatLibre', C.raiz))?.focus();

  C.raiz.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', () => responder(b.dataset.op)));
  C.raiz.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => C.ir(JSON.parse(b.dataset.nav))));
  C.raiz.querySelector('[data-form]')?.addEventListener('submit', e => {
    e.preventDefault();
    const valor = ($('#chatTexto', C.raiz) || $('#chatFecha', C.raiz))?.value.trim() ?? '';
    if (valor) responder(normalizarRespuesta(valor));
  });
  C.raiz.querySelector('[data-form-libre]')?.addEventListener('submit', e => {
    e.preventDefault();
    const campo = $('#chatLibre', C.raiz);
    const valor = campo?.value.trim() ?? '';
    if (!valor) return;
    responder(normalizarRespuesta(valor));
  });
  $('#chatFoto', C.raiz)?.addEventListener('change', e => procesarFoto(e.target.files?.[0]));
}

// ─── Fotos ────────────────────────────────────────────────────────────────────
function reducirImagen(archivo, lado = 800) {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error('No se pudo leer la imagen.'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => rechazar(new Error('El archivo no es una imagen válida.'));
      img.onload = () => {
        const escala = Math.min(1, lado / Math.max(img.width, img.height));
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.round(img.width * escala);
        lienzo.height = Math.round(img.height * escala);
        lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
        resolver(lienzo.toDataURL('image/jpeg', 0.8));
      };
      img.src = String(lector.result);
    };
    lector.readAsDataURL(archivo);
  });
}

async function procesarFoto(archivo) {
  if (!archivo) return;
  try {
    if (!archivo.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen.');
    const url = await reducirImagen(archivo);
    yo('Foto de referencia enviada', { foto: url });
    C.d.fotoUrl = url;
    C.d.tipo = 'personalizado';
    if (C.fase === 'n-foto') return preguntarFecha('n');
    return enviarCambio({ campo: 'Diseño', tipo: 'personalizado', fotoUrl: url });
  } catch (e) {
    bot(e.message + ' Intenta con otra imagen.');
    pintar();
  }
}

// ─── Flujo conversacional ─────────────────────────────────────────────────────
function preguntarFecha(prefijo) {
  bot(prefijo === 'n' ? '¿Para qué fecha necesitas el pedido?' : '¿Para qué nueva fecha de entrega?');
  C.fase = prefijo + '-fecha';
  pintar();
}

const soloNumero = texto => (String(texto).match(/\d+/) || [null])[0];

function resumenPedido(p) {
  return `#${p.id} · ${p.producto}\nCliente: ${p.cliente}\nCantidad actual: ${personas(p.cantidad)}\nDiseño: ${p.disenoNombre}\nEntrega: ${entregaLarga(p)}\nEstado: ${p.estado}`;
}

function pedirCampoCambio(campo) {
  if (campo === 'Cantidad') {
    bot('Claro. ¿Para cuántas personas necesitas ahora la torta? Puedes escribir, por ejemplo, “30 personas”.');
    C.fase = 'm-cantidad';
    return pintar();
  }
  if (campo === 'Diseño') {
    bot('¿Qué diseño te gustaría usar? Puedes elegir una opción del catálogo o escribir una descripción propia. Los diseños fuera del catálogo pasan a revisión del encargado.');
    C.fase = 'm-diseno';
    return pintar();
  }
  if (campo === 'Fecha de entrega') return preguntarFecha('m');
  bot('¿Qué deseas modificar: la cantidad, el diseño o la fecha de entrega?');
  C.fase = 'm-que';
  return pintar();
}

async function cargarPedidoDesdeTexto(id, campo = null, consultar = false) {
  try {
    const p = await api('/api/pedidos/' + id);
    C.ultimo = p.id;
    C.d.pedido = p;
    bot(`Encontré el pedido.\n\n${resumenPedido(p).replace('Cantidad actual', 'Cantidad')}`);
    if (consultar) C.fase = 'despues-c';
    else if (p.estado === 'Cancelado') {
      bot(`El pedido #${p.id} está cancelado y no admite cambios.`);
      C.fase = 'menu';
    } else if (campo) {
      pedirCampoCambio(campo);
      return;
    } else {
      bot('¿Qué dato necesitas cambiar? Puedes decirme “cantidad”, “diseño” o “fecha de entrega”.');
      C.fase = 'm-que';
    }
  } catch (e) {
    bot(e.estado === 404 ? `No encontramos el pedido #${id}. Verifica el número e intenta de nuevo.` : e.message);
    C.fase = consultar ? 'c-pedido' : 'm-pedido';
  }
  pintar();
}

function extraerDescripcionLibreDiseno(texto) {
  let descripcion = String(texto ?? '').trim();
  descripcion = descripcion
    .replace(/pedido\s*(?:(?:n[uú]mero|nro)\s*)?#?\s*\d{2,}/ig, ' ')
    .replace(/#\s*\d{2,}/g, ' ')
    .replace(/\b(?:quiero|quisiera|me gustar[ií]a|necesito|por favor|puedes|podr[ií]as|ay[uú]dame a)\b/ig, ' ')
    .replace(/\b(?:cambiar|cambia|c[aá]mbiale|cambiarle|modificar|modifica|actualizar|reprogramar|mover|adelantar|atrasar)\b/ig, ' ')
    .replace(/\b(?:el|la|un|una|mi|del|pedido|dise[nñ]o|decoraci[oó]n|estilo)\b/ig, ' ')
    .replace(/^\s*(?:a|por|para|con|como|de|que sea)\s+/i, ' ')
    .replace(/[.,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return descripcion;
}

function crearCambioDesdeFrase(texto, campo, pedido) {
  const original = String(texto ?? '').trim();
  if (campo === 'Cantidad') {
    const sinId = original
      .replace(/pedido\s*(?:(?:n[uú]mero|nro)\s*)?#?\s*\d{2,}/ig, ' ')
      .replace(/#\s*\d{2,}/g, ' ');
    const conUnidad = [...sinId.matchAll(/\b(\d{1,3})\s*(?:personas|porciones|raciones|comensales)\b/ig)];
    let m = conUnidad.at(-1);
    if (!m) {
      // Toma el último valor que acompaña una expresión de destino. Esto permite
      // frases como «sube de 20 a 30», sin confundir el valor anterior con el nuevo.
      const destinos = [...sinId.matchAll(/\b(?:a|para|en|por|cantidad(?:\s+de)?|dejar(?:lo)?\s+en|que(?:dar|dejar)(?:lo)?\s+en|subir(?:lo)?\s+a|bajar(?:lo)?\s+a|aumentar(?:lo)?\s+a|reducir(?:lo)?\s+a)\s+(\d{1,3})\b/ig)];
      m = destinos.at(-1);
    }
    if (!m) return null;
    return { campo: 'Cantidad', valorNuevo: Number(m[1]) };
  }

  if (campo === 'Fecha de entrega') {
    const fecha = interpretarFecha(original);
    if (!fecha) return null;
    const hora = interpretarHora(original);
    return { campo: 'Fecha de entrega', valorNuevo: fecha, ...(hora ? { hora } : {}) };
  }

  if (campo === 'Diseño') {
    const estilo = resolverEstilo(original);
    if (estilo) return { campo: 'Diseño', tipo: 'catalogo', estiloId: estilo.id };
    const descripcionDiseno = extraerDescripcionLibreDiseno(original);
    if (descripcionDiseno.length >= 4) return { campo: 'Diseño', tipo: 'personalizado', descripcionDiseno };
  }
  return null;
}

async function procesarCambioNatural(id, campo, textoOriginal, yaEscrito = false) {
  try {
    const p = await api('/api/pedidos/' + id);
    C.ultimo = p.id;
    C.d.pedido = p;
    if (p.estado === 'Cancelado') {
      bot(`El pedido #${p.id} está cancelado y no admite cambios.`);
      C.fase = 'menu';
      return pintar();
    }
    const cuerpo = crearCambioDesdeFrase(textoOriginal, campo, p);
    if (cuerpo) {
      if (!yaEscrito) yo(textoOriginal);
      return enviarCambio(cuerpo);
    }
    if (!yaEscrito) yo(textoOriginal);
    bot(`Encontré el pedido #${p.id}.\n\n${resumenPedido(p)}`);
    return pedirCampoCambio(campo);
  } catch (e) {
    if (!yaEscrito) yo(textoOriginal);
    bot(e.estado === 404 ? `No encontramos el pedido #${id}. Verifica el número e intenta de nuevo.` : e.message);
    C.fase = 'm-pedido';
    pintar();
  }
}

async function manejarTextoMenu(texto) {
  const n = normalizar(texto);
  const id = extraerIdPedido(texto);
  const campo = detectarCampo(texto);
  yo(texto);

  if (/^(hola|buenos dias|buenas tardes|buenas noches|buenas|hey|que tal)$/.test(n)) {
    bot('¡Hola! Soy el asistente de PedidosFlow. Puedo ayudarte a crear una torta, consultar un pedido o gestionar un cambio. También puedes escribirlo con tus propias palabras.');
    return pintar();
  }

  const quiereModificar = /\b(cambiar|modificar|editar|actualizar|reprogramar|mover|adelantar|atrasar|cambio|cambiarle|cambiale)\b/.test(n);
  if (quiereModificar) {
    C.d = { ...(campo ? { campoSolicitado: campo } : {}), solicitudOriginal: texto };
    if (id && campo) return procesarCambioNatural(id, campo, texto, true);
    if (id) return cargarPedidoDesdeTexto(id, campo, false);
    bot('Claro, te ayudo con el cambio. ¿Cuál es el número del pedido? Puedes escribirlo como #154. No necesitas empezar de nuevo: conservaré esta solicitud para intentar usar el valor que ya escribiste.');
    C.fase = 'm-pedido';
    return pintar();
  }

  if (/\b(mis pedidos|mis encargos|pedidos que hice|mis compras)\b/.test(n)) {
    bot('Para encontrar tus pedidos, escribe el teléfono que usaste al registrarte.');
    C.fase = 'mis-tel';
    return pintar();
  }

  const quiereCrear = /\b(nuevo pedido|pedido nuevo|hacer un pedido|crear un pedido|encargar|encargar una torta|quiero una torta|necesito una torta|hacer una torta)\b/.test(n);
  if (quiereCrear) {
    C.d = {};
    bot('Con gusto. Vamos a registrar tu pedido paso a paso. ¿Cuál es tu nombre completo?');
    C.fase = 'n-nombre';
    return pintar();
  }

  const quiereConsultar = /\b(consultar|consulta|ver|mostrar|estado|detalle|seguimiento|como va|como esta|donde va|pedido)\b/.test(n);
  if (id && quiereConsultar) return cargarPedidoDesdeTexto(id, null, true);
  if (id) return cargarPedidoDesdeTexto(id, null, true);
  if (quiereConsultar) {
    bot('¿Qué número de pedido quieres consultar? Por ejemplo, #154.');
    C.fase = 'c-pedido';
    return pintar();
  }

  if (/\b(ayuda|que puedes hacer|opciones|menu|empezar|inicio)\b/.test(n)) {
    bot('Puedo registrar una torta nueva, buscar tus pedidos, consultar un pedido por su número o ayudarte a cambiar cantidad, diseño y fecha. Por ejemplo: “quiero cambiar la fecha del pedido #154”.');
    return pintar();
  }

  bot('No alcancé a entender la solicitud. Puedes escribir algo como “quiero consultar el pedido #154”, “cambiar la cantidad del pedido #154” o “hacer un pedido nuevo”.');
  return pintar();
}

async function buscarPedido(texto, siguiente) {
  const numero = soloNumero(texto);
  yo(texto.startsWith('usar:') ? `Pedido #${texto.slice(5)}` : texto);
  if (!numero) {
    bot('Escribe solo el número del pedido, por ejemplo 154 o #154.');
    return pintar();
  }
  try {
    const p = await api('/api/pedidos/' + numero);
    C.ultimo = p.id;
    C.d.pedido = p;
    await siguiente(p);
  } catch (e) {
    bot(e.estado === 404 ? `No encontramos el pedido #${numero}. Verifica el número e intenta de nuevo.` : e.message);
    pintar();
  }
}

async function enviarCambio(cuerpo) {
  const p = C.d.pedido;
  bot('Recibí tu solicitud de cambio.\nVoy a verificar si todavía es posible modificar tu pedido.');
  pintar();
  try {
    const r = await api(`/api/pedidos/${p.id}/cambios`, { method: 'POST', cuerpo });
    const c = r.cambio;
    // Leer de nuevo el pedido desde el servidor evita dar por hecho que la actualización
    // ocurrió solo porque el endpoint respondió: el mensaje muestra el estado persistido.
    let pedidoActual = r.pedido;
    try { pedidoActual = await api(`/api/pedidos/${p.id}`); } catch { /* se conserva la respuesta de la operación */ }
    const detalle = `Pedido #${p.id}\n${c.campo}: ${c.detalleAnterior} → ${c.detalleNuevo}\n\n${c.motivo}`;
    const estadoActual = `\n\nDatos actuales consultados al servidor:\n${resumenPedido(pedidoActual)}`;
    if (r.evaluacion.resultado === 'aplicado') {
      bot(`Cambio aprobado automáticamente y guardado.\n\n${detalle}${estadoActual}`, { nav: { etiqueta: '→ Ver pedido actualizado', destino: { tipo: 'pedido', id: p.id } } });
    } else if (r.evaluacion.resultado === 'pendiente-revision' || r.evaluacion.resultado === 'rechazado') {
      registrarDecisionPendiente(c);
      const motivoPendiente = r.evaluacion.resultado === 'rechazado'
        ? 'El sistema no puede aprobar este cambio automáticamente y lo envió a revisión del encargado.'
        : 'Tu solicitud quedó pendiente de revisión del encargado.';
      bot(`${motivoPendiente} El pedido no cambia hasta que el encargado tome una decisión. Te avisaré en este chat cuando la solicitud sea aprobada o rechazada.\n\n${detalle}${estadoActual}`, { nav: { etiqueta: '→ Ver cambios pendientes', destino: { tipo: 'cambios' } } });
    } else {
      bot(`El sistema no aplicó el cambio.\n\n${detalle}${estadoActual}`);
    }
    C.d.pedido = pedidoActual;
    C.fase = 'despues-m';
  } catch (e) {
    bot(e.message + (e.estado === 400 ? '\n\nIntenta de nuevo.' : ''));
    if (e.estado !== 400) C.fase = 'menu';
  }
  pintar();
}

async function crearPedido() {
  const d = C.d;
  try {
    const p = await api('/api/pedidos', {
      method: 'POST',
      cuerpo: { cliente: d.cliente, telefono: d.telefono, cantidad: d.cantidad, fechaEntrega: d.fecha, horaEntrega: d.hora, tipo: d.tipo, estiloId: d.estiloId, fotoUrl: d.fotoUrl, descripcionDiseno: d.descripcionDiseno }
    });
    C.ultimo = p.id;
    let cambioRevision = null;
    if (p.estado === 'Pendiente de revisión') {
      try {
        const cambiosPedido = await api(`/api/pedidos/${p.id}/cambios`);
        cambioRevision = cambiosPedido.find(c => c.origen === 'nuevo-pedido');
        if (cambioRevision) registrarDecisionPendiente(cambioRevision);
      } catch { /* el pedido queda guardado; el chat no inventa una decisión */ }
    }
    const revision = p.estado === 'Pendiente de revisión' ? '\n\nEl diseño personalizado queda pendiente de revisión. El encargado debe confirmar su viabilidad antes de iniciar la elaboración. Te avisaré aquí cuando haya una decisión.' : '';
    bot(p.estado === 'Pendiente de revisión' ? `Pedido #${p.id} registrado.${revision}` : `Pedido #${p.id} confirmado y guardado.`, { nav: { etiqueta: '→ Ver pedido en la plataforma', destino: { tipo: 'pedido', id: p.id } } });
    C.fase = 'menu';
    C.d = {};
  } catch (e) {
    bot(`No pude registrar el pedido: ${e.message}`);
    C.fase = 'menu';
  }
  pintar();
}

async function responder(valor) {
  valor = String(valor ?? '').trim();
  const f = C.fase;
  const n = normalizar(valor);
  if (valor === 'menu') { yo('Menú principal'); return irAlMenu(); }

  if (['ayuda', 'help', 'que puedes hacer', 'opciones'].includes(n)) {
    yo(valor);
    bot('Puedo ayudarte a registrar una torta, consultar un pedido, ver tus pedidos o cambiar cantidad, diseño y fecha de entrega. También puedes escribir frases completas, por ejemplo: “cambiar la fecha del pedido #154”.');
    return pintar();
  }
  if (['cancelar', 'salir', 'volver al inicio', 'reiniciar conversacion'].includes(n) && f !== 'menu') {
    yo(valor);
    C.d = {};
    C.fase = 'menu';
    bot('Entendido. No continuaré con esa operación. Volvemos al menú; los pedidos ya guardados no se modifican.');
    return pintar();
  }
  if (f === 'menu' && !['nuevo', 'modificar', 'consultar', 'mis'].includes(valor)) {
    return manejarTextoMenu(valor);
  }

  // Permite corregir la solicitud en medio del diálogo con una frase completa, sin obligar
  // al cliente a volver al menú ni perder los datos que ya proporcionó.
  const idEnFrase = extraerIdPedido(valor);
  const campoEnFrase = detectarCampo(valor);
  if (f !== 'menu' && idEnFrase && campoEnFrase && /\b(cambiar|modificar|editar|actualizar|reprogramar|mover|adelantar|atrasar|cambio|cambiale)\b/.test(n)) {
    yo(valor);
    C.d = {};
    return procesarCambioNatural(idEnFrase, campoEnFrase, valor, true);
  }

  if (f === 'menu') {
    if (valor === 'nuevo') { yo('Nuevo pedido'); C.d = {}; bot('Hola. Te ayudaré a registrar tu pedido.\n\n¿Cuál es tu nombre completo?'); C.fase = 'n-nombre'; }
    if (valor === 'modificar') { yo('Modificar pedido'); C.d = {}; bot('Indícame el número del pedido que deseas modificar. Puedes escribir 154 o #154.'); C.fase = 'm-pedido'; }
    if (valor === 'consultar') { yo('Consultar pedido'); C.d = {}; bot('Escribe el número del pedido que quieres consultar.'); C.fase = 'c-pedido'; }
    if (valor === 'mis') { yo('Mis pedidos'); C.d = {}; bot('Para mostrarte solo tus pedidos, escribe el número de teléfono con el que hiciste el pedido.'); C.fase = 'mis-tel'; }
    return pintar();
  }

  if (f === 'n-nombre') {
    yo(valor);
    if (valor.length < 2) { bot('Escribe tu nombre completo, por favor.'); return pintar(); }
    C.d.cliente = valor;
    bot('¿A qué número de teléfono te contactamos?'); C.fase = 'n-tel'; return pintar();
  }
  if (f === 'n-tel') {
    yo(valor);
    if (!/^\+?[\d\s-]{7,20}$/.test(valor)) { bot('Ese teléfono no parece válido. Escríbelo solo con números, por ejemplo +57 300 123 4567.'); return pintar(); }
    C.d.telefono = valor;
    bot('¿Para cuántas personas es la torta?'); C.fase = 'n-cantidad'; return pintar();
  }
  if (f === 'n-cantidad' || f === 'n-cantidad-otra') {
    if (n === 'otra') { yo('Otra cantidad'); bot('Escribe la cantidad de personas.'); C.fase = 'n-cantidad-otra'; return pintar(); }
    yo(valor);
    const coincidencia = /^\d+$/.test(valor) ? valor : valor.match(/\d+/)?.[0];
    const cantidad = Number(coincidencia);
    if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 500) { bot('La cantidad debe ser un número entero entre 1 y 500.'); C.fase = 'n-cantidad-otra'; return pintar(); }
    C.d.cantidad = cantidad;
    bot('¿Qué diseño deseas? Puedes escribir el nombre del diseño o elegir una opción.'); C.fase = 'n-diseno'; return pintar();
  }
  if (f === 'n-diseno') {
    if (valor === 'personalizado' || /\b(personalizado|foto|imagen propia|mi diseno|fuera del catalogo)\b/.test(n)) {
      yo('Diseño personalizado');
      C.d.tipo = 'personalizado';
      bot('Describe el diseño que tienes en mente o adjunta una foto de referencia. Todo diseño fuera del catálogo quedará pendiente de revisión del encargado.');
      C.fase = 'n-foto'; return pintar();
    }
    const estilo = resolverEstilo(valor);
    if (estilo) {
      yo(estilo.nombre);
      C.d.tipo = 'catalogo'; C.d.estiloId = estilo.id; C.d.nombreDiseno = estilo.nombre;
      return preguntarFecha('n');
    }
    // Un diseño desconocido no se descarta: se registra como propuesta personalizada.
    yo(valor);
    C.d.tipo = 'personalizado'; C.d.descripcionDiseno = valor;
    bot(`Guardaré “${valor}” como diseño personalizado, fuera del catálogo. El encargado deberá confirmar si se puede elaborar.`);
    return preguntarFecha('n');
  }
  if (f === 'n-fecha') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) { yo(valor); bot('No pude reconocer la fecha. Prueba con el selector o escribe “mañana”, “viernes”, “7/11/2026” o “7 de noviembre”.'); return pintar(); }
    yo(valor.split('-').reverse().join('/'));
    if (f === 'n-fecha' && valor < hoy()) { bot('Para un pedido nuevo, la fecha debe ser hoy o futura. Para un pedido ya confirmado, los cambios a fechas pasadas se envían a revisión del encargado.'); return pintar(); }
    C.d.fecha = valor;
    bot('¿A qué hora necesitas la entrega? Puedes elegir una hora o escribir, por ejemplo, “3:30 pm”.'); C.fase = 'n-hora'; return pintar();
  }
  if (f === 'n-hora') {
    if (!/^\d{2}:\d{2}$/.test(valor) || Number(valor.slice(0, 2)) > 23 || Number(valor.slice(3, 5)) > 59) {
      yo(valor); bot('No reconocí esa hora. Escribe la hora en formato HH:MM o elige una de las opciones.'); return pintar();
    }
    yo(valor); C.d.hora = valor;
    const d = C.d;
    const etiquetaDiseno = d.tipo === 'personalizado' ? (d.descripcionDiseno ? `Personalizado: ${d.descripcionDiseno}` : 'Personalizado con foto de referencia') : d.nombreDiseno;
    bot(`Este es el resumen de tu pedido:\n\nTorta personalizada\n${personas(d.cantidad)}\nDiseño: ${etiquetaDiseno}\nEntrega: ${d.fecha.split('-').reverse().join('/')} – ${d.hora}\n\n¿Deseas confirmar este pedido? Responde “sí” para registrarlo o “no” para revisar las opciones.`);
    C.fase = 'n-resumen'; return pintar();
  }
  if (f === 'n-resumen') {
    if (valor === 'reiniciar') { yo('Modificar pedido'); C.d = {}; bot('Empecemos de nuevo.\n\n¿Cuál es tu nombre completo?'); C.fase = 'n-nombre'; return pintar(); }
    if (valor === 'cancelar-pedido') { yo('Cancelar pedido'); C.d = {}; C.fase = 'menu'; bot('De acuerdo. No registré el pedido. ¿Necesitas algo más?'); return pintar(); }
    if (esNegativo(n)) { yo(valor); bot('No he registrado el pedido. Puedes elegir “Modificar pedido” para empezar de nuevo o “Cancelar pedido” para salir sin guardarlo.'); return pintar(); }
    if (valor === 'confirmar' || esAfirmativo(n)) { yo('Confirmar pedido'); return crearPedido(); }
    yo(valor); bot('Antes de guardarlo necesito tu confirmación. Responde “sí” para registrar el pedido, “no” para revisar o selecciona una opción.'); return pintar();
  }

  if (f === 'mis-tel') {
    yo(valor);
    try {
      const lista = await api('/api/pedidos?telefono=' + encodeURIComponent(valor));
      if (!lista.length) { bot('No encontramos pedidos asociados a ese teléfono. Verifica el número e intenta de nuevo.'); return pintar(); }
      C.d.lista = lista;
      bot(`Encontré ${lista.length} pedido${lista.length > 1 ? 's' : ''}. Elige uno para ver su detalle o escribe su número:`);
      C.fase = 'mis-lista';
    } catch (e) { bot(e.message + ' Intenta de nuevo.'); }
    return pintar();
  }
  if (f === 'mis-lista') {
    const id = valor.startsWith('ver:') ? valor.slice(4) : extraerIdPedido(valor);
    if (!id) { yo(valor); bot('Elige uno de los pedidos o escribe su número, por ejemplo #154.'); return pintar(); }
    yo(`Pedido #${id}`);
    try {
      const p = await api('/api/pedidos/' + id);
      C.ultimo = p.id; C.d.pedido = p;
      bot(`Pedido encontrado:\n\n${resumenPedido(p).replace('Cantidad actual', 'Cantidad')}`);
      C.fase = 'despues-c';
    } catch (e) { bot(e.message); }
    return pintar();
  }

  if (f === 'm-pedido') {
    return buscarPedido(valor, async p => {
      if (p.estado === 'Cancelado') { bot(`El pedido #${p.id} está cancelado y no admite cambios.`); C.fase = 'menu'; return pintar(); }
      const campoSolicitado = C.d.campoSolicitado;
      const solicitudOriginal = C.d.solicitudOriginal;
      delete C.d.campoSolicitado;
      delete C.d.solicitudOriginal;
      if (campoSolicitado && solicitudOriginal) {
        const cuerpo = crearCambioDesdeFrase(solicitudOriginal, campoSolicitado, p);
        if (cuerpo) return enviarCambio(cuerpo);
      }
      bot(`Pedido encontrado:\n\n${resumenPedido(p)}`);
      if (campoSolicitado) return pedirCampoCambio(campoSolicitado);
      bot('¿Qué deseas modificar? Puedes escribir la cantidad, la fecha de entrega o describir el diseño nuevo.');
      C.fase = 'm-que'; pintar();
    });
  }
  if (f === 'm-que' || f === 'despues-m') {
    if (f === 'despues-m' && valor === 'otro-dato') {
      yo('Modificar otro dato');
      try {
        const p = await api('/api/pedidos/' + C.d.pedido.id); C.d.pedido = p;
        bot(`Pedido #${p.id} actualizado:\n\n${resumenPedido(p)}\n\n¿Qué deseas modificar?`);
        C.fase = 'm-que'; return pintar();
      } catch (e) { bot(e.message); return pintar(); }
    }
    if (f === 'despues-m') {
      const campo = detectarCampo(valor);
      if (!campo) { yo(valor); bot('Dime qué deseas cambiar: cantidad, diseño o fecha de entrega.'); C.fase = 'm-que'; return pintar(); }
      yo(valor);
      try { C.d.pedido = await api('/api/pedidos/' + C.d.pedido.id); }
      catch (e) { bot(e.message); return pintar(); }
      return pedirCampoCambio(campo);
    }
    const campo = detectarCampo(valor) || (['Cantidad', 'Diseño', 'Fecha de entrega'].includes(valor) ? valor : null);
    if (!campo) { yo(valor); bot('No entendí qué dato quieres cambiar. Puedes escribir “cantidad”, “diseño” o “fecha de entrega”.'); return pintar(); }
    yo(campo === 'Cantidad' ? 'Cambiar cantidad' : campo === 'Diseño' ? 'Cambiar diseño' : 'Cambiar fecha de entrega');
    return pedirCampoCambio(campo);
  }
  if (f === 'm-cantidad') { yo(valor); return enviarCambio({ campo: 'Cantidad', valorNuevo: valor }); }
  if (f === 'm-diseno') {
    if (valor === 'personalizado' || /\b(personalizado|foto|imagen propia|mi diseno|fuera del catalogo)\b/.test(n)) {
      yo('Diseño personalizado'); bot('Describe el diseño nuevo o adjunta una foto de referencia. Se enviará a revisión porque no pertenece al catálogo.'); C.fase = 'm-foto'; return pintar();
    }
    const estilo = resolverEstilo(valor, C.d.pedido?.disenoTipo === 'catalogo' ? C.d.pedido.diseno : null);
    if (estilo) {
      yo(estilo.nombre);
      return enviarCambio({ campo: 'Diseño', tipo: 'catalogo', estiloId: estilo.id });
    }
    yo(valor);
    const descripcionDiseno = extraerDescripcionLibreDiseno(valor);
    if (descripcionDiseno.length < 4) { bot('Escribe una descripción un poco más completa del diseño que deseas o elige una opción del catálogo.'); return pintar(); }
    return enviarCambio({ campo: 'Diseño', tipo: 'personalizado', descripcionDiseno });
  }
  if (f === 'm-fecha') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) { yo(valor); bot('No pude reconocer la fecha. Usa el selector o escribe “mañana”, “viernes”, “7/11/2026” o “7 de noviembre”.'); return pintar(); }
    yo(valor.split('-').reverse().join('/'));
    C.d.fechaNueva = valor;
    bot('¿A qué hora necesitas la entrega? Puedes elegir una hora o escribirla, por ejemplo, “3:30 pm”.'); C.fase = 'm-hora'; return pintar();
  }
  if (f === 'm-hora') {
    if (!/^\d{2}:\d{2}$/.test(valor) || Number(valor.slice(0, 2)) > 23 || Number(valor.slice(3, 5)) > 59) { yo(valor); bot('No reconocí esa hora. Escribe HH:MM o elige una opción.'); return pintar(); }
    yo(valor); return enviarCambio({ campo: 'Fecha de entrega', valorNuevo: C.d.fechaNueva, hora: valor });
  }

  if (f === 'c-pedido') {
    return buscarPedido(valor, async p => {
      bot(`Pedido encontrado:\n\n${resumenPedido(p).replace('Cantidad actual', 'Cantidad')}`);
      C.fase = 'despues-c'; pintar();
    });
  }
  if (f === 'despues-c') {
    const campo = detectarCampo(valor);
    if (campo) {
      yo(valor);
      try { C.d.pedido = await api('/api/pedidos/' + C.d.pedido.id); }
      catch (e) { bot(e.message); return pintar(); }
      return pedirCampoCambio(campo);
    }
    yo('Modificar este pedido');
    bot(`¿Qué deseas modificar del pedido #${C.d.pedido.id}? Puedes decirme cantidad, diseño o fecha de entrega.`);
    C.fase = 'm-que'; return pintar();
  }

  if (f === 'n-foto' || f === 'm-foto') {
    yo(valor);
    if (/\b(no tengo|sin foto|no hay foto)\b/.test(n)) {
      bot('Está bien. Escribe una descripción del diseño (por ejemplo, “un dinosaurio azul con estrellas”) o vuelve al catálogo.');
      C.fase = f === 'n-foto' ? 'n-diseno' : 'm-diseno';
      return pintar();
    }
    const descripcionDiseno = extraerDescripcionLibreDiseno(valor);
    if (descripcionDiseno.length < 4) {
      bot('La descripción es demasiado corta. Cuéntame cómo debe verse el diseño o adjunta una foto de referencia.');
      return pintar();
    }
    C.d.tipo = 'personalizado';
    C.d.descripcionDiseno = descripcionDiseno;
    bot(`Registré la propuesta: “${descripcionDiseno}”. El encargado deberá revisar su viabilidad.`);
    if (f === 'n-foto') return preguntarFecha('n');
    return enviarCambio({ campo: 'Diseño', tipo: 'personalizado', descripcionDiseno });
  }
}
