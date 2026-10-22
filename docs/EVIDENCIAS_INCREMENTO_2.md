# Evidencias para el cierre del incremento 2

Esta lista distingue las evidencias documentadas de las que requieren capturas y resultados reales. No sustituir una ejecución real por una imagen recreada.

## Evidencia visual para el informe PDF

1. **Figura 3 — Menú del chat:** capturar la conversación, el menú compacto debajo de los mensajes y el campo de escritura independiente.
2. **Figura 4 — Modificación real:** escribir una solicitud con palabras propias y mostrar el valor efectivamente actualizado en la consulta posterior o en el panel.
3. **Figura 5 — Revisión humana:** mostrar la solicitud en Cambios pendientes y, después de guardar la decisión, el mensaje final de aprobación o rechazo en el chat.
4. **Figura 6 — Persistencia:** capturar la ruta de datos impresa en consola y comprobar que el mismo pedido conserva su cambio después de reiniciar el servidor.
5. **Figura 7 — GitHub:** capturar la rama del incremento, el pull request, los comentarios/revisión real y el estado del chequeo.
6. **Figura 8 — Verificación:** capturar el resultado real de `npm run verify` y, si se ejecuta, del recorrido E2E.

## Verificación en el computador del equipo

- [ ] Desde la raíz del proyecto, ejecutar `npm ci`.
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
- [ ] La otra persona del equipo revisa el pull request y registra su revisión.
- [ ] Fusionar solo después de la revisión y de que las verificaciones acordadas pasan.
- [ ] Actualizar el tablero con estados que coincidan con lo efectivamente terminado.

## Estado inicial de esta lista

El repositorio contiene ramas y pull requests de incrementos anteriores. La rama `feature/incremento-2-chat-persistencia` fue creada para preparar los cambios de documentación de esta entrega. No afirmar que la revisión cruzada ni el merge del incremento 2 están terminados hasta que GitHub los muestre y la rama incluya el código exacto que se evaluará.
