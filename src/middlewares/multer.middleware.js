import multer from 'multer';
import path from 'path';
import fs from 'fs';
const uploadPath = path.join(process.cwd(), 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

/**
 * Multer middleware
 * @param {Object} params - Multer parameters
 * @returns {Object} - Multer middleware
 */
export const uploader = (params) => multer({ ...params, storage });
