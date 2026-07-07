import { useTheme } from '../context/ThemeContext';

/**
 * Convenience hook for consuming theme.
 * Re-exports useTheme from ThemeContext for clean imports.
 *
 * Usage:
 *   import useTheme from '../hooks/useTheme';
 *   const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
 */
export default function useTheme() {
  return useTheme();
}
