import { userService } from '../services/user.service.js';

/**
 * Controller to get all users
 * GET /api/users
 * Query Params: search, role, page, limit
 */
export const getAllUsers = async (req, res, next) => {
  try {
    const { search, role, page, limit } = req.query;
    const result = await userService.findAll({ search, role, page, limit });

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      count: result.data.length,
      pagination: result.pagination,
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to get a single user by ID
 * GET /api/users/:id
 */
export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await userService.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User with ID ${id} not found`
      });
    }

    res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: user
    });
  } catch (error) {
    next(error);
  }
};
