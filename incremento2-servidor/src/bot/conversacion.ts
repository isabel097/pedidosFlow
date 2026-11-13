import {
  MENSAJE_SIN_CONEXION,
  TEXTO_AYUDA,
  enviarCambio,
  errorDeApi,
  formatearPedido,
  procesarMensaje,
  type ClienteApi
} from './comandos.js';
import {
  extraerCantidad,
  extraerIdEnRespuesta,
  interpretarFecha,
  interpretarHora,
  interpretarMensaje,
  interpretarSiNo,
  pideElMismoPedido
} from './lenguaje.js';

export interface Respuesta {
  texto: string;
  /** Botones de respuesta rápida que Telegram muestra bajo el mensaje. */
  opciones?: string[];
}

type Intencion = 'consultar' | 'cantidad' | 'fecha';

interface Tramite {
  intencion: Intencion;
  id?: string;
  /** Datos del pedido, consultados una sola vez para verificar que existe. */
  info?: any;
  cantidad?: number;
  fecha?: string;
  hora?: string;
}

interface Sesion {
  actualizada: number;
  ultimoPedido?: string;
  tramite?: Tramite;
  confirmacion?: { id: string; cuerpo: Record<string, unknown> };
}

const VIGENCIA_MS = 15 * 60 * 1000;
export const OPCIONES_CONFIRMAR = ['Sí, confirmar', 'No, cancelar'];

const TEXTO_NO_ENTENDI =
  'No logré entender tu mensaje. Puedes escribirme, por ejemplo, «quiero consultar el pedido 154» o «cambia la cantidad del pedido 154 a 40 personas». También sirve /ayuda.';
const TEXTO_SOLO_WEB = 'Por aquí puedo consultar un pedido y cambiar su cantidad o su fecha de entrega.';

/**
 * Conversación del bot con lenguaje normal. Guarda en memoria, por chat, lo que falta para completar
 * una solicitud (número de pedido, cantidad o fecha) y pide confirmación antes de enviar un cambio.
 * No decide nada: toda decisión sobre el cambio la toma el motor de reglas del servidor.
 */
export class Conversaciones {
  private sesiones = new Map<string, Sesion>();

  constructor(
    private readonly api: ClienteApi,
    private readonly ahora: () => Date = () => new Date()
  ) {}

  async atender(chatId: number | string, texto: string): Promise<Respuesta> {
    const instante = this.ahora().getTime();
    this.limpiarVencidas(instante);

    const clave = String(chatId);
    const previa = this.sesiones.get(clave);
    const vencida = previa !== undefined && instante - previa.actualizada > VIGENCIA_MS;
    const tenia = vencida && (previa?.confirmacion !== undefined || previa?.tramite !== undefined);
    const sesion: Sesion = vencida ? { actualizada: instante, ultimoPedido: previa?.ultimoPedido } : (previa ?? { actualizada: instante });
    const confirmacionVencida = tenia && previa?.confirmacion !== undefined;
    sesion.actualizada = instante;
    this.sesiones.set(clave, sesion);

    try {
      if (texto.trim().startsWith('/')) return await this.comando(sesion, texto);
      return await this.lenguaje(sesion, texto, confirmacionVencida);
    } catch {
      return { texto: MENSAJE_SIN_CONEXION };
    }
  }

  private limpiarVencidas(instante: number): void {
    if (this.sesiones.size < 200) return;
    for (const [clave, s] of this.sesiones) {
      if (instante - s.actualizada > VIGENCIA_MS) this.sesiones.delete(clave);
    }
  }

  private async comando(s: Sesion, texto: string): Promise<Respuesta> {
    s.tramite = undefined;
    s.confirmacion = undefined;
    const respuesta = await procesarMensaje(texto, this.api);
    const id = /^\/\w+(?:@\w+)?\s+#?(\d{1,9})\b/.exec(texto.trim())?.[1];
    if (id && !respuesta.startsWith('No encontré')) s.ultimoPedido = id;
    return { texto: respuesta };
  }

  private async lenguaje(s: Sesion, texto: string, confirmacionVencida: boolean): Promise<Respuesta> {
    const siNo = interpretarSiNo(texto);

    // 1. Hay un cambio esperando confirmación.
    if (s.confirmacion) {
      if (siNo === 'si') {
        const { id, cuerpo } = s.confirmacion;
        s.confirmacion = undefined;
        return { texto: await enviarCambio(id, cuerpo, this.api) };
      }
      if (siNo === 'no') {
        s.confirmacion = undefined;
        return { texto: 'Listo, no hice ningún cambio. Si necesitas algo más, escríbeme.' };
      }
      if (!interpretarMensaje(texto, this.ahora()).explicita) {
        return { texto: 'Responde «sí» para confirmar el cambio o «no» para cancelarlo.', opciones: OPCIONES_CONFIRMAR };
      }
      s.confirmacion = undefined; // una solicitud nueva reemplaza a la anterior
    } else if (confirmacionVencida && siNo === 'si') {
      return { texto: 'Esa confirmación venció, por seguridad. Vuelve a pedirme el cambio y lo confirmamos.' };
    }

    // 2. Un «no» o «cancelar» mientras se piden datos deja la solicitud sin efecto.
    if (s.tramite && siNo === 'no') {
      s.tramite = undefined;
      return { texto: 'Listo, lo dejamos así. Si necesitas algo más, escríbeme.' };
    }

    const interp = interpretarMensaje(texto, this.ahora());

    // 3. Es la respuesta a una pregunta del bot (un número, una fecha...), no una solicitud nueva.
    if (s.tramite && !interp.explicita) return this.completarDato(s, s.tramite, texto);

    switch (interp.tipo) {
      case 'consultar':
      case 'cantidad':
      case 'fecha': {
        const previo = s.tramite;
        s.tramite = {
          intencion: interp.tipo,
          id: interp.id ?? previo?.id,
          info: interp.id && interp.id !== previo?.id ? undefined : previo?.info,
          cantidad: interp.tipo === 'cantidad' ? (interp.cantidad ?? undefined) : undefined,
          fecha: interp.tipo === 'fecha' ? (interp.fecha ?? undefined) : undefined,
          hora: interp.tipo === 'fecha' ? (interp.hora ?? undefined) : undefined
        };
        return this.avanzar(s);
      }
      case 'diseno':
        s.tramite = undefined;
        return { texto: `Cambiar el diseño por ahora solo se puede en el chat web de PedidosFlow. ${TEXTO_SOLO_WEB}` };
      case 'crear':
        s.tramite = undefined;
        return { texto: `Crear pedidos nuevos por ahora solo se puede en el chat web de PedidosFlow. ${TEXTO_SOLO_WEB}` };
      case 'cancelar':
        s.tramite = undefined;
        return { texto: `Cancelar pedidos no está disponible en este chat. ${TEXTO_SOLO_WEB}` };
      case 'varios':
        s.tramite = undefined;
        return { texto: 'Puedo ayudarte con una cosa a la vez. ¿Qué quieres cambiar primero: la cantidad o la fecha de entrega? (El diseño, por ahora, solo en el chat web.)' };
      case 'saludo':
      case 'ayuda':
        return { texto: TEXTO_AYUDA };
      case 'gracias':
        return { texto: '¡Con gusto! Si necesitas algo más, escríbeme.' };
      default:
        return { texto: TEXTO_NO_ENTENDI };
    }
  }

