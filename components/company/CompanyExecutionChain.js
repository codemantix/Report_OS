import {
  Landmark,
  Target as TargetIcon,
  CheckCircle2,
  Building2,
  ClipboardList,
  CheckSquare,
  FileText,
  Bot,
} from 'lucide-react';
import styles from './Company.module.css';

const CHAIN_STEPS = [
  { label: 'Company Goal', icon: Landmark, key: 'company_goal' },
  { label: 'Objective', icon: TargetIcon, key: 'objective' },
  { label: 'Expected Outcome', icon: CheckCircle2, key: 'expected_outcome' },
  { label: 'Department Goal', icon: Building2, key: 'department_goal' },
  { label: 'Plan', icon: ClipboardList, key: 'plan' },
  { label: 'Task', icon: CheckSquare, key: 'task' },
  { label: 'Report', icon: FileText, key: 'report' },
  { label: 'AI Review', icon: Bot, key: 'ai_review' },
];

/**
 * Visual execution chain showing the strategic hierarchy.
 * Optionally highlights the active step.
 */
export default function CompanyExecutionChain({ activeStep = null }) {
  return (
    <div className={styles.chainWrapper}>
      {CHAIN_STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = step.key === activeStep;
        const nodeClass = isActive ? styles.chainNodeActive : styles.chainNode;

        return (
          <div key={step.key} className="flex flex-col items-center">
            {index > 0 && <div className={styles.chainConnector} />}
            <div className={nodeClass}>
              <Icon className={styles.chainIcon} />
              <span>{step.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
