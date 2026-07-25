import { CloudinaryService } from '../../services/cloudinary.service.js';
import { generateImageUploadUrl } from '../../controllers/files.controller.js';

jest.mock('../../services/cloudinary.service.js', () => ({
  CloudinaryService: jest.fn().mockImplementation(() => ({
    generateSignedUrl: jest.fn(),
  })),
}));

const cloudinaryInstance = CloudinaryService.mock.results[0].value;

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('generateImageUploadUrl', () => {
  it('returns the signed URL payload', async () => {
    cloudinaryInstance.generateSignedUrl.mockResolvedValue({
      signature: 'sig',
      apiKey: 'key',
      cloudName: 'cloud',
      timestamp: 123,
      folder: 'bookings/images',
    });
    const res = mockRes();

    await generateImageUploadUrl({}, res);

    expect(cloudinaryInstance.generateSignedUrl).toHaveBeenCalledWith({
      folder: 'bookings/images',
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 500 when generating the signed URL fails', async () => {
    cloudinaryInstance.generateSignedUrl.mockRejectedValue(
      new Error('cloudinary down')
    );
    const res = mockRes();

    await generateImageUploadUrl({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
