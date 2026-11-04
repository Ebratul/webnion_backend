import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';

dotenv.config({ quiet: true });

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const readData = <T>(file: string) => JSON.parse(readFileSync(new URL(`./data/${file}`, import.meta.url), 'utf8')) as T;

interface ProjectDetails {
  client: string | null;
  budget: Prisma.InputJsonValue | null;
  location: Prisma.InputJsonValue | null;
  sector: Prisma.InputJsonValue | null;
  completedAt: string | null;
  content: Prisma.InputJsonValue | null;
}

// Article text and project info live in JSON files because they are far longer than the rest of the seed
const projectDetails = readData<Record<string, ProjectDetails>>('project-details.json');
const serviceDetails = readData<Record<string, { content: Prisma.InputJsonValue; faqs: Prisma.InputJsonValue }>>('service-details.json');
const caseStudies = readData<Prisma.CaseStudyCreateManyInput[]>('case-studies.json');

const detailsFor = (slug: string) => {
  const details = projectDetails[slug];
  if (!details) throw new Error(`No project details for ${slug}`);
  return {
    client: details.client,
    budget: details.budget ?? undefined,
    location: details.location ?? undefined,
    sector: details.sector ?? undefined,
    completedAt: details.completedAt,
    content: details.content ?? undefined,
  };
};

const t = (en: string, bn: string) => ({ en, bn });
const ordered = <T extends object>(rows: T[]) => rows.map((row, sortOrder) => ({ ...row, sortOrder }));

const ecommerce = t('E-commerce Website', 'ই-কমার্স ওয়েবসাইট');

const services = ordered([
  {
    slug: 'custom-website-design',
    title: t('Custom Website Design', 'কাস্টম ওয়েবসাইট ডিজাইন'),
    description: t(
      'Custom-built websites designed specifically for your brand, ensuring modern design, high performance, and a seamless user experience.',
      'আপনার ব্র্যান্ডের জন্য আলাদাভাবে তৈরি ওয়েবসাইট, যেখানে থাকে আধুনিক ডিজাইন, দ্রুত পারফরম্যান্স আর সহজ ইউজার এক্সপেরিয়েন্স।',
    ),
    image: '/images/services/custom-website.webp',
  },
  {
    slug: 'ecommerce-development',
    title: t('E-commerce Development', 'ই-কমার্স ডেভেলপমেন্ট'),
    description: t(
      'Custom e-commerce websites designed to help businesses sell products online with secure payments and a smooth shopping experience.',
      'নিরাপদ পেমেন্ট আর সহজ কেনাকাটার অভিজ্ঞতাসহ কাস্টম ই-কমার্স ওয়েবসাইট, যা আপনার ব্যবসাকে অনলাইনে পণ্য বিক্রিতে সাহায্য করে।',
    ),
    image: '/images/services/ecommerce.webp',
  },
  {
    slug: 'business-website-optimization',
    title: t('Business Website Optimization', 'বিজনেস ওয়েবসাইট অপটিমাইজেশন'),
    description: t(
      "Improve your website's speed, performance, security, and user experience to deliver better results and higher conversions.",
      'আপনার ওয়েবসাইটের গতি, পারফরম্যান্স, নিরাপত্তা ও ইউজার এক্সপেরিয়েন্স উন্নত করুন, যাতে ফলাফল ও কনভার্সন দুটোই বাড়ে।',
    ),
    image: '/images/services/optimization.webp',
  },
]);

const project = (name: string, image: string, slug: string, category = ecommerce, isFeatured = true) => ({
  slug,
  name,
  image: `/images/projects/${image}.webp`,
  category,
  isFeatured,
  ...detailsFor(slug),
});

