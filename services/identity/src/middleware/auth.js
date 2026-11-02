import { createAuth } from '@playloop/kit';
import { User } from '../modules/accounts/user.model.js';

export const { requireAuth } = createAuth((id) =>
  User.findById(id).select('role status suspension'),
);
