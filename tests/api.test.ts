import bcrypt from 'bcryptjs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { config } from '../src/app/config/index.js';
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
      ['blogPosts', 'caseStudies', 'clients', 'deliveryStories', 'faqs', 'heroBackground', 'outcomeCards', 'pricingPlans', 'projects', 'services', 'team', 'technologies', 'testimonials'].sort(),
    );
  });
});

describe('project and case study pages', () => {
  const blocks = [{ type: 'heading', text: 'Overview' }, { type: 'paragraph', text: 'Body.' }];
  const projectBody = {
    slug: 'test-project',
    name: 'Test Project',
    category: { en: 'Store', bn: 'স্টোর' },
    image: '/images/projects/test.webp',
    client: 'Test Client',
    sector: { en: 'Retail', bn: 'রিটেইল' },
    content: { en: blocks },
  };
  const caseStudyBody = {
    slug: 'test-case-study',
    title: { en: 'Title', bn: 'শিরোনাম' },
    category: { en: 'Travel', bn: 'ট্রাভেল' },
    image: '/images/case-studies/test.webp',
    content: { en: blocks, bn: [{ type: 'paragraph', text: 'বাংলা।' }] },
  };

  beforeAll(async () => {
    await prisma.project.deleteMany();
    await prisma.caseStudy.deleteMany();
  });

  it('serves a project by slug, falling back to English content for bn', async () => {
    const token = `Bearer ${await loginAs()}`;
    await request(app).post(`${API}/projects`).set('Authorization', token).send(projectBody).expect(201);

    const res = await request(app).get(`${API}/projects/test-project?locale=bn`).expect(200);
    expect(res.body.data).toMatchObject({ slug: 'test-project', client: 'Test Client', sector: 'রিটেইল', budget: null, contentLocale: 'en' });
    expect(res.body.data.content).toEqual(blocks);
  });

  it('keeps article content out of the list payload', async () => {
    const res = await request(app).get(`${API}/projects`).expect(200);
    expect(res.body.data[0].slug).toBe('test-project');
    expect(res.body.data[0]).not.toHaveProperty('content');
  });

  it('returns 404 for unknown and inactive slugs', async () => {
    const token = `Bearer ${await loginAs()}`;
    await request(app).get(`${API}/projects/missing`).expect(404);
    await request(app).post(`${API}/projects`).set('Authorization', token).send({ ...projectBody, slug: 'hidden', isActive: false }).expect(201);
    await request(app).get(`${API}/projects/hidden`).expect(404);
  });

  it('rejects malformed slugs and content blocks', async () => {
    const token = `Bearer ${await loginAs()}`;
    await request(app).get(`${API}/projects/Not_A_Slug`).expect(400);
    await request(app)
      .post(`${API}/projects`)
      .set('Authorization', token)
      .send({ ...projectBody, slug: 'bad-blocks', content: { en: [{ type: 'html', text: '<script>' }] } })
      .expect(400);
  });

  it('serves a case study in the requested locale', async () => {
    const token = `Bearer ${await loginAs()}`;
    await request(app).post(`${API}/case-studies`).set('Authorization', token).send(caseStudyBody).expect(201);

    const res = await request(app).get(`${API}/case-studies/test-case-study?locale=bn`).expect(200);
    expect(res.body.data).toMatchObject({ title: 'শিরোনাম', contentLocale: 'bn' });
    expect(res.body.data.content).toEqual(caseStudyBody.content.bn);
  });
});