const projects = ordered([
  project('Trishna Fashion', 'trishna-fashion', 'trishna-fashion-selocommerce-ecommerce-website', t('SeloCommerce E-commerce', 'SeloCommerce ই-কমার্স')),
  project('Academy Nafia Shop', 'academy-nafia-shop', 'academy-nafia-online-bookstore', t('Educational E-commerce Website', 'শিক্ষামূলক ই-কমার্স ওয়েবসাইট')),
  project('My AT Shop', 'my-at-shop', 'organic-products-ecommerce-website'),
  project('AR Mehendi Design', 'ar-mehendi', 'ar-mehendi-design-ecommerce-website'),
  project('OneStop Mart BD', 'onestop-mart', 'onestop-mart-bd-ecommerce-website', t('WordPress E-commerce', 'ওয়ার্ডপ্রেস ই-কমার্স')),
  project('tasin.world', 'tasin-world', 'tasin-world-ecommerce-website'),
  project('neqvix.com', 'neqvix', 'neqvix-ecommerce-website'),
  project('Saltfoodmart.com', 'saltfoodmart', 'saltfoodmartcom'),
  project('Taskbazar.com', 'taskbazar', 'taskbazarcom', t('Web Application', 'ওয়েব অ্যাপ্লিকেশন')),
  project('Sabazarshop.com', 'sabazarshop', 'sabazarshopcom'),
  project('Muqarraboon.com', 'muqarraboon', 'muqarrabooncom'),
  project('Arabianfragrancebd.com', 'arabianfragrancebd', 'arabianfragrancebdcom'),
  project('academynafia.com', 'academynafia', 'academy-nafia-website-design', t('E-learning Platform', 'ই-লার্নিং প্ল্যাটফর্ম')),
  project('infixx.com', 'infixx', 'infixxcom', t('Service Website', 'সার্ভিস ওয়েবসাইট')),
  project('bakemasterbd.com', 'bakemasterbd', 'bakemasterbdcom'),
  project('Gigaloy.com', 'gigaloy', 'gigaloy-website', t('Solution', 'সলিউশন')),
]);

// Videos are not in git: copy uploads/reviews to the server when deploying (see README)
const VIDEO_BASE = '/uploads/reviews';

const testimonials = ordered([
  {
    kind: 'VIDEO' as const,
    name: 'Bismillahdryfoods',
    role: ecommerce,
    avatar: '/images/avatars/bismillah.webp',
    image: '/images/avatars/bismillah.webp',
    videoUrl: `${VIDEO_BASE}/bismillahdryfoods.mp4`,
  },
  {
    kind: 'RESULT' as const,
    name: 'MD. Arif Chowdhury',
    role: ecommerce,
    avatar: '/images/avatars/arif-chowdhury.webp',
    image: '/images/reviews/arif-chowdhury.webp',
  },
  {
    kind: 'VIDEO' as const,
    name: 'Robb Abdur',
    role: t('Supermarket Owner', 'সুপারমার্কেট মালিক'),
    avatar: '/images/avatars/robb-abdur.webp',
    image: '/images/avatars/robb-abdur.webp',
    videoUrl: `${VIDEO_BASE}/saltfoodmart.mp4`,
  },
  {
    kind: 'VIDEO' as const,
    name: 'Tanim Ahmed Arif',
    role: t('Digital Marketer', 'ডিজিটাল মার্কেটার'),
    avatar: '/images/avatars/tanim-ahmed-arif.webp',
    image: '/images/avatars/tanim-ahmed-arif.webp',
    videoUrl: `${VIDEO_BASE}/tanim-ahmed-arif.mp4`,
  },
  {
    kind: 'RESULT' as const,
    name: 'Aromic BD Perfume',
    role: ecommerce,
    avatar: '/images/avatars/aromic.webp',
    image: '/images/reviews/aromic.webp',
  },
  {
    kind: 'RESULT' as const,
    name: 'NEQVIX',
    role: ecommerce,
    avatar: '/images/avatars/neqvix.webp',
    image: '/images/reviews/neqvix.webp',
  },
  {
    kind: 'VIDEO' as const,
    name: 'infixx',
    role: t('Service Business', 'সার্ভিস ব্যবসা'),
    avatar: '/images/avatars/infixx.webp',
    image: '/images/avatars/infixx-poster.webp',
    videoUrl: `${VIDEO_BASE}/infixx.mp4`,
  },
  {
    kind: 'RESULT' as const,
    name: 'Tasin',
    role: t('tasin.world', 'tasin.world'),
    avatar: '/images/avatars/tasin.webp',
    image: '/images/reviews/tasin.webp',
  },
]);

