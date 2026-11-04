import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// A separate folder, so files from this suite are easy to count
vi.hoisted(() => {
  process.env.UPLOAD_DIR = 'uploads-test-cloudinary';
  process.env.CLOUDINARY_CLOUD_NAME = 'demo';
  process.env.CLOUDINARY_API_KEY = 'key';
  process.env.CLOUDINARY_API_SECRET = 'secret';
});

const uploadToCloudinary = vi.hoisted(() => vi.fn());
vi.mock('../src/app/lib/cloudinary.js', () => ({ uploadToCloudinary }));

const { app } = await import('../src/app.js');
const { config } = await import('../src/app/config/index.js');
const { prisma } = await import('../src/app/lib/prisma.js');

const API = '/api/v1';
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const mp4 = Buffer.concat([Buffer.from('00000018', 'hex'), Buffer.from('ftypmp42'), Buffer.alloc(16)]);
const admin = { email: 'cloudinary-admin@test.dev', password: 'correct-horse-battery' };
let token = '';

const filesOnDisk = async () => readdir(config.uploadDir);

beforeAll(async () => {
  await mkdir(config.uploadDir, { recursive: true });
  await prisma.user.deleteMany({ where: { email: admin.email } });
  await prisma.user.create({ data: { name: 'Admin', email: admin.email, role: 'ADMIN', passwordHash: await bcrypt.hash(admin.password, 4) } });
  const res = await request(app).post(`${API}/auth/login`).send(admin);
  token = `Bearer ${res.body.data.token}`;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: admin.email } });
  await prisma.$disconnect();
  await rm(config.uploadDir, { recursive: true, force: true });
});

beforeEach(() => {
  uploadToCloudinary.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('uploads with Cloudinary keys set', () => {
  it('stores an image on Cloudinary and leaves nothing on disk', async () => {
    uploadToCloudinary.mockResolvedValue('https://res.cloudinary.com/demo/image/upload/a.png');
    const res = await request(app).post(`${API}/uploads`).set('Authorization', token).attach('file', png, 'a.png').expect(201);

    expect(res.body.data).toEqual({ path: 'https://res.cloudinary.com/demo/image/upload/a.png', kind: 'image' });
    expect(uploadToCloudinary).toHaveBeenCalledWith(expect.stringContaining('.incoming-'), 'image');
    expect(await filesOnDisk()).toEqual([]);
  });

  it('sends videos as video, whatever the browser claims', async () => {
    uploadToCloudinary.mockResolvedValue('https://res.cloudinary.com/demo/video/upload/a.mp4');
    const res = await request(app).post(`${API}/uploads`).set('Authorization', token).attach('file', mp4, { filename: 'photo.png', contentType: 'image/png' }).expect(201);

    expect(res.body.data.kind).toBe('video');
    expect(uploadToCloudinary).toHaveBeenCalledWith(expect.any(String), 'video');
  });

  it('never sends a rejected file type to Cloudinary', async () => {
    await request(app).post(`${API}/uploads`).set('Authorization', token).attach('file', Buffer.from('<svg></svg>'), 'a.svg').expect(400);
    expect(uploadToCloudinary).not.toHaveBeenCalled();
    expect(await filesOnDisk()).toEqual([]);
  });

  it('reports a Cloudinary failure without leaking details or leftovers', async () => {
    uploadToCloudinary.mockRejectedValue(new Error('Invalid Signature abc123'));
    const res = await request(app).post(`${API}/uploads`).set('Authorization', token).attach('file', png, 'a.png').expect(502);

    expect(res.body.message).toBe('Could not upload to Cloudinary. Please try again.');
    expect(await filesOnDisk()).toEqual([]);
  });

  it('explains a file over the plan limit', async () => {
    uploadToCloudinary.mockRejectedValue(new Error('File size too large. Got 120035318. Maximum is 104857600.'));
    const res = await request(app).post(`${API}/uploads`).set('Authorization', token).attach('file', mp4, 'a.mp4').expect(413);

    expect(res.body.message).toBe('This file is larger than your Cloudinary plan allows');
    expect(await filesOnDisk()).toEqual([]);
  });

  it('requires a login', async () => {
    await request(app).post(`${API}/uploads`).attach('file', png, 'a.png').expect(401);
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });
});
