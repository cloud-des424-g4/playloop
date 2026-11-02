import * as reviews from './review.service.js';

export async function startReview(req, res) {
  const { review, created } = await reviews.startReview(req.params.gameId, req.user.id);
  res.status(created ? 201 : 200).json(await reviews.toReview(review, req.user.id));
}

export async function listGameReviews(req, res) {
  res.json(await reviews.listGameReviews(req.params.gameId, req.user?.id, req.query));
}

export async function getReview(req, res) {
  const review = await reviews.getReview(req.params.reviewId, req.user);
  res.json(await reviews.toReview(review, req.user?.id));
}

export async function deleteReview(req, res) {
  await reviews.deleteReview(req.params.reviewId, req.user.id);
  res.status(204).end();
}

export async function saveFirstImpression(req, res) {
  const review = await reviews.saveFirstImpression(req.params.reviewId, req.user.id, req.body);
  res.json(reviews.toAnswersStage(review.firstImpression));
}

export async function acceptMission(req, res) {
  const review = await reviews.acceptMission(
    req.params.reviewId,
    req.user.id,
    req.params.missionId,
  );
  res.json(await reviews.toPlaytestStage(review, true));
}

export async function addCard(req, res) {
  const card = await reviews.addCard(req.params.reviewId, req.user.id, req.body);
  res.status(201).json(reviews.toCard(card));
}

export async function updateCard(req, res) {
  const card = await reviews.updateCard(
    req.params.reviewId,
    req.user.id,
    req.params.cardId,
    req.body,
  );
  res.json(reviews.toCard(card));
}

export async function deleteCard(req, res) {
  await reviews.deleteCard(req.params.reviewId, req.user.id, req.params.cardId);
  res.status(204).end();
}

export async function savePlaytest(req, res) {
  const review = await reviews.savePlaytest(req.params.reviewId, req.user.id, req.body);
  res.json(await reviews.toPlaytestStage(review, true));
}

export async function saveDeveloperAnswers(req, res) {
  const review = await reviews.saveDeveloperAnswers(req.params.reviewId, req.user.id, req.body);
  res.json(reviews.toAnswersStage(review.developerAnswers));
}

export async function saveFinalVerdict(req, res) {
  const review = await reviews.saveFinalVerdict(req.params.reviewId, req.user.id, req.body);
  res.json(reviews.toVerdictStage(review));
}

export async function submitReview(req, res) {
  const review = await reviews.submitReview(req.params.reviewId, req.user.id);
  res.json(await reviews.toReview(review, req.user.id));
}

export async function getFeedbackInbox(req, res) {
  const result = await reviews.getFeedbackInbox(req.params.gameId, req.user.id, req.query);
  res.json({ ...result, items: result.items.map(reviews.toFeedbackItem) });
}

export async function setFeedbackStatus(req, res) {
  const review = await reviews.setFeedbackStatus(req.params.reviewId, req.user.id, req.body.status);
  res.json({
    reviewId: review._id.toString(),
    feedbackStatus: review.feedbackStatus,
    updatedAt: review.updatedAt,
  });
}

export async function listMyReviews(req, res) {
  const result = await reviews.listMyReviews(req.user.id, req.query);
  res.json({ ...result, items: result.items.map(reviews.toMyReviewItem) });
}
