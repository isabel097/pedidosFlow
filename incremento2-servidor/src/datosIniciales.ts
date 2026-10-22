import { Cambio, Configuracion, Notificacion, Pedido } from './tipos.js';
import { PASOS_PRODUCCION_POR_DEFECTO } from './reglas.js';

/** Imagen de referencia de ejemplo para el pedido con diseño personalizado (SVG incrustado). */
export const FOTO_EJEMPLO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">` +
      `<rect width="320" height="320" fill="#fdf2f8"/>` +
      `<ellipse cx="160" cy="250" rx="120" ry="22" fill="#e2e8f0"/>` +
      `<rect x="70" y="170" width="180" height="80" rx="10" fill="#f9a8d4"/>` +
      `<rect x="95" y="115" width="130" height="62" rx="10" fill="#f472b6"/>` +
      `<rect x="120" y="68" width="80" height="52" rx="10" fill="#ec4899"/>` +
      `<path d="M70 190 q15 18 30 0 q15 18 30 0 q15 18 30 0 q15 18 30 0 q15 18 30 0 q15 18 30 0" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>` +
      `<rect x="157" y="40" width="6" height="28" fill="#94a3b8"/>` +
      `<ellipse cx="160" cy="34" rx="7" ry="11" fill="#fbbf24"/>` +
      `</svg>`
  );

function pedido(
  id: string,
  cliente: string,
  telefono: string,
  cantidad: number,
  fechaEntrega: string,
  horaEntrega: string,
  pasosHechos: number,
  diseno: string,
  extra: Partial<Pedido> = {}
): Pedido {
  return {
    id,
    cliente,
    telefono,
    producto: 'Torta personalizada',
    cantidad,
    fechaEntrega,
    horaEntrega,
    checklist: PASOS_PRODUCCION_POR_DEFECTO.map((_, i) => i < pasosHechos),
    diseno,
    disenoTipo: 'catalogo',
    creadoEn: '2026-10-19T09:15:00.000Z',
    ...extra
  };
}

/** Pedidos de demostración estables. El #154 es el pedido de la demostración principal. */
export function crearPedidosIniciales(): Pedido[] {
  return [
    pedido('154', 'Laura Gómez', '+57 300 111 2233', 20, '2026-11-07', '16:00', 0, 'clasica'),
    pedido('155', 'Laura Gómez', '+57 300 111 2233', 20, '2026-11-09', '12:00', 3, 'chocolate'),
    pedido('156', 'María Torres', '+57 301 222 3344', 35, '2026-11-10', '15:00', 0, 'personalizado', {
      disenoTipo: 'personalizado',
      fotoUrl: FOTO_EJEMPLO
    }),
    pedido('153', 'Daniel Ruiz', '+57 302 333 4455', 20, '2026-11-07', '18:00', 2, 'minimalista'),
    pedido('152', 'Camila Pérez', '+57 303 444 5566', 12, '2026-11-08', '10:00', 0, 'elegante')
  ];
}

export function crearConfiguracionInicial(): Configuracion {
  return {
    reglas: {
      cantidad: { 'Antes de producción': 'auto', 'En producción': 'review', 'Control final': 'blocked' },
      diseno: { 'Antes de producción': 'auto', 'En producción': 'blocked', 'Control final': 'blocked' },
      fecha: { 'Antes de producción': 'auto', 'En producción': 'review', 'Control final': 'blocked' }
    },
    negocio: {
      nombre: 'PedidosFlow',
      correo: 'pedidos@pedidosflow.com',
      telefono: '+57 300 000 0000',
      zonaHoraria: 'America/Bogota (GMT-5)'
    },
    pasosProduccion: [...PASOS_PRODUCCION_POR_DEFECTO],
    pedidosMaximosPorDia: 3,
    catalogo: [
      { id: 'clasica', nombre: 'Clásica', descripcion: 'Diseño limpio y tradicional' },
      { id: 'chocolate', nombre: 'Chocolate', descripcion: 'Acabado de chocolate' },
      { id: 'floral', nombre: 'Floral', descripcion: 'Decoración con flores' },
      { id: 'minimalista', nombre: 'Minimalista', descripcion: 'Diseño sobrio' },
      { id: 'elegante', nombre: 'Elegante', descripcion: 'Acabado especial' }
    ],
    bot: {
      respuestasAutomaticas: true,
      revisionFotos: true,
      notificarNuevoPedido: true,
      notificarCambio: true,
      notificarCambioAutomatico: true,
      notificarRevision: true,
      notificarProduccion: true
    }
  };
}


/** Cambios iniciales: el pedido #156 llega con un diseño personalizado pendiente de revisión. */
export function crearCambiosIniciales(): Cambio[] {
  return [
    {
      id: 'cambio-seed-156',
      pedidoId: '156',
      campo: 'Diseño',
      origen: 'nuevo-pedido',
      etapa: 'Antes de producción',
      pasosCompletados: 0,
      detalleAnterior: 'Nuevo pedido',
      detalleNuevo: 'Diseño personalizado',
      valorNuevo: { tipo: 'personalizado', fotoUrl: FOTO_EJEMPLO },
      resultado: 'pendiente-revision',
      motivo: 'El diseño personalizado requiere revisión manual.',
      fecha: '2026-10-19T09:40:00.000Z'
    }
  ];
}

export function crearNotificacionesIniciales(): Notificacion[] {
  return [
    {
      id: 'notif-seed-156',
      texto: 'Revisión de diseño requerida',
      sub: 'Pedido #156 – María Torres · diseño personalizado',
      tipo: 'info',
      leida: false,
      fecha: '2026-10-19T09:40:00.000Z'
    }
  ];
}
