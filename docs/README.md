# Documentación — Backend Reservar

Punto de entrada de la documentación del backend, para las entregas de Regularidad y Aprobación Directa del TP de Desarrollo de Software. Proyecto individual (ver [`proposal.md`](../proposal.md)): Federico Merino, 48318.

## Índice

| Documento | Contenido |
|---|---|
| [`instalacion.md`](./instalacion.md) | Cómo instalar y correr el proyecto localmente, sin conocer el código |
| [`arquitectura.md`](./arquitectura.md) | Stack, capas, modelo de datos, flujo de auth y de pago con MercadoPago |
| [`api.md`](./api.md) | Documentación completa de todos los endpoints de la API REST (+ [Swagger UI](./api.md) en `/api-docs`) |
| [`alcance.md`](./alcance.md) | Mapeo de los CRUDs y casos de uso de la propuesta contra lo implementado |
| [`testing.md`](./testing.md) | Cómo correr los tests (unitarios + integración) y evidencia real de ejecución |
| [`deployment.md`](./deployment.md) | Guía de deploy a la VPS (Postgres en Docker + backend con PM2 + nginx) + pipeline de CI/CD (GitHub Actions: seguridad, tests, deploy por SSH) |
| [`workflow.md`](./workflow.md) | Flujo de trabajo con git usado durante el desarrollo |

## Gestión del proyecto

Al ser un proyecto individual no hay minutas de reunión de equipo ni Pull Requests entre integrantes: el desarrollo se hizo directo sobre `master` con commits incrementales (ver `git log`). El seguimiento de avance está en el historial de commits del repositorio y en [`alcance.md`](./alcance.md), que documenta qué requisito de la propuesta cubre cada parte del código.

## Propuesta actualizada

Ver [`../proposal.md`](../proposal.md).
