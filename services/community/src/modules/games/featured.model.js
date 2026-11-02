import mongoose from 'mongoose';

const featuredSchema = new mongoose.Schema({
  _id: { type: String, default: 'featured' },
  games: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Game' }],
});

export const Featured = mongoose.model('Featured', featuredSchema);
