import { Plus, X } from 'lucide-react';
import styles from './Company.module.css';

/**
 * Dynamic list input for managing objectives (title + description pairs).
 * Outputs a JSON-compatible array: [{ title, description }]
 */
export default function ObjectivesListInput({ value = [], onChange }) {
  function handleAdd() {
    onChange([...value, { title: '', description: '' }]);
  }

  function handleRemove(index) {
    onChange(value.filter((_, i) => i !== index));
  }

  function handleChange(index, field, fieldValue) {
    const updated = value.map((item, i) =>
      i === index ? { ...item, [field]: fieldValue } : item
    );
    onChange(updated);
  }

  return (
    <div className={styles.listInput}>
      <div className={styles.listInputHeader}>
        <label className={styles.label}>Objectives</label>
        <button type="button" className={styles.addBtn} onClick={handleAdd}>
          <Plus className="w-3.5 h-3.5" />
          Add Objective
        </button>
      </div>

      {value.length === 0 && (
        <p className={styles.emptyText}>
          No objectives added yet. Click &quot;Add Objective&quot; to define strategic objectives for this goal.
        </p>
      )}

      {value.map((item, index) => (
        <div key={index} className={styles.listItem}>
          <div className={styles.listItemFields}>
            <input
              type="text"
              className={styles.listItemSmallInput}
              placeholder={`Objective ${index + 1} title`}
              value={item.title}
              onChange={(e) => handleChange(index, 'title', e.target.value)}
            />
            <input
              type="text"
              className={styles.listItemSmallInput}
              placeholder="Brief description"
              value={item.description}
              onChange={(e) => handleChange(index, 'description', e.target.value)}
            />
          </div>
          <button
            type="button"
            className={styles.removeBtn}
            onClick={() => handleRemove(index)}
            aria-label={`Remove objective ${index + 1}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
