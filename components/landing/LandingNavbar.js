import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import ThemeToggle from '../settings/ThemeToggle';
import BrandLogo from '../ui/BrandLogo';
import styles from './Landing.module.css';

export default function LandingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: 'Workflow', href: '#workflow' },
    { label: 'AI Analysis', href: '#ai-review' },
    { label: 'For Teams', href: '#roles' },
  ];

  return (
    <nav className={styles.navbar} role="navigation" aria-label="Main navigation">
      <div className={styles.navbarInner}>
        <Link href="/" className={styles.navbarBrand} aria-label="Codemantix Report OS home">
          <BrandLogo variant="landing" alt="Codemantix Collective" />
          <span className={styles.navbarProduct}>Report OS</span>
        </Link>

        {/* Center menu links */}
        <div className={styles.navbarLinks}>
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className={styles.navbarLink}>
              {link.label}
            </a>
          ))}
        </div>

        {/* Right action button + toggle */}
        <div className={styles.navbarRight}>
          <ThemeToggle compact />
          <Link href="/auth/login" className={styles.navbarLoginBtn}>
            Login
          </Link>
          <button
            className={styles.navbarMobileBtn}
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileOpen && (
        <div className={styles.navbarMobileMenu}>
          <div className={styles.navbarMobileHeader}>
            <span className={styles.navbarMobileBrand}>Codemantix</span>
            <span className={styles.navbarMobileProduct}>Report OS</span>
          </div>
          <div className={styles.navbarMobileMenuInner}>
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={styles.navbarMobileLink}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/auth/login"
              className={styles.navbarMobileLink}
              onClick={() => setMobileOpen(false)}
            >
              Login
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
