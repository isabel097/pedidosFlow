# Evidencias para el cierre del incremento 2

Esta lista distingue las evidencias documentadas de aquellas que requieren capturas y resultados reales. No sustituir una ejecución real por una imagen recreada.

## Figuras 3–8 del informe

1. **Figura 3 — Menú del chat:** conversación, menú compacto debajo de los mensajes y campo de escritura independiente.
2. **Figura 4 — Modificación real:** solicitud escrita con palabras propias y valor actualizado que devuelve la consulta/panel.
3. **Figura 5 — Revisión humana:** solicitud en Cambios pendientes y mensaje final en chat después de guardar aprobación o rechazo.
4. **Figura 6 — Persistencia:** ruta de datos impresa en consola y mismo valor tras reiniciar servidor.
5. **Figura 7 — GitHub:** rama de código, PR de implementación, revisión real y checks.
6. **Figura 8 — Verificación:** salida de `npm run verify` y, si se ejecuta, recorrido E2E.

## Comandos y carpeta correcta

Ejecutar en la raíz del paquete funcional donde están `src/index.ts`, `package.json` con nombre `pedidosflow` e `INICIAR_PEDIDOSFLOW.bat`. Si `npm run` muestra `figma-make-app@1.0.0` o `Missing script: verify`, se está usando el `package.json` del prototipo visual o una carpeta exterior.

```powershell
npm ci
npm run verify
npm start
```

## Comprobaciones locales

- [ ] Carga de cinco pedidos de demostración sin duplicados.
- [ ] Cambio automático y persistencia después de reiniciar.
- [ ] Solicitud de diseño personalizado pendiente; el pedido no cambia antes de aprobar.
- [ ] Aprobación y mensaje final al cliente después de guardar la decisión.
- [ ] Rechazo y comprobación de que se conservan los valores anteriores.
- [ ] Fecha pasada y capacidad diaria agotada derivan a revisión.
- [ ] Guardar salida de `npm run verify` y la salida del recorrido E2E, si se ejecuta.
- [ ] Capturar y pegar las figuras en los marcadores del Word.

## GitHub y revisión colaborativa

- PR documental #24: https://github.com/isabel097/pedidosFlow/pull/24. Está abierto y no fusionado; incluye documentación, no el servidor del ZIP.
- Issue #25: https://github.com/isabel097/pedidosFlow/issues/25. Sincronizar código funcional en el repositorio.
- Issue #26: https://github.com/isabel097/pedidosFlow/issues/26. Regresión y capturas.
- Issue #27: https://github.com/isabel097/pedidosFlow/issues/27. Validación de reglas en un negocio real.

El equipo informa que Steven revisó localmente el proyecto y lo consideró satisfactorio. Para que la rúbrica lo pueda verificar, registrar una revisión real en GitHub sobre el código exacto publicado. No marcar el PR de código como aprobado antes de que se produzca esa revisión.
