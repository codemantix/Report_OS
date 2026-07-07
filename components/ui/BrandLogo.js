import styles from './BrandLogo.module.css';

export default function BrandLogo({ variant = 'auth', className = '', alt = 'Codemantix Report OS' }) {
  const rootClass = [styles.root, styles[variant], className].filter(Boolean).join(' ');
  const showProductName = variant === 'auth' || variant === 'authCompact';
  const Root = showProductName ? 'div' : 'span';

  return (
    <Root className={rootClass} aria-label={showProductName ? undefined : alt}>
      <img
        src="/logo.png"
        alt={showProductName ? '' : alt}
        aria-hidden={showProductName ? 'true' : undefined}
        className={`${styles.image} ${styles.logoLight}`}
      />
      <img src="/logo-light.png" alt="" aria-hidden="true" className={`${styles.image} ${styles.logoDark}`} />
      {showProductName && (
        <h1 className={styles.productName}>Codemantix Report OS</h1>
      )}
    </Root>
  );
}
