# Arquitectura del Proyecto "Ruleta Virtual"

El proyecto está diseñado como un sistema distribuido en tiempo real que conecta múltiples "actores" físicos en un mismo local:
1. **El Administrador (`/admin`)**: Configura la ruleta, monitorea las pantallas y ve estadísticas globales.
2. **El Staff (`/staff`)**: Vende tickets en el quiosco, escanea códigos QR y verifica/entrega premios en la "Pizarra de Ganadores".
3. **El Jugador (`/individual`)**: Compra un ticket, escanea el QR en su móvil, se une a la cola de una pantalla y usa su teléfono como control remoto para hacer girar la ruleta en la TV.
4. **La Pantalla de TV (`/display`)**: Pantallas físicas en el local que muestran el juego en vivo a todos los presentes y reaccionan a los comandos del celular de los jugadores.

## Tecnologías Principales
- **Frontend**: Next.js 14+ (App Router), React, TailwindCSS.
- **Backend / Database**: Supabase (PostgreSQL).
- **Tiempo Real**: Supabase Realtime (WebSockets y Broadcasts).
- **Manejo de Estado**: Zustand (cliente) y PostgreSQL RPCs (servidor).

## Flujo de Datos y Eventos
El ecosistema no confía exclusivamente en el cliente para evitar trampas. Utiliza el **Server Authority Mode**:
1. **Sincronización:** Las pantallas de TV (`screen_state`) y los celulares (`player_queue`) escuchan la base de datos vía Supabase Realtime.
2. **Acciones:** Cuando un usuario "gira" la ruleta en su celular, no envía el resultado a la TV. Llama al RPC `play_spin` en Supabase.
3. **Generación de Resultados:** La base de datos (PostgreSQL) genera un número aleatorio, descuenta un "giro" del paquete del usuario, y guarda el resultado de manera atómica.
4. **Reacción:** La TV recibe la actualización de Supabase (con el resultado ya generado) e inicia la animación visual para caer exactamente en el número que dictó el servidor.

## Tablas Clave en la Base de Datos
- `player_queue`: El núcleo de la interacción móvil. Registra a cada persona que escanea un QR, guarda su turno (`status: waiting, playing, completed`), su selección de animales y su premio (`prize_won`).
- `screen_state`: El núcleo de la TV. Mantiene el estado de cada pantalla (`idle`, `waiting_for_spin`, `result`) y asegura que dos personas no jueguen a la vez en la misma pantalla usando "Locks".
- `ticket_sales`: Maneja el inventario y las ventas de paquetes (Ej. "Comprar 3 giros por $5.000").
- `screen_switch_offers`: Sistema de balanceo de carga. Si la Pantalla 1 tiene 10 personas en cola y la Pantalla 2 está vacía, el servidor envía una "oferta de cambio" al celular del usuario.

## Seguridad (Row Level Security - RLS)
- Los jugadores solo pueden modificar su propia entrada en la cola (`player_queue`) gracias a validaciones vinculadas a su sesión (identificador en el `localStorage` o su inicio de sesión de Google).
- Los resultados de los giros se calculan **estrictamente en funciones RPC de PostgreSQL** para evitar manipulaciones en el front-end (como interceptar la llamada de red y forzar un premio).
