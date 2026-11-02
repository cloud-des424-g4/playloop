import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['game', 'review', 'reply', 'user'], required: true },
    targetId: { type: ObjectId, required: true },
    reason: { type: String, required: true },
    details: { type: String, default: null },
    status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open' },
    resolvedBy: { type: ObjectId, ref: 'User' },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: null },
  },
  { timestamps: true },
);

reportSchema.index({ targetType: 1, targetId: 1, status: 1 });
reportSchema.index({ status: 1, createdAt: 1 });

export const Report = mongoose.model('Report', reportSchema);
