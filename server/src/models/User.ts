import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export enum UserRole {
  ADMIN = 'admin',
  ANALYST = 'analyst',
  USER = 'user',
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
  preferences: {
    currency: string;
    timezone: string;
    notificationsEnabled: boolean;
    anomalyAlertThreshold: number; // 0-1 sensitivity
    budgetAlertPercent: number; // alert at X% of budget
  };
  linkedAccounts: {
    plaidItemId: string;
    plaidAccessToken: string;
    institutionName: string;
    institutionId: string;
    accountIds: string[];
    lastSynced: Date;
  }[];
  mlProfile: {
    modelVersion: string;
    lastTrained: Date;
    dataPointCount: number;
    topCategories: string[];
  };
  isActive: boolean;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  fullName: string;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't include password in queries by default
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: 50,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: 50,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    avatar: String,
    preferences: {
      currency: { type: String, default: 'USD' },
      timezone: { type: String, default: 'America/New_York' },
      notificationsEnabled: { type: Boolean, default: true },
      anomalyAlertThreshold: { type: Number, default: 0.7, min: 0, max: 1 },
      budgetAlertPercent: { type: Number, default: 80, min: 0, max: 100 },
    },
    linkedAccounts: [
      {
        plaidItemId: String,
        plaidAccessToken: { type: String, select: false },
        institutionName: String,
        institutionId: String,
        accountIds: [String],
        lastSynced: Date,
      },
    ],
    mlProfile: {
      modelVersion: { type: String, default: 'v0' },
      lastTrained: Date,
      dataPointCount: { type: Number, default: 0 },
      topCategories: [String],
    },
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: full name
userSchema.virtual('fullName').get(function (this: IUser) {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save: hash password
userSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method: compare password
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Index for efficient queries
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
