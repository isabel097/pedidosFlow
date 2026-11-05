# Registro de correcciones

Resultado de comparar las tres versiones del proyecto antes de preparar este incremento:

| Versión | Qué era |
|---|---|
| **Original** (`Help_with_program`) | Prototipo exportado de Figma Make (React + Vite) |
| **Para capturas** (`PedidosFlow-para-capturas`) | El prototipo original con parches para la demostración del cambio de cantidad |
| **Rehecha** (`pedidosflow-rehecho`) | Reescritura con servidor Express y persistencia, con interfaz propia |

La versión actual conserva el **diseño del prototipo original** y la **lógica del servidor** de la versión rehecha, corregida.

## Diseño (colores y tonalidad)

| # | Problema | Dónde | Corrección |
|---|---|---|---|
| D1 | `body, button, input, textarea, select, option { color: #000 !important; }` forzaba texto negro: el menú lateral, el botón «WhatsApp + Bot», las insignias y las opciones verdes del chat se veían negras sobre fondo oscuro | Para capturas (`src/index.css`) | Regla eliminada. Los textos vuelven a ser blancos / gris claro sobre la barra lateral y verde `#128C7E` en el chat |
| D2 | La interfaz usaba azul marino (`#0f315f`, `#173d74`), fondo `#f5f7fb`, verdes distintos y tipografía del sistema | Rehecha (`public/index.html`) | Se reconstruyó con las mismas clases de Tailwind del original: barra lateral `slate-800`, fondo `slate-50`, tarjetas blancas, chat `#128C7E`, fuentes Outfit / Inter / DM Mono |

## Funciones

| # | Problema | Dónde | Corrección |
|---|---|---|---|
| F1 | El pedido #155 pasó de «En producción 3/7» a «Control final 7/7», cambiando el escenario de demostración | Para capturas (`App.tsx`) | El #155 vuelve a 3/7 en producción; el #154 es el pedido de demostración estable (20 personas, sin producción) |
| F2 | La alerta de rechazo del #155 en *Cambios pendientes* quedaba desactivada con `false && …` | Para capturas (`App.tsx`) | Los rechazos automáticos llegan siempre a revisión humana (Flujo 2 del prototipo) |
| F3 | Un rechazo automático no llegaba a revisión humana y no se podía aprobar manualmente | Rehecha | Todo cambio `rechazado` o `pendiente-revision` aparece en *Cambios pendientes*; se puede aprobar o mantener el rechazo |
| F4 | La decisión manual sobrescribía la decisión automática, perdiendo trazabilidad | Rehecha | Se guardan por separado (`resultado` y `decisionManual`) con responsable y fecha |
| F5 | La foto de un diseño personalizado pendiente no se guardaba (la revisión mostraba otra imagen) | Rehecha | La foto se guarda en el cambio y se muestra en la revisión |
| F6 | La etapa se derivaba con otro umbral (hasta 1 paso seguía en «Antes de producción») | Rehecha | Se restauró la derivación original: cualquier avance → «En producción»; último paso → «Control final» |
| F7 | La matriz de reglas perdió «Fecha de entrega» y renombró «Color / Diseño» | Rehecha | Matriz de tres tipos de cambio, con cambio de fecha implementado |
| F8 | El chat pedía el número de pedido en cada acción y hacía preguntas antes de comprobar que el pedido existiera | Versiones anteriores | El chat valida el pedido apenas se escribe el número y ofrece reutilizar el último |
| F9 | Las vistas del encargado se veían vacías o con datos fijos | Original / versiones anteriores | Todas las vistas leen los datos del servidor |
| F10 | El dashboard y las notificaciones eran datos fijos | Original | Contadores y notificaciones se generan de los eventos reales |

## Decisiones tomadas al unificar

- Todos los productos son **torta personalizada** (alcance del incremento); los pedidos #153 y #152, que en el prototipo eran camisetas y un arreglo floral, ahora son tortas.
- Se omitieron del prototipo las secciones sin comportamiento real: usuarios y permisos, productos adicionales y condiciones de horas de anticipación. Quedan como backlog.
- El diseño del cliente se elige del **catálogo** (en lugar de «color») o se envía como **foto personalizada**, como indica el README del repositorio.


## Incremento 2: correcciones adicionales

| # | Problema | Ajuste | Verificación disponible |
|---|---|---|---|
| F11 | La carpeta de datos dependía de la carpeta de trabajo desde donde se arrancaba Node.js; podían aparecer varias carpetas `data/`. | La ruta predeterminada de los datos se resuelve desde la ubicación del proyecto y se imprime al iniciar; los archivos estáticos también se resuelven desde la raíz del proyecto. `PEDIDOSFLOW_DATOS` permite establecer una ubicación alternativa. | Revisión de `src/index.ts`; ejecutar y reiniciar el servidor en el equipo de desarrollo para validar la ruta real. |
| F12 | Las escrituras JSON podían colisionar al usar nombres temporales fijos y la sustitución de archivos existentes podía fallar en Windows. | Los temporales tienen identificadores únicos y la sustitución conserva un respaldo temporal cuando el sistema operativo lo requiere. | Revisión de `src/almacenamiento.ts`; las pruebas de persistencia del proyecto deben volver a ejecutarse con las dependencias instaladas. |
| F13 | El chat solo permitía respuestas de opciones definidas, incluso cuando el cliente podía expresar su intención claramente. | Se añadió entrada libre en los pasos conversacionales y reconocimiento de expresiones comunes para consultar, crear o cambiar pedidos. | Se incorporaron escenarios E2E-8; pendientes de ejecución en un entorno con Playwright y dependencias completas. |
| F14 | En el resumen de un pedido, un mensaje negativo que incluyera «confirmar» podía ser interpretado como afirmativo. | Se prioriza la detección de negaciones antes de buscar una confirmación. | Se corrigió la lógica de `public/chat.js`; agregar/ejecutar una prueba de extremo a extremo en el equipo. |
| F15 | Al recargar la pestaña, la conversación local se perdía. | Se conserva una transcripción limitada en `sessionStorage`, sin guardar cadenas base64 de imágenes. | Escenario E2E-8d agregado; pendiente de ejecución. |

