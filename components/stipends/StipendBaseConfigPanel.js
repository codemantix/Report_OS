import { useEffect, useState } from 'react';
import { Plus, Settings2, X } from 'lucide-react';
import styles from './Stipends.module.css';

const EMPTY = {
  name: '', amount: '', currency: 'USD', effectiveFrom: '', effectiveTo: '',
  status: 'active', departmentId: '', employeeId: '',
};

export default function StipendBaseConfigPanel({ configs, options, canManage, saving, onSave }) {
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) setValues(EMPTY);
  }, [editing]);

  function begin(config = null) {
    setError('');
    setEditing(config || { id: null });
    setValues(config ? {
      id: config.id,
      name: config.name,
      amount: config.amount,
      currency: config.currency,
      effectiveFrom: config.effective_from,
      effectiveTo: config.effective_to || '',
      status: config.status,
      departmentId: config.department_id || '',
      employeeId: config.employee_id || '',
    } : EMPTY);
  }

  function update(name, value) {
    setValues((current) => ({
      ...current,
      [name]: value,
      ...(name === 'departmentId' ? { employeeId: '' } : {}),
      ...(name === 'employeeId' ? { departmentId: '' } : {}),
    }));
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (!values.name.trim() || !values.amount || !values.effectiveFrom) {
      setError('Name, amount, and effective start date are required.');
      return;
    }
    const result = await onSave(values);
    if (result?.error) setError(result.error.message);
    else setEditing(null);
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div><h2>Base stipend configurations</h2><p>Employee overrides take priority over department and global amounts.</p></div>
        {canManage && <button type="button" className={styles.secondaryButton} onClick={() => begin()}><Plus aria-hidden="true" /> Add base stipend</button>}
      </div>
      {editing && (
        <form className={styles.configForm} onSubmit={submit}>
          <div className={styles.formTitle}><strong>{editing.id ? 'Update configuration' : 'New base stipend'}</strong><button type="button" onClick={() => setEditing(null)} aria-label="Close form"><X /></button></div>
          <div className={styles.formGrid}>
            <label><span>Name</span><input maxLength="160" value={values.name} onChange={(event) => update('name', event.target.value)} /></label>
            <label><span>Amount</span><input type="number" min="0.01" step="0.01" value={values.amount} onChange={(event) => update('amount', event.target.value)} /></label>
            <label><span>Currency</span><input maxLength="3" value={values.currency} onChange={(event) => update('currency', event.target.value.toUpperCase())} /></label>
            <label><span>Department scope</span><select value={values.departmentId} disabled={Boolean(editing.id)} onChange={(event) => update('departmentId', event.target.value)}><option value="">Global</option>{options.departments.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}</select></label>
            <label><span>Employee override</span><select value={values.employeeId} disabled={Boolean(editing.id)} onChange={(event) => update('employeeId', event.target.value)}><option value="">None</option>{options.employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.full_name || employee.display_name || employee.email}</option>)}</select></label>
            <label><span>Effective from</span><input type="date" value={values.effectiveFrom} onChange={(event) => update('effectiveFrom', event.target.value)} disabled={Boolean(editing.id)} /></label>
            <label><span>Effective to</span><input type="date" value={values.effectiveTo} onChange={(event) => update('effectiveTo', event.target.value)} /></label>
            <label><span>Status</span><select value={values.status} onChange={(event) => update('status', event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          </div>
          {error && <p className={styles.formError}>{error}</p>}
          <div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={() => setEditing(null)}>Cancel</button><button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? 'Saving…' : 'Save configuration'}</button></div>
        </form>
      )}
      {configs.length === 0 ? <p className={styles.empty}>No base stipend configurations exist yet.</p> : <div className={styles.configList}>{configs.map((config) => <article key={config.id}><div><strong>{config.name}</strong><p>{config.employee ? `Employee · ${config.employee.full_name || config.employee.display_name}` : config.department ? `Department · ${config.department.name}` : 'Global default'}</p><small>{config.effective_from}{config.effective_to ? ` to ${config.effective_to}` : ' onward'} · {config.status}</small></div><div className={styles.configAmount}><strong>{config.currency} {Number(config.amount).toLocaleString()}</strong>{canManage && <button type="button" onClick={() => begin(config)}><Settings2 aria-hidden="true" /> Edit</button>}</div></article>)}</div>}
    </section>
  );
}
