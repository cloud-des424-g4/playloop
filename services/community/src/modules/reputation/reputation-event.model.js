import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const reputationEventSchema = new mongoose.Schema({
  user: { type: ObjectId, ref: 'User', required: true },
  review: { type: ObjectId, ref: 'Review' },
  points: { type: Number, required: true },
  kind: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

reputationEventSchema.index({ user: 1, createdAt: -1 });
reputationEventSchema.index({ review: 1 });

export const ReputationEvent = mongoose.model('ReputationEvent', reputationEventSchema);
