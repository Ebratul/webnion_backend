import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { prisma } from '../src/app/lib/prisma.js';
import { inquiryNotificationTemplate } from '../src/app/templates/inquiry.template.js';

const API = '/api/v1/inquiries';
const emails = ['only-email@test.dev', 'full@test.dev', 'bad@test.dev'];

afterAll(async () => {
  await prisma.inquiry.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

describe('contact page inquiries', () => {
  it('accepts just an email, as the contact form does', async () => {
    await request(app).post(API).send({ email: 'only-email@test.dev', name: ' ', phone: '', message: '' }).expect(201);
    const saved = await prisma.inquiry.findFirst({ where: { email: 'only-email@test.dev' } });
    expect(saved).toMatchObject({ name: '', phone: '', message: '', budget: null, country: null, existingWebsite: null });
  });

  it('stores the extra project fields', async () => {
    await request(app)
      .post(API)
      .send({ email: 'full@test.dev', name: 'Full Test', budget: '$500 - $1,000', country: 'Bangladesh', existingWebsite: 'example.com', service: 'UI/UX Design' })
      .expect(201);
    const saved = await prisma.inquiry.findFirst({ where: { email: 'full@test.dev' } });
    expect(saved).toMatchObject({ budget: '$500 - $1,000', country: 'Bangladesh', existingWebsite: 'example.com', service: 'UI/UX Design' });
  });

  it('still requires a valid email and checks fields that are filled in', async () => {
    const missing = await request(app).post(API).send({ name: 'No Email' }).expect(400);
    expect(missing.body.errors.map((e: { path: string }) => e.path)).toEqual(['email']);

    const bad = await request(app).post(API).send({ email: 'bad@test.dev', name: 'A', phone: 'abc', message: 'short' }).expect(400);
    expect(bad.body.errors.map((e: { path: string }) => e.path).sort()).toEqual(['message', 'name', 'phone']);
  });

  it('keeps the honeypot working', async () => {
    const before = await prisma.inquiry.count();
    await request(app).post(API).send({ email: 'bad@test.dev', website: 'http://spam.test' }).expect(201);
    expect(await prisma.inquiry.count()).toBe(before);
  });

  it('escapes the new fields in the notification email', () => {
    const html = inquiryNotificationTemplate({
      name: '',
      email: 'a@test.dev',
      phone: '',
      company: null,
      service: null,
      budget: '<b>x</b>',
      country: '<script>',
      existingWebsite: 'javascript:alert(1)"',
      message: '',
      locale: 'en',
    } as never);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>x</b>');
    expect(html).not.toContain('alert(1)"');
  });
});
