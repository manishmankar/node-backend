import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../config/env.js';

/**
 * Generate a signed JWT access token
 */
export const generateToken = (payload) => {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });
};

export const generateAccessToken = generateToken;

/**
 * Generate a signed JWT refresh token
 */
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpiresIn
  });
};

/**
 * Verify a JWT access token
 */
export const verifyToken = (token) => {
  return jwt.verify(token, config.jwtSecret);
};

export const verifyAccessToken = verifyToken;

/**
 * Verify a JWT refresh token
 */
export const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwtRefreshSecret);
};

/**
 * Generate both access and refresh tokens for a user
 */
export const generateAuthTokens = (payload) => {
  const tokenPayload = {
    id: payload.id || payload._id,
    email: payload.email,
    role: payload.role
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  return {
    accessToken,
    refreshToken,
    token: accessToken, // Kept for backward compatibility
    expiresIn: config.jwtExpiresIn,
    refreshExpiresIn: config.jwtRefreshExpiresIn
  };
};

/**
 * Hash a plain text password using bcrypt
 */
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

/**
 * Compare plain password against bcrypt hash
 */
export const comparePassword = async (plainPassword, hashedPassword) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Generate a random reset token and its SHA256 hash for secure DB storage
 */
export const generateResetToken = () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, hashedToken };
};

/**
 * Compute SHA256 hash of a provided reset token
 */
export const hashResetToken = (rawToken) => {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};
