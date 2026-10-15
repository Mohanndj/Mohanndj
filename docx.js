'use strict';
// Minimal Word (.docx) writer for right-to-left Arabic text. Works offline with no library.
// Paragraph: { text, style, bold, center, pageBreak } or { runs: [{ text, bold }], style, … }.
// Styles: Title, Heading1, Meta, Normal, Tight (no space after), Question, Sep.

const Docx = (() => {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const xml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  let RTL = true;
  // a run; line breaks inside the text become <w:br/>
  function run(text, bold) {
    const rPr = `<w:rPr>${bold ? '<w:b/><w:bCs/>' : ''}${RTL ? '<w:rtl/>' : ''}</w:rPr>`;
    return String(text).split('\n').map((line, i) => `<w:r>${rPr}${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${xml(line)}</w:t></w:r>`).join('');
  }

  function para(p) {
    const runs = p.runs || [{ text: p.text || '', bold: p.bold }];
    const jc = p.center ? 'center' : p.style === 'Title' || p.style === 'Sep' ? 'center' : 'both';
    return `<w:p><w:pPr><w:pStyle w:val="${p.style || 'Normal'}"/>${p.pageBreak ? '<w:pageBreakBefore/>' : ''}${RTL ? '<w:bidi/>' : ''}<w:jc w:val="${jc}"/></w:pPr>${runs.map((r) => run(r.text, r.bold)).join('')}</w:p>`;
  }

  const font = (f) => `<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}" w:eastAsia="${f}"/>`;
  const style = (id, name, { size, bold, color, after = 120, before = 0, keepNext } = {}) => `
  <w:style w:type="paragraph"${id === 'Normal' ? ' w:default="1"' : ''} w:styleId="${id}"><w:name w:val="${name}"/>${id === 'Normal' ? '' : '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/>'}<w:qFormat/>
    <w:pPr>${keepNext ? '<w:keepNext/>' : ''}${RTL ? '<w:bidi/>' : ''}<w:spacing w:before="${before}" w:after="${after}" w:line="360" w:lineRule="auto"/></w:pPr>
    <w:rPr>${bold ? '<w:b/><w:bCs/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}${size ? `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` : ''}${RTL ? '<w:rtl/>' : ''}</w:rPr>
  </w:style>`;

  function styles(f, accent = '0F6E5E') {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W}">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>${font(f)}<w:sz w:val="${RTL ? 30 : 22}"/><w:szCs w:val="${RTL ? 30 : 22}"/><w:lang w:val="${RTL ? 'ar-SA' : 'en-US'}" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr>${RTL ? '<w:bidi/>' : ''}<w:spacing w:after="120" w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  ${style('Normal', 'Normal')}
  ${style('Title', 'Title', { size: RTL ? 48 : 40, bold: true, color: accent, after: 120 })}
  ${style('Heading1', 'heading 1', { size: RTL ? 36 : 28, bold: true, color: accent, before: 200, after: 60, keepNext: true })}
  ${style('Meta', 'Meta', { size: 24, color: '6B7A76', after: 160, keepNext: true })}
  ${style('Tight', 'Body Text', { after: 0 })}
  ${style('Question', 'Question', { bold: true, color: '33403D', before: 160, after: 40, keepNext: true })}
  ${style('Sep', 'Separator', { size: 28, color: '9AA8A4', before: 240, after: 240 })}
</w:styles>`;
  }

  function build(paragraphs, { font: f = 'Traditional Arabic', title = '', rtl = true, accent } = {}) {
    RTL = rtl;
    const body = paragraphs.map(para).join('');
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1300" w:right="1300" w:bottom="1300" w:left="1300" w:header="708" w:footer="708" w:gutter="0"/>${RTL ? '<w:bidi/>' : ''}</w:sectPr></w:body></w:document>`;
    const files = [
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>` },
      { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>` },
      { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(title)}</dc:title><dc:creator>مهامي</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>` },
      { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>` },
      { name: 'word/settings.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="${W}"><w:defaultTabStop w:val="720"/><w:compat><w:doNotExpandShiftReturn/></w:compat><w:themeFontLang w:val="en-US" w:bidi="ar-SA"/></w:settings>` },
      { name: 'word/styles.xml', data: styles(f, accent) },
      { name: 'word/document.xml', data: doc },
    ];
    return new Blob([Xlsx.zip(files)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  return { build };
})();
