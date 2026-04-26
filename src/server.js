const express = require('express');
const { buildCSS } = require('./cssBuilder');
const { buildHTML } = require('./htmlBuilder');
const { generatePDF, closeBrowser } = require('./pdfGenerator');

const app = express();

// Accept both JSON and plain text (Bubble sometimes sends malformed JSON)
app.use('/export-pdf', express.text({ type: '*/*', limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

function parseBody(req) {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body;
}

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'pdf-exporter' });
});

app.post('/export-pdf', async (req, res) => {
  const body = parseBody(req);
  if (!body) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  const { styles = {}, sections, metadata = {}, lang = 'he', options = {} } = body;

  let parsedSections = sections;
  if (typeof sections === 'string') {
    try {
      // Bubble sends literal \" — strip the backslashes before parsing
      const cleaned = sections.replace(/\\"/g, '"');
      parsedSections = JSON.parse(cleaned);
    } catch {
      return res.status(400).json({ error: 'sections must be a valid JSON array' });
    }
  }

  if (!Array.isArray(parsedSections) || parsedSections.length === 0) {
    return res.status(400).json({ error: 'sections array is required and must not be empty' });
  }

  try {
    const css = buildCSS(styles);
    const html = buildHTML(css, parsedSections, metadata, styles, lang);
    const pdfBuffer = await generatePDF(html, {
      page_size: options.page_size,
      orientation: options.orientation,
      margin: options.margin || styles.page?.margin,
      header: styles.header || options.header,
      footer: styles.footer || options.footer,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'Failed to generate PDF', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`PDF Exporter running on port ${PORT}`);
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  server.close();
});

module.exports = app;
