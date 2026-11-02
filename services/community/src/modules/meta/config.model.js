import mongoose from 'mongoose';

const configSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'config' },
    genres: [
      {
        _id: false,
        key: String,
        label: String,
        active: { type: Boolean, default: true },
      },
    ],
    levels: [{ _id: false, level: Number, title: String, minPoints: Number }],
    badges: [
      {
        _id: false,
        key: String,
        name: String,
        description: String,
        kind: String,
        threshold: { type: Number, default: null },
        active: { type: Boolean, default: true },
      },
    ],
    reputationPoints: {
      helpfulVote: Number,
      notHelpfulVote: Number,
      feedbackPlanned: Number,
      feedbackFixed: Number,
    },
  },
  { timestamps: true },
);

export const Config = mongoose.model('Config', configSchema);
