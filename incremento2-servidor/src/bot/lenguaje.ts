/**
 * Interpretación de mensajes escritos con lenguaje normal (sin IA, solo reglas).
 * Reúne las mismas reglas de fechas y horas que usa el chat web (public/chat.js), pero en TypeScript
 * y con el reloj como parámetro para poder probarlas. Solo extrae datos: la decisión de aceptar o no
 * un cambio la sigue tomando el motor de reglas del servidor.
 */

export function normalizar(texto: string): string {
  return String(texto ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
}

function sinAcentos(texto: string): string {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function fechaISO(f: Date): string {
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
}

const MESES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9,
  noviembre: 10, diciembre: 11
};
const NOMBRES_MES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';
const UNIDADES = 'personas|persona|porciones|porcion|invitados|comensales|gente|raciones';

export function interpretarFecha(texto: string, hoy: Date): string | null {
  const n = normalizar(texto);
  if (!n) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(n)) return n;
  const isoDentroDeFrase = n.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoDentroDeFrase) return isoDentroDeFrase[1];

  const relativa = new Date(hoy);
  relativa.setHours(0, 0, 0, 0);
  const esSolicitudDeCambio = /\b(cambiar|cambia|cambiarle|cambiale|modificar|modifica|reprogramar|reprograma|mover|adelantar|atrasar)\b/.test(n);

  if (/\banteayer\b/.test(n)) { relativa.setDate(relativa.getDate() - 2); return fechaISO(relativa); }
  if (/\bayer\b/.test(n)) { relativa.setDate(relativa.getDate() - 1); return fechaISO(relativa); }
  if (/\bpasado manana\b/.test(n)) { relativa.setDate(relativa.getDate() + 2); return fechaISO(relativa); }
  if (/\bhoy\b/.test(n)) return fechaISO(relativa);
  if (/\bmanana\b/.test(n)) { relativa.setDate(relativa.getDate() + 1); return fechaISO(relativa); }

  const numerica = n.match(/\b(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?\b/);
  if (numerica) {
    const dia = Number(numerica[1]);
    const mes = Number(numerica[2]);
    let anio = numerica[3] ? Number(numerica[3]) : hoy.getFullYear();
    if (anio < 100) anio += 2000;
    let fecha = new Date(anio, mes - 1, dia);
    if (!numerica[3] && fecha < relativa && !esSolicitudDeCambio) {
      anio += 1;
      fecha = new Date(anio, mes - 1, dia);
    }
    if (fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia) return fechaISO(fecha);
    return null;
  }

  const verbal = n.match(new RegExp(`\\b(\\d{1,2})\\s*(?:de\\s*)?(${NOMBRES_MES})(?:\\s*(?:de\\s*)?(\\d{4}))?\\b`));
  if (verbal) {
    const dia = Number(verbal[1]);
    const mes = MESES[verbal[2]];
    let anio = verbal[3] ? Number(verbal[3]) : relativa.getFullYear();
    let fecha = new Date(anio, mes, dia);
    if (!verbal[3] && fecha < relativa && !esSolicitudDeCambio) { anio += 1; fecha = new Date(anio, mes, dia); }
    if (fecha.getFullYear() === anio && fecha.getMonth() === mes && fecha.getDate() === dia) return fechaISO(fecha);
    return null;
  }

  const dias: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
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

export function interpretarHora(texto: string): string | null {
  const original = sinAcentos(texto).trim();
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

/** Quita fechas, horas y cantidades con unidad, para poder buscar números sueltos sin confundirlos. */
function sinFechasNiHoras(base: string): string {
  return base
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}[/.\-]\d{1,2}(?:[/.\-]\d{2,4})?\b/g, ' ')
    .replace(new RegExp(`\\b\\d{1,2}\\s*(?:de\\s*)?(?:${NOMBRES_MES})(?:\\s*(?:de\\s*)?\\d{4})?\\b`, 'g'), ' ')
    .replace(/\b\d{1,2}:\d{2}(?:\s*(?:am|pm))?\b/g, ' ')
    .replace(/\b(?:a las?\s*)?\d{1,2}\s*(?:am|pm|de la manana|de la tarde|de la noche)\b/g, ' ');
}

const ANTES_DE_CANTIDAD = '(?:a|por|para|seran|sean|son|somos|ser|pasar|pasa|quedar|queden|quede|en|hasta|de)';

