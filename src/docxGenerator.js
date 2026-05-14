const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, LevelFormat, WidthType, BorderStyle,
  ShadingType, PageOrientation, Header, Footer, ImageRun, PageNumber,
  ExternalHyperlink,
} = require('docx');
const https = require('https');
const http = require('http');

function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function guessImageType(url) {
  if (/\.png(\?|$)/i.test(url)) return 'png';
  if (/\.gif(\?|$)/i.test(url)) return 'gif';
  if (/\.bmp(\?|$)/i.test(url)) return 'bmp';
  return 'jpg';
}

// DXA constants (1440 DXA = 1 inch)
const PAGE_WIDTH_DXA = 11906; // A4
const MARGIN_DXA = 1134;      // ~2cm
const CONTENT_WIDTH_DXA = PAGE_WIDTH_DXA - MARGIN_DXA * 2;

const BORDER = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

async function sectionToParagraphs(section, styles) {
  const rtl = true; // always RTL for Hebrew

  if (['h1', 'h2', 'h3', 'h4'].includes(section.type)) {
    const levelMap = { h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3, h4: HeadingLevel.HEADING_4 };
    return [new Paragraph({
      heading: levelMap[section.type],
      bidirectional: rtl,
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: section.text || '', rightToLeft: rtl })],
    })];
  }

  if (section.type === 'p') {
    return [new Paragraph({
      bidirectional: rtl,
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: section.text || '', rightToLeft: rtl })],
    })];
  }

  if (section.type === 'ul') {
    return (section.items || []).map(item => new Paragraph({
      numbering: { reference: 'bullets', level: 0 },
      bidirectional: rtl,
      children: [new TextRun({ text: item, rightToLeft: rtl })],
    }));
  }

  if (section.type === 'ol') {
    return (section.items || []).map(item => new Paragraph({
      numbering: { reference: 'numbers', level: 0 },
      bidirectional: rtl,
      children: [new TextRun({ text: item, rightToLeft: rtl })],
    }));
  }

  if (section.type === 'table') {
    const headers = section.headers || [];
    const rows = section.rows || [];
    const colCount = Math.max(headers.length, ...rows.map(r => r.length), 1);
    const colWidth = Math.floor(CONTENT_WIDTH_DXA / colCount);

    const headerRow = headers.length ? new TableRow({
      children: headers.map(h => new TableCell({
        borders: CELL_BORDERS,
        width: { size: colWidth, type: WidthType.DXA },
        shading: { fill: 'F0F0F0', type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          bidirectional: rtl,
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: String(h), bold: true, rightToLeft: rtl })],
        })],
      })),
    }) : null;

    const dataRows = rows.map(row => new TableRow({
      children: row.map(cell => new TableCell({
        borders: CELL_BORDERS,
        width: { size: colWidth, type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          bidirectional: rtl,
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: String(cell ?? ''), rightToLeft: rtl })],
        })],
      })),
    }));

    const tableRows = headerRow ? [headerRow, ...dataRows] : dataRows;
    if (!tableRows.length) return [];

    return [new Table({
      width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
      columnWidths: Array(colCount).fill(colWidth),
      rows: tableRows,
    })];
  }

  if (section.type === 'image') {
    try {
      const data = await fetchImageBuffer(section.url);
      const type = guessImageType(section.url);
      const paras = [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({
          type,
          data,
          transformation: { width: 400, height: 300 },
          altText: { title: section.caption || 'image', description: section.caption || '', name: 'image' },
        })],
      })];
      if (section.caption) {
        paras.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: section.caption, size: 18, color: '888888' })],
        }));
      }
      return paras;
    } catch {
      return [new Paragraph({ children: [new TextRun({ text: `[תמונה: ${section.url}]` })] })];
    }
  }

  if (section.type === 'lesson_details') {
    const fields = [
      { label: 'זמן', value: section.time },
      { label: 'דרגת קושי', value: section.level },
      { label: 'צורת ישיבה', value: section.sitting },
      { label: 'התערבות', value: section.intervention },
    ].filter(f => f.value);

    const runs = [new TextRun({ text: '>> ', bold: true, color: 'E5791F', rightToLeft: rtl })];
    for (const f of fields) {
      runs.push(new TextRun({ text: `${f.label}: `, bold: true, rightToLeft: rtl }));
      runs.push(new TextRun({ text: `${f.value}  `, rightToLeft: rtl }));
    }
    runs.push(new TextRun({ text: '<<', bold: true, color: 'E5791F', rightToLeft: rtl }));
    return [new Paragraph({ bidirectional: rtl, alignment: AlignmentType.RIGHT, children: runs })];
  }

  if (section.type === 'divider') {
    return [new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } },
      children: [],
    })];
  }

  if (section.type === 'spacer') {
    return [new Paragraph({ children: [new TextRun('')] })];
  }

  if (section.type === 'page_break') {
    return [new Paragraph({ pageBreakBefore: true, children: [] })];
  }

  return [];
}