describe('admin editing', () => {
  it('leaves fields out of a PATCH untouched', async () => {
    const token = `Bearer ${await loginAs()}`;
    const created = await request(app)
      .post(`${API}/faqs`)
      .set('Authorization', token)
      .send({ ...faqBody, sortOrder: 7, isActive: false })
      .expect(201);

    const res = await request(app)
      .patch(`${API}/faqs/${created.body.data.id}`)
      .set('Authorization', token)
      .send({ question: { en: 'Changed?', bn: 'বদলেছে?' } })
      .expect(200);
    expect(res.body.data).toMatchObject({ sortOrder: 7, isActive: false });
  });

  it('keeps a user role when the role is not sent', async () => {
    const token = `Bearer ${await loginAs()}`;
    const admin = await prisma.user.create({
      data: { name: 'Second', email: 'second@test.dev', role: 'ADMIN', passwordHash: await bcrypt.hash(ADMIN.password, 4) },
    });
    const res = await request(app).patch(`${API}/users/${admin.id}`).set('Authorization', token).send({ name: 'Renamed' }).expect(200);
    expect(res.body.data).toMatchObject({ name: 'Renamed', role: 'ADMIN' });
  });

  it('clears optional translated fields with null', async () => {
    const token = `Bearer ${await loginAs()}`;
    const created = await request(app)
      .post(`${API}/projects`)
      .set('Authorization', token)
      .send({
        slug: 'clearable',
        name: 'Clearable',
        category: { en: 'Store', bn: 'স্টোর' },
        image: '/uploads/a.png',
        budget: { en: 'Custom', bn: 'কাস্টম' },
        content: { en: [{ type: 'paragraph', text: 'Body.' }] },
      })
      .expect(201);

    const res = await request(app)
      .patch(`${API}/projects/${created.body.data.id}`)
      .set('Authorization', token)
      .send({ budget: null, content: null })
      .expect(200);
    expect(res.body.data).toMatchObject({ budget: null, content: null });
  });
});

describe('site settings', () => {
  const contact = {
    email: 'team@example.com',
    phoneLocal: '01700000000',
    phoneBdLabel: '+880 1700-000000',
    phoneItLabel: '+39 300 000 0000',
    whatsappNumber: '8801700000000',
    facebook: 'https://facebook.com/x',
    instagram: 'https://instagram.com/x',
    privacy: 'https://example.com/privacy',
  };
  let original: Record<string, unknown>;

  beforeAll(async () => {
    original = (await request(app).get(`${API}/site-settings`).expect(200)).body.data;
  });
  afterAll(async () => {
    await prisma.siteSetting.deleteMany({ where: { key: { in: ['contact', 'text'] } } });
    for (const key of ['contact', 'text'] as const) {
      const value = original[key] as object | null;
      if (value && (key !== 'text' || Object.keys((value as { en: object }).en).length || Object.keys((value as { bn: object }).bn).length)) await prisma.siteSetting.create({ data: { key, value } });
    }
  });

  it('saves contact details and custom text, and serves them to the website', async () => {
    const token = `Bearer ${await loginAs()}`;
    await request(app).patch(`${API}/site-settings`).set('Authorization', token).send({ contact, text: { en: { 'hero.primaryCta': 'Go' }, bn: {} } }).expect(200);
    const res = await request(app).get(`${API}/site-settings`).expect(200);
    expect(res.body.data.contact.email).toBe('team@example.com');
    expect(res.body.data.text.en['hero.primaryCta']).toBe('Go');
  });

  it('saves the brand and hidden homepage sections, and refuses a colour that is not a hex code', async () => {
    const token = `Bearer ${await loginAs()}`;
    const brand = { siteName: 'Webnion', primaryColor: '#1A73E8', logoOnDark: '/images/brand/logo-white.png', logoOnLight: '/images/brand/logo-dark.png', favicon: null, shareImage: null, defaultTheme: 'dark' };
    await request(app).patch(`${API}/site-settings`).set('Authorization', token).send({ brand, homepage: { hidden: ['process'] } }).expect(200);
    const res = await request(app).get(`${API}/site-settings`).expect(200);
    expect(res.body.data.brand.primaryColor).toBe('#1a73e8');
    expect(res.body.data.homepage.hidden).toEqual(['process']);
    await request(app).patch(`${API}/site-settings`).set('Authorization', token).send({ brand: { ...brand, primaryColor: 'red; } body { display: none' } }).expect(400);
    await prisma.siteSetting.deleteMany({ where: { key: { in: ['brand', 'homepage'] } } });
  });

  it('saves menus, social links, offices and options, and refuses unsafe links in them', async () => {
    const token = `Bearer ${await loginAs()}`;
    const t = (en: string) => ({ en, bn: en });
    const navigation = {
      header: [{ label: t('Work'), href: '/project' }, { label: t('Prices'), href: '#pricing' }],
      headerButton: { href: '/contact' },
      footerQuick: [{ label: t('Blog'), href: 'https://example.com/blog' }],
      footerServices: [],
      socials: [{ network: 'youtube', url: 'https://youtube.com/@webnion' }],
      offices: [{ name: t('Dhaka'), address: t('Road 5') }],
    };
    const options = { whatsappButton: false, inquiryEmails: ['sales@example.com'], budgets: [t('Under $500')] };
    await request(app).patch(`${API}/site-settings`).set('Authorization', token).send({ navigation, options }).expect(200);
    const res = await request(app).get(`${API}/site-settings`).expect(200);
    expect(res.body.data.navigation.header[1].href).toBe('#pricing');
    expect(res.body.data.options.whatsappButton).toBe(false);
    for (const href of ['javascript:alert(1)', '//evil.example', 'data:text/html,x']) {
      await request(app).patch(`${API}/site-settings`).set('Authorization', token).send({ navigation: { ...navigation, header: [{ label: t('x'), href }] } }).expect(400);
    }
    await request(app).patch(`${API}/site-settings`).set('Authorization', token).send({ navigation: { ...navigation, socials: [{ network: 'myspace', url: 'https://x.com' }] } }).expect(400);
    const status = await request(app).get(`${API}/site-settings/status`).set('Authorization', token).expect(200);
    expect(typeof status.body.data.mailConfigured).toBe('boolean');
    await request(app).get(`${API}/site-settings/status`).expect(401);
    await prisma.siteSetting.deleteMany({ where: { key: { in: ['navigation', 'options'] } } });
  });

  it('needs a login and refuses unsafe links', async () => {
    await request(app).patch(`${API}/site-settings`).send({ contact }).expect(401);
    const token = `Bearer ${await loginAs()}`;
    await request(app).patch(`${API}/site-settings`).set('Authorization', token).send({ contact: { ...contact, facebook: 'javascript:alert(1)' } }).expect(400);
    await request(app).patch(`${API}/site-settings`).set('Authorization', token).send({ text: { en: { 'bad key!': 'x' }, bn: {} } }).expect(400);
  });
});

