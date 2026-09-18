import { productUserService } from '../services/productUser.service.js';

/**
 * Upload Excel/CSV spreadsheet and bulk import into ProductUser collection
 * POST /api/product-users/upload-excel
 */
export const importProductUsers = async (req, res, next) => {
  try {
    const file = req.file || (req.files && req.files[0]);


    if (!file || !file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'No file detected. Please upload an Excel spreadsheet (.xlsx, .xls) or CSV file in form-data.'
      });
    }

    const { defaultRole, defaultProduct, defaultDepartment } = req.body;

    const result = await productUserService.importFromExcel(file.buffer, {
      defaultRole,
      defaultProduct,
      defaultDepartment
    });

    const statusCode = result.importedCount > 0 ? 201 : 200;

    res.status(statusCode).json({
      success: true,
      message: `Import completed: ${result.importedCount} product user(s) imported, ${result.skippedCount} skipped.`,
      filename: file.originalname,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Download sample Excel template for bulk ProductUser imports
 * GET /api/product-users/sample-template
 */
export const downloadSampleTemplate = (req, res, next) => {
  try {
    const buffer = productUserService.generateSampleTemplate();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="product_users_template.xlsx"'
    );
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all product users with query filters & pagination
 * GET /api/product-users
 */
export const getAllProductUsers = async (req, res, next) => {
  try {
    const { search, role, product, status, page, limit } = req.query;
    const result = await productUserService.findAll({
      search,
      role,
      product,
      status,
      page,
      limit
    });

    res.status(200).json({
      success: true,
      message: 'Product users retrieved successfully',
      count: result.data.length,
      pagination: result.pagination,
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single product user by ID
 * GET /api/product-users/:id
 */
export const getProductUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await productUserService.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `Product user with ID ${id} not found`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product user retrieved successfully',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a single product user manually
 * POST /api/product-users
 */
export const createProductUser = async (req, res, next) => {
  try {
    const { name, email, role, department, product, status } = req.body;
    const user = await productUserService.create({
      name,
      email,
      role,
      department,
      product,
      status
    });

    res.status(201).json({
      success: true,
      message: 'Product user created successfully',
      data: user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a product user
 * DELETE /api/product-users/:id
 */
export const deleteProductUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const success = await productUserService.delete(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: `Product user with ID ${id} not found`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product user deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
