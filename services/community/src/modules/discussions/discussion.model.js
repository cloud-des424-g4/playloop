import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const replySchema = new mongoose.Schema(
  {
    review: { type: ObjectId, ref: 'Review', required: true },
    game: { type: ObjectId, ref: 'Game', required: true },
    author: { type: ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 1000 },
    edited: { type: Boolean, default: false },
    hiddenAt: { type: Date, default: null },
    removedAt: { type: Date, default: null },
    moderationReason: { type: String, default: null },
  },
  { timestamps: true },
);

replySchema.index({ review: 1, createdAt: 1 });

const reactionSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['review', 'reply'], required: true },
    targetId: { type: ObjectId, required: true },
    emoji: { type: String, required: true },
  },
  { timestamps: true },
);

reactionSchema.index({ user: 1, targetType: 1, targetId: 1, emoji: 1 }, { unique: true });
reactionSchema.index({ targetType: 1, targetId: 1 });

export const Reply = mongoose.model('Reply', replySchema);
export const Reaction = mongoose.model('Reaction', reactionSchema);
