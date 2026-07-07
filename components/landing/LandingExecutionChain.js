import styles from './Landing.module.css';

const chainItems = [
  { step: '01', title: 'Goals', text: 'define the outcome.' },
  { step: '02', title: 'Plans', text: 'define the direction.' },
  { step: '03', title: 'Tasks', text: 'define the action.' },
  { step: '04', title: 'Reports', text: 'prove the work.' },
  { step: '05', title: 'AI', text: 'explains the progress.' },
];

export default function LandingExecutionChain() {
  return (
    <section id="execution-chain" className={styles.sectionChain}>
      <div className={styles.sectionInner}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Execution Chain</span>
          <h2 className={styles.sectionTitle}>From intention to evidence.</h2>
          <p className={styles.sectionDesc}>
            A cohesive operational cycle that connects high-level milestones with daily contributors, using structured execution tracking to eliminate guesswork.
          </p>
        </div>

        <div className={styles.chainTimelineWrapper}>
          <div className={styles.chainTimelineLine} aria-hidden="true" />
          <div className={styles.chainTimelineGrid}>
            {chainItems.map((item, index) => (
              <div key={item.step} className={styles.chainNode}>
                <div className={styles.chainNodeHeader}>
                  <div className={styles.chainNodeNumber}>{item.step}</div>
                  <h3 className={styles.chainNodeTitle}>{item.title}</h3>
                </div>
                <p className={styles.chainNodeText}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
