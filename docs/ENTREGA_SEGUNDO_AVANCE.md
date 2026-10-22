# Checklist de cierre — Segundo avance de PedidosFlow

Este checklist cruza la guía docente con los artefactos preparados. “Preparado” significa que el contenido está redactado; las evidencias que requieren ejecución real no se consideran completadas hasta disponer del resultado.

| Requisito | Contenido preparado | Estado real / trabajo restante |
|---|---|---|
| 1. Actualización del primer avance | Problema, justificación, objetivos, marco teórico, propuesta, metodología y roles | Preparado. Se incorporó retroalimentación docente sobre evidencia empresarial y APA 7. |
| 2. Product Backlog | IDs, historias, prioridad, criterios, estimación, estado y responsables | Preparado. |
| 3. Planeación | Objetivo, historias, tareas, distribución de horas y riesgos | Preparado; roles y disponibilidad se confirmaron por el equipo. |
| 4. Prototipo actualizado | Flujo conversacional, navegación, pantallas y respuestas | Descrito. Capturas auténticas se deben insertar como Figuras 3–8. |
| 5. Diseño técnico mínimo | Arquitectura, API, persistencia JSON, componentes y decisiones | Preparado. La raíz de main todavía no refleja el servidor del ZIP. |
| 6. Incremento ejecutable | ZIP con servidor, interfaz, persistencia y cinco pedidos de demostración | Se confirmó que el paquete funcional define `verify`; el intento de `npm ci` se bloqueó con `EPERM` al retirar `esbuild.exe`, así que debe completarse una instalación limpia antes de la regresión. |
| 7. Trabajo colaborativo | Historial anterior, rama documental y PR #24, issues #25–#27 | Preparación documental hecha. Falta sincronizar el servidor a GitHub, revisión formal del PR de código y merge. La revisión local del compañero fue reportada por el equipo, pero no sustituye el registro formal en GitHub. |
| 8. Pruebas y calidad | Casos, errores, aceptación, DoD y limitaciones | Salida real de npm run verify y recorrido E2E por adjuntar. El intento más reciente se ejecutó desde la raíz funcional: `npm run` sí mostró `verify`, pero `npm ci` falló con `EPERM` y dejó incompletas las dependencias; repetir la regresión tras reinstalarlas. |
| APA 7 y fuente 11 | Word y PDF actualizados, referencias ampliadas, preguntas para validación primaria | Marcadores de Figuras 3–8 deben reemplazarse por capturas. La siguiente iteración profundizará el contraste operativo con una pastelería local. |
| Repositorio | https://github.com/isabel097/pedidosFlow | main contiene el prototipo Vite/React; sincronizar el servidor del ZIP mediante issue #25 antes de afirmar que el repo reproduce la versión actual. |
| Demostración 5 min | Guion en el informe | Preparado; ensayar y registrar la demostración real. |

## Ejecutar el paquete correcto

En Windows, extraer el ZIP funcional y ejecutar `INICIAR_PEDIDOSFLOW.bat` desde la raíz que contiene `src/index.ts` y el `package.json` de `pedidosflow`. Alternativamente:

```powershell
npm ci
npm run verify
npm start
```

En esa carpeta, `npm run` debe mostrar el paquete `pedidosflow@1.0.0` y los scripts `start`, `test`, `typecheck` y `verify`. Si muestra `figma-make-app@1.0.0` o “Missing script: verify”, se está usando el prototipo visual o la carpeta exterior incorrecta. Abrir http://localhost:3001.

## Tareas reales de cierre

- PR documental #24: https://github.com/isabel097/pedidosFlow/pull/24 (abierto; no contiene el servidor ejecutable).
- Issue #25: https://github.com/isabel097/pedidosFlow/issues/25 — sincronizar el código ejecutable.
- Issue #26: https://github.com/isabel097/pedidosFlow/issues/26 — regresión y evidencias.
- Issue #27: https://github.com/isabel097/pedidosFlow/issues/27 — validar reglas con un negocio real de tortas.

No marcar un requisito como verificado por la sola existencia de código. Las pruebas, la revisión, la integración y las capturas deben corresponder a la versión exacta que se entrega.
