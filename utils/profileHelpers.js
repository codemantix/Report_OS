export function getProfileDisplayName(profile, fallback = 'Unknown') {
  return profile?.display_name || profile?.full_name || profile?.email || fallback;
}

export function getProfileInitials(profile, fallback = 'U') {
  const source = getProfileDisplayName(profile, fallback);
  return source
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || fallback;
}

export function getProfileSubtitle(profile) {
  return profile?.job_title || profile?.role?.replace(/_/g, ' ') || 'Member';
}
