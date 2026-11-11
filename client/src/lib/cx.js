// Joins truthy class names: cx(styles.tag, selected && styles.selected).
export function cx(...names) {
  return names.filter(Boolean).join(' ');
}
