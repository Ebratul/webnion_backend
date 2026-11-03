import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/app/lib/prisma.js';

const API = '/api/v1';
const ADMIN = { email: 'admin@test.dev', password: 'correct-horse-battery' };

const validInquiry = {
  name: 'Test Client',
  email: 'CLIENT@Example.com',
  phone: '+880 1774-029768',
  message: 'We need a new e-commerce website for our store.',
  locale: 'bn',
};

const faqBody = {
  question: { en: 'Question?', bn: 'প্রশ্ন?' },
  answer: { en: 'Answer.', bn: 'উত্তর।' },
};

const loginAs = async (credentials = ADMIN) => {
  const res = await request(app).post(`${API}/auth/login`).send(credentials);
  return res.body.data.token as string;
};

beforeAll(async () => {
  await prisma.inquiry.deleteMany();
  await prisma.faq.deleteMany();
  await prisma.user.deleteMany();
  await prisma.user.createMany({
    data: [
      { name: 'Admin', email: ADMIN.email, role: 'ADMIN', passwordHash: await bcrypt.hash(ADMIN.password, 4) },
      { name: 'Editor', email: 'editor@test.dev', role: 'EDITOR', passwordHash: await bcrypt.hash(ADMIN.password, 4) },
      { name: 'Gone', email: 'gone@test.dev', isActive: false, passwordHash: await bcrypt.hash(ADMIN.password, 4) },
    ],
  });
});

afterAll(() => prisma.$disconnect());

describe('health and errors', () => {
  it('reports health', async () => {
    await request(app).get('/health').expect(200);
  });

  it('returns JSON 404 for unknown routes', async () => {
    const res = await request(app).get(`${API}/nope`).expect(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for malformed JSON without leaking details', async () => {
    const res = await request(app)
      .post(`${API}/inquiries`)
      .set('Content-Type', 'application/json')
      .send('{"name":')
      .expect(400);
    expect(res.body.message).toBe('Request could not be read');
  });
});

describe('inquiries', () => {
  it('stores a valid inquiry and normalizes the email', async () => {
    await request(app).post(`${API}/inquiries`).send(validInquiry).expect(201);
    const saved = await prisma.inquiry.findFirst({ where: { name: 'Test Client' } });
    expect(saved).toMatchObject({ email: 'client@example.com', locale: 'bn', status: 'NEW' });
  });

  it('accepts but drops honeypot submissions', async () => {
    const before = await prisma.inquiry.count();
    await request(app).post(`${API}/inquiries`).send({ ...validInquiry, website: 'http://spam.test' }).expect(201);
    expect(await prisma.inquiry.count()).toBe(before);
  });

  it('rejects invalid fields with per-field errors', async () => {
    const res = await request(app)
      .post(`${API}/inquiries`)
      .send({ name: 'A', email: 'nope', phone: 'abc', message: 'short' })
      .expect(400);
    expect(res.body.errors.map((e: { path: string }) => e.path).sort()).toEqual(['email', 'message', 'name', 'phone']);
  });

  it('rejects attempts to set internal fields', async () => {
    await request(app).post(`${API}/inquiries`).send({ ...validInquiry, status: 'CLOSED' }).expect(400);
  });

  it('keeps the inquiry list private', async () => {
    await request(app).get(`${API}/inquiries`).expect(401);
    const res = await request(app).get(`${API}/inquiries`).set('Authorization', `Bearer ${await loginAs()}`).expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe('auth', () => {
  it('rejects wrong passwords and unknown emails identically', async () => {
    const wrong = await request(app).post(`${API}/auth/login`).send({ ...ADMIN, password: 'wrong' }).expect(401);
    const unknown = await request(app).post(`${API}/auth/login`).send({ email: 'x@test.dev', password: 'wrong' }).expect(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('rejects deactivated users', async () => {
    await request(app).post(`${API}/auth/login`).send({ email: 'gone@test.dev', password: ADMIN.password }).expect(401);
  });

  it('never returns the password hash', async () => {
    const res = await request(app).post(`${API}/auth/login`).send(ADMIN).expect(200);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    await request(app).get(`${API}/auth/me`).set('Authorization', `Bearer ${res.body.data.token}`).expect(200);
  });

  it('rejects forged tokens', async () => {
    await request(app).get(`${API}/auth/me`).set('Authorization', 'Bearer not.a.token').expect(401);
  });

  it('limits user management to admins', async () => {
    const editor = await loginAs({ email: 'editor@test.dev', password: ADMIN.password });
    await request(app).get(`${API}/users`).set('Authorization', `Bearer ${editor}`).expect(403);
    await request(app).get(`${API}/users`).set('Authorization', `Bearer ${await loginAs()}`).expect(200);
  });
});

describe('content', () => {
  it('requires auth to write', async () => {
    await request(app).post(`${API}/faqs`).send(faqBody).expect(401);
  });

  it('runs the full lifecycle and localizes public reads', async () => {
    const token = `Bearer ${await loginAs()}`;

    const created = await request(app).post(`${API}/faqs`).set('Authorization', token).send(faqBody).expect(201);
    const { id } = created.body.data;

    const bn = await request(app).get(`${API}/faqs?locale=bn`).expect(200);
    expect(bn.body.data).toContainEqual({ id, question: 'প্রশ্ন?', answer: 'উত্তর।' });

    const en = await request(app).get(`${API}/faqs`).expect(200);
    expect(en.body.data).toContainEqual({ id, question: 'Question?', answer: 'Answer.' });

    await request(app).patch(`${API}/faqs/${id}`).set('Authorization', token).send({ isActive: false }).expect(200);
    const hidden = await request(app).get(`${API}/faqs`).expect(200);
    expect(hidden.body.data).toHaveLength(0);

    await request(app).delete(`${API}/faqs/${id}`).set('Authorization', token).expect(200);
    await request(app).delete(`${API}/faqs/${id}`).set('Authorization', token).expect(404);
  });

  it('rejects unsafe asset and link URLs', async () => {
    const token = `Bearer ${await loginAs()}`;
    const res = await request(app)
      .post(`${API}/clients`)
      .set('Authorization', token)
      .send({ name: 'Bad', logo: 'javascript:alert(1)', url: 'javascript:alert(1)' })
      .expect(400);
    expect(res.body.errors.map((e: { path: string }) => e.path).sort()).toEqual(['logo', 'url']);
  });

  it('rejects a malformed id', async () => {
    const token = `Bearer ${await loginAs()}`;
    await request(app).patch(`${API}/faqs/not-a-uuid`).set('Authorization', token).send({}).expect(400);
  });

  it('serves the aggregated homepage payload', async () => {
    const res = await request(app).get(`${API}/home?locale=bn`).expect(200);
    expect(Object.keys(res.body.data).sort()).toEqual(
      ['clients', 'deliveryStories', 'faqs', 'pricingPlans', 'projects', 'services', 'team', 'testimonials'].sort(),
    );
  });
});
