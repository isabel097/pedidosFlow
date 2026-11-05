import {
  Campo,
  Configuracion,
  DecisionRegla,
  EstiloCatalogo,
  EtapaProduccion,
  MatrizReglas,
  Pedido,
  ResultadoCambio
} from './tipos.js';

export const PASOS_PRODUCCION_POR_DEFECTO = [
  'Materiales preparados',
  'Preparación inicial',
  'Elaboración principal',
  'Decoración y acabados',
  'Control de calidad',
  'Empaque',
  'Listo para entrega'
];

export const CANTIDAD_MAXIMA = 500;

/**
 * Deriva la etapa del pedido a partir del checklist de producción.
 * - Sin ningún paso marcado: Antes de producción.
 * - Último paso marcado ("Listo para entrega"): Control final.
 * - Cualquier otro avance: En producción.
 */
export function derivarEtapaDesdeChecklist(checklist: boolean[]): EtapaProduccion {
  if (!checklist.length || checklist.every(p => !p)) return 'Antes de producción';
  if (checklist[checklist.length - 1]) return 'Control final';
  return 'En producción';
}

export function pasosCompletados(checklist: boolean[]): number {
  return checklist.filter(Boolean).length;
}

export function porcentajeProduccion(checklist: boolean[]): number {
  if (!checklist.length) return 0;
  return Math.round((pasosCompletados(checklist) / checklist.length) * 100);
}

export type EstadoPedido = 'Confirmado' | 'En producción' | 'Listo para entrega' | 'Pendiente de revisión' | 'Cancelado';

export function estadoPedido(pedido: Pedido, revisionDisenoPendiente: boolean): EstadoPedido {
  if (pedido.cancelado) return 'Cancelado';
  if (revisionDisenoPendiente) return 'Pendiente de revisión';
  const hechos = pasosCompletados(pedido.checklist);
  if (hechos === 0) return 'Confirmado';
  if (pedido.checklist[pedido.checklist.length - 1]) return 'Listo para entrega';
  return 'En producción';
}

export function detalleDiseno(pedido: Pick<Pedido, 'diseno' | 'disenoTipo' | 'descripcionDiseno'>, catalogo: EstiloCatalogo[]): string {
  if (pedido.disenoTipo === 'personalizado') {
    const detalle = String(pedido.descripcionDiseno ?? '').trim();
    return detalle ? `Diseño personalizado: ${detalle}` : 'Diseño personalizado';
  }
  return catalogo.find(x => x.id === pedido.diseno)?.nombre ?? pedido.diseno;
}

// ─── Validaciones de formato ──────────────────────────────────────────────────

export type ResultadoFormato<T> = { valido: true; valor: T } | { valido: false; motivo: string };

export function validarFormatoCantidad(valor: unknown): ResultadoFormato<number> {
  if (valor === null || valor === undefined || (typeof valor === 'string' && valor.trim() === '')) {
    return { valido: false, motivo: 'La cantidad debe ser un número.' };
  }
  const n = typeof valor === 'number' ? valor : Number(String(valor).trim());
  if (Number.isNaN(n)) return { valido: false, motivo: 'La cantidad debe ser un número.' };
  if (!Number.isInteger(n) || n <= 0) return { valido: false, motivo: 'La cantidad debe ser un número entero positivo.' };
  if (n > CANTIDAD_MAXIMA) return { valido: false, motivo: `La cantidad máxima por pedido es ${CANTIDAD_MAXIMA} personas.` };
  return { valido: true, valor: n };
}

export function hoyISO(ahora: Date = new Date()): string {
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function validarFechaCalendario(valor: unknown): ResultadoFormato<string> {
  const s = String(valor ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { valido: false, motivo: 'La fecha debe tener el formato AAAA-MM-DD.' };
  const [y, m, d] = s.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  if (f.getUTCFullYear() !== y || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) {
    return { valido: false, motivo: 'La fecha no existe en el calendario.' };
  }
  return { valido: true, valor: s };
}

/** Para registrar pedidos nuevos: formato y fecha deben existir y no estar en el pasado. */
export function validarFormatoFecha(valor: unknown, hoy: string = hoyISO()): ResultadoFormato<string> {
  const calendario = validarFechaCalendario(valor);
  if (!calendario.valido) return calendario;
  if (calendario.valor < hoy) return { valido: false, motivo: 'La fecha de entrega no puede ser anterior a hoy.' };
  return calendario;
}

export function validarFormatoHora(valor: unknown): ResultadoFormato<string> {
  const s = String(valor ?? '').trim();
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return { valido: false, motivo: 'La hora debe tener el formato HH:MM.' };
  return { valido: true, valor: s };
}

// ─── Motor de reglas ──────────────────────────────────────────────────────────

const CLAVE_REGLA: Record<Campo, keyof MatrizReglas> = {
  'Cantidad': 'cantidad',
  'Diseño': 'diseno',
  'Fecha de entrega': 'fecha'
};

const OBJETO: Record<Campo, string> = {
  'Cantidad': 'la cantidad',
  'Diseño': 'el diseño',
  'Fecha de entrega': 'la fecha de entrega'
};

export function decisionPara(campo: Campo, etapa: EtapaProduccion, reglas: Configuracion['reglas']): DecisionRegla {
  return reglas[CLAVE_REGLA[campo]][etapa];
}

export function evaluarCambio(
  campo: Campo,
  etapa: EtapaProduccion,
  regla: DecisionRegla
): { resultado: ResultadoCambio; motivo: string } {
  if (regla === 'auto') {
    return { resultado: 'aplicado', motivo: `Aprobado automáticamente: la etapa "${etapa}" permite modificar ${OBJETO[campo]} sin revisión.` };
  }
  if (regla === 'review') {
    return { resultado: 'pendiente-revision', motivo: `El pedido está en "${etapa}"; este cambio requiere revisión manual.` };
  }
  return { resultado: 'rechazado', motivo: `El pedido está en "${etapa}", que no admite cambios de ${OBJETO[campo].replace(/^(la|el) /, '')}.` };
}
