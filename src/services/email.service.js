import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import {
  getWelcomeEmailTemplate,
  getPasswordResetEmailTemplate
} from '../utils/emailTemplates.js';

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initTransporter();
  }

  /**
   * Initialize SMTP transporter
   */
  initTransporter() {
    const { host, port, secure, user, pass } = config.email;

    // Check if user has provided actual SMTP credentials
    if (user && pass && pass !== 'your_app_password') {
      const isGmail = host.includes('gmail') || (user && user.includes('@gmail.com'));

      const transportConfig = isGmail
        ? {
            service: 'gmail',
            auth: { user, pass }
          }
        : {
            host,
            port,
            secure,
            auth: { user, pass }
          };

      this.transporter = nodemailer.createTransport(transportConfig);
      this.isConfigured = true;
      logger.info(`📧 Email service initialized (${isGmail ? 'Gmail Service' : `SMTP Host: ${host}:${port}`}) for ${user}`);
    } else {
      this.isConfigured = false;
      logger.info('📧 Email service in SIMULATION mode (Add EMAIL_USER & EMAIL_PASS in .env to send real emails via SMTP)');
    }
  }

  /**
   * Generic send email method
   */
  async sendMail({ to, subject, text, html }) {
    const mailOptions = {
      from: config.email.from,
      to,
      subject,
      text: text || '',
      html: html || text
    };

    if (this.isConfigured && this.transporter) {
      try {
        const info = await this.transporter.sendMail(mailOptions);
        logger.info(`📧 Email sent successfully to ${to} (Message ID: ${info.messageId})`);
        return { success: true, messageId: info.messageId };
      } catch (error) {
        logger.error(`❌ Failed to send email to ${to}: ${error.message}`);
        return { success: false, error: error.message };
      }
    } else {
      // Development simulation log
      logger.info(`\n======================================================`);
      logger.info(`📧 [SIMULATED EMAIL DISPATCH]`);
      logger.info(`📬 To: ${to}`);
      logger.info(`📝 Subject: ${subject}`);
      logger.info(`👤 From: ${config.email.from}`);
      logger.info(`ℹ️ (To deliver actual emails to inboxes, set EMAIL_USER and EMAIL_PASS in your .env file)`);
      logger.info(`======================================================\n`);
      return { success: true, simulated: true };
    }
  }

  /**
   * Send Welcome Email on Registration
   */
  async sendWelcomeEmail({ to, name, role, department }) {
    const subject = `🎉 Welcome to Node.js API, ${name}!`;
    const html = getWelcomeEmailTemplate({ name, email: to, role, department });
    const text = `Hello ${name},\n\nWelcome to Node.js Express API! Your account with role ${role || 'User'} has been registered successfully.\n\nBest regards,\nNode.js API Team`;

    return this.sendMail({ to, subject, text, html });
  }

  /**
   * Send Password Reset Email
   */
  async sendPasswordResetEmail({ to, name, resetToken, expiresInMinutes = 15 }) {
    const subject = `🔒 Password Reset Request for Your Account`;
    const html = getPasswordResetEmailTemplate({ name, resetToken, expiresInMinutes });
    const text = `Hello ${name},\n\nWe received a password reset request. Your reset token is:\n\n${resetToken}\n\nThis token will expire in ${expiresInMinutes} minutes.\n\nBest regards,\nNode.js API Team`;

    return this.sendMail({ to, subject, text, html });
  }
}

export const emailService = new EmailService();
