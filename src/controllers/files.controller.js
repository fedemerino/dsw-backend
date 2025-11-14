import { CloudinaryService } from '../services/cloudinary.service.js';

const cloudinaryService = new CloudinaryService();

/**
 * Generates a signed URL for uploading an image to Cloudinary
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Object} The signed URL and the API key and cloud name
 */
export const generateImageUploadUrl = async (req, res) => {
  try {
    const signedUrlData = await cloudinaryService.generateSignedUrl({
      folder: 'bookings/images',
    });
    res.status(200).json(signedUrlData);
  } catch (error) {
    console.error('Error generating signed URL:', error);
    res.status(500).json({ error: 'Error generating image upload URL' });
  }
};
