Diseña un prototipo web de alta fidelidad, moderno y profesional, para un proyecto universitario de Ingeniería de Sistemas llamado:

“SISTEMA DE GESTIÓN DE PEDIDOS PERSONALIZADOS CON VALIDACIÓN AUTOMÁTICA DE CAMBIOS”

IMPORTANTE:
Este proyecto NO es solamente un sistema CRUD de pedidos.
El núcleo es:
1. recibir pedidos personalizados mediante un bot de WhatsApp;
2. convertir la conversación en un pedido estructurado;
3. registrar y mantener las diferentes versiones del pedido;
4. cuando el cliente solicita un cambio, evaluar automáticamente si ese cambio todavía es posible según las condiciones actuales del pedido;
5. aprobar o rechazar automáticamente el cambio;
6. cuando un cambio rechazado merece una revisión, enviar una alerta al encargado para que pueda revisar y tomar una decisión manual.

NO diseñar una IA genérica ni un chatbot de preguntas abiertas.
El bot debe ser un asistente conversacional guiado, con opciones, botones, listas y preguntas estructuradas.

========================
1. FLUJO GENERAL
========================

Diseñar el prototipo para demostrar este flujo:

CLIENTE
↓
WHATSAPP
↓
BOT DE PEDIDOS
↓
CAPTURA LOS DATOS
↓
PEDIDO ESTRUCTURADO
↓
PLATAFORMA DEL NEGOCIO
↓
CLIENTE SOLICITA UN CAMBIO
↓
BOT RECIBE EL CAMBIO
↓
MOTOR DE VALIDACIÓN
↓
DECISIÓN AUTOMÁTICA

La decisión puede ser:

🟢 CAMBIO APROBADO AUTOMÁTICAMENTE
🟡 CAMBIO ENVIADO A REVISIÓN
🔴 CAMBIO RECHAZADO AUTOMÁTICAMENTE

========================
2. CONTEXTO
========================

El sistema está pensado para pequeños negocios que fabrican productos personalizados, por ejemplo:

- tortas;
- camisetas;
- arreglos florales;
- muebles;
- invitaciones;
- productos artesanales.

El problema es que los pedidos y sus modificaciones suelen manejarse mediante WhatsApp y otros medios, por lo que los detalles pueden quedar dispersos y generar confusión sobre cuál es la versión vigente del pedido y si un cambio todavía puede realizarse.

========================
3. PARTE DE WHATSAPP
========================

Crear una pantalla que visualmente represente una conversación de WhatsApp.

Debe parecer una conversación real y sencilla, no una interfaz de IA.

Nombre del bot:
“PedidosFlow”

El flujo debe comenzar así:

BOT:
“Hola 👋 Te ayudaré a registrar tu pedido.”

BOT:
“¿Qué producto deseas solicitar?”

Botones:
[Torta personalizada]
[Camiseta personalizada]
[Arreglo floral]

Ejemplo de flujo para una torta:

BOT:
“¿Para cuántas personas?”

Opciones:
[10]
[20]
[25]
[30]

BOT:
“¿Qué color deseas?”

Opciones:
[Azul]
[Rojo]
[Rosado]
[Otro]

BOT:
“¿Para qué fecha necesitas el pedido?”

BOT:
“Este es el resumen de tu pedido:
Torta personalizada
20 personas
Color azul
Entrega: sábado 30 de agosto, 4:00 PM

¿Deseas confirmar?”

Botones:
[Confirmar pedido]
[Modificar pedido]

Después mostrar:

BOT:
“✅ Pedido #154 confirmado.”

========================
4. PEDIDO CREADO EN LA PLATAFORMA
========================

Al confirmar el pedido, debe aparecer automáticamente en el panel del negocio.

Crear un dashboard profesional.

Mostrar tarjetas:

- Pedidos activos
- Cambios pendientes
- Pedidos en producción
- Pedidos en riesgo

Mostrar una tabla:

PEDIDO | CLIENTE | PRODUCTO | FECHA | ESTADO

Ejemplo:

#154 | Laura Gómez | Torta personalizada | 30/08 16:00 | Confirmado

#153 | Daniel Ruiz | 20 camisetas | 30/08 18:00 | En producción

#152 | Camila Pérez | Arreglo floral | 31/08 10:00 | Confirmado

========================
5. DETALLE DEL PEDIDO
========================

Al abrir el pedido #154 mostrar:

PEDIDO #154

Cliente:
Laura Gómez

Producto:
Torta personalizada

Cantidad:
20 personas

Color:
Azul

Fecha de entrega:
30/08 – 16:00

Estado:
Confirmado

Producción:
No iniciada

========================
6. SOLICITUD DE CAMBIO
========================

Crear una demostración donde el cliente vuelve a WhatsApp y solicita:

“Quiero cambiar la cantidad de 20 a 25 personas.”

El bot debe responder:

“Recibí tu solicitud de cambio.
Voy a verificar si todavía es posible modificar tu pedido.”

IMPORTANTE:
El bot NO debe aprobar inmediatamente.

Debe enviar la solicitud al motor de validación.

========================
7. MOTOR DE VALIDACIÓN
========================

En la plataforma del negocio debe existir una sección llamada:

“Validación del cambio”

Mostrar claramente las reglas que el sistema revisa.

Ejemplo:

Producción iniciada:
NO ✅

