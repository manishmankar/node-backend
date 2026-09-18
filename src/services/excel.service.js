import * as XLSX from 'xlsx';
import { User } from '../models/user.model.js';
import { hashPassword } from '../utils/token.js';
import { cacheService } from './cache.service.js';
import { logger } from '../utils/logger.js';

export const excelService = {
  /**
   * Parse uploaded Excel spreadsheet buffer and bulk-import users
   * @param {Buffer} fileBuffer - Spreadsheet file buffer
   * @param {Object} [options] - Default fallback options
   * @returns {Promise<Object>} Import summary & results
   */
  async parseAndImportUsers(fileBuffer, options = {}) {
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      const error = new Error('No spreadsheet file buffer provided');
      error.statusCode = 400;
      throw error;
    }

    // Read Excel workbook from buffer
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
    const validRoles = ['User', 'Developer', 'Manager', 'Admin'];

    const errors = [];
    const usersToCreate = [];
    const processedEmailsInBatch = new Set();

    // Fetch all existing emails in DB in a single query for fast duplicate checking
    const existingUsers = await User.find({}, { email: 1 }).lean();
    const existingEmailSet = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const rowNumber = i + 2; // +2 accounting for 1-based index and header row

      // Helper to extract value regardless of column capitalization or spacing
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
      const rawPassword = getField(['password', 'pass', 'temporarypassword']);

      // 1. Email validation
      if (!rawEmail) {
        errors.push({
          row: rowNumber,
          email: null,
          reason: 'Email is required and was empty'
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

      // 2. Duplicate checking (within file & in DB)
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
          reason: 'User with this email already exists in database'
        });
        continue;
      }

      // 3. Normalize Role
      let role = 'User';
      if (rawRole) {
        const matchedRole = validRoles.find(
          (r) => r.toLowerCase() === rawRole.toLowerCase()
        );
        role = matchedRole || options.defaultRole || 'User';
      } else if (options.defaultRole) {
        role = options.defaultRole;
      }

      // 4. Normalize Name (fallback: derived from email local part)
      const name = rawName || email.split('@')[0] || 'User';

      // 5. Normalize Department
      const department = rawDepartment || options.defaultDepartment || 'General';

      // 6. Normalize Product
      const product = rawProduct || options.defaultProduct || null;

      // 7. Password handling & hashing
      const plainPassword = rawPassword || options.defaultPassword || 'Welcome@123';
      const hashedPassword = await hashPassword(plainPassword);

      processedEmailsInBatch.add(email);

      usersToCreate.push({
        name,
        email,
        password: hashedPassword,
        role,
        department,
        product
      });
    }

    // Bulk insert validated users
    let createdUsers = [];
    if (usersToCreate.length > 0) {
      createdUsers = await User.insertMany(usersToCreate, { ordered: false });

      // Invalidate Redis user caches
      cacheService.delByPattern('cache:*users*').catch(() => {});

      logger.info(`Bulk imported ${createdUsers.length} users from Excel spreadsheet`);
    }

    return {
      totalRows: rawRows.length,
      importedCount: createdUsers.length,
      skippedCount: errors.length,
      errors,
      importedUsers: createdUsers.map((u) => u.toJSON ? u.toJSON() : {
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        department: u.department,
        product: u.product,
        createdAt: u.createdAt
      })
    };
  },

  /**
   * Generate downloadable sample Excel spreadsheet template
   * @returns {Buffer} Excel file binary buffer
   */
  generateSampleTemplate() {
    const sampleData = [
      {
        Name: 'Alice Johnson',
        Email: 'alice.johnson@example.com',
        Role: 'Developer',
        Department: 'Engineering',
        Product: 'E-Commerce Platform',
        Password: 'Password123!'
      },
      {
        Name: 'Bob Smith',
        Email: 'bob.smith@example.com',
        Role: 'Manager',
        Department: 'Product Management',
        Product: 'Mobile App Suite',
        Password: 'Password123!'
      },
      {
        Name: 'Carol White',
        Email: 'carol.white@example.com',
        Role: 'User',
        Department: 'Customer Success',
        Product: 'Analytics Dashboard',
        Password: 'Password123!'
      },
      {
        Name: 'David Lee',
        Email: 'david.lee@example.com',
        Role: 'Admin',
        Department: 'DevOps',
        Product: 'Cloud Infrastructure',
        Password: 'Password123!'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);

    // Set column widths for clean readability
    worksheet['!cols'] = [
      { wch: 20 }, // Name
      { wch: 30 }, // Email
      { wch: 15 }, // Role (User, Developer, Manager, Admin)
      { wch: 25 }, // Department
      { wch: 25 }, // Product
      { wch: 18 }  // Password
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Product_Users');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
};
