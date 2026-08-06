/*!
 * frontmatter.js — สร้างส่วนหน้าของเล่มวิทยานิพนธ์
 *   ปกนอก/ปกใน · หน้าอนุมัติ · บทคัดย่อไทย · Abstract · กิตติกรรมประกาศ
 *   สารบัญ · สารบัญตาราง · สารบัญภาพ · ประวัติผู้เขียน
 *
 * รองรับ 2 รูปแบบ (เลือกจาก spec.layout)
 *   'stou' — มหาวิทยาลัยสุโขทัยธรรมาธิราช  (อ้างอิง COVER.doc / INTRO.doc / VITA.doc)
 *   'siu'  — มหาวิทยาลัยชินวัตร            (อ้างอิง เทมเพลตพิมพ์วิทยานิพนธ์-งานวิจัย.docx)
 */
var TFFront = (function () {
  'use strict';

  function P(type, text, extra) {
    return Object.assign({ type: type, text: text == null ? '' : text }, extra || {});
  }
  function blank(n) {
    var a = [];
    for (var i = 0; i < (n || 1); i++) a.push(P('blank', ''));
    return a;
  }
  function C(text, style) { return P('center', text, style ? { style: style } : undefined); }

  /** ย่อหน้าชิดซ้าย ไม่เยื้องบรรทัดแรก (ใช้กับตารางข้อมูลหัวเรื่อง) */
  function flat(text, opt) {
    opt = opt || {};
    return P('body', text, {
      style: Object.assign({ firstLine: 0, hanging: 0, indent: 0, align: 'left' }, opt.style || {}),
      tabs: opt.tabs
    });
  }

  function L(spec) { return TFTemplates.preset(spec.layout || 'stou'); }
  function contentWidth(spec) {
    return spec.page.width - spec.page.marginLeft - spec.page.marginRight;
  }

  /* ================================================================
   * ปกนอก / ปกใน
   * ================================================================ */
  function cover(m, spec, lang) {
    return (spec.layout === 'siu') ? coverSiu(m, spec, lang) : coverStou(m, spec, lang);
  }

  function coverStou(m, spec, lang) {
    var isEn = lang === 'en';
    var big = { size: 18, bold: true };
    var out = blank(6);

    out.push(C(isEn ? (m.titleEn || '') : (m.titleTh || ''), big));
    out = out.concat(blank(8));
    out.push(C(isEn ? (m.authorEn || '') : (m.authorTh || '')));
    out = out.concat(blank(8));

    if (isEn) {
      out.push(C('A Thesis Submitted in Partial Fulfillment of the Requirements'));
      out.push(C('for the Degree of ' + (m.degreeEn || '')));
      out.push(C('School of ' + (m.schoolEn || '') + '  ' + (m.universityEn || '')));
      out.push(C(m.yearEn || ''));
    } else {
      out.push(C('วิทยานิพนธ์นี้เป็นส่วนหนึ่งของการศึกษาตามหลักสูตรปริญญา' + (m.degreeTh || '')));
      out.push(C('แขนงวิชา' + (m.branchTh || '') + ' สาขาวิชา' + (m.fieldTh || '') + ' ' + (m.universityTh || '')));
      out.push(C('พ.ศ. ' + (m.yearTh || '')));
    }
    return out;
  }

  /** ชินวัตร: lang 'th' = ปกนอก, 'en' = ปกใน (ตามลำดับหน้าในเทมเพลต) */
  function coverSiu(m, spec, lang) {
    var inner = lang === 'en';
    var t20 = { size: 20, bold: true };
    var t18 = { size: 18, bold: true };
    var t16 = { size: 16, bold: true };

    var out = blank(6);
    out.push(C(m.titleTh || '', t20));
    if (m.titleEn) out.push(C('(' + m.titleEn + ')', t20));
    out = out.concat(blank(9));
    out.push(C(m.authorTh || '', t18));
    out = out.concat(blank(10));

    if (inner) {
      out.push(C('วิทยานิพนธ์นี้เป็นส่วนหนึ่งของการศึกษาตาม', t16));
      out.push(C('หลักสูตร' + (m.degreeTh || '') + (m.fieldTh ? ' สาขาวิชา' + m.fieldTh : ''), t16));
      out.push(C('คณะ' + (m.facultyTh || ''), t16));
      out.push(C(m.universityTh || '', t16));
      out = out.concat(blank(1));
      out.push(C('ปี พ.ศ. ' + (m.yearTh || ''), t16));
    } else {
      out.push(C('หลักสูตร' + (m.degreeTh || '') + (m.fieldTh ? ' สาขาวิชา' + m.fieldTh : ''), t16));
      out.push(C('คณะ' + (m.facultyTh || ''), t16));
      out.push(C(m.universityTh || '', t16));
      out = out.concat(blank(1));
      if (m.siuCode) out.push(C(m.siuCode, t18));
    }
    return out;
  }

  /* ================================================================
   * หน้าอนุมัติ
   * ================================================================ */
  function approval(m, spec) {
    return (spec.layout === 'siu') ? approvalSiu(m, spec) : approvalStou(m, spec);
  }

  function approvalStou(m, spec) {
    var labelTab = [{ pos: 108, type: 'left' }];
    var signTab = [{ pos: 126, type: 'left' }];
    var out = [];

    function row(label, value) {
      return flat(label + '\t' + (value || ''), { tabs: labelTab });
    }

    out.push(row('หัวข้อวิทยานิพนธ์', m.titleTh));
    out.push(row('ชื่อและนามสกุล', m.authorTh));
    out.push(row('แขนงวิชา', m.branchTh));
    out.push(row('สาขาวิชา', (m.fieldTh || '') + ' ' + (m.universityTh || '')));
    out.push(row('อาจารย์ที่ปรึกษา', '1. ' + (m.advisor1 || '')));
    if (m.advisor2) out.push(row('', '2. ' + m.advisor2));

    out = out.concat(blank(2));
    out.push(P('body', 'วิทยานิพนธ์นี้ ได้รับความเห็นชอบให้เป็นส่วนหนึ่งของการศึกษาตามหลักสูตรระดับ' +
      (m.degreeLevel || 'ปริญญาโท') + ' เมื่อวันที่ ' + (m.approvalDate || '')));
    out = out.concat(blank(2));
    out.push(flat('คณะกรรมการสอบวิทยานิพนธ์'));

    [
      { name: m.chair, role: 'ประธานกรรมการ' },
      { name: m.member1, role: 'กรรมการ' },
      { name: m.member2, role: 'กรรมการ' }
    ].filter(function (c) { return c.name; }).forEach(function (c) {
      out = out.concat(blank(2));
      out.push(flat('\t\t............................................ ' + c.role, { tabs: signTab }));
      out.push(flat('\t\t(' + c.name + ')', { tabs: signTab }));
    });

    if (m.gradChair) {
      out = out.concat(blank(3));
      out.push(flat('\t\t............................................ ประธานกรรมการบัณฑิตศึกษา', { tabs: signTab }));
      out.push(flat('\t\t(' + m.gradChair + ')', { tabs: signTab }));
    }
    return out;
  }

  function approvalSiu(m, spec) {
    var w = contentWidth(spec);
    var labelTab = [{ pos: 108, type: 'left' }];
    var signTab = [{ pos: 216, type: 'left' }];
    var work = m.workType || 'วิทยานิพนธ์';
    var out = [];

    function row(label, value, bold) {
      return flat(label + '\t' + (value || ''), {
        tabs: labelTab,
        style: bold ? { bold: true } : null
      });
    }

    out.push(row('ชื่อเรื่อง', m.titleTh, true));
    if (m.titleEn) out.push(row('', '(' + m.titleEn + ')'));
    out.push(row('ชื่อผู้เขียน', m.authorTh, true));
    out.push(row('หลักสูตร', (m.degreeTh || '') + (m.fieldTh ? ' สาขาวิชา' + m.fieldTh : ''), true));
    out.push(row('ชื่ออาจารย์ที่ปรึกษา', m.advisor1, true));

    out = out.concat(blank(1));
    out.push(P('body', work + 'นี้ได้รับการพิจารณาอนุมัติให้เป็นส่วนหนึ่งของการศึกษาตามหลักสูตร' +
      (m.degreeTh || '') + (m.fieldTh ? ' สาขาวิชา' + m.fieldTh : '') +
      ' คณะ' + (m.facultyTh || '') + ' ' + (m.universityTh || '')));
    out = out.concat(blank(2));

    out.push(C('.............................................................................'));
    out.push(flat('\t(' + (m.dean || '') + ')', { tabs: signTab }));
    out.push(flat('\tคณบดีคณะ' + (m.facultyTh || ''), { tabs: signTab }));
    out = out.concat(blank(2));

    out.push(flat('คณะกรรมการสอบ' + work, { style: { bold: true } }));

    [
      { name: m.advisor1, role: 'อาจารย์ที่ปรึกษา' },
      { name: m.advisor2, role: 'อาจารย์ที่ปรึกษาร่วม' },
      { name: m.member1, role: 'กรรมการ' },
      { name: m.member2, role: 'กรรมการภายนอก' }
    ].filter(function (c) { return c.name; }).forEach(function (c) {
      out = out.concat(blank(1));
      out.push(flat('\t............................................\t' + c.role, {
        tabs: [{ pos: 36, type: 'left' }, { pos: 288, type: 'left' }]
      }));
      out.push(flat('\t(' + c.name + ')', { tabs: [{ pos: 72, type: 'left' }] }));
    });

    out = out.concat(blank(2));
    out.push(flat('\t' + (m.examDate || ''), { tabs: [{ pos: w, type: 'right' }] }));
    return out;
  }

  /* ================================================================
   * บทคัดย่อ / Abstract
   * ================================================================ */
  function abstractTh(m, spec, bodyText) {
    var tabs = [{ pos: 108, type: 'left' }];
    var out = [];

    if (spec.layout === 'siu') {
      out.push(P('chapterTitle', 'บทคัดย่อ'));
      out = out.concat(blank(1));
      out.push(flat('ชื่อเรื่อง\t' + (m.titleTh || ''), { tabs: tabs, style: { bold: true } }));
      out.push(flat('ชื่อผู้เขียน\t' + (m.authorTh || ''), { tabs: tabs, style: { bold: true } }));
      out.push(flat('หลักสูตร\t' + (m.degreeTh || '') + (m.fieldTh ? ' สาขาวิชา' + m.fieldTh : ''), { tabs: tabs, style: { bold: true } }));
      out.push(flat('ปี\t' + (m.yearTh || ''), { tabs: tabs, style: { bold: true } }));
      out = out.concat(blank(1));
      out = out.concat(bodyBlocks(bodyText));
      if (m.keywordsTh) {
        out = out.concat(blank(1));
        out.push(flat('คำสำคัญ\t' + m.keywordsTh, { tabs: tabs, style: { bold: true } }));
      }
      return out;
    }

    out.push(flat('ชื่อวิทยานิพนธ์\t' + (m.titleTh || ''), { tabs: tabs }));
    out.push(flat('ผู้วิจัย ' + (m.authorTh || '') +
      '  รหัสนักศึกษา ' + (m.studentId || '') +
      '  ปริญญา ' + (m.degreeTh || '') +
      '  อาจารย์ที่ปรึกษา (1) ' + (m.advisor1 || '') +
      (m.advisor2 ? ' (2) ' + m.advisor2 : '') +
      '  ปีการศึกษา ' + (m.yearTh || '')));
    out.push(flat('_______________________________________________________________________'));
    out = out.concat(blank(1));
    out.push(P('chapterTitle', 'บทคัดย่อ', { style: { size: 18 } }));
    out = out.concat(blank(1));
    out = out.concat(bodyBlocks(bodyText));
    if (m.keywordsTh) {
      out = out.concat(blank(1));
      out.push(flat('คำสำคัญ  ' + m.keywordsTh));
    }
    return out;
  }

  function abstractEn(m, spec, bodyText) {
    var tabs = [{ pos: 108, type: 'left' }];
    var out = [];

    if (spec.layout === 'siu') {
      out.push(P('chapterTitle', 'Abstract'));
      out = out.concat(blank(1));
      out.push(flat('Title\t' + (m.titleEn || ''), { tabs: tabs, style: { bold: true } }));
      out.push(flat('Author\t' + (m.authorEn || ''), { tabs: tabs, style: { bold: true } }));
      out.push(flat('Program\t' + (m.degreeEn || ''), { tabs: tabs, style: { bold: true } }));
      out.push(flat('Year\t' + (m.yearEn || ''), { tabs: tabs, style: { bold: true } }));
      out = out.concat(blank(1));
      out = out.concat(bodyBlocks(bodyText, 'left'));
      if (m.keywordsEn) {
        out = out.concat(blank(1));
        out.push(flat('Keywords\t' + m.keywordsEn, { tabs: tabs, style: { bold: true } }));
      }
      return out;
    }

    out.push(flat('Thesis title:\t' + (m.titleEn || ''), { tabs: tabs }));
    out.push(flat('Researcher: ' + (m.authorEn || '') +
      '; ID: ' + (m.studentId || '') +
      '; Degree: ' + (m.degreeEn || '') +
      '; Thesis advisors: (1) ' + (m.advisor1En || '') +
      (m.advisor2En ? '; (2) ' + m.advisor2En : '') +
      '; Academic year: ' + (m.yearEn || '')));
    out.push(flat('_______________________________________________________________________'));
    out = out.concat(blank(1));
    out.push(P('chapterTitle', 'Abstract', { style: { size: 18 } }));
    out = out.concat(blank(1));
    out = out.concat(bodyBlocks(bodyText, 'left'));
    if (m.keywordsEn) {
      out = out.concat(blank(1));
      out.push(flat('Keywords: ' + m.keywordsEn));
    }
    return out;
  }

  function bodyBlocks(text, align) {
    if (!text) return [];
    return TFParser.normalize(text)
      .split(/\n+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s; })
      .map(function (s) { return P('body', s, align ? { style: { align: align } } : undefined); });
  }

  /* ================================================================
   * กิตติกรรมประกาศ
   * ================================================================ */
  function acknowledgement(text, m, spec) {
    var out = [P('chapterTitle', 'กิตติกรรมประกาศ')];
    out = out.concat(blank(1));
    out = out.concat(bodyBlocks(text));
    out = out.concat(blank(2));
    if (m.authorTh) {
      out.push(flat(m.authorTh, { style: { align: 'right' } }));
      if (m.yearTh) out.push(flat('พ.ศ. ' + m.yearTh, { style: { align: 'right' } }));
    }
    return out;
  }

  /* ================================================================
   * สารบัญ
   * ================================================================ */

  /**
   * @param {Array}  entries  [{level, text, page, chapterLabel}]
   * @param {Object} opt      { useField, frontEntries }
   */
  function toc(entries, spec, opt) {
    opt = opt || {};
    var w = contentWidth(spec);
    var out = [P('chapterTitle', opt.title || 'สารบัญ')];
    out = out.concat(blank(1));
    out.push(flat('\tหน้า', {
      style: { bold: true },
      tabs: [{ pos: w, type: 'right' }]
    }));

    if (opt.useField) {
      out.push(P('body', 'คลิกขวาที่สารบัญนี้ใน Word แล้วเลือก Update Field (หรือกด F9) เพื่อดึงเลขหน้าจริง', {
        field: 'TOC \\o "1-3" \\h \\z \\u',
        style: { firstLine: 0, hanging: 0, indent: 0, align: 'left' }
      }));
      return out;
    }

    var rightTab = { pos: w, type: 'right', leader: 'dot' };

    // รายการส่วนหน้า (กิตติกรรมประกาศ / บทคัดย่อ / Abstract ...)
    (opt.frontEntries || []).forEach(function (e) {
      out.push(flat(e.text + '\t' + (e.page || ''), { tabs: [rightTab] }));
    });

    entries.forEach(function (e) {
      if (e.level === 0 && e.chapterLabel) {
        out.push(flat(e.chapterLabel + '\t' + e.text + '\t' + (e.page || ''), {
          style: { bold: true },
          tabs: [{ pos: 54, type: 'left' }, rightTab]
        }));
      } else if (e.level === 0) {
        out.push(flat(e.text + '\t' + (e.page || ''), {
          style: { bold: true },
          tabs: [rightTab]
        }));
      } else {
        var lead = e.level === 1 ? '\t' : '\t\t';
        out.push(flat(lead + e.text + '\t' + (e.page || ''), {
          tabs: [{ pos: 36, type: 'left' }, { pos: 72, type: 'left' }, rightTab]
        }));
      }
    });

    return out;
  }

  /** สารบัญตาราง / สารบัญภาพ (ภาพประกอบ) */
  function listOf(kind, items, spec) {
    var w = contentWidth(spec);
    var pre = L(spec);
    var isTable = kind === 'table';
    var title = isTable ? 'สารบัญตาราง' : pre.figureListTitle;
    var prefix = isTable ? 'ตารางที่ ' : pre.figurePrefix;
    var head = isTable ? 'ชื่อตาราง' : (pre.figureListTitle === 'สารบัญภาพประกอบ' ? 'ชื่อภาพประกอบ' : 'ชื่อภาพ');

    var out = [P('chapterTitle', title)];
    out = out.concat(blank(1));
    out.push(flat(head + '\tหน้า', { style: { bold: true }, tabs: [{ pos: w, type: 'right' }] }));

    items.forEach(function (it) {
      out.push(flat(prefix + (it.no || '') + '  ' + (it.text || '') + '\t' + (it.page || ''), {
        tabs: [{ pos: w, type: 'right', leader: 'dot' }]
      }));
    });
    return out;
  }

  /* ================================================================
   * ประวัติผู้เขียน
   * ================================================================ */
  function vita(v, spec) {
    var pre = L(spec);
    var lw = pre.vitaLabelWidth || 126;
    var out = [P('chapterTitle', pre.vitaTitle)];
    out = out.concat(blank(2));

    var tabs = [{ pos: lw, type: 'left' }];
    pre.vitaFields.forEach(function (f) {
      var lines = String(v[f.key] || '').split('\n');
      out.push(flat(f.label + '\t' + (lines[0] || ''), {
        tabs: tabs,
        style: { indent: lw, hanging: lw }
      }));
      lines.slice(1).forEach(function (ln) {
        if (!ln.trim()) return;
        out.push(flat('\t' + ln.trim(), { tabs: tabs, style: { indent: lw, hanging: lw } }));
      });
    });
    return out;
  }

  return {
    cover: cover,
    approval: approval,
    abstractTh: abstractTh,
    abstractEn: abstractEn,
    acknowledgement: acknowledgement,
    toc: toc,
    listOf: listOf,
    vita: vita,
    blank: blank,
    P: P
  };
})();
