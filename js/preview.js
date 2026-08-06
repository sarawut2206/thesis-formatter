/*!
 * preview.js — แสดงตัวอย่างเอกสารเป็นหน้ากระดาษ A4 จริง (โดยประมาณ)
 *
 * ใช้หน่วย pt เท่ากับที่ส่งไปยังไฟล์ .docx เพื่อให้ตัวอย่างใกล้เคียงของจริงที่สุด
 * หมายเหตุ: การแบ่งหน้าเป็นการประมาณระดับย่อหน้า (ย่อหน้าเดียวจะไม่ถูกตัดข้ามหน้า)
 */
var TFPreview = (function () {
  'use strict';

  function alignCss(a) {
    if (a === 'center') return 'center';
    if (a === 'right') return 'right';
    if (a === 'both' || a === 'justify' || a === 'thaiDistribute') return 'justify';
    return 'left';
  }

  function lineHeightCss(spec) {
    var ls = spec.lineSpacing || { rule: 'single' };
    switch (ls.rule) {
      case 'onehalf':  return '1.5';
      case 'double':   return '2';
      case 'exact':    return (ls.value || 20) + 'pt';
      case 'multiple': return String(ls.value || 1);
      default:         return '1';
    }
  }

  /** สร้าง element ของตาราง */
  function makeTableEl(block, spec) {
    var ts = spec.styles.table || spec.styles.body;
    var rows = block.rows || [];
    var wrap = document.createElement('div');
    wrap.className = 'pv-block pv-table';
    wrap.dataset.type = 'table';
    wrap.style.fontFamily = spec.font.fallback || spec.font.name;
    wrap.style.fontSize = ts.size + 'pt';
    wrap.style.lineHeight = lineHeightCss(spec);
    if (block.pageBreakBefore) wrap.dataset.pageBreak = '1';

    var table = document.createElement('table');
    var pad = (ts.cellPadding == null ? 4 : ts.cellPadding);
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    table.style.tableLayout = 'fixed';

    // ความกว้างคอลัมน์ถ่วงตามความยาวข้อความ (สูตรเดียวกับตอนสร้าง .docx)
    var cols = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    var weights = [];
    for (var c = 0; c < cols; c++) {
      var longest = 0;
      rows.forEach(function (r) { longest = Math.max(longest, String(r[c] == null ? '' : r[c]).length); });
      weights.push(Math.max(5, Math.min(longest, 42)));
    }
    var sum = weights.reduce(function (a, b) { return a + b; }, 0) || 1;

    var colgroup = document.createElement('colgroup');
    weights.forEach(function (w) {
      var col = document.createElement('col');
      col.style.width = (100 * w / sum).toFixed(2) + '%';
      colgroup.appendChild(col);
    });
    table.appendChild(colgroup);

    rows.forEach(function (row, ri) {
      var isHead = block.header !== false && ri === 0;
      var tr = document.createElement('tr');
      for (var ci = 0; ci < cols; ci++) {
        var td = document.createElement(isHead ? 'th' : 'td');
        td.style.border = '1px solid #000';
        td.style.padding = (pad / 2) + 'pt ' + pad + 'pt';
        td.style.verticalAlign = 'middle';
        td.style.fontWeight = isHead && ts.headerBold !== false ? '700' : '400';
        td.style.textAlign = isHead ? (ts.headerAlign || 'center') : (ts.align || 'left');
        td.style.wordBreak = 'break-word';
        td.textContent = row[ci] == null ? '' : row[ci];
        tr.appendChild(td);
      }
      table.appendChild(tr);
    });

    wrap.appendChild(table);
    return wrap;
  }

  /** สร้าง element ของย่อหน้าเดียว */
  function makeBlockEl(block, spec) {
    if (block.type === 'table' && block.rows) return makeTableEl(block, spec);
    var type = block.type || 'body';
    var st = Object.assign({}, spec.styles[type] || spec.styles.body, block.style || {});
    var el = document.createElement('div');
    el.className = 'pv-block pv-' + type;
    el.dataset.type = type;

    var s = el.style;
    s.fontFamily = spec.font.fallback || spec.font.name;
    s.fontSize = st.size + 'pt';
    s.fontWeight = st.bold ? '700' : '400';
    s.textAlign = alignCss(st.align);
    s.lineHeight = lineHeightCss(spec);
    s.marginTop = (st.before || 0) + 'pt';
    s.marginBottom = (st.after || 0) + 'pt';
    s.marginLeft = (st.indent || 0) + 'pt';
    s.marginRight = (st.right || 0) + 'pt';

    if (st.hanging) {
      s.textIndent = '-' + st.hanging + 'pt';
    } else if (st.firstLine) {
      s.textIndent = st.firstLine + 'pt';
    }

    var text = block.text || '';
    if (text === '') {
      el.innerHTML = '&nbsp;';
    } else {
      // แปลง **ตัวหนา** และแท็บ
      var html = escapeHtml(text)
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/\t/g, '<span class="pv-tab"></span>');
      el.innerHTML = html;
    }
    if (block.pageBreakBefore) el.dataset.pageBreak = '1';
    return el;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * เรนเดอร์บล็อกทั้งหมดลงใน container พร้อมแบ่งหน้า
   * @param {HTMLElement} container
   * @param {Array} blocks
   * @param {Object} spec
   * @param {Object} opt { startPage, pageNumFormat, showPageNumber }
   */
  function render(container, blocks, spec, opt) {
    opt = opt || {};
    container.innerHTML = '';

    var p = spec.page;
    var contentW = p.width - p.marginLeft - p.marginRight;
    var contentH = p.height - p.marginTop - p.marginBottom;

    // 1) วัดความสูงของแต่ละย่อหน้าในกล่องซ่อน
    var measurer = document.createElement('div');
    measurer.className = 'pv-measure';
    measurer.style.width = contentW + 'pt';
    container.appendChild(measurer);

    var els = blocks.map(function (b) {
      var el = makeBlockEl(b, spec);
      measurer.appendChild(el);
      return el;
    });

    var heights = els.map(function (el) {
      var cs = getComputedStyle(el);
      return el.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
    });

    container.removeChild(measurer);

    // 2) จัดลงหน้า
    var pxPerPt = 96 / 72;
    var maxH = contentH * pxPerPt;
    var pages = [[]];
    var used = 0;

    for (var i = 0; i < els.length; i++) {
      var h = heights[i];
      var forceBreak = els[i].dataset.pageBreak === '1' && pages[pages.length - 1].length > 0;
      if (forceBreak || (used + h > maxH && pages[pages.length - 1].length > 0)) {
        pages.push([]);
        used = 0;
      }
      pages[pages.length - 1].push(els[i]);
      used += h;
    }

    // 3) วาดหน้ากระดาษ
    var startPage = opt.startPage || 1;
    var pn = spec.pageNumber || {};
    var showNum = opt.showPageNumber != null ? opt.showPageNumber : pn.show;

    pages.forEach(function (pageEls, idx) {
      var page = document.createElement('div');
      page.className = 'pv-page';
      page.style.width = p.width + 'pt';
      page.style.minHeight = p.height + 'pt';
      page.style.paddingTop = p.marginTop + 'pt';
      page.style.paddingBottom = p.marginBottom + 'pt';
      page.style.paddingLeft = p.marginLeft + 'pt';
      page.style.paddingRight = p.marginRight + 'pt';

      // เลขหน้าในหัวกระดาษ
      var hideFirst = pn.hideOnFirstPageOfChapter && idx === 0;
      if (showNum && !hideFirst) {
        var hdr = document.createElement('div');
        hdr.className = 'pv-header';
        hdr.style.top = p.headerDistance + 'pt';
        hdr.style.left = p.marginLeft + 'pt';
        hdr.style.right = p.marginRight + 'pt';
        hdr.style.fontFamily = spec.font.fallback || spec.font.name;
        hdr.style.fontSize = (pn.size || spec.styles.body.size) + 'pt';
        hdr.style.textAlign = alignCss(pn.position || 'center');
        hdr.textContent = formatPageNum(startPage + idx, opt.pageNumFormat || pn.bodyFormat);
        page.appendChild(hdr);
      }

      var inner = document.createElement('div');
      inner.className = 'pv-content';
      pageEls.forEach(function (el) { inner.appendChild(el); });
      page.appendChild(inner);

      var label = document.createElement('div');
      label.className = 'pv-page-label';
      label.textContent = 'หน้า ' + (idx + 1) + ' / ' + pages.length;
      page.appendChild(label);

      container.appendChild(page);
    });

    if (!blocks.length) {
      var empty = document.createElement('p');
      empty.className = 'pv-empty';
      empty.textContent = 'ยังไม่มีข้อความ — วางเนื้อหาในช่องด้านซ้าย แล้วตัวอย่างจะปรากฏที่นี่';
      container.appendChild(empty);
    }

    return pages.length;
  }

  var THAI_LETTERS = ('ก ข ค ฆ ง จ ฉ ช ซ ฌ ญ ฎ ฏ ฐ ฑ ฒ ณ ด ต ถ ท ธ น บ ป ผ ฝ พ ฟ ภ ม ย ร ล ว ศ ษ ส ห ฬ อ ฮ').split(' ');

  function formatPageNum(n, fmt) {
    if (fmt === 'thaiLetters') {
      if (n <= THAI_LETTERS.length) return THAI_LETTERS[n - 1];
      return THAI_LETTERS[(n - 1) % THAI_LETTERS.length] + Math.ceil(n / THAI_LETTERS.length);
    }
    if (fmt === 'lowerRoman') return toRoman(n).toLowerCase();
    if (fmt === 'upperRoman') return toRoman(n);
    return String(n);
  }

  function toRoman(n) {
    var map = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],
               [50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
    var out = '';
    map.forEach(function (m) { while (n >= m[0]) { out += m[1]; n -= m[0]; } });
    return out;
  }

  /**
   * ประเมินว่าย่อหน้าแต่ละอันตกอยู่หน้าที่เท่าใด (ใช้คำนวณเลขหน้าในสารบัญ)
   * @returns {number[]} ดัชนีหน้า (เริ่มที่ 1) ของแต่ละบล็อก
   */
  function measurePages(blocks, spec) {
    var p = spec.page;
    var contentW = p.width - p.marginLeft - p.marginRight;
    var contentH = p.height - p.marginTop - p.marginBottom;

    var host = document.createElement('div');
    host.className = 'pv-measure';
    host.style.width = contentW + 'pt';
    document.body.appendChild(host);

    var heights = blocks.map(function (b) {
      var el = makeBlockEl(b, spec);
      host.appendChild(el);
      var cs = getComputedStyle(el);
      return el.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
    });

    document.body.removeChild(host);

    var maxH = contentH * (96 / 72);
    var page = 1, used = 0, result = [];
    for (var i = 0; i < blocks.length; i++) {
      var forceBreak = blocks[i].pageBreakBefore && used > 0;
      if (forceBreak || (used + heights[i] > maxH && used > 0)) { page++; used = 0; }
      result.push(page);
      used += heights[i];
    }
    return result;
  }

  return {
    render: render,
    makeBlockEl: makeBlockEl,
    measurePages: measurePages,
    formatPageNum: formatPageNum,
    THAI_LETTERS: THAI_LETTERS
  };
})();
