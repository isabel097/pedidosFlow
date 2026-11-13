import type { ClienteApi, RespuestaApi } from './comandos.js';

/**
 * Cliente HTTP del bot: solo habla con la API de PedidosFlow.
 * Toda la validación y las decisiones las toma el motor del servidor; el bot no duplica reglas.
 */
export function crearClienteApi(baseUrl: string): ClienteApi {
  const base = baseUrl.replace(/\/+$/, '');

  async function llamar(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown): Promise<RespuestaApi> {
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(10_000)
    });
    const texto = await r.text();
    let json: any = null;
    try {
      json = texto ? JSON.parse(texto) : null;
    } catch {
      json = null;
    }
    return { estado: r.status, json };
  }

  return {
    consultarPedido: id => llamar('GET', `/api/pedidos/${encodeURIComponent(id)}`),
    solicitarCambio: (id, cuerpo) => llamar('POST', `/api/pedidos/${encodeURIComponent(id)}/cambios`, cuerpo),
    crearPedido: cuerpo => llamar('POST', '/api/pedidos', cuerpo),
    obtenerConfiguracion: () => llamar('GET', '/api/configuracion')
  };
}
