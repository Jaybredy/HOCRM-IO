// Shared greeting helpers — keep page headers consistent.
// Fallback chain prefers the explicit short handle (display_name) since
// invitees with full_name like "Test Five" otherwise show as "Test".

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function getUserHandle(user) {
  if (!user) return 'there';
  return (
    user.display_name ||
    user.full_name?.split(' ')[0] ||
    user.email?.split('@')[0] ||
    'there'
  );
}
