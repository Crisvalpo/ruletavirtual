/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}'
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#FF6B35',
                    dark: '#E85528',
                    light: '#FF9F68'
                },
                secondary: {
                    DEFAULT: '#4ECDC4',
                    dark: '#3AAFA9',
                    light: '#7FE0D9'
                },
                accent: '#FFE66D'
            }
        }
    },
    plugins: []
};
