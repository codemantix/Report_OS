import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import styles from './Landing.module.css';

export default function LandingCTA() {
  return (
    <section className={styles.ctaSectionPremium}>
      <div className={styles.sectionInner}>
        <div className={styles.ctaBox}>
          <h2 className={styles.ctaTitlePremium}>
            Ready to bring clarity to team execution?
          </h2>
          <p className={styles.ctaDescPremium}>
            Connect your goals, track daily reports, and identify operational blockers with Codemantix Report OS.
          </p>
          <div className={styles.ctaActions}>
            <Link href="/auth/login" className={styles.ctaBtnPrimary}>
              Open Report OS <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
