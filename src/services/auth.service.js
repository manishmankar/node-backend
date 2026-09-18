import { userService } from './user.service.js';
import { emailService } from './email.service.js';
import {
  hashPassword,
  comparePassword,
  generateToken,
  generateAuthTokens,
  verifyRefreshToken,
  generateResetToken,
  hashResetToken
} from '../utils/token.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { cacheService } from './cache.service.js';

export const authService = {
  /**
   * Register a new user in MongoDB and send welcome email
   */
  async register({ name, email, password, role = 'User', department = 'General' }) {
    // Check if user already exists
    const existingUser = await userService.findByEmail(email);
    if (existingUser) {
      const error = new Error('User with this email already exists');
      error.statusCode = 400;
      throw error;
    }

    // Validate role
    const validRoles = ['User', 'Developer', 'Manager', 'Admin'];
    const normalizedRole = validRoles.find(
      (r) => r.toLowerCase() === (role || '').toLowerCase()
    ) || 'User';

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user in MongoDB
    const newUser = await userService.create({
      name,
      email,
      password: hashedPassword,
      role: normalizedRole,
      department
    });

    // Generate JWT auth tokens (access + refresh)
    const tokens = generateAuthTokens({
      id: newUser.id,
      email: newUser.email,
      role: newUser.role
    });

    // Save refresh token to user
    await userService.updateRefreshToken(newUser.id, tokens.refreshToken);

    // Invalidate cached user lists in Redis
    cacheService.delByPattern('cache:*users*').catch(() => {});

    logger.info(`New user registered in MongoDB: ${newUser.email} (ID: ${newUser.id}, Role: ${newUser.role})`);

    // Asynchronously trigger Welcome Email (does not block registration response)
    emailService.sendWelcomeEmail({
      to: newUser.email,
      name: newUser.name,
      role: newUser.role,
      department: newUser.department
    }).catch((err) => {
      logger.error(`Error sending welcome email to ${newUser.email}: ${err.message}`);
    });

    return {
      user: newUser,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      token: tokens.accessToken, // Kept for backward compatibility
      expiresIn: tokens.expiresIn,
      refreshExpiresIn: tokens.refreshExpiresIn,
      emailNotification: `Welcome email dispatched to ${newUser.email}`
    };
  },

  /**
   * Login user and verify against MongoDB record
   */
  async login({ email, password }) {
    if (!email || !password) {
      const error = new Error('Please provide both email and password');
      error.statusCode = 400;
      throw error;
    }

    const user = await userService.findByEmail(email);
    if (!user) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      logger.warn(`Failed login attempt for email: ${email}`);
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    const userObj = userService.sanitize(user);

    // Generate auth tokens (access + refresh)
    const tokens = generateAuthTokens({
      id: userObj.id,
      email: userObj.email,
      role: userObj.role
    });

    // Save refresh token to user in MongoDB
    await userService.updateRefreshToken(userObj.id, tokens.refreshToken);

    logger.info(`User logged in successfully: ${userObj.email} (ID: ${userObj.id}, Role: ${userObj.role})`);

    return {
      user: userObj,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      token: tokens.accessToken, // Kept for backward compatibility
      expiresIn: tokens.expiresIn,
      refreshExpiresIn: tokens.refreshExpiresIn
    };
  },

  /**
   * Refresh access token using a valid refresh token
   */
  async refreshToken(incomingRefreshToken) {
    if (!incomingRefreshToken) {
      const error = new Error('Refresh token is required');
      error.statusCode = 400;
      throw error;
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(incomingRefreshToken);
    } catch (err) {
      logger.warn(`Refresh token verification failed: ${err.message}`);
      const error = new Error('Invalid or expired refresh token');
      error.statusCode = 401;
      throw error;
    }

    // Find raw user in DB to check existing refresh token
    const user = await userService.findRawById(decoded.id);
    if (!user) {
      const error = new Error('User not found or account no longer exists');
      error.statusCode = 401;
      throw error;
    }

    // Validate that the incoming refresh token matches the one stored in DB
    if (user.refreshToken && user.refreshToken !== incomingRefreshToken) {
      logger.warn(`Refresh token mismatch/revoked for user: ${user.email}`);
      const error = new Error('Refresh token has been revoked or is invalid');
      error.statusCode = 401;
      throw error;
    }

    const userObj = userService.sanitize(user);

    // Generate fresh token pair (access token + rotated refresh token)
    const tokens = generateAuthTokens({
      id: userObj.id,
      email: userObj.email,
      role: userObj.role
    });

    // Update rotated refresh token in MongoDB
    await userService.updateRefreshToken(userObj.id, tokens.refreshToken);

    logger.info(`Tokens refreshed successfully for user: ${userObj.email}`);

    return {
      user: userObj,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      token: tokens.accessToken, // Kept for backward compatibility
      expiresIn: tokens.expiresIn,
      refreshExpiresIn: tokens.refreshExpiresIn
    };
  },

  /**
   * Invalidate refresh token on logout
   */
  async logout({ userId, refreshToken } = {}) {
    if (userId) {
      await userService.clearRefreshToken(userId);
      return { message: 'Logged out successfully' };
    }

    if (refreshToken) {
      const user = await userService.findByRefreshToken(refreshToken);
      if (user) {
        await userService.clearRefreshToken(user._id || user.id);
      }
      return { message: 'Logged out successfully' };
    }

    return { message: 'Logged out successfully' };
  },

  /**
   * Request password reset token and send reset email
   */
  async forgotPassword(email) {
    if (!email) {
      const error = new Error('Please provide an email address');
      error.statusCode = 400;
      throw error;
    }

    const user = await userService.findByEmail(email);
    if (!user) {
      // Prevent user enumeration attacks
      logger.warn(`Password reset requested for non-existent email: ${email}`);
      return {
        message: 'If the email exists in our records, a password reset email has been sent.'
      };
    }

    const { rawToken, hashedToken } = generateResetToken();
    const expiresDate = new Date(
      Date.now() + config.resetTokenExpiresMinutes * 60 * 1000
    );

    await userService.setResetToken(user._id || user.id, hashedToken, expiresDate);

    logger.info(`Password reset token saved in MongoDB for: ${user.email}`);

    // Asynchronously send Password Reset Email
    emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetToken: rawToken,
      expiresInMinutes: config.resetTokenExpiresMinutes
    }).catch((err) => {
      logger.error(`Error sending password reset email to ${user.email}: ${err.message}`);
    });

    return {
      message: 'Password reset email sent successfully.',
      resetToken: rawToken, // Provided in JSON response for easy development & testing
      expiresInMinutes: config.resetTokenExpiresMinutes
    };
  },

  /**
   * Reset password in MongoDB using token
   */
  async resetPassword({ resetToken, newPassword }) {
    if (!resetToken || !newPassword) {
      const error = new Error('Please provide both resetToken and newPassword');
      error.statusCode = 400;
      throw error;
    }

    if (newPassword.length < 6) {
      const error = new Error('Password must be at least 6 characters long');
      error.statusCode = 400;
      throw error;
    }

    const hashedToken = hashResetToken(resetToken);
    const user = await userService.findByResetToken(hashedToken);

    if (!user) {
      const error = new Error('Reset token is invalid or has expired');
      error.statusCode = 400;
      throw error;
    }

    const hashedPassword = await hashPassword(newPassword);
    const updatedUser = await userService.updatePassword(user._id || user.id, hashedPassword);

    // Invalidate cached user profiles in Redis
    cacheService.delByPattern(`cache:*${user._id || user.id}*`).catch(() => {});
    cacheService.delByPattern('cache:*users*').catch(() => {});

    logger.info(`Password successfully updated in MongoDB for: ${user.email}`);

    return {
      message: 'Password reset successful. You can now login with your new password.',
      user: updatedUser
    };
  },

  /**
   * Get user profile by MongoDB ID
   */
  async getProfile(userId) {
    const user = await userService.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }
    return user;
  }
};
