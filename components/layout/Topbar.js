import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Menu, Search, X } from 'lucide-react';
import { getProfileDisplayName, getProfileInitials } from '../../utils/profileHelpers';
import styles from './Topbar.module.css';

export default function Topbar({ title, onMenuClick, user }) {
  const router = useRouter();
  const userInitials = getProfileInitials(user);
  const userDisplayName = getProfileDisplayName(user, 'User');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setSearch(typeof router.query.q === 'string' ? router.query.q : '');
  }, [router.query.q]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    const query = search.trim();
    if (!query) return;
    router.push(`/dashboard/search?q=${encodeURIComponent(query)}`);
  }

  function clearSearch() {
    setSearch('');
    if (router.pathname === '/dashboard/search') {
      router.push('/dashboard/search');
    }
  }

  return (
    <header className={styles.topbar}>
      <div className={styles.leftSection}>
        <button className={styles.menuBtn} onClick={onMenuClick}>
          <Menu className="w-5 h-5" />
        </button>
        <h1 className={styles.pageTitle}>{title}</h1>
      </div>

      <div className={styles.rightSection}>
        <form className={styles.searchWrapper} onSubmit={handleSearchSubmit} role="search">
          <label htmlFor="topbar-search" className={styles.srOnly}>Global search</label>
          <Search className={styles.searchIcon} aria-hidden="true" />
          <input
            id="topbar-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reports, tasks, goals..."
            className={styles.searchInput}
          />
          {search && (
            <button
              type="button"
              onClick={clearSearch}
              className={styles.clearSearchBtn}
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
        <button className={styles.avatarBtn} title={userDisplayName}>
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={userDisplayName} className={styles.avatarImage} />
          ) : (
            userInitials
          )}
        </button>
      </div>
    </header>
  );
}
