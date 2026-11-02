import { internalClient } from '@playloop/kit';

const community = internalClient('COMMUNITY_URL');

export const memberFor = ({ _id, username, email, role }) =>
  community.put(`/internal/members/${_id}`, { username, email, role });
