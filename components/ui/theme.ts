// Semantic tokens shared by Tailwind, navigation and status helpers.
export const statusTokens = {
  blue: {
    light: { background: '#dbeafe', text: '#1e40af' },
    dark: { background: '#1e3a5f', text: '#93c5fd' },
  },
  green: {
    light: { background: '#dcfce7', text: '#166534' },
    dark: { background: '#14532d', text: '#86efac' },
  },
  red: {
    light: { background: '#fee2e2', text: '#991b1b' },
    dark: { background: '#7f1d1d', text: '#fca5a5' },
  },
  orange: {
    light: { background: '#ffedd5', text: '#9a3412' },
    dark: { background: '#7c2d12', text: '#fdba74' },
  },
  grey: {
    light: { background: '#e5e7eb', text: '#374151' },
    dark: { background: '#374151', text: '#d1d5db' },
  },
};
export const theme = {
  light: {
    background: '#ffffff',
    fill: '#f2f2f7',
    text: '#000000',
    muted: '#767676',
    border: '#767676',
    destructive: '#ff3b30',
    tint: '#0066cc',
    progress: { ok: '#34c759', warn: '#ff9f0a', over: '#ff3b30' },
    offline: '#8e8e93',
  },
  dark: {
    background: '#121212',
    fill: '#2c2c2e',
    text: '#ffffff',
    muted: '#888888',
    border: '#888888',
    destructive: '#ff453a',
    tint: '#66b2ff',
    progress: { ok: '#34c759', warn: '#ff9f0a', over: '#ff3b30' },
    offline: '#8e8e93',
  },
};
export type Mode = keyof typeof theme;

export function themeVariables(mode: Mode) {
  const colors = theme[mode];
  const tokens: Record<string, string> = {
    background: colors.background,
    fill: colors.fill,
    foreground: colors.text,
    muted: colors.muted,
    border: colors.border,
    destructive: colors.destructive,
    accent: colors.tint,
    'progress-ok': colors.progress.ok,
    'progress-warn': colors.progress.warn,
    'progress-over': colors.progress.over,
    offline: colors.offline,
  };
  for (const [tone, modes] of Object.entries(statusTokens)) {
    tokens[`status-${tone}`] = modes[mode].background;
    tokens[`status-${tone}-text`] = modes[mode].text;
  }
  return Object.fromEntries(
    Object.entries(tokens).map(([name, hex]) => [
      `--color-${name}`,
      hex
        .slice(1)
        .match(/../g)!
        .map((channel) => parseInt(channel, 16))
        .join(' '),
    ]),
  );
}
