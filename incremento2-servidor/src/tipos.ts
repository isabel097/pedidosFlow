export type EtapaProduccion = 'Antes de producción' | 'En producción' | 'Control final';
export const ETAPAS: EtapaProduccion[] = ['Antes de producción', 'En producción', 'Control final'];

export type DecisionRegla = 'auto' | 'review' | 'blocked';
export type Campo = 'Cantidad' | 'Diseño' | 'Fecha de entrega';

/** Canal por el que llegó una solicitud. Los cambios anteriores al Incremento 3 no lo traen y se tratan como 'web'. */
export type Canal = 'web' | 'telegram';
export const CANALES: Canal[] = ['web', 'telegram'];
export const CANAL_POR_DEFECTO: Canal = 'web';
export type TipoDiseno = 'catalogo' | 'personalizado';

export interface Pedido {
  id: string;
  cliente: string;
  telefono: string;
  producto: string;
  cantidad: number;
  fechaEntrega: string; // AAAA-MM-DD
  horaEntrega: string; // HH:MM
  checklist: boolean[];
  diseno: string; // id del catálogo o 'personalizado'
  disenoTipo: TipoDiseno;
  fotoUrl?: string; // foto opcional de referencia para diseño personalizado
  descripcionDiseno?: string; // descripción libre del diseño fuera del catálogo
  cancelado?: boolean;
  canal?: Canal; // canal por el que se creó el pedido; los anteriores al Incremento 3 no lo traen (se tratan como 'web')
  creadoEn: string;
}

export type ResultadoCambio = 'aplicado' | 'pendiente-revision' | 'rechazado';

export interface ValorNuevo {
  cantidad?: number;
  fecha?: string;
  hora?: string;
  tipo?: TipoDiseno;
  estiloId?: string;
  fotoUrl?: string;
  descripcionDiseno?: string;
}

export interface Cambio {
  id: string;
  pedidoId: string;
  campo: Campo;
  origen: 'cambio' | 'nuevo-pedido';
  canal?: Canal; // opcional: los registros antiguos no lo tienen
  etapa: EtapaProduccion;
  pasosCompletados: number;
  detalleAnterior: string;
  detalleNuevo: string;
  valorNuevo: ValorNuevo;
  resultado: ResultadoCambio; // decisión automática
  motivo: string;
  fecha: string;
  decisionManual?: 'aprobado' | 'rechazo-mantenido';
  fechaDecisionManual?: string;
  responsable?: string;
}

export interface EstiloCatalogo {
  id: string;
  nombre: string;
  descripcion: string;
}

export interface MatrizReglas {
  cantidad: Record<EtapaProduccion, DecisionRegla>;
  diseno: Record<EtapaProduccion, DecisionRegla>;
  fecha: Record<EtapaProduccion, DecisionRegla>;
}

export interface Configuracion {
  reglas: MatrizReglas;
  negocio: { nombre: string; correo: string; telefono: string; zonaHoraria: string };
  pasosProduccion: string[];
  /** Máximo de pedidos activos por fecha antes de enviar una modificación a revisión. */
  pedidosMaximosPorDia: number;
  catalogo: EstiloCatalogo[];
  bot: {
    respuestasAutomaticas: boolean;
    revisionFotos: boolean;
    notificarNuevoPedido: boolean;
    notificarCambio: boolean;
    notificarCambioAutomatico: boolean;
    notificarRevision: boolean;
    notificarProduccion: boolean;
  };
}

export type TipoNotificacion = 'info' | 'warning' | 'success' | 'danger';

export interface Notificacion {
  id: string;
  texto: string;
  sub: string;
  tipo: TipoNotificacion;
  leida: boolean;
  fecha: string;
}
