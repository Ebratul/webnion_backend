import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Runs as it does on Vercel: no Cloudinary keys, and a Blob token
vi.hoisted(() => {
  process.env.VERCEL = '1';
  process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
});

const put = vi.hoisted(() => vi.fn());
vi.mock('@vercel/blob', () => ({ put }));

const { app } = await import('../src/app.js');
const { prisma } = await import('../src/app/lib/prisma.js');

const API = '/api/v1';
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const admin = { email: 'blob-admin@test.dev', password: 'correct-horse-battery' };
let token = '';

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: admin.email } });
  await prisma.user.create({ data: { name: 'Admin', email: admin.email, role: 'ADMIN', passwordHash: await bcrypt.hash(admin.password, 4) } });
  token = `Bearer ${(await request(app).post(`${API}/auth/login`).send(admin)).body.data.token}`;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: admin.email } });
  await prisma.$disconnect();
});

describe('uploads on Vercel without Cloudinary', () => {
  it('stores an image in the Blob store, under a random name with the right type', async () => {
    put.mockResolvedValue({ url: 'https://abc.public.blob.vercel-storage.com/uploads/a.png' });
    const res = await request(app).post(`${API}/uploads`).set('Authorization', token).attach('file', png, 'photo.png').expect(201);
    expect(res.body.data).toEqual({ path: 'https://abc.public.blob.vercel-storage.com/uploads/a.png', kind: 'image' });
    expect(put.mock.calls[0]![0]).toMatch(/^uploads\/[0-9a-f-]{36}\.png$/);
    expect(put.mock.calls[0]![2]).toMatchObject({ access: 'public', contentType: 'image/png' });
  });

  it('still refuses a file that is not an image or video', async () => {
    put.mockClear();
    await request(app).post(`${API}/uploads`).set('Authorization', token).attach('file', Buffer.from('<svg></svg>'), 'x.png').expect(400);
    expect(put).not.toHaveBeenCalled();
  });
});
