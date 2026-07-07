import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import styles from './ThemeToggle.module.css';

const options = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export default function ThemeToggle({ compact = false }) {
  const { theme, setTheme } = useTheme();

  if (compact) {
    // Compact mode for topbar/sidebar — just a button
    return (
      <button
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
    );
  }

  return (
    <div className={styles.toggle}>
      {options.map((opt) => {
        const Icon = opt.icon;
        const isActive = theme === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={`${styles.option} ${isActive ? styles.optionActive : ''}`}
            aria-label={`${opt.label} mode`}
          >
            <Icon className={styles.icon} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
