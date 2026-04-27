const puppeteer = require('puppeteer');
const https = require('https');
const http = require('http');

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
  }
  return browserInstance;
}

function fetchAsBase64(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        const mime = res.headers['content-type'] || 'image/png';
        resolve(`data:${mime};base64,${buf.toString('base64')}`);
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function resolveImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    return await fetchAsBase64(url);
  } catch {
    return url;
  }
}

function toMm(value) {
  const num = parseFloat(value);
  const unit = value.replace(/[\d.]/g, '') || 'px';
  if (unit === 'mm') return num;
  if (unit === 'cm') return num * 10;
  if (unit === 'in') return num * 25.4;
  return num * 0.264583; // px → mm at 96 DPI
}

function buildImageTemplate(base64Url, height) {
  if (!base64Url) return '<span></span>';
  return `<style>* { margin: 0; padding: 0; } body { margin: 0 !important; }</style>
  <div style="width:100%;line-height:0;">
    <img src="${base64Url}" style="width:100%;height:auto;display:block;">
  </div>`;
}

async function generatePDF(html, options = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const baseMargin = options.margin || '15mm';
    const header = options.header || {};
    const footer = options.footer || {};

    const headerUrl = await resolveImageUrl(header.logo_url);
    const footerUrl = await resolveImageUrl(footer.logo_url);

    const headerHeight = header.height || '60px';
    const footerHeight = footer.height || '60px';

    const hasHeader = !!headerUrl;
    const hasFooter = !!footerUrl;
    const displayHeaderFooter = hasHeader || hasFooter;

    const pdfOptions = {
      format: options.page_size || 'A4',
      landscape: options.orientation === 'landscape',
      printBackground: true,
      displayHeaderFooter,
      headerTemplate: hasHeader ? buildImageTemplate(headerUrl, headerHeight) : '<span></span>',
      footerTemplate: hasFooter ? buildImageTemplate(footerUrl, footerHeight) : '<span></span>',
      margin: {
        top: hasHeader ? `${toMm(headerHeight) + 5}mm` : baseMargin,
        bottom: hasFooter ? `${toMm(footerHeight) + 5}mm` : baseMargin,
        left: baseMargin,
        right: baseMargin,
      },
    };

    const buffer = await page.pdf(pdfOptions);
    return buffer;
  } finally {
    await page.close();
  }
}

async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

module.exports = { generatePDF, closeBrowser };
