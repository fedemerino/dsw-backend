import nodemailer from 'nodemailer';

const { GOOGLE_APP_PASSWORD, GOOGLE_APP_USER } = process.env;

if (!GOOGLE_APP_PASSWORD || !GOOGLE_APP_USER) {
  throw new Error('GOOGLE_APP_PASSWORD and GOOGLE_APP_USER are required');
}

export const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: GOOGLE_APP_USER,
    pass: GOOGLE_APP_PASSWORD,
  },
});
