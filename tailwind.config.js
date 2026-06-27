/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },
        accent: {
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
      },
      boxShadow: {
        card:       '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.05)',
        'card-hover':'0 4px 8px rgba(0,0,0,0.08), 0 12px 32px rgba(0,0,0,0.08)',
        btn:        '0 2px 8px rgba(13,148,136,0.40)',
        'btn-accent':'0 2px 8px rgba(217,119,6,0.40)',
        glow:       '0 0 0 3px rgba(13,148,136,0.18)',
        editor:     '0 8px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
      },
      animation: {
        'fade-up':    'fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) forwards',
        'shimmer':    'shimmer 1.6s linear infinite',
        'spin-slow':  'spin 2s linear infinite',
        'pulse-ring': 'pulseRing 1.8s ease-out infinite',
        'scan':       'scan 2.4s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        pulseRing: {
          '0%':   { transform: 'scale(0.9)', opacity: '0.8' },
          '70%':  { transform: 'scale(1.3)', opacity: '0' },
          '100%': { opacity: '0' },
        },
        scan: {
          '0%, 100%': { transform: 'translateY(-6px)', opacity: '0.6' },
          '50%':      { transform: 'translateY(6px)',  opacity: '1'   },
        },
      },
    },
  },
  plugins: [],
}
