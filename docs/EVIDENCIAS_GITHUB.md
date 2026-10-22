# Evidencias de trabajo colaborativo — Incremento 2

Repositorio: https://github.com/isabel097/pedidosFlow  
Tablero: https://github.com/users/isabel097/projects/1

## Estado real a 22 de octubre de 2026

La rama `feature/incremento-2-chat-persistencia` contiene documentación actualizada. El PR #24 (https://github.com/isabel097/pedidosFlow/pull/24) está abierto y es documental: no contiene el servidor Express/TypeScript del ZIP funcional. La rama `main` aún tiene el prototipo Vite/React de Figma Make.

El equipo informa que Steven revisó el proyecto local y lo encontró satisfactorio. Esta revisión informal se debe reflejar como información del equipo, pero para cumplir la rúbrica debe registrarse una revisión de GitHub sobre el PR que contenga el código exacto de la versión entregada.

## Acciones registradas

- **Issue #25 — Sincronizar el código ejecutable:** https://github.com/isabel097/pedidosFlow/issues/25
- **Issue #26 — Ejecutar regresión y adjuntar evidencias:** https://github.com/isabel097/pedidosFlow/issues/26
- **Issue #27 — Contrastar reglas con una pastelería real:** https://github.com/isabel097/pedidosFlow/issues/27

## Pasos para completar la trazabilidad

1. Copiar el código funcional exacto del ZIP a una rama de implementación (por ejemplo, `feature/servidor-incremento-2`) manteniendo `prototipo-figma/` como prototipo separado.
2. Verificar que el `package.json` de la raíz es `pedidosflow@1.0.0` y que existen `src/index.ts`, `public/`, tests y el iniciador `.bat`.
3. Ejecutar `npm ci`, `npm run verify` y las pruebas E2E disponibles; registrar salida real.
4. Abrir un PR hacia `main`, vincular las historias/Issues, incluir instrucciones, resultados y limitaciones.
5. Solicitar al otro integrante que revise el código, registre la revisión y comente los cambios.
6. Corregir observaciones, repetir pruebas y hacer merge únicamente después de la aprobación y los checks.
7. Actualizar el tablero y capturar rama, commits, PR, revisión, checks y merge.

## Evidencias que deben conservarse

- Commits descriptivos y atribuibles a las contribuciones reales.
- Issues con criterios, estimaciones, responsables y estados verídicos.
- PR del código con revisión cruzada registrada.
- Checks de GitHub y salida local de verificación.
- Merge a `main` después de la revisión.
- Capturas reales de la aplicación y de la verificación para el informe.

Los ejemplos de nombres de ramas y mensajes de commit son pautas, no pruebas de que esa actividad ya haya ocurrido. No se debe declarar terminada una integración o revisión que no aparezca en GitHub.
