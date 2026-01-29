---
name: spanish-documentation
description: Instrucción permanente para escribir toda la documentación técnica en español
---

# Skill: Documentación en Español

## Regla Global

**TODOS los artefactos de planificación y documentación DEBEN escribirse en español.**

Esto incluye:

- ✅ `implementation_plan.md` - Planes de implementación
- ✅ `task.md` - Listas de tareas
- ✅ `walkthrough.md` - Documentación de cambios realizados
- ✅ Cualquier otro artefact de tipo `implementation_plan`, `walkthrough`, o `task`

## Excepciones

El código técnico sigue en inglés según las reglas globales del usuario:
- ❌ Nombres de tablas, columnas, funciones SQL
- ❌ Nombres de variables, funciones, clases en TypeScript/JavaScript
- ❌ Nombres de archivos y rutas
- ❌ Comentarios en código (pueden ser en español o inglés según contexto)

## Aplicación

Esta regla se aplica **automáticamente** a partir de ahora. No es necesario que el usuario lo solicite en cada conversación.

### Ejemplo de Estructura de Plan en Español

```markdown
# Plan de Implementación: [Título del Feature]

## Descripción del Problema

[Explicación en español del problema a resolver]

## Revisión del Usuario Requerida

> [!IMPORTANT]
> **Parámetros de Configuración**
> 
> [Decisiones importantes que requieren aprobación del usuario]

## Cambios Propuestos

### Capa de Base de Datos

#### [MODIFY] [nombre_archivo.sql](file:///ruta/absoluta)

[Descripción en español de los cambios]

## Plan de Verificación

### Pruebas Automatizadas

[Pasos de prueba en español]

### Verificación Manual

[Pasos de verificación en español]
```

## Recordatorio

Cuando crees artefactos, asegúrate de:
1. Usar español para todas las explicaciones y descripciones
2. Mantener nombres técnicos (archivos, funciones, tablas) en inglés
3. Usar formato markdown apropiado con alertas de GitHub cuando sea necesario
4. Incluir enlaces a archivos con rutas absolutas
