const puppeteer = require('puppeteer');

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

function buildHeaderTemplate(header) {
  if (!header || (!header.text && !header.logo_url && !header.show)) return '<span></span>';

  const dir = header.dir || 'rtl';
  const logo = header.logo_url
    ? `<img src="${header.logo_url}" style="height:28px;vertical-align:middle;margin:0 6px;">`
    : '';
  const text = header.text ? `<span style="vertical-align:middle;">${header.text}</span>` : '';

  return `
    <div style="
      width:100%; font-size:10px; color:#555; padding:4px 15mm;
      display:flex; align-items:center;
      justify-content:${dir === 'rtl' ? 'flex-end' : 'flex-start'};
      direction:${dir}; box-sizing:border-box; font-family:Arial,sans-serif;
    ">
      ${logo}${text}
    </div>`;
}

function buildFooterTemplate(footer) {
  if (!footer || (!footer.text && !footer.show_page_number && !footer.logo_url)) return '<span></span>';

  const dir = footer.dir || 'rtl';
  const logo = footer.logo_url
    ? `<img src="${footer.logo_url}" style="height:28px;vertical-align:middle;margin:0 6px;">`
    : '';
  const text = footer.text ? `<span>${footer.text}</span>` : '';
  const pageNum = footer.show_page_number
    ? `<span><span class="pageNumber"></span> / <span class="totalPages"></span></span>`
    : '';

  const left = dir === 'rtl' ? pageNum : (logo || text);
  const right = dir === 'rtl' ? (logo || text) : pageNum;

  return `
    <div style="
      width:100%; font-size:10px; color:#555; padding:4px 15mm;
      display:flex; align-items:center; justify-content:space-between;
      direction:${dir}; box-sizing:border-box; font-family:Arial,sans-serif;
    ">
      <span>${left}</span><span>${right}</span>
    </div>`;
}

async function generatePDF(html, options = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const hasHeader = options.header && (options.header.text || options.header.logo_url || options.header.show);
    const hasFooter = options.footer && (options.footer.text || options.footer.show_page_number || options.footer.logo_url);
    const displayHeaderFooter = !!(hasHeader || hasFooter);

    const baseMargin = options.margin || '15mm';

    const pdfOptions = {
      format: options.page_size || 'A4',
      landscape: options.orientation === 'landscape',
      printBackground: true,
      displayHeaderFooter,
      headerTemplate: displayHeaderFooter ? buildHeaderTemplate(options.header) : '<span></span>',
      footerTemplate: displayHeaderFooter ? buildFooterTemplate(options.footer) : '<span></span>',
      margin: {
        top: hasHeader ? '20mm' : baseMargin,
        bottom: hasFooter ? '20mm' : baseMargin,
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
