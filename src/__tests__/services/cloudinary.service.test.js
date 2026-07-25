import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryService } from '../../services/cloudinary.service.js';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    utils: { api_sign_request: jest.fn().mockReturnValue('signed-value') },
  },
}));

afterEach(() => {
  jest.clearAllMocks();
});

describe('CloudinaryService', () => {
  it('configures the cloudinary SDK on construction', () => {
    new CloudinaryService();

    expect(cloudinary.config).toHaveBeenCalledWith({
      cloud_name: 'test-cloud',
      api_key: 'test-api-key',
      api_secret: 'test-api-secret',
    });
  });

  it('throws when Cloudinary credentials are missing', async () => {
    const original = { ...process.env };
    delete process.env.CLOUDINARY_CLOUD_NAME;
    jest.resetModules();

    const { CloudinaryService: FreshCloudinaryService } = await import(
      '../../services/cloudinary.service.js'
    );

    expect(() => new FreshCloudinaryService()).toThrow(
      'Cloudinary credentials are not set in the environment variables'
    );

    process.env = original;
  });

  it('generates a signed URL payload for image uploads', async () => {
    const service = new CloudinaryService();

    const result = await service.generateSignedUrl({
      folder: 'bookings/images',
    });

    expect(cloudinary.utils.api_sign_request).toHaveBeenCalledWith(
      expect.objectContaining({ folder: 'bookings/images' }),
      'test-api-secret'
    );
    expect(result).toEqual(
      expect.objectContaining({
        signature: 'signed-value',
        apiKey: 'test-api-key',
        cloudName: 'test-cloud',
        folder: 'bookings/images',
      })
    );
  });

  it('defaults the folder to bookings/images', async () => {
    const service = new CloudinaryService();

    const result = await service.generateSignedUrl({});

    expect(result.folder).toBe('bookings/images');
  });
});