  /** Toma de la respuesta del cliente el dato que el bot acaba de pedir. */
  private async completarDato(s: Sesion, t: Tramite, texto: string): Promise<Respuesta> {
    if (!t.id) {
      const id = pideElMismoPedido(texto) && s.ultimoPedido ? s.ultimoPedido : extraerIdEnRespuesta(texto);
      if (!id) return { texto: 'No encontré un número de pedido en tu mensaje. Escribe solo el número, por ejemplo 154.' };
      t.id = id;
      t.info = undefined;
      return this.avanzar(s);
    }
    if (t.intencion === 'cantidad') {
      const cantidad = extraerCantidad(texto, t.id);
      if (cantidad === null) return { texto: 'No logré ver la cantidad. Escribe solo el número de personas, por ejemplo 40.' };
      t.cantidad = cantidad;
      return this.avanzar(s);
    }
    if (t.intencion === 'fecha') {
      const fecha = interpretarFecha(texto, this.ahora());
      if (!fecha) return { texto: 'No logré entender la fecha. Prueba con «20 de noviembre», «mañana», «el viernes» o 2026-11-20.' };
      t.fecha = fecha;
      t.hora = interpretarHora(texto) ?? undefined;
      return this.avanzar(s);
    }
    return { texto: TEXTO_NO_ENTENDI };
  }

  /** Pide el siguiente dato que falta; cuando está todo, pide confirmación. */
  private async avanzar(s: Sesion): Promise<Respuesta> {
    const t = s.tramite!;

    if (!t.id) {
      const ultimo = s.ultimoPedido ? ` Si es el mismo de antes (#${s.ultimoPedido}), responde «el mismo».` : '';
      return { texto: `¿De qué pedido? Escribe el número, por ejemplo 154.${ultimo}` };
    }

    // Se verifica que el pedido exista antes de pedir más datos.
    if (!t.info || t.intencion === 'consultar') {
      const r = await this.api.consultarPedido(t.id);
      if (r.estado !== 200) {
        s.tramite = undefined;
        return { texto: errorDeApi(r, t.id) };
      }
      t.info = r.json;
      s.ultimoPedido = t.id;
    }
    const info = t.info;

    if (t.intencion === 'consultar') {
      s.tramite = undefined;
      return { texto: formatearPedido(info) };
    }

    if (t.intencion === 'cantidad') {
      if (t.cantidad === undefined) {
        return { texto: `El pedido #${t.id} tiene ${info.cantidad} personas. ¿A cuántas personas quieres cambiarlo?` };
      }
      if (t.cantidad === Number(info.cantidad)) {
        t.cantidad = undefined;
        return { texto: `El pedido #${t.id} ya tiene ${info.cantidad} personas. ¿A cuántas quieres cambiarlo?` };
      }
      s.confirmacion = { id: t.id, cuerpo: { campo: 'Cantidad', valorNuevo: t.cantidad } };
      s.tramite = undefined;
      return {
        texto: `Voy a pedir este cambio:\nPedido #${t.id} - Cantidad: ${info.cantidad} personas → ${t.cantidad} personas.\n¿Confirmas?`,
        opciones: OPCIONES_CONFIRMAR
      };
    }

    // fecha
    if (!t.fecha) {
      return {
        texto: `El pedido #${t.id} está para el ${info.fechaEntrega} a las ${info.horaEntrega}. ¿Para qué fecha lo quieres? Puedes escribir, por ejemplo, «20 de noviembre» o «el viernes».`
      };
    }
    const hora = t.hora ?? info.horaEntrega;
    const cuerpo: Record<string, unknown> = { campo: 'Fecha de entrega', valorNuevo: t.fecha };
    if (t.hora) cuerpo.hora = t.hora;
    s.confirmacion = { id: t.id, cuerpo };
    s.tramite = undefined;
    return {
      texto: `Voy a pedir este cambio:\nPedido #${t.id} - Fecha de entrega: ${info.fechaEntrega} ${info.horaEntrega} → ${t.fecha} ${hora}.\n¿Confirmas?`,
      opciones: OPCIONES_CONFIRMAR
    };
  }
}
