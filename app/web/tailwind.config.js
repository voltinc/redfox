/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: 'var(--bg)',
        panel: 'var(--panel)',
        raised: 'var(--panel-2)',
        line: 'var(--line)',
        strong: 'var(--line-strong)',
        fg: 'var(--fg)',
        muted: 'var(--fg-muted)',
        dim: 'var(--fg-dim)',
        accent: 'var(--accent)',
        accent2: 'var(--accent-hover)',
        success: 'var(--success)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',
        info: 'var(--info)',
        ink: 'var(--ink)',
        soft: 'var(--accent-soft)',
        accentInk: 'var(--accent-strong)',
      },
      fontFamily: {
        sans: ['Instrument Sans', 'Inter', 'ui-sans-serif', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Instrument Sans', 'Inter', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['10.5px', '14px'],
        xs: ['11.5px', '16px'],
        sm: ['12.5px', '18px'],
        base: ['13.5px', '20px'],
      },
      borderRadius: { DEFAULT: '8px', md: '8px', lg: '12px', xl: '16px' },
      boxShadow: {
        pop: '0 16px 40px -18px rgba(35,27,18,0.35), 0 0 0 1px var(--line)',
        card: 'var(--shadow-sm)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(2px)' }, to: { opacity: 1, transform: 'none' } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        pulse2: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
      },
      animation: {
        'fade-in': 'fade-in 120ms ease-out',
        'slide-up': 'slide-up 160ms cubic-bezier(0.16,1,0.3,1)',
        pulse2: 'pulse2 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
