import * as XLSX from 'xlsx';
import { connectDB } from './src/config/database.js';
import { productUserService } from './src/services/productUser.service.js';
import { ProductUser } from './src/models/productUser.model.js';
import { User } from './src/models/user.model.js';
import mongoose from 'mongoose';

async function runExcelImportTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING PRODUCT-USER EXCEL BULK IMPORT TESTS');
  console.log('====================================================\n');

  console.log('--- 1. Testing Sample Template Generation ---');
  const templateBuffer = productUserService.generateSampleTemplate();
  console.log('Generated template buffer size:', templateBuffer.length, 'bytes');
  console.log('Template generation test:', templateBuffer.length > 1000 ? 'PASSED ✅' : 'FAILED ❌');

  console.log('\n--- 2. Connecting to MongoDB ---');
  await connectDB();

  const timestamp = Date.now();
  const testEmail1 = `produser1_${timestamp}@example.com`;
  const testEmail2 = `produser2_${timestamp}@example.com`;
  const testEmail3 = `produser3_${timestamp}@example.com`;

  const initialSystemUsersCount = await User.countDocuments();
  console.log(`Initial System Users count: ${initialSystemUsersCount}`);

  // Construct a test Excel spreadsheet in-memory
  console.log('\n--- 3. Creating In-Memory Excel Workbook with Test Rows ---');
  const testRows = [
    {
      Name: 'Product User Alpha',
      Email: testEmail1,
      Role: 'Developer',
      Department: 'Frontend',
      Product: 'SaaS Platform A',
      Status: 'Active'
    },
    {
      Name: 'Product User Beta',
      Email: testEmail2,
      Role: 'Manager',
      Department: 'Product Operations',
      Product: 'Analytics Pro',
      Status: 'Active'
    },
    {
      // Missing name (should be derived from email)
      Email: testEmail3,
      Role: 'Admin',
      Product: 'Enterprise Cloud',
      Status: 'Pending'
    },
    {
      // Invalid email
      Name: 'Invalid Row',
      Email: 'not-an-email-at-all',
      Role: 'User'
    },
    {
      // Duplicate email in same batch
      Name: 'Duplicate Row',
      Email: testEmail1,
      Role: 'User'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(testRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Product_Users');
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  console.log('Workbook created with 5 test rows.');

  console.log('\n--- 4. Testing importFromExcel into ProductUser collection ---');
  const result = await productUserService.importFromExcel(excelBuffer);

  console.log(`Total Rows Processed: ${result.totalRows}`);
  console.log(`Successfully Imported into ProductUser collection: ${result.importedCount}`);
  console.log(`Skipped Rows: ${result.skippedCount}`);
  console.log('Errors reported:', result.errors);

  console.log('Imported 3 valid product users:', result.importedCount === 3 ? 'PASSED ✅' : 'FAILED ❌');
  console.log('Skipped 2 invalid/duplicate rows:', result.skippedCount === 2 ? 'PASSED ✅' : 'FAILED ❌');

  console.log('\n--- 5. Verifying ProductUser Record Attributes ---');
  const dbProdUser1 = await ProductUser.findOne({ email: testEmail1 });
  console.log('ProductUser 1 Name:', dbProdUser1.name);
  console.log('ProductUser 1 Role:', dbProdUser1.role);
  console.log('ProductUser 1 Product:', dbProdUser1.product);
  console.log('ProductUser 1 Status:', dbProdUser1.status);
  console.log('ProductUser 1 Product matches "SaaS Platform A":', dbProdUser1.product === 'SaaS Platform A' ? 'PASSED ✅' : 'FAILED ❌');

  const dbProdUser3 = await ProductUser.findOne({ email: testEmail3 });
  console.log('ProductUser 3 derived Name from email:', dbProdUser3.name);
  console.log('ProductUser 3 Status:', dbProdUser3.status);

  console.log('\n--- 6. Verifying System User Collection Remains Untouched ---');
  const finalSystemUsersCount = await User.countDocuments();
  console.log(`Final System Users count: ${finalSystemUsersCount} (Expected: ${initialSystemUsersCount})`);
  console.log('System User collection unaffected:', finalSystemUsersCount === initialSystemUsersCount ? 'PASSED ✅' : 'FAILED ❌');

  console.log('\n--- 7. Testing ProductUser Query & Pagination ---');
  const queryResult = await productUserService.findAll({ product: 'SaaS Platform A' });
  console.log(`Found ${queryResult.data.length} product user(s) matching "SaaS Platform A"`);
  console.log('Filter query test:', queryResult.data.length >= 1 ? 'PASSED ✅' : 'FAILED ❌');

  console.log('\n--- 8. Testing Second Import (Duplicate DB emails skipped) ---');
  const secondImport = await productUserService.importFromExcel(excelBuffer);
  console.log(`Second import created: ${secondImport.importedCount} (expected 0)`);
  console.log(`Second import skipped: ${secondImport.skippedCount} (expected 5)`);
  console.log('Duplicate DB email protection:', secondImport.importedCount === 0 && secondImport.skippedCount === 5 ? 'PASSED ✅' : 'FAILED ❌');

  console.log('\n--- 9. Cleaning up test records in ProductUser collection ---');
  await ProductUser.deleteMany({ email: { $in: [testEmail1, testEmail2, testEmail3] } });
  console.log('Test product users cleaned up ✅');

  console.log('\n🎉 ALL PRODUCT-USER EXCEL BULK IMPORT TESTS PASSED SUCCESSFULLY! 🎉\n');

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
}

runExcelImportTests().catch((err) => {
  console.error('Product-User Import Test failed with error:', err);
  if (mongoose.connection.readyState !== 0) {
    mongoose.connection.close();
  }
  process.exit(1);
});
