/** @type {import('tailwindcss').Config} */
const tokens = [
  'background',
  'foreground',
  'muted',
  'border',
  'fill',
  'destructive',
  'accent',
  'offline',
  'progress-ok',
  'progress-warn',
  'progress-over',
];
const tones = ['blue', 'green', 'red', 'orange', 'grey'];
for (const tone of tones) tokens.push(`status-${tone}`, `status-${tone}-text`);
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  safelist: [
    ...tones.flatMap((tone) => [`bg-status-${tone}`, `text-status-${tone}-text`]),
    'bg-progress-ok',
    'bg-progress-warn',
    'bg-progress-over',
  ],
  theme: {
    extend: {
      colors: Object.fromEntries(
        tokens.map((token) => [token, `rgb(var(--color-${token}) / <alpha-value>)`]),
      ),
    },
  },
  plugins: [],
};
