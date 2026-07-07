import Image from 'next/image';
import styles from './BrandLogo.module.css';

export default function BrandLogo({ variant = 'auth', className = '', alt = 'Codemantix Report OS' }) {
  const rootClass = [styles.root, styles[variant], className].filter(Boolean).join(' ');
  const showProductName = variant === 'auth' || variant === 'authCompact';
  const Root = showProductName ? 'div' : 'span';

  return (
    <Root className={rootClass} aria-label={showProductName ? undefined : alt}>
      <Image
        src="/logo.png"
        alt={showProductName ? '' : alt}
        aria-hidden={showProductName ? 'true' : undefined}
        className={`${styles.image} ${styles.logoLight}`}
        width={150}
        height={36}
      />
      <Image
        src="/logo-light.png"
        alt=""
        aria-hidden="true"
        className={`${styles.image} ${styles.logoDark}`}
        width={150}
        height={36}
      />
      {showProductName && (
        <h1 className={styles.productName}>Codemantix Report OS</h1>
      )}
    </Root>
  );
}
