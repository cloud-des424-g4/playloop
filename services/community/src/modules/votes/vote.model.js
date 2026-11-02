import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    review: { type: mongoose.Schema.Types.ObjectId, ref: 'Review', required: true },
    value: { type: Number, enum: [1, -1], required: true },
    appliedPoints: { type: Number, default: 0 },
  },
  { timestamps: true },
);

voteSchema.index({ user: 1, review: 1 }, { unique: true });

export const Vote = mongoose.model('Vote', voteSchema);
