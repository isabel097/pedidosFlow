# Pruebas de PedidosFlow (incrementos 1 y 2)

## Resumen de resultados reportados para la versión base

Los siguientes resultados quedaron registrados antes de los cambios del segundo incremento. Deben repetirse sobre la copia actualizada antes de declarar el incremento 2 verificado.

| Tipo | Cantidad reportada | Resultado histórico documentado | Estado en la copia actualizada |
|---|---:|---|---|
| Pruebas unitarias del motor de reglas (`test/reglas.test.ts`) | 29 | 29 aprobadas | Reejecutar |
| Pruebas de la API y los flujos de cambio (`test/api.test.ts`) | 47 | 47 aprobadas | Reejecutar |
| Pruebas de persistencia (`test/persistencia.test.ts`) | 4 | 4 aprobadas | Reejecutar, especialmente la nueva ruta de datos |
| **Total automatizadas** | **80** | **80 aprobadas, 0 fallidas** | **Pendiente de regresión** |
| Recorrido de punta a punta en el navegador (`e2e/recorrido.cjs`) | 31 verificaciones definidas | Resultados históricos de la versión base; no atribuirlos al código actual | Reejecutar las 31 verificaciones |

Cada prueba de la API usa una carpeta de datos temporal propia, por lo que no dependen unas de otras ni modifican la carpeta `data/`. Se agregó CP-47 para comprobar que una carpeta antigua con `pedidos.json` vacío vuelve a precargar los ejemplos y que el segundo inicio no duplica pedidos ni revierte una modificación guardada. La comprobación sintáctica `node --check` se ejecutó sobre los cuatro archivos JavaScript principales; no sustituye las pruebas funcionales.

## Comprobación local reportada el 22 de octubre de 2026

`npm run` identificó correctamente el paquete `pedidosflow@1.0.0` y mostró los scripts `start`, `test`, `typecheck` y `verify`. Después, `npm ci` se detuvo con `EPERM` al intentar eliminar `node_modules/@esbuild/win32-x64/esbuild.exe`. La instalación incompleta hizo que `npm run verify` no encontrara `express` y que `npm start` no encontrara `tsx`. Se trata de una comprobación real bloqueada por el entorno de Windows, no de una regresión aprobada. Tras limpiar `node_modules` e instalar de nuevo, deben repetirse `npm run verify` y el recorrido E2E y conservarse las salidas completas.

## Cómo ejecutarlas

```bash
npm test              # 80 pruebas automatizadas
npm run typecheck    # verificación de tipos
```

Recorrido de punta a punta (opcional, usa un navegador real):

```bash
npm i -D playwright && npx playwright install chromium
PEDIDOSFLOW_DATOS=/tmp/pf-e2e npm start  # en una terminal; el modo demo está activado por defecto
node e2e/recorrido.cjs                            # en otra terminal
```

## Casos de prueba de la API (CP)

Los casos principal, alternativo y de error de la planeación están cubiertos así: **principal** = CP-01 y CP-02; **alternativo** = CP-03 y CP-04; **error** = CP-06 y CP-07.

