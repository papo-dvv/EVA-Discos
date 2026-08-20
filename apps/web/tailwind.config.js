// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        verde: {
          institucional: '#059669',
          oscuro: '#047857',
          claro: '#ECFDF5',
        },
        arena: {
          DEFAULT: '#E2E8F0',
          suave: '#F8FAFC',
        },
        concreto: {
          DEFAULT: '#64748B',
          oscuro: '#1E293B',
        },
        estado: {
          ok: '#10B981',
          seguimiento: '#F59E0B',
          cambio: '#F97316',
          critico: '#DC2626',
        },
        // Grupo nuevo (styles.md §2.3) — sidebar oscura cinemática, siempre
        // fija independientemente del tema claro del resto de la app.
        sidebar: {
          DEFAULT: '#0f172a',
          foreground: '#e2e8f0',
          primary: '#10b981',
          accent: 'rgba(16,185,129,0.14)',
          border: 'rgba(148,163,184,0.18)',
        },
        // Grupo nuevo (styles.md §2.4) — tokens de marca "Metro" para el
        // shell (sidebar/topbar), no reemplazan los semánticos de arriba.
        metro: {
          'primary': '#059669',
          'primary-light': '#10b981',
          'primary-dark': '#047857',
          'sidebar-from': '#02050b',
          'sidebar-mid': '#050914',
          'sidebar-to': '#0a1220',
          'sidebar-glow': '#7fb8c9',
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
