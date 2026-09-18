import { authService } from '../services/auth.service.js';

/**
 * Register a new user
 * POST /api/auth/register
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, role, department } = req.body;

    console.log("Data is here", req.body);


    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    const result = await authService.register({
      name,
      email,
      password,
      role,
      department
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Request password reset token
 * POST /api/auth/forgot-password
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password with token
 * POST /api/auth/reset-password
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body;
    const result = await authService.resetPassword({ resetToken, newPassword });

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token using refresh token
 * POST /api/auth/refresh-token or POST /api/auth/refresh
 */
export const refreshToken = async (req, res, next) => {
  try {
    const incomingRefreshToken =
      req.body.refreshToken ||
      req.body.token ||
      req.headers['x-refresh-token'];

    if (!incomingRefreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    const result = await authService.refreshToken(incomingRefreshToken);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user / invalidate refresh token
 * POST /api/auth/logout
 */
export const logout = async (req, res, next) => {
  try {
    const incomingRefreshToken =
      req.body.refreshToken ||
      req.body.token ||
      req.headers['x-refresh-token'];
    const userId = req.user?.id;

    const result = await authService.logout({
      userId,
      refreshToken: incomingRefreshToken
    });

    res.status(200).json({
      success: true,
      message: result.message || 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated user profile
 * GET /api/auth/profile
 */
export const getProfile = async (req, res, next) => {
  try {
    const profile = await authService.getProfile(req.user.id);

    res.status(200).json({
      success: true,
      message: 'User profile retrieved successfully',
      data: profile
    });
  } catch (error) {
    next(error);
  }
};
