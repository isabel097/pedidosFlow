import { useState, useRef, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode = 'platform' | 'whatsapp';
type Nav = 'pedidos' | 'cambios' | 'produccion' | 'clientes' | 'historial' | 'configuracion';
type Change154State = null | 'validating' | 'approved';
type Change155State = null | 'rejected' | 'review' | 'manually-approved' | 'maintained';
type PhotoState = null | 'pending-review' | 'accepted' | 'rejected';
type RuleDecision = 'auto' | 'review' | 'blocked';
type RuleMatrix = Record<string, [RuleDecision, RuleDecision, RuleDecision]>;

type WaPhase =
  | 'menu'
  | 'np-name' | 'np-product'
  | 'np-torta-qty' | 'np-torta-design' | 'np-torta-color' | 'np-torta-photo' | 'np-torta-date' | 'np-torta-confirm'
  | 'np-camisa-qty' | 'np-camisa-color' | 'np-camisa-talla' | 'np-camisa-date' | 'np-camisa-confirm'
  | 'np-floral-flowers' | 'np-floral-size' | 'np-floral-date' | 'np-floral-confirm'
  | 'order-done'
  | 'mod-order' | 'mod-name' | 'mod-what' | 'mod-value' | 'mod-date' | 'mod-done'
  | 'consult-order' | 'consult-name' | 'consult-show'
  | 'my-orders';

interface WaMsg {
  from: 'bot' | 'user';
  text: string;
  time: string;
  photo?: string;
  navBtn?: { label: string; action: string };
}

interface OrderDraft {
  name?: string;
  product?: string;
  qty?: string;
  color?: string;
  talla?: string;
  flowers?: string;
  floralSize?: string;
  design?: string;
  date?: string;
  modField?: string;
  modOrderId?: string;
  modClient?: string;
}

interface Notif {
  id: number;
  text: string;
  sub: string;
  type: 'success' | 'danger' | 'warning' | 'info';
  read: boolean;
}

interface BotOrder {
  id: string;
  client: string;
  product: string;
  qty: string;
  delivery: string;
  status: string;
}

interface ChangeRequest {
  id: string;
  orderId: string;
  client: string;
  field: string;
  newValue: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
}

interface QuantityDecision {
  orderId: string;
  previousValue: number;
  newValue: number;
  result: 'approved' | 'rejected';
  reason: string;
  timestamp: string;
}

// ─── Production stages ────────────────────────────────────────────────────────
const STAGES = [
  'Materiales preparados',
  'Preparación inicial',
  'Elaboración principal',
  'Decoración y acabados',
  'Control de calidad',
  'Empaque',
  'Listo para entrega',
];


// ─── Initial data ─────────────────────────────────────────────────────────────

const INITIAL_CHECKLIST: Record<string, boolean[]> = {
  '#154': [false, false, false, false, false, false, false],
  '#155': [true, true, true, true, true, true, true],
  '#153': [true, true, false, false, false, false, false],
  '#152': [false, false, false, false, false, false, false],
};

const INITIAL_NOTIFS: Notif[] = [
  { id: 1, text: 'Nuevo pedido recibido', sub: 'Pedido #154 – Laura Gómez', type: 'info', read: false },
  { id: 2, text: 'Cliente solicitó modificación', sub: 'Pedido #155 – Laura Gómez', type: 'warning', read: false },
  { id: 3, text: 'Cambio rechazado automáticamente', sub: 'Pedido #155 – Cambio de diseño', type: 'danger', read: false },
];

const STATIC_ORDERS: BotOrder[] = [
  { id: '#154', client: 'Laura Gómez', product: 'Torta personalizada', qty: '20 personas', delivery: '30/08 – 16:00', status: 'Confirmado' },
  { id: '#155', client: 'Laura Gómez', product: 'Torta personalizada', qty: '20 personas', delivery: '01/09 – 12:00', status: 'Control final' },
  { id: '#156', client: 'María Torres', product: 'Torta personalizada', qty: '35 personas', delivery: '02/09 – 15:00', status: 'Pendiente de revisión' },
  { id: '#153', client: 'Daniel Ruiz', product: '20 camisetas', qty: '20 unidades', delivery: '30/08 – 18:00', status: 'En producción' },
  { id: '#152', client: 'Camila Pérez', product: 'Arreglo floral', qty: '1 arreglo', delivery: '31/08 – 10:00', status: 'Confirmado' },
];

const DEFAULT_RULES: RuleMatrix = {
  'Cantidad': ['auto', 'review', 'blocked'],
  'Color / Diseño': ['auto', 'blocked', 'blocked'],
  'Fecha de entrega': ['auto', 'review', 'blocked'],
  'Producto': ['review', 'blocked', 'blocked'],
};

// ─── Validation logic helpers ─────────────────────────────────────────────────

type EtapaProduccion = 'Antes de producción' | 'En producción' | 'Control final';

function derivarEtapa(pasos: boolean[] | undefined): EtapaProduccion {
  if (!pasos || pasos.every(p => !p)) return 'Antes de producción';
  if (pasos[pasos.length - 1]) return 'Control final';
  return 'En producción';
}

function validarFormatoCantidad(valor: unknown): { valido: true; cantidad: number } | { valido: false; motivo: string } {
  const num = typeof valor === 'number' ? valor : Number(valor);
  if (Number.isNaN(num)) return { valido: false, motivo: 'La cantidad debe ser un número.' };
  if (!Number.isInteger(num) || num <= 0) return { valido: false, motivo: 'La cantidad debe ser un número entero positivo.' };
  return { valido: true, cantidad: num };
}

interface EvaluacionCambioCantidad {
  resultado: 'aplicado' | 'pendiente-revision' | 'rechazado' | 'invalido';
  motivo: string;
}

function evaluarCambioCantidad(etapa: EtapaProduccion, valorNuevoCrudo: unknown): EvaluacionCambioCantidad {
  const formato = validarFormatoCantidad(valorNuevoCrudo);
  if (!formato.valido) return { resultado: 'invalido', motivo: formato.motivo };
  const colIdx = etapa === 'Antes de producción' ? 0 : etapa === 'En producción' ? 1 : 2;
  const decision = DEFAULT_RULES['Cantidad'][colIdx];
  if (decision === 'auto') return { resultado: 'aplicado', motivo: `Aprobado automáticamente: la etapa "${etapa}" permite modificar la cantidad sin revisión.` };
  if (decision === 'review') return { resultado: 'pendiente-revision', motivo: `El pedido está en "${etapa}"; este cambio requiere revisión manual.` };
  return { resultado: 'rechazado', motivo: `El pedido está en "${etapa}", que no admite cambios de cantidad.` };
}

function leerCantidadGuardada(pedidoId: string, porDefecto: number): number {
  try {
    const guardado = localStorage.getItem(`pedidosflow_cantidad_${pedidoId}`);
    return guardado ? Number(guardado) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function guardarCantidad(pedidoId: string, cantidad: number): void {
  try {
    localStorage.setItem(`pedidosflow_cantidad_${pedidoId}`, String(cantidad));
  } catch {
    // localStorage no disponible: sigue funcionando en memoria.
  }
}

const QUANTITY_DECISION_KEY = 'pedidosflow_quantity_decisions_v1';
const CHECKLIST_KEY = 'pedidosflow_checklist_v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function normalizeOrderId(value: string): string {
  const digits = value.replace(/[^0-9]/g, '');
  return digits ? `#${digits}` : value.trim();
}

function parseQuantity(value: string): number {
  const n = Number(value.replace(/[^0-9]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

// ─── Helper components ────────────────────────────────────────────────────────

function Dot({ type }: { type: 'success' | 'danger' | 'warning' | 'info' }) {
  const c = { success: 'bg-emerald-500', danger: 'bg-red-500', warning: 'bg-amber-400', info: 'bg-blue-500' };
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${c[type]}`} />;
}

function Badge({ type, children }: { type: 'success' | 'danger' | 'warning' | 'info' | 'neutral'; children: React.ReactNode }) {
  const s = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono-data border ${s[type]}`}>{children}</span>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'Confirmado') return <Badge type="info">Confirmado</Badge>;
  if (status === 'En producción') return <Badge type="warning">En producción</Badge>;
  if (status === 'Control final') return <Badge type="danger">Control final</Badge>;
  if (status === 'Entregado') return <Badge type="success">Entregado</Badge>;
  if (status === 'Pendiente de revisión') return <Badge type="neutral">Pendiente de revisión</Badge>;
  return <Badge type="neutral">{status}</Badge>;
}

function RuleRow({ label, value, pass }: { label: string; value: string; pass: boolean }) {
  return (
    <div className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2.5 border border-slate-100">
      <span className="text-sm text-slate-700">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono-data text-xs font-medium text-slate-500">{value}</span>
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${pass ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {pass ? 'OK' : 'NO'}
        </span>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardView({ onSelectOrder, order154Qty, change154State, change155State, photoState, onAcceptPhoto, onRejectPhoto, dynamicOrders, pendingChangesCount }: {
  onSelectOrder: (id: string) => void;
  order154Qty: number;
  change154State: Change154State;
  change155State: Change155State;
  photoState: PhotoState;
  onAcceptPhoto: () => void;
  onRejectPhoto: () => void;
  dynamicOrders: BotOrder[];
  pendingChangesCount: number;
}) {
  const staticOrders = STATIC_ORDERS.map(o =>
    o.id === '#154' ? { ...o, qty: `${order154Qty} personas` }
    : o.id === '#156' ? { ...o, status: photoState === 'accepted' ? 'Confirmado' : photoState === 'rejected' ? 'Cancelado' : 'Pendiente de revisión' }
    : o
  );
  const orders = [...dynamicOrders, ...staticOrders];
  const activeCount = orders.filter(o => o.status !== 'Cancelado').length;
  const inProdCount = orders.filter(o => o.status === 'En producción').length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pedidos activos', value: String(activeCount), border: 'border-slate-200', bg: 'bg-slate-50', text: 'text-slate-700' },
          { label: 'Cambios pendientes', value: String(pendingChangesCount), border: 'border-amber-100', bg: 'bg-amber-50', text: 'text-amber-700' },
          { label: 'En producción', value: String(inProdCount), border: 'border-blue-100', bg: 'bg-blue-50', text: 'text-blue-700' },
          { label: 'Revisiones pendientes', value: photoState === 'pending-review' ? '1' : '0', border: 'border-violet-100', bg: 'bg-violet-50', text: 'text-violet-700' },
        ].map(s => (
          <div key={s.label} className={`bg-white rounded-xl border ${s.border} p-4`}>
            <div className={`text-2xl font-bold font-display ${s.text}`}>{s.value}</div>
            <div className="text-xs text-slate-500 font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Banners */}
      {change154State === 'approved' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <Dot type="success" />
          <div>
            <div className="font-semibold text-emerald-800 text-sm">Pedido #154 actualizado</div>
            <div className="text-emerald-700 text-sm">Cambio aprobado automáticamente: 20 → 25 personas.</div>
          </div>
        </div>
      )}
      {change155State === 'manually-approved' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <Dot type="warning" />
          <div>
            <div className="font-semibold text-amber-800 text-sm">Pedido #155 – Cambio aprobado manualmente</div>
            <div className="text-amber-700 text-sm">El encargado aprobó el cambio de diseño. Decisión registrada.</div>
          </div>
        </div>
      )}
      {change155State === 'maintained' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
          <Dot type="danger" />
          <div>
            <div className="font-semibold text-red-800 text-sm">Pedido #155 – Rechazo mantenido</div>
            <div className="text-red-700 text-sm">El encargado confirmó el rechazo automático. Decisión registrada.</div>
          </div>
        </div>
      )}

      {photoState === 'accepted' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
          <Dot type="success" />
          <div className="text-emerald-800 text-sm font-medium">Pedido #156 confirmado. Diseño personalizado aceptado.</div>
        </div>
      )}
      {photoState === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <Dot type="danger" />
          <div className="text-red-800 text-sm font-medium">Pedido #156 cancelado. Diseño no viable informado al cliente.</div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold font-display text-slate-800">Pedidos recientes</h2>
          <span className="text-xs text-slate-400 font-mono-data">{orders.length} pedidos</span>
        </div>
        {dynamicOrders.length > 0 && (
          <div className="px-5 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
            <Dot type="success" />
            <span className="text-xs text-emerald-700 font-medium">{dynamicOrders.length} pedido{dynamicOrders.length > 1 ? 's' : ''} nuevo{dynamicOrders.length > 1 ? 's' : ''} recibido{dynamicOrders.length > 1 ? 's' : ''} por el bot de WhatsApp</span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Pedido', 'Cliente', 'Producto', 'Cantidad', 'Entrega', 'Estado', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onSelectOrder(o.id)}>
                  <td className="px-4 py-3 font-mono-data font-medium text-blue-600">{o.id}</td>
                  <td className="px-4 py-3 text-slate-700">{o.client}</td>
                  <td className="px-4 py-3 text-slate-600">{o.product}</td>
                  <td className="px-4 py-3 text-slate-600">{o.qty}</td>
                  <td className="px-4 py-3 font-mono-data text-slate-500 text-xs">{o.delivery}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-slate-300 text-xs hover:text-blue-600 transition-colors">Ver →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Photo review card ────────────────────────────────────────────────────────

function PhotoReviewCard({ onAccept, onReject, order }: { onAccept: () => void; onReject: () => void; order?: BotOrder }) {
  const client = order?.client ?? 'María Torres';
  const orderId = order?.id ?? '#156';
  const qty = order?.qty ?? '35 personas';
  const delivery = order?.delivery ?? '02/09 – 15:00';

  return (
    <div className="bg-white border border-violet-200 rounded-xl overflow-hidden animate-slide-in">
      <div className="bg-violet-50 px-5 py-3 border-b border-violet-100 flex items-center gap-2">
        <Dot type="info" />
        <span className="font-semibold text-violet-800 text-sm">Revisión de diseño personalizado requerida – Pedido {orderId}</span>
      </div>
      <div className="p-5">
        <div className="flex gap-5 flex-col sm:flex-row">
          <div className="flex-shrink-0">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Foto de referencia enviada</div>
            <img
              src="https://images.unsplash.com/photo-1562440499-64c9a111f713?w=200&h=200&fit=crop&auto=format"
              alt="Diseño de torta personalizada"
              className="w-40 h-40 object-cover rounded-lg border border-slate-200 bg-slate-100"
            />
          </div>
          <div className="flex-1 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Cliente</div>
                <div className="font-medium text-slate-700">{client}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Pedido</div>
                <div className="font-mono-data font-medium text-blue-600">{orderId}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Producto</div>
                <div className="font-medium text-slate-700">Torta personalizada</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Cantidad</div>
                <div className="font-medium text-slate-700">{qty}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Entrega</div>
                <div className="font-mono-data text-xs text-slate-600">{delivery}</div>
              </div>
            </div>
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-100">
              El cliente envió una foto de referencia para el diseño. Revisa si el diseño es técnicamente posible y si hay disponibilidad antes de confirmar el pedido.
            </p>
            <div className="flex gap-2 pt-1">
              <button onClick={onAccept} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-lg text-sm transition-colors">
                Confirmar viabilidad
              </button>
              <button onClick={onReject} className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-semibold py-2 rounded-lg text-sm border border-red-200 transition-colors">
                Diseño no viable
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Order detail ─────────────────────────────────────────────────────────────

function OrderDetailView({ orderId, order154Qty, change154State, change155State, checklist, quantityDecisions, pendingQty, onApproveChange, onClose, onGoChanges, dynamicOrders }: {
  orderId: string;
  order154Qty: number;
  change154State: Change154State;
  change155State: Change155State;
  checklist: Record<string, boolean[]>;
  quantityDecisions: QuantityDecision[];
  pendingQty: number | null;
  onApproveChange: () => void;
  onClose: () => void;
  onGoChanges: () => void;
  dynamicOrders: BotOrder[];
}) {
  const stagesFor = checklist[orderId] || STAGES.map(() => false);
  const doneCount = stagesFor.filter(Boolean).length;
  const lastDecision = quantityDecisions.filter(d => d.orderId === orderId).slice(-1)[0];
  const knownOrder = [...dynamicOrders, ...STATIC_ORDERS].find(o => o.id === orderId);
  const displayClient = knownOrder?.client ?? '—';
  const displayProduct = knownOrder?.product ?? 'Torta personalizada';
  const displayQty = orderId === '#154' ? `${order154Qty} personas` : (knownOrder?.qty ?? '—');
  const displayDelivery = knownOrder?.delivery ?? '—';
  const displayStatus = knownOrder?.status ?? 'Confirmado';

  return (
    <div className="space-y-5 animate-slide-in">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm transition-colors">← Volver</button>
        <span className="text-slate-200">|</span>
        <h1 className="font-display font-bold text-xl text-slate-800">Pedido {orderId}</h1>
        <StatusBadge status={displayStatus} />
        {lastDecision?.result === 'approved' && <Badge type="success">Cambio aprobado</Badge>}
        {lastDecision?.result === 'rejected' && <Badge type="danger">Cambio rechazado</Badge>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-display font-semibold text-slate-800 mb-4">Datos del pedido</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: 'Cliente', value: displayClient },
                { label: 'Producto', value: displayProduct },
                { label: 'Cantidad', value: displayQty },
                { label: 'Fecha de entrega', value: displayDelivery },
                { label: 'Producción', value: `${doneCount} / ${STAGES.length} etapas completadas` },
              ].map(f => (
                <div key={f.label}>
                  <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">{f.label}</dt>
                  <dd className="text-slate-700 font-medium mt-0.5">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {orderId === '#154' && change154State === 'validating' && (
            <ValidationPanel154 onApprove={onApproveChange} checklist={checklist['#154'] || []} pendingQty={pendingQty ?? 25} />
          )}

          {orderId === '#154' && change154State === 'approved' && lastDecision?.result === 'approved' && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2"><Dot type="success" /><span className="font-display font-semibold text-emerald-800">Cambio aprobado automáticamente</span></div>
              <p className="text-emerald-700 text-sm">Cantidad actualizada de <strong>{lastDecision.previousValue} → {lastDecision.newValue} personas</strong>. El cambio quedó registrado en el historial.</p>
            </div>
          )}

          {orderId === '#155' && lastDecision?.result === 'rejected' && (
            <RejectionPanel155 checklist={stagesFor} decision={lastDecision} onGoChanges={onGoChanges} />
          )}
        </div>

        <div>
          <VersionHistory orderId={orderId} order154Qty={order154Qty} quantityDecisions={quantityDecisions} />
        </div>
      </div>
    </div>
  );
}

// ─── Validation panels ────────────────────────────────────────────────────────

function ValidationPanel154({ onApprove, checklist, pendingQty }: { onApprove: () => void; checklist: boolean[]; pendingQty: number }) {
  const doneCount = checklist.filter(Boolean).length;
  const currentStage = doneCount === 0 ? 'No iniciada' : STAGES[doneCount - 1];
  const stageOk = doneCount <= 1;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 animate-slide-in">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-display font-semibold text-slate-800">Motor de Validación</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">Cambio solicitado: Cantidad 20 → {pendingQty} personas · Pedido #154</p>
      <div className="space-y-2 mb-4">
        <RuleRow label="Producción iniciada" value={doneCount > 0 ? 'SI' : 'NO'} pass={doneCount === 0} />
        <RuleRow label={`Etapa actual: ${currentStage} (${doneCount}/${STAGES.length})`} value={stageOk ? 'VIABLE' : 'BLOQUEADO'} pass={stageOk} />
        <RuleRow label="Capacidad disponible" value="SI" pass={true} />
        <RuleRow label="Tiempo suficiente para entrega" value="SI" pass={true} />
        <RuleRow label="Restricciones del producto" value="CUMPLE" pass={true} />
      </div>
      <div className={`rounded-lg p-3 mb-4 flex items-center gap-2 ${stageOk ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
        <Dot type={stageOk ? 'success' : 'danger'} />
        <span className={`font-semibold text-sm ${stageOk ? 'text-emerald-700' : 'text-red-700'}`}>
          {stageOk ? 'CAMBIO VIABLE – Todas las condiciones se cumplen' : 'CAMBIO NO VIABLE – Producción muy avanzada'}
        </span>
      </div>
      {stageOk && (
        <button onClick={onApprove} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
          Aprobar cambio
        </button>
      )}
    </div>
  );
}

function RejectionPanel155({ checklist, decision, onGoChanges }: { checklist: boolean[]; decision: QuantityDecision; onGoChanges: () => void }) {
  const doneCount = checklist.filter(Boolean).length;
  const currentStage = derivarEtapa(checklist);

  return (
    <div className="bg-white border border-red-200 rounded-xl p-5 animate-slide-in">
      <h3 className="font-display font-semibold text-slate-800 mb-1">Motor de Validación</h3>
      <p className="text-xs text-slate-500 mb-4">Cambio solicitado: Cantidad {decision.previousValue} → {decision.newValue} personas · Pedido #155</p>
      <div className="space-y-2 mb-4">
        <RuleRow label="Producción iniciada" value="SI" pass={false} />
        <RuleRow label={`Etapa actual: ${currentStage} (${doneCount}/${STAGES.length})`} value="BLOQUEADO" pass={false} />
        <RuleRow label="Cambio de cantidad permitido" value="NO" pass={false} />
      </div>
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
        <Dot type="danger" />
        <span className="text-red-700 font-semibold text-sm">{decision.reason}</span>
      </div>
      <button onClick={onGoChanges} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-lg text-sm border border-slate-200 transition-colors">
        Ver historial de la decisión →
      </button>
    </div>
  );
}

function DecisionHistoryPanel({ state }: { state: Change155State }) {
  return (
    <div className={`border rounded-xl p-5 ${state === 'manually-approved' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
      <h3 className="font-display font-semibold text-slate-800 mb-3">Decisión registrada</h3>
      <dl className="space-y-2 text-sm">
        {[
          { label: 'Decisión automática', value: 'Rechazado', cls: 'text-red-600' },
          { label: 'Decisión manual', value: state === 'manually-approved' ? 'Aprobado' : 'Rechazo confirmado', cls: state === 'manually-approved' ? 'text-amber-600' : 'text-slate-600' },
          { label: 'Responsable', value: 'Administrador', cls: 'text-slate-700' },
          { label: 'Fecha y hora', value: '29/08/2025 – 15:04', cls: 'text-slate-500 font-mono-data text-xs' },
        ].map(f => (
          <div key={f.label} className="flex justify-between">
            <dt className="text-slate-500">{f.label}</dt>
            <dd className={`font-medium ${f.cls}`}>{f.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── Version history ──────────────────────────────────────────────────────────

function VersionHistory({ orderId, order154Qty, quantityDecisions }: {
  orderId: string;
  order154Qty: number;
  quantityDecisions: QuantityDecision[];
}) {
  const knownOrder = STATIC_ORDERS.find(o => o.id === orderId);
  const decisions = quantityDecisions.filter(d => d.orderId === orderId);
  const initialQty = orderId === '#154' ? 20 : parseQuantity(knownOrder?.qty ?? '0');
  const entries = [
    { label: 'Versión inicial', detail: `${initialQty} personas · ${knownOrder?.product ?? 'Torta personalizada'} · Entrega ${knownOrder?.delivery ?? '—'}`, color: 'bg-blue-400 text-blue-600', timestamp: '' },
    ...decisions.map(d => ({
      label: d.result === 'approved' ? 'Cambio aprobado' : 'Cambio rechazado',
      detail: `${d.previousValue} → ${d.newValue} personas · ${d.reason}`,
      color: d.result === 'approved' ? 'bg-emerald-500 text-emerald-600' : 'bg-red-400 text-red-600',
      timestamp: new Date(d.timestamp).toLocaleString('es-CO'),
    })),
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="font-display font-semibold text-slate-800 mb-4 text-sm">Historial de versiones</h3>
      <div className="relative pl-4">
        <div className="absolute left-1.5 top-2 bottom-2 w-px bg-slate-100" />
        {entries.map((e, i) => (
          <div key={`${orderId}-version-${i}`} className="relative mb-5 last:mb-0">
            <div className={`absolute -left-2.5 top-1 w-3 h-3 rounded-full border-2 border-white ${e.color.split(' ')[0]}`} />
            <div className={`text-xs font-semibold mb-0.5 ${e.color.split(' ')[1]}`}>{e.label}</div>
            <div className="text-xs text-slate-400 font-mono-data mb-1">{e.timestamp || 'Inicial'}</div>
            <div className="bg-slate-50 rounded-lg p-2 text-xs text-slate-600 border border-slate-100">{e.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Cambios pendientes ───────────────────────────────────────────────────────

function CambiosPendientesView({ change155State, photoState, changeRequests, pendingPhotoOrder, onReview, onApproveManual, onMaintainReject, onAcceptPhoto, onRejectPhoto, onApproveChangeReq, onRejectChangeReq }: {
  change155State: Change155State;
  photoState: PhotoState;
  changeRequests: ChangeRequest[];
  pendingPhotoOrder: BotOrder | null;
  onReview: () => void;
  onApproveManual: () => void;
  onMaintainReject: () => void;
  onAcceptPhoto: () => void;
  onRejectPhoto: () => void;
  onApproveChangeReq: (id: string) => void;
  onRejectChangeReq: (id: string) => void;
}) {
  const [showReview, setShowReview] = useState(false);

  const resolved = change155State === 'manually-approved' || change155State === 'maintained';

  return (
    <div className="space-y-5">
      <h1 className="font-display font-bold text-xl text-slate-800">Cambios pendientes</h1>

      {photoState === 'pending-review' && !pendingPhotoOrder && (
        <PhotoReviewCard onAccept={onAcceptPhoto} onReject={onRejectPhoto} />
      )}

      {false && !resolved && change155State === 'rejected' && (
        <div className="bg-white border border-red-200 rounded-xl overflow-hidden">
          <div className="bg-red-50 px-5 py-3 border-b border-red-100 flex items-center gap-2">
            <Dot type="danger" />
            <span className="font-semibold text-red-800 text-sm">Cambio requiere revisión – Pedido #155</span>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                { label: 'Cliente', value: 'Laura Gómez' },
                { label: 'Cambio solicitado', value: 'Cambio completo de diseño' },
                { label: 'Decisión automática', value: <Badge type="danger">RECHAZADO</Badge> },
                { label: 'Motivo', value: 'El pedido ya está en producción' },
              ].map(f => (
                <div key={f.label as string}>
                  <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">{f.label}</div>
                  <div className="text-slate-700">{f.value}</div>
                </div>
              ))}
            </div>

            {!showReview ? (
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button onClick={() => { setShowReview(true); onReview(); }} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2 rounded-lg text-sm transition-colors">
                  Revisar solicitud
                </button>
                <button onClick={onMaintainReject} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-lg text-sm border border-slate-200 transition-colors">
                  Mantener rechazo
                </button>
                <button onClick={onApproveManual} className="px-4 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold py-2 rounded-lg text-sm border border-amber-200 transition-colors">
                  Aprobar manualmente
                </button>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 animate-slide-in">
                <h4 className="font-display font-semibold text-slate-700 mb-3 text-sm">Revisión manual – Pedido #155</h4>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between"><span className="text-slate-500">Estado actual</span><Badge type="warning">En producción</Badge></div>
                  <div className="flex justify-between"><span className="text-slate-500">Cambio solicitado</span><span className="font-medium text-slate-700">Cambio completo de diseño</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Motivo del rechazo automático</span><span className="text-slate-700">Pedido ya iniciado</span></div>
                </div>
                <p className="text-xs text-slate-500 bg-white border border-slate-100 rounded-lg p-3 mb-4">
                  Verifica si existe una excepción o situación especial que justifique aprobar este cambio. La decisión quedará registrada en el historial con el responsable.
                </p>
                <div className="flex gap-2">
                  <button onClick={onApproveManual} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 rounded-lg text-sm transition-colors">
                    Aprobar manualmente
                  </button>
                  <button onClick={onMaintainReject} className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-semibold py-2 rounded-lg text-sm border border-red-200 transition-colors">
                    Mantener rechazo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {resolved && (
        <div className={`rounded-xl border p-4 ${change155State === 'manually-approved' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-2">
            <Dot type={change155State === 'manually-approved' ? 'warning' : 'danger'} />
            <span className="font-semibold text-slate-700 text-sm">
              {change155State === 'manually-approved' ? 'Cambio aprobado manualmente – Pedido #155' : 'Rechazo confirmado – Pedido #155'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1 ml-4">Decisión registrada en el historial del pedido.</p>
        </div>
      )}

      {/* Dynamic change requests from the bot */}
      {changeRequests.map(req => (
        <div key={req.id} className={`bg-white border rounded-xl overflow-hidden ${req.status === 'pending' ? 'border-amber-200' : req.status === 'approved' ? 'border-emerald-200' : 'border-slate-200'}`}>
          <div className={`px-5 py-3 border-b flex items-center gap-2 ${req.status === 'pending' ? 'bg-amber-50 border-amber-100' : req.status === 'approved' ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
            <Dot type={req.status === 'pending' ? 'warning' : req.status === 'approved' ? 'success' : 'danger'} />
            <span className={`font-semibold text-sm ${req.status === 'pending' ? 'text-amber-800' : req.status === 'approved' ? 'text-emerald-800' : 'text-slate-600'}`}>
              {req.status === 'pending' ? 'Cambio pendiente de revisión' : req.status === 'approved' ? 'Cambio aprobado' : 'Cambio rechazado'} – Pedido {req.orderId}
            </span>
            <span className="ml-auto text-xs font-mono-data text-slate-400">{req.timestamp}</span>
          </div>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Cliente</div>
                <div className="font-medium text-slate-700">{req.client}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Campo modificado</div>
                <div className="font-medium text-slate-700">{req.field}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Nuevo valor solicitado</div>
                <div className="font-medium text-slate-700 bg-slate-50 rounded px-3 py-1.5 font-mono-data text-xs border border-slate-100">{req.newValue}</div>
              </div>
            </div>
            {req.status === 'pending' && (
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button onClick={() => onApproveChangeReq(req.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-lg text-sm transition-colors">
                  Aprobar cambio
                </button>
                <button onClick={() => onRejectChangeReq(req.id)} className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-semibold py-2 rounded-lg text-sm border border-red-200 transition-colors">
                  Rechazar
                </button>
              </div>
            )}
            {req.status !== 'pending' && (
              <div className={`text-xs font-medium px-3 py-2 rounded-lg ${req.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                Decisión registrada: {req.status === 'approved' ? 'Aprobado por encargado' : 'Rechazado por encargado'}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Dynamic photo review from bot */}
      {photoState === 'pending-review' && pendingPhotoOrder && (
        <PhotoReviewCard
          onAccept={onAcceptPhoto}
          onReject={onRejectPhoto}
          order={pendingPhotoOrder}
        />
      )}

      {change155State === null && photoState !== 'pending-review' && changeRequests.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">No hay cambios pendientes</div>
      )}
    </div>
  );
}

// ─── Historial ────────────────────────────────────────────────────────────────

function HistorialView({ order154Qty, change154State, change155State, quantityDecisions }: {
  order154Qty: number;
  change154State: Change154State;
  change155State: Change155State;
  quantityDecisions: QuantityDecision[];
}) {
  const entries154 = quantityDecisions.filter(d => d.orderId === '#154');
  const entries155 = quantityDecisions.filter(d => d.orderId === '#155');

  const renderTimeline = (entries: QuantityDecision[], fallbackDetail: string) => {
    const items = entries.length > 0 ? entries.map(d => ({
      label: d.result === 'approved' ? 'Cambio aprobado' : 'Cambio rechazado',
      detail: `${d.previousValue} → ${d.newValue} personas · ${d.reason}`,
      timestamp: d.timestamp,
      dot: d.result === 'approved' ? 'bg-emerald-500 text-emerald-600' : 'bg-red-500 text-red-600',
    })) : [{
      label: 'Versión inicial',
      detail: fallbackDetail,
      timestamp: '',
      dot: 'bg-blue-400 text-blue-600',
    }];

    return <div className="relative pl-4 pt-1">
      <div className="absolute left-1.5 top-2 bottom-2 w-px bg-slate-100" />
      {items.map((e, i) => (
        <div key={i} className="relative mb-4 last:mb-0 flex gap-4">
          <div className="w-24 flex-shrink-0 text-right pt-0.5">
            <div className="text-xs font-mono-data text-slate-500">{e.timestamp ? new Date(e.timestamp).toLocaleDateString('es-CO') : 'Inicial'}</div>
            <div className="text-xs font-mono-data text-slate-400">{e.timestamp ? new Date(e.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
          </div>
          <div className="flex flex-col items-center flex-shrink-0 z-10"><div className={`w-3 h-3 rounded-full mt-1 border-2 border-white ${e.dot.split(' ')[0]}`} /></div>
          <div className="flex-1 pb-4"><div className={`text-xs font-semibold mb-0.5 ${e.dot.split(' ')[1]}`}>{e.label}</div><div className="text-sm text-slate-600">{e.detail}</div></div>
        </div>
      ))}
    </div>;
  };

  return (
    <div className="space-y-5">
      <h1 className="font-display font-bold text-xl text-slate-800">Historial de pedidos</h1>
      {[
        { id: '#154', client: 'Laura Gómez', product: 'Torta personalizada', status: 'Confirmado', entries: entries154, fallback: `${order154Qty} personas · Color azul · Entrega 30/08` },
        { id: '#155', client: 'Laura Gómez', product: 'Torta personalizada', status: 'Control final', entries: entries155, fallback: '20 personas · Color rosado · Entrega 01/09' },
      ].map(o => (
        <div key={o.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
            <span className="font-mono-data font-semibold text-blue-600">{o.id}</span>
            <span className="text-slate-700 font-medium text-sm">{o.product} – {o.client}</span>
            <StatusBadge status={o.status} />
          </div>
          <div className="p-5">{renderTimeline(o.entries, o.fallback)}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Produccion with checklist ────────────────────────────────────────────────

function ProduccionView({ checklist, onToggle }: {
  checklist: Record<string, boolean[]>;
  onToggle: (orderId: string, stageIdx: number) => void;
}) {
  const orders = [
    { id: '#155', client: 'Laura Gómez', product: 'Torta personalizada', delivery: '01/09 – 12:00' },
    { id: '#153', client: 'Daniel Ruiz', product: '20 camisetas', delivery: '30/08 – 18:00' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl text-slate-800">Seguimiento de producción</h1>
          <p className="text-sm text-slate-500 mt-0.5">Marque las etapas completadas. El motor de validación usa este avance para evaluar cambios.</p>
        </div>
      </div>

      {orders.map(o => {
        const stages = checklist[o.id] || STAGES.map(() => false);
        const done = stages.filter(Boolean).length;
        const pct = Math.round((done / STAGES.length) * 100);
        const currentStageLabel = done === 0 ? 'No iniciada' : done === STAGES.length ? 'Completada' : STAGES[done - 1];

        return (
          <div key={o.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono-data font-semibold text-blue-600">{o.id}</span>
                  <span className="text-slate-700 font-medium text-sm">{o.product} – {o.client}</span>
                  <Badge type="warning">En producción</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 font-mono-data">{done}/{STAGES.length} etapas</span>
                  <span className="text-xs text-slate-400 font-mono-data">Entrega: {o.delivery}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                  <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-mono-data text-slate-500 w-10 text-right">{pct}%</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">Etapa actual: {currentStageLabel}</div>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STAGES.map((stage, idx) => {
                  const checked = stages[idx];
                  const prevsDone = stages.slice(0, idx).every(Boolean);
                  const disabled = !prevsDone && !checked;
                  return (
                    <label
                      key={idx}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer select-none ${checked ? 'bg-emerald-50 border-emerald-200' : disabled ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => !disabled && onToggle(o.id, idx)}
                        className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                      />
                      <span className={`text-sm flex-1 ${checked ? 'text-emerald-700 font-medium line-through decoration-emerald-400' : 'text-slate-700'}`}>
                        {idx + 1}. {stage}
                      </span>
                      {checked && <span className="text-xs font-mono-data text-emerald-500 font-bold">OK</span>}
                    </label>
                  );
                })}
              </div>

              {done >= 3 && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2">
                  <Dot type="warning" />
                  <p className="text-xs text-amber-700">
                    <strong>Aviso:</strong> Con {done} etapas completadas, los cambios mayores (diseño, producto) ya no son viables automáticamente. El motor de validación rechazará dichos cambios.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── WhatsApp view ────────────────────────────────────────────────────────────

// ─── Mini calendar ────────────────────────────────────────────────────────────

function MiniCalendar({ onSelect }: { onSelect: (date: string) => void }) {
  const _now = new Date();
  const [year, setYear] = useState(_now.getFullYear());
  const [month, setMonth] = useState(_now.getMonth());

  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const WDAYS = ['Do','Lu','Ma','Mi','Ju','Vi','Sa'];

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => month === 0 ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1);
  const nextMonth = () => month === 11 ? (setMonth(0), setYear(y => y + 1)) : setMonth(m => m + 1);

  const isPast = (day: number) => {
    const d = new Date(year, month, day);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return d < today;
  };

  const fmt = (day: number) => `${String(day).padStart(2,'0')}/${String(month+1).padStart(2,'0')}/${year}`;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 animate-slide-in">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600 text-sm transition-colors">←</button>
        <span className="text-sm font-semibold text-slate-700 font-display">{MONTHS[month]} {year}</span>
        <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600 text-sm transition-colors">→</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {WDAYS.map(d => <div key={d} className="text-center text-xs text-slate-400 py-1 font-medium">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
        {Array(daysInMonth).fill(null).map((_, i) => {
          const day = i + 1;
          const past = isPast(day);
          return (
            <button
              key={day}
              onClick={() => !past && onSelect(fmt(day))}
              disabled={past}
              className={`h-7 w-7 mx-auto flex items-center justify-center rounded-lg text-xs transition-colors ${past ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-[#128C7E] hover:text-white font-medium'}`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── WhatsApp Bot (dynamic state machine) ─────────────────────────────────────

function WhatsAppView({ onNavigate, onOrderCreated, onNotify, allOrders, onChangeRequested, onPhotoReviewNeeded, onRequestQuantityChange }: {
  onNavigate: (action: string) => void;
  onOrderCreated: (order: BotOrder) => void;
  onNotify: (n: Omit<Notif, 'id' | 'read'>) => void;
  allOrders: BotOrder[];
  onChangeRequested: (req: { orderId: string; client: string; field: string; newValue: string }) => void;
  onPhotoReviewNeeded: (order: BotOrder) => void;
  onRequestQuantityChange: (pedidoId: string, cantidadNueva: unknown) => EvaluacionCambioCantidad;
}) {
  const [msgs, setMsgs] = useState<WaMsg[]>([]);
  const [phase, setPhase] = useState<WaPhase>('menu');
  const [draft, setDraft] = useState<OrderDraft>({});
  const [showCal, setShowCal] = useState(false);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const now = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const addBot = (text: string, navBtn?: WaMsg['navBtn']) =>
    setMsgs(p => [...p, { from: 'bot', text, time: now(), navBtn }]);

  const addUser = (text: string, photo?: string) =>
    setMsgs(p => [...p, { from: 'user', text, time: now(), photo }]);

  useEffect(() => {
    setMsgs([{ from: 'bot', text: 'Hola. Soy el asistente de PedidosFlow.\n\n¿En qué puedo ayudarte hoy?', time: '09:00' }]);
    setPhase('menu');
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, showCal, pickedDate]);

  const goMenu = () => {
    setDraft({});
    setTextInput('');
    setShowCal(false);
    setPickedDate(null);
    addBot('De acuerdo. ¿En qué puedo ayudarte?');
    setPhase('menu');
  };

  const DATE_PHASES: WaPhase[] = ['np-torta-date', 'np-camisa-date', 'np-floral-date', 'mod-date'];

  const handle = (choice: string) => {
    const value = choice.trim();
    if (!value) return;
    addUser(value);
    setTextInput('');

    switch (phase) {
      // ── Menú principal ──────────────────────────────────────────
      case 'menu':
        if (choice === 'Nuevo pedido') {
          addBot('Para comenzar, ¿cuál es tu nombre y apellido?');
          setPhase('np-name');
        } else if (choice === 'Modificar pedido') {
          addBot('Indica el número del pedido que deseas modificar. Puedes escribir 154 o #154.');
          setPhase('mod-order');
        } else if (choice === 'Consultar pedido') {
          addBot('Indica el número del pedido que deseas consultar. Puedes escribir 154 o #154.');
          setPhase('consult-order');
        } else if (choice === 'Mis pedidos') {
          const allList = allOrders.map(o => `— ${o.id} · ${o.product} · ${o.delivery} · ${o.status}`).join('\n');
          addBot(`Pedidos registrados en el sistema:\n\n${allList}`);
          setPhase('my-orders');
        }
        break;

      // ── Nuevo pedido: nombre ─────────────────────────────────────
      case 'np-name': {
        const nd = { ...draft, name: choice };
        setDraft(nd);
        addBot(`Bienvenido/a, ${choice}.\n\n¿Qué producto deseas solicitar?`);
        setPhase('np-product');
        break;
      }

      // ── Nuevo pedido: producto ───────────────────────────────────
      case 'np-product': {
        const newDraft = { ...draft, product: choice };
        setDraft(newDraft);
        if (choice === 'Torta personalizada') {
          addBot('¿Para cuántas personas será la torta?');
          setPhase('np-torta-qty');
        } else if (choice === 'Camiseta personalizada') {
          addBot('¿Cuántas camisetas necesitas?');
          setPhase('np-camisa-qty');
        } else if (choice === 'Arreglo floral') {
          addBot('¿Qué tipo de flores prefieres para el arreglo?');
          setPhase('np-floral-flowers');
        }
        break;
      }

      // ── Torta ────────────────────────────────────────────────────
      case 'np-torta-qty': {
        const nd = { ...draft, qty: choice };
        setDraft(nd);
        if (choice === '30 o más') {
          addBot('Indicaste 30 o más. Especifica la cantidad exacta:');
          // stay in same phase to re-collect exact number
        } else {
          addBot('¿Cómo prefieres definir el diseño de la torta?');
          setPhase('np-torta-design');
        }
        break;
      }
      case 'np-torta-design': {
        const nd = { ...draft, design: choice };
        setDraft(nd);
        if (choice === 'Elegir color') {
          addBot('¿Qué color principal deseas para la torta?');
          setPhase('np-torta-color');
        } else {
          addBot('Comparte la foto o imagen del diseño que deseas. Puede ser una foto propia o una referencia de internet.');
          setPhase('np-torta-photo');
        }
        break;
      }
      case 'np-torta-color': {
        const nd = { ...draft, color: choice };
        setDraft(nd);
        addBot('¿Para qué fecha necesitas el pedido?\nPresiona "Definir fecha" para abrir el calendario.');
        setPhase('np-torta-date');
        break;
      }
      case 'np-torta-photo': {
        addUser('[Foto adjuntada]', 'https://images.unsplash.com/photo-1562440499-64c9a111f713?w=200&h=200&fit=crop&auto=format');
        const nd = { ...draft, design: 'Foto de referencia' };
        setDraft(nd);
        addBot('Foto recibida. El encargado revisará la viabilidad del diseño.\n\n¿Para qué fecha necesitas el pedido?\nPresiona "Definir fecha" para abrir el calendario.');
        setPhase('np-torta-date');
        break;
      }
      case 'np-torta-date': {
        const nd = { ...draft, date: choice };
        setDraft(nd);
        setShowCal(false);
        setPickedDate(null);
        addBot(`Resumen del pedido:\n\nProducto: Torta personalizada\nCantidad: ${nd.qty || draft.qty} personas\nDiseño: ${nd.design || draft.design || nd.color || draft.color || 'Color seleccionado'}\nEntrega: ${choice}\n\n¿Confirmas el pedido?`);
        setPhase('np-torta-confirm');
        break;
      }
      case 'np-torta-confirm':
        if (choice === 'Modificar pedido') {
          addBot('De acuerdo. Vamos a corregir los detalles.\n\n¿Para cuántas personas será la torta?');
          setPhase('np-torta-qty');
          break;
        }
        if (choice === 'Confirmar pedido') {
          const isPhoto = draft.design === 'Foto de referencia';
          const newOrder: BotOrder = {
            id: '__new__',
            client: draft.name || 'Cliente',
            product: 'Torta personalizada',
            qty: `${draft.qty || '?'} personas`,
            delivery: draft.date || '—',
            status: isPhoto ? 'Pendiente de revisión' : 'Confirmado',
          };
          onOrderCreated(newOrder);
          if (isPhoto) {
            onPhotoReviewNeeded(newOrder);
            addBot('Tu pedido ha sido registrado y enviado a revisión.\n\nNuestro equipo verificará la viabilidad del diseño y te notificará en breve. Gracias por tu paciencia.', { label: '→ Ver revisión en la plataforma', action: 'go-photo-review' });
          } else {
            onNotify({ text: 'Nuevo pedido recibido por WhatsApp', sub: `Torta personalizada – ${draft.name || 'Cliente'}`, type: 'info' });
            addBot('Pedido confirmado. Te notificaremos cuando esté en preparación. Gracias.', { label: '→ Ver en la plataforma', action: 'go-orders' });
          }
          setPhase('order-done');
        } else { goMenu(); }
        break;

      // ── Camiseta ─────────────────────────────────────────────────
      case 'np-camisa-qty': {
        const nd = { ...draft, qty: choice };
        setDraft(nd);
        addBot('¿Qué color o colores deseas para las camisetas?');
        setPhase('np-camisa-color');
        break;
      }
      case 'np-camisa-color': {
        const nd = { ...draft, color: choice };
        setDraft(nd);
        addBot('¿Qué talla o tallas necesitas?');
        setPhase('np-camisa-talla');
        break;
      }
      case 'np-camisa-talla': {
        const nd = { ...draft, talla: choice };
        setDraft(nd);
        addBot('¿Para qué fecha necesitas las camisetas?\nPresiona "Definir fecha" para abrir el calendario.');
        setPhase('np-camisa-date');
        break;
      }
      case 'np-camisa-date': {
        const nd = { ...draft, date: choice };
        setDraft(nd);
        setShowCal(false);
        setPickedDate(null);
        addBot(`Resumen del pedido:\n\nProducto: Camiseta personalizada\nCantidad: ${nd.qty || draft.qty}\nColor: ${nd.color || draft.color}\nTalla: ${nd.talla || draft.talla}\nEntrega: ${choice}\n\n¿Confirmas el pedido?`);
        setPhase('np-camisa-confirm');
        break;
      }
      case 'np-camisa-confirm':
        if (choice === 'Modificar pedido') {
          addBot('De acuerdo. ¿Cuántas camisetas necesitas?');
          setPhase('np-camisa-qty');
          break;
        }
        if (choice === 'Confirmar pedido') {
          onOrderCreated({
            id: '__new__',
            client: draft.name || 'Cliente',
            product: 'Camiseta personalizada',
            qty: `${draft.qty || '?'} unidades`,
            delivery: draft.date || '—',
            status: 'Confirmado',
          });
          onNotify({ text: 'Nuevo pedido recibido por WhatsApp', sub: `Camiseta personalizada – ${draft.name || 'Cliente'}`, type: 'info' });
          addBot('Pedido confirmado. Te notificaremos cuando esté listo. Gracias.', { label: '→ Ver en la plataforma', action: 'go-orders' });
          setPhase('order-done');
        } else { goMenu(); }
        break;

      // ── Arreglo floral ───────────────────────────────────────────
      case 'np-floral-flowers': {
        const nd = { ...draft, flowers: choice };
        setDraft(nd);
        addBot('¿Qué tamaño o presentación prefieres para el arreglo?');
        setPhase('np-floral-size');
        break;
      }
      case 'np-floral-size': {
        const nd = { ...draft, floralSize: choice };
        setDraft(nd);
        addBot('¿Para qué fecha necesitas el arreglo?\nPresiona "Definir fecha" para abrir el calendario.');
        setPhase('np-floral-date');
        break;
      }
      case 'np-floral-date': {
        const nd = { ...draft, date: choice };
        setDraft(nd);
        setShowCal(false);
        setPickedDate(null);
        addBot(`Resumen del pedido:\n\nProducto: Arreglo floral\nFlores: ${nd.flowers || draft.flowers}\nTamaño: ${nd.floralSize || draft.floralSize}\nEntrega: ${choice}\n\n¿Confirmas el pedido?`);
        setPhase('np-floral-confirm');
        break;
      }
      case 'np-floral-confirm':
        if (choice === 'Modificar pedido') {
          addBot('De acuerdo. ¿Qué tipo de flores prefieres?');
          setPhase('np-floral-flowers');
          break;
        }
        if (choice === 'Confirmar pedido') {
          onOrderCreated({
            id: '__new__',
            client: draft.name || 'Cliente',
            product: 'Arreglo floral',
            qty: `${draft.floralSize || '?'}`,
            delivery: draft.date || '—',
            status: 'Confirmado',
          });
          onNotify({ text: 'Nuevo pedido recibido por WhatsApp', sub: `Arreglo floral – ${draft.name || 'Cliente'}`, type: 'info' });
          addBot('Pedido confirmado. Te notificaremos cuando esté listo. Gracias.', { label: '→ Ver en la plataforma', action: 'go-orders' });
          setPhase('order-done');
        } else { goMenu(); }
        break;

      // ── Modificar pedido ─────────────────────────────────────────
      case 'mod-order': {
        const orderId = normalizeOrderId(choice);
        const order = allOrders.find(o => o.id === orderId);
        if (!order) {
          addBot(`No encontramos el pedido ${orderId}. Verifica el número e intenta de nuevo.`);
          setPhase('mod-order');
          break;
        }
        setDraft(prev => ({ ...prev, modOrderId: order.id, modClient: order.client }));
        addBot(`Pedido encontrado:\n\n${order.id} · ${order.product}\nCliente: ${order.client}\nCantidad actual: ${order.qty}\nEntrega: ${order.delivery}\nEstado: ${order.status}\n\n¿Qué deseas modificar?`);
        setPhase('mod-what');
        break;
      }

      case 'mod-name': {
        const clientOrders = allOrders.filter(o => o.client.toLowerCase() === choice.toLowerCase());
        if (clientOrders.length === 0) {
          addBot(`No encontramos pedidos registrados a nombre de "${choice}". Verifica el nombre e intenta de nuevo.`);
          break;
        }
        const ordersList = clientOrders.map(o => `— ${o.id} · ${o.product} · ${o.delivery} · ${o.status}`).join('\n');
        setDraft(prev => ({ ...prev, modOrderId: clientOrders[0].id, modClient: choice }));
        addBot(`Identidad verificada. Pedido(s) encontrado(s):\n\n${ordersList}\n\n¿Qué deseas modificar en ${clientOrders[0].id}?`);
        setPhase('mod-what');
        break;
      }
      case 'mod-what': {
        setDraft(prev => ({ ...prev, modField: choice }));
        if (choice === 'Fecha de entrega') {
          const currentOrder = allOrders.find(o => o.id === draft.modOrderId);
          addBot(`Fecha actual de entrega: ${currentOrder?.delivery ?? '—'}\n\n¿Cuál es la nueva fecha que deseas?\nPresiona "Definir fecha" para abrir el calendario.`);
          setPhase('mod-date');
          break;
        }
        if (choice === 'Cantidad') {
          addBot('¿A cuántas personas deseas cambiar la cantidad?');
        } else if (choice === 'Color o diseño') {
          addBot('¿Cuál es el nuevo color o diseño que deseas?');
        } else {
          addBot('Describe el cambio que necesitas:');
        }
        setPhase('mod-value');
        break;
      }
      case 'mod-date': {
        const newDateStr = choice;
        const currentOrder = allOrders.find(o => o.id === draft.modOrderId);
        const parseD = (s: string) => { const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null; };
        const newDate = parseD(newDateStr);
        const curDate = currentOrder ? parseD(currentOrder.delivery) : null;
        const isEarlier = newDate && curDate ? newDate < curDate : false;
        const ordId = draft.modOrderId || '#154';
        setShowCal(false);
        setPickedDate(null);
        if (isEarlier) {
          onChangeRequested({ orderId: ordId, client: draft.modClient || '', field: 'Fecha de entrega', newValue: newDateStr });
          addBot(`Fecha solicitada: ${newDateStr}\n\nComo la nueva fecha es más próxima que la actual (${currentOrder?.delivery ?? '—'}), el cambio requiere revisión del encargado porque implica adelantar la producción.\n\nTu solicitud ha sido registrada.`, { label: '→ Ver en cambios pendientes', action: 'go-cambios' });
        } else {
          onNotify({ text: 'Fecha de entrega postergada', sub: `Pedido ${ordId} – Nueva entrega: ${newDateStr}`, type: 'info' });
          addBot(`Fecha actualizada a ${newDateStr}.\n\nComo la nueva fecha es posterior a la original, el cambio se aplica automáticamente. El encargado ha sido notificado.`);
        }
        setPhase('mod-done');
        break;
      }

      case 'mod-value': {
        const ordId = draft.modOrderId || '#154';
        const currentOrder = allOrders.find(o => o.id === ordId);
        onNotify({ text: 'Cliente solicitó una modificación', sub: `Pedido ${ordId} – ${draft.modField} → ${choice}`, type: 'warning' });

        if (draft.modField === 'Cantidad') {
          const cantidadNueva = parseInt(choice, 10);
          const evaluacion = onRequestQuantityChange(ordId, cantidadNueva);
          if (evaluacion.resultado === 'aplicado' || evaluacion.resultado === 'rechazado') {
            addBot(`Solicitud de cambio procesada.\n\nPedido ${ordId}\nModificación: Cantidad → ${choice}\n\n${evaluacion.motivo}`, {
              label: '→ Ver decisión',
              action: `go-validation-${ordId}`,
            });
          } else if (evaluacion.resultado === 'pendiente-revision') {
            onChangeRequested({ orderId: ordId, client: draft.modClient || currentOrder?.client || '', field: 'Cantidad', newValue: choice });
            addBot(`Solicitud registrada para revisión.\n\nPedido ${ordId}\nModificación: Cantidad → ${choice}\n\n${evaluacion.motivo}`, {
              label: '→ Ver cambios pendientes',
              action: 'go-cambios',
            });
          } else {
            addBot(`No fue posible procesar el cambio.\n\n${evaluacion.motivo}`);
          }
        } else {
          onChangeRequested({ orderId: ordId, client: draft.modClient || currentOrder?.client || '', field: draft.modField || 'Campo', newValue: choice });
          addBot(`Solicitud registrada.\n\nPedido ${ordId}\nModificación: ${draft.modField} → ${choice}`, { label: '→ Ver cambios pendientes', action: 'go-cambios' });
        }
        setPhase('mod-done');
        break;
      }

      // ── Consultar pedido ─────────────────────────────────────────
      case 'consult-order': {
        const orderId = normalizeOrderId(choice);
        const found = allOrders.find(o => o.id === orderId);
        if (!found) {
          addBot(`No encontramos el pedido ${orderId}. Verifica el número e intenta de nuevo.`);
          setPhase('consult-order');
          break;
        }
        addBot(`Pedido ${found.id}\nProducto: ${found.product}\nCantidad: ${found.qty}\nEntrega: ${found.delivery}\nEstado: ${found.status}`);
        setPhase('consult-show');
        break;
      }

      case 'consult-name': {
        const found = allOrders.filter(o => o.client.toLowerCase() === choice.toLowerCase());
        if (found.length === 0) {
          addBot(`No encontramos pedidos a nombre de "${choice}". Verifica el nombre e intenta de nuevo.`);
          break;
        }
        const detail = found.map(o => `Pedido ${o.id}\nProducto: ${o.product}\nCantidad: ${o.qty}\nEntrega: ${o.delivery}\nEstado: ${o.status}`).join('\n\n---\n\n');
        addBot(detail);
        setPhase('consult-show');
        break;
      }

      default:
        if (choice === 'Volver al menú') goMenu();
        break;
    }
  };

  const handleDateFromCal = (date: string) => {
    setShowCal(false);
    setPickedDate(date);
  };

  const handleTimePick = (time: string) => {
    const fullDate = `${pickedDate} – ${time}`;
    handle(fullDate);
  };

  // ─ Input area renderer ─────────────────────────────────────────
  const renderInput = () => {
    const isDatePhase = DATE_PHASES.includes(phase) || (phase === 'np-torta-date' && draft.modField === 'Fecha de entrega');

    // Calendar open
    if (showCal) {
      return (
        <div className="space-y-2">
          <MiniCalendar onSelect={handleDateFromCal} />
          <button onClick={() => setShowCal(false)} className="w-full text-xs text-slate-400 py-1 hover:text-slate-600 transition-colors">Cancelar</button>
        </div>
      );
    }

    // Time picker after date selected
    if (pickedDate && isDatePhase) {
      return (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 text-center">Fecha: <strong>{pickedDate}</strong> — Elige la hora:</p>
          <div className="grid grid-cols-3 gap-1.5">
            {['09:00', '11:00', '13:00', '15:00', '16:00', '18:00'].map(t => (
              <button key={t} onClick={() => handleTimePick(t)} className="border border-[#128C7E]/40 text-[#128C7E] hover:bg-[#128C7E] hover:text-white font-medium py-2 rounded-xl text-sm transition-colors">
                {t}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Date phase: show calendar button
    if (isDatePhase) {
      return (
        <div className="space-y-1.5">
          <button onClick={() => setShowCal(true)} className="w-full border-2 border-[#128C7E] text-[#128C7E] hover:bg-[#128C7E] hover:text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
            <span>▦</span> Definir fecha
          </button>
        </div>
      );
    }

    // Photo phase
    if (phase === 'np-torta-photo') {
      return (
        <button
          onClick={() => handle('[Foto adjuntada]')}
          className="w-full border border-[#128C7E]/40 text-[#128C7E] hover:bg-[#128C7E] hover:text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
        >
          Adjuntar foto de referencia
        </button>
      );
    }

    if (phase === 'mod-order' || phase === 'consult-order') {
      return (
        <form className="space-y-2" onSubmit={e => { e.preventDefault(); handle(textInput); }}>
          <input
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            autoFocus
            inputMode="numeric"
            placeholder="Número de pedido, ej. 154"
            className="w-full border border-[#128C7E]/40 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#128C7E]/30"
          />
          <button type="submit" className="w-full bg-[#128C7E] hover:bg-[#0e6b5e] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">Continuar</button>
        </form>
      );
    }

    // Options per phase
    const clientNames = [...new Set(allOrders.map(o => o.client))];
    const OPTIONS: Partial<Record<WaPhase, string[]>> = {
      menu: ['Nuevo pedido', 'Modificar pedido', 'Consultar pedido', 'Mis pedidos'],
      'np-name': ['Laura Gómez', 'Daniel Ruiz', 'Camila Pérez', 'María Torres', 'Carlos Mendoza'],
      'np-product': ['Torta personalizada', 'Camiseta personalizada', 'Arreglo floral'],
      'np-torta-qty': ['10', '20', '25', '30 o más'],
      'np-torta-design': ['Elegir color', 'Enviar foto de referencia'],
      'np-torta-color': ['Azul', 'Rojo', 'Rosado', 'Verde', 'Blanco', 'Otro'],
      'np-torta-confirm': ['Confirmar pedido', 'Modificar pedido'],
      'np-camisa-qty': ['5', '10', '15', '20', '25 o más'],
      'np-camisa-color': ['Blanco', 'Negro', 'Azul', 'Rojo', 'Gris', 'Personalizado'],
      'np-camisa-talla': ['S', 'M', 'L', 'XL', 'XXL', 'Varias tallas'],
      'np-camisa-confirm': ['Confirmar pedido', 'Modificar pedido'],
      'np-floral-flowers': ['Rosas', 'Girasoles', 'Lirios', 'Orquídeas', 'Tulipanes', 'Mixto'],
      'np-floral-size': ['Pequeño (30×30 cm)', 'Mediano (50×50 cm)', 'Grande (70×70 cm)', 'Extra grande'],
      'np-floral-confirm': ['Confirmar pedido', 'Modificar pedido'],
      'mod-name': clientNames,
      'mod-what': ['Cantidad', 'Color o diseño', 'Fecha de entrega', 'Otro'],
      'mod-value': ['25 personas', '30 personas', '35 o más', 'Color rojo', 'Color azul', 'Otro'],
      'consult-name': clientNames,
      'consult-show': ['Volver al menú'],
      'my-orders': ['Volver al menú'],
      'order-done': ['Volver al menú'],
      'mod-done': ['Volver al menú'],
    };

    const opts = OPTIONS[phase];
    if (!opts) return null;

    return (
      <div className="space-y-1.5">
        {opts.map(o => (
          <button
            key={o}
            onClick={() => handle(o)}
            className="w-full border border-[#128C7E]/40 text-[#128C7E] hover:bg-[#128C7E] hover:text-white font-medium py-2 rounded-xl text-sm transition-colors text-left px-4"
          >
            {o}
          </button>
        ))}
      </div>
    );
  };

  const lastMsg = msgs[msgs.length - 1];

  return (
    <div className="flex-1 flex items-start justify-center py-6 bg-slate-100 overflow-y-auto custom-scroll">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-300 flex flex-col" style={{ minHeight: '600px', maxHeight: 'calc(100vh - 120px)' }}>
        {/* WA Header */}
        <div className="bg-[#128C7E] px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-[#0e6b5e] flex items-center justify-center text-white font-bold text-xs font-mono-data border border-white/20">PF</div>
          <div className="flex-1">
            <div className="text-white font-semibold text-sm">PedidosFlow</div>
            <div className="text-white/60 text-xs">asistente de pedidos</div>
          </div>
          {phase !== 'menu' && (
            <button onClick={goMenu} className="text-white/70 hover:text-white text-xs border border-white/30 px-2 py-1 rounded-lg transition-colors">
              Menu
            </button>
          )}
        </div>

        {/* Chat */}
        <div className="wa-bg flex flex-col p-3 gap-2 overflow-y-auto custom-scroll flex-1">
          {msgs.map((msg, i) => (
            <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'} animate-slide-in`}>
              <div className={`max-w-[82%] rounded-2xl px-3 py-2 shadow-sm ${msg.from === 'user' ? 'bg-[#DCF8C6] rounded-tr-sm' : 'bg-white rounded-tl-sm'}`}>
                {msg.photo && (
                  <img src={msg.photo} alt="Foto de referencia" className="rounded-lg mb-1 border border-slate-200 bg-slate-100" style={{ width: '160px', height: '160px', objectFit: 'cover' }} />
                )}
                <p className="text-slate-800 whitespace-pre-wrap leading-relaxed" style={{ fontSize: '13px' }}>{msg.text}</p>
                <div className="text-right mt-1">
                  <span className="text-slate-400" style={{ fontSize: '10px' }}>{msg.time}{msg.from === 'user' ? ' ✓✓' : ''}</span>
                </div>
                {msg.navBtn && (
                  <button
                    onClick={() => onNavigate(msg.navBtn!.action)}
                    className="mt-2 w-full bg-[#128C7E] hover:bg-[#0e6b5e] text-white font-semibold py-2 rounded-xl text-xs transition-colors"
                  >
                    {msg.navBtn.label}
                  </button>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input zone */}
        <div className="bg-white border-t border-slate-100 p-3 space-y-2 flex-shrink-0">
          {renderInput()}
          {phase !== 'menu' && !showCal && !pickedDate && (
            <button onClick={goMenu} className="w-full text-xs text-slate-400 hover:text-slate-600 py-1 transition-colors border-t border-slate-50 pt-2 mt-1">
              ← Volver al menú principal
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Configuracion ────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${value ? 'bg-emerald-500' : 'bg-slate-200'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}

function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <h2 className="font-display font-semibold text-slate-700 text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function RuleSelect({ value, onChange }: { value: RuleDecision; onChange: (v: RuleDecision) => void }) {
  const labels: Record<RuleDecision, string> = { auto: 'Automático', review: 'Revisión', blocked: 'Bloqueado' };
  const colors: Record<RuleDecision, string> = { auto: 'text-emerald-700 bg-emerald-50 border-emerald-200', review: 'text-amber-700 bg-amber-50 border-amber-200', blocked: 'text-red-700 bg-red-50 border-red-200' };
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as RuleDecision)}
      className={`text-xs font-semibold border rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-slate-400 ${colors[value]}`}
    >
      <option value="auto">Automático</option>
      <option value="review">Revisión</option>
      <option value="blocked">Bloqueado</option>
    </select>
  );
}

function ConfiguracionView({ validationRules, onRulesChange }: {
  validationRules: RuleMatrix;
  onRulesChange: (r: RuleMatrix) => void;
}) {
  const [saved, setSaved] = useState(false);
  const [businessName, setBusinessName] = useState('PedidosFlow Demo');
  const [businessEmail, setBusinessEmail] = useState('pedidos@ejemplo.com');
  const [businessPhone, setBusinessPhone] = useState('+57 300 000 0000');
  const [localRules, setLocalRules] = useState<RuleMatrix>({ ...validationRules });
  const [minHours, setMinHours] = useState(24);
  const [condChecks, setCondChecks] = useState({ requireName: true, blockLate: true, allowManual: true });
  const [products, setProducts] = useState({ torta: true, camisa: true, floral: true, custom: false });
  const [botActive, setBotActive] = useState(true);
  const [autoReply, setAutoReply] = useState(true);
  const [photoReview, setPhotoReview] = useState(true);
  const [notifEvents, setNotifEvents] = useState({ newOrder: true, changeReq: true, autoApproved: true, autoRejected: true, manualApproved: false, production: true });
  const [stages, setStages] = useState([...STAGES]);
  const [newStage, setNewStage] = useState('');

  const RULE_COLS = ['Antes de producción', 'En producción', 'Control final'];

  const handleSave = () => {
    onRulesChange(localRules);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleRuleChange = (rule: string, colIdx: number, val: RuleDecision) => {
    setLocalRules(prev => {
      const row = [...prev[rule]] as [RuleDecision, RuleDecision, RuleDecision];
      row[colIdx] = val;
      return { ...prev, [rule]: row };
    });
  };

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-slate-800">Configuración</h1>
          <p className="text-sm text-slate-500 mt-0.5">Ajusta las reglas de validación, el bot y el comportamiento del sistema.</p>
        </div>
      </div>

      {/* 1. Información del negocio */}
      <ConfigSection title="Información del negocio">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Nombre del negocio', value: businessName, onChange: setBusinessName },
            { label: 'Correo electrónico', value: businessEmail, onChange: setBusinessEmail },
            { label: 'Teléfono de contacto', value: businessPhone, onChange: setBusinessPhone },
          ].map(f => (
            <div key={f.label}>
              <label className="text-xs text-slate-400 uppercase tracking-wide font-semibold block mb-1">{f.label}</label>
              <input
                value={f.value}
                onChange={e => f.onChange(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
              />
            </div>
          ))}
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-wide font-semibold block mb-1">Zona horaria</label>
            <select className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white">
              <option>America/Bogota (GMT-5)</option>
              <option>America/Lima (GMT-5)</option>
              <option>America/Santiago (GMT-4)</option>
            </select>
          </div>
        </div>
      </ConfigSection>

      {/* 2. Reglas para modificaciones */}
      <ConfigSection title="Reglas para modificaciones (Motor de validación)">
        <p className="text-xs text-slate-500 mb-4">Define qué sucede cuando un cliente solicita un cambio según la etapa de producción actual. Estas reglas afectan directamente la decisión automática del sistema.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 pr-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">Tipo de cambio</th>
                {RULE_COLS.map(c => (
                  <th key={c} className="text-center py-2 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {Object.entries(localRules).map(([rule, decisions]) => (
                <tr key={rule} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 pr-4 font-medium text-slate-700 text-sm">{rule}</td>
                  {decisions.map((d, colIdx) => (
                    <td key={colIdx} className="py-2.5 px-3 text-center">
                      <RuleSelect value={d} onChange={val => handleRuleChange(rule, colIdx, val)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Automático = el sistema aprueba sin intervención</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Revisión = se envía alerta al encargado</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Bloqueado = rechazo automático sin opción</span>
        </div>
      </ConfigSection>

      {/* 3. Etapas de producción */}
      <ConfigSection title="Etapas de producción">
        <p className="text-xs text-slate-500 mb-3">El orden de estas etapas determina el avance en el checklist de producción y afecta las reglas de validación.</p>
        <div className="space-y-1.5 mb-3">
          {stages.map((s, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 text-sm text-slate-700">
              <span className="font-mono-data text-xs text-slate-400 w-5">{i + 1}.</span>
              <span className="flex-1">{s}</span>
              <button onClick={() => setStages(prev => prev.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-400 transition-colors text-xs">×</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newStage}
            onChange={e => setNewStage(e.target.value)}
            placeholder="Nueva etapa..."
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <button
            onClick={() => { if (newStage.trim()) { setStages(p => [...p, newStage.trim()]); setNewStage(''); } }}
            className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors"
          >
            + Agregar
          </button>
        </div>
      </ConfigSection>

      {/* 4. Condiciones de validación */}
      <ConfigSection title="Condiciones de validación">
        <div className="space-y-3">
          {([
            { key: 'requireName' as const, label: 'Requerir nombre para solicitar cambios', sub: 'El cliente debe identificarse antes de modificar un pedido' },
            { key: 'blockLate' as const, label: 'Bloquear cambios con menos de N horas de anticipación', sub: 'Rechazar automáticamente si el margen de tiempo es insuficiente' },
            { key: 'allowManual' as const, label: 'Permitir revisión manual para rechazos', sub: 'El encargado puede revisar y revertir un rechazo automático' },
          ]).map(c => (
            <div key={c.key} className="flex items-start justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
              <div>
                <div className="text-sm font-medium text-slate-700">{c.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{c.sub}</div>
              </div>
              <Toggle value={condChecks[c.key]} onChange={v => setCondChecks(p => ({ ...p, [c.key]: v }))} />
            </div>
          ))}
          {condChecks.blockLate && (
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
              <span className="text-sm text-slate-700 flex-1">Mínimo de horas de anticipación para cambios</span>
              <input
                type="number"
                min={1}
                max={168}
                value={minHours}
                onChange={e => setMinHours(Number(e.target.value))}
                className="w-16 text-sm font-mono-data text-center border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <span className="text-xs text-slate-500">horas</span>
            </div>
          )}
        </div>
      </ConfigSection>

      {/* 5. Productos y personalizaciones */}
      <ConfigSection title="Productos y personalizaciones">
        <p className="text-xs text-slate-500 mb-3">Activa los productos que el bot puede ofrecer y gestionar.</p>
        <div className="space-y-2">
          {([
            { key: 'torta' as const, label: 'Torta personalizada', sub: 'Incluye opciones de color, diseño, foto de referencia y cantidad de personas' },
            { key: 'camisa' as const, label: 'Camiseta personalizada', sub: 'Incluye cantidad, colores y tallas' },
            { key: 'floral' as const, label: 'Arreglo floral', sub: 'Incluye tipo de flores y tamaño de presentación' },
            { key: 'custom' as const, label: 'Productos personalizados adicionales', sub: 'Habilita flujo genérico para otros tipos de producto' },
          ]).map(p => (
            <div key={p.key} className="flex items-start justify-between gap-4 py-2.5 px-3 bg-slate-50 rounded-lg border border-slate-100">
              <div>
                <div className="text-sm font-medium text-slate-700">{p.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{p.sub}</div>
              </div>
              <Toggle value={products[p.key]} onChange={v => setProducts(prev => ({ ...prev, [p.key]: v }))} />
            </div>
          ))}
        </div>
      </ConfigSection>

      {/* 6. WhatsApp + Bot */}
      <ConfigSection title="WhatsApp + Bot">
        <div className="space-y-3">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className={`w-2.5 h-2.5 rounded-full ${botActive ? 'bg-emerald-500 animate-pulse-dot' : 'bg-slate-300'}`} />
            <span className="text-sm font-medium text-slate-700 flex-1">Estado de conexión del bot</span>
            <span className={`text-xs font-semibold ${botActive ? 'text-emerald-600' : 'text-slate-400'}`}>{botActive ? 'Conectado' : 'Desconectado'}</span>
            <Toggle value={botActive} onChange={setBotActive} />
          </div>
          {([
            { label: 'Respuesta automática a mensajes', sub: 'El bot inicia la conversación sin intervención del encargado', val: autoReply, set: setAutoReply },
            { label: 'Revisión de fotos de diseño', sub: 'Solicitar foto de referencia como opción de diseño personalizado', val: photoReview, set: setPhotoReview },
          ]).map(f => (
            <div key={f.label} className="flex items-start justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
              <div>
                <div className="text-sm font-medium text-slate-700">{f.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{f.sub}</div>
              </div>
              <Toggle value={f.val} onChange={f.set} />
            </div>
          ))}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs text-slate-500">Número de WhatsApp vinculado:</span>
            <span className="font-mono-data text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">+57 300 000 0000</span>
            <button className="text-xs text-blue-600 hover:underline">Cambiar</button>
          </div>
        </div>
      </ConfigSection>

      {/* 7. Notificaciones */}
      <ConfigSection title="Notificaciones">
        <p className="text-xs text-slate-500 mb-3">Elige qué eventos generan una notificación en el panel de la plataforma.</p>
        <div className="space-y-2">
          {([
            { key: 'newOrder' as const, label: 'Nuevo pedido recibido' },
            { key: 'changeReq' as const, label: 'Cliente solicita modificación' },
            { key: 'autoApproved' as const, label: 'Cambio aprobado automáticamente' },
            { key: 'autoRejected' as const, label: 'Cambio rechazado automáticamente' },
            { key: 'manualApproved' as const, label: 'Aprobación manual de encargado' },
            { key: 'production' as const, label: 'Actualización de etapa de producción' },
          ]).map(n => (
            <div key={n.key} className="flex items-center justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
              <span className="text-sm text-slate-700">{n.label}</span>
              <Toggle value={notifEvents[n.key]} onChange={v => setNotifEvents(p => ({ ...p, [n.key]: v }))} />
            </div>
          ))}
        </div>
      </ConfigSection>

      {/* 8. Usuarios y permisos */}
      <ConfigSection title="Usuarios y permisos">
        <div className="space-y-2 mb-4">
          {[
            { name: 'Administrador', email: 'admin@ejemplo.com', role: 'Administrador' },
            { name: 'Encargado de producción', email: 'produccion@ejemplo.com', role: 'Encargado' },
            { name: 'Operador bot', email: 'bot@ejemplo.com', role: 'Solo lectura' },
          ].map(u => (
            <div key={u.email} className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
              <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 text-xs font-bold flex-shrink-0">{u.name[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700 truncate">{u.name}</div>
                <div className="text-xs text-slate-400 truncate">{u.email}</div>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">{u.role}</span>
            </div>
          ))}
        </div>
        <button className="text-sm font-semibold text-blue-600 hover:underline">Administrar usuarios →</button>
      </ConfigSection>

      {/* Fixed bottom save bar */}
      <div className="fixed bottom-0 left-52 right-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between z-30">
        {saved ? (
          <span className="text-sm font-medium text-emerald-600 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Configuración actualizada correctamente
          </span>
        ) : (
          <span className="text-xs text-slate-400">Los cambios en las reglas de validación se aplican de inmediato al motor.</span>
        )}
        <div className="flex gap-2">
          <button onClick={() => setLocalRules({ ...validationRules })} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors">Cancelar</button>
          <button onClick={handleSave} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-lg transition-colors">Guardar cambios</button>
        </div>
      </div>
    </div>
  );
}

// ─── Notifications ────────────────────────────────────────────────────────────

function NotificationsPanel({ notifs, onClose, onMarkRead }: {
  notifs: Notif[]; onClose: () => void; onMarkRead: (id: number) => void;
}) {
  return (
    <div className="absolute right-4 top-14 w-80 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 animate-slide-in overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <span className="font-display font-semibold text-slate-800 text-sm">Notificaciones</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
      </div>
      <div className="max-h-80 overflow-y-auto custom-scroll divide-y divide-slate-50">
        {notifs.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">Sin notificaciones</p>
        ) : notifs.map(n => (
          <div key={n.id} onClick={() => onMarkRead(n.id)} className={`px-4 py-3 cursor-pointer hover:bg-slate-50 flex gap-3 transition-colors ${!n.read ? 'bg-blue-50/30' : ''}`}>
            <div className="mt-1.5"><Dot type={n.type} /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-700 leading-tight">{n.text}</div>
              <div className="text-xs text-slate-400 mt-0.5 truncate">{n.sub}</div>
            </div>
            {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const persistedDecisions = readJson<QuantityDecision[]>(QUANTITY_DECISION_KEY, []);
  const [mode, setMode] = useState<Mode>('platform');
  const [nav, setNav] = useState<Nav>('pedidos');
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [change154State, setChange154State] = useState<Change154State>(persistedDecisions.some(d => d.orderId === '#154' && d.result === 'approved') ? 'approved' : null);
  const [change155State, setChange155State] = useState<Change155State>(persistedDecisions.some(d => d.orderId === '#155' && d.result === 'rejected') ? 'rejected' : null);
  const [order154Qty, setOrder154Qty] = useState(() => leerCantidadGuardada('#154', 20));
  const [pendingQty154, setPendingQty154] = useState<number | null>(null);
  const [photoState, setPhotoState] = useState<PhotoState>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean[]>>(() => readJson<Record<string, boolean[]>>(CHECKLIST_KEY, INITIAL_CHECKLIST));
  const [notifs, setNotifs] = useState<Notif[]>(INITIAL_NOTIFS);
  const [showNotifs, setShowNotifs] = useState(false);
  const [dynamicOrders, setDynamicOrders] = useState<BotOrder[]>(() => readJson<BotOrder[]>('pedidosflow_dynamic_orders_v1', []));
  const nextOrderIdRef = useRef(157);
  const [validationRules, setValidationRules] = useState<RuleMatrix>(DEFAULT_RULES);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>(() => readJson<ChangeRequest[]>('pedidosflow_change_requests_v1', []));
  const [pendingPhotoOrder, setPendingPhotoOrder] = useState<BotOrder | null>(null);

  const [quantityDecisions, setQuantityDecisions] = useState<QuantityDecision[]>(persistedDecisions);

  useEffect(() => writeJson(QUANTITY_DECISION_KEY, quantityDecisions), [quantityDecisions]);
  useEffect(() => writeJson(CHECKLIST_KEY, checklist), [checklist]);
  useEffect(() => writeJson('pedidosflow_dynamic_orders_v1', dynamicOrders), [dynamicOrders]);
  useEffect(() => writeJson('pedidosflow_change_requests_v1', changeRequests), [changeRequests]);
  useEffect(() => {
    const ids = [...STATIC_ORDERS, ...dynamicOrders].map(o => Number(o.id.replace(/[^0-9]/g, ''))).filter(Number.isFinite);
    nextOrderIdRef.current = Math.max(156, ...ids) + 1;
  }, [dynamicOrders]);

  const unread = notifs.filter(n => !n.read).length;

  const addNotif = (n: Omit<Notif, 'id' | 'read'>) =>
    setNotifs(prev => [{ ...n, id: Date.now(), read: false }, ...prev]);

  const handleOrderCreated = (order: BotOrder) => {
    const id = nextOrderIdRef.current;
    nextOrderIdRef.current += 1;
    const newOrder = { ...order, id: `#${id}` };
    setDynamicOrders(prev => [newOrder, ...prev]);
    return newOrder;
  };

  const handlePhotoReviewNeeded = (order: BotOrder) => {
    setPendingPhotoOrder(order);
    setPhotoState('pending-review');
    addNotif({ text: 'Revisión de diseño requerida', sub: `${order.id} – ${order.client} · diseño personalizado`, type: 'info' });
  };

  const handleChangeRequested = (req: { orderId: string; client: string; field: string; newValue: string }) => {
    const newReq: ChangeRequest = {
      id: `CR-${Date.now()}`,
      ...req,
      status: 'pending',
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    };
    setChangeRequests(prev => [newReq, ...prev]);
    addNotif({ text: 'Cambio requiere revisión del encargado', sub: `Pedido ${req.orderId} – ${req.field}: ${req.newValue}`, type: 'warning' });
  };

  const handleApproveChangeReq = (id: string) => {
    setChangeRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
    addNotif({ text: 'Cambio aprobado por encargado', sub: `Solicitud ${id}`, type: 'success' });
  };

  const handleRejectChangeReq = (id: string) => {
    setChangeRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
    addNotif({ text: 'Cambio rechazado por encargado', sub: `Solicitud ${id}`, type: 'danger' });
  };

  const toggleChecklist = (orderId: string, idx: number) => {
    setChecklist(prev => {
      const stages = [...(prev[orderId] || STAGES.map(() => false))];
      stages[idx] = !stages[idx];
      if (!stages[idx]) {
        for (let i = idx + 1; i < stages.length; i++) stages[i] = false;
      }
      return { ...prev, [orderId]: stages };
    });
  };

  const handleWaNavigate = (action: string) => {
    if (action === 'go-orders') {
      setMode('platform'); setNav('pedidos'); setSelectedOrder(null);
    } else if (action.startsWith('go-validation-')) {
      const orderId = normalizeOrderId(action.replace('go-validation-', ''));
      setMode('platform'); setNav('pedidos'); setSelectedOrder(orderId);
      const last = quantityDecisions.filter(d => d.orderId === orderId).slice(-1)[0];
      if (orderId === '#154' && !last) setChange154State('validating');
      if (orderId === '#155' && last?.result === 'rejected') setChange155State('rejected');
    } else if (action === 'go-cambios') {
      setMode('platform'); setNav('cambios'); setSelectedOrder(null);
    } else if (action === 'go-photo-review') {
      setMode('platform'); setNav('cambios');
    }
  };

  const handleRequestQuantityChange = (pedidoId: string, cantidadNueva: unknown): EvaluacionCambioCantidad => {
    const orderId = normalizeOrderId(pedidoId);
    const allOrdersNow = [...dynamicOrders, ...STATIC_ORDERS];
    const order = allOrdersNow.find(o => o.id === orderId);
    if (!order) return { resultado: 'invalido', motivo: `No se encontró el pedido ${orderId}.` };

    const etapa = derivarEtapa(checklist[orderId]);
    const evaluacion = evaluarCambioCantidad(etapa, cantidadNueva);
    const formato = validarFormatoCantidad(cantidadNueva);
    const previousQty = orderId === '#154' ? order154Qty : parseQuantity(order.qty);
    if (!formato.valido) return evaluacion;

    if (evaluacion.resultado === 'aplicado') {
      setPendingQty154(formato.cantidad);
      if (orderId === '#154') setChange154State('validating');
      return evaluacion;
    }

    if (evaluacion.resultado === 'rechazado' && orderId === '#155') {
      const decision: QuantityDecision = {
        orderId,
        previousValue: previousQty,
        newValue: formato.cantidad,
        result: 'rejected',
        reason: evaluacion.motivo,
        timestamp: new Date().toISOString(),
      };
      setQuantityDecisions(prev => [...prev.filter(d => d.orderId !== orderId), decision]);
      setChange155State('rejected');
      addNotif({ text: 'Cambio rechazado automáticamente', sub: `Pedido ${orderId} – Cantidad: ${formato.cantidad} personas`, type: 'danger' });
    }

    return evaluacion;
  };

  const handleApproveChange154 = () => {
    if (pendingQty154 === null) return;
    const cantidadAnterior = order154Qty;
    setOrder154Qty(pendingQty154);
    guardarCantidad('#154', pendingQty154);
    setChange154State('approved');
    const decision: QuantityDecision = {
      orderId: '#154',
      previousValue: cantidadAnterior,
      newValue: pendingQty154,
      result: 'approved',
      reason: 'Cambio aprobado automáticamente: el pedido aún no ha iniciado producción.',
      timestamp: new Date().toISOString(),
    };
    setQuantityDecisions(prev => [...prev.filter(d => d.orderId !== '#154'), decision]);
    addNotif({ text: 'Cambio aprobado automáticamente', sub: `Pedido #154 – Cantidad: ${cantidadAnterior} → ${pendingQty154} personas`, type: 'success' });
    setPendingQty154(null);
  };

  const handleApproveManual155 = () => {
    setChange155State('manually-approved');
    addNotif({ text: 'Cambio aprobado manualmente', sub: 'Pedido #155 – Responsable: Administrador', type: 'warning' });
  };

  const handleMaintainReject155 = () => {
    setChange155State('maintained');
    addNotif({ text: 'Rechazo confirmado por encargado', sub: 'Pedido #155 – Decisión registrada', type: 'danger' });
  };

  const unread = notifs.filter(n => !n.read).length;

  const addNotif = (n: Omit<Notif, 'id' | 'read'>) =>
    setNotifs(prev => [{ ...n, id: Date.now(), read: false }, ...prev]);

  const handleOrderCreated = (order: BotOrder) => {
    const id = nextOrderIdRef.current;
    nextOrderIdRef.current += 1;
    const newOrder = { ...order, id: `#${id}` };
    setDynamicOrders(prev => [newOrder, ...prev]);
    return newOrder;
  };

  const handlePhotoReviewNeeded = (order: BotOrder) => {
    setPendingPhotoOrder(order);
    setPhotoState('pending-review');
    addNotif({ text: 'Revisión de diseño requerida', sub: `${order.id} – ${order.client} · diseño personalizado`, type: 'info' });
  };

  const handleChangeRequested = (req: { orderId: string; client: string; field: string; newValue: string }) => {
    const newReq: ChangeRequest = {
      id: `CR-${Date.now()}`,
      ...req,
      status: 'pending',
      timestamp: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    };
    setChangeRequests(prev => [newReq, ...prev]);
    addNotif({ text: 'Cambio requiere revisión del encargado', sub: `Pedido ${req.orderId} – ${req.field}: ${req.newValue}`, type: 'warning' });
  };

  const handleApproveChangeReq = (id: string) => {
    setChangeRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
    addNotif({ text: 'Cambio aprobado por encargado', sub: `Solicitud ${id}`, type: 'success' });
  };

  const handleRejectChangeReq = (id: string) => {
    setChangeRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
    addNotif({ text: 'Cambio rechazado por encargado', sub: `Solicitud ${id}`, type: 'danger' });
  };

  const toggleChecklist = (orderId: string, idx: number) => {
    setChecklist(prev => {
      const stages = [...(prev[orderId] || STAGES.map(() => false))];
      stages[idx] = !stages[idx];
      // If unchecking, uncheck all subsequent
      if (!stages[idx]) {
        for (let i = idx + 1; i < stages.length; i++) stages[i] = false;
      }
      return { ...prev, [orderId]: stages };
    });
  };

  const handleWaNavigate = (action: string) => {
    if (action === 'go-orders') { setMode('platform'); setNav('pedidos'); setSelectedOrder(null); }
    else if (action === 'go-validation-154') { setMode('platform'); setNav('pedidos'); setChange154State('validating'); setSelectedOrder('#154'); }
    else if (action === 'go-validation-155') { setMode('platform'); setNav('pedidos'); setChange155State('rejected'); setSelectedOrder('#155'); }
    else if (action === 'go-cambios') { setMode('platform'); setNav('cambios'); setSelectedOrder(null); }
    else if (action === 'go-photo-review') { setMode('platform'); setNav('cambios'); }
  };

  const handleRequestQuantityChange = (pedidoId: string, cantidadNueva: unknown): EvaluacionCambioCantidad => {
    const etapa = derivarEtapa(checklist[pedidoId]);
    const evaluacion = evaluarCambioCantidad(etapa, cantidadNueva);
    if (pedidoId === '#154' && evaluacion.resultado === 'aplicado') {
      const formato = validarFormatoCantidad(cantidadNueva);
      if (formato.valido) {
        setPendingQty154(formato.cantidad);
        setChange154State('validating');
      }
    }
    return evaluacion;
  };

  const handleApproveChange154 = () => {
    if (pendingQty154 === null) return;
    const cantidadAnterior = order154Qty;
    setOrder154Qty(pendingQty154);
    guardarCantidad('#154', pendingQty154);
    setChange154State('approved');
    addNotif({ text: 'Cambio aprobado automáticamente', sub: `Pedido #154 – Cantidad: ${cantidadAnterior} → ${pendingQty154} personas`, type: 'success' });
    setPendingQty154(null);
  };

  const handleApproveManual155 = () => {
    setChange155State('manually-approved');
    addNotif({ text: 'Cambio aprobado manualmente', sub: 'Pedido #155 – Responsable: Administrador', type: 'warning' });
  };

  const handleMaintainReject155 = () => {
    setChange155State('maintained');
    addNotif({ text: 'Rechazo confirmado por encargado', sub: 'Pedido #155 – Decisión registrada', type: 'danger' });
  };

  const sidebarItems: { id: Nav; label: string; badge?: number }[] = [
    { id: 'pedidos', label: 'Pedidos', badge: dynamicOrders.length + 5 },
    { id: 'cambios', label: 'Cambios pendientes', badge: changeRequests.filter(r => r.status === 'pending').length },
    { id: 'produccion', label: 'Producción', badge: 2 },
    { id: 'clientes', label: 'Clientes' },
    { id: 'historial', label: 'Historial' },
    { id: 'configuracion', label: 'Configuración' },
  ];

  const renderContent = () => {
    if (selectedOrder) {
      return (
        <OrderDetailView
          orderId={selectedOrder}
          order154Qty={order154Qty}
          change154State={change154State}
          change155State={change155State}
          checklist={checklist}
          quantityDecisions={quantityDecisions}
          pendingQty={pendingQty154}
          onApproveChange={handleApproveChange154}
          onClose={() => setSelectedOrder(null)}
          onGoChanges={() => { setSelectedOrder(null); setNav('cambios'); }}
          dynamicOrders={dynamicOrders}
        />
      );
    }
    switch (nav) {
      case 'pedidos':
        return <DashboardView onSelectOrder={setSelectedOrder} order154Qty={order154Qty} change154State={change154State} change155State={change155State} photoState={photoState} onAcceptPhoto={() => { setPhotoState('accepted'); addNotif({ text: 'Diseño personalizado confirmado', sub: 'Pedido #156 – Diseño viable', type: 'success' }); }} onRejectPhoto={() => { setPhotoState('rejected'); addNotif({ text: 'Diseño no viable', sub: 'Pedido #156 – Cancelado', type: 'danger' }); }} dynamicOrders={dynamicOrders} pendingChangesCount={changeRequests.filter(r => r.status === 'pending').length} />;
      case 'cambios':
        return <CambiosPendientesView
          change155State={change155State}
          photoState={photoState}
          changeRequests={changeRequests}
          pendingPhotoOrder={pendingPhotoOrder}
          onReview={() => {}}
          onApproveManual={handleApproveManual155}
          onMaintainReject={handleMaintainReject155}
          onAcceptPhoto={() => {
            setPhotoState('accepted');
            const orderId = pendingPhotoOrder?.id ?? '#156';
            addNotif({ text: 'Diseño personalizado confirmado', sub: `Pedido ${orderId} – diseño viable`, type: 'success' });
            setDynamicOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Confirmado' } : o));
          }}
          onRejectPhoto={() => {
            setPhotoState('rejected');
            const orderId = pendingPhotoOrder?.id ?? '#156';
            addNotif({ text: 'Diseño no viable', sub: `Pedido ${orderId} cancelado`, type: 'danger' });
            setDynamicOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Cancelado' } : o));
          }}
          onApproveChangeReq={handleApproveChangeReq}
          onRejectChangeReq={handleRejectChangeReq}
        />;
      case 'produccion':
        return <ProduccionView checklist={checklist} onToggle={toggleChecklist} />;
      case 'historial':
        return <HistorialView order154Qty={order154Qty} change154State={change154State} change155State={change155State} quantityDecisions={quantityDecisions} />;
      case 'clientes':
        return (
          <div className="space-y-5">
            <h1 className="font-display font-bold text-xl text-slate-800">Clientes</h1>
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b border-slate-100">{['Cliente', 'Pedidos', 'Último pedido', 'Estado'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {[{ name: 'Laura Gómez', orders: 3, last: '27/08/2025' }, { name: 'Daniel Ruiz', orders: 1, last: '27/08/2025' }, { name: 'Camila Pérez', orders: 1, last: '27/08/2025' }, { name: 'María Torres', orders: 1, last: '28/08/2025' }].map(c => (
                    <tr key={c.name} className="hover:bg-slate-50"><td className="px-4 py-3 font-medium text-slate-700">{c.name}</td><td className="px-4 py-3 text-slate-600">{c.orders}</td><td className="px-4 py-3 font-mono-data text-xs text-slate-500">{c.last}</td><td className="px-4 py-3"><Badge type="success">Activo</Badge></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'configuracion':
        return <ConfiguracionView validationRules={validationRules} onRulesChange={setValidationRules} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 flex items-center px-4 h-14 flex-shrink-0 relative z-40">
        <div className="flex items-center gap-2 mr-6">
          <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-white font-bold text-xs font-mono-data">PF</div>
          <span className="font-display font-bold text-slate-800">PedidosFlow</span>
        </div>
        <div className="flex bg-slate-100 rounded-lg p-1 gap-1 mr-auto">
          {([{ id: 'platform', label: 'Plataforma' }, { id: 'whatsapp', label: 'WhatsApp + Bot' }] as { id: Mode; label: string }[]).map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === m.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{m.label}</button>
          ))}
        </div>
        <button onClick={() => setShowNotifs(v => !v)} className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <span className="text-base font-mono-data text-slate-500 select-none">[n]</span>
          {unread > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">{unread}</span>}
        </button>
        {showNotifs && <NotificationsPanel notifs={notifs} onClose={() => setShowNotifs(false)} onMarkRead={(id) => setNotifs(p => p.map(n => n.id === id ? { ...n, read: true } : n))} />}
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {mode === 'platform' && (
          <aside className="w-52 bg-slate-800 flex-shrink-0 flex flex-col py-4">
            <nav className="space-y-0.5 px-2 flex-1">
              {sidebarItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setNav(item.id); setSelectedOrder(null); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${nav === item.id && !selectedOrder ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                  <span className="flex-1">{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span className="text-xs font-mono-data px-1.5 py-0.5 rounded bg-white/10 text-slate-300">{item.badge}</span>
                  ) : null}
                </button>
              ))}
            </nav>
          </aside>
        )}
        <main className="flex-1 overflow-hidden flex flex-col">
          {mode === 'platform' ? (
            <div className="flex-1 overflow-y-auto custom-scroll p-6">{renderContent()}</div>
          ) : (
            <WhatsAppView
              onNavigate={handleWaNavigate}
              onOrderCreated={handleOrderCreated}
              onNotify={addNotif}
              allOrders={[...dynamicOrders, ...STATIC_ORDERS.map(o => o.id === '#154' ? { ...o, qty: `${order154Qty} personas` } : o)]}
              onChangeRequested={handleChangeRequested}
              onPhotoReviewNeeded={handlePhotoReviewNeeded}
              onRequestQuantityChange={handleRequestQuantityChange}
            />
          )}
        </main>
      </div>
    </div>
  );
}
