/**
 * Responsive HTML Email Templates
 */

export const getWelcomeEmailTemplate = ({ name, email, role, department }) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Node API</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px; color: #333333; }
      .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
      .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 30px 20px; text-align: center; color: #ffffff; }
      .header h1 { margin: 0; font-size: 26px; font-weight: 700; }
      .content { padding: 30px 25px; line-height: 1.6; }
      .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0; }
      .card-item { margin: 8px 0; font-size: 15px; }
      .card-label { font-weight: 600; color: #475569; width: 110px; display: inline-block; }
      .badge { background: #e0e7ff; color: #4338ca; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 13px; }
      .btn { display: inline-block; background: #4f46e5; color: #ffffff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 15px 0; }
      .footer { background: #f8fafc; padding: 15px 20px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🎉 Welcome Aboard, ${name}!</h1>
      </div>
      <div class="content">
        <p>Hello <strong>${name}</strong>,</p>
        <p>Thank you for registering with <strong>Node.js Express API</strong>. Your account has been created successfully and is now active.</p>
        
        <div class="card">
          <div class="card-item"><span class="card-label">Email:</span> ${email}</div>
          <div class="card-item"><span class="card-label">Role:</span> <span class="badge">${role || 'User'}</span></div>
          <div class="card-item"><span class="card-label">Department:</span> ${department || 'General'}</div>
        </div>

        <p>You can now log in using your registered email and password to access the platform endpoints and APIs.</p>
        
        <p style="text-align: center;">
          <a href="http://localhost:5000/api/auth/login" class="btn">Go to Login</a>
        </p>

        <p>If you have any questions or require assistance, please feel free to reach out to our team.</p>
        <p>Best regards,<br><strong>Node.js API Team</strong></p>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} Node.js REST API System. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `;
};

export const getPasswordResetEmailTemplate = ({ name, resetToken, expiresInMinutes = 15 }) => {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Request</title>
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px; color: #333333; }
      .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
      .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px 20px; text-align: center; color: #ffffff; }
      .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
      .content { padding: 30px 25px; line-height: 1.6; }
      .token-box { background: #fef2f2; border: 1px dashed #f87171; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center; word-break: break-all; font-family: monospace; font-size: 15px; color: #991b1b; }
      .warning { font-size: 13px; color: #64748b; background: #f8fafc; padding: 12px; border-radius: 6px; margin-top: 15px; }
      .footer { background: #f8fafc; padding: 15px 20px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🔒 Password Reset Request</h1>
      </div>
      <div class="content">
        <p>Hello <strong>${name || 'User'}</strong>,</p>
        <p>We received a request to reset the password for your account. Use the secure reset token below to set a new password:</p>
        
        <div class="token-box">
          <strong>${resetToken}</strong>
        </div>

        <p>This token is valid for <strong>${expiresInMinutes} minutes</strong>. Please send a <code>POST /api/auth/reset-password</code> request with this token and your new password.</p>

        <div class="warning">
          ⚠️ If you did not request a password reset, please ignore this email. Your account remains secure.
        </div>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} Node.js REST API System. All rights reserved.
      </div>
    </div>
  </body>
  </html>
  `;
};
