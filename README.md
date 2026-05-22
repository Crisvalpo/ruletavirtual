# 🎰 Ruleta Animalitos - Sistema Multi-Pantalla

Sistema profesional de ruleta para Fiestas Patrias 2026  con 3 modos de operación (Individual, Grupal, Especial).

## 🚀 Stack Tecnológico

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + CSS Variables
- **Database**: Supabase (PostgreSQL + Realtime)
- **Payments**: Mercado Pago
- **Deployment**: Ubuntu / Luke Server (lukeapp.me)

## 📂 Estructura del Proyecto

```
C:\Github\Ruleta\
├── REF/                    # Implementación original (referencia)
├── app/                    # Next.js App Router
│   ├── individual/         # Modo individual (BYOD)
│   ├── display/           # Pantallas grandes
│   ├── admin/             # Dashboard staff
│   └── api/               # API routes
├── components/            # Componentes reutilizables
├── lib/                   # Lógica de negocio
│   ├── supabase/
│   └── mercadopago/
└── public/                # Assets estáticos
```

## 🎮 Modos de Juego

### 1. Individual (BYOD)
- 4 pantallas simultáneas
- Jugadores usan su celular
- Ruletas temáticas (12 segmentos)
- $1,000 por jugada

### 2. Grupal (Sorteos)
- Boletos numerados (1-36)
- Sorteos cada 5 minutos
- Jackpot opcional
- Premios fijos

### 3. Especial (Por Hora)
- Premios grandes ($50k, Nintendo, etc.)
- Venta online + presencial
- Transmisión en vivo
- Marketing

## 🛠️ Setup

### Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales
```

### Desarrollo

```bash
# Correr servidor de desarrollo
npm run dev

# Abrir en navegador
http://localhost:3000
```

### Supabase Setup

1. Crear proyecto en [supabase.com](https://supabase.com)
2. Ejecutar migraciones en `supabase/migrations/`
3. Habilitar Realtime en Settings
4. Copiar API keys a `.env.local`

## 📊 Documentación de la Arquitectura y Auditoría

Para una comprensión exhaustiva de la lógica del sistema, flujos en vivo, estado y progreso, consulta los siguientes documentos generados en la carpeta `docs/`:

- 🏛️ [Arquitectura y Flujo de Datos](file:///d:/Github/RULETA/docs/ARQUITECTURA.md)
- ⚙️ [Máquina de Estados y Lógica (Celular - TV)](file:///d:/Github/RULETA/docs/ESTADO_Y_LOGICA.md)
- 🚀 [Estado de Avance, Estabilidad y Pendientes (Roadmap)](file:///d:/Github/RULETA/docs/AVANCE_Y_PENDIENTES.md)

Además, hay documentos de referencia original en la carpeta `brain/` y `REF/`.

## 📄 Licencia

Privado - Uso interno

---

**Desarrollado por**: Crisvalpo  
**Año**: 2026
