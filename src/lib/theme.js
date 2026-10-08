// Light / dark mode. The choice is saved with the user's data (state.ui.theme), never in browser storage.
const THEME_COLORS = { light: '#e4e9f1', dark: '#20242c' };
const systemTheme = () => (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

/** The theme in effect right now: an explicit choice on <html>, else the system setting. */
export const currentTheme = () => document.documentElement.dataset.theme || systemTheme();

/** Apply a theme ('light' | 'dark'); a falsy value leaves the current one in place. */
export function applyTheme(theme) {
  if (!theme) return;
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', THEME_COLORS[theme]));
}
