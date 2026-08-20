import { MailService } from '../../services/mail.service.js';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({ sendMail: jest.fn() }),
}));

afterEach(() => {
  jest.clearAllMocks();
});

describe('MailService.sendResetPasswordEmail', () => {
  it('sends an email with a link containing the reset token', async () => {
    const service = new MailService();
    service.transporter.sendMail.mockResolvedValue({});

    await service.sendResetPasswordEmail('user@example.com', 'reset-token-123');

    expect(service.transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.any(String),
        html: expect.stringContaining('reset-token-123'),
      })
    );
  });

  it('does not throw when sending fails', async () => {
    const service = new MailService();
    service.transporter.sendMail.mockRejectedValue(new Error('smtp down'));

    await expect(
      service.sendResetPasswordEmail('user@example.com', 'reset-token-123')
    ).resolves.toBeUndefined();
  });
});

describe('MailService.sendVerificationEmail', () => {
  it('sends an email with a link containing the verification token', async () => {
    const service = new MailService();
    service.transporter.sendMail.mockResolvedValue({});

    await service.sendVerificationEmail('user@example.com', 'verify-token-123');

    expect(service.transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: expect.any(String),
        html: expect.stringContaining('verify-token-123'),
      })
    );
  });

  it('does not throw when sending fails', async () => {
    const service = new MailService();
    service.transporter.sendMail.mockRejectedValue(new Error('smtp down'));

    await expect(
      service.sendVerificationEmail('user@example.com', 'verify-token-123')
    ).resolves.toBeUndefined();
  });
});

describe('MailService.sendBookingCreatedEmail', () => {
  it('notifies the host with the guest and listing details', async () => {
    const service = new MailService();
    service.transporter.sendMail.mockResolvedValue({});

    await service.sendBookingCreatedEmail('host@example.com', {
      guestName: 'Jane Doe',
      listingTitle: 'Cozy loft',
      startDate: '2027-01-10',
      endDate: '2027-01-15',
      totalPrice: 500,
    });

    expect(service.transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'host@example.com',
        html: expect.stringContaining('Jane Doe'),
      })
    );
  });

  it('does not throw when sending fails', async () => {
    const service = new MailService();
    service.transporter.sendMail.mockRejectedValue(new Error('smtp down'));

    await expect(
      service.sendBookingCreatedEmail('host@example.com', {
        guestName: 'Jane Doe',
        listingTitle: 'Cozy loft',
        startDate: '2027-01-10',
        endDate: '2027-01-15',
        totalPrice: 500,
      })
    ).resolves.toBeUndefined();
  });
});

describe('MailService.sendPaymentConfirmedEmail', () => {
  it('notifies the guest that the booking is confirmed', async () => {
    const service = new MailService();
    service.transporter.sendMail.mockResolvedValue({});

    await service.sendPaymentConfirmedEmail('guest@example.com', {
      listingTitle: 'Cozy loft',
      startDate: '2027-01-10',
      endDate: '2027-01-15',
      totalPrice: 500,
    });

    expect(service.transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'guest@example.com',
        html: expect.stringContaining('Cozy loft'),
      })
    );
  });

  it('does not throw when sending fails', async () => {
    const service = new MailService();
    service.transporter.sendMail.mockRejectedValue(new Error('smtp down'));

    await expect(
      service.sendPaymentConfirmedEmail('guest@example.com', {
        listingTitle: 'Cozy loft',
        startDate: '2027-01-10',
        endDate: '2027-01-15',
        totalPrice: 500,
      })
    ).resolves.toBeUndefined();
  });
});

describe('MailService.sendBookingCancelledEmail', () => {
  it('notifies the host when the guest cancels, with the reason', async () => {
    const service = new MailService();
    service.transporter.sendMail.mockResolvedValue({});

    await service.sendBookingCancelledEmail('host@example.com', {
      listingTitle: 'Cozy loft',
      reason: 'Cambio de planes',
      cancelledByRole: 'guest',
    });

    expect(service.transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'host@example.com',
        html: expect.stringContaining('Cambio de planes'),
      })
    );
  });

  it('notifies the guest when the system auto-cancels, without a reason override', async () => {
    const service = new MailService();
    service.transporter.sendMail.mockResolvedValue({});

    await service.sendBookingCancelledEmail('guest@example.com', {
      listingTitle: 'Cozy loft',
      reason: 'Pago no confirmado dentro de las 24hs',
      cancelledByRole: 'system',
    });

    expect(service.transporter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'guest@example.com',
        html: expect.stringContaining('canceló automáticamente'),
      })
    );
  });

  it('does not throw when sending fails', async () => {
    const service = new MailService();
    service.transporter.sendMail.mockRejectedValue(new Error('smtp down'));

    await expect(
      service.sendBookingCancelledEmail('host@example.com', {
        listingTitle: 'Cozy loft',
        cancelledByRole: 'guest',
      })
    ).resolves.toBeUndefined();
  });
});
