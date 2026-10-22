# PedidosFlow | Gemas de Cristal

## Complemento técnico y funcional: segundo incremento

**Equipo:** Steven Suaza Montiel e Isabel Cristina Duque Cano  
**Asignatura:** Práctica Aplicada de Sistemas  
**Fecha:** octubre de 2026  
**Repositorio:** https://github.com/isabel097/pedidosFlow  
**Tablero:** https://github.com/users/isabel097/projects/1

## 1. Objetivo del incremento

Corregir el almacenamiento de la aplicación y hacer que el chat simulado estilo WhatsApp admita mensajes escritos con mayor libertad, sin eliminar los botones, alterar la distribución visual existente ni reemplazar el prototipo original. El incremento conserva el servidor Express, las reglas del negocio y la persistencia JSON del primer incremento.


## 1.1 Diferencia entre el primer y el segundo incremento

**Incremento 1 — flujo vertical básico:** como se definió en la planeación inicial, se concentra en la solicitud de cambio de cantidad de un pedido existente (caso de demostración principal: #154), validación de la cantidad, consulta de la etapa de producción, decisión con la matriz de reglas, actualización o rechazo, persistencia del cambio y consulta del historial. También contempla manejar un identificador de pedido inexistente. La conexión real con WhatsApp, la autenticación y un catálogo ampliado quedaban fuera del alcance.

**Incremento 2 — reglas de excepción y conversación utilizable:** parte de ese flujo y amplía la operación a mensajes escritos con palabras propias, cambio real de los datos guardados y lectura posterior del pedido desde la API; deriva a revisión los diseños personalizados fuera del catálogo, las fechas pasadas válidas y los cambios hacia fechas que ya alcanzaron la capacidad diaria configurada. Incluye una opción para iniciar con datos propios si se configura explícitamente; por defecto carga pedidos de demostración para que el flujo sea verificable inmediatamente. El encargado decide qué solicitudes pendientes aplicar o rechazar.

La vista de chat todavía es una simulación web con estilo WhatsApp, no una conexión con la aplicación WhatsApp real. La interpretación libre usa expresiones y reglas explícitas: reconoce patrones habituales y pide aclaración cuando no puede extraer un valor; no equivale a comprensión ilimitada de cualquier frase. La conexión a WhatsApp Business y, si se necesita, un servicio de IA conversacional forman parte de trabajo posterior.

## 2. Funciones agregadas y correcciones

| ID | Función o corrección | Comportamiento esperado |
|---|---|---|
| PF2-01 | Ruta estable de datos | La ruta predeterminada de datos se resuelve desde la raíz del proyecto, no desde la carpeta actual de la terminal. Los archivos estáticos del sitio también se localizan desde esa raíz. Al iniciar, el servidor imprime la ruta efectiva. |
| PF2-02 | Escritura JSON más segura | Cada escritura utiliza un temporal único y reemplaza el archivo final después de completar el contenido. En Windows se conserva temporalmente el original para poder restaurarlo si falla la sustitución. |
| PF2-03 | Entrada libre en el chat | Se puede escribir texto, además de usar los botones, durante los pasos donde una respuesta escrita tiene sentido. Se conservan el diseño y las clases visuales anteriores. |
| PF2-04 | Reconocimiento de intenciones comunes | Desde el menú se reconocen solicitudes como crear un pedido, consultar `#154`, consultar los pedidos del cliente y cambiar cantidad, diseño o fecha. |
| PF2-05 | Fecha y hora en lenguaje cotidiano | Se reconocen expresiones como `mañana`, `viernes`, `7/11/2026`, `7 de noviembre`, `3:30 pm` y `3 pm`. El servidor conserva la decisión final sobre la viabilidad del cambio. |
| PF2-06 | Confirmación explícita | El pedido nuevo no se crea con una respuesta negativa o ambigua. Frases como `no quiero confirmar` dejan el pedido sin registrar. |
| PF2-07 | Continuidad de conversación | La transcripción reciente se restaura al recargar la misma pestaña. Se limita a 120 mensajes y no se almacena el contenido base64 de las imágenes en el navegador. |
| PF2-08 | Solicitud completa escrita por el cliente | Si el mensaje identifica un pedido, el tipo de cambio y el nuevo valor, el chat envía esa solicitud sin obligar a repetir los datos; si faltan, hace una pregunta concreta. |
| PF2-09 | Diseño personalizado descrito por texto | Un diseño que no coincide con el catálogo puede describirse libremente; se guarda como propuesta de diseño y siempre queda pendiente hasta la decisión del encargado. La imagen sigue siendo opcional. |
| PF2-10 | Fecha solicitada en el pasado | Una fecha de calendario válida que esté antes de hoy no se aplica automáticamente: se crea un cambio pendiente y el pedido conserva la fecha anterior. Las fechas imposibles o mal escritas se rechazan como datos inválidos. |
| PF2-11 | Fecha con carga alta de pedidos | El encargado configura un máximo de pedidos activos por fecha (valor inicial 3). Si la fecha destino ya tiene ese número de otros pedidos activos, la modificación queda pendiente y no modifica el pedido hasta la decisión humana. |
| PF2-12 | Datos iniciales para probar el incremento | Por defecto se cargan cinco pedidos de ejemplo (#152-#156) en una carpeta nueva o si el archivo de pedidos existente está vacío. Los datos se guardan y no se duplican ni se sobrescriben en cada inicio. `PEDIDOSFLOW_MODO_DEMO=0` permite iniciar una carpeta nueva sin datos de ejemplo; los datos ya guardados no se borran. |

## 3. Persistencia de los datos

El servidor trabaja por defecto en la carpeta `data/`, situada en la raíz del proyecto. Allí se crean o actualizan estos archivos:

- `pedidos.json`: pedidos y sus estados actuales.
- `cambios.json`: solicitudes, decisiones automáticas y decisiones manuales.
- `notificaciones.json`: eventos y estado de lectura de las notificaciones.
- `configuracion.json`: reglas, catálogo y datos de configuración.

La ruta efectiva aparece en la consola al iniciar el servidor. La variable opcional `PEDIDOSFLOW_DATOS` permite señalar otra carpeta, por ejemplo, si los datos anteriores quedaron guardados en una ubicación distinta. Por defecto, la primera ejecución crea cinco pedidos de demostración (#152-#156), un cambio pendiente y una notificación relacionada. Los archivos JSON se conservan entre reinicios: las modificaciones se leen desde el disco y los pedidos existentes no se duplican ni vuelven a sus datos originales. Si una versión anterior dejó `pedidos.json` vacío, el modo demo vuelve a sembrar pedidos para que la aplicación se pueda probar de inmediato. Para iniciar una carpeta nueva sin muestras, establece `PEDIDOSFLOW_MODO_DEMO=0`; esa opción no elimina pedidos existentes. No borres una carpeta antigua de datos hasta comprobar cuál contiene los pedidos que necesitas conservar.

La conversación visible se guarda aparte, en `sessionStorage` del navegador. Eso conserva mensajes al recargar la misma pestaña, pero no sustituye el almacenamiento de pedidos, historial o configuración del servidor.

## 4. Ejemplos del flujo conversacional

**Consulta directa:** el cliente escribe `quiero consultar el pedido #154`. El chat busca el pedido y muestra el detalle disponible.

**Cambio solicitado con palabras propias:** el cliente puede escribir `cambia la cantidad del pedido #154 a 30 personas` o `cambia la fecha del pedido #154 para mañana a las 3 pm`. Si contiene todos los datos necesarios, se valida y se envía la petición directamente; si falta el valor, el chat pregunta solo por ese dato. El pedido se actualiza únicamente cuando el motor del servidor devuelve `aplicado`.

**Fecha pasada o con carga alta:** un cambio de entrega a un día pasado válido, o a un día que ya alcanzó el límite de pedidos activo configurado, queda en `pendiente-revision`. Hasta que el encargado lo apruebe, se conserva la fecha original.

**Diseño fuera del catálogo:** el cliente puede escribir `un dinosaurio azul con estrellas` en lugar de elegir una opción. El sistema lo almacena como propuesta personalizada y crea una revisión pendiente; el encargado confirma viabilidad antes de aplicarlo.

**Fecha y hora escritas:** cuando el chat solicita la fecha, se puede escribir `viernes` o `7 de noviembre`; para la hora se puede escribir `3:30 pm`. Si la expresión no se reconoce o no es válida, se solicita corregirla.

**Confirmación de pedido nuevo:** después del resumen, solo una afirmación reconocida crea el pedido. Respuestas como `no`, `mejor no` o `no quiero confirmar` informan que no se registró.

La interpretación se basa en reglas de texto y expresiones conocidas; no es un modelo de inteligencia artificial ni un motor conversacional ilimitado. Si el mensaje es ambiguo, el bot solicita una precisión en vez de inventar los datos.

## 5. Criterios de aceptación

| ID | Criterio | Verificación |
|---|---|---|
| CA2-01 | La ruta de datos es estable y se muestra al arrancar. | Ejecutar el programa desde la carpeta del proyecto y comprobar la línea `Datos guardados en ...`. |
| CA2-02 | Los pedidos, cambios e historial permanecen al cerrar y volver a abrir el servidor. | Crear o modificar un pedido, detener el servidor, iniciarlo de nuevo y revisar los archivos y la interfaz. |
| CA2-03 | El chat reconoce una consulta y una solicitud de cambio escritas en lenguaje natural. | Probar `quiero consultar el pedido #154` y `quiero cambiar la fecha del pedido #154`. |
| CA2-04 | La fecha y la hora se validan antes de enviar la solicitud. | Usar entradas válidas e inválidas y comprobar que una inválida no se envía. |
| CA2-05 | Una respuesta negativa no crea un pedido. | Llegar al resumen de un pedido y escribir `no quiero confirmar`; comprobar que no aparece una confirmación ni un pedido nuevo. |
| CA2-06 | La transcripción de la misma pestaña se conserva después de recargar. | Escribir un mensaje, recargar, abrir el chat y comprobar que el mensaje sigue visible. |
| CA2-07 | Se mantiene el diseño existente. | Comparar el menú lateral, colores, tarjetas y chat con la versión anterior; comprobar que el nuevo campo conserva los estilos de la interfaz. |
| CA2-08 | La frase completa para un cambio válido actualiza el pedido real. | Enviar una solicitud de cantidad o fecha con pedido y valor en la misma frase; volver a consultar el pedido y comprobar el valor almacenado. |
| CA2-09 | El diseño fuera del catálogo no se aplica sin decisión humana. | Enviar una descripción, revisar que aparezca en Pendientes y aprobar; comprobar que solo entonces cambia el diseño del pedido. |
| CA2-10 | Una fecha pasada o saturada no modifica directamente el pedido. | Enviar un cambio con fecha pasada y otro con fecha cuyo número de pedidos alcanza el límite configurado; comprobar que ambos queden pendientes y conserven los datos actuales. |
| CA2-11 | Se puede iniciar sin los pedidos de muestra si el negocio quiere usar solo sus propios datos. | En una carpeta nueva, establecer `PEDIDOSFLOW_MODO_DEMO=0`; comprobar que la lista comienza vacía y que el primer pedido creado tiene el ID `1`. |
| CA2-12 | La aplicación se puede probar desde la primera ejecución con pedidos precargados y sin duplicarlos en reinicios. | Iniciar con modo demo por defecto en una carpeta nueva; verificar cinco pedidos y reiniciar dos veces. Confirmar que los mismos pedidos permanecen y que sus cambios guardados no se revierten. |

## 6. Ejecución y pruebas

Requisitos: Node.js 20 o superior y npm.

```bash
npm install
npm run verify
npm start
```

Abrir `http://localhost:3001`. En la consola se indica dónde se guardan los datos. Para señalar una carpeta alternativa, define `PEDIDOSFLOW_DATOS` antes de iniciar el servidor. Por defecto se cargan los cinco pedidos de demostración, una sola vez. Para iniciar sin esos datos en una carpeta nueva, establece `PEDIDOSFLOW_MODO_DEMO=0`. En PowerShell, por ejemplo:

```powershell
$env:PEDIDOSFLOW_DATOS = "C:\PedidosFlowDatos"
$env:PEDIDOSFLOW_MODO_DEMO = "0"
npm start
```

Para las pruebas de extremo a extremo se requieren adicionalmente Playwright y Chromium, conforme a `docs/PRUEBAS.md`.

### Estado de verificación

La comprobación sintáctica de JavaScript se ejecutó sobre `public/chat.js`, `public/app.js`, `public/util.js` y `e2e/recorrido.cjs`. En el entorno utilizado para preparar este complemento no se pudo completar `npm run verify`: faltaban archivos de las dependencias de TypeScript y sus tipos (`TS2688`). Por esta razón, las pruebas de tipos, la suite automatizada de la API y los escenarios E2E incorporados para este incremento se deben ejecutar de nuevo en el equipo del proyecto antes de declarar el incremento completamente verificado.

Se añadieron los escenarios E2E-8a a E2E-8h: interpretación de lenguaje natural, consulta directa, continuidad de la transcripción, confirmación negativa, actualización real de una cantidad desde frase libre, envío de fechas pasadas a pendientes y revisión de diseños fuera del catálogo. Su estado es **pendiente de ejecución** hasta completar esa verificación.

## 7. Alcance y limitaciones

- El chat continúa siendo una interfaz web que simula una conversación estilo WhatsApp. Este incremento no conecta la aplicación a una cuenta real de WhatsApp.
- Para conectar WhatsApp real hace falta configurar WhatsApp Business Platform/Cloud API, disponer de los activos empresariales y credenciales correspondientes y preparar la recepción de eventos mediante webhook. No se incluyen credenciales ficticias ni se afirma que esa integración esté activa.
- La comprensión de mensajes está basada en reglas y frases comunes, no en un modelo de IA generativa. Las intenciones ambiguas requieren que el usuario aclare qué necesita. La operación se valida en el servidor; no debe anunciarse un cambio como aplicado si el servidor no confirmó la actualización.
- `sessionStorage` conserva la conversación en la misma pestaña; los pedidos y decisiones se guardan en los archivos JSON del servidor.
- Las reglas de producción deben validarse con un negocio real antes de usarse como criterio operativo.

## 8. Trabajo recomendado para una iteración posterior

1. Ejecutar y guardar evidencia de `npm run verify` y del recorrido E2E completo.
2. Verificar con el equipo la ubicación de los JSON existentes para asegurar que el programa use la carpeta correcta y conservar los datos históricos.
3. Si el proyecto requiere WhatsApp real, planificar por separado la integración oficial: credenciales seguras, webhook accesible, verificación de eventos y envío de respuestas. No mezclar esta tarea con la simulación web.

## Referencias técnicas

- Meta, WhatsApp Business Platform, Developer Hub: https://whatsappbusiness.com/es-la/developers/developer-hub/
- Meta, WhatsApp Cloud API, colección de documentación: https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api/


## 9. Entrega académica y trazabilidad

El informe completo que organiza el avance según los ocho componentes de la guía docente está en [`SEGUNDO_AVANCE_PEDIDOSFLOW.pdf`](SEGUNDO_AVANCE_PEDIDOSFLOW.pdf), con fuente editable en [`SEGUNDO_AVANCE_PEDIDOSFLOW.docx`](SEGUNDO_AVANCE_PEDIDOSFLOW.docx). El checklist de requisitos está en [`ENTREGA_SEGUNDO_AVANCE.md`](ENTREGA_SEGUNDO_AVANCE.md).

Antes de declarar terminado el incremento, ejecutar `npm ci`, `npm run verify` y el recorrido E2E; guardar la evidencia real. El repositorio público, sus ramas, commits, issues, pull requests y merge deben actualizarse por los integrantes del equipo: el ZIP de código no publica estos cambios automáticamente.

## 10. Opciones de chat y aviso posterior a la revisión humana

El chat separa visualmente el bloque de opciones rápidas del área de escritura. Las opciones compactas aparecen debajo de la conversación y encima del campo de mensaje; el control «Volver al menú» se muestra dentro del mismo bloque de opciones. Las opciones de cada paso siguen disponibles, pero no se confunden con el campo donde se escribe libremente.

Cuando una modificación requiere revisión o no puede aprobarse automáticamente, el primer mensaje al cliente indica que la solicitud está pendiente y que los datos originales se conservan. El chat guarda el identificador de esa solicitud en la sesión y consulta el servidor. Solo cuando el encargado guarda la decisión en la vista **Cambios pendientes**, el chat agrega un mensaje final de aprobación o rechazo y vuelve a leer el pedido para mostrar los datos actuales. La decisión no se anuncia como definitiva antes de la revisión humana. Los avisos posteriores se simulan en la interfaz web; WhatsApp Business real requiere la integración saliente correspondiente.

La transcripción y los identificadores pendientes se conservan en `sessionStorage` de la pestaña, mientras que el estado de pedidos y decisiones continúa en los archivos JSON del servidor.
