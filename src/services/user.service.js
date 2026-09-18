import mongoose from 'mongoose';
import { User } from '../models/user.model.js';

export const userService = {
  /**
   * Retrieve all users with optional query filtering and pagination from MongoDB
   */
  async findAll({ search, role, page = 1, limit = 10 } = {}) {
    const filter = {};

    // Filter by role if provided
    if (role) {
      filter.role = new RegExp(`^${role}$`, 'i');
    }

    // Search by name or email if provided
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum)
    ]);

    return {
      data: users.map((u) => u.toJSON()),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    };
  },

  /**
   * Find a user by MongoDB ObjectId
   */
  async findById(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    const user = await User.findById(id);
    return user ? user.toJSON() : null;
  },

  /**
   * Find a user document by email (internal, includes password)
   */
  async findByEmail(email) {
    if (!email) return null;
    return User.findOne({ email: email.toLowerCase() });
  },

  /**
   * Create a new user document in MongoDB
   */
  async create({ name, email, password, role = 'User', department = 'General' }) {
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role,
      department
    });

    return user.toJSON();
  },

  /**
   * Set password reset token and expiration for a user
   */
  async setResetToken(userId, hashedToken, expiresDate) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return false;
    }
    await User.findByIdAndUpdate(userId, {
      passwordResetToken: hashedToken,
      passwordResetExpires: expiresDate
    });
    return true;
  },

  /**
   * Find user by valid unexpired reset token
   */
  async findByResetToken(hashedToken) {
    return User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() }
    });
  },

  /**
   * Update password and clear reset token
   */
  async updatePassword(userId, newHashedPassword) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return null;
    }
    const user = await User.findByIdAndUpdate(
      userId,
      {
        password: newHashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null
      },
      { new: true }
    );
    return user ? user.toJSON() : null;
  },

  /**
   * Update refresh token for a user
   */
  async updateRefreshToken(userId, refreshToken) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return null;
    }
    return User.findByIdAndUpdate(
      userId,
      { refreshToken },
      { new: true }
    );
  },

  /**
   * Clear refresh token for a user (on logout)
   */
  async clearRefreshToken(userId) {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return null;
    }
    return User.findByIdAndUpdate(
      userId,
      { refreshToken: null },
      { new: true }
    );
  },

  /**
   * Find raw user document by MongoDB ObjectId (internal)
   */
  async findRawById(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return User.findById(id);
  },

  /**
   * Find user document by refresh token
   */
  async findByRefreshToken(refreshToken) {
    if (!refreshToken) return null;
    return User.findOne({ refreshToken });
  },

  /**
   * Helper to sanitize user document / object
   */
  sanitize(user) {
    if (!user) return null;
    return typeof user.toJSON === 'function' ? user.toJSON() : user;
  }
};