describe('activity log', () => {
  const faq = { question: { en: 'Log test question', bn: 'লগ' }, answer: { en: 'Answer', bn: 'উত্তর' } };
  const latest = async (token: string, query = '') => (await request(app).get(`${API}/activity-logs?limit=5${query}`).set('Authorization', token).expect(200)).body.data.items as { action: string; summary: string; details: string | null; actorEmail: string | null }[];

  it('records adding, changing, hiding and deleting by name, with no field values', async () => {
    const token = `Bearer ${await loginAs()}`;
    const created = await request(app).post(`${API}/faqs`).set('Authorization', token).send(faq).expect(201);
    expect((await latest(token))[0]).toMatchObject({ action: 'CREATE', summary: 'Added "Log test question" to FAQs' });

    await request(app).patch(`${API}/faqs/${created.body.data.id}`).set('Authorization', token).send({ answer: { en: 'Secret text', bn: 'x' } }).expect(200);
    const [changed] = await latest(token);
    expect(changed).toMatchObject({ action: 'UPDATE', details: 'Changed: answer' });
    expect(JSON.stringify(changed)).not.toContain('Secret text');

    await request(app).patch(`${API}/faqs/${created.body.data.id}`).set('Authorization', token).send({ isActive: false }).expect(200);
    expect((await latest(token))[0]!.summary).toBe('Hid "Log test question" in FAQs');

    await request(app).delete(`${API}/faqs/${created.body.data.id}`).set('Authorization', token).expect(200);
    expect((await latest(token))[0]).toMatchObject({ action: 'DELETE', summary: 'Deleted "Log test question" from FAQs' });
  });

  it('turns a burst of reordering into one line', async () => {
    const token = `Bearer ${await loginAs()}`;
    const rows = (await request(app).get(`${API}/faqs/all`).set('Authorization', token).expect(200)).body.data as { id: string; sortOrder: number }[];
    const before = (await request(app).get(`${API}/activity-logs?limit=1&action=REORDER`).set('Authorization', token)).body.data.total as number;
    await Promise.all(rows.slice(0, 3).map((row) => request(app).patch(`${API}/faqs/${row.id}`).set('Authorization', token).send({ sortOrder: row.sortOrder }).expect(200)));
    const after = (await request(app).get(`${API}/activity-logs?limit=1&action=REORDER`).set('Authorization', token)).body.data.total as number;
    expect(after - before).toBeLessThanOrEqual(1);
  });

  it('records a failed login without the password', async () => {
    await request(app).post(`${API}/auth/login`).send({ email: 'nobody-log@test.dev', password: 'wrong-password-1' }).expect(401);
    const token = `Bearer ${await loginAs()}`;
    const [row] = await latest(token, '&action=LOGIN_FAILED');
    expect(row).toMatchObject({ summary: 'Failed login for nobody-log@test.dev' });
    expect(JSON.stringify(row)).not.toContain('wrong-password-1');
  });

  it('shows the address the admin panel passes on, and ignores one that is not an address', async () => {
    const token = `Bearer ${await loginAs()}`;
    const ipOf = async (forwarded: string) => {
      await request(app).post(`${API}/auth/login`).set('x-webnion-client-ip', forwarded).send({ email: 'ip-test@test.dev', password: 'wrong-password-1' }).expect(401);
      return (await request(app).get(`${API}/activity-logs?limit=1&action=LOGIN_FAILED`).set('Authorization', token)).body.data.items[0].ip as string;
    };
    expect(await ipOf('203.0.113.9')).toBe('203.0.113.9');
    expect(await ipOf('<script>')).not.toContain('script');
  });

  it('does not log a change that was refused', async () => {
    const token = `Bearer ${await loginAs()}`;
    const before = (await request(app).get(`${API}/activity-logs?limit=1&action=CREATE`).set('Authorization', token)).body.data.total as number;
    await request(app).post(`${API}/faqs`).set('Authorization', token).send({ question: 'not localized' }).expect(400);
    const after = (await request(app).get(`${API}/activity-logs?limit=1&action=CREATE`).set('Authorization', token)).body.data.total as number;
    expect(after).toBe(before);
  });

  it('is for admins only', async () => {
    await request(app).get(`${API}/activity-logs`).expect(401);
  });
});