/** Número de pedido: «#154», «pedido 154» o, si no hay marca, un único número de 3+ cifras que no sea una cantidad. */
export function extraerIdPedido(texto: string): string | null {
  const t = String(texto ?? '');
  const conNumeral = t.match(/#\s*(\d{2,})/);
  if (conNumeral) return conNumeral[1];
  const asociado = t.match(/\bpedido\s*(?:numero|nro|n[uú]m|n[°º])?\s*[:#-]?\s*(\d{2,})\b/i);
  if (asociado) return asociado[1];

  const base = sinFechasNiHoras(sinAcentos(t))
    .replace(new RegExp(`\\b\\d{1,4}\\s*(?:${UNIDADES})\\b`, 'g'), ' ')
    .replace(new RegExp(`\\b${ANTES_DE_CANTIDAD}\\s+\\d{1,9}\\b`, 'g'), ' ');
  const candidatos = base.match(/\b\d{3,9}\b/g) ?? [];
  return candidatos.length === 1 ? candidatos[0] : null;
}

/** Cuando el bot acaba de preguntar «¿de qué pedido?», basta con que el cliente escriba el número. */
export function extraerIdEnRespuesta(texto: string): string | null {
  return extraerIdPedido(texto) ?? /^#?\s*(\d{1,9})$/.exec(String(texto ?? '').trim())?.[1] ?? null;
}

export function extraerCantidad(texto: string, idPedido?: string | null): number | null {
  const base = sinFechasNiHoras(sinAcentos(texto))
    .replace(/#\s*\d+/g, ' ')
    .replace(/\bpedido\s*(?:numero|nro|num|n[°º])?\s*[:#-]?\s*\d+\b/g, ' ');
  const conUnidad = base.match(new RegExp(`\\b(\\d{1,3})\\s*(?:${UNIDADES})\\b`));
  if (conUnidad) return Number(conUnidad[1]);
  const conPreposicion = base.match(new RegExp(`\\b${ANTES_DE_CANTIDAD}\\s+(\\d{1,3})\\b`));
  if (conPreposicion && conPreposicion[1] !== idPedido) return Number(conPreposicion[1]);
  const numeros = (base.match(/\b\d{1,3}\b/g) ?? []).filter(x => x !== idPedido);
  return numeros.length === 1 ? Number(numeros[0]) : null;
}

export type TipoMensaje =
  | 'consultar' | 'cantidad' | 'fecha'
  | 'diseno' | 'crear' | 'cancelar' | 'varios'
  | 'saludo' | 'ayuda' | 'gracias' | 'desconocido';

export interface Interpretacion {
  tipo: TipoMensaje;
  /** true si el mensaje trae palabras que indican qué quiere hacer la persona (no es solo un dato suelto). */
  explicita: boolean;
  id: string | null;
  cantidad: number | null;
  fecha: string | null;
  hora: string | null;
}

const RE_CANTIDAD = /\b(cantidad|personas|persona|porcion|porciones|invitados|comensales|gente|raciones|tamano)\b/;
const RE_FECHA = /\b(fecha|entrega|entregar|entregan|entregas|dia|reprogramar|reprograma|adelantar|adelanta|atrasar|atrasa|aplazar|posponer|hora)\b/;
const RE_DISENO = /\b(diseno|disenos|decoracion|decorar|estilo|foto|imagen|dibujo|sabor|relleno)\b/;
const RE_CAMBIO = /\b(cambi\w*|modific\w*|mov\w*|mueve\w*|adelant\w*|atras\w*|reprogram\w*|aplaz\w*|pospon\w*|aument\w*|sub\w*|baj\w*|reduc\w*|disminu\w*|ampli\w*|ajust\w*|actualiz\w*|pasar|pasa|pasarlo|poner|ponle|pon|seran|serian|ahora son)\b/;
const RE_CONSULTA = /\b(consult\w*|ver|revis\w*|estado|como (?:va|esta|van|vamos|anda)\w*|en que (?:va|etapa|estado|anda)|etapa|avance|progreso|donde (?:va|esta|anda)|cuando (?:es|llega|entregan|me entregan|lo entregan)|para cuando|saber|informacion|info)\b/;
const RE_CREAR = /\b(nuevo pedido|(?:hacer|crear|realizar|registrar) (?:un |mi )?pedido|pedir (?:una|un) torta|encargar\w*|encargo|quiero (?:una|un) (?:torta|pedido)|quisiera (?:hacer )?(?:una|un) (?:torta|pedido)|necesito (?:una|un) (?:torta|pedido)|me gustaria (?:pedir|hacer|encargar)|comprar (?:una|un) torta|ordenar)\b/;
const RE_CANCELAR = /\b(cancel\w*|anular|anula)\b.*\bpedido\b|\bpedido\b.*\b(cancel\w*|anular|anula)\b/;
const RE_SALUDO = /^(hola|holi|holis|buenas|buenos dias|buenas tardes|buenas noches|hey|ey|saludos|que mas|como estas)\b/;
const RE_AYUDA = /\b(ayuda|ayudame|help|menu|opciones|que puedes hacer|que haces|como funciona|comandos)\b/;
const RE_GRACIAS = /\b(gracias|chao|adios|hasta luego)\b/;

export function interpretarMensaje(texto: string, hoy: Date): Interpretacion {
  const n = normalizar(texto);
  const id = extraerIdPedido(texto);
  const cantidad = extraerCantidad(texto, id);
  const fecha = interpretarFecha(texto, hoy);
  const hora = interpretarHora(texto);

  const hayCantidadConUnidad = new RegExp(`\\b\\d{1,3}\\s*(?:${UNIDADES})\\b`).test(n);
  const campos = {
    cantidad: RE_CANTIDAD.test(n) || hayCantidadConUnidad,
    fecha: RE_FECHA.test(n) || (fecha !== null && !hayCantidadConUnidad),
    diseno: RE_DISENO.test(n)
  };
  const nCampos = Object.values(campos).filter(Boolean).length;
  const verboCambio = RE_CAMBIO.test(n);
  const verboConsulta = RE_CONSULTA.test(n);
  const explicita = verboCambio || verboConsulta || RE_CANTIDAD.test(n) || RE_FECHA.test(n) || RE_DISENO.test(n) || RE_CREAR.test(n) || RE_CANCELAR.test(n);

  const resultado = (tipo: TipoMensaje): Interpretacion => ({ tipo, explicita, id, cantidad, fecha, hora });

  if (RE_CREAR.test(n)) return resultado('crear');
  if (RE_CANCELAR.test(n)) return resultado('cancelar');
  if (nCampos >= 2 && (verboCambio || campos.diseno)) return resultado('varios');
  if (campos.diseno) return resultado('diseno');
  if (nCampos === 1 && verboCambio) return resultado(campos.cantidad ? 'cantidad' : 'fecha');
  if (verboConsulta) return resultado('consultar');
  if (nCampos === 1 && (campos.cantidad ? cantidad !== null : fecha !== null)) return resultado(campos.cantidad ? 'cantidad' : 'fecha');
  if (nCampos === 1 && id) return resultado('consultar');
  if (nCampos === 0 && id && explicita) return resultado('consultar');
  if (RE_AYUDA.test(n)) return resultado('ayuda');
  if (RE_SALUDO.test(n)) return resultado('saludo');
  if (RE_GRACIAS.test(n)) return resultado('gracias');
  return resultado('desconocido');
}

/** Interpreta un «sí» o un «no». La negación se revisa primero para que «no, no confirmo» no cuente como sí. */
export function interpretarSiNo(texto: string): 'si' | 'no' | null {
  const n = normalizar(texto);
  if (!n || n.split(' ').length > 6) return null;
  if (/\bno (se|sabria|tengo|estoy seguro|estoy segura)\b/.test(n)) return null; // «no sé» es duda, no una negativa
  if (/\b(no|nunca|nope|cancel\w*|olvidalo|dejalo|detener)\b/.test(n)) return 'no';
  if (/\b(si|sii|siii|claro|dale|ok|okay|listo|confirmo|confirmar|confirmado|correcto|de acuerdo|adelante|hagale|perfecto|exacto|yes)\b/.test(n)) return 'si';
  return null;
}

export function pideElMismoPedido(texto: string): boolean {
  return /\b(el mismo|ese|ese mismo|el ultimo|el anterior|el de antes)\b/.test(normalizar(texto));
}

// ── Datos del flujo para crear un pedido ─────────────────────────────────────

/** Nombre de la persona. Acepta «me llamo Ana Pérez» o solo «Ana Pérez»; rechaza números y símbolos. */
export function limpiarNombre(texto: string): string | null {
  const t = String(texto ?? '').trim().replace(/\s+/g, ' ');
  const sinPrefijo = t.replace(/^(?:me llamo|mi nombre es|soy|a nombre de|el nombre es|nombre)\s+/i, '').trim();
  return /^[\p{L}][\p{L}\s'.-]{1,79}$/u.test(sinPrefijo) ? sinPrefijo : null;
}

/** Teléfono con el mismo formato que acepta el servidor (7 a 20 dígitos, espacios o guiones, + opcional). */
export function extraerTelefono(texto: string): string | null {
  const m = String(texto ?? '').match(/\+?\d[\d\s-]{5,18}\d/);
  if (!m) return null;
  const t = m[0].trim();
  return /^\+?[\d\s-]{7,20}$/.test(t) ? t : null;
}

/** Hora de entrega. Si a la persona le da igual, se usa el mediodía, que es la hora por defecto del sistema. */
export function interpretarHoraPedido(texto: string): string | null {
  if (/\b(cualquiera|da igual|me da igual|no importa|sin preferencia|cualquier hora)\b/.test(normalizar(texto))) return '12:00';
  return interpretarHora(texto);
}

export type EleccionDiseno = { tipo: 'catalogo'; id: string; nombre: string } | { tipo: 'personalizado' };

export function elegirDiseno(texto: string, catalogo: Array<{ id: string; nombre: string }>): EleccionDiseno | null {
  const n = normalizar(texto);
  if (/\b(personalizad\w*|propio|propia|otro|otra|diferente|foto|imagen|mi diseno)\b/.test(n)) return { tipo: 'personalizado' };
  const escapar = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hallado = catalogo.find(e => new RegExp(`\\b${escapar(normalizar(e.nombre))}\\b`).test(n) || n === e.id);
  return hallado ? { tipo: 'catalogo', id: hallado.id, nombre: hallado.nombre } : null;
}

/** Palabras que cortan el flujo en cualquier paso (incluidos los de texto libre, donde un «no» puede ser parte de la respuesta). */
export function quiereCancelar(texto: string): boolean {
  return /\b(cancelar|cancela|cancelo|olvidalo|dejalo|salir)\b/.test(normalizar(texto));
}
