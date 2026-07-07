import { Sparkles, CheckCircle2, Shield, Target, FileText, BarChart3, AlertCircle } from 'lucide-react';
import styles from './Landing.module.css';

export default function LandingAIReview() {
  return (
    <section id="ai-review" className={styles.sectionAIReview}>
      <div className={styles.sectionInner}>
        <div className={styles.aiReviewContainer}>
          <div className={styles.aiReviewText}>
            <span className={styles.sectionTag}>AI Assistance</span>
            <h2 className={styles.sectionTitle}>AI review without the noise.</h2>
            <p className={styles.sectionDesc}>
              Every report is analyzed for clarity, task alignment, goal alignment, blockers, risk level, and recommended next action. The goal is not to replace leadership judgment, but to help admins and team leads review faster.
            </p>
            <p className={styles.sectionDescSecondary}>
              By highlighting alignment discrepancies and surface-level dependencies automatically, Report OS reduces review overhead, giving leads direct context before they step into standups.
            </p>
          </div>

          <div className={styles.aiReviewVisual}>
            <div className={styles.aiReviewCard}>
              <div className={styles.aiCardHeader}>
                <div className={styles.aiHeaderTitleWrap}>
                  <Sparkles className="w-5 h-5 text-indigo-500" />
                  <span className={styles.aiHeaderTitle}>AI Report Audit</span>
                </div>
                <span className={styles.aiHeaderTag}>Review complete</span>
              </div>

              {/* Source Report snippet */}
              <div className={styles.aiSourceReport}>
                <div className={styles.aiSourceHeader}>
                  <span>Original Submission · Creative Team</span>
                </div>
                <p className={styles.aiSourceText}>
                  &ldquo;Finished setting up landing page wireframes and styled CSS grids. We are currently stuck awaiting the copywriter to provide final homepage copy blocks.&rdquo;
                </p>
              </div>

              {/* AI Analysis Details */}
              <div className={styles.aiAnalysisPanel}>
                <div className={styles.aiAnalysisTitle}>Analysis Details</div>
                
                <div className={styles.aiAnalysisItem}>
                  <div className={styles.aiLabel}>Summary</div>
                  <p className={styles.aiValue}>Completed CSS grid layout for landing page. Current blocker is missing copy elements.</p>
                </div>

                <div className={styles.aiSplitRow}>
                  <div className={styles.aiAnalysisItem}>
                    <div className={styles.aiLabel}>Completed Work</div>
                    <ul className={styles.aiList}>
                      <li>Landing page wireframes layout</li>
                      <li>CSS Grids styling</li>
                    </ul>
                  </div>
                  <div className={styles.aiAnalysisItem}>
                    <div className={styles.aiLabel}>Pending Work</div>
                    <ul className={styles.aiList}>
                      <li>Inserting homepage copy content</li>
                    </ul>
                  </div>
                </div>

                {/* Blocker alert box */}
                <div className={styles.aiAlertBox}>
                  <div className={styles.aiAlertHeader}>
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                    <strong>Blocker Detected</strong>
                  </div>
                  <p className={styles.aiAlertDesc}>Awaiting final homepage copy.</p>
                </div>

                {/* Suggested Next Action */}
                <div className={styles.aiActionBox}>
                  <div className={styles.aiActionHeader}>
                    <strong>Suggested Next Action</strong>
                  </div>
                  <p className={styles.aiActionDesc}>Assign content approval before the next implementation cycle.</p>
                </div>

                {/* Metrics */}
                <div className={styles.aiMetricGrid}>
                  <div className={styles.aiMetricCard}>
                    <div className={styles.aiMetricHeader}>
                      <Shield className="w-4 h-4 text-orange-500" />
                      <span>Risk Level</span>
                    </div>
                    <div className={styles.aiMetricValBad}>Medium</div>
                  </div>

                  <div className={styles.aiMetricCard}>
                    <div className={styles.aiMetricHeader}>
                      <Target className="w-4 h-4 text-emerald-500" />
                      <span>Task Alignment</span>
                    </div>
                    <div className={styles.aiMetricVal}>88%</div>
                  </div>

                  <div className={styles.aiMetricCard}>
                    <div className={styles.aiMetricHeader}>
                      <FileText className="w-4 h-4 text-blue-500" />
                      <span>Report Quality</span>
                    </div>
                    <div className={styles.aiMetricVal}>92%</div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
