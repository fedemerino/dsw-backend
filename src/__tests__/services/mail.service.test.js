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
