import { v2 as cloudinary } from 'cloudinary';
export class CloudinaryService {
  constructor() {
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new Error(
        'Cloudinary credentials are not set in the environment variables'
      );
    }
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    this.cloudinary = cloudinary;
  }

  /**
   * Generate a signed URL for uploading an image to Cloudinary
   * @param {Object} params - The parameters for the signed URL
   * @param {string} params.folder - The folder to upload the image to
   * @returns {Object} - The signed URL and the API key and cloud name
   */
  async generateSignedUrl({ folder = 'bookings/images' }) {
    const paramsToSign = {
      timestamp: Math.floor(new Date().getTime() / 1000), // Unix timestamp in seconds
      folder, // The folder to upload the image to
    };

    const signature = this.cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    return {
      signature,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      timestamp: paramsToSign.timestamp,
      folder: paramsToSign.folder,
    };
  }
}
