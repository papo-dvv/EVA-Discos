// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        verde: {
          institucional: '#1B8A56',
          oscuro: '#0F5C39',
          claro: '#DCEFE2',
        },
        arena: {
          DEFAULT: '#E7DDC9',
          suave: '#F3EEE2',
        },
        concreto: {
          DEFAULT: '#8C897F',
          oscuro: '#55524A',
        },
        estado: {
          ok: '#1B8A56',
          seguimiento: '#C79A3E',
          cambio: '#C2703C',
          critico: '#B33B3B',
        },
      },
      fontFamily: {
        display: ['"General Sans"', '"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        data: ['"IBM Plex Mono"', '"JetBrains Mono"', 'monospace'],
      },
      backdropBlur: {
        glass: '32px',
        'glass-lg': '44px',
      },
      borderRadius: {
        'glass-sm': '26px',
        glass: '34px',
        'glass-lg': '44px',
      },
      boxShadow: {
        glass: '0 40px 90px -24px rgba(15, 92, 57, 0.16), 0 10px 24px rgba(85, 82, 74, 0.10)',
      },
    },
  },
  plugins: [],
};
