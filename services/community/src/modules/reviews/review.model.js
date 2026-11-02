import mongoose from 'mongoose';
import {
  AUDIENCES,
  CARD_TYPES,
  COMPARISONS,
  DELIVERY_METHODS,
  DIFFICULTY_LEVELS,
  FEEDBACK_STATUSES,
  IMPROVE_CATEGORIES,
  REVIEW_ORIGINS,
  REVIEW_STATUSES,
  STRENGTHS,
} from '@playloop/shared';

const { ObjectId, Mixed } = mongoose.Schema.Types;

const cardSchema = new mongoose.Schema({
  type: { type: String, enum: CARD_TYPES, required: true },
  missionId: { type: String, required: true },
  comment: { type: String, required: true },
  playedSeconds: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

const reviewSchema = new mongoose.Schema(
  {
    game: { type: ObjectId, ref: 'Game', required: true },
    reviewer: { type: ObjectId, ref: 'User', required: true },
    gameVersion: { type: String, required: true },
    origin: { type: String, enum: REVIEW_ORIGINS, default: 'browse' },
    status: { type: String, enum: REVIEW_STATUSES, default: 'in_progress' },
    deliveryMethod: { type: String, enum: DELIVERY_METHODS, required: true },
    form: { type: Mixed, required: true },
    firstImpression: { answers: [Mixed], completedAt: Date },
    playtest: {
      acceptedMissionIds: [String],
      cards: [cardSchema],
      playedSeconds: { type: Number, default: 0 },
      proofKey: { type: String, default: null },
      completedAt: Date,
    },
    developerAnswers: { answers: [Mixed], completedAt: Date },
    finalVerdict: {
      comparison: { type: String, enum: COMPARISONS },
      changeText: String,
      actualDifficulty: { type: String, enum: DIFFICULTY_LEVELS },
      actualStrength: { type: String, enum: STRENGTHS },
      actualAudience: { type: String, enum: AUDIENCES },
      enjoyment: Number,
      improveCategory: { type: String, enum: IMPROVE_CATEGORIES },
      improveOther: String,
      improveText: String,
      completedAt: Date,
    },
    feedbackStatus: { type: String, enum: FEEDBACK_STATUSES, default: 'new' },
    feedbackPointsApplied: { type: Number, default: 0 },
    helpfulCount: { type: Number, default: 0 },
    notHelpfulCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    submittedAt: { type: Date, default: null },
    hiddenAt: { type: Date, default: null },
    removedAt: { type: Date, default: null },
    moderationReason: { type: String, default: null },
  },
  { timestamps: true },
);

reviewSchema.index({ game: 1, reviewer: 1, gameVersion: 1 }, { unique: true });
reviewSchema.index({ reviewer: 1, updatedAt: -1 });
reviewSchema.index({ game: 1, status: 1, submittedAt: -1 });

export const Review = mongoose.model('Review', reviewSchema);
