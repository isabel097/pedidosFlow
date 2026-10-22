# PedidosFlow

Proyecto académico del equipo **Gemas de Cristal** para gestionar pedidos de tortas personalizadas.

## Estado del repositorio y paquete ejecutable

Este repositorio contiene el prototipo inicial de Figma Make (React + Vite) y documentación histórica de los incrementos. El paquete ejecutable actualizado del segundo incremento utiliza un servidor Express + TypeScript y una interfaz web en `public/`; **no se debe asumir que esa implementación completa está publicada en esta rama hasta que sus archivos se sincronicen explícitamente**.

## Alcance funcional descrito para el incremento 2

El paquete ejecutable de la entrega incluye:

- Consulta y modificación de pedidos según etapa de producción.
- Solicitudes pendientes para revisión humana.
- Persistencia de pedidos, cambios, notificaciones y configuración en JSON local.
- Chat web simulado de WhatsApp con opciones rápidas y texto libre para intenciones conocidas.
- Menú compacto separado del campo de escritura.
- Aviso final en el chat después de que el encargado guarda la aprobación o el rechazo.
- Precarga de cinco pedidos de demostración (#152–#156) cuando la carpeta de datos está nueva o vacía, sin duplicar ni reiniciar cambios en ejecuciones posteriores.
- Reglas para enviar a revisión fechas pasadas, días con capacidad diaria alcanzada y diseños personalizados fuera del catálogo.

La existencia de estas funciones en el ZIP no implica que las pruebas de la versión final hayan pasado. Consultar `docs/INCREMENTO_2_CIERRE.md` y `docs/EVIDENCIAS_INCREMENTO_2.md` para el alcance, los comandos y las evidencias que faltan adjuntar.

## Cómo ejecutar el paquete funcional de la entrega

Requisitos: Node.js 20 o superior y npm. En Windows, descomprime el ZIP del incremento 2 y ejecuta `INICIAR_PEDIDOSFLOW.bat` desde la carpeta principal del proyecto. Alternativamente, desde la raíz del paquete ejecutable:

```powershell
npm ci
npm run verify
npm start
```

Abre http://localhost:3001. Mantén abierta la terminal mientras usas la aplicación.

## Limitaciones

- El chat es una simulación web; no está conectado a WhatsApp Business Platform.
- La interpretación de texto se basa en reglas y patrones conocidos; no comprende cualquier mensaje posible.
- La persistencia es local en JSON, no una base de datos compartida para un despliegue multiusuario.
- La autenticación administrativa y la analítica avanzada no forman parte de este incremento.
- Antes de declarar la entrega cerrada, ejecutar la regresión y el recorrido E2E de la versión final, guardar capturas reales y completar la revisión cruzada del pull request.

## Flujo de trabajo

La rama estable es `main`. Los cambios deben proponerse mediante ramas y pull requests. No marcar una historia como terminada solo porque el código está escrito: las pruebas, la revisión y la integración también deben comprobarse.

## Equipo

- Steven Suaza Montiel
- Isabel Cristina Duque Cano

## Documentación

- [Planeación del incremento 1](docs/PLANEACION_INCREMENTO_1.md)
- [Cierre del incremento 2](docs/INCREMENTO_2_CIERRE.md)
- [Evidencias del incremento 2](docs/EVIDENCIAS_INCREMENTO_2.md)
- [Documentación técnica y pruebas](docs/)
- [Repositorio](https://github.com/isabel097/pedidosFlow)