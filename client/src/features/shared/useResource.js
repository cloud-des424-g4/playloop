import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

// A request belongs to its URL and refresh revision. Old responses never replace new data.
export function useResource(path) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({});
  const key = `${path}:${revision}`;
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api.get(path, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setState({ key, data });
      },
      (error) => {
        if (!controller.signal.aborted) setState({ key, error });
      },
    );
    return () => controller.abort();
  }, [path, key]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  return {
    ...(state.key === key ? state : {}),
    loading: Boolean(path) && state.key !== key,
    refresh,
  };
}
