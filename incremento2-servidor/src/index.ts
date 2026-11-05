import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearAlmacen } from './almacenamiento.js';
import { crearServidor } from './servidor.js';

// La ruta por defecto depende del proyecto, no de la carpeta desde la que se ejecuta npm.
// Así se evita crear varias carpetas data/ al iniciar el programa desde distintas terminales.
const directorioProyecto = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directorioDatos = process.env.PEDIDOSFLOW_DATOS
  ? path.resolve(process.env.PEDIDOSFLOW_DATOS)
  : path.join(directorioProyecto, 'data');
// Por defecto, una carpeta de datos nueva arranca con cinco pedidos de demostración
// (#152-#156) para que el sistema se pueda probar de inmediato. Los datos se guardan
// en JSON y no se vuelven a copiar ni sobrescribir en cada inicio. Para una carpeta nueva
// sin datos de muestra, define PEDIDOSFLOW_MODO_DEMO=0.
const usarDatosDemo = process.env.PEDIDOSFLOW_MODO_DEMO !== '0';
const almacen = crearAlmacen(directorioDatos, { usarDatosDemo });
const app = crearServidor(almacen);
const puerto = Number(process.env.PORT ?? 3001);

app.listen(puerto, () => {
  console.log(`PedidosFlow listo en http://localhost:${puerto}`);
  console.log(`Datos guardados en ${directorioDatos}`);
});
