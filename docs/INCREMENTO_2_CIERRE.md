# Incremento 2 — PedidosFlow

**Equipo:** Gemas de Cristal  
**Integrantes:** Steven Suaza Montiel e Isabel Cristina Duque Cano  
**Proyecto:** gestión de pedidos de tortas personalizadas  
**Fecha de actualización:** 22 de octubre de 2026

## Objetivo

Fortalecer el flujo vertical del primer incremento sin reemplazar el diseño aprobado: persistir pedidos y cambios, aceptar solicitudes redactadas con palabras propias, aplicar reglas de negocio y derivar a revisión humana los casos que requieren criterio.

## Alcance funcional incluido en el paquete entregado

- Resolución de la carpeta de datos independiente de la carpeta desde la que se inicia el proceso.
- Persistencia local en JSON para pedidos, cambios, notificaciones y configuración.
- Escritura JSON reforzada mediante archivo temporal y reemplazo posterior.
- Carga de cinco pedidos de demostración (#152–#156) y una solicitud pendiente cuando la carpeta es nueva o el archivo de pedidos está vacío. La carga no debe duplicar pedidos ni restablecer cambios al reiniciar.
- Chat web simulado que permite utilizar texto libre además de opciones rápidas, reconoce intenciones comunes y pide el dato que falte en vez de asumirlo.
- Validaciones para cantidad, fecha, etapa de producción y capacidad diaria configurada.
- Derivación a revisión humana de fechas pasadas, fechas cuya capacidad diaria está alcanzada y diseños personalizados fuera del catálogo.
- El chat informa que la solicitud está pendiente; el aviso final de aprobación o rechazo aparece solo después de que el encargado guarda la decisión.
- Menú compacto debajo de los mensajes y campo de escritura separado visualmente.
- El panel administrativo permite consultar pedidos, producción, cambios pendientes, clientes, historial y configuración.

## Reglas de decisión

| Solicitud | Tratamiento |
|---|---|
| Cambio válido permitido por la regla de la etapa | Aplicar automáticamente y guardar el resultado |
| Fecha pasada | Enviar a revisión humana; conservar la fecha original hasta la decisión |
| Fecha en un día que alcanzó la capacidad configurada | Enviar a revisión humana; conservar la fecha original hasta la decisión |
| Diseño personalizado que necesita criterio humano | Enviar a revisión; no modificar el pedido hasta aprobar |
| Pedido inexistente, dato inválido o intención ambigua | Informar el error controlado o preguntar el dato que falta |

El límite inicial de capacidad diaria es configurable. Debe validarse con el negocio antes de usarlo como regla operativa real.

## Instalación y ejecución

Requisitos: Node.js 20 o superior y npm.

En Windows, ejecuta `INICIAR_PEDIDOSFLOW.bat` desde la carpeta donde están `src\index.ts` y el `package.json` del servidor. Si estás en la carpeta exterior donde se descomprimió `PedidosFlow-incremento2-documentacion-actualizada`, entra primero en el directorio interior `PedidosFlow-incremento2`. El `npm run` correcto debe indicar `pedidosflow@1.0.0`; si indica `figma-make-app@1.0.0` o falta el script `verify`, estás en la carpeta del prototipo visual y no en la raíz del servidor.

Alternativamente, desde la raíz funcional:

```powershell
npm ci
npm run verify
npm start
```

La interfaz se abre en http://localhost:3001. No cerrar la terminal mientras se usa la aplicación.

## Evidencia de la justificación

El informe cita un estudio colombiano sobre diez emprendimientos, un estudio de entrevistas a doce micro y pequeñas empresas comerciales y un caso publicado de panadería para contextualizar necesidades reales de comunicación y organización de pedidos. Consultar `docs/JUSTIFICACION_EVIDENCIA_DOCUMENTAL.md`. Son fuentes secundarias: no sustituyen la validación de las reglas con una pastelería local. Esa validación está registrada en issue #27.

## Verificación

La presencia de una función en el paquete no demuestra por sí sola que la regresión haya pasado. Para el cierre académico se debe conservar la salida real de `npm run verify`, los resultados del recorrido de navegador y las capturas referenciadas en `EVIDENCIAS_INCREMENTO_2.md`. No presentar resultados históricos del incremento anterior como si fueran ejecuciones de esta versión.

Si `npm run verify` devuelve `Missing script: verify`, primero revisa la carpeta actual con `npm run`. El paquete funcional define `verify` como `npm run typecheck && npm test`; la verificación se debe ejecutar desde la raíz funcional junto a `src/index.ts`, no desde `prototipo-figma`.

## Limitaciones

- El chat es una simulación web; no está conectado a WhatsApp Business Platform.
- El reconocimiento de texto se limita a intenciones y expresiones conocidas; no es un modelo de lenguaje abierto.
- El almacenamiento es local en JSON y no está diseñado como base compartida para varias instancias desplegadas.
- No incluye autenticación administrativa.
- Las reglas de producción deben validarse con una persona encargada de un negocio real.
- La rama de GitHub contiene documentación de este incremento, pero el servidor funcional del ZIP todavía debe sincronizarse al repositorio. El issue #25 registra esa tarea.
- La revisión informal local del compañero fue reportada por el equipo. La revisión formal del código debe registrarse en el pull request de implementación cuando el código esté publicado.

## Relación con el primer incremento

El primer incremento demostró un flujo vertical centrado en cambiar la cantidad de un pedido existente, validar la solicitud según la etapa y conservar el resultado. El segundo incrementa la flexibilidad conversacional, mejora la persistencia y define el tratamiento de excepciones con revisión humana, sin sustituir el primer flujo.