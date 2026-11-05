import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { crearAlmacen } from '../src/almacenamiento.js';
import { crearServidor } from '../src/servidor.js';

export const AHORA_FIJO = new Date('2026-10-21T10:00:00');

export interface Entorno {
  base: string;
  dir: string;
  almacen: ReturnType<typeof crearAlmacen>;
  cerrar: () => Promise<void>;
}

export async function iniciarEntorno(dir?: string, opciones: { usarDatosDemo?: boolean } = {}): Promise<Entorno> {
  const carpeta = dir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'pedidosflow-'));
  const almacen = crearAlmacen(carpeta, opciones);
  const app = crearServidor(almacen, { ahora: () => AHORA_FIJO });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(r => server.once('listening', () => r()));
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    dir: carpeta,
    almacen,
    cerrar: () => new Promise<void>(r => server.close(() => r()))
  };
}

export async function pedir(e: Entorno, metodo: string, ruta: string, cuerpo?: unknown) {
  const r = await fetch(e.base + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  const texto = await r.text();
  let json: any = null;
  try {
    json = texto ? JSON.parse(texto) : null;
  } catch {
    json = texto;
  }
  return { estado: r.status, json };
}

export const FOTO_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Marca los primeros `n` pasos de producción del pedido. */
export async function marcarPasos(e: Entorno, id: string, n: number) {
  return pedir(e, 'PATCH', `/api/pedidos/${id}/produccion`, { checklist: Array.from({ length: 7 }, (_, i) => i < n) });
}
