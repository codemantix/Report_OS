import { 
  MessageSquareOff, 
  UserCheck, 
  Zap, 
  Eye, 
  TrendingUp, 
  History 
} from 'lucide-react';
import styles from './Landing.module.css';

const benefits = [
  { 
    icon: MessageSquareOff, 
    title: 'Less scattered reporting', 
    desc: 'No more losing important updates inside chats. Centralize work status in a structured execution repository.' 
  },
  { 
    icon: UserCheck, 
    title: 'Better accountability', 
    desc: 'Each team member has a clear, unalterable email-confirmed record of submitted work and blockers.' 
  },
  { 
    icon: Zap, 
    title: 'Faster admin review', 
    desc: 'AI digests daily submissions, bubbling up risk ratings and blocker summaries for swift management response.' 
  },
  { 
    icon: Eye, 
    title: 'Clearer department progress', 
    desc: 'Admins and leads can see how technology, design, or marketing departments are executing against plans.' 
  },
  { 
    icon: TrendingUp, 
    title: 'Stronger execution culture', 
    desc: 'Keep daily tasks, long-term goals, and team reports connected so everyone knows the direct impact of their work.' 
  },
  { 
    icon: History, 
    title: 'Better performance history', 
    desc: 'Historical reports serve as objective reference points for performance reviews, project planning, and retrospectives.' 
  },
];

export default function LandingBenefits() {
  return (
    <section id="benefits" className={styles.sectionBenefits}>
      <div className={styles.sectionInner}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Platform Impact</span>
          <h2 className={styles.sectionTitle}>The reporting layer your team can actually use every day.</h2>
          <p className={styles.sectionDesc}>
            Designed for execution integrity. No bloated metrics—just clean, traceable operational records that help modern African teams scale confidence.
          </p>
        </div>

        <div className={styles.benefitsGridPremium}>
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div key={benefit.title} className={styles.benefitCardPremium}>
                <div className={styles.benefitIconBox}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className={styles.benefitTitleText}>{benefit.title}</h3>
                <p className={styles.benefitDescText}>{benefit.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
