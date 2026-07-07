import Link from 'next/link';
import BrandLogo from '../ui/BrandLogo';
import styles from './Landing.module.css';

export default function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footerPremium}>
      <div className={styles.footerInner}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBranding}>
            <div className={styles.footerLogoWrap}>
              <BrandLogo variant="footer" alt="Codemantix Collective" />
              <span className={styles.footerProductName}>Report OS</span>
            </div>
            <p className={styles.footerTaglineText}>
              Reporting &amp; progress intelligence system for serious execution.
            </p>
          </div>

          <div className={styles.footerNavLinks}>
            <a href="#workflow" className={styles.footerLinkItem}>Workflow</a>
            <a href="#ai-review" className={styles.footerLinkItem}>AI Analysis</a>
            <a href="#roles" className={styles.footerLinkItem}>For Teams</a>
            <a href="#benefits" className={styles.footerLinkItem}>Benefits</a>
            <Link href="/auth/login" className={styles.footerLinkItem}>Login</Link>
          </div>
        </div>

        <div className={styles.footerDivider} />

        <div className={styles.footerBottomRow}>
          <span>&copy; {currentYear} Codemantix. All rights reserved. · Built by the Codemantix Team</span>
          <span>Designed for accountability without micromanagement.</span>
        </div>
      </div>
    </footer>
  );
}
