import { createAuth } from '@playloop/kit';
import { Member } from '../modules/users/member.model.js';

export const { requireAuth, optionalAuth, requireAdmin } = createAuth((id) =>
  Member.findById(id).select('role status suspension'),
);
