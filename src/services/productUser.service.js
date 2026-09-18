import * as XLSX from 'xlsx';
import mongoose from 'mongoose';
import { ProductUser } from '../models/productUser.model.js';
import { cacheService } from './cache.service.js';
import { logger } from '../utils/logger.js';

export const productUserService = {
  /**
   * Retrieve paginated list of product users with filtering
   */
  async findAll({ search, role, product, status, page = 1, limit = 10 } = {}) {
    const filter = {};

    if (role) {
      filter.role = new RegExp(`^${role}$`, 'i');
    }

    if (product) {
      filter.product = new RegExp(`^${product}$`, 'i');
    }

    if (status) {
      filter.status = new RegExp(`^${status}$`, 'i');
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [{ name: searchRegex }, { email: searchRegex }, { product: searchRegex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [total, productUsers] = await Promise.all([
      ProductUser.countDocuments(filter),
      ProductUser.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum)
    ]);

    return {
      data: productUsers.map((u) => u.toJSON()),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    };
  },

  /**
   * Find product user by ID
   */
  async findById(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    const user = await ProductUser.findById(id);
    return user ? user.toJSON() : null;
  },

  /**
   * Find product user by Email
   */
  async findByEmail(email) {
    if (!email) return null;
    return ProductUser.findOne({ email: email.toLowerCase() });
  },

  /**
   * Create a single product user
   */
  async create({ name, email, role = 'User', department = 'General', product = null, status = 'Active' }) {
    if (!email) {
      const error = new Error('Email is required');
      error.statusCode = 400;
      throw error;
    }

    const existing = await this.findByEmail(email);
    if (existing) {
      const error = new Error('Product user with this email already exists');
      error.statusCode = 400;
      throw error;
    }

    const user = await ProductUser.create({
      name: name || email.split('@')[0],
      email: email.toLowerCase(),
      role,
      department,
      product,
      status
    });

    cacheService.delByPattern('cache:*product-user*').catch(() => {});
    return user.toJSON();
  },

  /**
   * Update product user by ID
   */
  async update(id, updateData) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    const updated = await ProductUser.findByIdAndUpdate(id, updateData, { new: true });
    if (updated) {
      cacheService.delByPattern('cache:*product-user*').catch(() => {});
    }
    return updated ? updated.toJSON() : null;
  },

  /**
   * Delete product user by ID
   */
  async delete(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return false;
    }

    const res = await ProductUser.findByIdAndDelete(id);
    if (res) {
      cacheService.delByPattern('cache:*product-user*').catch(() => {});
      return true;
    }
    return false;
  },

  /**
   * Parse uploaded Excel spreadsheet and bulk-import into ProductUser collection
   * @param {Buffer} fileBuffer - Spreadsheet file buffer
   * @param {Object} [options] - Default fallback options
   * @returns {Promise<Object>} Detailed import results
   */
  async importFromExcel(fileBuffer, options = {}) {
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      const error = new Error('No spreadsheet file buffer provided');
      error.statusCode = 400;
      throw error;
    }

    let workbook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (err) {
      const error = new Error('Failed to parse Excel spreadsheet. Please ensure it is a valid .xlsx or .xls file.');
      error.statusCode = 400;
      throw error;
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      const error = new Error('Spreadsheet contains no readable sheets');
      error.statusCode = 400;
      throw error;
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return {
        totalRows: 0,
        importedCount: 0,
        skippedCount: 0,
        errors: [],
        importedUsers: []
      };
    }

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    const errors = [];
    const productUsersToCreate = [];
    const processedEmailsInBatch = new Set();

    // Fetch existing emails from ProductUser collection
    const existingProductUsers = await ProductUser.find({}, { email: 1 }).lean();
    const existingEmailSet = new Set(existingProductUsers.map((u) => u.email.toLowerCase()));

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNumber = i + 2;

      // Header-tolerant extraction helper
      const getField = (possibleNames) => {
        for (const key of Object.keys(row)) {
          const normalizedKey = key.trim().toLowerCase().replace(/[\s_-]/g, '');
          for (const name of possibleNames) {
            if (normalizedKey === name.toLowerCase().replace(/[\s_-]/g, '')) {
              return String(row[key]).trim();
            }
          }
        }
        return '';
      };

      const rawEmail = getField(['email', 'mail', 'useremail', 'e-mail']);
      const rawRole = getField(['role', 'userrole', 'designation', 'type']);
      const rawName = getField(['name', 'fullname', 'username', 'displayname']);
      const rawDepartment = getField(['department', 'dept', 'team', 'group']);
      const rawProduct = getField(['product', 'productname', 'productid', 'project', 'app']);
      const rawStatus = getField(['status', 'state', 'userstatus']);

      // 1. Email check
      if (!rawEmail) {
        errors.push({
          row: rowNumber,
          email: null,
          reason: 'Email column is required and was empty'
        });
        continue;
      }

      const email = rawEmail.toLowerCase();

      if (!emailRegex.test(email)) {
        errors.push({
          row: rowNumber,
          email,
          reason: 'Invalid email address format'
        });
        continue;
      }

      // 2. Duplicate checks
      if (processedEmailsInBatch.has(email)) {
        errors.push({
          row: rowNumber,
          email,
          reason: 'Duplicate email entry within the same Excel spreadsheet'
        });
        continue;
      }

      if (existingEmailSet.has(email)) {
        errors.push({
          row: rowNumber,
          email,
          reason: 'Product user with this email already exists in database'
        });
        continue;
      }

      // 3. Normalization
      const role = rawRole || options.defaultRole || 'User';
      const name = rawName || email.split('@')[0] || 'User';
      const department = rawDepartment || options.defaultDepartment || 'General';
      const product = rawProduct || options.defaultProduct || null;
      
      let status = 'Active';
      if (rawStatus) {
        const validStatuses = ['Active', 'Inactive', 'Pending'];
        const matchedStatus = validStatuses.find(
          (s) => s.toLowerCase() === rawStatus.toLowerCase()
        );
        status = matchedStatus || 'Active';
      }

      processedEmailsInBatch.add(email);

      productUsersToCreate.push({
        name,
        email,
        role,
        department,
        product,
        status
      });
    }

    // Bulk insert into ProductUser collection
    let createdProductUsers = [];
    if (productUsersToCreate.length > 0) {
      createdProductUsers = await ProductUser.insertMany(productUsersToCreate, { ordered: false });

      // Invalidate Redis product-user caches
      cacheService.delByPattern('cache:*product-user*').catch(() => {});

      logger.info(`Bulk imported ${createdProductUsers.length} records into ProductUser collection`);
    }

    return {
      totalRows: rawRows.length,
      importedCount: createdProductUsers.length,
      skippedCount: errors.length,
      errors,
      importedUsers: createdProductUsers.map((u) => u.toJSON ? u.toJSON() : {
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        product: u.product,
        status: u.status,
        createdAt: u.createdAt
      })
    };
  },

  /**
   * Generate downloadable sample Excel spreadsheet template for Product Users
   */
  generateSampleTemplate() {
    const sampleData = [
      {
        Name: 'John Doe',
        Email: 'john.doe@example.com',
        Role: 'Developer',
        Department: 'Engineering',
        Product: 'E-Commerce Platform',
        Status: 'Active'
      },
      {
        Name: 'Jane Smith',
        Email: 'jane.smith@example.com',
        Role: 'Manager',
        Department: 'Product Operations',
        Product: 'Mobile App Suite',
        Status: 'Active'
      },
      {
        Name: 'Robert Brown',
        Email: 'robert.brown@example.com',
        Role: 'User',
        Department: 'Customer Success',
        Product: 'Analytics Dashboard',
        Status: 'Pending'
      },
      {
        Name: 'Emily Davis',
        Email: 'emily.davis@example.com',
        Role: 'Admin',
        Department: 'DevOps',
        Product: 'Cloud Infrastructure',
        Status: 'Active'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);

    worksheet['!cols'] = [
      { wch: 20 }, // Name
      { wch: 30 }, // Email
      { wch: 18 }, // Role
      { wch: 25 }, // Department
      { wch: 25 }, // Product
      { wch: 12 }  // Status
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Product_Users');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
};
