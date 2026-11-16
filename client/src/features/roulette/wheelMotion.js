// The eight wedges painted on the wheel artwork, clockwise from the one under the pointer.
export const WEDGES = [
  'action',
  'adventure',
  'fantasy',
  'horror',
  'racing',
  'rpg',
  'shooter',
  'survival',
];

// Without animation the wheel jumps to its wedge: for people who ask for reduced motion, and where
// there is no matchMedia at all (the test environment).
export function instantMotion() {
  return (
    typeof window.matchMedia !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
