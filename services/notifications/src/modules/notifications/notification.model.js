import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const notificationSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, required: true },
    type: { type: String, required: true },
    read: { type: Boolean, default: false },
    message: { type: String, required: true },
    link: { type: String, required: true },
    actor: ObjectId,
    game: ObjectId,
    reviewId: ObjectId,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });

export const Notification = mongoose.model('Notification', notificationSchema);
