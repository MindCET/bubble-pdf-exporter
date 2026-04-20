const express = require('express');
const { buildCSS } = require('./cssBuilder');
const { buildHTML } = require('./htmlBuilder');
const { generatePDF, closeBrowser } = require('./pdfGenerator');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'pdf-exporter' });
});

app.post('/export-pdf', async (req, res) => {
  const { styles = {}, sections, metadata = {}, lang = 'he', options = {} } = req.body;

  let parsedSections = sections;
  if (typeof sections === 'string') {
    try {
      parsedSections = JSON.parse(sections);
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
    });

    const filename = (metadata.title || 'document')
      .replace(/[^a-zA-Z0-9\u0590-\u05FF ]/g, '')
      .trim()
      .replace(/ /g, '_') || 'document';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
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
