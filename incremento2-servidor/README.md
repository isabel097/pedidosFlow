# PedidosFlow

Sistema académico para la gestión de pedidos de **tortas personalizadas**: valida automáticamente los cambios que el cliente pide después de confirmar su pedido (cantidad, diseño y fecha de entrega) según la **etapa de producción**, deriva a revisión humana lo que requiere criterio y conserva el **historial** de cada decisión.

Equipo **Gemas de Cristal**: Steven Suaza Montiel e Isabel Cristina Duque Cano.

## Funcionalidad actual (Incrementos 1 y 2)

- **Cambio de cantidad** evaluado por la etapa de producción: se aplica, pasa a revisión o se rechaza con el motivo (historia principal de la iteración).
- Cambio de **diseño** (catálogo o foto personalizada) y de **fecha de entrega**, con la misma matriz de reglas.
- **Revisión humana**: los cambios en revisión y los rechazos automáticos llegan a *Cambios pendientes*; el encargado aprueba manualmente o mantiene el rechazo, y queda registrado quién y cuándo.
- **Producción** con checklist de 7 etapas: la etapa del pedido se deriva de ese avance.
- **Pedidos nuevos**, clientes, historial de versiones, notificaciones y configuración de reglas, todo con datos reales guardados en el servidor.
- **Chat estilo WhatsApp** (simulado) para crear, modificar y consultar pedidos. Además de los botones, reconoce solicitudes directas escritas con palabras propias (por ejemplo, «cambia la cantidad del pedido #154 a 30 personas» o «cambia la fecha del pedido #154 para mañana a las 3 pm»); si faltan datos, los pregunta en vez de inventarlos.
- Interpreta fechas frecuentes (hoy, ayer, mañana, días de la semana, `7/11/2026`, `7 de noviembre`) y horas como `3:30 pm`; la validación final se realiza en el servidor.
- Solicita una confirmación explícita antes de crear un pedido; respuestas negativas como «no quiero confirmar» no registran el pedido.
- Conserva el historial reciente del chat al recargar la pestaña. Esta continuidad se guarda en `sessionStorage`; no sustituye la persistencia de pedidos en el servidor.
- Menú compacto de opciones separado del campo de escritura; «Volver al menú» forma parte del mismo panel. Las solicitudes de revisión muestran inicialmente un estado pendiente y el chat anuncia la aprobación o el rechazo únicamente después de que el encargado guarda su decisión en la plataforma. En el chat web simulado, el mensaje posterior se consulta al servidor; para WhatsApp real se requiere configurar el envío saliente mediante la API oficial.

## Cómo ejecutarlo

Requisitos: **Node.js 20 o superior** y npm.

```bash
npm ci
npm start
```

Abre <http://localhost:3001>. **Por defecto, la primera ejecución carga cinco pedidos de demostración (#152-#156)**, con clientes, fechas, cantidades y estados de producción diferentes para que puedas probar de inmediato el chat, el panel, los cambios pendientes, el historial y las reglas sin crear todos los registros manualmente. Uno de ellos (#156) tiene un diseño personalizado pendiente de revisión.

Los nombres como **Laura Gómez** y el pedido **#154** son datos ficticios de demostración académica, no clientes reales. Los pedidos, los cambios, las notificaciones y la configuración se guardan en `data/` dentro del proyecto (o en la ruta indicada por `PEDIDOSFLOW_DATOS`). Al reiniciar, se leen los mismos archivos: **no se crean copias duplicadas ni se restablecen los cambios a los valores originales**. Si la carpeta de datos contiene una lista de pedidos vacía de una versión anterior, el modo demo vuelve a sembrar el conjunto inicial una sola vez para dejar la aplicación lista para probar.

**Para usar una carpeta nueva sin pedidos de demostración**, configura `PEDIDOSFLOW_MODO_DEMO=0` antes de iniciar. En PowerShell:

```powershell
$env:PEDIDOSFLOW_DATOS = "C:\PedidosFlowDatosPropios"
$env:PEDIDOSFLOW_MODO_DEMO = "0"
npm start
```

El modo demo queda activado por defecto; no necesitas activar una variable para que aparezcan los cinco pedidos de ejemplo. Puedes establecer `PEDIDOSFLOW_DATOS` para señalar otra carpeta. El programa no borra ni reemplaza los pedidos que ya estén guardados; la consola indica la ruta efectiva de almacenamiento.

| Comando | Para qué sirve |
|---|---|
| `npm start` | Inicia el servidor y la interfaz (puerto 3001, o `PORT=4000 npm start`) |
| `npm test` | Ejecuta la suite de pruebas automatizadas |
| `npm run typecheck` | Verifica los tipos de TypeScript |
| `npm run build:css` | Regenera `public/estilos.css` (solo si cambias las clases de la interfaz) |
| `npm run verify` | Tipos + pruebas (lo mismo que ejecuta el CI) |

Variables opcionales: `PORT` (puerto), `PEDIDOSFLOW_DATOS` (carpeta de datos) y `PEDIDOSFLOW_MODO_DEMO=0` (desactivar la precarga demo en una carpeta nueva o con un archivo de pedidos vacío). Si no se define, los cinco pedidos demo se precargan por defecto.

## Reglas por defecto

| Tipo de cambio | Antes de producción | En producción | Control final |
|---|---|---|---|
| Cantidad | Automático | Revisión | Bloqueado |
| Diseño | Automático | Bloqueado | Bloqueado |
| Fecha de entrega | Automático | Revisión | Bloqueado |

Además de esa matriz, cualquier cambio de fecha a un día pasado válido requiere revisión humana; una frase completa como «cambia la fecha del pedido #154 a ayer» se interpreta antes de evaluar la regla. Si la fecha solicitada ya tiene el número máximo de otros pedidos activos configurado en **Configuración** (por defecto, 3), también requiere revisión. El valor se puede ajustar según la capacidad real del negocio. Los diseños que no pertenecen al catálogo siempre requieren revisión, incluso si el cliente solo los describe con texto.

La etapa se deriva del checklist: sin pasos marcados → *Antes de producción*; cualquier avance → *En producción*; último paso marcado → *Control final*. Las reglas se editan en **Configuración** y se aplican sin reiniciar. Un diseño fuera del catálogo, con foto o descripción escrita, siempre pasa por revisión humana; no se aplica automáticamente.

## Estructura

```text
src/            Servidor (TypeScript): reglas.ts (motor de reglas), servidor.ts (API),
                almacenamiento.ts (persistencia JSON), datosIniciales.ts, tipos.ts
public/         Interfaz web: index.html, app.js (plataforma), chat.js (WhatsApp simulado),
                util.js, estilos.css (generado con Tailwind)
web/            Fuente de los estilos (estilos.css)
test/           Pruebas automatizadas (node:test)
e2e/            Recorrido opcional de punta a punta con Playwright
docs/           Planeación, diseño técnico, pruebas, correcciones y guía de evidencias
prototipo-figma/ Prototipo original de Figma Make (referencia de diseño, sin modificar)
```

## Flujo de trabajo

La rama estable es `main`. Las ramas de trabajo usan `feature/<tarea-corta>`, `fix/<tarea-corta>`, `test/<tarea-corta>` y `docs/<tarea-corta>`. Los cambios llegan a `main` mediante Pull Request revisado por la otra persona del equipo. La guía paso a paso está en [`docs/EVIDENCIAS_GITHUB.md`](docs/EVIDENCIAS_GITHUB.md).

## Publicar el servidor en GitHub sin modificar main

El ZIP incluye `SUBIR_CODIGO_A_GITHUB.bat` y `SINCRONIZAR_CODIGO_GITHUB.ps1`. Ejecuta el `.bat` desde la raíz del paquete para publicar la implementación en la rama `feature/servidor-incremento-2`, dentro de `incremento2-servidor/`, y añadir una verificación de GitHub Actions para esa carpeta. Requiere Git for Windows y que `git push` pueda autenticarte con tu cuenta de GitHub. No pide ni guarda contraseñas o tokens y no hace merge a `main`. Si la rama remota ya tiene cambios diferentes de `main`, el script se detiene para protegerlos.

## Fuera de alcance actual

- Integración real con WhatsApp Business (el chat es una simulación).
- Autenticación y control de acceso.
- Categorías diferentes a la torta personalizada.

## Documentación

- [`docs/PLANEACION_INCREMENTO_1.md`](docs/PLANEACION_INCREMENTO_1.md): planeación original de la iteración.
- [`docs/INCREMENTO_2.md`](docs/INCREMENTO_2.md): alcance, correcciones, criterios de aceptación y limitaciones del segundo incremento.
- [`docs/DISENO_TECNICO.md`](docs/DISENO_TECNICO.md): componentes, API y decisiones técnicas.
- [`docs/PRUEBAS.md`](docs/PRUEBAS.md): casos de prueba y resultados.
- [`docs/REGISTRO_DE_CORRECCIONES.md`](docs/REGISTRO_DE_CORRECCIONES.md): qué se encontró y se corrigió al comparar las versiones.
- [`docs/EVIDENCIAS_GITHUB.md`](docs/EVIDENCIAS_GITHUB.md): cómo registrar issues, ramas, commits y Pull Requests.
- [`docs/ENTREGA_SEGUNDO_AVANCE.md`](docs/ENTREGA_SEGUNDO_AVANCE.md): checklist contra la rúbrica docente.
- [`docs/INCREMENTO_2_CIERRE.md`](docs/INCREMENTO_2_CIERRE.md): alcance, reglas, ejecución y limitaciones del incremento 2.
- [`docs/EVIDENCIAS_INCREMENTO_2.md`](docs/EVIDENCIAS_INCREMENTO_2.md): capturas y comprobaciones pendientes para cerrar la entrega.
- [`docs/JUSTIFICACION_EVIDENCIA_DOCUMENTAL.md`](docs/JUSTIFICACION_EVIDENCIA_DOCUMENTAL.md): evidencia documental sobre emprendimientos y negocios que usan WhatsApp.
- [`docs/SEGUNDO_AVANCE_PEDIDOSFLOW.pdf`](docs/SEGUNDO_AVANCE_PEDIDOSFLOW.pdf): informe académico actualizado.
- [`docs/SEGUNDO_AVANCE_PEDIDOSFLOW.docx`](docs/SEGUNDO_AVANCE_PEDIDOSFLOW.docx): fuente editable del informe.


## Inicio rapido en Windows

Para evitar ejecutar el comando dentro de la carpeta equivocada, haz doble clic en `INICIAR_PEDIDOSFLOW.bat` que se encuentra en esta carpeta principal. La primera vez instala las dependencias si faltan; requiere internet. No lo ejecutes desde `prototipo-figma`, que es solo la referencia visual. Cuando el servidor arranque, abre http://localhost:3001.
