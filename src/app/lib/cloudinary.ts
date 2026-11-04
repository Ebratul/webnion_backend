import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { config } from '../config/index.js';

const VIDEO_CHUNK_SIZE = 20 * 1024 * 1024;
const REQUEST_TIMEOUT = 10 * 60 * 1000;

if (config.cloudinary) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
}

export const uploadToCloudinary = async (filePath: string, kind: 'image' | 'video') => {
  if (!config.cloudinary) throw new Error('Cloudinary is not configured');

  const options = { resource_type: kind, folder: config.cloudinary.folder, timeout: REQUEST_TIMEOUT };

  // upload_large sends big files in chunks. It reports through a callback and returns a stream, and an
  // 'error' event on that stream with no listener would crash the whole API.
  const result =
    kind === 'video'
      ? await new Promise<UploadApiResponse>((resolve, reject) => {
          const stream: unknown = cloudinary.uploader.upload_large(filePath, { ...options, chunk_size: VIDEO_CHUNK_SIZE }, (error, response) => {
            if (error || !response) reject(error ?? new Error('Cloudinary returned no response'));
            else resolve(response);
          });
          (stream as NodeJS.EventEmitter).on('error', reject);
        })
      : await cloudinary.uploader.upload(filePath, options);

  return result.secure_url;
};
