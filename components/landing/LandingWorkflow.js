import { 
  Terminal, 
  Palette, 
  ClipboardCheck, 
  Search, 
  Sparkles, 
  Clock, 
  AlertCircle 
} from 'lucide-react';
import styles from './Landing.module.css';

const workflowSteps = [
  {
    step: '1',
    role: 'Frontend Developer',
    icon: Terminal,
    title: 'Daily execution logging',
    desc: 'Submits a structured report at the end of the day, specifying exactly what was built, what remains pending, and what is currently blocked.',
    example: {
      content: 'Completed auth middleware integration. Blocked by API access credentials for the staging env.',
      badge: 'Technology Team',
      badgeClass: styles.wfBadgeTech
    }
  },
  {
    step: '2',
    role: 'Product Designer',
    icon: Palette,
    title: 'Task-linked progress',
    desc: 'Connects their operational update to an assigned Jira/Trello UI task so progress aligns with active milestones.',
    example: {
      content: 'Exported final SVG assets for design system. Task: Core Component Layout Redesign.',
      badge: 'Creative Team',
      badgeClass: styles.wfBadgeCreative
    }
  },
  {
    step: '3',
    role: 'Team Lead',
    icon: ClipboardCheck,
    title: 'Review blockers early',
    desc: 'Reviews automated blockers and risk signals from the team page, resolving dependencies before the morning standup.',
    example: {
      content: 'Awaiting content copy review. Action: Assigned copy review task to Content Team.',
      badge: 'Operations',
      badgeClass: styles.wfBadgeOps
    }
  },
  {
    step: '4',
    role: 'Workspace Admin',
    icon: Search,
    title: 'Track department health',
    desc: 'Sees a clear heatmap of department completion rates, review status, and task alignment without chasing updates.',
    example: {
      content: 'Review status: 94% reports logged, 0 critical blockers active.',
      badge: 'Management',
      badgeClass: styles.wfBadgeAdmin
    }
  },
  {
    step: '5',
    role: 'Report OS AI',
    icon: Sparkles,
    title: 'Intelligent summaries',
    desc: 'Processes all daily submissions to extract insights, flag potential risks, and generate clear status updates for management.',
    example: {
      content: 'AI Summary: Tech Team output is high. Operations reports minor content bottleneck.',
      badge: 'AI Assistant',
      badgeClass: styles.wfBadgeAI
    }
  }
];

export default function LandingWorkflow() {
  return (
    <section id="workflow" className={styles.sectionWorkflow}>
      <div className={styles.sectionInner}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Operational Flow</span>
          <h2 className={styles.sectionTitle}>Built around how real teams actually work.</h2>
          <p className={styles.sectionDesc}>
            Some updates happen after meetings. Some happen late in the day. 
            Some are blocked by content, design approval, client feedback, or missing access. 
            Report OS helps the team document the work clearly, so leads know what needs 
            attention before it becomes a bigger delay.
          </p>
        </div>

        <div className={styles.workflowTimeline}>
          {workflowSteps.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.step} className={styles.workflowRow}>
                {/* Visual Step Marker */}
                <div className={styles.workflowTimelineCol}>
                  <div className={styles.timelineNode}>
                    <Icon className="w-5 h-5" />
                  </div>
                  {index < workflowSteps.length - 1 && (
                    <div className={styles.timelineConnector}></div>
                  )}
                </div>

                {/* Text Context */}
                <div className={styles.workflowContentCol}>
                  <div className={styles.workflowStepLabel}>
                    <span>Step {item.step}</span> · <strong>{item.role}</strong>
                  </div>
                  <h3 className={styles.workflowStepTitle}>{item.title}</h3>
                  <p className={styles.workflowStepDesc}>{item.desc}</p>
                </div>

                {/* Example Card representation */}
                <div className={styles.workflowCardCol}>
                  <div className={styles.workflowLiveCard}>
                    <div className={styles.workflowCardHeader}>
                      <span className={item.badgeClass}>{item.badge}</span>
                      <span className={styles.workflowCardTime}><Clock className="w-3 h-3" /> Today</span>
                    </div>
                    <p className={styles.workflowCardText}>&ldquo;{item.example.content}&rdquo;</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
