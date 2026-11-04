import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/app/lib/prisma.js';

const API = '/api/v1/products';
const admin = { email: 'products-admin@test.dev', password: 'correct-horse-battery' };
const text = (en: string, bn: string) => ({ en, bn });
let token = '';

const product = (slug: string, extra: object) => ({
  slug,
  name: text(`${slug} name`, `${slug} নাম`),
  summary: text('A useful tool', 'একটি কাজের টুল'),
  image: '/images/x.webp',
  type: 'plugin',
  category: 'e-commerce',
  ...extra,
});

const names = (res: { body: { data: { products: { slug: string }[] } } }) => res.body.data.products.map((item) => item.slug);

beforeAll(async () => {
  await prisma.product.deleteMany();
  await prisma.user.deleteMany({ where: { email: admin.email } });
  await prisma.user.create({ data: { name: 'Admin', email: admin.email, role: 'ADMIN', passwordHash: await bcrypt.hash(admin.password, 4) } });
  token = `Bearer ${(await request(app).post('/api/v1/auth/login').send(admin)).body.data.token}`;

  for (const row of [
    product('cheap', { price: 10, pricing: 'PAID', type: 'plugin', views: 5 }),
    product('costly', { price: 900, pricing: 'PAID', type: 'web-tool', category: 'developer-tools', isFeatured: true, views: 1 }),
    product('quote', { pricing: 'CONTACT', type: 'custom-software', category: 'management-systems', views: 50 }),
    product('hidden', { price: 1, isActive: false }),
  ]) {
    await request(app).post(API).set('Authorization', token).send(row).expect(201);
  }
});

afterAll(async () => {
  await prisma.product.deleteMany();
  await prisma.user.deleteMany({ where: { email: admin.email } });
  await prisma.$disconnect();
});

describe('products', () => {
  it('lists active products, featured first, with counts and localized text', async () => {
    const res = await request(app).get(`${API}?locale=bn`).expect(200);
    expect(names(res)[0]).toBe('costly');
    expect(names(res)).not.toContain('hidden');
    expect(res.body.data.products[0].name).toBe('costly নাম');
    expect(res.body.data.typeCounts).toEqual({ plugin: 1, 'web-tool': 1, 'custom-software': 1 });
    expect(res.body.data.categoryCounts['e-commerce']).toBe(1);
  });

  it('filters by type, category and pricing', async () => {
    expect(names(await request(app).get(`${API}?type=web-tool`))).toEqual(['costly']);
    expect(names(await request(app).get(`${API}?category=management-systems`))).toEqual(['quote']);
    expect(names(await request(app).get(`${API}?pricing=CONTACT`))).toEqual(['quote']);
  });

  it('searches both languages, ignoring case', async () => {
    expect(names(await request(app).get(`${API}?q=COSTLY`))).toEqual(['costly']);
    expect(names(await request(app).get(`${API}?q=${encodeURIComponent('cheap নাম')}`))).toEqual(['cheap']);
    expect(names(await request(app).get(`${API}?q=nothing-here`))).toEqual([]);
  });

  it('sorts by price with unpriced products last, and by views', async () => {
    expect(names(await request(app).get(`${API}?sort=price_low`))).toEqual(['cheap', 'costly', 'quote']);
    expect(names(await request(app).get(`${API}?sort=price_high`))).toEqual(['costly', 'cheap', 'quote']);
    expect(names(await request(app).get(`${API}?sort=popular`))[0]).toBe('quote');
  });

  it('treats unknown filters from the address as no filter', async () => {
    const res = await request(app).get(`${API}?type=nope&sort=nope&pricing=nope&category[]=x`).expect(200);
    expect(names(res)).toHaveLength(3);
  });

  it('requires a login and valid values to write', async () => {
    await request(app).post(API).send(product('x', {})).expect(401);
    await request(app).post(API).set('Authorization', token).send(product('bad', { type: 'nope' })).expect(400);
    await request(app).post(API).set('Authorization', token).send(product('bad', { image: 'javascript:alert(1)' })).expect(400);
  });
});
