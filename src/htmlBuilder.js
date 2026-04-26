function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSection(section) {
  const { type } = section;

  if (['h1', 'h2', 'h3', 'h4'].includes(type)) {
    return `<${type}>${escapeHtml(section.text)}</${type}>`;
  }

  if (type === 'p') {
    return `<p>${escapeHtml(section.text)}</p>`;
  }

  if (type === 'ul') {
    const items = (section.items || [])
      .map(item => `<li>${escapeHtml(item)}</li>`)
      .join('');
    return `<ul>${items}</ul>`;
  }

  if (type === 'ol') {
    const items = (section.items || [])
      .map(item => `<li>${escapeHtml(item)}</li>`)
      .join('');
    return `<ol>${items}</ol>`;
  }

  if (type === 'table') {
    const headers = (section.headers || [])
      .map(h => `<th>${escapeHtml(h)}</th>`)
      .join('');
    const rows = (section.rows || [])
      .map(row => {
        const cells = row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');
    return `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  }

  if (type === 'image') {
    const caption = section.caption
      ? `<div class="image-caption">${escapeHtml(section.caption)}</div>`
      : '';
    return `<img class="section-image" src="${escapeHtml(section.url)}" alt="${escapeHtml(section.caption || '')}">${caption}`;
  }

  if (type === 'lesson_details') {
    const fields = [
      { label: 'זמן', value: section.time },
      { label: 'דרגת קושי', value: section.level },
      { label: 'צורת ישיבה', value: section.sitting },
      { label: 'התערבות', value: section.intervention },
    ].filter(f => f.value);

    const items = fields
      .map(f => `<span class="ld-item"><strong>${escapeHtml(f.label)}</strong> ${escapeHtml(f.value)}</span>`)
      .join('');

    return `<div class="lesson-details"><span class="ld-arrow">&lt;&lt;</span>${items}<span class="ld-arrow">&gt;&gt;</span></div>`;
  }

  if (type === 'divider') {
    return `<hr class="divider">`;
  }

  if (type === 'spacer') {
    const height = section.height || '20px';
    return `<div class="spacer" style="height:${escapeHtml(height)}"></div>`;
  }

  if (type === 'page_break') {
    return `<div style="page-break-after: always;"></div>`;
  }

  return '';
}

function buildFixedHeader(styles) {
  const url = styles?.header?.logo_url;
  if (!url) return { html: '', css: '' };
  const height = styles.header.height || '60px';
  return {
    html: `<div class="pdf-fixed-header"><img src="${escapeHtml(url)}" alt="header"></div>`,
    css: `.pdf-fixed-header { position: fixed; top: 0; left: 0; right: 0; height: ${escapeHtml(height)}; z-index: 1000; }
.pdf-fixed-header img { width: 100%; height: 100%; object-fit: contain; display: block; }`,
  };
}

function buildFixedFooter(styles) {
  const url = styles?.footer?.logo_url;
  if (!url) return { html: '', css: '' };
  const height = styles.footer.height || '60px';
  return {
    html: `<div class="pdf-fixed-footer"><img src="${escapeHtml(url)}" alt="footer"></div>`,
    css: `.pdf-fixed-footer { position: fixed; bottom: 0; left: 0; right: 0; height: ${escapeHtml(height)}; z-index: 1000; }
.pdf-fixed-footer img { width: 100%; height: 100%; object-fit: contain; display: block; }`,
  };
}

function buildHTML(css, sections, metadata, styles, lang) {
  const dir = lang === 'he' || lang === 'ar' ? 'rtl' : 'ltr';
  const content = sections.map(renderSection).join('\n');
  const header = buildFixedHeader(styles);
  const footer = buildFixedFooter(styles);
  const topPad = header.html ? (styles.header?.height || '60px') : '0';
  const botPad = footer.html ? (styles.footer?.height || '60px') : '0';

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang || 'he')}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(metadata?.title || 'Document')}</title>
  <style>
${css}
${header.css}
${footer.css}
.page-content { padding-top: ${escapeHtml(topPad)}; padding-bottom: ${escapeHtml(botPad)}; }
  </style>
</head>
<body>
  ${header.html}
  <div class="page-content">
    ${content}
  </div>
  ${footer.html}
</body>
</html>`;
}

module.exports = { buildHTML };