| Caso | Escenario | Resultado |
|---|---|---|
| CP-01 | cantidad: #154 antes de producción → se aplica y queda en el historial | Pendiente de regresión local |
| CP-02 | cantidad: acepta la cantidad escrita como texto | Pendiente de regresión local |
| CP-03 | cantidad: #155 en producción → queda pendiente de revisión y NO cambia el pedido | Pendiente de regresión local |
| CP-04 | cantidad: control final → se rechaza con motivo y el pedido no cambia | Pendiente de regresión local |
| CP-05 | cantidad: el avance de producción cambia la decisión del mismo pedido | Pendiente de regresión local |
| CP-06 | cantidad: pedido inexistente → 404 y no se registra nada | Pendiente de regresión local |
| CP-07 | cantidad: valor inválido — 7 valores | Pendiente de regresión local |
| CP-08 | cantidad: pedir la misma cantidad actual → 400 | Pendiente de regresión local |
| CP-09 | campo desconocido → 400 | Pendiente de regresión local |
| CP-10 | JSON mal formado → 400 con mensaje claro | Pendiente de regresión local |
| CP-11 | diseño de catálogo: antes de producción se aplica | Pendiente de regresión local |
| CP-12 | diseño: #155 en producción → se rechaza automáticamente y queda para revisión | Pendiente de regresión local |
| CP-13 | diseño: estilo inexistente o igual al actual → 400 | Pendiente de regresión local |
| CP-14 | diseño personalizado: va a revisión humana con su foto y el pedido no cambia | Pendiente de regresión local |
| CP-15 | diseño personalizado sin imagen válida → 400 | Pendiente de regresión local |
| CP-16 | fecha: antes de producción se aplica; en producción va a revisión | Pendiente de regresión local |
| CP-17 | fecha pasada válida en modificación → pendiente; fecha inválida → 400 (CP-17b) | Pendiente de regresión local |
| CP-18 | aprobar manualmente un rechazo aplica el cambio y conserva la decisión automática | Pendiente de regresión local |
| CP-19 | mantener el rechazo no cambia el pedido y cierra la revisión | Pendiente de regresión local |
| CP-20 | aprobar un cambio de cantidad en revisión lo aplica | Pendiente de regresión local |
| CP-21 | una revisión ya resuelta no se puede decidir otra vez | Pendiente de regresión local |
| CP-22 | decisión inválida | Pendiente de regresión local |
| CP-23 | pedido #156 | Pendiente de regresión local |
| CP-24 | pedido #156: diseño no viable lo cancela y no admite más cambios | Pendiente de regresión local |
| CP-25 | producción: marcar pasos recalcula etapa, avance y estado | Pendiente de regresión local |
| CP-26 | producción: checklist inválido o fuera de orden → 400 | Pendiente de regresión local |
| CP-27 | producción: lista solo pedidos no cancelados con sus pasos | Pendiente de regresión local |
| CP-28 | pedido nuevo de catálogo: queda confirmado con el siguiente número | Pendiente de regresión local |
| CP-29 | pedido nuevo con diseño personalizado: queda pendiente de revisión | Pendiente de regresión local |
| CP-30 | pedido nuevo con datos inválidos → 400 y no se crea | Pendiente de regresión local |
| CP-31 | dashboard: contadores iniciales coherentes con los pedidos | Pendiente de regresión local |
| CP-32 | dashboard: la última decisión refleja el cambio aplicado | Pendiente de regresión local |
| CP-33 | clientes: agrupa los pedidos por teléfono | Pendiente de regresión local |
| CP-34 | notificaciones: se generan con los cambios y se pueden marcar como leídas | Pendiente de regresión local |
| CP-35 | configuración: cambiar una regla modifica la decisión siguiente sin reiniciar | Pendiente de regresión local |
| CP-36 | configuración inválida → 400 y no se guarda | Pendiente de regresión local |
| CP-37 | configuración: agregar una etapa de producción ajusta los checklists | Pendiente de regresión local |
| CP-38 | configuración: el ajuste heredado de revisión de fotos no permite autoaplicar un diseño personalizado | Pendiente de regresión local |
| CP-39 | rutas: /api desconocida → 404 JSON; salud responde ok | Pendiente de regresión local |
| CP-40 | persistencia: los cambios sobreviven a un reinicio del servidor | Pendiente de regresión local |
| CP-41 | persistencia: la primera ejecución crea los archivos con los datos de demostración | Pendiente de regresión local |
| CP-42 | persistencia: un archivo dañado no tumba el programa y se conserva una copia | Pendiente de regresión local |
| CP-43 | persistencia: una configuración antigua sin la regla de fecha se completa sola | Pendiente de regresión local |
| CP-44 | mis pedidos: filtra por teléfono sin importar espacios ni el prefijo | Pendiente de regresión local |
| CP-45 | mis pedidos: teléfono inválido → 400 y no se filtra | Pendiente de regresión local |

## Recorrido de punta a punta (E2E)

