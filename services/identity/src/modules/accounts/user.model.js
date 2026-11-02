import mongoose from 'mongoose';
import { USER_ROLES, USER_STATUSES } from '@playloop/shared';

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, match: /^[A-Za-z0-9_]{3,20}$/ },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: 'user' },
    status: { type: String, enum: USER_STATUSES, default: 'active' },
    suspension: {
      reason: String,
      until: Date,
      at: Date,
      by: mongoose.Schema.Types.ObjectId,
    },
  },
  { timestamps: true },
);

userSchema.index({ username: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
userSchema.index({ email: 1 }, { unique: true });

export const User = mongoose.model('User', userSchema);
