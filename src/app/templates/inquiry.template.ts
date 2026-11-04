import type { Inquiry } from '../../generated/prisma/client.js';

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export const inquiryNotificationTemplate = (inquiry: Inquiry) => {
  const rows: [string, string | null][] = [
    ['Name', inquiry.name],
    ['Email', inquiry.email],
    ['Phone', inquiry.phone],
    ['Company', inquiry.company],
    ['Service', inquiry.service],
    ['Budget', inquiry.budget],
    ['Country', inquiry.country],
    ['Existing website', inquiry.existingWebsite],
    ['Language', inquiry.locale],
  ];

  const tableRows = rows
    .filter((row): row is [string, string] => Boolean(row[1]))
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#6b7280">${label}</td><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;color:#111827;max-width:560px">
      <h2 style="color:#7c3aed;margin:0 0 16px">New Project Inquiry</h2>
      <table style="border-collapse:collapse;font-size:14px">${tableRows}</table>
      <p style="font-size:14px;line-height:1.6;white-space:pre-wrap;margin-top:16px">${escapeHtml(inquiry.message)}</p>
    </div>`;
};
