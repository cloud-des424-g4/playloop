import { createAuth, loadRemoteAccount } from '@playloop/kit';

export const { requireAuth } = createAuth(loadRemoteAccount);
