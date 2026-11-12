# Bot de Telegram (Incremento 3)

El bot permite al cliente consultar su pedido y pedir cambios de cantidad o fecha desde Telegram.
No contiene reglas de negocio: traduce cada comando a una llamada a la API de PedidosFlow y muestra
la decisión del mismo motor de validación que usa la plataforma web.

## Comandos

| Comando | Qué hace | Criterio |
| --- | --- | --- |
| `/consultar 154` | Muestra el estado y la etapa de producción del pedido | CA-1 |
| `/cantidad 154 40` | Pide cambiar la cantidad; responde aplicado, en revisión o rechazado | CA-2, CA-3 |
| `/fecha 154 2026-11-20 [15:00]` | Pide cambiar la fecha de entrega (la hora es opcional) | CA-2, CA-3 |
| `/ayuda`, `/start` | Muestra los comandos disponibles | — |

Si el pedido no existe, el bot lo informa y no pide más datos (CA-4). Cada cambio hecho por este
canal queda en el historial con el canal `telegram` (HU-09).

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
respuestas se interceptan. Cubren los criterios CA-1 a CA-4 contra el servidor real (carpeta de datos temporal).
La ejecución real en Telegram se registra aparte, con capturas del chat.

## Limitaciones conocidas

- El bot **no verifica quién escribe**: cualquiera que conozca el bot y un número de pedido puede consultarlo
  o pedir cambios. Por eso la consulta no muestra nombre ni teléfono del cliente. Vincular el chat con el
  teléfono del cliente queda como mejora futura.
- Solo entiende comandos. El texto libre, los cambios de diseño y la creación de pedidos siguen disponibles
  únicamente en el chat web.
- Funciona por *long polling*: solo responde mientras `npm run bot` esté corriendo en el computador.
