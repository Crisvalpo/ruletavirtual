-- Migration 044: Document Future Features
-- Adds SQL comments to tables and columns planned for future implementation

-- ========================================
-- RAFFLES SYSTEM (Future Implementation)
-- ========================================

COMMENT ON TABLE public.raffles IS 
'Sistema de sorteos/rifas para modo "group_event".
ESTADO: Pendiente de implementación futura.
PROPÓSITO: Permite crear sorteos programados con venta de tickets numerados (1-36).
FLUJO: Crear sorteo → Vender tickets → Girar ruleta central → Determinar ganador.
RELACIONADO: raffle_tickets, venue_settings.active_raffle_id';

COMMENT ON COLUMN public.raffles.code IS 
'Código único del sorteo (ej: "ROSA-001"). Usado para identificación y búsqueda.';

COMMENT ON COLUMN public.raffles.status IS 
'Estado del sorteo: open | closed_for_sales | spinning | completed | cancelled';

COMMENT ON COLUMN public.raffles.winning_number IS 
'Número ganador (1-36) determinado por la ruleta central.';

COMMENT ON COLUMN public.raffles.winner_ticket_id IS 
'FK al ticket ganador. NULL hasta que se complete el sorteo.';

-- ========================================
-- RAFFLE TICKETS (Future Implementation)
-- ========================================

COMMENT ON TABLE public.raffle_tickets IS 
'Tickets vendidos para sorteos. Relacionado con tabla raffles.
ESTADO: Pendiente de implementación futura.
PROPÓSITO: Registrar compras de tickets numerados para sorteos.
CARACTERÍSTICAS: Apuestas jackpot opcionales, validación de premios, registro de compradores.';

COMMENT ON COLUMN public.raffle_tickets.ticket_number IS 
'Número del ticket (1-36). Único por sorteo (constraint UNIQUE(raffle_id, ticket_number)).';

COMMENT ON COLUMN public.raffle_tickets.jackpot_bet IS 
'TRUE si el comprador apostó al jackpot. Requiere jackpot_number y jackpot_amount.';

COMMENT ON COLUMN public.raffle_tickets.prize_claimed IS 
'TRUE cuando el premio ha sido reclamado por el ganador.';

-- ========================================
-- VENUE SETTINGS - Future Columns
-- ========================================

COMMENT ON COLUMN public.venue_settings.active_raffle_id IS 
'ID del sorteo actualmente en curso. Usado cuando current_mode = "group_event".
ESTADO: Pendiente de implementación futura.
PROPÓSITO: Vincular el local con el sorteo activo, bloquear pantallas individuales durante evento.
RELACIONADO: raffles.id';

COMMENT ON COLUMN public.venue_settings.central_screen_id IS 
'ID de la pantalla maestra para modo "group_event".
ESTADO: Parcialmente implementado (se lee en useVenueSettings pero no se usa).
PROPÓSITO: Designar qué pantalla física mostrará el sorteo principal.
VALOR ACTUAL: 1 (por defecto)';

-- ========================================
-- VENUE SETTINGS - Active Columns
-- ========================================

COMMENT ON COLUMN public.venue_settings.current_mode IS 
'Modo operativo del local: "individual" (parque) o "group_event" (sorteo).
ESTADO: Activamente usado.
IMPACTO: Controla si las pantallas individuales están habilitadas o bloqueadas.';

COMMENT ON COLUMN public.venue_settings.base_url IS 
'URL base para generar códigos QR en tickets. NULL = usar window.location.origin.
ESTADO: Activamente usado.
USO: Útil para túneles de desarrollo (Cloudflare) o dominios personalizados.';

COMMENT ON COLUMN public.venue_settings.max_failed_attempts IS 
'Número máximo de intentos fallidos antes de bloquear pantalla.
ESTADO: Activamente usado (desde migración 043).
RANGO RECOMENDADO: 2-10 intentos.
RELACIONADO: redemption_attempts, redeem_or_continue_package()';

COMMENT ON COLUMN public.venue_settings.cooldown_minutes IS 
'Duración del bloqueo temporal en minutos tras exceder max_failed_attempts.
ESTADO: Activamente usado (desde migración 043).
RANGO RECOMENDADO: 1-60 minutos.
RELACIONADO: redemption_attempts.cooldown_until';

-- ========================================
-- RLS POLICIES - Security Notes
-- ========================================

COMMENT ON POLICY "Public read venue settings" ON public.venue_settings IS 
'Permite lectura pública de configuración del local.
SEGURIDAD: Aceptable - no expone datos sensibles.';

COMMENT ON POLICY "Public update venue settings" ON public.venue_settings IS 
'DESARROLLO: Permite updates sin restricción para facilitar testing.
PRODUCCIÓN: DEBE restringirse a rol admin solamente.
RECOMENDACIÓN: Implementar auth.jwt() ->> "role" = "admin" antes de producción.';

-- ========================================
-- REDEMPTION ATTEMPTS - Security Table
-- ========================================

COMMENT ON TABLE public.redemption_attempts IS 
'Rastrea intentos fallidos de canje por pantalla para protección contra fuerza bruta.
ESTADO: Activamente usado.
PROPÓSITO: Prevenir adivinación de códigos mediante bloqueos temporales.
PARÁMETROS: Configurables desde venue_settings (max_failed_attempts, cooldown_minutes).';

COMMENT ON COLUMN public.redemption_attempts.screen_id IS 
'ID de la pantalla física. Usado como clave de rastreo (no device_fingerprint para evitar evasión).';

COMMENT ON COLUMN public.redemption_attempts.failed_count IS 
'Contador de intentos fallidos consecutivos. Se resetea a 0 en canje exitoso.';

COMMENT ON COLUMN public.redemption_attempts.cooldown_until IS 
'Timestamp hasta cuando la pantalla está bloqueada. NULL = sin bloqueo activo.';
