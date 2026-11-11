import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import multer from 'multer';
import { put } from '@vercel/blob';
import { config } from '../../config/index.js';
import { uploadToCloudinary } from '../../lib/cloudinary.js';
import { AppError } from '../../utils/AppError.js';

const MB = 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * MB;
const MAX_VIDEO_SIZE = 300 * MB;

// Still-image formats that share the MP4 container header but cannot play as video
const NON_VIDEO_BRANDS = new Set(['heic', 'heix', 'hevc', 'mif1', 'msf1', 'avif']);

// The browser's filename and content type can say anything, so the type comes from the file's first bytes.
// SVG is left out on purpose: it can carry scripts.
const detectType = (head: Buffer): { extension: string; kind: 'image' | 'video' } | null => {
  const hex = head.toString('hex');
  const ascii = head.toString('latin1');
  if (hex.startsWith('ffd8ff')) return { extension: 'jpg', kind: 'image' };
  if (hex.startsWith('89504e470d0a1a0a')) return { extension: 'png', kind: 'image' };
  if (ascii.startsWith('GIF87a') || ascii.startsWith('GIF89a')) return { extension: 'gif', kind: 'image' };
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return { extension: 'webp', kind: 'image' };
  if (hex.startsWith('1a45dfa3')) return { extension: 'webm', kind: 'video' };
  if (ascii.slice(4, 8) === 'ftyp' && !NON_VIDEO_BRANDS.has(ascii.slice(8, 12))) return { extension: 'mp4', kind: 'video' };
  return null;
};

const readHead = async (file: string) => {
  const handle = await open(file, 'r');
  try {
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(12), 0, 12, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};

// Vercel's disk is read-only apart from a temporary folder that is wiped between requests
const onVercel = Boolean(process.env.VERCEL);
const incomingDir = onVercel ? tmpdir() : config.uploadDir;

mkdirSync(incomingDir, { recursive: true });

// Files land under a random name with no extension, and are only named and kept once their content checks out
export const receiveFile = multer({
  storage: multer.diskStorage({
    destination: incomingDir,
    filename: (_req, _file, done) => done(null, `.incoming-${randomUUID()}`),
  }),
  limits: { fileSize: MAX_VIDEO_SIZE, files: 1 },
}).single('file');

const sendToCloudinary = async (tempPath: string, kind: 'image' | 'video') => {
  try {
    return await uploadToCloudinary(tempPath, kind);
  } catch (error) {
    console.error('Cloudinary upload failed', error);
    if (/too large/i.test((error as Error).message ?? '')) throw new AppError(413, 'This file is larger than your Cloudinary plan allows');
    throw new AppError(502, 'Could not upload to Cloudinary. Please try again.');
  }
};

const store = async (tempPath: string) => {
  try {
    const type = detectType(await readHead(tempPath));
    if (!type) throw new AppError(400, 'Upload a JPG, PNG, WebP or GIF image, or an MP4 or WebM video');

    const { size } = await stat(tempPath);
    if (type.kind === 'image' && size > MAX_IMAGE_SIZE) throw new AppError(413, 'Images can be at most 10 MB');

    if (config.cloudinary) {
      const url = await sendToCloudinary(tempPath, type.kind);
      await rm(tempPath, { force: true });
      return { path: url, kind: type.kind };
    }

    // Vercel's disk does not last, so without Cloudinary the file goes to the Blob store that already holds the review videos
    if (process.env.BLOB_READ_WRITE_TOKEN && onVercel) {
      const { url } = await put(`uploads/${randomUUID()}.${type.extension}`, await readFile(tempPath), { access: 'public', contentType: type.kind === 'image' ? `image/${type.extension === 'jpg' ? 'jpeg' : type.extension}` : `video/${type.extension}` });
      await rm(tempPath, { force: true });
      return { path: url, kind: type.kind };
    }

    if (onVercel) throw new AppError(503, 'File uploads are not set up on this server');

    const name = `${randomUUID()}.${type.extension}`;
    await rename(tempPath, path.join(config.uploadDir, name));
    return { path: `/uploads/${name}`, kind: type.kind };
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
};

// Saves a file made on the server, such as an AI picture, the same way as an upload, with the same type check
const storeBuffer = async (data: Buffer) => {
  const tempPath = path.join(incomingDir, `.incoming-${randomUUID()}`);
  await writeFile(tempPath, data);
  return store(tempPath);
};

export const UploadService = { store, storeBuffer };
