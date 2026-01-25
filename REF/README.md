# Documentación de Referencia: Sistema de Ruletas

Esta documentación detalla la estructura y funcionamiento de las ruletas existentes en el directorio `REF`.

## Estructura General

El sistema se divide en dos categorías principales:
1.  **REF/Grupal**: Ruleta principal para sorteos generales.
2.  **REF/Individual**: Colección de ruletas temáticas para juegos individuales.

---

## 1. Ruleta Grupal (`REF/Grupal`)

Diseñada para eventos principales, incluye funcionalidades avanzadas como cronómetro, acumulado (jackpot) y reproductor de música.

### Archivos Clave
*   `index.html`: Estructura principal.
*   `JS.js`: Lógica del juego (configuración de Winwheel, cronómetro, sorteo).
*   `main.css`: Estilos globales.
*   `Winwheel.js`: Librería base para la ruleta.
*   `TweenMax.min.js`: Motor de animaciones.

### Características
*   **Resolución**: Optimizada para 1920x1080 (HD).
*   **Cronómetro**: Cuenta regresiva de 5 minutos (configurable).
*   **Jackpot**: Sistema de acumulado con botones ocultos para sumar/resetear.
*   **Multimedia**: Reproductor de YouTube embebido e integración de sonidos (tick, warning, boom).
*   **Activos**:
    *   `image/`: Contiene imágenes de fondo, puntero y premios.
    *   `audio/`: Efectos de sonido.

---

## 2. Ruletas Individuales (`REF/Individual`)

Colección de 11 minijuegos temáticos. Cada carpeta es autocontenida.

### Temáticas Disponibles
*   Barbie
*   Bluey
*   Encanto
*   Equipos (Fútbol)
*   Halloween
*   Intensa (Intensamente)
*   Mario
*   Paw (Paw Patrol)
*   Reg (Regular Show / Otros)
*   What (What If...? / Marvel)

### Estructura Estándar (Ejemplo: Barbie, Bluey)
Cada carpeta suele contener:
*   `Index.html` (o `[NombreTema].html`): Archivo principal.
*   `JS.js`: Lógica específica de esa ruleta (premios, segmentos).
*   `Fondo.jpg`: Imagen de fondo.
*   `basic_pointer.png`: Imagen del puntero.
*   **Segmentos**: `1.png` a `12.png` (imágenes que giran en la ruleta).
*   **Premios**: `1.jpg` a `12.jpg` (imágenes mostradas al ganar).

### Lógica de Segmentos
La mayoría de las ruletas individuales configuran 12 segmentos.
**Ejemplo de configuración (Barbie/Bluey):**
```javascript
'segments': [
    {'image': '1.png', 'text': '7', 'phrase': 'Personaje A'},
    // ... hasta 12 segmentos
]
```

### Excepciones Importantes

#### Caso: Encanto
*   **Archivo HTML**: `Encanto.html`
*   **Lógica JS**: Integrada directamente en el HTML (script inline), no usa `JS.js` externo para la configuración principal.
*   **Integración PHP**: Intenta enviar el ganador a `registro_ganador.php` mediante POST (funcionalidad legacy).
*   **Segmentos**:
    1.  Camilo
    2.  Felix
    3.  Alma
    4.  Antonio
    5.  Pepa
    6.  Agustin
    7.  Mirabel
    8.  Bruno
    9.  Isabela
    10. Luisa
    11. Dolores
    12. Julieta

#### Caso: Equipos
*   Usa escudos de equipos de fútbol como segmentos (`1.png` a `12.png`).
*   Los premios son las camisetas o jugadores (`1.jpg`...).

---

## Activos y Recursos

### Imágenes
*   **Formato**: Principalmente PNG para transparencias (segmentos, punteros) y JPG para fondos/premios.
*   **Nomenclatura**: Numérica estricta (`1.png`, `2.png`...) correspondiente al ID del segmento.

### Audio
Archivos comunes en la raíz de cada carpeta individual o carpeta `audio` grupal:
*   `tick.mp3`: Sonido al girar.
*   `boom.mp3` / `winsound`: Sonido de victoria.

## Notas Técnicas para Migración
1.  **Dependencias**: Todas las ruletas dependen de `Winwheel.js` y `TweenMax`.
2.  **Responsividad**: Diseñadas principalmente para pantallas 1920x1080 fijas (`scroll="no"`).
3.  **Legacy Code**: El código de `Encanto` incluye referencias a un backend PHP que podría necesitar ser eliminado o reemplazado en la nueva versión Next.js.
