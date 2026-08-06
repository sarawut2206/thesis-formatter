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

  /** แยกชื่อผู้จัดทำหลายคน (บรรทัดละคน) */
  function nameList(s) {
    return String(s || '').split('\n')
      .map(function (x) { return x.trim(); })
      .filter(Boolean);
  }

  /** ประกอบข้อความ "รายวิชา ... กลุ่มสาระ ..." โดยข้ามช่องที่ว่าง */
  function joinParts(parts) {
    return parts.filter(function (p) { return p && p.trim(); }).join(' ');
  }

  /* ================================================================
   * ปก
   * ================================================================ */
  function cover(m, spec, lang) {
    var isEn = lang === 'en';
    var titleStyle = { size: spec.styles.chapterTitle.size, bold: true };
    var nameStyle = { size: spec.styles.h1.size, bold: true };

    var out = blank(5);

    // ชื่อโครงงาน
    (isEn ? [m.titleEn] : String(m.titleTh || '').split('\n'))
      .filter(Boolean)
      .forEach(function (line) { out.push(C(line.trim(), titleStyle)); });

    out = out.concat(blank(6));
    out.push(C(isEn ? 'by' : 'โดย'));
    out = out.concat(blank(1));

    // ผู้จัดทำ (รองรับหลายคน)
    var names = nameList(isEn ? m.authorsEn : m.authorsTh);
    if (!names.length) names = [''];
    names.forEach(function (n) { out.push(C(n, nameStyle)); });

    out = out.concat(blank(6));

    if (isEn) {
      out.push(C('A Project Report Submitted in Partial Fulfillment'));
      out.push(C(joinParts(['of the Course', m.subjectEn])));
      out.push(C(m.schoolEn || ''));
      out.push(C(joinParts(['Academic Year', m.yearEn])));
    } else {
      out.push(C('โครงงานนี้เป็นส่วนหนึ่งของการศึกษา'));
      out.push(C(joinParts(['รายวิชา' + (m.subjectTh || ''),
                            m.learningArea ? 'กลุ่มสาระการเรียนรู้' + m.learningArea : ''])));
      out.push(C(joinParts(['ระดับชั้น' + (m.gradeLevel || '')])));
      out.push(C(m.schoolTh || ''));
      out.push(C(joinParts(['ปีการศึกษา', m.yearTh])));
    }
    return out;
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

    var names = nameList(m.authorsTh);
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
    var names = nameList(m.authorsTh);
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
    var names = nameList(m.authorsEn);
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

    var names = nameList(m.authorsTh);
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
