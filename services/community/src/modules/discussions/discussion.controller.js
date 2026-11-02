import * as discussions from './discussion.service.js';

export async function listReplies(req, res) {
  res.json(await discussions.listReplies(req.params.reviewId, req.user?.id, req.query));
}

export async function createReply(req, res) {
  res.status(201).json(await discussions.createReply(req.params.reviewId, req.user.id, req.body));
}

export async function updateReply(req, res) {
  res.json(await discussions.updateReply(req.params.replyId, req.user.id, req.body));
}

export async function deleteReply(req, res) {
  await discussions.deleteReply(req.params.replyId, req.user.id);
  res.status(204).end();
}

export async function addReaction(req, res) {
  res.json(
    await discussions.addReaction(
      req.params.targetType,
      req.params.targetId,
      req.params.emoji,
      req.user.id,
    ),
  );
}

export async function removeReaction(req, res) {
  res.json(
    await discussions.removeReaction(
      req.params.targetType,
      req.params.targetId,
      req.params.emoji,
      req.user.id,
    ),
  );
}