const deliveryStories = ordered([
  {
    title: t('Project Agreement', 'প্রজেক্ট চুক্তি'),
    caption: t('Clear Scope', 'স্পষ্ট পরিকল্পনা'),
    image: '/images/delivery/story-01.webp',
  },
  {
    title: t('On-Site Meeting', 'সরাসরি মিটিং'),
    caption: t('Face To Face', 'মুখোমুখি আলোচনা'),
    image: '/images/delivery/story-02.webp',
  },
  {
    title: t('Project Handover', 'প্রজেক্ট হস্তান্তর'),
    caption: t('Delivered In Person', 'সরাসরি হস্তান্তর'),
    image: '/images/delivery/story-03.webp',
  },
  {
    title: t('Long-Term Partner', 'দীর্ঘমেয়াদি পার্টনার'),
    caption: t('Support After Launch', 'লঞ্চের পরও সাপোর্ট'),
    image: '/images/delivery/story-04.webp',
  },
]);

const pricingPlans = ordered([
  {
    slug: 'free',
    name: t('Free', 'ফ্রি'),
    tagline: t('For businesses planning their next step', 'যেসব ব্যবসা পরবর্তী পদক্ষেপ পরিকল্পনা করছে তাদের জন্য'),
    price: 0,
    features: [
      t('Free 15-minute call', '১৫ মিনিটের ফ্রি কল'),
      t('Review of your business goals', 'আপনার ব্যবসার লক্ষ্য পর্যালোচনা'),
      t('Clear plan, scope, and cost', 'স্পষ্ট পরিকল্পনা, পরিধি ও খরচ'),
      t('No obligation', 'কোনো বাধ্যবাধকতা নেই'),
    ],
  },
  {
    slug: 'starter',
    name: t('Starter', 'স্টার্টার'),
    tagline: t('Perfect for startups & small businesses', 'স্টার্টআপ ও ছোট ব্যবসার জন্য উপযুক্ত'),
    badge: t('Best Value', 'সেরা ভ্যালু'),
    price: 19,
    isFeatured: true,
    features: [
      t('Custom website design', 'কাস্টম ওয়েবসাইট ডিজাইন'),
      t('Up to 10 responsive pages', 'সর্বোচ্চ ১০টি রেসপন্সিভ পেজ'),
      t('SEO-ready structure', 'SEO-বান্ধব কাঠামো'),
      t('Unlimited revisions (within scope)', 'আনলিমিটেড রিভিশন (স্কোপের মধ্যে)'),
      t('30-day post-launch support', 'লঞ্চের পর ৩০ দিনের সাপোর্ট'),
    ],
  },
  {
    slug: 'production',
    name: t('Production', 'প্রোডাকশন'),
    tagline: t('For scaling brands with performance', 'পারফরম্যান্স নিয়ে এগিয়ে যেতে চাওয়া ব্র্যান্ডের জন্য'),
    price: 199,
    features: [
      t('Conversion-focused UX design', 'কনভার্সন-কেন্দ্রিক UX ডিজাইন'),
      t('Up to 25 responsive pages', 'সর্বোচ্চ ২৫টি রেসপন্সিভ পেজ'),
      t('CMS integration (WordPress/Laravel)', 'CMS ইন্টিগ্রেশন (WordPress/Laravel)'),
      t('Third-party integrations included', 'থার্ড-পার্টি ইন্টিগ্রেশন অন্তর্ভুক্ত'),
      t('120-day post-launch support', 'লঞ্চের পর ১২০ দিনের সাপোর্ট'),
    ],
  },
  {
    slug: 'enterprise',
    name: t('Enterprise', 'এন্টারপ্রাইজ'),
    tagline: t('For advanced, large-scale platforms', 'উন্নত ও বড় পরিসরের প্ল্যাটফর্মের জন্য'),
    price: 199,
    features: [
      t('Fully custom with advanced features', 'উন্নত ফিচারসহ সম্পূর্ণ কাস্টম'),
      t('Unlimited pages & deep functionality', 'আনলিমিটেড পেজ ও গভীর ফাংশনালিটি'),
      t('API & system integrations', 'API ও সিস্টেম ইন্টিগ্রেশন'),
      t('High-level performance optimization', 'উচ্চমানের পারফরম্যান্স অপটিমাইজেশন'),
      t('200-day premium support', '২০০ দিনের প্রিমিয়াম সাপোর্ট'),
    ],
  },
]);