| ID | Verificación | Resultado |
|---|---|---|
| E2E-1a | Pedido inexistente se informa de inmediato en el chat | Pendiente de regresión local |
| E2E-1b | El chat sigue pidiendo el número (permite corregirlo) | Pendiente de regresión local |
| E2E-1c | Pedido encontrado muestra sus datos | Pendiente de regresión local |
| E2E-1d | Cantidad no numérica se rechaza con mensaje | Pendiente de regresión local |
| E2E-1e | Cambio de cantidad del #154 aprobado automáticamente (20 → 25) | Pendiente de regresión local |
| E2E-1f | El detalle muestra 25 personas, el Motor de Validación y «Cambio viable» | Pendiente de regresión local |
| E2E-1g | El historial de versiones muestra la Versión 2 | Pendiente de regresión local |
| E2E-2a | Cambio de diseño del #155 rechazado por estar en producción | Pendiente de regresión local |
| E2E-2b | Aparece la alerta «Cambio requiere revisión – Pedido #155» | Pendiente de regresión local |
| E2E-2c | «Revisar solicitud» abre el panel de revisión manual | Pendiente de regresión local |
| E2E-2d | La decisión manual queda en «Decisiones recientes» | Pendiente de regresión local |
| E2E-2e | El historial muestra decisión automática, decisión manual y responsable | Pendiente de regresión local |
| E2E-3a | Resumen del pedido nuevo antes de confirmar | Pendiente de regresión local |
| E2E-3b | Pedido nuevo confirmado con el siguiente número (#157) | Pendiente de regresión local |
| E2E-3c | El pedido nuevo aparece en la plataforma | Pendiente de regresión local |
| E2E-4a | Marcar un paso actualiza el avance (#152: 1/7, 14 %) | Pendiente de regresión local |
| E2E-4b | El #152 pasa a «En producción» | Pendiente de regresión local |
| E2E-5a | Guardar la configuración confirma el cambio | Pendiente de regresión local |
| E2E-5b | Con la regla en Automático, el #153 (en producción) se aprueba sin revisión | Pendiente de regresión local |
| E2E-6a | «Mis pedidos» lista los pedidos del teléfono | Pendiente de regresión local |
| E2E-6b | El panel de notificaciones muestra eventos reales | Pendiente de regresión local |
| E2E-6c | «Marcar todas» deja el contador en 0 | Pendiente de regresión local |
| E2E-7 | Sin errores de JavaScript durante toda la sesión | Pendiente de regresión local |

## Revisión por pares

Según la Definition of Done, una tarea no se marca como `Hecho` hasta que otra persona del equipo la haya revisado. Estado actual: **pruebas implementadas y ejecutadas; revisión pendiente** (responsable de la revisión: Steven).


## Casos agregados para el incremento 2

Los escenarios siguientes se incorporaron al recorrido `e2e/recorrido.cjs`. Su estado se deja **pendiente de ejecución** hasta correrlos en un entorno con las dependencias instaladas; la comprobación sintáctica de JavaScript no equivale a una prueba funcional.

| ID | Escenario | Resultado esperado | Estado |
|---|---|---|---|
| E2E-8a | Escribir «quiero cambiar la fecha del pedido #154» desde el chat. | Reconoce la intención y muestra la pregunta para la nueva fecha del pedido #154. | Pendiente de ejecución |
| E2E-8b | Entrada libre durante el flujo de fecha. | Se muestra el control de fecha sin cambiar el diseño general del chat. | Pendiente de ejecución |
| E2E-8c | Escribir «quiero consultar el pedido #154». | Consulta el pedido por su identificador y muestra los datos almacenados. | Pendiente de ejecución |
| E2E-8d | Recargar la pestaña después de una conversación. | La transcripción reciente se conserva en la misma pestaña. | Pendiente de ejecución |
| E2E-8e | Escribir «no quiero confirmar» después del resumen de un pedido nuevo. | No se crea ni confirma ningún pedido. | Pendiente de ejecución |
| E2E-8f | Escribir «cambia la cantidad del pedido #154 a 30 personas». | La respuesta vuelve a consultar el servidor y muestra 30; GET devuelve cantidad 30. | Pendiente de ejecución |
| E2E-8g | Escribir «cambia la fecha del pedido #154 a ayer». | Se crea una revisión pendiente y la fecha guardada permanece igual. | Pendiente de ejecución |
| E2E-8h | Escribir un diseño fuera del catálogo para el pedido #154. | Se crea una revisión pendiente y el diseño actual no cambia antes de aprobar. | Pendiente de ejecución |
| E2E-9 | Revisar errores de JavaScript durante el recorrido. | No aparecen errores nuevos en la consola. | Pendiente de ejecución |

### Verificación del incremento 2

La revisión estática `node --check` se ejecutó sobre `public/chat.js`, `public/app.js`, `public/util.js` y `e2e/recorrido.cjs`. En este entorno no se pudo completar `npm run verify` porque faltan archivos de dependencias de TypeScript y tipos (`TS2688`); por tanto, la compilación de tipos, la suite de API y los escenarios E2E se deben volver a ejecutar localmente. Comandos recomendados:

```bash
npm install
npm run verify
```

Para E2E, además se requiere Playwright y Chromium instalados según las instrucciones iniciales de este documento.


## Casos API del segundo incremento añadidos en esta revisión

| ID | Escenario | Resultado esperado | Estado |
|---|---|---|---|
| CP-15b | Cambio a diseño fuera del catálogo con una descripción escrita y sin foto | Queda pendiente; el diseño actual no cambia antes de la aprobación. Tras aprobar, se aplica la descripción al pedido. | Pendiente de ejecución local |
| CP-15c | Crear un pedido con diseño personalizado descrito solo en texto | El pedido se guarda y queda `Pendiente de revisión`; la descripción aparece en la cola del encargado. | Pendiente de ejecución local |
| CP-17 | Solicitar una fecha de entrega pasada pero válida para un pedido existente | La solicitud queda `pendiente-revision` y el pedido conserva su fecha anterior. | Pendiente de ejecución local |
| CP-17b | Enviar una fecha no ISO/calendáricamente imposible o una hora inválida | La API devuelve 400 y no modifica los datos. | Pendiente de ejecución local |
| CP-17c | Configurar límite diario 2 y mover un pedido a un día que ya tiene dos pedidos activos | La solicitud queda pendiente y la fecha original no cambia. | Pendiente de ejecución local |
| CP-46 | Inicio opcional sin datos demo (`usarDatosDemo=false`) en una carpeta nueva | Se crea un pedido propio con ID `1` y su nombre permanece después de reiniciar. | Pendiente de ejecución local |

Estos casos están definidos en `test/api.test.ts` y `test/persistencia.test.ts`; no se declaran aprobados hasta que `npm run verify` se ejecute sin errores en el equipo del proyecto. La comprensión de lenguaje natural está basada en reglas deterministas: la prueba del servidor verifica decisiones y persistencia, mientras que la conversación de interfaz requiere además una prueba manual o E2E.

| E2E-10 | Panel de opciones debajo de la conversación | Las opciones rápidas quedan en un panel compacto, separado del área de escritura; «Volver al menú» queda en el mismo panel. | Pendiente de ejecución manual en navegador |
| E2E-11 | Cambio de pedido enviado a revisión; el encargado lo aprueba o rechaza desde *Cambios pendientes*. | Al crear la solicitud, el chat solo informa que está pendiente. Después de guardar la decisión manual, el chat muestra el resultado y los datos vigentes del pedido; si se rechaza, mantiene los datos anteriores. | Pendiente de ejecución manual en dos vistas del navegador |
| E2E-12 | Pedido nuevo con diseño personalizado se envía a revisión. | El chat no confirma ni cancela el pedido hasta la decisión del encargado. Tras aprobar o rechazar desde *Cambios pendientes*, aparece el aviso final en el chat. | Pendiente de ejecución manual en dos vistas del navegador |

Para E2E-11 y E2E-12, el chat web consulta periódicamente el estado persistido de la decisión; la conversación del cliente debe permanecer abierta en su pestaña o volver a abrirse tras la decisión. El comportamiento no representa todavía el envío saliente por WhatsApp real.
