import { createAuth } from '@playloop/kit';
import { User } from '../modules/users/user.model.js';

export {
  SESSION_COOKIE,
  accountBlockMessage,
  clearSessionCookie,
  setSessionCookie,
  signSessionToken,
} from '@playloop/kit';

export const { requireAuth, optionalAuth, requireAdmin } = createAuth((id) =>
  User.findById(id).select('role status suspension'),
);
