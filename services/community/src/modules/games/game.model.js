import mongoose from 'mongoose';
import {
  BUILD_STAGES,
  DELIVERY_METHODS,
  ENGINES,
  GAME_STATUSES,
  PLATFORMS,
} from '@playloop/shared';

const { ObjectId, Mixed } = mongoose.Schema.Types;

const missionSchema = new mongoose.Schema(
  { id: String, title: String, minutes: Number },
  { _id: false, id: false },
);

const gameSchema = new mongoose.Schema(
  {
    owner: { type: ObjectId, ref: 'User', required: true },
    status: { type: String, enum: GAME_STATUSES, default: 'draft' },
    deletedAt: { type: Date, default: null },
    title: { type: String, required: true, trim: true, maxlength: 60 },
    pitch: { type: String, default: '' },
    genres: [String],
    platforms: [{ type: String, enum: PLATFORMS }],
    buildStage: { type: String, enum: BUILD_STAGES },
    version: { type: String, default: '0.1' },
    lastUpdatedAt: { type: Date, default: null },
    media: [{ type: { type: String, enum: ['image', 'video'] }, key: String }],
    contentWarnings: [String],
    coreGameplay: [String],
    playable: [String],
    controls: [{ _id: false, key: String, action: String }],
    devNotes: { type: String, default: null },
    engine: { type: String, enum: ENGINES },
    engineOther: { type: String, default: null },
    credits: [{ _id: false, role: String, name: String }],
    theme: {
      backgroundPreset: { type: String, default: 'sky' },
      backgroundKey: { type: String, default: null },
      accentColor: { type: String, default: '#FF5A1F' },
      controlsCardColor: { type: String, default: '#FFFFFF' },
    },
    delivery: {
      method: { type: String, enum: DELIVERY_METHODS },
      webUrl: { type: String, default: null },
    },
    form: {
      revision: { type: Number, default: 1 },
      firstImpression: { questions: [Mixed] },
      playtest: { missions: [missionSchema], knownIssues: [String], questions: [Mixed] },
      finalVerdict: { farewellMessage: { type: String, default: null } },
      updatedAt: { type: Date, default: Date.now },
    },
    reviewCount: { type: Number, default: 0 },
    publishedAt: { type: Date, default: null },
    hiddenAt: { type: Date, default: null },
    removedAt: { type: Date, default: null },
    moderationReason: { type: String, default: null },
  },
  { timestamps: true },
);

gameSchema.index({ status: 1, deletedAt: 1, publishedAt: -1 });
gameSchema.index({ owner: 1, updatedAt: -1 });

export const Game = mongoose.model('Game', gameSchema);
