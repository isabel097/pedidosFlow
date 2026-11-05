# Checklist de cierre — Segundo avance de PedidosFlow

Este archivo cruza los ocho requisitos de la guía docente con los artefactos preparados. Un estado “preparado” indica que el contenido está redactado; las evidencias que requieren ejecución real se mantienen separadas y no se presentan como completadas.

| Requisito de la guía | Contenido ya preparado | Estado verificable / lo que queda |
|---|---|---|
| 1. Actualización del primer avance | Secciones 1.1–1.7 del informe; decisiones frente al alcance anterior; respuesta a la retroalimentación docente | Preparado. El informe incorpora evidencia publicada de negocios reales y orienta el ajuste de reglas al contexto de una pastelería local. |
| 2. Product Backlog actualizado | Tablas con IDs, historias, prioridad, criterios, estimación, estado y responsables | Preparado. Revisar solo si el equipo descubre diferencias con el trabajo realmente realizado. |
| 3. Planeación de la iteración | Objetivo, historias seleccionadas, tareas, horas, riesgos y dependencias | Preparado; la distribución de horas fue confirmada por el equipo. |
| 4. Prototipo actualizado | Flujo, pantallas, navegación, datos y respuestas esperadas | Descrito. Insertar las capturas reales indicadas en Figuras 3–8. |
| 5. Diseño técnico mínimo | Diagramas de arquitectura y flujo de datos, API, JSON y decisiones técnicas | Preparado. La rama `main` de GitHub todavía debe alinearse con el código ejecutable del ZIP. |
| 6. Incremento funcional | Servidor, interfaces, persistencia, reglas, pedidos demo y `.bat` incluidos en este paquete | Se comprobó que el paquete funcional define `verify`; el último `npm ci` se bloqueó con `EPERM` al retirar `esbuild.exe`, por lo que debe completarse una instalación limpia antes de la regresión. |
| 7. Trabajo colaborativo | Historial previo, PR documental #24, issues #25–#27 y guía de colaboración | Preparación documental hecha. El servidor funcional aún debe publicarse en una rama, someterse a revisión formal y fusionarse después de los checks. La revisión local del compañero fue reportada por el equipo, pero no sustituye el registro en GitHub. |
| 8. Pruebas y calidad | Casos de prueba, errores corregidos, criterios de aceptación, Definition of Done y limitaciones | Ejecutar `npm run verify` y pruebas manuales/E2E. El intento más reciente se ejecutó desde la raíz funcional: `npm run` sí mostró `verify`, pero `npm ci` falló con `EPERM` y dejó incompletas las dependencias; repetir la regresión tras reinstalarlas. |
| APA 7, Arial 11 | Word editable y PDF con referencias ampliadas y formato académico | Preparado. Reemplazar los marcadores de las Figuras 3–8 por capturas auténticas antes del envío. La documentación registra la comprobación inicial de scripts y el bloqueo EPERM durante la instalación; la regresión integral aún debe concluirse. |
| Enlace al repositorio | https://github.com/isabel097/pedidosFlow | La rama `main` mantiene el prototipo Vite/React; el código Express/TypeScript de este paquete debe sincronizarse mediante la tarea #25 antes de afirmar que el repositorio reproduce el ZIP. |
| Demostración de máximo 5 min | Guion en la sección 6.4 del informe | Guion listo. El equipo debe ensayar y hacer la demostración presencial o grabar el video. |

## Comandos correctos para el paquete ejecutable

Extrae el ZIP y ejecuta los comandos en la carpeta que contiene el `package.json` funcional, `src/index.ts` e `INICIAR_PEDIDOSFLOW.bat`. En esta carpeta `npm run` debe mostrar `pedidosflow@1.0.0`, con scripts `start`, `test`, `typecheck` y `verify`.

```powershell
npm ci
npm run verify
npm start
```

Abre http://localhost:3001. También se puede iniciar con doble clic en `INICIAR_PEDIDOSFLOW.bat`. No usar el `package.json` de `prototipo-figma`, que identifica la app como `figma-make-app` y no contiene el script `verify`.

## Tareas reales registradas en GitHub

- PR documental #24: https://github.com/isabel097/pedidosFlow/pull/24 (abierto, no fusionado; no contiene el servidor funcional).
- Issue #25 — sincronizar el código ejecutable: https://github.com/isabel097/pedidosFlow/issues/25.
- Issue #26 — ejecutar regresión y adjuntar evidencias: https://github.com/isabel097/pedidosFlow/issues/26.
- Issue #27 — validar las reglas con un negocio real de tortas: https://github.com/isabel097/pedidosFlow/issues/27.

## Evidencias que deben pegarse en el informe

Consultar `docs/EVIDENCIAS_INCREMENTO_2.md`. Los marcadores deben sustituirse por capturas reales; no dejar las indicaciones de captura en la copia final entregada si ya se obtuvieron las evidencias.
