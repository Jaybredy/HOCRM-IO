// Shared greeting helpers — keep page headers consistent.
// Fallback chain prefers display_name. full_name's first word is skipped
// when it's a role placeholder (e.g. "Admin User" → "Admin") to avoid
// addressing the user by their role. Email prefix strips the +alias
// suffix Gmail filters add (e.g. "erick+test@gmail.com" → "test"),
// since the alias is usually the discriminator.

const ROLE_PLACEHOLDERS = new Set([
  'admin', 'user', 'owner', 'manager', 'staff', 'epic', 'test',
]);

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function getUserHandle(user) {
  if (!user) return 'there';

  const displayName = user.display_name?.trim();
  if (displayName && !ROLE_PLACEHOLDERS.has(displayName.toLowerCase())) {
    return displayName;
  }

  const firstName = user.full_name?.trim().split(/\s+/)[0];
  if (firstName && !ROLE_PLACEHOLDERS.has(firstName.toLowerCase())) {
    return firstName;
  }

  const localPart = user.email?.split('@')[0];
  if (localPart) {
    const [base, alias] = localPart.split('+');
    return alias || base;
  }

  return 'there';
}
