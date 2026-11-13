# Bot de Telegram (Incremento 3)

El bot permite al cliente hacer un pedido nuevo, consultarlo y pedir cambios de cantidad o fecha desde Telegram,
con comandos o escribiendo con sus propias palabras. No contiene reglas de negocio: traduce cada
mensaje a una llamada a la API de PedidosFlow y muestra la decisión del mismo motor de validación
que usa la plataforma web.

> **Alcance.** El Mapa de evolución limitó el corte mínimo del Incremento 3 a consultar y cambiar cantidad o fecha
> con comandos, y dejó el texto libre para después. El equipo agregó después, por decisión propia, el lenguaje
> normal (por reglas, sin IA) y la creación de pedidos, porque el chat es el canal del cliente y sin ellos
> no podía hacer pedidos. Esta página describe lo implementado.

## Comandos

| Comando | Qué hace | Criterio |
| --- | --- | --- |
| `/pedido` | Inicia el registro de un pedido nuevo, paso a paso | — |
| `/consultar 154` | Muestra el estado y la etapa de producción del pedido | CA-1 |
| `/cantidad 154 40` | Pide cambiar la cantidad; responde aplicado, en revisión o rechazado | CA-2, CA-3 |
| `/fecha 154 2026-11-20 [15:00]` | Pide cambiar la fecha de entrega (la hora es opcional) | CA-2, CA-3 |
| `/ayuda`, `/start` | Muestra los comandos disponibles | — |

Si el pedido no existe, el bot lo informa y no pide más datos (CA-4). Cada cambio hecho por este
canal queda en el historial con el canal `telegram` (HU-09).

## Lenguaje normal

El cliente puede escribir, por ejemplo:

- «Quiero consultar el pedido 154» o «¿cómo va mi pedido #155?»
- «Cambia la cantidad del pedido 154 a 40 personas»
- «Mueve la entrega del pedido 154 al 20 de noviembre» o «para el viernes a las 3 pm»

Cómo se comporta:

- **Pregunta lo que falta.** Si no dice el pedido, la cantidad o la fecha, el bot lo pregunta. Para reutilizar el
  último pedido basta responder «el mismo».
- **Verifica el pedido primero.** Si no existe, lo informa y no pide más datos (CA-4).
- **Pide confirmación antes de cambiar nada.** Muestra el resumen («Cantidad: 20 personas → 40 personas») con los
  botones «Sí, confirmar» y «No, cancelar». Solo después de confirmar se envía el cambio al motor.
- **Una cosa a la vez.** Si el mensaje mezcla varias peticiones, pide hacerlas por separado.
- **Memoria corta.** Recuerda la conversación de cada chat por 15 minutos; una confirmación pendiente que tarda más
  vence y no se aplica. Cualquier comando (`/consultar`, `/cantidad`, `/fecha`) cancela la solicitud en curso.
- **Fechas y horas.** Entiende «mañana», «pasado mañana», «el viernes», «20 de noviembre», `20/11/2026` y
  `2026-11-20`, y horas como «3 pm», «15:30» o «a las 4 de la tarde», con las mismas reglas del chat web.

No es inteligencia artificial: son reglas de texto (`src/bot/lenguaje.ts`). Solo extraen datos del mensaje; la decisión de
aplicar, enviar a revisión o rechazar un cambio sigue siendo del motor de validación del servidor.

## Hacer un pedido

El cliente escribe «quiero hacer un pedido» (o «quiero una torta», o usa `/pedido`) y el bot pregunta, de a un dato por vez:

1. Nombre y teléfono de contacto.
2. Cantidad de personas.
3. Diseño: uno del catálogo (botones) o «Diseño personalizado», que se describe con palabras y/o una foto de referencia.
4. Fecha y hora de entrega («cualquiera» deja el mediodía, que es la hora por defecto del sistema).

Si el primer mensaje ya trae datos («una torta para 30 personas el 20 de noviembre a las 3 pm»), solo pregunta lo que falta.
Antes de registrar, muestra un resumen y pide confirmar; el pedido se envía al servidor solo después del «sí».
Cada dato se valida con las mismas reglas del servidor (cantidad máxima, fecha no anterior a hoy, formato de hora).
Se puede cancelar en cualquier paso escribiendo «cancelar» (o con «no» en los pasos de respuesta corta).

- El pedido queda registrado con el canal `telegram`, y al cliente se le entrega el número que usará para consultarlo.
- Un diseño personalizado, con o sin foto, queda **pendiente de revisión** del encargado, igual que en el chat web.
- La foto se descarga desde Telegram y se envía al servidor como imagen; solo se usa en el paso del diseño personalizado.

## Cómo ejecutarlo

1. Crear el bot con `@BotFather` en Telegram (`/newbot`) y copiar el token.
2. En la carpeta `incremento2-servidor`, copiar `.env.example` como `.env` y reemplazar el valor de
   `TELEGRAM_BOT_TOKEN`. El archivo `.env` está en `.gitignore`: **nunca debe subirse al repositorio**.
3. Instalar dependencias: `npm ci`.
4. En una terminal, iniciar el servidor: `npm start`.
5. En otra terminal, iniciar el bot: `npm run bot`.
6. Abrir el bot en Telegram y escribir `/ayuda`.

Solo una persona a la vez puede ejecutar el bot con el mismo token; si hay dos, Telegram rechaza a la segunda.

## Pruebas

`npm run verify` ejecuta las pruebas del bot sin conectarse a Telegram: los mensajes se simulan y las
respuestas se interceptan. Cubren los criterios CA-1 a CA-4, tanto con comandos como con lenguaje normal, contra el
servidor real (carpeta de datos temporal) y con un reloj fijo para las fechas relativas.
La ejecución real en Telegram se registra aparte, con capturas del chat.

## Limitaciones conocidas

- El bot **no verifica quién escribe**: cualquiera que conozca el bot y un número de pedido puede consultarlo
  o pedir cambios. Por eso la consulta no muestra nombre ni teléfono del cliente. Vincular el chat con el
  teléfono del cliente queda como mejora futura.
- Entiende las frases habituales para hacer pedidos, consultarlos y cambiar cantidad o fecha, pero no cualquier
  redacción: si no entiende, lo dice y sugiere ejemplos.
- Por Telegram todavía no se puede cambiar el diseño de un pedido existente ni cancelarlo: el bot indica que se
  pida directamente a la pastelería. (El chat web simulado sí tiene el cambio de diseño.)
- El bot no verifica quién es el cliente: los datos del pedido (nombre y teléfono) son los que la persona escribe.
- La memoria de la conversación está solo en el programa (se pierde al reiniciar el bot).
- Funciona por *long polling*: solo responde mientras `npm run bot` esté corriendo en el computador.
