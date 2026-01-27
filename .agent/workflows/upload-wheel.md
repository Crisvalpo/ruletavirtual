---
description: How to upload a new individual roulette wheel
---

# 🚀 Workflow: Upload New Individual Wheel

Follow these steps to create and upload a fully functional custom roulette for individual mode.

## 1. Prepare Assets
You need exactly **26 assets** for a 12-segment wheel:
- **12 Wheel Segments**: Transparent PNGs. These are the wedges shown on the display.
    - Naming: `1.png`, `2.png`, ..., `12.png`
- **12 Selector Icons**: Square JPGs. These are the icons players see on their phones.
    - Naming: `1.jpg`, `2.jpg`, ..., `12.jpg`
- **1 Background**: High-res JPG for the game display.
    - Naming: `background.jpg`
- **1 Preview/Poster**: Catchy JPG/PNG for the wheel selector.
    - Naming: `preview.jpg` (or any name, you select it manually).

## 2. Access Admin Panel
// turbo
1. Navigate to `http://localhost:3000/admin/wheels` in your browser.

## 3. Fill the Form
1. **Name**: Enter the theme name (e.g., "Avengers").
2. **Segments PNG**: Select the 12 PNG files.
3. **Selector JPG**: Select the 12 JPG files.
4. **Poster/Preview**: Select your catchy preview image.
5. **Background**: Select the main game background.

## 4. Upload
1. Click **🚀 Subir Ruleta**.
2. Wait for the success message: `✅ Ruleta y 12 segmentos creados exitosamente!`.

## 5. Verify
1. Open the player screen: `http://localhost:3000/individual/screen/1`.
2. You should see your new wheel in the selector with the "Poster" image.
3. Select it and verify the mobile app loads the custom icons.