const faqs = ordered([
  {
    question: t('What does Webnion specialize in?', 'Webnion মূলত কী নিয়ে কাজ করে?'),
    answer: t(
      'We design and develop custom websites, e-commerce stores, and web applications, and we add automation, AI, and tracking so your website supports marketing, sales, and daily operations.',
      'আমরা কাস্টম ওয়েবসাইট, ই-কমার্স স্টোর ও ওয়েব অ্যাপ্লিকেশন ডিজাইন ও ডেভেলপ করি। পাশাপাশি অটোমেশন, AI ও ট্র্যাকিং যুক্ত করি, যাতে আপনার ওয়েবসাইট মার্কেটিং, বিক্রি ও দৈনন্দিন কাজে সাহায্য করে।',
    ),
  },
  {
    question: t('Do you work with small businesses and startups?', 'আপনারা কি ছোট ব্যবসা ও স্টার্টআপের সাথে কাজ করেন?'),
    answer: t(
      'Yes. The Starter plan is built for startups and small businesses, and you can move to a larger plan as your business grows.',
      'হ্যাঁ। স্টার্টার প্ল্যানটি স্টার্টআপ ও ছোট ব্যবসার জন্যই তৈরি, আর ব্যবসা বড় হলে আপনি বড় প্ল্যানে যেতে পারবেন।',
    ),
  },
  {
    question: t('How long does a typical project take?', 'একটি প্রজেক্ট শেষ হতে সাধারণত কত সময় লাগে?'),
    answer: t(
      'It depends on pages, features, and design requirements. You get a clear timeline after the first meeting, before any work starts.',
      'এটি পেজ, ফিচার ও ডিজাইনের চাহিদার উপর নির্ভর করে। প্রথম মিটিংয়ের পর, কাজ শুরুর আগেই আপনি একটি স্পষ্ট সময়সূচি পেয়ে যাবেন।',
    ),
  },
  {
    question: t('How is the final price decided?', 'চূড়ান্ত মূল্য কীভাবে ঠিক হয়?'),
    answer: t(
      'Package prices are starting prices. The final cost depends on features, pages, design quality, and business requirements, and we confirm it with you before the project begins.',
      'প্যাকেজের মূল্যগুলো শুরুর মূল্য। চূড়ান্ত খরচ নির্ভর করে ফিচার, পেজ, ডিজাইনের মান ও ব্যবসার চাহিদার উপর, এবং প্রজেক্ট শুরুর আগেই আমরা তা আপনার সাথে নিশ্চিত করি।',
    ),
  },
  {
    question: t('What do you need from me to get started?', 'শুরু করতে আপনাদের আমার কাছ থেকে কী কী লাগবে?'),
    answer: t(
      'A short conversation about your business and goals is enough to begin. If you have a logo, content, or examples you like, share them and we will guide you through the rest.',
      'শুরু করার জন্য আপনার ব্যবসা ও লক্ষ্য নিয়ে একটি ছোট আলোচনাই যথেষ্ট। লোগো, কনটেন্ট বা পছন্দের কোনো উদাহরণ থাকলে শেয়ার করুন, বাকিটা আমরা দেখিয়ে দেব।',
    ),
  },
  {
    question: t('What happens after my website goes live?', 'ওয়েবসাইট লাইভ হওয়ার পর কী হবে?'),
    answer: t(
      'Every paid plan includes post-launch support: 30 days on Starter, 120 days on Production, and 200 days on Enterprise.',
      'প্রতিটি পেইড প্ল্যানে লঞ্চের পর সাপোর্ট আছে: স্টার্টারে ৩০ দিন, প্রোডাকশনে ১২০ দিন এবং এন্টারপ্রাইজে ২০০ দিন।',
    ),
  },
]);

const team = ordered([
  {
    name: t('Md Anik Hossen', 'মো. অনিক হোসেন'),
    role: t('Founder & CEO', 'প্রতিষ্ঠাতা ও সিইও'),
    photo: '/images/team/anik-hossen.webp',
  },
  {
    name: t('Md Bulbul Hossen', 'মো. বুলবুল হোসেন'),
    role: t('Head Of Marketing', 'হেড অব মার্কেটিং'),
    photo: '/images/team/bulbul-hossen.webp',
  },
  {
    name: t('Kazi Estiaq Jacy', 'কাজী ইশতিয়াক জেসি'),
    role: t('International Business Development Manager, Europe', 'আন্তর্জাতিক বিজনেস ডেভেলপমেন্ট ম্যানেজার, ইউরোপ'),
    photo: '/images/team/estiaq-jacy.webp',
  },
  {
    name: t('Ratanuzzaman Ripon', 'রতনুজ্জামান রিপন'),
    role: t('Product Security Engineer', 'প্রোডাক্ট সিকিউরিটি ইঞ্জিনিয়ার'),
    photo: '/images/team/ratanuzzaman-ripon.webp',
  },
  {
    name: t('Muhammad Milon', 'মুহাম্মদ মিলন'),
    role: t('Full-Stack MERN Developer', 'ফুল-স্ট্যাক MERN ডেভেলপার'),
    photo: '/images/team/muhammad-milon.webp',
  },
  {
    name: t('Hridoy Hossain', 'হৃদয় হোসেন'),
    role: t('Website Developer', 'ওয়েবসাইট ডেভেলপার'),
    photo: '/images/team/hridoy-hossain.webp',
  },
]);

