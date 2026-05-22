# Máquina de Estados y Lógica del Sistema

El flujo del proyecto se rige por un estricto control de estados distribuido entre PostgreSQL y los clientes web, diseñado para evitar bloqueos y fallos de red.

## 1. El Estado del Celular (`player_queue`)
El ciclo de vida del usuario (desde que escanea el QR hasta que gana) se define en el campo `status` de la tabla `player_queue`:
- **`waiting`**: El usuario está en cola. Esperando a que el jugador anterior termine.
- **`playing`**: Es su turno. Su pantalla móvil cambia a la interfaz de juego y toma control de la TV.
- **`completed`**: Ha girado la ruleta. Se almacena su resultado y si ganó un premio.
- **`abandoned`**: El usuario cerró el navegador o superó el tiempo máximo de espera.

## 2. El Estado de la Pantalla de TV (`screen_state`)
La TV tiene su propio estado, el cual debe mantenerse perfectamente sincronizado con el celular del jugador activo (`current_queue_id`):
- **`idle`**: La pantalla está en bucle de publicidad. La ruleta gira despacio.
- **`waiting_for_spin`**: Un jugador (`player_queue = playing`) está eligiendo sus animales y está a punto de presionar "GIRAR".
- **`result`**: El giro ha terminado. Se muestra una animación de victoria o derrota por 10-15 segundos.

## 3. Sincronización Celular ↔ TV
Para asegurar que todo se vea instantáneo pero sin riesgos de trampa, usamos un mix de tecnologías:
1. **Zustand (Store Local):** Permite reaccionar al instante a la interfaz en el celular (animaciones de botones).
2. **Supabase Realtime (Broadcast):** Se usa para comandos volátiles que no necesitan guardarse en base de datos. Ejemplo:
   - Cuando el usuario mueve el selector o elige un animal en su celular, se emite un `broadcast: preview_update`.
   - La TV lo recibe al instante y muestra el nombre/emoji del jugador antes de que gire, sin saturar la base de datos de queries inútiles.
3. **Supabase PostgreSQL (Eventos):** Cuando la TV o el jugador detecta un cambio en una fila de la BD (`postgres_changes`), actualizan su estado local.

## 4. Fallbacks (Watchdogs Anti-Bloqueo)
Dado que el internet móvil falla o la gente cierra el navegador, el sistema tiene "Watchdogs" (Perros guardianes) ejecutándose en las pantallas de TV:
- **`force_advance_queue` (RPC):** Si la pantalla se queda estancada en `waiting_for_spin` por más de 60 segundos (el jugador guardó el teléfono y se fue), la TV invoca este RPC. Esto expulsa al jugador fantasma de la cola (`abandoned`) y llama al siguiente.
- **`promote_next_player` (RPC):** La TV vigila constantemente si está en estado `idle`. Si lo está, y detecta a alguien esperando en la cola, pide explícitamente a la base de datos promover a ese usuario. Esto descentraliza el control y evita que todo dependa de un servidor Node.js central.
