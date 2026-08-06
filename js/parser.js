/*!
 * parser.js — แปลงข้อความดิบที่นักเรียนวาง ให้กลายเป็นโครงสร้างย่อหน้า (blocks)
 *
 * ผลลัพธ์ = [{ type, text }]
 *   type: chapterNum | chapterTitle | h1 | h2 | h3 | h4 | body | list | quote |
 *         caption | bib | center | blank
 */
var TFParser = (function () {
  'use strict';

  var THAI_DIGITS = '\u0E50\u0E51\u0E52\u0E53\u0E54\u0E55\u0E56\u0E57\u0E58\u0E59';
  var TH = '\\u0E00-\\u0E7F';                       // ช่วงอักขระไทย
  var RE_THAI_END = new RegExp('[' + TH + ']$');
  var RE_THAI_START = new RegExp('^[' + TH + ']');
  var RE_THAI_LEAD = new RegExp('^["\'\u201C\u2018(\\[]*[' + TH + ']');

  function thaiToArabic(s) {
    return String(s).replace(/[\u0E50-\u0E59]/g, function (c) {
      return String(THAI_DIGITS.indexOf(c));
    });
  }

  /** ทำความสะอาดข้อความ: อักขระซ่อน ช่องว่างแปลก ๆ บรรทัดใหม่ */
  function normalize(text) {
    return String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[\u2028\u2029]/g, '\n')                    // line/paragraph separator
      .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // ช่องว่างพิเศษ -> ช่องว่างปกติ
      .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')         // อักขระความกว้างศูนย์
      .replace(/[ \t]+$/gm, '');                           // ช่องว่างท้ายบรรทัด
  }

  /** นับระดับการเยื้องจากช่องว่าง/แท็บหน้าบรรทัด */
  function indentLevel(line) {
    var m = line.match(/^[\t ]+/);
    if (!m) return 0;
    var s = m[0];
    var tabs = (s.match(/\t/g) || []).length;
    var spaces = s.replace(/\t/g, '').length;
    return tabs + Math.floor(spaces / 4);
  }

  /** ตัดช่องว่างหน้า-หลัง และยุบช่องว่างซ้ำ */
  function tidy(line) {
    return String(line).replace(/^[\t ]+/, '').replace(/[ \t]{2,}/g, ' ').trim();
  }

  /** คีย์สำหรับเทียบหัวข้อมาตรฐาน (ตัดเลขนำหน้า/ช่องว่าง/เครื่องหมายท้ายออก) */
  function headingKey(s) {
    return String(s)
      .replace(/^[\d\u0E50-\u0E59]+(\.[\d\u0E50-\u0E59]+)*[.)\s]*/, '')
      .replace(/[\s:\uFF1A.\uFF0E]+$/, '')
      .replace(/\s+/g, '')
      .trim();
  }

  function matchesKnownHeading(line, knownList) {
    if (!knownList || !knownList.length) return false;
    var k = headingKey(line);
    if (!k) return false;
    for (var i = 0; i < knownList.length; i++) {
      var kk = headingKey(knownList[i]);
      if (!kk) continue;
      if (k === kk) return true;
      // เช่น "ตอนที่1ผลการวิเคราะห์..." ขึ้นต้นด้วย "ตอนที่1"
      if (kk.length >= 4 && k.indexOf(kk) === 0) return true;
    }
    return false;
  }

  var RE = {
    chapterNum:   /^บทที่\s*[\d\u0E50-\u0E59IVXivx]+\s*$/,
    chapterNumIn: /^บทที่\s*([\d\u0E50-\u0E59IVXivx]+)\s*(.*)$/,
    caption:      /^(ตารางที่|ภาพที่|ภาพประกอบที่|แผนภูมิที่|แผนภาพที่|รูปที่|Table|Figure)\s*[\d\u0E50-\u0E59]+(\.[\d\u0E50-\u0E59]+)*/,
    num4:         /^[\d\u0E50-\u0E59]+\.[\d\u0E50-\u0E59]+\.[\d\u0E50-\u0E59]+\.[\d\u0E50-\u0E59]+[.)]?\s+\S/,
    num3:         /^[\d\u0E50-\u0E59]+\.[\d\u0E50-\u0E59]+\.[\d\u0E50-\u0E59]+[.)]?\s+\S/,
    num2:         /^[\d\u0E50-\u0E59]+\.[\d\u0E50-\u0E59]+[.)]?\s+\S/,
    num1:         /^([\d\u0E50-\u0E59]+)[.)]\s+(.*)$/,
    thaiLetter:   /^[\u0E01-\u0E2E][.)]\s+\S/,
    bullet:       /^[-\u2013\u2014\u2022*\u25AA]\s+\S/,
    paren:        /^\([\d\u0E50-\u0E59\u0E01-\u0E2Ea-zA-Z]+\)\s+\S/,
    centerWord:   /^(บรรณานุกรม|เอกสารอ้างอิง|ภาคผนวก(\s*[\u0E01-\u0E2E])?|ประวัติผู้จัดทำ|ประวัติผู้วิจัย|ประวัติผู้เขียน|กิตติกรรมประกาศ|บทคัดย่อ|Abstract|สารบัญ(\s*\(ต่อ\))?|สารบัญตาราง|สารบัญภาพ(ประกอบ)?|References|Bibliography|Appendix(\s*[A-Z])?)\s*$/
  };

  /** บรรทัดนี้ดูเหมือน "ประโยค" (จึงไม่น่าจะเป็นหัวข้อ) หรือไม่ */
  function looksLikeSentence(s) {
    if (/[.!?\u3002]$/.test(s)) return true;
    if (s.length > 90) return true;
    return false;
  }

  /** บรรทัดนี้เป็นจุดเริ่มโครงสร้างใหม่ (ห้ามนำไปต่อท้ายบรรทัดก่อนหน้า) */
  function isStructuralStart(line) {
    var t = tidy(line);
    if (!t) return true;
    if (/^#{1,4}\s/.test(t)) return true;
    if (/^>\s/.test(t)) return true;
    if (RE.chapterNum.test(t)) return true;
    if (RE.caption.test(t)) return true;
    if (RE.num1.test(t) || RE.num2.test(t) || RE.num3.test(t) || RE.num4.test(t)) return true;
    if (RE.bullet.test(t) || RE.paren.test(t) || RE.thaiLetter.test(t)) return true;
    if (RE.centerWord.test(t)) return true;
    if (isPipeRow(t) || isTableDivider(t)) return true;   // แถวของตาราง ห้ามรวมกับบรรทัดอื่น
    if (tabCount(line) >= 1) return true;
    return false;
  }

  /**
   * รวมบรรทัดที่ถูกตัดกลางประโยค (ปัญหาคลาสสิกเวลาคัดลอกมาจาก PDF)
   * mode: 'auto' | 'always' | 'never'
   */
  function joinWrapped(lines, mode) {
    if (mode === 'never') return lines;
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var cur = lines[i];
      if (cur.trim() === '') { out.push(cur); continue; }
      if (out.length === 0) { out.push(cur); continue; }

      var prev = out[out.length - 1];
      if (prev.trim() === '') { out.push(cur); continue; }

      var canJoin;
      if (mode === 'always') {
        canJoin = !isStructuralStart(cur) && !isStructuralStart(prev);
      } else {
        canJoin = prev.trim().length >= 60 &&
                  !isStructuralStart(cur) &&
                  !/[.!?:]$/.test(prev.trim());
      }

      if (canJoin) {
        var a = prev.trim(), b = cur.trim();
        // ภาษาไทยต่อกันไม่ต้องเว้นวรรค
        var glue = (RE_THAI_END.test(a) && RE_THAI_START.test(b)) ? '' : ' ';
        out[out.length - 1] = a + glue + b;
      } else {
        out.push(cur);
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------
   * ตาราง
   * รองรับ 2 รูปแบบที่นักเรียนคัดลอกมาบ่อยที่สุด
   *   1) ขีดตั้ง (markdown)  | ลำดับ | รายการ | จำนวน |
   *   2) แท็บคั่น (คัดลอกจาก Word/Excel)   ลำดับ⇥รายการ⇥จำนวน
   * ------------------------------------------------------------------ */

  /** บรรทัดคั่นหัวตารางแบบ markdown เช่น |---|:--:|---| */
  function isTableDivider(line) {
    var t = tidy(line);
    return /^\|?[\s:|-]*-[\s:|-]*\|?$/.test(t) && t.indexOf('-') >= 0 && t.indexOf('|') >= 0;
  }

  function isPipeRow(line) {
    var t = tidy(line);
    if (t.indexOf('|') < 0) return false;
    // ต้องมีอย่างน้อย 2 ช่อง และไม่ใช่ประโยคที่บังเอิญมีขีดตั้งอันเดียว
    return (t.match(/\|/g) || []).length >= 2 || /^\|.*\|$/.test(t);
  }

  function splitPipeRow(line) {
    var t = tidy(line).replace(/^\|/, '').replace(/\|$/, '');
    return t.split('|').map(function (c) { return c.trim(); });
  }

  function tabCount(line) { return (String(line).match(/\t/g) || []).length; }

  /** ทำให้ทุกแถวมีจำนวนช่องเท่ากัน */
  function normalizeRows(rows) {
    var cols = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    return rows.map(function (r) {
      var out = r.slice();
      while (out.length < cols) out.push('');
      return out.slice(0, cols);
    });
  }

  /**
   * พยายามอ่านตารางที่เริ่มต้นบรรทัด i
   * @returns {null|{block, next}}
   */
  function readTable(lines, i) {
    var first = tidy(lines[i]);
    if (!first) return null;

    // ---- แบบขีดตั้ง ----
    if (isPipeRow(first)) {
      var rows = [];
      var hasHeader = false;
      var j = i;
      while (j < lines.length) {
        var t = tidy(lines[j]);
        if (t === '') break;
        if (isTableDivider(t)) {
          if (rows.length === 1) hasHeader = true;
          j++;
          continue;
        }
        if (!isPipeRow(t)) break;
        rows.push(splitPipeRow(t));
        j++;
      }
      if (rows.length >= 2 || (rows.length === 1 && hasHeader)) {
        return {
          block: { type: 'table', rows: normalizeRows(rows), header: hasHeader || rows.length > 1 },
          next: j
        };
      }
      return null;
    }

    // ---- แบบแท็บคั่น ----
    var n = tabCount(lines[i]);
    if (n >= 1 && !/^[\t ]/.test(lines[i])) {
      var rows2 = [];
      var k = i;
      while (k < lines.length && tidy(lines[k]) !== '' && tabCount(lines[k]) === n) {
        rows2.push(tidy(lines[k]).split('\t').map(function (c) { return c.trim(); }));
        k++;
      }
      if (rows2.length >= 2) {
        return {
          block: { type: 'table', rows: normalizeRows(rows2), header: true },
          next: k
        };
      }
    }

    return null;
  }

  /** สรุปตารางเป็นข้อความสั้น ๆ สำหรับแสดงในตัวแก้โครงสร้าง */
  function tableSummary(b) {
    var cols = b.rows[0] ? b.rows[0].length : 0;
    var head = (b.rows[0] || []).slice(0, 3).join(' · ');
    return 'ตาราง ' + b.rows.length + ' แถว × ' + cols + ' คอลัมน์' + (head ? '  (' + head + ')' : '');
  }

  /**
   * แยกวิเคราะห์ข้อความหนึ่งบท
   * @param {string} text ข้อความดิบ
   * @param {object} opt  { chapter, joinMode, smartHeadings, keepBlank }
   * @returns {Array} blocks
   */
  function parse(text, opt) {
    opt = opt || {};
    var chapterInfo = (typeof TFTemplates !== 'undefined' && TFTemplates.CHAPTERS[opt.chapter]) || null;
    var known = chapterInfo ? chapterInfo.headings : [];
    var joinMode = opt.joinMode || 'auto';
    var smart = opt.smartHeadings !== false;

    var lines = joinWrapped(normalize(text).split('\n'), joinMode);

    var blocks = [];
    var prevType = null;
    var sawChapterNum = false;
    var sawChapterTitle = false;

    for (var i = 0; i < lines.length; i++) {
      var lvl = indentLevel(lines[i]);
      var t = tidy(lines[i]);

      if (t === '') {
        if (opt.keepBlank) blocks.push({ type: 'blank', text: '' });
        prevType = 'blank';
        continue;
      }

      // ตารางกินหลายบรรทัด จึงต้องตรวจก่อนจำแนกย่อหน้าเดี่ยว
      if (opt.tables !== false) {
        var tbl = readTable(lines, i);
        if (tbl) {
          tbl.block.text = tableSummary(tbl.block);
          blocks.push(tbl.block);
          prevType = 'table';
          i = tbl.next - 1;
          continue;
        }
      }

      var b = classify(t, {
        lvl: lvl,
        known: known,
        smart: smart,
        prevType: prevType,
        next: nextNonEmpty(lines, i),
        sawChapterNum: sawChapterNum,
        sawChapterTitle: sawChapterTitle,
        isFirstContent: blocks.length === 0
      });

      if (b.type === 'chapterNum') sawChapterNum = true;
      if (b.type === 'chapterTitle') sawChapterTitle = true;

      blocks.push(b);
      // ถ้าเป็น "บทที่ 1 บทนำ" บรรทัดเดียว ให้แตกออกเป็นสองย่อหน้า
      if (b.trailing) {
        blocks.push({ type: 'chapterTitle', text: b.trailing });
        sawChapterTitle = true;
        delete b.trailing;
        prevType = 'chapterTitle';
        continue;
      }
      prevType = b.type;
    }

    return blocks;
  }

  function nextNonEmpty(lines, i) {
    for (var j = i + 1; j < lines.length; j++) {
      var t = tidy(lines[j]);
      if (t !== '') return t;
    }
    return '';
  }

  function classify(t, ctx) {
    // 1) ผู้ใช้กำกับเองด้วย # ## ### #### และ >
    var m = t.match(/^(#{1,4})\s+(.*)$/);
    if (m) return { type: 'h' + m[1].length, text: m[2].trim() };
    if (/^>\s+/.test(t)) return { type: 'quote', text: t.replace(/^>\s+/, '') };

    // 2) "บทที่ X"
    if (RE.chapterNum.test(t)) return { type: 'chapterNum', text: t.replace(/\s+/g, ' ') };

    var cm = t.match(RE.chapterNumIn);
    if (cm && cm[2] && ctx.isFirstContent && !ctx.sawChapterNum) {
      return { type: 'chapterNum', text: 'บทที่ ' + cm[1], trailing: cm[2].trim() };
    }

    // 3) บรรทัดถัดจาก "บทที่ X" = ชื่อบท
    if (ctx.prevType === 'chapterNum' && !ctx.sawChapterTitle) {
      return { type: 'chapterTitle', text: t };
    }

    // 4) คำที่ต้องอยู่กึ่งกลาง (บรรณานุกรม / ภาคผนวก / ประวัติผู้จัดทำ ...)
    if (RE.centerWord.test(t)) return { type: 'chapterTitle', text: t };

    // 5) ชื่อตาราง/ภาพ
    if (RE.caption.test(t)) return { type: 'caption', text: t };

    // 6) หัวข้อมาตรฐานประจำบท
    if (t.length <= 120 && matchesKnownHeading(t, ctx.known)) return { type: 'h1', text: t };

    // 7) หัวข้อที่มีเลขกำกับหลายระดับ
    if (RE.num4.test(t)) return { type: 'h4', text: t };
    if (RE.num3.test(t)) return { type: 'h3', text: t };
    if (RE.num2.test(t)) return { type: 'h2', text: t };

    // 8) "1. xxx" — สั้นและไม่ใช่ประโยค = หัวข้อหลัก, นอกนั้น = รายการ
    var m1 = t.match(RE.num1);
    if (m1) {
      var rest = m1[2].trim();
      if (rest.length <= 60 && !looksLikeSentence(rest)) return { type: 'h1', text: t };
      return { type: 'list', text: t };
    }

    // 9) รายการย่อยแบบอื่น
    if (RE.bullet.test(t) || RE.paren.test(t) || RE.thaiLetter.test(t)) {
      return { type: 'list', text: t };
    }

    // 10) เดาหัวข้อจากลักษณะบรรทัด (สั้น ไม่จบประโยค และอยู่หลังบรรทัดว่าง)
    if (ctx.smart &&
        ctx.prevType === 'blank' &&
        t.length <= 45 &&
        !/[.!?,;]$/.test(t) &&
        !/\s(คือ|ได้แก่|เพื่อ|ซึ่ง|โดย|และ|หรือ)\s/.test(t)) {
      return { type: 'h1', text: t };
    }

    // 11) เนื้อความ (เยื้องลึก = ข้อความยกมา)
    if (ctx.lvl >= 2) return { type: 'quote', text: t };
    return { type: 'body', text: t };
  }

  /* ------------------------------------------------------------------
   * บรรณานุกรม
   * ------------------------------------------------------------------ */
  function isThai(s) { return RE_THAI_LEAD.test(String(s).trim()); }

  function sortBib(items) {
    var thai = items.filter(isThai);
    var other = items.filter(function (s) { return !isThai(s); });
    var cmpTh;
    try {
      var c = new Intl.Collator('th', { numeric: true, sensitivity: 'base' });
      cmpTh = function (a, b) { return c.compare(a, b); };
    } catch (e) {
      cmpTh = function (a, b) { return a < b ? -1 : a > b ? 1 : 0; };
    }
    thai.sort(cmpTh);
    other.sort(function (a, b) { return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' }); });
    return thai.concat(other);
  }

  /**
   * แยกรายการบรรณานุกรม
   * @param {object} opt { splitMode: 'line'|'blank', sort: boolean }
   */
  function parseBibliography(text, opt) {
    opt = opt || {};
    var norm = normalize(text);
    var items = (opt.splitMode === 'blank') ? norm.split(/\n\s*\n/) : norm.split('\n');

    items = items
      .map(function (s) { return s.replace(/\s*\n\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim(); })
      .filter(function (s) { return s.length > 0; });

    // แยกหัวข้อกลุ่มออกจากรายการ แล้วเรียงเฉพาะรายการ
    var isGroup = function (s) {
      return RE.centerWord.test(s) ||
             /^(ภาษาไทย|ภาษาอังกฤษ|หนังสือ|บทความ|วิทยานิพนธ์|สื่ออิเล็กทรอนิกส์|เอกสารอื่น\s?ๆ?)\s*$/.test(s) ||
             /^[\d\u0E50-\u0E59]+[.)]\s*\S{1,40}$/.test(s);
    };

    if (opt.sort !== false && !items.some(isGroup)) items = sortBib(items);

    return items.map(function (s) {
      if (RE.centerWord.test(s)) return { type: 'chapterTitle', text: s };
      if (isGroup(s)) return { type: 'h1', text: s };
      return { type: 'bib', text: s };
    });
  }

  /* ------------------------------------------------------------------
   * ภาคผนวก
   * ------------------------------------------------------------------ */
  function parseAppendix(text, opt) {
    opt = opt || {};
    var blocks = parse(text, { chapter: null, joinMode: opt.joinMode, smartHeadings: opt.smartHeadings });
    return blocks.map(function (b, i) {
      if (/^ภาคผนวก(\s+[\u0E01-\u0E2E])?\s*$/.test(b.text)) {
        return { type: 'chapterTitle', text: b.text, pageBreakBefore: i > 0 };
      }
      return b;
    });
  }

  /* ------------------------------------------------------------------
   * สรุปโครงสร้าง (ใช้สร้างสารบัญ)
   * ------------------------------------------------------------------ */
  function outline(blocks) {
    return blocks
      .filter(function (b) { return b.type === 'chapterTitle' || b.type === 'h1' || b.type === 'h2'; })
      .map(function (b) {
        return {
          level: b.type === 'chapterTitle' ? 0 : (b.type === 'h1' ? 1 : 2),
          text: b.text
        };
      });
  }

  return {
    normalize: normalize,
    parse: parse,
    parseBibliography: parseBibliography,
    parseAppendix: parseAppendix,
    outline: outline,
    thaiToArabic: thaiToArabic,
    tidy: tidy,
    isThai: isThai,
    readTable: readTable,
    tableSummary: tableSummary
  };
})();
