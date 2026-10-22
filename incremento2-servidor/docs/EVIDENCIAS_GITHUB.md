# Evidencias de trabajo colaborativo — Incremento 2

La guía docente solicita evidencias de participación, ramas, commits descriptivos, issues/tareas, pull requests con revisión e integración en la rama principal. Esta guía separa las actividades que ya existen en GitHub de las que aún no se han completado. Las plantillas y los ejemplos no sustituyen actividad real.

- Repositorio: https://github.com/isabel097/pedidosFlow
- Tablero: https://github.com/users/isabel097/projects/1
- PR documental #24: https://github.com/isabel097/pedidosFlow/pull/24 (abierto, no fusionado; solo documentación).
- Issue #25: https://github.com/isabel097/pedidosFlow/issues/25 (sincronizar el servidor ejecutable del ZIP).
- Issue #26: https://github.com/isabel097/pedidosFlow/issues/26 (regresión y capturas reales).
- Issue #27: https://github.com/isabel097/pedidosFlow/issues/27 (validación primaria con un negocio real de tortas).

## Estado comprobado al 22 de octubre de 2026

La rama `feature/incremento-2-chat-persistencia` se creó para preparar documentación. Contiene el README actualizado y archivos Markdown de cierre/justificación/evidencias, pero **todavía no contiene todo el servidor Express/TypeScript del ZIP funcional**. La raíz de `main` corresponde al prototipo Vite/React de Figma Make. No se debe describir el PR #24 como la integración del código ejecutable.

El equipo informa que Steven revisó localmente el proyecto y lo encontró satisfactorio. Para que este requisito sea verificable en el repositorio, se debe registrar una revisión formal sobre un pull request que contenga el código exacto que se va a entregar. La revisión del PR documental no reemplaza una revisión del código funcional.

## 1. Sincronizar el código ejecutable

Desde una copia de trabajo del repositorio, crear una rama de implementación distinta a la rama documental, por ejemplo:

```bash
git checkout main
git pull
git checkout -b feature/servidor-incremento-2
```

Copiar a la raíz de esa rama los archivos de la versión funcional del ZIP, manteniendo `prototipo-figma/` como referencia separada. Deben coexistir el `package.json` del servidor, `src/index.ts`, `public/`, las pruebas, `INICIAR_PEDIDOSFLOW.bat` y la documentación. Verificar que `npm run` muestre `pedidosflow@1.0.0`, no `figma-make-app@1.0.0`.

Antes de subir los archivos, comprobar el estado de Git para no borrar cambios del equipo ni versionar `node_modules`, carpetas `data/`, logs o archivos de entorno. Los datos de demostración se crean al ejecutar el sistema y no son clientes reales.

## 2. Issues, commits y tablero

Los issues #25–#27 documentan tres tareas reales de cierre. Para el resto del trabajo se pueden crear issues vinculados a las historias PF2-01–PF2-14 y registrar prioridad, responsable, criterios de aceptación, pruebas y estado. Mensajes de commit como `fix: estabiliza la ruta de datos (PF2-01)` son ejemplos, no evidencia de commits ya realizados.

Mover una tarjeta a `Haciendo` cuando se comienza, a `Por revisar` cuando el trabajo está listo para revisión y a `Hecho` después de ejecutar las pruebas acordadas, obtener revisión e integrar el cambio.

## 3. Pull request y revisión cruzada

1. Abrir un PR desde la rama del servidor funcional hacia `main`.
2. Indicar las historias que cubre, cómo se instala, comandos ejecutados, resultados reales, capturas y limitaciones.
3. Solicitar a la otra persona del equipo que revise el código exacto. Atender comentarios y guardar su revisión en GitHub.
4. Hacer merge después de la aprobación y de que los checks acordados pasen.
5. Actualizar el tablero y agregar las capturas de PR, revisión, checks y merge al informe.

## 4. Evidencias que deben quedar visibles

- Commits atribuibles a los integrantes reales y relacionados con historias.
- Rama que contiene el servidor y la interfaz actuales.
- Issues con criterios de aceptación, responsables y estado fiel al trabajo.
- PR de implementación con revisión registrada por el otro integrante.
- Resultado de checks automáticos y de la regresión local.
- Merge visible en `main` y tablero actualizado.
- Capturas de la app y de `npm run verify` para las Figuras 3–8 del informe.

**Regla de integridad académica:** no marcar como terminado un PR, una revisión, una prueba o un merge antes de que exista la evidencia correspondiente en el repositorio.