Capacidad disponible:
SÍ ✅

Tiempo suficiente para la entrega:
SÍ ✅

Restricciones del producto:
CUMPLE ✅

Resultado:

✅ CAMBIO VIABLE

Botón:
[Aprobar cambio]

Explicar visualmente que el bot tomó la decisión basándose en reglas definidas.

========================
8. APROBACIÓN AUTOMÁTICA
========================

Cuando el cambio es aprobado:

Actualizar:

20 personas → 25 personas

Mostrar:

“✅ Cambio aprobado automáticamente”

Actualizar el pedido.

Mostrar una notificación en el panel:

“Pedido #154 actualizado.
Cambio aprobado: 20 → 25 personas.”

Actualizar el historial.

========================
9. HISTORIAL DE VERSIONES
========================

Crear una sección:

“HISTORIAL DEL PEDIDO”

Mostrar:

Versión 1
27/08 – 09:15
20 personas
Color azul
Entrega 30/08

Cambio solicitado
29/08 – 11:20
20 → 25 personas

Versión 2
29/08 – 11:21
25 personas
Color azul
Entrega 30/08

Mostrar visualmente la diferencia entre versiones.

========================
10. SEGUNDO ESCENARIO: CAMBIO RECHAZADO
========================

Crear un segundo escenario de demostración.

Pedido:

#155
Torta personalizada
20 personas
Estado:
EN PRODUCCIÓN

El cliente solicita mediante WhatsApp:

“Quiero cambiar completamente el diseño.”

El bot responde:

“Voy a verificar si el cambio todavía puede realizarse.”

El motor revisa las reglas:

Producción iniciada:
SÍ ❌

Cambio de diseño permitido en este estado:
NO ❌

Resultado:

🔴 CAMBIO NO VIABLE

El bot informa al cliente:

“No es posible realizar este cambio porque el pedido ya se encuentra en producción.”

========================
11. ALERTA PARA REVISIÓN HUMANA
========================

Aunque el bot rechace automáticamente el cambio, el sistema debe mostrar una alerta al encargado.

Crear una sección:

“CAMBIOS QUE REQUIEREN REVISIÓN”

Ejemplo:

🔴 Pedido #155
Cliente: Laura Gómez

Cambio solicitado:
Cambio completo de diseño

Decisión automática:
RECHAZADO

Motivo:
El pedido ya está en producción.

Botones:

[Revisar solicitud]
[Mantener rechazo]
[Aprobar manualmente]

IMPORTANTE:
La persona encargada debe poder revisar el caso y cambiar la decisión automática.

========================
12. REVISIÓN MANUAL
========================

Al seleccionar “Revisar solicitud”, mostrar:

Pedido #155
Estado actual:
En producción

Cambio solicitado:
Nuevo diseño

Motivo del rechazo automático:
Pedido ya iniciado

Información adicional:
El encargado puede comprobar si existe una excepción o una situación especial.

Botones:

[Aprobar manualmente]
[Mantener rechazo]

Si aprueba manualmente:

Mostrar:

“⚠ Cambio aprobado manualmente por el encargado.”

Guardar en el historial:

“Decisión automática: rechazado”
“Decisión manual: aprobado”
“Responsable: Administrador”
“Fecha y hora”

========================
13. NOTIFICACIONES
========================

Crear un sistema de notificaciones dentro de la plataforma.

Ejemplos:

🔔 Nuevo pedido recibido
🔔 Cliente solicitó un cambio
✅ Cambio aprobado automáticamente
🔴 Cambio rechazado automáticamente
⚠ Cambio enviado a revisión
✅ Cambio aprobado manualmente

========================
14. NAVEGACIÓN
========================

Crear navegación lateral con:

- Resumen
- Pedidos
- Cambios pendientes
- Producción
- Clientes
- Historial
- Configuración

Crear navegación superior o selector entre:

[Plataforma]
[WhatsApp + Bot]

========================
15. ESTILO VISUAL
========================

Diseño profesional y moderno.

No usar una estética excesivamente tecnológica.

Debe parecer un software real utilizado por un pequeño negocio.

Interfaz limpia, ordenada y fácil de entender.

Usar:

- tablas;
- tarjetas;
- etiquetas de estado;
- alertas;
- historial;
- paneles;
- botones claros.

Usar pocos colores y reservar los colores de estado para:

Verde = aprobado
Rojo = rechazado
Amarillo = revisión / pendiente
Azul = información

========================
16. PROTOTIPO INTERACTIVO
========================

El prototipo debe permitir al profesor recorrer al menos estos dos flujos completos:

FLUJO 1:
WhatsApp
→ crear pedido
→ confirmar pedido
→ pedido aparece en plataforma
→ solicitar cambio
→ validación
→ cambio aprobado
→ pedido actualizado
→ nueva versión en historial

FLUJO 2:
WhatsApp
→ solicitar cambio
→ validación
→ cambio rechazado
→ alerta en plataforma
→ revisión humana
→ aprobar manualmente o mantener rechazo
→ guardar decisión en historial

Crear enlaces/prototipos entre las pantallas para que el profesor pueda probar estos recorridos.

No crear funcionalidades innecesarias como pagos, inventario completo, mapas, delivery, sistema financiero o una red social.
El foco debe mantenerse en:
PEDIDO → CAMBIO → VALIDACIÓN → DECISIÓN → TRAZABILIDAD.