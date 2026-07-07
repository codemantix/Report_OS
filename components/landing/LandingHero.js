import Link from 'next/link';
import { 
  ArrowRight, 
  CheckCircle2, 
  Target, 
  Shield, 
  Sparkles, 
  AlertTriangle,
  FileText,
  TrendingUp,
  Clock,
  ChevronRight
} from 'lucide-react';
import styles from './Landing.module.css';

export default function LandingHero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroBgGrid} aria-hidden="true" />
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroGlowSecondary} aria-hidden="true" />

      <div className={styles.heroInner}>
        <div className={styles.heroGrid}>
          <div className={styles.heroContent}>
            <div className={styles.heroBadge}>
              <span className={styles.heroBadgeDot}></span>
              Built for Codemantix execution reviews
            </div>
            <h1 className={styles.heroTitle}>
              Reporting that shows what is really moving.
            </h1>
            <p className={styles.heroSubtitle}>
              Codemantix Report OS helps teams submit structured reports, connect work to tasks and goals, and use AI to surface progress, blockers, and next actions without chasing updates across chats.
            </p>
            <div className={styles.heroActions}>
              <Link href="/auth/login" className={styles.heroPrimaryBtn}>
                Open Report OS <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#workflow" className={styles.heroSecondaryBtn}>
                See the workflow
              </a>
            </div>
            <p className={styles.heroMicrocopy}>
              Built for Codemantix teams, leads, and contributors who need clarity without micromanagement.
            </p>
          </div>

          <div className={styles.heroVisual} aria-hidden="true">
            {/* Realistic Internal Dashboard Mockup */}
            <div className={styles.dashboardCard}>
              <div className={styles.dbCardHeader}>
                <div>
                  <p className={styles.dbEyebrow}>Report OS Workspace</p>
                  <p className={styles.dbTitle}>Execution Dashboard</p>
                </div>
                <span className={styles.dbStatus}>Workspace Live</span>
              </div>

              {/* Top Mini Stats */}
              <div className={styles.dbStatGridMini}>
                <div className={styles.dbMiniStat}>
                  <span className={styles.dbMiniLabel}>Today's Reports</span>
                  <span className={styles.dbMiniValue}>12</span>
                </div>
                <div className={styles.dbMiniStat}>
                  <span className={styles.dbMiniLabel}>Task Alignment</span>
                  <span className={styles.dbMiniValue}>74%</span>
                </div>
                <div className={styles.dbMiniStat}>
                  <span className={styles.dbMiniLabel}>Success Rate</span>
                  <span className={styles.dbMiniValue}>92%</span>
                </div>
              </div>

              {/* Active Report Snippet representing Technology/Creative Team */}
              <div className={styles.dbReportCard}>
                <div className={styles.dbReportTopline}>
                  <span className={styles.dbDeptBadge}>Technology Team · Frontend</span>
                  <span className={styles.dbStatusBadgeGreen}>Report reviewed</span>
                </div>
                <p className={styles.dbReportText}>
                  Frontend landing page implementation completed and integrated with custom CSS variables. Active components are ready for design review.
                </p>
                <div className={styles.dbInsightList}>
                  <span><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Task Aligned</span>
                  <span><Target className="w-3.5 h-3.5 text-blue-500" /> Goal Connected</span>
                  <span><Shield className="w-3.5 h-3.5 text-slate-400" /> Low Risk</span>
                </div>
              </div>

              {/* Blocked Work Status */}
              <div className={styles.dbReportCard}>
                <div className={styles.dbReportTopline}>
                  <span className={styles.dbDeptBadge}>Creative Team · UI/UX</span>
                  <span className={styles.dbStatusBadgeOrange}>Blocked by content</span>
                </div>
                <p className={styles.dbReportText}>
                  Landing page wireframe update complete. Currently blocked awaiting final homepage copy from marketing.
                </p>
                <div className={styles.dbInsightList}>
                  <span><AlertTriangle className="w-3.5 h-3.5 text-orange-500" /> Awaiting design review</span>
                  <span><Clock className="w-3.5 h-3.5 text-slate-400" /> Delayed 1 day</span>
                </div>
              </div>

              {/* Department Progress list */}
              <div className={styles.dbDeptList}>
                <p className={styles.dbSectionTitle}>Department Progress</p>
                
                <div className={styles.dbDeptProgressRow}>
                  <span className={styles.dbDeptName}>Technology</span>
                  <div className={styles.dbProgressBar}>
                    <div className={styles.dbProgressFill} style={{ width: '84%' }}></div>
                  </div>
                  <span className={styles.dbDeptPercent}>84%</span>
                </div>

                <div className={styles.dbDeptProgressRow}>
                  <span className={styles.dbDeptName}>Creative</span>
                  <div className={styles.dbProgressBar}>
                    <div className={styles.dbProgressFill} style={{ width: '62%' }}></div>
                  </div>
                  <span className={styles.dbDeptPercent}>62%</span>
                </div>

                <div className={styles.dbDeptProgressRow}>
                  <span className={styles.dbDeptName}>Operations</span>
                  <div className={styles.dbProgressBar}>
                    <div className={styles.dbProgressFill} style={{ width: '78%' }}></div>
                  </div>
                  <span className={styles.dbDeptPercent}>78%</span>
                </div>
              </div>

              {/* AI Summary Banner */}
              <div className={styles.dbAiSummaryRow}>
                <div className={styles.dbAiHeader}>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>AI Summary</span>
                </div>
                <p className={styles.dbAiText}>
                  Tech Team frontend implementation aligns well. Operations shows copywriter blocker.
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
