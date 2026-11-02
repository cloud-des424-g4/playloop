import { mediaUrl } from '../../utils/mediaUrl.js';
import { Game } from '../games/game.model.js';
import { User } from '../users/user.model.js';
import { toUserSummary, USER_SUMMARY_FIELDS } from '../users/user.service.js';

const byId = (docs, convert) =>
  Object.fromEntries(docs.map((doc) => [doc._id.toString(), convert(doc)]));

const toGameRef = (game) => ({
  id: game._id.toString(),
  title: game.title,
  coverUrl: mediaUrl(game.media?.find((item) => item.type === 'image')?.key),
  deleted: Boolean(game.deletedAt),
});

export async function refs({ users = [], games = [] }) {
  const [userDocs, gameDocs] = await Promise.all([
    User.find({ _id: { $in: users } }).select(USER_SUMMARY_FIELDS),
    Game.find({ _id: { $in: games } }).select('title media deletedAt'),
  ]);
  return { users: byId(userDocs, toUserSummary), games: byId(gameDocs, toGameRef) };
}
