import { Loader2, Search, X } from 'lucide-react';
import styles from './SearchInput.module.css';

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  disabled = false,
  loading = false,
  className = '',
  label = 'Search',
}) {
  const handleClear = () => {
    if (!disabled) onChange?.('');
  };

  return (
    <label className={`${styles.root} ${className}`.trim()}>
      <span className={styles.srOnly}>{label}</span>
      <Search className={styles.searchIcon} aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={styles.input}
        aria-label={label}
      />
      {loading ? (
        <Loader2 className={styles.loadingIcon} aria-label="Searching" />
      ) : value ? (
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className={styles.clearButton}
          aria-label="Clear search"
        >
          <X className={styles.clearIcon} aria-hidden="true" />
        </button>
      ) : null}
    </label>
  );
}