Nota: los escenarios del incremento 2 que figuran como pendientes no deben marcarse como aprobados hasta ejecutarlos.


| F | Problema | Ajuste | Verificación disponible |
|---|---|---|---|
| F16 | Las solicitudes completas podían perder el valor escrito y volver a pedir los mismos datos, además de depender de botones para indicar el tipo de cambio. | El chat reconoce solicitudes directas con pedido, campo y valor (cantidad, fecha/hora y diseño); cuando falta un dato, lo solicita explícitamente. | `node --check public/chat.js`; ejecutar escenarios manuales y API en el entorno de desarrollo. |
| F17 | Una fecha pasada se rechazaba en el formulario antes de que el encargado pudiera considerar una excepción. | El cambio de fecha valida el calendario, pero una fecha pasada queda en revisión y no cambia el pedido hasta la decisión manual. Los pedidos nuevos siguen exigiendo una fecha no pasada. | Casos CP-17 / CP-17b agregados; pendientes de ejecución por falta de dependencias completas en este entorno. |
| F18 | No existía criterio para detectar automáticamente un día con demasiados pedidos. | Se agregó el parámetro persistente `pedidosMaximosPorDia` (inicialmente 3), editable en Configuración. Si la fecha destino ya alcanzó esa ocupación, el cambio queda pendiente. | Caso CP-17c agregado; pendiente de ejecutar localmente. |
| F19 | Los diseños fuera del catálogo eran rechazados si no tenían foto o no coincidían con una opción existente. | Se acepta descripción escrita de diseño y se crea una revisión humana obligatoria. La descripción queda guardada y se aplica al pedido solo después de aprobarla. | Casos CP-15b y CP-15c agregados; pendiente de ejecutar localmente. |
| F20 | La tarjeta de revisión de diseño asumía que siempre había una imagen. | La tarjeta muestra la foto si existe o la descripción escrita cuando no se adjunta imagen. | Revisión estática de `public/app.js`; comprobar en navegador. |

| F21 | El bot podía confirmar un cambio sin mostrar evidencia visible de los datos recién guardados. | Después de registrar un cambio, vuelve a consultar el pedido a través de la API y muestra los datos actuales devueltos por el servidor; las solicitudes pendientes explican que el pedido no se modifica hasta la decisión humana. | E2E-8f a E2E-8h agregadas; pendientes de ejecución local. |
| F22 | Una fecha relativa como «ayer» o «mañana» no se reconocía dentro de una frase completa. | El analizador extrae fechas relativas cuando forman parte de una solicitud natural completa y deja que el servidor aplique las reglas comerciales. | E2E-8g agregada; pendiente de ejecución local. |


| F23 | El servidor del ZIP anterior iniciaba por defecto con una lista vacía, a pesar de que el conjunto de demostración existía en el código. | Los cinco pedidos de demostración (#152-#156) se precargan por defecto en una carpeta nueva. Si queda un `pedidos.json` vacío de una ejecución anterior, el conjunto se repone; cuando ya hay pedidos, no se duplica ni se sobrescribe el estado guardado. `PEDIDOSFLOW_MODO_DEMO=0` permite iniciar una carpeta nueva sin muestras. | CP-41 / CP-47 añadidos; ejecutar `npm run verify` en el equipo antes de marcar las pruebas como aprobadas. |

| F24 | Las opciones rápidas del chat compartían el mismo bloque visual con la escritura y «Volver al menú» parecía desconectado del menú. | Los botones compactos ahora quedan en un panel de opciones separado, inmediatamente debajo del historial de mensajes y encima del área para escribir. «Volver al menú» está junto a los botones del panel; las opciones largas tienen desplazamiento propio. | `node --check public/chat.js`; validar distribución visual en navegador. |
| F25 | Una solicitud enviada a revisión no generaba un aviso en el chat cuando el encargado finalmente la aprobaba o rechazaba. | El chat conserva los identificadores de las solicitudes pendientes y consulta el estado en el servidor. Solo después de registrar `decisionManual`, añade al chat el mensaje de aprobación o rechazo y vuelve a consultar los datos del pedido. Funciona también al regresar a la vista del chat después de la decisión. | Comprobación sintáctica incorporada; probar el recorrido de dos vistas: cliente solicita, encargado decide y chat del cliente recibe el resultado. |

Nota: el aviso posterior a una decisión está implementado para el chat web simulado. Para enviar un mensaje por WhatsApp real se deberá añadir el envío saliente mediante la API oficial de WhatsApp Business.
