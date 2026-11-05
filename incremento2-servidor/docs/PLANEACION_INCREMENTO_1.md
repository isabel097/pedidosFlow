# Planeación del primer incremento funcional

## 1. Síntesis del punto de partida

El problema seleccionado es la pérdida de claridad sobre la versión vigente de un pedido personalizado cuando el cliente solicita cambios después de confirmarlo.

El actor principal es el encargado del negocio, responsable de verificar si una solicitud de cambio todavía es viable dentro del estado de producción.

La necesidad seleccionada para el incremento es automatizar la decisión sobre cambios de cantidad según la etapa de producción. La decisión debe conservar trazabilidad y mostrar el motivo aplicado.

## 2. Objetivo de la iteración

Al finalizar la iteración, el encargado podrá solicitar un cambio de cantidad sobre un pedido existente y el sistema determinará si puede aplicarse según la etapa de producción, actualizará o rechazará la solicitud y registrará el resultado.

## 3. Incremento seleccionado

El flujo es: identificar pedido -> validar cantidad -> consultar etapa -> aplicar regla -> aprobar, dejar para revisión o rechazar -> persistir resultado -> registrar historial.

El caso de demostración principal utiliza el pedido #154, manteniendo el escenario definido en la planeación inicial.

### Alcance

- Cambio de cantidad.
- Validación del pedido.
- Evaluación por etapa.
- Persistencia del cambio.
- Registro de historial.
- Manejo controlado de pedido inexistente.

### Fuera de alcance

- Integración real con WhatsApp Business.
- Autenticación del encargado.
- Categorías diferentes a torta personalizada.

## 4. Historia de usuario y aceptación

**Historia:** Como encargado del negocio, quiero que el sistema evalúe automáticamente una solicitud de cambio de cantidad sobre un pedido, para reducir revisiones manuales de cambios simples y conservar la trazabilidad del resultado.

### Casos

| Caso | Dado | Cuando | Entonces |
|---|---|---|---|
| Principal | Pedido válido en una etapa que permite modificación | Se solicita una cantidad positiva | Se aplica el cambio y se registra |
| Alternativo | Pedido en una etapa que no permite modificación | Se solicita un cambio | Se rechaza y se muestra el motivo |
| Error | El pedido no existe | Se consulta o modifica | Se informa el error y se permite corregir el identificador |

## 5. Diseño técnico

La solución debe separar interfaz, servidor, motor de reglas y persistencia. La interfaz presenta el flujo; el servidor coordina las operaciones; el motor aplica las reglas; la persistencia conserva pedidos y cambios.

### Decisiones técnicas

1. Separar las reglas de negocio de la interfaz para facilitar pruebas y cambios.
2. Mantener persistencia local mientras el alcance académico no requiera una base de datos externa.
3. Conservar un pedido de demostración estable para repetir pruebas y mantener evidencia trazable.

## 6. Backlog de la iteración

| Elemento | Prioridad | Estimación | Dependencia | Responsable | Estado |
|---|---|---|---|---|---|
| Validar formato de cantidad | Alta | S | Ninguna | Isabel | Hecho |
| Evaluar regla según etapa | Alta | S | Validación | Isabel | Hecho |
| Persistir cambio | Alta | S | Regla | Isabel | Hecho |
| Manejar pedido no encontrado | Media | S | Ninguna | Isabel | Hecho |
| Pruebas del incremento | Alta | M | Funcionalidades | Steven | Por revisar |
| Documentación | Media | S | Estructura | Steven | Por revisar |

### Trabajo posterior

El backlog general incluye el registro de pedidos nuevos, integración completa de la interfaz con persistencia real, dashboard y notificaciones con datos reales. Estas tareas no se consideran terminadas por aparecer en el prototipo.

## 7. Capacidad

Equipo: Steven Suaza Montiel e Isabel Cristina Duque Cano.

Disponibilidad estimada: 20 horas brutas durante dos semanas. Se reserva 25 % para integración, revisión e imprevistos, dejando 15 horas efectivas de trabajo planificable.

## 8. Flujo colaborativo

La rama estable es `main`. Las ramas de trabajo utilizan:

```text
feature/<tarea-corta>
fix/<tarea-corta>
test/<tarea-corta>
docs/<tarea-corta>
```

Los cambios importantes deben llegar a `main` mediante Pull Request y revisión.

## 9. Calidad y Definition of Done

La validación debe cubrir el caso principal, el caso alternativo y el caso de error. También debe verificarse instalación, ejecución, persistencia y manejo de entradas inválidas.

### Definition of Done

- Cumple criterios de aceptación.
- El cambio fue revisado.
- La aplicación instala y ejecuta.
- Las pruebas definidas fueron ejecutadas.
- La evidencia está disponible.
- El tablero refleja el estado real.
- La documentación coincide con la implementación.

## 10. Evidencia

Repositorio: https://github.com/isabel097/pedidosFlow

La evidencia de entrega debe mostrar el código, issues, tablero, ramas, commits y Pull Requests. No se debe declarar una tarea como `Hecho` hasta que haya sido implementada, probada y revisada.
