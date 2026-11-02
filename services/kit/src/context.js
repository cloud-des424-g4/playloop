import { AsyncLocalStorage } from 'node:async_hooks';

const store = new AsyncLocalStorage();

export const currentRequestId = () => store.getStore();

export function requestContext(req, _res, next) {
  store.run(req.id, next);
}
