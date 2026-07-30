/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vault: {
          dark: "#0B0F19",
          card: "#111827",
          border: "#1F2937",
          cyan: "#06B6D4",
          blue: "#3B82F6",
          purple: "#8B5CF6",
          accent: "#00F2FE",
          surface: "rgba(17, 24, 39, 0.7)"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      },
      boxShadow: {
        'glow-cyan': '0 0 25px -5px rgba(6, 182, 212, 0.4)',
        'glow-blue': '0 0 25px -5px rgba(59, 130, 246, 0.4)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      },
      backdropBlur: {
        'xs': '2px'
      }
    },
  },
  plugins: [],
}
