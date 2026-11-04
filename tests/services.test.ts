import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/app/lib/prisma.js';

const API = '/api/v1/services';
const admin = { email: 'services-admin@test.dev', password: 'correct-horse-battery' };
const text = (en: string, bn: string) => ({ en, bn });
let token = '';

const base = {
  title: text('Design', 'ডিজাইন'),
  description: text('We design', 'আমরা ডিজাইন করি'),
  image: '/images/x.webp',
};

beforeAll(async () => {
  await prisma.service.deleteMany({ where: { slug: { startsWith: 'test-' } } });
  await prisma.user.deleteMany({ where: { email: admin.email } });
  await prisma.user.create({ data: { name: 'Admin', email: admin.email, role: 'ADMIN', passwordHash: await bcrypt.hash(admin.password, 4) } });
  token = `Bearer ${(await request(app).post('/api/v1/auth/login').send(admin)).body.data.token}`;

  await request(app)
    .post(API)
    .set('Authorization', token)
    .send({
      ...base,
      slug: 'test-full',
      content: { en: [{ type: 'paragraph', text: 'English body' }], bn: [{ type: 'paragraph', text: 'বাংলা লেখা' }] },
      faqs: {
        en: [
          { type: 'heading', text: 'Why?' },
          { type: 'paragraph', text: 'First part.' },
          { type: 'paragraph', text: 'Second part.' },
          { type: 'heading', text: 'No answer yet?' },
        ],
      },
    })
    .expect(201);
  await request(app).post(API).set('Authorization', token).send({ ...base, slug: 'test-plain' }).expect(201);
  await request(app).post(API).set('Authorization', token).send({ ...base, slug: 'test-hidden', isActive: false }).expect(201);
});

afterAll(async () => {
  await prisma.service.deleteMany({ where: { slug: { startsWith: 'test-' } } });
  await prisma.user.deleteMany({ where: { email: admin.email } });
  await prisma.$disconnect();
});

describe('service detail', () => {
  it('returns localized content and turns FAQ blocks into questions and answers', async () => {
    const { body } = await request(app).get(`${API}/test-full?locale=bn`).expect(200);
    expect(body.data.title).toBe('ডিজাইন');
    expect(body.data.content).toEqual([{ type: 'paragraph', text: 'বাংলা লেখা' }]);
    expect(body.data.contentLocale).toBe('bn');
    expect(body.data.faqs).toEqual([{ question: 'Why?', answer: 'First part. Second part.' }]);
    expect(body.data.faqsLocale).toBe('en');
  });

  it('works for a service with no details yet', async () => {
    const { body } = await request(app).get(`${API}/test-plain`).expect(200);
    expect(body.data.content).toEqual([]);
    expect(body.data.faqs).toEqual([]);
  });

  it('hides inactive and unknown services, and rejects a bad address', async () => {
    await request(app).get(`${API}/test-hidden`).expect(404);
    await request(app).get(`${API}/test-nothing`).expect(404);
    await request(app).get(`${API}/NOT_VALID`).expect(400);
  });

  it('keeps details out of the list and the staff list route working', async () => {
    const { body } = await request(app).get(API).expect(200);
    expect(body.data.find((row: { slug: string }) => row.slug === 'test-full').content).toBeUndefined();
    await request(app).get(`${API}/all`).expect(401);
    await request(app).get(`${API}/all`).set('Authorization', token).expect(200);
  });

  it('can clear details and rejects unsafe images', async () => {
    const { body } = await request(app).get(`${API}/all`).set('Authorization', token);
    const { id } = body.data.find((row: { slug: string }) => row.slug === 'test-full');
    await request(app).patch(`${API}/${id}`).set('Authorization', token).send({ content: { en: [{ type: 'image', src: 'javascript:alert(1)' }] } }).expect(400);
    await request(app).patch(`${API}/${id}`).set('Authorization', token).send({ faqs: null }).expect(200);
    expect((await request(app).get(`${API}/test-full`)).body.data.faqs).toEqual([]);
  });
});