async function generateDOCX(sections, metadata = {}, styles = {}) {
  const allParagraphs = [];
  for (const section of sections) {
    const paras = await sectionToParagraphs(section, styles);
    allParagraphs.push(...paras);
  }

  // Copyright block
  allParagraphs.push(
    new Paragraph({ children: [] }),
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'מורה יקר/ה, אנחנו שמחים לשתף אותך בתכנים המקצועיים שפיתחנו', size: 22, rightToLeft: true })],
    }),
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      border: {
        top: { style: BorderStyle.SINGLE, size: 6, color: '00B0C7', space: 4 },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '00B0C7', space: 4 },
        left: { style: BorderStyle.SINGLE, size: 6, color: '00B0C7', space: 4 },
        right: { style: BorderStyle.SINGLE, size: 6, color: '00B0C7', space: 4 },
      },
      children: [new TextRun({ text: 'חשוב להגדיש שתכנים אלו מוגנים בזכויות יוצרים ואין לשתף או להפיץ אותם.', bold: true, size: 22, rightToLeft: true })],
    }),
  );

  const page = styles.page || {};
  const fontFamily = page.font_family || 'Arial';

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: fontFamily, size: 24, rightToLeft: true } },
        paragraph: { alignment: AlignmentType.RIGHT },
      },
      paragraphStyles: [
        { id: 'Normal', name: 'Normal', quickFormat: true,
          run: { font: fontFamily, size: 24, rightToLeft: true },
          paragraph: { alignment: AlignmentType.RIGHT, bidirectional: true } },
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 40, bold: true, font: fontFamily, color: page.color?.replace('#', '') || '333333' },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0, bidirectional: true, alignment: AlignmentType.RIGHT } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, font: fontFamily, color: page.color?.replace('#', '') || '333333' },
          paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1, bidirectional: true, alignment: AlignmentType.RIGHT } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: fontFamily },
          paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2, bidirectional: true, alignment: AlignmentType.RIGHT } },
        { id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: fontFamily },
          paragraph: { spacing: { before: 120, after: 60 }, outlineLevel: 3, bidirectional: true, alignment: AlignmentType.RIGHT } },
      ],
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•',
          alignment: AlignmentType.RIGHT,
          style: { paragraph: { indent: { right: 720, hanging: 360 }, bidirectional: true } } }] },
        { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.',
          alignment: AlignmentType.RIGHT,
          style: { paragraph: { indent: { right: 720, hanging: 360 }, bidirectional: true } } }] },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_WIDTH_DXA, height: 16838 },
          margin: { top: MARGIN_DXA, right: MARGIN_DXA, bottom: MARGIN_DXA, left: MARGIN_DXA },
        },
        bidi: true,
      },
      children: allParagraphs,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return injectRtlSettings(buffer);
}

// Post-process: inject <w:bidi/> into sectPr and settings.xml
async function injectRtlSettings(buffer) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(buffer);

  // 1. Inject <w:bidi/> into sectPr in document.xml
  const docXml = await zip.file('word/document.xml').async('string');
  const patchedDoc = docXml.replace(/<w:sectPr>/, '<w:sectPr><w:bidi/>');
  zip.file('word/document.xml', patchedDoc);

  // 2. Inject <w:bidi/> into settings.xml
  const settingsXml = await zip.file('word/settings.xml').async('string');
  const patchedSettings = settingsXml.replace('</w:settings>', '<w:bidi/></w:settings>');
  zip.file('word/settings.xml', patchedSettings);

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { generateDOCX };
