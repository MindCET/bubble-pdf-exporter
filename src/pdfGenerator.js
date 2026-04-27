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

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          buffer: Buffer.concat(chunks),
          mime: res.headers['content-type'] || 'image/png',
        });
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

function getImageDimensions(buffer) {
  if (buffer.length >= 24 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 &&
      buffer[2] === 0x4E && buffer[3] === 0x47) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }
  if (buffer.length >= 4 && buffer[0] === 0xFF && buffer[1] === 0xD8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xFF) return null;
      const marker = buffer[offset + 1];
      if ((marker >= 0xC0 && marker <= 0xC3) ||
          (marker >= 0xC5 && marker <= 0xC7) ||
          (marker >= 0xC9 && marker <= 0xCB) ||
          (marker >= 0xCD && marker <= 0xCF)) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }
  return null;
}

async function resolveImage(url) {
  if (!url) return null;
  if (url.startsWith('data:')) return { dataUrl: url, dimensions: null };
  try {
    const { buffer, mime } = await fetchBuffer(url);
    const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
    const dimensions = getImageDimensions(buffer);
    return { dataUrl, dimensions };
  } catch {
    return { dataUrl: url, dimensions: null };
  }
}

function toMm(value) {
  const num = parseFloat(value);
  const unit = value.replace(/[\d.]/g, '') || 'px';
  if (unit === 'mm') return num;
  if (unit === 'cm') return num * 10;
  if (unit === 'in') return num * 25.4;
  return num * 0.264583;
}

const PAGE_SIZES_MM = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A5: { width: 148, height: 210 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 },
};

function getPageWidthMm(format, landscape) {
  const size = PAGE_SIZES_MM[format] || PAGE_SIZES_MM.A4;
  return landscape ? size.height : size.width;
}

function computeImageHeightMm(image, fallbackHeight, pageWidthMm) {
  if (image && image.dimensions && image.dimensions.width > 0) {
    return pageWidthMm * (image.dimensions.height / image.dimensions.width);
  }
  return toMm(fallbackHeight);
}

function buildImageTemplate(base64Url) {
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

    const headerImage = await resolveImage(header.logo_url);
    const footerImage = await resolveImage(footer.logo_url);

    const format = options.page_size || 'A4';
    const landscape = options.orientation === 'landscape';
    const pageWidthMm = getPageWidthMm(format, landscape);

    const headerHeightMm = computeImageHeightMm(headerImage, header.height || '60px', pageWidthMm);
    const footerHeightMm = computeImageHeightMm(footerImage, footer.height || '60px', pageWidthMm);

    const hasHeader = !!(headerImage && headerImage.dataUrl);
    const hasFooter = !!(footerImage && footerImage.dataUrl);
    const displayHeaderFooter = hasHeader || hasFooter;

    const pdfOptions = {
      format,
      landscape,
      printBackground: true,
      displayHeaderFooter,
      headerTemplate: hasHeader ? buildImageTemplate(headerImage.dataUrl) : '<span></span>',
      footerTemplate: hasFooter ? buildImageTemplate(footerImage.dataUrl) : '<span></span>',
      margin: {
        top: hasHeader ? `${headerHeightMm + 5}mm` : baseMargin,
        bottom: hasFooter ? `${footerHeightMm + 5}mm` : baseMargin,
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
