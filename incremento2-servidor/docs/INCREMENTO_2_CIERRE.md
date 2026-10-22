# Incremento 2 — PedidosFlow

**Equipo:** Gemas de Cristal  
**Integrantes:** Steven Suaza Montiel e Isabel Cristina Duque Cano  
**Proyecto:** gestión de pedidos de tortas personalizadas  
**Fecha:** 22 de octubre de 2026

## Objetivo

Fortalecer el flujo vertical del primer incremento sin sustituir el diseño aprobado: permitir solicitudes escritas con palabras propias, validar reglas de cantidad/fecha/diseño, persistir los cambios y derivar a revisión humana aquello que necesita criterio.

## Funciones incluidas en este paquete

- Servidor Express con lógica TypeScript y almacenamiento local en archivos JSON.
- Chat web estilo WhatsApp que admite botones de opción rápida y texto libre para intenciones conocidas; cuando falta información, pide aclaración.
- Menú compacto debajo de la conversación y área de escritura separada.
- Modificación de pedidos y consulta posterior al servidor para mostrar el estado guardado.
- Cinco pedidos de demostración (#152–#156) cargados en una carpeta de datos nueva o con lista de pedidos vacía; no se duplican ni se reinician las modificaciones en ejecuciones posteriores.
- Revisión humana para fecha pasada, fecha que alcanza la capacidad diaria configurada y diseños personalizados fuera del catálogo.
- El chat informa el estado pendiente; el mensaje final de aprobación o rechazo aparece después de que el encargado guarda su decisión.
- Plataforma para consultar pedidos, producción, clientes, cambios pendientes, historial y configuración.

## Reglas de decisión

| Caso | Tratamiento |
|---|---|
| Cambio permitido por la regla vigente de la etapa | Se aplica y se registra. |
| Fecha pasada | Revisión humana; la fecha original se conserva mientras espera decisión. |
| Capacidad diaria alcanzada | Revisión humana; no se cambia la fecha antes de la decisión. |
| Diseño personalizado fuera del catálogo | Revisión humana; no se aplica sin aprobación. |
| Pedido inexistente, entrada inválida o frase ambigua | Error controlado o pregunta aclaratoria. |

La capacidad inicial diaria está configurada como un dato modificable. Debe contrastarse con una pastelería real antes de tratarse como política comercial validada.

## Instalación y ejecución

Requisito: Node.js 20 o superior y npm. Desde esta carpeta funcional, ejecutar `INICIAR_PEDIDOSFLOW.bat` o:

```powershell
npm ci
npm run verify
npm start
```

Abrir http://localhost:3001 y mantener abierta la terminal. Si `npm run` muestra `figma-make-app@1.0.0` o falta `verify`, se está en la carpeta del prototipo visual o en la carpeta exterior equivocada. Usar la carpeta donde coexisten `src/index.ts`, el `package.json` de `pedidosflow` y el iniciador `.bat`.

## Verificación y límites

`npm run` se ejecutó desde la raíz funcional y mostró el script `verify`. En el intento posterior, `npm ci` falló con `EPERM` al intentar retirar `esbuild.exe`; la instalación quedó incompleta y los comandos `npm run verify` y `npm start` no pudieron completarse porque faltaban `express` y `tsx`. La comprobación está registrada, pero la regresión no se declara aprobada. Cerrar los procesos Node, eliminar `node_modules`, reinstalar con `npm ci` y guardar la salida real de `npm run verify`.

El chat sigue siendo una simulación web; no está conectado a WhatsApp Business Platform. El reconocimiento de texto cubre patrones definidos, no cualquier frase. La persistencia es local, no una base compartida para un despliegue multiusuario. Las reglas de capacidad deben validarse con una pastelería. Issues #25, #26 y #27 registran sincronización del código, pruebas/evidencias y consulta de campo.

## Diferencia frente al incremento 1

El incremento 1 se centró en el flujo vertical de cambio de cantidad: validar el pedido y la etapa, decidir, persistir y consultar. El incremento 2 extiende la conversación, el tratamiento de fechas/diseños que requieren revisión, la persistencia de pedidos diversos, el menú y los mensajes posteriores a la decisión humana. No declara terminadas las funciones futuras de WhatsApp real, autenticación o analítica.
