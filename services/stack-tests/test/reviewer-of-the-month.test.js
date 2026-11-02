import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp, settle } from './stack.js';
import { Member } from '../../community/src/modules/users/member.model.js';
import { Notification } from '../../notifications/src/modules/notifications/notification.model.js';
import { ReputationEvent } from '../../community/src/modules/reputation/reputation-event.model.js';
import { handler } from '../../../lambdas/monthly-badges/src/index.js';
import { createUser } from './helpers.js';

const app = createApp();
const now = new Date();
const lastMonthDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
const lastMonth = lastMonthDay.toISOString().slice(0, 7);

const earn = (user, points, createdAt) =>
  ReputationEvent.create({ user: user._id, points, kind: 'helpful_vote', createdAt });

const monthBadges = async (user) =>
  (await Member.findById(user._id)).badges.filter((b) => b.key === 'reviewer_of_the_month');

const runMonthlyJob = (signature = createHmac('sha256', 'test-webhook-secret').digest('hex')) =>
  request(app).post('/api/internal/badges/monthly').set('X-PlayLoop-Signature', signature);

describe('Reviewer of the Month', () => {
  it("goes once to last month's top reviewer, not this month's leader", async () => {
    const [runnerUp, winner, currentLeader] = await Promise.all([
      createUser(),
      createUser(),
      createUser(),
    ]);
    await earn(runnerUp, 10, lastMonthDay);
    await earn(winner, 25, lastMonthDay);
    await earn(currentLeader, 100, now);

    const responses = await Promise.all([runMonthlyJob(), runMonthlyJob(), runMonthlyJob()]);
    expect(responses.map((res) => res.status)).toEqual([204, 204, 204]);

    expect(await monthBadges(winner)).toEqual([
      expect.objectContaining({ key: 'reviewer_of_the_month', period: lastMonth }),
    ]);
    expect(await monthBadges(currentLeader)).toEqual([]);
    expect(await monthBadges(runnerUp)).toEqual([]);
    await settle();
    expect(
      await Notification.countDocuments({ user: winner._id, type: 'badge_awarded' }),
    ).toBeGreaterThanOrEqual(1);
    expect(
      await Notification.countDocuments({
        user: winner._id,
        message: `You earned Reviewer of the Month for ${lastMonth}`,
      }),
    ).toBe(1);
  });

  it("doesn't change hands once a month is awarded", async () => {
    const [winner, lateRiser] = await Promise.all([createUser(), createUser()]);
    await earn(winner, 25, lastMonthDay);
    await runMonthlyJob();

    await earn(lateRiser, 500, lastMonthDay);
    await runMonthlyJob();

    expect(await monthBadges(winner)).toHaveLength(1);
    expect(await monthBadges(lateRiser)).toEqual([]);
  });

  it('awards nobody when no one earned points last month', async () => {
    const user = await createUser();
    await earn(user, 40, now);
    await runMonthlyJob();
    expect(await monthBadges(user)).toEqual([]);
  });

  it('is not awarded by viewing the leaderboard', async () => {
    const winner = await createUser();
    await earn(winner, 25, lastMonthDay);
    await request(app).get('/api/leaderboard');
    expect(await monthBadges(winner)).toEqual([]);
  });

  it('is awarded when the real Lambda handler calls the API', async () => {
    const winner = await createUser();
    await earn(winner, 25, lastMonthDay);
    const api = createServer(app).listen(0);
    await once(api, 'listening');
    process.env.API_URL = `http://127.0.0.1:${api.address().port}`;
    try {
      await handler();
    } finally {
      api.close();
    }
    expect(await monthBadges(winner)).toHaveLength(1);
  });

  it('rejects the monthly job without a valid signature', async () => {
    const winner = await createUser();
    await earn(winner, 25, lastMonthDay);
    const res = await runMonthlyJob('forged');
    expect(res.status).toBe(401);
    expect(await monthBadges(winner)).toEqual([]);
  });
});
