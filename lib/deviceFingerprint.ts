/**
 * Device Fingerprinting Utility
 * Generates a unique fingerprint for the current device/browser
 */

/**
 * Simple hash function for strings
 */
function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

/**
 * Generates a device fingerprint based on browser characteristics
 * This is NOT for security - just to identify the same device across sessions
 */
export function generateDeviceFingerprint(): string {
    if (typeof window === 'undefined') {
        return 'server-side';
    }

    const components: string[] = [];

    // User agent
    components.push(navigator.userAgent);

    // Screen resolution
    components.push(`${screen.width}x${screen.height}`);
    components.push(`${screen.colorDepth}`);

    // Timezone
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // Language
    components.push(navigator.language);

    // Platform
    components.push(navigator.platform);

    // Hardware concurrency (number of CPU cores)
    if (navigator.hardwareConcurrency) {
        components.push(navigator.hardwareConcurrency.toString());
    }

    // Device memory (if available)
    if ('deviceMemory' in navigator) {
        components.push((navigator as any).deviceMemory.toString());
    }

    // Touch support
    components.push(('ontouchstart' in window).toString());

    // Combine all components
    const fingerprint = components.join('|');

    // Hash it to make it shorter
    return simpleHash(fingerprint);
}

/**
 * Gets or creates a persistent device fingerprint
 * Stores in localStorage for consistency across sessions
 */
export function getDeviceFingerprint(): string {
    if (typeof window === 'undefined') {
        return 'server-side';
    }

    const STORAGE_KEY = 'device_fingerprint';

    // Try to get existing fingerprint
    let fingerprint = localStorage.getItem(STORAGE_KEY);

    if (!fingerprint) {
        // Generate new one
        fingerprint = generateDeviceFingerprint();
        localStorage.setItem(STORAGE_KEY, fingerprint);
    }

    return fingerprint;
}
