import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bosque: { DEFAULT: '#0D3D20', deep: '#061F10' },
        verde: { DEFAULT: '#1D6B3A', hover: '#155028', soft: '#D4EDDA', tint: '#EDF6EE' },
        pradera: '#5CAA6F',
        rio: { DEFAULT: '#2E86AB', deep: '#1A5A7A', soft: '#E5F2F8' },
        aguas: '#A8D8E8',
        kayak: { DEFAULT: '#F5C842', deep: '#C49A1A', soft: '#FDF4D8' },
        roca: { DEFAULT: '#8B6F47', soft: '#E8DFD0' },
        rojo: { DEFAULT: '#C0392B', soft: '#FBE5E1' },
        paper: { DEFAULT: '#FAF8F3', warm: '#F4F0E6' },
        ink: { DEFAULT: '#1A1A1A', soft: '#4A4A4A' },
        muted: '#8A8378',
        line: { DEFAULT: '#E5DED1', soft: '#F0EAD8' },
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans: ['var(--font-geist)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '6px', md: '10px', lg: '16px', xl: '22px', '2xl': '32px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(13, 61, 32, 0.06)',
        md: '0 4px 16px rgba(13, 61, 32, 0.08), 0 1px 3px rgba(13, 61, 32, 0.04)',
        lg: '0 12px 40px rgba(13, 61, 32, 0.12), 0 2px 8px rgba(13, 61, 32, 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
