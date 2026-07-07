import { 
  BarChart3, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  FileText, 
  TrendingUp, 
  ChevronRight, 
  Search, 
  Bell, 
  LayoutDashboard, 
  Target, 
  ArrowRight,
  ClipboardList
} from 'lucide-react';
import Link from 'next/link';
import styles from './Landing.module.css';

export default function LandingDashboardPreview() {
  return (
    <section className={styles.sectionPreview}>
      <div className={styles.sectionInner}>
        <div className={styles.sectionHeaderLeft}>
          <span className={styles.sectionTag}>Product Preview</span>
          <h2 className={styles.sectionTitle}>One place for reports, tasks, goals, and review.</h2>
          <p className={styles.sectionDesc}>
            Instead of scattered WhatsApp updates, forgotten tasks, and unclear progress, 
            Report OS gives every department a structured place to document work and review execution.
          </p>
        </div>

        {/* Realistic Dashboard Mockup */}
        <div className={styles.dashboardMockupContainer}>
          {/* Main Dashboard Layout */}
          <div className={styles.mockupApp}>
            {/* Sidebar */}
            <aside className={styles.mockupSidebar}>
              <div className={styles.sidebarHeader}>
                <div className={styles.sidebarLogo}></div>
                <span className={styles.sidebarTitle}>Report OS</span>
              </div>
              <nav className={styles.sidebarNav}>
                <div className={`${styles.sidebarNavItem} ${styles.sidebarNavItemActive}`}>
                  <LayoutDashboard className="w-4 h-4" /> <span>Dashboard</span>
                </div>
                <div className={styles.sidebarNavItem}>
                  <FileText className="w-4 h-4" /> <span>Reports</span>
                </div>
                <div className={styles.sidebarNavItem}>
                  <ClipboardList className="w-4 h-4" /> <span>Tasks</span>
                </div>
                <div className={styles.sidebarNavItem}>
                  <Target className="w-4 h-4" /> <span>Goals</span>
                </div>
                <div className={styles.sidebarNavItem}>
                  <Layers className="w-4 h-4" /> <span>Departments</span>
                </div>
              </nav>
              <div className={styles.sidebarFooter}>
                <div className={styles.sidebarUser}>
                  <div className={styles.sidebarAvatar}>AO</div>
                  <div className={styles.sidebarUserInfo}>
                    <p className={styles.sidebarUserName}>Ayodeji O.</p>
                    <p className={styles.sidebarUserRole}>Operations Lead</p>
                  </div>
                </div>
              </div>
            </aside>

            {/* Main Content Area */}
            <main className={styles.mockupMain}>
              {/* Header */}
              <header className={styles.mockupHeader}>
                <div className={styles.mockupSearch}>
                  <Search className="w-4 h-4 text-slate-400" />
                  <span className={styles.mockupSearchPlaceholder}>Search reports, tasks, or updates...</span>
                </div>
                <div className={styles.mockupHeaderActions}>
                  <Bell className="w-4 h-4 text-slate-400" />
                  <div className={styles.mockupStatusIndicator}>
                    <span className={styles.mockupStatusDot}></span>
                    <span className={styles.mockupStatusText}>Workspace Live</span>
                  </div>
                </div>
              </header>

              {/* Grid content inside dashboard */}
              <div className={styles.mockupDashboardGrid}>
                {/* Stats Row */}
                <div className={styles.mockupStatsRow}>
                  <div className={styles.mockupStatCard}>
                    <div className={styles.mockupStatHeader}>
                      <span className={styles.mockupStatTitle}>Reports Today</span>
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className={styles.mockupStatVal}>12</p>
                    <span className={styles.mockupStatSub}>100% submission rate</span>
                  </div>

                  <div className={styles.mockupStatCard}>
                    <div className={styles.mockupStatHeader}>
                      <span className={styles.mockupStatTitle}>Tasks Complete</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className={styles.mockupStatVal}>8</p>
                    <span className={styles.mockupStatSub}>Due this week</span>
                  </div>

                  <div className={styles.mockupStatCard}>
                    <div className={styles.mockupStatHeader}>
                      <span className={styles.mockupStatTitle}>Needs Review</span>
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                    </div>
                    <p className={styles.mockupStatVal}>3</p>
                    <span className={styles.mockupStatSub}>Requires review</span>
                  </div>

                  <div className={styles.mockupStatCard}>
                    <div className={styles.mockupStatHeader}>
                      <span className={styles.mockupStatTitle}>Task Alignment</span>
                      <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <p className={styles.mockupStatVal}>74%</p>
                    <span className={styles.mockupStatSub}>Average score today</span>
                  </div>
                </div>

                {/* Split layout: Reports and Insights */}
                <div className={styles.mockupContentSplit}>
                  {/* Left: Reports list */}
                  <div className={styles.mockupReportsPanel}>
                    <div className={styles.mockupPanelHeader}>
                      <h3 className={styles.mockupPanelTitle}>Recent Team Reports</h3>
                      <span className={styles.mockupPanelLink}>View all <ChevronRight className="w-3 h-3" /></span>
                    </div>
                    <div className={styles.mockupTableWrapper}>
                      <table className={styles.mockupTable}>
                        <thead>
                          <tr>
                            <th>Contributor</th>
                            <th>Department</th>
                            <th>Report Summary</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>
                              <div className={styles.tableUser}>
                                <div className={styles.tableAvatar}>CE</div>
                                <span>Chinedu E.</span>
                              </div>
                            </td>
                            <td><span className={styles.badgeTech}>Technology</span></td>
                            <td>
                              <p className={styles.tableReportText}>Completed frontend landing page implementation and hooked up components.</p>
                            </td>
                            <td><span className={styles.badgeSuccess}>Completed</span></td>
                          </tr>
                          <tr>
                            <td>
                              <div className={styles.tableUser}>
                                <div className={styles.tableAvatar}>TA</div>
                                <span>Tunde A.</span>
                              </div>
                            </td>
                            <td><span className={styles.badgeCreative}>Creative</span></td>
                            <td>
                              <p className={styles.tableReportText}>Redesigned layout wireframes. Awaiting client review on copy assets.</p>
                            </td>
                            <td><span className={styles.badgeWarning}>Blocked</span></td>
                          </tr>
                          <tr>
                            <td>
                              <div className={styles.tableUser}>
                                <div className={styles.tableAvatar}>FA</div>
                                <span>Funmi A.</span>
                              </div>
                            </td>
                            <td><span className={styles.badgeOps}>Operations</span></td>
                            <td>
                              <p className={styles.tableReportText}>Drafted weekly project schedule. Checked milestones with development leads.</p>
                            </td>
                            <td><span className={styles.badgeReview}>In Review</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right: AI insights & Department Progress */}
                  <div className={styles.mockupInsightsPanel}>
                    <div className={styles.mockupPanelHeader}>
                      <h3 className={styles.mockupPanelTitle}>AI Analysis Recommendations</h3>
                    </div>
                    <div className={styles.aiInsightsBox}>
                      <div className={styles.aiInsightItem}>
                        <div className={styles.aiInsightHeader}>
                          <span className={styles.aiInsightTagWarning}>Blocker Detected</span>
                          <span className={styles.aiInsightTime}>10m ago</span>
                        </div>
                        <p className={styles.aiInsightText}>
                          Creative department is currently blocked on the <strong>Landing page wireframe</strong> task due to <em>client content update</em>.
                        </p>
                        <div className={styles.aiInsightAction}>
                          <strong>Next Action:</strong> Assign content approval before next cycle.
                        </div>
                      </div>

                      <div className={styles.aiInsightItem}>
                        <div className={styles.aiInsightHeader}>
                          <span className={styles.aiInsightTagSuccess}>Alignment High</span>
                          <span className={styles.aiInsightTime}>1h ago</span>
                        </div>
                        <p className={styles.aiInsightText}>
                          Technology Team reports show <strong>94% alignment</strong> with the assigned Q3 frontend roadmap.
                        </p>
                      </div>
                    </div>

                    <div className={styles.mockupDeptProgressBox}>
                      <h4 className={styles.mockupSubTitle}>Department Progress</h4>
                      <div className={styles.deptProgressItem}>
                        <div className={styles.deptProgressHeader}>
                          <span>Technology</span>
                          <strong>84%</strong>
                        </div>
                        <div className={styles.deptProgressBar}><div className={styles.deptProgressFill} style={{ width: '84%' }}></div></div>
                      </div>
                      <div className={styles.deptProgressItem}>
                        <div className={styles.deptProgressHeader}>
                          <span>Creative</span>
                          <strong>62%</strong>
                        </div>
                        <div className={styles.deptProgressBar}><div className={styles.deptProgressFill} style={{ width: '62%' }}></div></div>
                      </div>
                      <div className={styles.deptProgressItem}>
                        <div className={styles.deptProgressHeader}>
                          <span>Operations</span>
                          <strong>78%</strong>
                        </div>
                        <div className={styles.deptProgressBar}><div className={styles.deptProgressFill} style={{ width: '78%' }}></div></div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </main>
          </div>
        </div>
      </div>
    </section>
  );
}