describe('technologies', () => {
  it('lets an admin add a technology, which the homepage then lists', async () => {
    const token = `Bearer ${await loginAs()}`;
    const created = await request(app).post(`${API}/technologies`).set('Authorization', token).send({ name: 'Test Tech', description: { en: 'Text', bn: 'লেখা' }, logo: '/images/tech/php.webp', sortOrder: 999 }).expect(201);
    const home = await request(app).get(`${API}/home?locale=bn`).expect(200);
    expect(home.body.data.technologies.find((row: { id: string }) => row.id === created.body.data.id)).toMatchObject({ name: 'Test Tech', description: 'লেখা' });
    await request(app).delete(`${API}/technologies/${created.body.data.id}`).set('Authorization', token).expect(200);
  });
});

describe('hero backgrounds', () => {
  it('shows the first visible background on the homepage and skips hidden ones', async () => {
    const token = `Bearer ${await loginAs()}`;
    const hidden = await request(app).post(`${API}/hero-backgrounds`).set('Authorization', token).send({ name: 'Hidden', image: '/images/hero/hidden.webp', isActive: false }).expect(201);

    const visible = await request(app).get(`${API}/hero-backgrounds?locale=en`).expect(200);
    const home = await request(app).get(`${API}/home?locale=en`).expect(200);
    expect(visible.body.data.map((row: { image: string }) => row.image)).not.toContain('/images/hero/hidden.webp');
    expect(home.body.data.heroBackground).toBe(visible.body.data[0]?.image ?? null);

    await request(app).delete(`${API}/hero-backgrounds/${hidden.body.data.id}`).set('Authorization', token).expect(200);
  });

  it('needs a login to add one and refuses an unsafe image address', async () => {
    await request(app).post(`${API}/hero-backgrounds`).send({ name: 'Test', image: '/images/hero/test.webp' }).expect(401);
    const token = `Bearer ${await loginAs()}`;
    await request(app).post(`${API}/hero-backgrounds`).set('Authorization', token).send({ name: 'Test', image: 'javascript:alert(1)' }).expect(400);
  });
});

