import { transporter } from '../config/mail.config.js';

export class MailService {
  constructor() {
    this.transporter = transporter;
  }

  async sendResetPasswordEmail(to, token) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to,
        subject: 'Reset your password',
        html: `
            <h1>Reset your password</h1>
            <p>Click <a href="${process.env.FRONTEND_URL}/reset-password?token=${token}">here</a> to reset your password</p>
            `,
      };
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending reset password email:', error);
    }
  }
}