const clients = ordered(
  [
    ['Abriyana', 'abriyana.webp'],
    ['Gigaloy', 'gigaloy.webp'],
    ['Taskbazar', 'taskbazar.webp'],
    ['Sabazarshop', 'sabazarshop.webp'],
    ['Infixx', 'infixx.webp'],
    ['We Care Psychology Affiliates', 'we-care.webp'],
    ['Middletown Chiropractic', 'middletown-chiropractic.webp'],
    ['Simplified Nutrition 123', 'simplified-nutrition.webp'],
  ].map(([name, logo]) => ({ name: name!, logo: `/images/clients/${logo}` })),
);

// Tables are filled only when empty, so re-running the seed never overwrites content edited later
const seedIfEmpty = async (label: string, count: () => Promise<number>, insert: () => Promise<unknown>) => {
  if ((await count()) > 0) {
    console.log(`Skipped ${label}: already has data`);
    return;
  }
  await insert();
  console.log(`Seeded ${label}`);
};

// Projects created before detail pages existed get their details once. A row with a client is left alone,
// so this never overwrites an edit.
const backfillProjectDetails = async () => {
  let updated = 0;
  for (const slug of Object.keys(projectDetails)) {
    const { count } = await prisma.project.updateMany({ where: { slug, client: null }, data: detailsFor(slug) });
    updated += count;
  }
  console.log(`Backfilled details on ${updated} projects`);
};

// Services created before detail pages existed get their details once. A row with content is left alone.
const backfillServiceDetails = async () => {
  let updated = 0;
  for (const [slug, details] of Object.entries(serviceDetails)) {
    const { count } = await prisma.service.updateMany({ where: { slug, content: { equals: Prisma.DbNull } }, data: details });
    updated += count;
  }
  console.log(`Backfilled details on ${updated} services`);
};

const seedAdmin = async () => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('Skipped admin user: set ADMIN_EMAIL and ADMIN_PASSWORD to create one');
    return;
  }
  if ((await prisma.user.count({ where: { email } })) > 0) {
    console.log('Skipped admin user: already exists');
    return;
  }

  await prisma.user.create({
    data: { name: 'Webnion Admin', email, role: 'ADMIN', passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`Created admin user ${email}`);
};

const main = async () => {
  await seedAdmin();
  await seedIfEmpty('services', () => prisma.service.count(), () => prisma.service.createMany({ data: services }));
  await seedIfEmpty('projects', () => prisma.project.count(), () => prisma.project.createMany({ data: projects }));
  await backfillProjectDetails();
  await backfillServiceDetails();
  await seedIfEmpty('case studies', () => prisma.caseStudy.count(), () => prisma.caseStudy.createMany({ data: ordered(caseStudies) }));
  await seedIfEmpty('testimonials', () => prisma.testimonial.count(), () => prisma.testimonial.createMany({ data: testimonials }));
  await seedIfEmpty('delivery stories', () => prisma.deliveryStory.count(), () => prisma.deliveryStory.createMany({ data: deliveryStories }));
  await seedIfEmpty('pricing plans', () => prisma.pricingPlan.count(), () => prisma.pricingPlan.createMany({ data: pricingPlans }));
  await seedIfEmpty('FAQs', () => prisma.faq.count(), () => prisma.faq.createMany({ data: faqs }));
  await seedIfEmpty('team', () => prisma.teamMember.count(), () => prisma.teamMember.createMany({ data: team }));
  await seedIfEmpty('clients', () => prisma.clientLogo.count(), () => prisma.clientLogo.createMany({ data: clients }));
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
