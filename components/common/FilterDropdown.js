import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal } from 'lucide-react';
import styles from './FilterDropdown.module.css';

// Avoids the "useLayoutEffect does nothing on the server" warning during SSR.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * FilterGroup – a labelled wrapper for a single filter control inside FilterDropdown.
 * Usage: <FilterGroup label="Status"><select ...>...</select></FilterGroup>
 * fullWidth spans both columns of the 2-col grid.
 */
export function FilterGroup({ label, children, fullWidth = false }) {
  return (
    <div className={`${styles.filterGroup} ${fullWidth ? styles.filterGroupFull : ''}`}>
      <span className={styles.filterLabel}>{label}</span>
      {children}
    </div>
  );
}

/**
 * FilterDropdown – compact filter-icon button that reveals a dropdown panel.
 *
 * The panel is rendered in a portal (document.body) and positioned with
 * `position: fixed` based on the trigger button's bounding rect. This keeps
 * it completely out of the page's normal layout flow so opening/closing it
 * never changes document height or triggers scrollbar-driven layout shift.
 *
 * Props:
 *  - children        : FilterGroup nodes (the actual filter controls)
 *  - hasActiveFilters: boolean – highlight button when filters are applied
 *  - activeCount     : number  – badge count shown on the button
 *  - onClear         : fn      – called when "Clear Filters" footer button is pressed
 */
export default function FilterDropdown({
  children,
  hasActiveFilters = false,
  activeCount = 0,
  onClear,
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  function updateCoords() {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const panelWidth = panelRef.current?.offsetWidth || 420;
    const viewportWidth = window.innerWidth;

    let left = rect.left;
    if (left + panelWidth > viewportWidth - 16) {
      left = Math.max(16, viewportWidth - panelWidth - 16);
    }

    setCoords({ top: rect.bottom + 8, left });
  }

  useIsomorphicLayoutEffect(() => {
    if (!open) return;
    updateCoords();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e) {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target) &&
        panelRef.current &&
        !panelRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    function handleReposition() {
      updateCoords();
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open]);

  function handleClear() {
    if (onClear) onClear();
    setOpen(false);
  }

  return (
    <div className={styles.container}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          styles.triggerBtn,
          open ? styles.triggerBtnOpen : '',
          hasActiveFilters ? styles.triggerBtnActive : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label="Toggle filters"
        aria-expanded={open}
      >
        <SlidersHorizontal className={styles.triggerIcon} />
        <span>Filters</span>
        {hasActiveFilters && activeCount > 0 && (
          <span className={styles.badge}>{activeCount}</span>
        )}
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            className={styles.dropdown}
            style={{ top: coords.top, left: coords.left }}
          >
            <div className={styles.filtersGrid}>{children}</div>
            {hasActiveFilters && onClear && (
              <div className={styles.footer}>
                <button type="button" onClick={handleClear} className={styles.clearBtn}>
                  Clear Filters
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
