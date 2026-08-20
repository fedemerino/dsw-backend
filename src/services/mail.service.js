import { transporter } from '../config/mail.config.js';

const COLORS = {
  pageBg: '#f2eadd',
  cardBg: '#fdfaf3',
  border: '#e0d6c8',
  primary: '#ad3210',
  primaryForeground: '#fdfaf4',
  foreground: '#2b1710',
  muted: '#f2eadd',
  mutedForeground: '#725745',
};

const FONT_DISPLAY = "'Fraunces', Georgia, 'Times New Roman', serif";
const FONT_SANS =
  "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Wraps transactional email content in the ReservAR brand layout: a
 * table-based, inline-styled shell (for email client compatibility) with a
 * wordmark header, serif heading, body content and an optional CTA button.
 * @param {{ preheader: string, heading: string, bodyHtml: string, ctaLabel?: string, ctaUrl?: string }} params
 */
function renderEmailLayout({ preheader, heading, bodyHtml, ctaLabel, ctaUrl }) {
  const cta =
    ctaLabel && ctaUrl
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0 4px;">
          <tr>
            <td style="border-radius: 10px; background-color: ${COLORS.primary};">
              <a href="${ctaUrl}" target="_blank" style="display: inline-block; padding: 13px 28px; font-family: ${FONT_SANS}; font-size: 15px; font-weight: 600; color: ${COLORS.primaryForeground}; text-decoration: none; border-radius: 10px;">${ctaLabel}</a>
            </td>
          </tr>
        </table>`
      : '';

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${heading}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: ${COLORS.pageBg}; font-family: ${FONT_SANS};">
    <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${COLORS.pageBg};">
      <tr>
        <td align="center" style="padding: 40px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width: 600px; max-width: 100%; background-color: ${COLORS.cardBg}; border: 1px solid ${COLORS.border}; border-radius: 16px; overflow: hidden;">
            <tr>
              <td style="padding: 32px 40px 8px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width: 32px; height: 32px; background-color: ${COLORS.primary}; border-radius: 8px; text-align: center; vertical-align: middle;">
                      <span style="font-family: ${FONT_DISPLAY}; font-size: 16px; font-weight: 700; color: ${COLORS.primaryForeground}; line-height: 32px;">R</span>
                    </td>
                    <td style="padding-left: 10px; font-family: ${FONT_DISPLAY}; font-size: 20px; font-weight: 600; color: ${COLORS.foreground};">ReservAR</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 40px 40px;">
                <h1 style="margin: 0 0 16px; font-family: ${FONT_DISPLAY}; font-size: 26px; font-weight: 600; color: ${COLORS.foreground}; line-height: 1.3;">${heading}</h1>
                <div style="font-family: ${FONT_SANS}; font-size: 15px; line-height: 1.65; color: ${COLORS.foreground};">
                  ${bodyHtml}
                </div>
                ${cta}
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 40px 28px; border-top: 1px solid ${COLORS.border};">
                <p style="margin: 0; font-family: ${FONT_SANS}; font-size: 12px; color: ${COLORS.mutedForeground};">
                  Este es un mensaje automático de ReservAR, no hace falta que lo respondas.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * A muted, rounded box used to list reservation details (dates, price).
 * @param {[string, string][]} rows - [label, value] pairs
 */
function renderDetailsBox(rows) {
  const items = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding: 6px 0; font-family: ${FONT_SANS}; font-size: 14px; color: ${COLORS.mutedForeground};">${label}</td>
          <td align="right" style="padding: 6px 0; font-family: ${FONT_SANS}; font-size: 14px; font-weight: 600; color: ${COLORS.foreground};">${value}</td>
        </tr>`
    )
    .join('');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px; background-color: ${COLORS.muted}; border-radius: 12px;">
      <tr>
        <td style="padding: 16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${items}
          </table>
        </td>
      </tr>
    </table>`;
}

const formatDate = (date) => new Date(date).toLocaleDateString('es-AR');
const formatPrice = (price) => `$${Number(price).toLocaleString('es-AR')}`;

export class MailService {
  constructor() {
    this.transporter = transporter;
  }

  async sendResetPasswordEmail(to, token) {
    try {
      const html = renderEmailLayout({
        preheader: 'Restablecé tu contraseña de ReservAR.',
        heading: 'Restablecé tu contraseña',
        bodyHtml: `
          <p style="margin: 0 0 12px;">Recibimos una solicitud para restablecer la contraseña de tu cuenta. Hacé click en el botón para elegir una nueva.</p>
          <p style="margin: 0; color: ${COLORS.mutedForeground};">Si no fuiste vos quien lo solicitó, podés ignorar este correo — tu contraseña actual sigue siendo válida.</p>
        `,
        ctaLabel: 'Restablecer contraseña',
        ctaUrl: `${process.env.FRONTEND_URL}/reset-password?token=${token}`,
      });
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject: 'Restablecé tu contraseña',
        html,
      });
    } catch (error) {
      console.error('Error sending reset password email:', error);
    }
  }

  async sendVerificationEmail(to, token) {
    try {
      const html = renderEmailLayout({
        preheader: 'Confirmá tu cuenta para empezar a usar ReservAR.',
        heading: 'Confirmá tu cuenta',
        bodyHtml: `
          <p style="margin: 0 0 12px;">¡Gracias por sumarte a ReservAR! Confirmá tu dirección de email para activar tu cuenta y empezar a reservar o publicar alojamientos.</p>
          <p style="margin: 0; color: ${COLORS.mutedForeground};">Este enlace vence en 24 horas.</p>
        `,
        ctaLabel: 'Confirmar mi cuenta',
        ctaUrl: `${process.env.FRONTEND_URL}/verify-email?token=${token}`,
      });
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject: 'Confirmá tu cuenta',
        html,
      });
    } catch (error) {
      console.error('Error sending verification email:', error);
    }
  }

  /**
   * Notifies a host that they received a new booking.
   * @param {string} to - Host's email
   * @param {{ guestName: string, listingTitle: string, startDate: string|Date, endDate: string|Date, totalPrice: number }} details
   */
  async sendBookingCreatedEmail(
    to,
    { guestName, listingTitle, startDate, endDate, totalPrice }
  ) {
    try {
      const html = renderEmailLayout({
        preheader: `${guestName} reservó ${listingTitle}.`,
        heading: 'Tenés una nueva reserva',
        bodyHtml: `
          <p style="margin: 0;"><strong>${guestName}</strong> reservó <strong>${listingTitle}</strong>.</p>
          ${renderDetailsBox([
            ['Check-in', formatDate(startDate)],
            ['Check-out', formatDate(endDate)],
            ['Total', formatPrice(totalPrice)],
          ])}
          <p style="margin: 16px 0 0; color: ${COLORS.mutedForeground};">Se confirma automáticamente cuando se acredite el pago.</p>
        `,
        ctaLabel: 'Ver mis reservas',
        ctaUrl: `${process.env.FRONTEND_URL}/profile/host-bookings`,
      });
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject: `Nueva reserva en "${listingTitle}"`,
        html,
      });
    } catch (error) {
      console.error('Error sending booking created email:', error);
    }
  }

  /**
   * Notifies a guest that their payment was confirmed and the booking is CONFIRMED.
   * @param {string} to - Guest's email
   * @param {{ listingTitle: string, startDate: string|Date, endDate: string|Date, totalPrice: number }} details
   */
  async sendPaymentConfirmedEmail(
    to,
    { listingTitle, startDate, endDate, totalPrice }
  ) {
    try {
      const html = renderEmailLayout({
        preheader: `Tu reserva en ${listingTitle} está confirmada.`,
        heading: '¡Tu reserva está confirmada!',
        bodyHtml: `
          <p style="margin: 0;">Se acreditó el pago de tu reserva en <strong>${listingTitle}</strong>.</p>
          ${renderDetailsBox([
            ['Check-in', formatDate(startDate)],
            ['Check-out', formatDate(endDate)],
            ['Total', formatPrice(totalPrice)],
          ])}
        `,
        ctaLabel: 'Ver mi reserva',
        ctaUrl: `${process.env.FRONTEND_URL}/profile/bookings`,
      });
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject: `Reserva confirmada: ${listingTitle}`,
        html,
      });
    } catch (error) {
      console.error('Error sending payment confirmed email:', error);
    }
  }

  /**
   * Notifies whoever didn't initiate a booking cancellation (guest, host,
   * or the system via the 24h auto-cancel job).
   * @param {string} to
   * @param {{ listingTitle: string, reason?: string, cancelledByRole: 'guest' | 'host' | 'system' }} details
   */
  async sendBookingCancelledEmail(
    to,
    { listingTitle, reason, cancelledByRole }
  ) {
    try {
      const whoText = {
        guest: 'El huésped canceló la reserva',
        host: 'El anfitrión canceló la reserva',
        system: 'La reserva se canceló automáticamente por falta de pago',
      }[cancelledByRole];

      const html = renderEmailLayout({
        preheader: `${whoText} en ${listingTitle}.`,
        heading: 'Reserva cancelada',
        bodyHtml: `
          <p style="margin: 0;">${whoText} en <strong>${listingTitle}</strong>.</p>
          ${reason ? renderDetailsBox([['Motivo', reason]]) : ''}
        `,
      });
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject: `Reserva cancelada: ${listingTitle}`,
        html,
      });
    } catch (error) {
      console.error('Error sending booking cancelled email:', error);
    }
  }
}
