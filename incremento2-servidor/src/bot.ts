import { existsSync } from 'node:fs';
import { GrammyError } from 'grammy';
import { crearClienteApi } from './bot/clienteApi.js';
import { COMANDOS_MENU, crearBot, ocultarToken } from './bot/telegram.js';

// Punto de entrada del bot de Telegram. Se ejecuta con "npm run bot", en una terminal aparte del servidor.

try {
  process.loadEnvFile?.('.env');
} catch {
  // Si no hay archivo .env se usan las variables de entorno del sistema.
}

const token = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim();
const apiUrl = (process.env.PEDIDOSFLOW_API ?? 'http://localhost:3001').trim();

if (!token || token === 'pega_aqui_el_token') {
  console.error('Falta el token del bot de Telegram.');
  if (existsSync('.env.txt')) {
    console.error('Encontré un archivo llamado .env.txt: renómbralo a .env (sin ".txt"). Windows suele ocultar la extensión.');
  } else {
    console.error('Crea un archivo llamado .env (con ese nombre exacto) en la carpeta incremento2-servidor, con esta línea:');
    console.error('TELEGRAM_BOT_TOKEN=el_token_que_te_dio_BotFather');
  }
  process.exit(1);
}

const bot = crearBot(token, crearClienteApi(apiUrl));

async function avisarSiElServidorNoResponde(): Promise<void> {
  try {
    const r = await fetch(`${apiUrl}/api/configuracion`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error(String(r.status));
  } catch {
    console.warn(`Aviso: no puedo comunicarme con el servidor en ${apiUrl}. Inícialo con "npm start" en otra terminal.`);
  }
}

const detener = () => {
  console.log('Deteniendo el bot...');
  void bot.stop();
};
process.once('SIGINT', detener);
process.once('SIGTERM', detener);

bot
  .start({
    onStart: async info => {
      console.log(`Bot @${info.username} escuchando mensajes de Telegram (servidor: ${apiUrl}).`);
      console.log('Presiona Ctrl+C para detenerlo.');
      await avisarSiElServidorNoResponde();
      try {
        await bot.api.setMyCommands(COMANDOS_MENU);
      } catch {
        // El menú de comandos es opcional: si falla, el bot sigue funcionando.
      }
    }
  })
  .catch(err => {
    if (err instanceof GrammyError && err.error_code === 401) {
      console.error('Telegram rechazó el token. Revisa que esté completo y que sea el vigente (si lo revocaste, usa el nuevo).');
    } else if (err instanceof GrammyError && err.error_code === 409) {
      console.error('Ya hay otro bot usando este mismo token (por ejemplo, otra terminal u otra persona). Cierra el otro e inténtalo de nuevo.');
    } else {
      console.error('No se pudo iniciar el bot:', ocultarToken(String(err?.message ?? err), token));
    }
    process.exit(1);
  });
