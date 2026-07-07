import { Shield, Users, User } from 'lucide-react';
import styles from './Landing.module.css';

const roles = [
  {
    icon: Shield,
    iconClass: styles.roleIconAdmin,
    title: 'Admins',
    desc: 'See reports, departments, task progress, review status, and AI recommendations from one calm dashboard.',
  },
  {
    icon: Users,
    iconClass: styles.roleIconLead,
    title: 'Team Leads',
    desc: 'Assign tasks, review blockers, guide execution, and keep department work connected to goals.',
  },
  {
    icon: User,
    iconClass: styles.roleIconMember,
    title: 'Team Members',
    desc: 'Submit reports, keep email records, see assigned tasks, and document work without stress.',
  },
];

export default function LandingRoles() {
  return (
    <section id="roles" className={styles.sectionRoles}>
      <div className={styles.sectionInner}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>Roles</span>
          <h2 className={styles.sectionTitle}>Clarity for every responsibility.</h2>
          <p className={styles.sectionDesc}>
            Designed for the specific needs of founders, team leads, and direct contributors to enable high accountability without micromanagement.
          </p>
        </div>

        <div className={styles.rolesGridCompact}>
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <div key={role.title} className={styles.roleCardCompact}>
                <div className={`${styles.roleIconBox} ${role.iconClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className={styles.roleTitleCompact}>{role.title}</h3>
                <p className={styles.roleDescCompact}>{role.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