describe('pricing plan labels', () => {
  it('serves the price label, button text and note by language, and clears them', async () => {
    const token = `Bearer ${await loginAs()}`;
    const plan = {
      slug: 'test-plan-labels',
      name: { en: 'Test', bn: 'টেস্ট' },
      tagline: { en: 'Tagline', bn: 'ট্যাগলাইন' },
      price: 49,
      features: [{ en: 'One', bn: 'এক' }],
      priceLabel: { en: 'One-time', bn: 'এককালীন' },
      buttonLabel: { en: 'Start Now', bn: 'শুরু করুন' },
      note: { en: 'Hosting not included.', bn: 'হোস্টিং অন্তর্ভুক্ত নয়।' },
    };
    const created = await request(app).post(`${API}/pricing-plans`).set('Authorization', token).send(plan).expect(201);
    const list = await request(app).get(`${API}/pricing-plans?locale=bn`).expect(200);
    expect(list.body.data.find((row: { id: string }) => row.id === created.body.data.id)).toMatchObject({ priceLabel: 'এককালীন', buttonLabel: 'শুরু করুন', note: 'হোস্টিং অন্তর্ভুক্ত নয়।' });

    const cleared = await request(app).patch(`${API}/pricing-plans/${created.body.data.id}`).set('Authorization', token).send({ priceLabel: null, buttonLabel: null, note: null }).expect(200);
    expect(cleared.body.data).toMatchObject({ priceLabel: null, buttonLabel: null, note: null });
    await request(app).delete(`${API}/pricing-plans/${created.body.data.id}`).set('Authorization', token).expect(200);
  });
});

describe('outcome cards', () => {
  const card = {
    title: { en: 'Get More Customers', bn: 'আরও গ্রাহক পান' },
    description: { en: 'Turn visitors into sales.', bn: 'ভিজিটরকে বিক্রিতে রূপান্তর করুন।' },
    points: [{ en: 'Reach the right audience', bn: 'সঠিক গ্রাহকের কাছে পৌঁছান' }],
    image: '/images/outcome-cards/get-more-customers.webp',
    buttonLabel: { en: 'Talk To Us', bn: 'কথা বলুন' },
    buttonUrl: '#contact',
  };

  it('lets an admin set the text, image and button, and serves them by language', async () => {
    const token = await loginAs();
    const created = await request(app).post(`${API}/outcome-cards`).set('Authorization', `Bearer ${token}`).send(card).expect(201);

    const list = await request(app).get(`${API}/outcome-cards?locale=bn`).expect(200);
    const found = list.body.data.find((row: { id: string }) => row.id === created.body.data.id);
    expect(found).toMatchObject({ title: 'আরও গ্রাহক পান', points: ['সঠিক গ্রাহকের কাছে পৌঁছান'], buttonLabel: 'কথা বলুন', buttonUrl: '#contact', eyebrow: null });

    await request(app).delete(`${API}/outcome-cards/${created.body.data.id}`).set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('clears the button when an admin empties it', async () => {
    const token = await loginAs();
    const created = await request(app).post(`${API}/outcome-cards`).set('Authorization', `Bearer ${token}`).send(card).expect(201);
    const updated = await request(app).patch(`${API}/outcome-cards/${created.body.data.id}`).set('Authorization', `Bearer ${token}`).send({ buttonLabel: null, buttonUrl: null }).expect(200);
    expect(updated.body.data).toMatchObject({ buttonLabel: null, buttonUrl: null });
    await request(app).delete(`${API}/outcome-cards/${created.body.data.id}`).set('Authorization', `Bearer ${token}`).expect(200);
  });

  it.each(['javascript:alert(1)', '//evil.example', 'contact'])('refuses the button link %s', async (buttonUrl) => {
    const token = await loginAs();
    await request(app).post(`${API}/outcome-cards`).set('Authorization', `Bearer ${token}`).send({ ...card, buttonUrl }).expect(400);
  });

  it('needs a login to change cards', async () => {
    await request(app).post(`${API}/outcome-cards`).send(card).expect(401);
  });
});

describe('uploads', () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

  it('requires a login', async () => {
    await request(app).post(`${API}/uploads`).attach('file', png, 'a.png').expect(401);
  });

  it('stores an image under a generated name and serves it', async () => {
    const token = `Bearer ${await loginAs()}`;
    const res = await request(app).post(`${API}/uploads`).set('Authorization', token).attach('file', png, '../../evil.html').expect(201);
    expect(res.body.data.path).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);

    const served = await request(app).get(res.body.data.path).expect(200);
    expect(served.headers['content-type']).toBe('image/png');
    await rm(path.join(config.uploadDir, path.basename(res.body.data.path)));
  });

  it('rejects files that are not images or videos, whatever they are named', async () => {
    const token = `Bearer ${await loginAs()}`;
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await request(app).post(`${API}/uploads`).set('Authorization', token).attach('file', svg, 'photo.png').expect(400);
    await request(app).post(`${API}/uploads`).set('Authorization', token).expect(400);
  });
});
