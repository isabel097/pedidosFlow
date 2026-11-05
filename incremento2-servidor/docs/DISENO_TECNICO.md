# Diseño técnico

## Componentes

| Componente | Archivo | Responsabilidad |
|---|---|---|
| Interfaz de la plataforma | `public/app.js` | Pantallas del encargado: pedidos, detalle, cambios pendientes, producción, clientes, historial, configuración y notificaciones |
| Chat de WhatsApp (simulado) | `public/chat.js` | Conversación guiada con entrada libre e interpretación de solicitudes naturales para crear, modificar y consultar pedidos |
| API REST | `src/servidor.ts` | Recibe las solicitudes, valida la entrada, coordina el motor de reglas y la persistencia |
| Motor de reglas | `src/reglas.ts` | Funciones puras: derivar la etapa, validar formatos y evaluar un cambio con la matriz de reglas |
| Persistencia | `src/almacenamiento.ts` | Lee y escribe archivos JSON en `data/` con escritura atómica; crea los datos de demostración |

El motor de reglas no depende de la interfaz ni del servidor, por eso se prueba por separado (`test/reglas.test.ts`).

## Flujo de un cambio

1. La interfaz envía `POST /api/pedidos/:id/cambios`.
2. El servidor comprueba que el pedido exista (404 si no) y que no esté cancelado (409).
3. Valida el formato del valor nuevo (400 si es inválido; no se registra nada).
4. Deriva la etapa del checklist y consulta la regla de la matriz (`Automático`, `Revisión` o `Bloqueado`).
5. El motor devuelve `aplicado`, `pendiente-revision` o `rechazado` con el motivo.
6. Si se aplica, se actualiza el pedido. En todos los casos se guarda el cambio (decisión, etapa, motivo, fecha) y se genera la notificación configurada.
7. Los cambios `pendiente-revision` y `rechazado` quedan visibles en *Cambios pendientes* hasta que el encargado decide; la decisión manual se guarda **sin borrar** la decisión automática.

## API

| Método y ruta | Función |
|---|---|
| `GET /api/dashboard` | Contadores, última decisión y lista de pedidos |
| `GET /api/pedidos` (`?telefono=`) | Lista de pedidos, opcionalmente de un cliente |
| `GET /api/pedidos/:id` | Detalle de un pedido (incluye la foto de referencia) |
| `POST /api/pedidos` | Crea un pedido nuevo |
| `GET /api/pedidos/:id/cambios` | Cambios de un pedido |
| `POST /api/pedidos/:id/cambios` | Solicita un cambio (Cantidad, Diseño o Fecha de entrega) |
| `GET /api/cambios` | Historial global de cambios |
| `GET /api/revisiones-pendientes` | Cambios que esperan decisión humana |
| `PUT /api/revisiones-pendientes/:id/decidir` | `aprobar` o `mantener-rechazo` |
| `GET /api/produccion` · `PATCH /api/pedidos/:id/produccion` | Checklist de producción |
| `GET /api/clientes` | Clientes agrupados por teléfono |
| `GET/PUT /api/configuracion` | Reglas, negocio, etapas, catálogo y bot |
| `GET /api/notificaciones` · `POST /api/notificaciones/:id/leer` · `POST /api/notificaciones/leer-todas` | Notificaciones |
| `GET /api/salud` | Comprobación de que el servidor responde |

Códigos de error: `400` entrada inválida, `404` recurso inexistente, `409` operación no permitida en el estado actual, `413` solicitud demasiado grande.

## Persistencia

Cuatro archivos en la carpeta `data/` de la raíz del proyecto (`pedidos.json`, `cambios.json`, `notificaciones.json`, `configuracion.json`). La ruta por defecto se calcula desde la ubicación del proyecto, no desde la carpeta actual de la terminal; así se evita crear varias carpetas `data/` por iniciar el servidor desde ubicaciones distintas. La carpeta pública de archivos estáticos también se resuelve desde el proyecto. Se puede cambiar mediante `PEDIDOSFLOW_DATOS`. Cada escritura usa un nombre temporal único y luego se renombra, para reducir colisiones y evitar dejar archivos a medias. En Windows se aparta el archivo anterior y se restaura si falla la sustitución. Si un archivo está dañado, se guarda una copia (`*.dañado-<fecha>`) y se vuelve a los datos iniciales. Una configuración antigua se completa con los valores por defecto que falten.

## Decisiones técnicas

1. Las reglas de negocio están separadas de la interfaz y del servidor (más fácil de probar y de cambiar).
2. La matriz de reglas es un dato editable, no código fijo.
3. La etapa del pedido se deriva del checklist de producción, no de un campo manual.
4. Persistencia local en JSON mientras el alcance académico no requiera una base de datos externa.
5. Pedido de demostración estable (#154) para repetir pruebas y mantener evidencia trazable.
6. La decisión automática y la manual se guardan por separado, para conservar la trazabilidad completa.
7. Un diseño personalizado con foto nunca se aprueba sin revisión humana (salvo que se desactive la revisión de fotos en Configuración).
8. Las imágenes se reducen en el navegador antes de enviarse y el servidor solo acepta imágenes `data:` o URL `http(s)`.
9. La interfaz usa las mismas clases de Tailwind del prototipo de Figma Make para conservar el diseño aprobado.


## Incremento 2: conversación y persistencia

- El chat mantiene los botones y la composición visual, pero agrega un campo de escritura libre en los pasos conversacionales. El texto se normaliza antes de interpretarse.
- En el menú, el sistema reconoce intenciones frecuentes: crear un pedido, consultar por número, listar los pedidos asociados a un teléfono y solicitar cambios de cantidad, diseño o fecha.
- Las fechas y horas comunes se convierten a formatos de la API y se validan antes del envío. La interpretación no reemplaza la regla de negocio que decide si se acepta un cambio.
- La creación exige una respuesta afirmativa. La negación tiene prioridad aunque el mensaje contenga la palabra «confirmar».
- El historial reciente de mensajes se conserva en `sessionStorage` de la pestaña (máximo 120 mensajes). No se almacena en el navegador el contenido base64 de fotos; los datos funcionales del pedido continúan siendo responsabilidad de la persistencia del servidor.
- El chat sigue siendo una simulación web: el incremento no declara conectividad con WhatsApp Business Platform.
