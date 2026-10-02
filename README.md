# pedidosFlow

Sistema académico para la gestión de pedidos de tortas personalizadas.

## Descripción

PedidosFlow permite consultar pedidos, solicitar cambios de cantidad y diseño, gestionar revisiones, hacer seguimiento de producción, consultar clientes, revisar el historial de cambios y configurar las reglas de negocio.

El proyecto también incluye un flujo conversacional de prueba que simula la experiencia de atención por WhatsApp sin utilizar la API real de WhatsApp Business.

## Alcance actual

- Gestión de pedidos existentes.
- Consulta de pedido.
- Cambio de cantidad según la etapa de producción.
- Cambio de diseño desde catálogo.
- Solicitud de diseño personalizado con revisión manual.
- Seguimiento de producción mediante checklist.
- Consulta de clientes.
- Historial de cambios.
- Configuración de reglas y datos del negocio.
- Flujo conversacional de prueba.

## Pendientes principales

- Registrar un pedido nuevo con persistencia real.
- Integrar completamente la interfaz con la lógica y persistencia del programa.
- Integrar dashboard y notificaciones con datos reales.
- Completar pruebas y evidencia del primer incremento.

## Fuera de alcance actual

- Integración real con WhatsApp Business.
- Autenticación y control de acceso.
- Categorías adicionales diferentes a la torta personalizada.

## Requisitos

- Node.js
- npm

## Instalación

```bash
npm install
```

## Ejecución

```bash
npm run dev
```

## Verificaciones

Compilación de producción:

```bash
npm run build
```

Verificación de tipos:

```bash
npm run typecheck
```

Formato:

```bash
npm run format
```

En este momento no se declara un `npm test` porque el repositorio todavía no contiene una suite automatizada de pruebas. La cobertura de los casos de aceptación del incremento queda registrada como trabajo pendiente en el Issue correspondiente.

## Flujo de trabajo

La rama estable es `main`.

Las ramas de trabajo siguen esta convención:

```text
feature/<tarea-corta>
fix/<tarea-corta>
test/<tarea-corta>
docs/<tarea-corta>
```

Los cambios importantes se integran mediante Pull Request y revisión antes de llegar a `main`.

## Equipo

Gemas de Cristal

- Steven Suaza Montiel
- Isabel Cristina Duque Cano

## Repositorio

https://github.com/isabel097/pedidosFlow
