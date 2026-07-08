import { Plus, X } from 'lucide-react';
import styles from './Company.module.css';

/**
 * Dynamic list input for managing expected outcomes (title + target + completed flag).
 * Outputs a JSON-compatible array: [{ title, target, completed }]
 */
export default function ExpectedOutcomesListInput({ value = [], onChange }) {
  function handleAdd() {
    onChange([...value, { title: '', target: '', completed: false }]);
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
        <label className={styles.label}>Expected Outcomes</label>
        <button type="button" className={styles.addBtn} onClick={handleAdd}>
          <Plus className="w-3.5 h-3.5" />
          Add Outcome
        </button>
      </div>

      {value.length === 0 && (
        <p className={styles.emptyText}>
          No expected outcomes added yet. Click &quot;Add Outcome&quot; to define measurable outcomes.
        </p>
      )}

      {value.map((item, index) => (
        <div key={index} className={styles.listItem}>
          <div className={styles.listItemFields}>
            <input
              type="text"
              className={styles.listItemSmallInput}
              placeholder={`Outcome ${index + 1} title`}
              value={item.title}
              onChange={(e) => handleChange(index, 'title', e.target.value)}
            />
            <input
              type="text"
              className={styles.listItemSmallInput}
              placeholder="Measurable target"
              value={item.target}
              onChange={(e) => handleChange(index, 'target', e.target.value)}
            />
            <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--color-muted)' }}>
              <input
                type="checkbox"
                checked={item.completed || false}
                onChange={(e) => handleChange(index, 'completed', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              Mark as completed
            </label>
          </div>
          <button
            type="button"
            className={styles.removeBtn}
            onClick={() => handleRemove(index)}
            aria-label={`Remove outcome ${index + 1}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
