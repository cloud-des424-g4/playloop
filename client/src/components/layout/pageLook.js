import { createContext, useContext, useEffect } from 'react';

// Lets a page restyle the shared shell (AppLayout): `look` is { style, className }, applied to the
// shell while the page is mounted. Game pages use it for the developer's theme. Pass a memoised
// object; a new one on every render would restyle the shell each time.
export const PageLookContext = createContext(() => {});

export function usePageLook(look) {
  const setLook = useContext(PageLookContext);
  useEffect(() => {
    setLook(look);
    return () => setLook(null);
  }, [setLook, look]);
}
