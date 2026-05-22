# Estado de Avance y Roadmap

Este documento detalla el estado actual del proyecto, enumerando las funciones terminadas, en progreso (inestables) y los pasos pendientes antes de un lanzamiento definitivo a producción masiva.

## 🟢 Completado y Estable
- **Ruleta Individual con Múltiples Diseños:** Los usuarios pueden escanear un QR que asigne una ruleta específica (Ej. Ruleta Mario, Ruleta Sonic). Funciona a la perfección.
- **Sincronización Celular - TV:** Retrasos eliminados. La TV muestra de forma impecable el giro, y el celular lo refleja con exactitud bloqueando la pantalla del jugador.
- **Paquetes y Modos Demo:** Posibilidad de vender un "Paquete de 3 Giros" o de generar "Giros Demo" para pruebas que se auto-destruyen.
- **Evitar Colas Cruzadas / Suplantación:** Verificación de `player_id`. Si alguien intenta tomar el turno de otro o jugar en dos pantallas a la vez, el sistema ahora descarta de forma limpia la sesión antigua o bloquea duplicados.
- **Historial de Premios (`/individual/prizes`):** Sistema persistente. Si ganas y vinculas Google, el premio queda marcado como `"PREMIO NIVEL 1"` y el staff lo puede validar en su panel.

## 🟡 En Progreso / Inestable (Deuda Técnica)
- **Modo Evento Grupal (Venue Mode):** El modo donde participan todos los jugadores a la vez (`group_event`) aún requiere afinamiento en su lógica de conteo, específicamente en la pantalla central que suma los totales.
- **Gestor de Pantallas Duplicadas (BroadcastChannel Local):** Existe lógica para prevenir que un usuario abra dos pestañas de TV al mismo tiempo (`isBlocked`). A veces puede requerir ajuste si Chrome suspende una pestaña, requiriendo un refresco manual.

## 🔴 Pendiente (Para V1.0 Producción)
1. **Sistema Completo de "Paquetes" / Kiosco:**
   - Terminar la lógica comercial: Pagos en el quiosco (Staff) donde se vincula explícitamente un pago a un paquete real que emita un Ticket (QR Seguro) que el jugador puede escanear en su celular para recargar sus giros.
2. **Escalado Global de Imágenes:**
   - Asegurarse de que todas las imágenes alojadas en Supabase Storage estén correctamente cacheadas o en un CDN (como Cloudflare) para que no haya picos lentos cuando varias TVs hagan fetch de los Assets al mismo tiempo.
3. **Logs Exhaustivos en Base de Datos:**
   - La tabla `game_history` está funcional pero podría ser expandida para registrar métricas exactas del tiempo de respuesta o intentos de fraude en caso de una auditoría contable en el casino/evento.
