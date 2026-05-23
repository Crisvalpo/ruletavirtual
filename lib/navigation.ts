/**
 * Realiza una redirección segura. Intenta usar Next.js router.push primero,
 * y si la navegación no ocurre tras un tiempo límite (por congelamiento de Next.js
 * o demoras de hidratación), fuerza un refresh/redirección del navegador a la página destino.
 */
export const safeRedirect = (router: any, path: string, delayMs = 3000) => {
    // 1. Intentar redirección interna rápida de Next.js
    router.push(path);
    
    // 2. Programar verificación de seguridad
    setTimeout(() => {
        try {
            // Obtenemos el path relativo de la ventana actual sin query params
            const currentPath = window.location.pathname;
            // Obtenemos el path destino sin query params
            const targetPath = path.split('?')[0];

            if (currentPath !== targetPath) {
                console.warn(`⏳ La redirección a ${path} tardó más de la cuenta. Forzando navegación directa...`);
                window.location.href = path;
            }
        } catch (e) {
            console.error("Error en safeRedirect:", e);
        }
    }, delayMs);
};
