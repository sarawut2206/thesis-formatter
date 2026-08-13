/*!
 * docxgen.js — สร้างไฟล์ Microsoft Word (.docx) จากโครงสร้างย่อหน้า
 *
 * เขียน OOXML (WordprocessingML) เองทั้งหมด ไม่พึ่งไลบรารีภายนอก
 * เพื่อให้ควบคุมรูปแบบเอกสารได้ตรงตามที่กำหนดทุกจุด รวมถึงตาราง
 *
 * การใช้งาน:
 *   TFDocx.build({ sections: [...], spec: {...}, meta: {...} })  -> Promise<Blob>
 */
var TFDocx = (function () {
  'use strict';

  /* ---------------- หน่วยวัด ---------------- */
  var tw = function (pt) { return Math.round(Number(pt || 0) * 20); };   // pt -> twips
  var hp = function (pt) { return Math.round(Number(pt || 0) * 2); };    // pt -> half-points

  /* ---------------- escape ---------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')  // ตัดอักขระควบคุมที่ XML ไม่รับ
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var XMLDECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

  var NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
           'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

  /* ---------------- แผนที่ประเภทย่อหน้า -> ชื่อสไตล์ ---------------- */
  var STYLE_ID = {
    chapterNum:   'TFChapterNum',
    chapterTitle: 'TFChapterTitle',
    h1:           'TFHeading1',
    h2:           'TFHeading2',
    h3:           'TFHeading3',
    h4:           'TFHeading4',
    body:         'TFBody',
    list:         'TFList',
    quote:        'TFQuote',
    caption:      'TFCaption',
    bib:          'TFBib',
    center:       'TFCenter',
    blank:        'TFBlank'
  };

  // ระดับ outline (ใช้ให้ฟิลด์สารบัญของ Word ทำงาน)
  var OUTLINE = { chapterTitle: 0, h1: 1, h2: 2, h3: 3, h4: 4 };

  /* ---------------- ระยะบรรทัด ---------------- */
  function spacingXml(st, spec) {
    var ls = spec.lineSpacing || { rule: 'single' };
    var attrs = '';
    var before = tw(st.before || 0);
    var after = tw(st.after || 0);
    if (before) attrs += ' w:before="' + before + '"';
    if (after) attrs += ' w:after="' + after + '"';

    switch (ls.rule) {
      case 'onehalf':  attrs += ' w:line="360" w:lineRule="auto"'; break;
      case 'double':   attrs += ' w:line="480" w:lineRule="auto"'; break;
      case 'exact':    attrs += ' w:line="' + tw(ls.value || 20) + '" w:lineRule="exact"'; break;
      case 'multiple': attrs += ' w:line="' + Math.round(240 * (ls.value || 1)) + '" w:lineRule="auto"'; break;
      default:         attrs += ' w:line="240" w:lineRule="auto"'; break;
    }
    return '<w:spacing' + attrs + ' w:beforeAutospacing="0" w:afterAutospacing="0"/>';
  }

  /* ---------------- ระยะเยื้อง ----------------
   * ระบุค่าให้ครบทุกตัวเสมอ (แม้เป็น 0) เพื่อไม่ให้ย่อหน้าไปสืบทอด
   * ระยะเยื้องของสไตล์อื่นโดยไม่ตั้งใจ เช่น บรรทัดว่างไปได้ระยะย่อหน้าของเนื้อความ
   */
  function indentXml(st) {
    var a = ' w:left="' + tw(st.indent || 0) + '" w:right="' + tw(st.right || 0) + '"';
    if (st.hanging) a += ' w:hanging="' + tw(st.hanging) + '"';
    else a += ' w:firstLine="' + tw(st.firstLine || 0) + '"';
    return '<w:ind' + a + '/>';
  }

  function jcXml(align) {
    var map = {
      left: 'left', center: 'center', right: 'right',
      both: 'both', justify: 'both', thaiDistribute: 'thaiDistribute'
    };
    return '<w:jc w:val="' + (map[align] || 'left') + '"/>';
  }

  /* ---------------- คุณสมบัติตัวอักษร ---------------- */
  function rPrXml(st, spec, override) {
    override = override || {};
    var f = esc(spec.font.name);
    var size = hp(override.size != null ? override.size : st.size);
    var bold = override.bold != null ? override.bold : st.bold;
    var s = '<w:rPr>' +
      '<w:rFonts w:ascii="' + f + '" w:hAnsi="' + f + '" w:cs="' + f + '" w:eastAsia="' + f + '"/>';
    if (bold) s += '<w:b/><w:bCs/>';
    if (override.italic || st.italic) s += '<w:i/><w:iCs/>';
    if (override.underline || st.underline) s += '<w:u w:val="single"/>';
    s += '<w:sz w:val="' + size + '"/><w:szCs w:val="' + size + '"/>' +
         '<w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="th-TH"/>' +
         '</w:rPr>';
    return s;
  }

  /* ---------------- แปลงข้อความเป็น run ---------------- */
  /**
   * รองรับ **ตัวหนา** และแท็บ
   */
  function runsXml(text, st, spec) {
    if (text == null || text === '') return '';
    var out = '';
    var parts = String(text).split(/(\*\*[^*]+\*\*)/g);

    parts.forEach(function (p) {
      if (!p) return;
      var bold = null, content = p;
      var m = p.match(/^\*\*([^*]+)\*\*$/);
      if (m) { bold = true; content = m[1]; }

      var pieces = content.split('\t');
      pieces.forEach(function (piece, idx) {
        if (idx > 0) out += '<w:r>' + rPrXml(st, spec, bold != null ? { bold: bold } : {}) + '<w:tab/></w:r>';
        if (piece === '') return;
        out += '<w:r>' + rPrXml(st, spec, bold != null ? { bold: bold } : {}) +
               '<w:t xml:space="preserve">' + esc(piece) + '</w:t></w:r>';
      });
    });
    return out;
  }

  /* ---------------- ย่อหน้าเดี่ยว ---------------- */
  function paragraphXml(block, spec, extra) {
    extra = extra || {};
    var type = block.type || 'body';
    var st = Object.assign({}, spec.styles[type] || spec.styles.body, block.style || {});
    var styleId = STYLE_ID[type] || 'TFBody';

    var pPr = '<w:pPr><w:pStyle w:val="' + styleId + '"/>';
    if (block.pageBreakBefore || extra.pageBreakBefore) pPr += '<w:pageBreakBefore/>';
    if (block.keepNext) pPr += '<w:keepNext/>';
    if (OUTLINE[type] != null) pPr += '<w:keepNext/>';
    pPr += spacingXml(st, spec);
    pPr += indentXml(st);
    pPr += jcXml(st.align);
    if (block.tabs && block.tabs.length) {
      pPr += '<w:tabs>' + block.tabs.map(function (t) {
        return '<w:tab w:val="' + (t.type || 'left') + '"' +
               (t.leader ? ' w:leader="' + t.leader + '"' : '') +
               ' w:pos="' + tw(t.pos) + '"/>';
      }).join('') + '</w:tabs>';
    }
    if (extra.sectPr) pPr += extra.sectPr;
    pPr += rPrForPara(st, spec);
    pPr += '</w:pPr>';

    var body = block.field ? fieldRunXml(block, st, spec) : runsXml(block.text, st, spec);
    return '<w:p>' + pPr + body + '</w:p>';
  }

  // rPr ภายใน pPr (คุมสัญลักษณ์จบย่อหน้า ให้ระยะบรรทัดไม่เพี้ยน)
  function rPrForPara(st, spec) {
    var f = esc(spec.font.name);
    var size = hp(st.size);
    var s = '<w:rPr><w:rFonts w:ascii="' + f + '" w:hAnsi="' + f + '" w:cs="' + f + '"/>';
    if (st.bold) s += '<w:b/><w:bCs/>';
    s += '<w:sz w:val="' + size + '"/><w:szCs w:val="' + size + '"/></w:rPr>';
    return s;
  }

  /* ---------------- ฟิลด์ของ Word (เช่น สารบัญอัตโนมัติ) ---------------- */
  function fieldRunXml(block, st, spec) {
    var rpr = rPrXml(st, spec);
    return '<w:r>' + rpr + '<w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>' +
           '<w:r>' + rpr + '<w:instrText xml:space="preserve"> ' + esc(block.field) + ' </w:instrText></w:r>' +
           '<w:r>' + rpr + '<w:fldChar w:fldCharType="separate"/></w:r>' +
           '<w:r>' + rpr + '<w:t xml:space="preserve">' + esc(block.text || '') + '</w:t></w:r>' +
           '<w:r>' + rpr + '<w:fldChar w:fldCharType="end"/></w:r>';
  }

  /* ---------------- ตาราง ----------------
   * สร้าง <w:tbl> จริง ไม่ใช่ข้อความคั่นด้วยแท็บ
   * ความกว้างคอลัมน์ถ่วงตามความยาวข้อความ เพื่อให้คอลัมน์ชื่อยาวได้พื้นที่มากกว่า
   */
  function contentWidthTw(spec) {
    return tw(spec.page.width - spec.page.marginLeft - spec.page.marginRight);
  }

  function columnWidths(rows, totalTw) {
    var cols = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    if (!cols) return [];
    var weights = [];
    for (var c = 0; c < cols; c++) {
      var longest = 0;
      rows.forEach(function (r) { longest = Math.max(longest, String(r[c] == null ? '' : r[c]).length); });
      // จำกัดช่วงไว้ ไม่ให้คอลัมน์เดียวกินพื้นที่ทั้งหมด
      weights.push(Math.max(5, Math.min(longest, 42)));
    }
    var sum = weights.reduce(function (a, b) { return a + b; }, 0);
    var out = weights.map(function (w) { return Math.floor(totalTw * w / sum); });
    out[out.length - 1] += totalTw - out.reduce(function (a, b) { return a + b; }, 0);
    return out;
  }

  function tblBordersXml(sz) {
    return '<w:tblBorders>' +
      ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(function (side) {
        return '<w:' + side + ' w:val="single" w:sz="' + sz + '" w:space="0" w:color="000000"/>';
      }).join('') +
      '</w:tblBorders>';
  }

  function cellParagraphXml(text, st, spec, styleId) {
    var pPr = '<w:pPr><w:pStyle w:val="' + styleId + '"/>' +
      spacingXml({ before: st.before || 0, after: st.after || 0 }, spec) +
      '<w:ind w:left="0" w:right="0" w:firstLine="0"/>' +
      jcXml(st.align) + rPrForPara(st, spec) + '</w:pPr>';
    return '<w:p>' + pPr + runsXml(text, st, spec) + '</w:p>';
  }

  function tableXml(block, spec) {
    var ts = spec.styles.table || spec.styles.body;
    var rows = block.rows || [];
    if (!rows.length) return '';

    var widths = columnWidths(rows, contentWidthTw(spec));
    var borderSz = ts.borderSize == null ? 4 : ts.borderSize;
    var padTw = tw(ts.cellPadding == null ? 4 : ts.cellPadding);

    var headStyle = {
      size: ts.size, bold: ts.headerBold !== false,
      align: ts.headerAlign || 'center', before: 0, after: 0
    };
    var cellStyle = { size: ts.size, bold: false, align: ts.align || 'left', before: 0, after: 0 };

    var s = '<w:tbl><w:tblPr>' +
      '<w:tblW w:w="' + contentWidthTw(spec) + '" w:type="dxa"/>' +
      '<w:jc w:val="center"/>' +
      tblBordersXml(borderSz) +
      '<w:tblLayout w:type="fixed"/>' +
      '<w:tblCellMar>' +
        '<w:top w:w="' + Math.round(padTw / 2) + '" w:type="dxa"/>' +
        '<w:left w:w="' + padTw + '" w:type="dxa"/>' +
        '<w:bottom w:w="' + Math.round(padTw / 2) + '" w:type="dxa"/>' +
        '<w:right w:w="' + padTw + '" w:type="dxa"/>' +
      '</w:tblCellMar>' +
      '</w:tblPr>';

    s += '<w:tblGrid>' + widths.map(function (w) {
      return '<w:gridCol w:w="' + w + '"/>';
    }).join('') + '</w:tblGrid>';

    rows.forEach(function (row, ri) {
      var isHead = block.header !== false && ri === 0;
      s += '<w:tr><w:trPr><w:cantSplit/>' + (isHead ? '<w:tblHeader/>' : '') + '</w:trPr>';
      widths.forEach(function (w, ci) {
        s += '<w:tc><w:tcPr>' +
             '<w:tcW w:w="' + w + '" w:type="dxa"/>' +
             '<w:vAlign w:val="center"/>' +
             '</w:tcPr>' +
             cellParagraphXml(row[ci] == null ? '' : row[ci],
                              isHead ? headStyle : cellStyle, spec,
                              isHead ? 'TFTableHead' : 'TFTableCell') +
             '</w:tc>';
      });
      s += '</w:tr>';
    });

    s += '</w:tbl>';
    return s;
  }

  /* ---------------- คุณสมบัติ section ---------------- */
  function sectPrXml(sec, spec, rel) {
    var p = spec.page;
    var pn = spec.pageNumber || {};
    var showNum = pn.show && !sec.hidePageNumber;
    var s = '<w:sectPr>';

    if (showNum) {
      s += '<w:headerReference w:type="default" r:id="' + rel.header + '"/>';
      if (sec.titlePg) s += '<w:headerReference w:type="first" r:id="' + rel.headerBlank + '"/>';
    } else {
      s += '<w:headerReference w:type="default" r:id="' + rel.headerBlank + '"/>';
      s += '<w:headerReference w:type="first" r:id="' + rel.headerBlank + '"/>';
    }
    s += '<w:type w:val="nextPage"/>';
    s += '<w:pgSz w:w="' + tw(p.width) + '" w:h="' + tw(p.height) + '"/>';
    s += '<w:pgMar w:top="' + tw(p.marginTop) + '" w:right="' + tw(p.marginRight) +
         '" w:bottom="' + tw(p.marginBottom) + '" w:left="' + tw(p.marginLeft) +
         '" w:header="' + tw(p.headerDistance) + '" w:footer="' + tw(p.footerDistance) + '" w:gutter="0"/>';

    var fmt = sec.pageNumFormat || pn.bodyFormat || 'decimal';
    var attrs = ' w:fmt="' + fmt + '"';
    if (sec.pageNumStart != null) attrs += ' w:start="' + sec.pageNumStart + '"';
    s += '<w:pgNumType' + attrs + '/>';
    s += '<w:cols w:space="720"/>';
    if (sec.titlePg) s += '<w:titlePg/>';
    s += '<w:docGrid w:linePitch="360"/>';
    s += '</w:sectPr>';
    return s;
  }

  /* ---------------- styles.xml ---------------- */
  function styleDef(id, name, st, spec, opts) {
    opts = opts || {};
    var s = '<w:style w:type="paragraph" w:styleId="' + id + '">' +
      '<w:name w:val="' + esc(name) + '"/>' +
      '<w:basedOn w:val="Normal"/>' +
      '<w:qFormat/>' +
      '<w:pPr>';
    if (opts.outline != null) s += '<w:outlineLvl w:val="' + opts.outline + '"/>';
    if (opts.keepNext) s += '<w:keepNext/>';
    s += spacingXml(st, spec) + indentXml(st) + jcXml(st.align) + '</w:pPr>';
    s += '<w:rPr><w:rFonts w:ascii="' + esc(spec.font.name) + '" w:hAnsi="' + esc(spec.font.name) +
         '" w:cs="' + esc(spec.font.name) + '"/>';
    if (st.bold) s += '<w:b/><w:bCs/>';
    s += '<w:sz w:val="' + hp(st.size) + '"/><w:szCs w:val="' + hp(st.size) + '"/></w:rPr></w:style>';
    return s;
  }

  function stylesXml(spec) {
    var f = esc(spec.font.name);
    var base = spec.styles.body;

    var s = XMLDECL + '<w:styles ' + NS + '>';

    // ค่าเริ่มต้นของทั้งเอกสาร
    s += '<w:docDefaults><w:rPrDefault><w:rPr>' +
         '<w:rFonts w:ascii="' + f + '" w:hAnsi="' + f + '" w:cs="' + f + '" w:eastAsia="' + f + '"/>' +
         '<w:sz w:val="' + hp(base.size) + '"/><w:szCs w:val="' + hp(base.size) + '"/>' +
         '<w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="th-TH"/>' +
         '</w:rPr></w:rPrDefault>' +
         '<w:pPrDefault><w:pPr>' + spacingXml({ before: 0, after: 0 }, spec) + '</w:pPr></w:pPrDefault>' +
         '</w:docDefaults>';

    // Normal
    s += '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">' +
         '<w:name w:val="Normal"/><w:qFormat/>' +
         '<w:pPr>' + spacingXml({ before: 0, after: 0 }, spec) + '<w:jc w:val="left"/></w:pPr>' +
         '<w:rPr><w:rFonts w:ascii="' + f + '" w:hAnsi="' + f + '" w:cs="' + f + '"/>' +
         '<w:sz w:val="' + hp(base.size) + '"/><w:szCs w:val="' + hp(base.size) + '"/></w:rPr></w:style>';

    s += '<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont">' +
         '<w:name w:val="Default Paragraph Font"/></w:style>';

    // สไตล์ของเรา
    s += styleDef('TFChapterNum',   'TF Chapter Number', spec.styles.chapterNum,   spec, { keepNext: true });
    s += styleDef('TFChapterTitle', 'TF Chapter Title',  spec.styles.chapterTitle, spec, { outline: 0, keepNext: true });
    s += styleDef('TFHeading1',     'TF Heading 1',      spec.styles.h1,           spec, { outline: 1, keepNext: true });
    s += styleDef('TFHeading2',     'TF Heading 2',      spec.styles.h2,           spec, { outline: 2, keepNext: true });
    s += styleDef('TFHeading3',     'TF Heading 3',      spec.styles.h3,           spec, { outline: 3, keepNext: true });
    s += styleDef('TFHeading4',     'TF Heading 4',      spec.styles.h4,           spec, { outline: 4, keepNext: true });
    s += styleDef('TFBody',         'TF Body',           spec.styles.body,         spec);
    s += styleDef('TFList',         'TF List',           spec.styles.list,         spec);
    s += styleDef('TFQuote',        'TF Quote',          spec.styles.quote,        spec);
    s += styleDef('TFCaption',      'TF Caption',        spec.styles.caption,      spec, { keepNext: true });
    s += styleDef('TFBib',          'TF Bibliography',   spec.styles.bib,          spec);
    s += styleDef('TFCenter',       'TF Center',         spec.styles.center,       spec);
    s += styleDef('TFBlank',        'TF Blank Line',     spec.styles.blank,        spec);

    // สไตล์ในช่องตาราง — ไม่เยื้องบรรทัดแรก ไม่มีระยะห่างก่อน/หลัง
    var ts = spec.styles.table || spec.styles.body;
    s += styleDef('TFTableCell', 'TF Table Cell',
      { size: ts.size, bold: false, align: ts.align || 'left', indent: 0, firstLine: 0, before: 0, after: 0 }, spec);
    s += styleDef('TFTableHead', 'TF Table Head',
      { size: ts.size, bold: ts.headerBold !== false, align: ts.headerAlign || 'center', indent: 0, firstLine: 0, before: 0, after: 0 }, spec);

    // หัว/ท้ายกระดาษ
    var hdr = { size: base.size, bold: false, align: 'center', before: 0, after: 0 };
    s += styleDef('Header', 'header', hdr, spec);
    s += styleDef('Footer', 'footer', hdr, spec);

    // สไตล์สารบัญ (ใช้เมื่อเปิดฟิลด์สารบัญอัตโนมัติ)
    [1, 2, 3].forEach(function (lv) {
      s += styleDef('TOC' + lv, 'toc ' + lv,
        { size: base.size, bold: false, align: 'left', indent: (lv - 1) * 24, before: 0, after: 0 }, spec);
    });

    s += '</w:styles>';
    return s;
  }

  /* ---------------- settings.xml ---------------- */
  function settingsXml(spec) {
    return XMLDECL + '<w:settings ' + NS + '>' +
      '<w:zoom w:percent="100"/>' +
      '<w:defaultTabStop w:val="720"/>' +
      '<w:characterSpacingControl w:val="compressPunctuation"/>' +
      (spec.options && spec.options.autoTocField ? '<w:updateFields w:val="true"/>' : '') +
      // applyBreakingRules สั่งให้ Word ใช้กฎตัดบรรทัดของภาษาเอเชีย
      // ถ้าไม่ใส่ Word จะตัดข้อความไทยได้แค่ตรงช่องว่าง ทำให้บรรทัดสั้นผิดปกติ
      // แล้วต้องยืดตัวอักษรจนเห็นเป็นช่องว่างกลางคำ (ค่านี้มีในเทมเพลตวิทยานิพนธ์ของจริง)
      '<w:compat><w:applyBreakingRules/><w:useFELayout/>' +
      '<w:compatSetting w:name="compatibilityMode" ' +
      'w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>' +
      '<w:themeFontLang w:val="en-US" w:bidi="th-TH"/>' +
      '</w:settings>';
  }

  /* ---------------- header parts ---------------- */
  function headerXml(spec) {
    var pn = spec.pageNumber || {};
    var st = { size: pn.size || spec.styles.body.size, bold: false, align: pn.position || 'center', before: 0, after: 0 };
    var rpr = rPrXml(st, spec);
    return XMLDECL + '<w:hdr ' + NS + '>' +
      '<w:p><w:pPr><w:pStyle w:val="Header"/>' + jcXml(st.align) + rPrForPara(st, spec) + '</w:pPr>' +
      '<w:r>' + rpr + '<w:fldChar w:fldCharType="begin"/></w:r>' +
      '<w:r>' + rpr + '<w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>' +
      '<w:r>' + rpr + '<w:fldChar w:fldCharType="separate"/></w:r>' +
      '<w:r>' + rpr + '<w:t>1</w:t></w:r>' +
      '<w:r>' + rpr + '<w:fldChar w:fldCharType="end"/></w:r>' +
      '</w:p></w:hdr>';
  }

  function blankHeaderXml() {
    return XMLDECL + '<w:hdr ' + NS + '>' +
      '<w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr></w:p></w:hdr>';
  }

  /* ---------------- document.xml ---------------- */
  function documentXml(sections, spec, rel) {
    var body = '';
    sections.forEach(function (sec, i) {
      var blocks = (sec.blocks || []).slice();
      var last = i === sections.length - 1;
      var sectPr = sectPrXml(sec, spec, rel);

      // Word ต้องมีย่อหน้าคั่นหลังตารางเสมอ และย่อหน้าสุดท้ายของ section
      // คือที่เก็บ sectPr จึงเติมย่อหน้าว่างต่อท้ายถ้าบล็อกสุดท้ายเป็นตาราง
      if (!blocks.length || blocks[blocks.length - 1].type === 'table') {
        blocks.push({ type: 'blank', text: '' });
      }

      blocks.forEach(function (b, j) {
        var isLastOfSection = j === blocks.length - 1;

        if (b.type === 'table' && b.rows) {
          body += tableXml(b, spec);
          // ตารางสองอันติดกันจะถูก Word รวมเป็นตารางเดียว ถ้าไม่มีย่อหน้าคั่น
          if (blocks[j + 1] && blocks[j + 1].type === 'table') {
            body += paragraphXml({ type: 'blank', text: '' }, spec, {});
          }
          return;
        }

        var extra = {};
        if (!last && isLastOfSection) extra.sectPr = sectPr;
        body += paragraphXml(b, spec, extra);
      });

      if (last) body += sectPr;
    });

    return XMLDECL + '<w:document ' + NS + '><w:body>' + body + '</w:body></w:document>';
  }

  /* ---------------- docProps ---------------- */
  function coreXml(meta) {
    return XMLDECL +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
      'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:title>' + esc(meta.title || '') + '</dc:title>' +
      '<dc:creator>' + esc(meta.author || '') + '</dc:creator>' +
      '<cp:lastModifiedBy>' + esc(meta.author || '') + '</cp:lastModifiedBy>' +
      '</cp:coreProperties>';
  }

  function appXml() {
    return XMLDECL +
      '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
      'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
      '<Application>Thesis Formatter</Application></Properties>';
  }

  /* ---------------- ประกอบไฟล์ ---------------- */
  function build(input) {
    var spec = input.spec;
    var meta = input.meta || {};
    var sections = input.sections || [];
    var rel = { header: 'rId3', headerBlank: 'rId4' };

    var contentTypes = XMLDECL +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>' +
      '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
      '<Override PartName="/word/header2.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
      '</Types>';

    var rootRels = XMLDECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
      '</Relationships>';

    var docRels = XMLDECL +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>' +
      '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>' +
      '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header2.xml"/>' +
      '</Relationships>';

    return TFZip.create([
      { name: '[Content_Types].xml',        data: contentTypes },
      { name: '_rels/.rels',                data: rootRels },
      { name: 'docProps/core.xml',          data: coreXml(meta) },
      { name: 'docProps/app.xml',           data: appXml() },
      { name: 'word/document.xml',          data: documentXml(sections, spec, rel) },
      { name: 'word/_rels/document.xml.rels', data: docRels },
      { name: 'word/styles.xml',            data: stylesXml(spec) },
      { name: 'word/settings.xml',          data: settingsXml(spec) },
      { name: 'word/header1.xml',           data: headerXml(spec) },
      { name: 'word/header2.xml',           data: blankHeaderXml() }
    ]);
  }

  /** สร้างเอกสารจากบล็อกชุดเดียว (เอกสารบทเดียว) */
  function buildSingle(blocks, spec, meta, secOpt) {
    var sec = Object.assign({
      blocks: blocks,
      titlePg: !!(spec.pageNumber && spec.pageNumber.hideOnFirstPageOfChapter),
      pageNumFormat: (spec.pageNumber && spec.pageNumber.bodyFormat) || 'decimal',
      pageNumStart: 1
    }, secOpt || {});
    return build({ sections: [sec], spec: spec, meta: meta || {} });
  }

  /** ดาวน์โหลด Blob เป็นไฟล์ */
  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }

  return {
    build: build,
    buildSingle: buildSingle,
    download: download,
    STYLE_ID: STYLE_ID,
    tw: tw,
    hp: hp
  };
})();
