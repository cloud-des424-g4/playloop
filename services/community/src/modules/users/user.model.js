import mongoose from 'mongoose';
import { BADGES, PLATFORMS, USER_ROLES, USER_STATUSES } from '@playloop/shared';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, match: /^[A-Za-z0-9_]{3,20}$/ },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    displayName: {
      type: String,
      trim: true,
      maxlength: 40,
      default() {
        return this.username;
      },
    },
    pronouns: { type: String, maxlength: 20, default: null },
    bio: { type: String, maxlength: 200, default: '' },
    avatarKey: { type: String, default: null },
    favoriteGenres: [String],
    platforms: [{ type: String, enum: PLATFORMS }],
    links: [{ _id: false, label: String, url: String }],
    role: { type: String, enum: USER_ROLES, default: 'user' },
    status: { type: String, enum: USER_STATUSES, default: 'active' },
    suspension: {
      reason: String,
      until: Date,
      at: Date,
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    reputationPoints: { type: Number, min: 0, default: 0 },
    badges: [
      {
        _id: false,
        key: { type: String, enum: BADGES.map((badge) => badge.key) },
        awardedAt: Date,
        period: String,
      },
    ],
  },
  { timestamps: true },
);

userSchema.index({ username: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
userSchema.index({ email: 1 }, { unique: true });

export const User = mongoose.model('User', userSchema);
