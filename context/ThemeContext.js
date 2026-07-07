import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

const STORAGE_KEY = 'codemantix-theme';

/**
 * Resolve the actual theme from a stored preference.
 * 'light' → 'light', 'dark' → 'dark', 'system' → match media query
 */
function resolveTheme(stored) {
  if (stored === 'dark') return 'dark';
  if (stored === 'light') return 'light';
  // system — follow device preference
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * Apply the resolved theme to the document root.
 */
function applyTheme(resolved) {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('system');
  const [resolvedTheme, setResolvedTheme] = useState('light');
  const [mounted, setMounted] = useState(false);

  // On mount: read localStorage and apply
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || 'system';
    setThemeState(stored);
    const resolved = resolveTheme(stored);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    setMounted(true);
  }, []);

  // Listen for system theme changes when theme is 'system'
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    function handleChange() {
      const resolved = mediaQuery.matches ? 'dark' : 'light';
      setResolvedTheme(resolved);
      applyTheme(resolved);
    }

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  const toggleTheme = useCallback(() => {
    const next = resolvedTheme === 'light' ? 'dark' : 'light';
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  // Avoid hydration mismatch — don't render children with theme until mounted
  if (!mounted) {
    return <div style={{ visibility: 'hidden' }}>{children}</div>;
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

export default ThemeContext;
