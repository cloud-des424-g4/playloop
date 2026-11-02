import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const buildSchema = new mongoose.Schema(
  {
    game: { type: ObjectId, ref: 'Game', required: true },
    owner: { type: ObjectId, ref: 'User', required: true },
    target: { type: String, enum: ['web', 'windows', 'mac', 'linux'], required: true },
    status: { type: String, enum: ['processing', 'ready', 'failed'], required: true },
    fileName: { type: String, required: true },
    size: { type: Number, required: true },
    version: { type: String, required: true },
    key: { type: String, required: true },
    bucket: { type: String, required: true },
    playUrl: { type: String, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true },
);

buildSchema.index({ game: 1, target: 1 }, { unique: true });

export const Build = mongoose.model('Build', buildSchema);
