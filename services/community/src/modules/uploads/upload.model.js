import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const uploadSchema = new mongoose.Schema(
  {
    owner: { type: ObjectId, ref: 'User', required: true },
    purpose: { type: String, required: true },
    fileName: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    key: { type: String, required: true },
    bucket: { type: String, required: true },
    status: { type: String, enum: ['pending', 'uploaded'], default: 'pending' },
    method: { type: String, enum: ['single', 'multipart'], required: true },
    s3UploadId: String,
    game: { type: ObjectId, ref: 'Game' },
    review: { type: ObjectId, ref: 'Review' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const Upload = mongoose.model('Upload', uploadSchema);
