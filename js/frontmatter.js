/*!
 * frontmatter.js — สร้างส่วนหน้าของรายงานโครงงาน
 *   ปก · หน้ารับรอง · บทคัดย่อ · Abstract · กิตติกรรมประกาศ
 *   สารบัญ · สารบัญตาราง · สารบัญภาพ · ประวัติผู้จัดทำ
 *
 * โครงหน้าเป็นแบบเดียวกันทุกชุดรูปแบบ (บริบทโรงเรียน)
 * ต่างกันเฉพาะตัวอักษร ขนาด ระยะขอบ และเลขหน้า ซึ่งมาจาก spec
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

  function L(spec) { return TFTemplates.preset(spec.layout || 'angsana'); }
  function contentWidth(spec) {
    return spec.page.width - spec.page.marginLeft - spec.page.marginRight;
  }

  /** แยกชื่อผู้จัดทำหลายคน (บรรทัดละคน) — คงเครื่องหมายคั่นคอลัมน์ไว้ */
  function nameList(s) {
    return String(s || '').split('\n')
      .map(function (x) { return x.trim(); })
      .filter(Boolean);
  }

  /**
   * ชื่อผู้จัดทำแบบข้อความธรรมดา
   *
   * บนหน้าปกใช้ | คั่นคอลัมน์เพื่อจัดชื่อ-นามสกุล-เลขที่ให้ตรงกัน
   * แต่หน้าอื่น (หน้ารับรอง บทคัดย่อ) เขียนต่อกันเป็นบรรทัดเดียว จึงต้องตัดเครื่องหมายออก
   */
  function plainNames(s) {
    return nameList(s).map(function (n) {
      return n.replace(/\s*\|\s*/g, '  ').trim();
    });
  }

  /** ประกอบข้อความ "รายวิชา ... กลุ่มสาระ ..." โดยข้ามช่องที่ว่าง */
  function joinParts(parts) {
    return parts.filter(function (p) { return p && p.trim(); }).join(' ');
  }

  /* ================================================================
   * ปก
   * ================================================================ */

  /**
   * แถวรายชื่อผู้จัดทำแบบจัดคอลัมน์
   *
   * ผู้ใช้พิมพ์บรรทัดละคน คั่นคอลัมน์ด้วย | หรือแท็บ เช่น
   *   เด็กหญิงสมหญิง | ใจดี | เลขที่ 12
   * ถ้าไม่ได้คั่นคอลัมน์ ก็จัดกึ่งกลางตามปกติ
   *
   * ความกว้างคอลัมน์คิดจากข้อความที่ยาวที่สุดของแต่ละคอลัมน์
   * แล้วเยื้องทั้งก้อนให้อยู่กึ่งกลางหน้ากระดาษ เหมือนแบบฟอร์มปกทั่วไป
   */
  function authorRows(names, spec, style) {
    var rows = names.map(function (n) {
      return n.split(/\s*\|\s*|\t/).map(function (c) { return c.trim(); });
    });
    var cols = rows.reduce(function (mx, r) { return Math.max(mx, r.length); }, 1);
    if (cols < 2) return names.map(function (n) { return C(n, style); });

    // ความกว้างโดยประมาณ: อักษรไทย/ละตินกว้างราวครึ่งหนึ่งของขนาดตัวอักษร
    var size = (style && style.size) || spec.styles.body.size;
    var width = [];
    for (var i = 0; i < cols; i++) {
      var longest = rows.reduce(function (mx, r) {
        return Math.max(mx, (r[i] || '').length);
      }, 0);
      width.push(longest * size * 0.5 + 18);
    }
    var total = width.reduce(function (a, b) { return a + b; }, 0);
    var left = Math.max(0, (contentWidth(spec) - total) / 2);

    var tabs = [], at = left;
    for (var k = 0; k < cols - 1; k++) {
      at += width[k];
      tabs.push({ pos: at, type: 'left' });
    }

    return rows.map(function (r) {
      var line = [];
      for (var j = 0; j < cols; j++) line.push(r[j] || '');
      return flat(line.join('\t'), {
        tabs: tabs,
        style: Object.assign({ indent: left }, style || {})
      });
    });
  }

  /**
   * เกลี่ยบรรทัดว่างระหว่างกลุ่มให้ปกเต็มหน้าพอดีเสมอ
   *
   * ถ้ากำหนดจำนวนบรรทัดว่างตายตัว ปกจะล้นไปหน้าที่สองทันทีที่ชื่อโครงงานยาว
   * หรือมีผู้จัดทำหลายคน จึงคำนวณที่ว่างที่เหลือแล้วแบ่งให้ช่องไฟทั้งสี่เท่า ๆ กัน
   */
  function spreadGroups(groups, spec) {
    var lineOf = function (b) {
      var size = (b.style && b.style.size) ||
                 (spec.styles[b.type] && spec.styles[b.type].size) ||
                 spec.styles.body.size;
      return size * 1.45;
    };
    var used = 0;
    groups.forEach(function (g) {
      g.forEach(function (b) { used += lineOf(b); });
    });

    var pageHeight = spec.page.height - spec.page.marginTop - spec.page.marginBottom;
    var blankHeight = spec.styles.body.size * 1.45;
    var gaps = groups.length;                      // ช่องไฟบน + ระหว่างกลุ่ม
    var free = Math.floor((pageHeight - used) / blankHeight) - 1;
    var each = Math.max(1, Math.floor(free / gaps));

    var out = [];
    groups.forEach(function (g) {
      if (!g.length) return;
      out = out.concat(blank(each), g);
    });
    return out;
  }

  function cover(m, spec, lang) {
    var isEn = lang === 'en';
    var titleStyle = { size: spec.styles.chapterTitle.size, bold: true };
    var nameStyle = { size: spec.styles.h1.size, bold: false };

    // ---- ชื่อโครงงาน (ไทย แล้วตามด้วยอังกฤษ) ----
    var titleG = [];
    String(m.titleTh || '').split('\n').filter(Boolean).forEach(function (line) {
      titleG.push(C(line.trim(), titleStyle));
    });
    if (m.titleEn) titleG.push(C(m.titleEn.trim(), titleStyle));
    if (m.projectCode) titleG.push(C('(' + m.projectCode.trim() + ')'));

    // ---- ผู้จัดทำ ----
    var names = nameList(isEn && m.authorsEn ? m.authorsEn : m.authorsTh);
    if (!names.length) names = [''];
    var byG = [C(isEn ? 'By' : 'โดย')].concat(blank(1), authorRows(names, spec, nameStyle));

    // ---- ครูที่ปรึกษา ----
    var teachers = [m.teacher1, m.teacher2].filter(function (t) { return t && t.trim(); });
    var advG = [];
    if (teachers.length) {
      advG.push(C(isEn ? 'Advisor' : 'ครูที่ปรึกษา'));
      teachers.forEach(function (t) { advG.push(C(t.trim())); });
    }

    // ---- ข้อความท้ายปก ----
    var footG = [];
    if (isEn) {
      footG.push(C(joinParts(['This report is part of the course', m.subjectEn])));
      if (m.gradeLevelEn) footG.push(C(m.gradeLevelEn));
      if (m.schoolEn) footG.push(C(m.schoolEn));
      footG.push(C(joinParts(['Academic Year', m.yearEn])));
    } else {
      footG.push(C(joinParts(['รายงานฉบับนี้เป็นส่วนหนึ่งของรายวิชา', m.subjectTh])));
      if (m.learningArea) footG.push(C('กลุ่มสาระการเรียนรู้' + m.learningArea));
      footG.push(C(joinParts([
        m.gradeLevel ? 'ระดับชั้น' + m.gradeLevel : '',
        m.schoolTh || ''
      ])));
      footG.push(C(joinParts([
        m.termTh ? 'ภาคเรียนที่ ' + m.termTh : '',
        m.yearTh ? 'ปีการศึกษา ' + m.yearTh : ''
      ])));
    }
    footG = footG.filter(function (b) { return b.text !== ''; });

    return spreadGroups([titleG, byG, advG, footG], spec);
  }

  /* ================================================================
   * หน้ารับรอง / หน้าอนุมัติ
   * ================================================================ */
  function approval(m, spec) {
    var labelTab = [{ pos: 108, type: 'left' }];
    var signTab = [{ pos: 126, type: 'left' }];
    var out = [];

    out.push(P('chapterTitle', 'หน้ารับรองโครงงาน'));
    out = out.concat(blank(1));

    function row(label, value) {
      return flat(label + '\t' + (value || ''), { tabs: labelTab });
    }

    out.push(row('ชื่อโครงงาน', String(m.titleTh || '').split('\n')[0]));

    var names = plainNames(m.authorsTh);
    names.forEach(function (n, i) {
      out.push(row(i === 0 ? 'ผู้จัดทำ' : '', (names.length > 1 ? (i + 1) + '. ' : '') + n));
    });

    out.push(row('ระดับชั้น', m.gradeLevel));
    out.push(row('รายวิชา', joinParts([m.subjectTh,
      m.learningArea ? 'กลุ่มสาระการเรียนรู้' + m.learningArea : ''])));
    out.push(row('ครูที่ปรึกษา', m.teacher1));
    if (m.teacher2) out.push(row('', m.teacher2));
    out.push(row('ปีการศึกษา', m.yearTh));

    out = out.concat(blank(2));
    out.push(P('body', 'โครงงานฉบับนี้ได้รับการตรวจและอนุมัติให้เป็นส่วนหนึ่งของการศึกษา รายวิชา' +
      (m.subjectTh || '') + ' ' + (m.schoolTh || '') +
      (m.approvalDate ? ' เมื่อวันที่ ' + m.approvalDate : '')));
    out = out.concat(blank(2));

    [
      { name: m.teacher1, role: 'ครูที่ปรึกษาโครงงาน' },
      { name: m.teacher2, role: 'ครูที่ปรึกษาร่วม' },
      { name: m.headOfArea, role: 'หัวหน้ากลุ่มสาระการเรียนรู้' },
      { name: m.director, role: 'ผู้อำนวยการโรงเรียน' }
    ].filter(function (c) { return c.name; }).forEach(function (c) {
      out = out.concat(blank(2));
      out.push(flat('\t\t............................................', { tabs: signTab }));
      out.push(flat('\t\t(' + c.name + ')', { tabs: signTab }));
      out.push(flat('\t\t' + c.role, { tabs: signTab }));
    });

    return out;
  }

  /* ================================================================
   * บทคัดย่อ / Abstract
   * ================================================================ */
  function abstractTh(m, spec, bodyText) {
    var tabs = [{ pos: 108, type: 'left' }];
    var out = [P('chapterTitle', 'บทคัดย่อ')];
    out = out.concat(blank(1));

    function row(label, value) {
      return flat(label + '\t' + (value || ''), { tabs: tabs, style: { bold: true } });
    }

    out.push(row('ชื่อโครงงาน', String(m.titleTh || '').split('\n')[0]));
    var names = plainNames(m.authorsTh);
    names.forEach(function (n, i) {
      out.push(row(i === 0 ? 'ผู้จัดทำ' : '', (names.length > 1 ? (i + 1) + '. ' : '') + n));
    });
    out.push(row('ครูที่ปรึกษา', m.teacher1));
    out.push(row('ระดับชั้น', m.gradeLevel));
    out.push(row('ปีการศึกษา', m.yearTh));

    out = out.concat(blank(1));
    out = out.concat(bodyBlocks(bodyText));
    if (m.keywordsTh) {
      out = out.concat(blank(1));
      out.push(row('คำสำคัญ', m.keywordsTh));
    }
    return out;
  }

  function abstractEn(m, spec, bodyText) {
    var tabs = [{ pos: 108, type: 'left' }];
    var out = [P('chapterTitle', 'Abstract')];
    out = out.concat(blank(1));

    function row(label, value) {
      return flat(label + '\t' + (value || ''), { tabs: tabs, style: { bold: true } });
    }

    out.push(row('Project title', m.titleEn));
    var names = plainNames(m.authorsEn);
    names.forEach(function (n, i) {
      out.push(row(i === 0 ? 'By' : '', n));
    });
    out.push(row('Advisor', m.teacher1En || m.teacher1));
    out.push(row('Level', m.gradeLevelEn || m.gradeLevel));
    out.push(row('Academic year', m.yearEn));

    out = out.concat(blank(1));
    out = out.concat(bodyBlocks(bodyText, 'left'));
    if (m.keywordsEn) {
      out = out.concat(blank(1));
      out.push(row('Keywords', m.keywordsEn));
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

    var names = plainNames(m.authorsTh);
    if (names.length) {
      names.forEach(function (n) {
        out.push(flat(n, { style: { align: 'right' } }));
      });
      if (m.yearTh) out.push(flat('ปีการศึกษา ' + m.yearTh, { style: { align: 'right' } }));
    }
    return out;
  }

  /* ================================================================
   * สารบัญ
   * ================================================================ */

  /**
   * @param {Array}  entries  [{level, text, page, chapterLabel}]
   * @param {Object} opt      { useField, frontEntries, title }
   */
  function toc(entries, spec, opt) {
    opt = opt || {};
    var w = contentWidth(spec);
    var out = [P('chapterTitle', opt.title || 'สารบัญ')];
    out = out.concat(blank(1));
    out.push(flat('\tหน้า', { style: { bold: true }, tabs: [{ pos: w, type: 'right' }] }));

    if (opt.useField) {
      out.push(P('body', 'คลิกขวาที่สารบัญนี้ใน Word แล้วเลือก Update Field (หรือกด F9) เพื่อดึงเลขหน้าจริง', {
        field: 'TOC \\o "1-3" \\h \\z \\u',
        style: { firstLine: 0, hanging: 0, indent: 0, align: 'left' }
      }));
      return out;
    }

    var rightTab = { pos: w, type: 'right', leader: 'dot' };

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
        out.push(flat(e.text + '\t' + (e.page || ''), { style: { bold: true }, tabs: [rightTab] }));
      } else {
        var lead = e.level === 1 ? '\t' : '\t\t';
        out.push(flat(lead + e.text + '\t' + (e.page || ''), {
          tabs: [{ pos: 36, type: 'left' }, { pos: 72, type: 'left' }, rightTab]
        }));
      }
    });

    return out;
  }

  /** สารบัญตาราง / สารบัญภาพ */
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
   * ประวัติผู้จัดทำ
   * ================================================================ */

  /**
   * @param {Array|Object} v  ข้อมูลผู้จัดทำ 1 คน หรือหลายคน
   */
  function vita(v, spec) {
    var pre = L(spec);
    var lw = pre.vitaLabelWidth || 126;
    var people = Array.isArray(v) ? v : [v];
    people = people.filter(function (p) {
      return p && Object.keys(p).some(function (k) { return String(p[k] || '').trim(); });
    });
    if (!people.length) people = [{}];

    var out = [P('chapterTitle', pre.vitaTitle)];
    out = out.concat(blank(2));

    var tabs = [{ pos: lw, type: 'left' }];
    people.forEach(function (person, idx) {
      if (idx > 0) out = out.concat(blank(2));
      if (people.length > 1) {
        out.push(flat('คนที่ ' + (idx + 1), { style: { bold: true } }));
      }
      pre.vitaFields.forEach(function (f) {
        var lines = String(person[f.key] || '').split('\n');
        out.push(flat(f.label + '\t' + (lines[0] || ''), {
          tabs: tabs, style: { indent: lw, hanging: lw }
        }));
        lines.slice(1).forEach(function (ln) {
          if (!ln.trim()) return;
          out.push(flat('\t' + ln.trim(), { tabs: tabs, style: { indent: lw, hanging: lw } }));
        });
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
