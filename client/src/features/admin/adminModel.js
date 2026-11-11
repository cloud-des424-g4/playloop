import { useState } from 'react';
import { date, label, nameOf } from '../shared/format.js';

export const REASONS = {
  spam: 'Spam',
  offensive: 'Harassment or hate',
  inappropriate: 'Inappropriate content',
  cheating: 'Cheating',
  broken_game: 'Broken or harmful file',
  other: 'Other',
};

export const TARGETS = { game: 'Game', review: 'Review', reply: 'Reply', user: 'User' };

export const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

// API links are client routes; anything else is ignored rather than followed.
export const internalLink = (link) =>
  typeof link === 'string' && /^\/(?!\/)/.test(link) && !link.includes('\\') ? link : null;

export const targetTitle = (target) =>
  `${TARGETS[target.type] || label(target.type)}: ${target.preview}`;

// Runs one admin request at a time and keeps its error for the page to show.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(task) {
    setBusy(true);
    setError('');
    try {
      await task();
      return true;
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

const VERBS = {
  hide: 'hid',
  restore: 'restored',
  remove: 'removed',
  suspend: 'suspended',
  ban: 'banned',
  lift: 'lifted the suspension on',
  role_change: 'changed the role of',
  // The API also logs report outcomes, which the spec's enum doesn't list yet.
  report_resolved: 'resolved a report on',
  report_dismissed: 'dismissed a report on',
};

export function describeAction(action) {
  const what = `${nameOf(action.actor)} ${VERBS[action.action] || String(action.action).replaceAll('_', ' ')} a ${action.targetType}`;
  if (action.action === 'role_change' && action.role) return `${what} to ${action.role}`;
  if (action.action === 'suspend' && action.until) return `${what} until ${date(action.until)}`;
  return what;
}

// Keeps the last loaded data on screen while the same view reloads, so refreshing after an action
// doesn't unmount the page (and lose what the admin typed or the message they were just shown).
export function useKeptData(resource) {
  const [kept, setKept] = useState(null);
  if (resource.data && resource.data !== kept) setKept(resource.data);
  if (resource.data || !kept) return resource;
  return { ...resource, data: kept, loading: false };
}
