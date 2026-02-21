---
name: local-ai-agent
description: Skill para delegar tareas pequeñas y no críticas al agente de IA local (Ollama)
---

# Skill: Agente AI Local (Ollama)

Este skill permite delegar la generación de código boilerplate, funciones lógicas aisladas y pruebas unitarias a un agente que corre localmente con Ollama (`qwen2.5-coder:7b`).

## Cuándo Usar

Delegar tareas que sean:
- **Atómicas**: "Crea una función que calcule la distancia entre dos puntos".
- **Boilerplate**: "Crea un modelo de Sequelize para la tabla usuarios".
- **Aisladas**: "Escribe una suite de pruebas para esta utilidad de fechas".
- **No Críticas**: Tareas que no comprometan la seguridad ni la arquitectura principal.

## Restricciones de Uso (Auditoría Obligatoria)

**NUNCA delegar tareas "Delicadas":**
- ❌ Gestión de auth/passwords.
- ❌ Lógica de pagos.
- ❌ Diseño de esquemas de base de datos complejos.
- ❌ Tareas que requieran contexto de todo el proyecto.

## Flujo de Trabajo

Si decides delegar una tarea al agente local:

1. **Asegurar Rama**: Verifica que estás en `ai-agent-testing`.
2. **Ejecutar**: Llama al script:
   ```powershell
   node scripts/run-agent.js "Descripción detallada de la tarea"
   ```
3. **Auditar**: El código aparecerá en `src/generatedTask.js`. **DEBES** leer y auditar este archivo antes de moverlo a su destino final.
4. **Verificar**: Corre el código generado localmente para confirmar que no tiene errores de sintaxis o lógica simple.

## Auditoría y Control de Errores

El agente tiene un loop de autocorrección (3 intentos), pero la decisión final es tuya (Antigravity). Si el agente falla 3 veces:
- Analiza el error capturado por el agente.
- Corrige la tarea tú mismo o divide la tarea en partes más pequeñas para el agente local.

## Registro de Tareas

El agente local realiza commits automáticos con el prefijo `ai-agent:`. No deshagas estos commits sin revisar el código primero.
