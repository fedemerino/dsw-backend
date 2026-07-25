import {
  signUpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../../schemas/auth.schema.js';

describe('signUpSchema', () => {
  it('accepts a valid payload', () => {
    const result = signUpSchema.safeParse({
      email: 'user@example.com',
      fullName: 'John Doe',
      password: 'password123',
      confirmPassword: 'password123',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = signUpSchema.safeParse({
      email: 'not-an-email',
      fullName: 'John Doe',
      password: 'password123',
      confirmPassword: 'password123',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a short password', () => {
    const result = signUpSchema.safeParse({
      email: 'user@example.com',
      fullName: 'John Doe',
      password: '123',
      confirmPassword: '123',
    });

    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts a valid payload', () => {
    expect(
      loginSchema.safeParse({ email: 'user@example.com', password: 'x' })
        .success
    ).toBe(true);
  });

  it('rejects a missing password', () => {
    expect(
      loginSchema.safeParse({ email: 'user@example.com', password: '' }).success
    ).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('rejects an invalid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'nope' }).success).toBe(
      false
    );
  });
});

describe('resetPasswordSchema', () => {
  it('accepts a valid payload', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'abc',
      newPassword: 'password123',
      confirmNewPassword: 'password123',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a short new password', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'abc',
      newPassword: '123',
      confirmNewPassword: '123',
    });

    expect(result.success).toBe(false);
  });
});
