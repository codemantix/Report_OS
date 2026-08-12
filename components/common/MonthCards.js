import { useMemo } from 'react';
import { ArrowUpRight, CalendarDays, Layers3 } from 'lucide-react';
import { MONTH_NAMES } from '../../utils/companyGoalConstants';
import styles from './MonthCards.module.css';

/**
 * MonthCards – an "all items" overview card plus one card per month, grouped by
 * a date field on each item. Used by the Tasks, Goals, and Plans pages to
 * browse items by their due/end month.
 *
 * Props:
 *  - items              : array of items to group by month
 *  - dateField          : item field holding the ISO date to group by (e.g. 'due_date')
 *  - selectedMonth      : currently selected month (1-12) or ''
 *  - selectedYear       : currently selected year or ''
 *  - onSelectMonth      : fn(month, year) – called when a card is clicked
 *  - sectionId          : id used for aria-labelledby on the section heading
 *  - sectionTitle       : e.g. "Tasks by due month"
 *  - sectionDescription : e.g. "Select a month to show its tasks in the table."
 *  - allLabel           : label on the overview card, e.g. "All tasks"
 *  - allDescription     : subtitle on the overview card
 *  - itemLabel          : singular item name, e.g. "task"
 *  - itemsLabel         : plural item name, e.g. "tasks"
 *  - monthLabel         : status text on month cards, e.g. "Due month"
 *  - periodPhrase       : aria-label phrase, e.g. "due in" or "ending in"
 */
export default function MonthCards({
  items,
  dateField = 'due_date',
  selectedMonth,
  selectedYear,
  onSelectMonth,
  sectionId = 'month-cards-title',
  sectionTitle = 'Items by month',
  sectionDescription = 'Select a month to show its items in the table.',
  allLabel = 'All items',
  allDescription = 'Complete overview',
  itemLabel = 'item',
  itemsLabel = 'items',
  monthLabel = 'Due month',
  periodPhrase = 'due in',
}) {
  const monthGroups = useMemo(() => {
    const groups = new Map();

    items.forEach((item) => {
      const dateStr = item?.[dateField];
      if (!dateStr) return;

      const date = new Date(dateStr);
      if (Number.isNaN(date.getTime())) return;

      const month = date.getUTCMonth() + 1;
      const year = date.getUTCFullYear();
      const key = `${year}-${month}`;
      const existingGroup = groups.get(key);

      if (existingGroup) {
        existingGroup.count += 1;
      } else {
        groups.set(key, { key, month, year, count: 1 });
      }
    });

    return Array.from(groups.values()).sort((a, b) => a.year - b.year || a.month - b.month);
  }, [items, dateField]);

  if (monthGroups.length === 0) return null;

  const isShowingAllItems = !selectedMonth && !selectedYear;

  return (
    <section className={styles.monthSection} aria-labelledby={sectionId}>
      <div className={styles.monthSectionHeader}>
        <div className={styles.monthSectionHeading}>
          <span className={styles.monthSectionIcon} aria-hidden="true">
            <CalendarDays size={18} strokeWidth={1.8} />
          </span>
          <div>
            <h2 id={sectionId} className={styles.monthSectionTitle}>{sectionTitle}</h2>
            <p className={styles.monthSectionDescription}>{sectionDescription}</p>
          </div>
        </div>
      </div>

      <div className={styles.monthCards}>
        <button
          type="button"
          className={`${styles.monthCard} ${isShowingAllItems ? styles.monthCardActive : ''}`}
          onClick={() => onSelectMonth('', '')}
          aria-pressed={isShowingAllItems}
        >
          <span className={styles.monthCardGlow} aria-hidden="true" />
          <span className={styles.monthCardTop}>
            <span className={styles.monthCardIcon} aria-hidden="true">
              <Layers3 size={17} strokeWidth={1.8} />
            </span>
            <span className={styles.monthCardStatus}>{isShowingAllItems ? 'Selected' : 'Overview'}</span>
          </span>
          <span className={styles.monthCardContent}>
            <span className={styles.monthCardLabel}>{allLabel}</span>
            <span className={styles.monthCardYear}>{allDescription}</span>
          </span>
          <span className={styles.monthCardFooter}>
            <span className={styles.monthCardCount}><strong>{items.length}</strong> {items.length === 1 ? itemLabel : itemsLabel}</span>
            <ArrowUpRight className={styles.monthCardArrow} size={16} aria-hidden="true" />
          </span>
        </button>

        {monthGroups.map((group) => {
          const isActive = Number(selectedMonth) === group.month && Number(selectedYear) === group.year;

          return (
            <button
              key={group.key}
              type="button"
              className={`${styles.monthCard} ${isActive ? styles.monthCardActive : ''}`}
              onClick={() => onSelectMonth(String(group.month), String(group.year))}
              aria-pressed={isActive}
              aria-label={`Show ${group.count} ${group.count === 1 ? itemLabel : itemsLabel} ${periodPhrase} ${MONTH_NAMES[group.month - 1]} ${group.year}`}
            >
              <span className={styles.monthCardGlow} aria-hidden="true" />
              <span className={styles.monthCardTop}>
                <span className={styles.monthCardIcon} aria-hidden="true">
                  <CalendarDays size={17} strokeWidth={1.8} />
                </span>
                <span className={styles.monthCardStatus}>{isActive ? 'Selected' : monthLabel}</span>
              </span>
              <span className={styles.monthCardContent}>
                <span className={styles.monthCardLabel}>{MONTH_NAMES[group.month - 1]}</span>
                <span className={styles.monthCardYear}>{group.year}</span>
              </span>
              <span className={styles.monthCardFooter}>
                <span className={styles.monthCardCount}><strong>{group.count}</strong> {group.count === 1 ? itemLabel : itemsLabel}</span>
                <ArrowUpRight className={styles.monthCardArrow} size={16} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
