const GOOGLE_FONTS = [
  'Assistant', 'Heebo', 'Rubik', 'David Libre', 'Frank Ruhl Libre',
  'Noto Sans Hebrew', 'Noto Serif Hebrew', 'Open Sans', 'Roboto', 'Lato',
  'Montserrat', 'Poppins', 'Raleway', 'Nunito', 'Inter'
];

function buildGoogleFontsImport(styles) {
  const fonts = new Set();
  for (const rule of Object.values(styles)) {
    if (rule.font_family) fonts.add(rule.font_family);
  }

  const googleFonts = [...fonts].filter(f =>
    GOOGLE_FONTS.some(gf => gf.toLowerCase() === f.toLowerCase())
  );

  if (!googleFonts.length) return '';

  const query = googleFonts
    .map(f => f.replace(/ /g, '+') + ':ital,wght@0,300;0,400;0,700;1,400')
    .join('&family=');

  return `@import url('https://fonts.googleapis.com/css2?family=${query}&display=swap');`;
}

function styleObjectToCSS(obj) {
  const map = {
    font_family: 'font-family',
    font_size: 'font-size',
    font_weight: 'font-weight',
    color: 'color',
    background: 'background-color',
    line_height: 'line-height',
    text_align: 'text-align',
    margin_top: 'margin-top',
    margin_bottom: 'margin-bottom',
    padding: 'padding',
    border_color: 'border-color',
    border_width: 'border-width',
    letter_spacing: 'letter-spacing',
  };

  return Object.entries(obj)
    .filter(([k]) => map[k])
    .map(([k, v]) => {
      let value = v;
      if (k === 'font_family') value = `'${v}', sans-serif`;
      return `  ${map[k]}: ${value};`;
    })
    .join('\n');
}

function buildCSS(styles = {}) {
  const fontsImport = buildGoogleFontsImport(styles);
  const page = styles.page || {};
  const header = styles.header || {};
  const footer = styles.footer || {};

  const elementSelectors = ['h1', 'h2', 'h3', 'h4', 'p', 'li', 'td', 'th'];

  const elementCSS = elementSelectors
    .filter(tag => styles[tag])
    .map(tag => `${tag} {\n${styleObjectToCSS(styles[tag])}\n}`)
    .join('\n\n');

  const tableCSS = styles.table ? `
table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
}
th {
${styleObjectToCSS(styles.table_header || { background: '#f0f0f0', font_weight: '700' })}
  padding: 8px 12px;
  text-align: right;
  border: 1px solid ${styles.table?.border_color || '#dddddd'};
}
td {
  padding: 8px 12px;
  border: 1px solid ${styles.table?.border_color || '#dddddd'};
}` : `
table { width: 100%; border-collapse: collapse; margin: 16px 0; }
th, td { padding: 8px 12px; border: 1px solid #dddddd; text-align: right; }
th { background: #f5f5f5; font-weight: 700; }`;

  const headerCSS = Object.keys(header).length ? `
.page-header {
  background-color: ${header.background || 'transparent'};
  color: ${header.text_color || '#000000'};
  padding: ${header.padding || '12px 20px'};
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.page-header img { max-height: ${header.logo_height || '48px'}; }
.page-header .header-title { font-size: ${header.font_size || '14px'}; }` : '';

  const footerCSS = Object.keys(footer).length ? `
.page-footer {
  color: ${footer.text_color || '#888888'};
  font-size: ${footer.font_size || '11px'};
  text-align: ${footer.text_align || 'center'};
  padding: ${footer.padding || '8px 20px'};
  border-top: 1px solid ${footer.border_color || '#eeeeee'};
  margin-top: 32px;
}` : '';

  return `
${fontsImport}

* { box-sizing: border-box; }

body {
  margin: 0;
  padding: ${page.padding || '0'};
  background: ${page.background || '#ffffff'};
  font-family: ${page.font_family ? `'${page.font_family}', sans-serif` : 'sans-serif'};
  font-size: ${page.font_size || '14px'};
  color: ${page.color || '#333333'};
}

.page-content {
  padding: ${page.content_padding || '20px'};
}

img.section-image {
  max-width: 100%;
  display: block;
  margin: 12px auto;
}

.image-caption {
  text-align: center;
  font-size: 0.85em;
  color: #888;
  margin-top: 4px;
}

hr.divider {
  border: none;
  border-top: 1px solid ${styles.divider?.color || '#cccccc'};
  margin: ${styles.divider?.margin || '20px 0'};
}

.spacer { display: block; }

${elementCSS}

${tableCSS}

${headerCSS}

${footerCSS}

.lesson-details {
  display: flex;
  align-items: center;
  gap: 24px;
  font-size: 13px;
  padding: 6px 0;
  direction: rtl;
}
.ld-arrow {
  font-weight: 700;
  color: #555;
}
.ld-item strong {
  font-weight: 700;
}
.ld-item {
  font-weight: 400;
}
`.trim();
}

module.exports = { buildCSS };
