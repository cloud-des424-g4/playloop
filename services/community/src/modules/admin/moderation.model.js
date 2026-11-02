import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const moderationActionSchema = new mongoose.Schema(
  {
    actor: { type: ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    targetType: { type: String, enum: ['game', 'review', 'reply', 'user'], required: true },
    targetId: { type: ObjectId, required: true },
    reason: { type: String, default: null },
    until: Date,
    role: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

moderationActionSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
moderationActionSchema.index({ createdAt: -1 });

export const ModerationAction = mongoose.model('ModerationAction', moderationActionSchema);
