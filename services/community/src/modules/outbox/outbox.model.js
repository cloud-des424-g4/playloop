import mongoose from 'mongoose';

const outboxSchema = new mongoose.Schema(
  {
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

outboxSchema.index({ nextAttemptAt: 1 });

export const Outbox = mongoose.model('Outbox', outboxSchema);
