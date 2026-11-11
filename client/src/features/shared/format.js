export const label = (value) =>
  String(value ?? '')
    .replaceAll('_', ' ')
    .replace(/^./, (c) => c.toUpperCase());
export const date = (value) =>
  value
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(value),
      )
    : '';
export const nameOf = (user) => user?.displayName || user?.username || 'Reviewer';
