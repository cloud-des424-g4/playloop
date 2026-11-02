import * as games from './game.service.js';

const detail = (req, game) => games.toGameDetail(game, req.user?.id);

export async function listGames(req, res) {
  const result = await games.listGames(req.query);
  res.json({ ...result, items: result.items.map(games.toGameCard) });
}

export async function createGame(req, res) {
  res.status(201).json(detail(req, await games.createGame(req.user.id, req.body)));
}

export async function getGame(req, res) {
  res.json(detail(req, await games.getGame(req.params.gameId, req.user)));
}

export async function updateGame(req, res) {
  res.json(detail(req, await games.updateGame(req.params.gameId, req.user.id, req.body)));
}

export async function deleteGame(req, res) {
  await games.deleteGame(req.params.gameId, req.user.id);
  res.status(204).end();
}

export async function publishGame(req, res) {
  res.json(detail(req, await games.publishGame(req.params.gameId, req.user.id)));
}

export async function unpublishGame(req, res) {
  res.json(detail(req, await games.unpublishGame(req.params.gameId, req.user.id)));
}

export async function getForm(req, res) {
  res.json(games.toForm(await games.getForm(req.params.gameId, req.user.id)));
}

export async function updateForm(req, res) {
  res.json(games.toForm(await games.updateForm(req.params.gameId, req.user.id, req.body)));
}

export async function listMyGames(req, res) {
  const result = await games.listMyGames(req.user.id, req.query);
  res.json({ ...result, items: result.items.map(games.toMyGameItem) });
}
