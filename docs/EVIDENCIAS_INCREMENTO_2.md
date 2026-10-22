# Evidencias para el cierre del incremento 2

Esta lista distingue las evidencias documentadas de las que requieren capturas y resultados reales. No sustituir una ejecución real por una imagen recreada.

## Evidencia visual para el informe PDF

1. **Figura 3 — Menú del chat:** capturar la conversación, el menú compacto debajo de los mensajes y el campo de escritura independiente.
2. **Figura 4 — Modificación real:** escribir una solicitud con palabras propias y mostrar el valor efectivamente actualizado en la consulta posterior o en el panel.
3. **Figura 5 — Revisión humana:** mostrar la solicitud en Cambios pendientes y, después de guardar la decisión, el mensaje final de aprobación o rechazo en el chat.
4. **Figura 6 — Persistencia:** capturar la ruta de datos impresa en consola y comprobar que el mismo pedido conserva su cambio después de reiniciar el servidor.
5. **Figura 7 — GitHub:** capturar la rama que contiene el código ejecutable, el pull request del código, la revisión real y el resultado de los checks.
6. **Figura 8 — Verificación:** capturar el resultado real de `npm run verify` y, si se ejecuta, del recorrido E2E.

## Ejecutar desde la carpeta correcta

El ZIP tiene un directorio principal llamado `PedidosFlow-incremento2`. Si PowerShell está en la carpeta exterior donde se descomprimió `PedidosFlow-incremento2-documentacion-actualizada`, entra primero en la carpeta interior:

```powershell
cd .\PedidosFlow-incremento2
npm run
```

El paquete correcto debe identificarse como `pedidosflow@1.0.0` y mostrar `verify`, `test`, `typecheck` y `start`. Si aparece `figma-make-app@1.0.0` o `Missing script: verify`, se está ejecutando desde el prototipo visual o desde una carpeta distinta a la raíz del servidor. El modo más sencillo es ejecutar `INICIAR_PEDIDOSFLOW.bat` situado junto a `src\index.ts` y el `package.json` funcional.

## Verificación en el computador del equipo

- [ ] Desde la raíz funcional, ejecutar `npm ci`.
- [ ] Ejecutar `npm run verify` y guardar la salida completa.
- [ ] Abrir la aplicación y comprobar que carga cinco pedidos de demostración.
- [ ] Modificar un pedido; reiniciar el servidor y comprobar que el cambio permanece.
- [ ] Solicitar un cambio de diseño personalizado y comprobar que no se aplica antes de la aprobación.
- [ ] Aprobar un pendiente; confirmar el mensaje final en el chat después de guardar.
- [ ] Rechazar otro pendiente; comprobar que el pedido conserva los valores anteriores y que el chat informa el rechazo.
- [ ] Probar una fecha pasada y una fecha que exceda la capacidad configurada.
- [ ] Capturar las pantallas y pegar cada captura en el marcador con el número de figura correspondiente del informe.

## Evidencias de colaboración

- [ ] Comprobar que la rama y sus commits corresponden a la versión real del código que se entrega.
- [ ] Confirmar que los autores de los commits reflejan la contribución real de cada integrante.
- [ ] El equipo informa que el compañero revisó localmente el proyecto y lo encontró satisfactorio; registrar también una revisión formal en GitHub sobre el código exacto para que la rúbrica la pueda verificar.
- [ ] Fusionar solo después de la revisión y de que las verificaciones acordadas pasan.
- [ ] Actualizar el tablero con estados que coincidan con lo efectivamente terminado.

## Estado en GitHub (22 de octubre de 2026)

- PR documental #24: https://github.com/isabel097/pedidosFlow/pull/24. Está abierto y no se ha fusionado; documenta el alcance, no sincroniza todavía el servidor funcional del ZIP.
- Issue #25: sincronizar el código ejecutable del incremento 2.
- Issue #26: ejecutar regresión y adjuntar evidencias.
- Issue #27: contrastar las reglas con una pastelería real.
- Rama `feature/incremento-2-chat-persistencia`: creada para la documentación; no se debe presentar como rama del servidor completo hasta que el código ejecutable se publique ahí.

## Estado inicial de esta lista

La rama `feature/incremento-2-chat-persistencia` contiene cambios documentales. No afirmar que la revisión formal del código ni el merge del incremento 2 están terminados hasta que GitHub lo muestre y la rama incluya el código exacto que se evaluará.