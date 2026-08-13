/*!
 * templates.js — ข้อกำหนดรูปแบบ (Pattern) และแม่แบบหัวข้อของแต่ละบท
 *
 * โปรแกรมนี้ใช้สำหรับ "รายงานโครงงาน" ของนักเรียนระดับมัธยมศึกษา
 * ค่ารูปแบบทั้งหมดสกัดมาจากไฟล์ต้นแบบเอกสารวิชาการจริง ไม่ได้ประมาณเอง
 *   • ชุด "angsana" : ต้นแบบ CHAP1–5.doc, BIB, APPENDIX, VITA, COVER, INTRO
 *   • ชุด "sarabun" : ต้นแบบ เทมเพลตพิมพ์วิทยานิพนธ์-งานวิจัย.docx (บรรณานุกรม APA)
 *
 * หน่วยที่ใช้ในสเปกคือ "พอยต์ (pt)" ทั้งหมด
 *   pt -> twips   : x20   (ระยะขอบ/ระยะย่อหน้า)
 *   pt -> half-pt : x2    (ขนาดตัวอักษรใน OOXML)
 */
var TFTemplates = (function () {
  'use strict';

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ==================================================================
   * ชุดที่ 1 — ตัวอักษร AngsanaUPC (ขอบกว้าง เลขหน้ากึ่งกลาง)
   * ================================================================== */
  var SPEC_ANGSANA = {
    layout: 'angsana',
    page: {
      width: 595.3, height: 841.9,
      marginTop: 108, marginBottom: 72, marginLeft: 108, marginRight: 72,
      headerDistance: 72, footerDistance: 35.3
    },
    font: {
      name: 'AngsanaUPC',
      fallback: "'AngsanaUPC','Angsana New','TH SarabunPSK','TH Sarabun New',serif"
    },
    styles: {
      chapterNum:   { size: 20, bold: true,  align: 'center',         indent: 0,   firstLine: 0,  before: 0, after: 0 },
      chapterTitle: { size: 22, bold: true,  align: 'center',         indent: 0,   firstLine: 0,  before: 0, after: 12 },
      h1:           { size: 18, bold: true,  align: 'left',           indent: 0,   firstLine: 0,  before: 6, after: 0 },
      h2:           { size: 16, bold: true,  align: 'left',           indent: 54,  firstLine: 0,  before: 0, after: 0 },
      h3:           { size: 16, bold: true,  align: 'left',           indent: 108, firstLine: 0,  before: 0, after: 0 },
      h4:           { size: 16, bold: true,  align: 'left',           indent: 162, firstLine: 0,  before: 0, after: 0 },
      body:         { size: 16, bold: false, align: 'thaiDistribute', indent: 0,   firstLine: 54, before: 0, after: 0 },
      list:         { size: 16, bold: false, align: 'left'          , indent: 90,  hanging: 36,   before: 0, after: 0 },
      quote:        { size: 16, bold: false, align: 'thaiDistribute', indent: 108, firstLine: 0,  before: 0, after: 0 },
      caption:      { size: 16, bold: true,  align: 'left',           indent: 0,   firstLine: 0,  before: 6, after: 6 },
      bib:          { size: 16, bold: false, align: 'left',           indent: 54,  hanging: 54,   before: 0, after: 0 },
      center:       { size: 16, bold: false, align: 'center',         indent: 0,   firstLine: 0,  before: 0, after: 0 },
      table:        { size: 14, bold: false, align: 'left', headerBold: true, headerAlign: 'center', borderSize: 4, cellPadding: 4, before: 0, after: 0 },
      blank:        { size: 16, bold: false, align: 'left',           indent: 0,   firstLine: 0,  before: 0, after: 0 }
    },
    lineSpacing: { rule: 'single', value: 1 },
    pageNumber: {
      show: true, position: 'center', size: 16,
      hideOnFirstPageOfChapter: true,
      bodyFormat: 'decimal', frontFormat: 'thaiLetters'
    },
    options: { chapterOnNewPage: true, autoTocField: false }
  };

  /* ==================================================================
   * ชุดที่ 2 — ตัวอักษร TH SarabunPSK (ขอบมาตรฐาน เลขหน้าชิดขวา)
   * ================================================================== */
  var SPEC_SARABUN = {
    layout: 'sarabun',
    page: {
      width: 595.3, height: 841.9,
      marginTop: 72, marginBottom: 72, marginLeft: 108, marginRight: 72,
      headerDistance: 36, footerDistance: 36
    },
    font: {
      name: 'TH SarabunPSK',
      fallback: "'TH SarabunPSK','TH Sarabun New','TH SarabunIT๙','Angsana New',serif"
    },
    styles: {
      chapterNum:   { size: 18, bold: true,  align: 'center', indent: 0,  firstLine: 0,  before: 0, after: 0 },
      chapterTitle: { size: 18, bold: true,  align: 'center', indent: 0,  firstLine: 0,  before: 0, after: 12 },
      h1:           { size: 16, bold: true,  align: 'left',   indent: 0,  firstLine: 0,  before: 6, after: 0 },
      h2:           { size: 16, bold: true,  align: 'left',   indent: 0,  firstLine: 0,  before: 6, after: 0 },
      h3:           { size: 16, bold: true,  align: 'left',   indent: 0,  firstLine: 36, before: 0, after: 0 },
      h4:           { size: 16, bold: true,  align: 'left',   indent: 36, firstLine: 0,  before: 0, after: 0 },
      body:         { size: 16, bold: false, align: 'thaiDistribute', indent: 0,  firstLine: 36, before: 0, after: 0 },
      list:         { size: 16, bold: false, align: 'left'          , indent: 72, hanging: 36,   before: 0, after: 0 },
      quote:        { size: 16, bold: false, align: 'thaiDistribute', indent: 72, firstLine: 0,  before: 0, after: 0 },
      caption:      { size: 16, bold: false, align: 'left',   indent: 0,  firstLine: 0,  before: 6, after: 6 },
      bib:          { size: 16, bold: false, align: 'left',   indent: 36, hanging: 36,   before: 0, after: 0 },
      center:       { size: 16, bold: false, align: 'center', indent: 0,  firstLine: 0,  before: 0, after: 0 },
      table:        { size: 14, bold: false, align: 'left', headerBold: true, headerAlign: 'center', borderSize: 4, cellPadding: 4, before: 0, after: 0 },
      blank:        { size: 16, bold: false, align: 'left',   indent: 0,  firstLine: 0,  before: 0, after: 0 }
    },
    lineSpacing: { rule: 'single', value: 1 },
    pageNumber: {
      show: true, position: 'right', size: 14,
      hideOnFirstPageOfChapter: true,
      bodyFormat: 'decimal', frontFormat: 'lowerRoman'
    },
    options: { chapterOnNewPage: true, autoTocField: false }
  };

  /* ------------------------------------------------------------------
   * หัวข้อมาตรฐานของแต่ละบท (ใช้ตรวจจับหัวข้อหลักอัตโนมัติ)
   * ------------------------------------------------------------------ */
  var CHAPTERS = {
    1: {
      num: 'บทที่ 1', title: 'บทนำ',
      headings: [
        'ที่มาและความสำคัญของโครงงาน', 'ที่มาและความสำคัญ',
        'ความเป็นมาและความสำคัญของปัญหา', 'หลักการและเหตุผล',
        'วัตถุประสงค์ของโครงงาน', 'วัตถุประสงค์',
        'สมมติฐานของโครงงาน', 'สมมติฐาน',
        'ขอบเขตของโครงงาน', 'ขอบเขตการศึกษา',
        'ตัวแปรที่ศึกษา',
        'นิยามศัพท์เฉพาะ', 'นิยามเชิงปฏิบัติการ',
        'ประโยชน์ที่คาดว่าจะได้รับ', 'ประโยชน์ของโครงงาน'
      ]
    },
    2: {
      num: 'บทที่ 2', title: 'เอกสารและโครงงานที่เกี่ยวข้อง',
      headings: [
        'เอกสารที่เกี่ยวข้อง', 'แนวคิดและทฤษฎีที่เกี่ยวข้อง',
        'ความรู้พื้นฐานที่เกี่ยวข้อง', 'โครงงานที่เกี่ยวข้อง',
        'งานวิจัยที่เกี่ยวข้อง', 'กรอบแนวคิดของโครงงาน', 'สรุป'
      ]
    },
    3: {
      num: 'บทที่ 3', title: 'วิธีดำเนินการโครงงาน',
      headings: [
        'วัสดุ อุปกรณ์ และเครื่องมือที่ใช้', 'วัสดุอุปกรณ์',
        'เครื่องมือที่ใช้ในการเก็บข้อมูล',
        'ขั้นตอนการดำเนินงาน', 'วิธีดำเนินการ',
        'กลุ่มเป้าหมาย', 'ประชากรและกลุ่มตัวอย่าง',
        'การเก็บรวบรวมข้อมูล', 'การวิเคราะห์ข้อมูล',
        'ระยะเวลาในการดำเนินงาน', 'สถิติที่ใช้ในการวิเคราะห์ข้อมูล'
      ]
    },
    4: {
      num: 'บทที่ 4', title: 'ผลการดำเนินโครงงาน',
      headings: [
        'ผลการดำเนินโครงงาน', 'ผลการทดลอง', 'ผลการวิเคราะห์ข้อมูล',
        'สัญลักษณ์ที่ใช้ในการวิเคราะห์ข้อมูล',
        'ตอนที่ 1', 'ตอนที่ 2', 'ตอนที่ 3', 'ตอนที่ 4', 'ตอนที่ 5'
      ]
    },
    5: {
      num: 'บทที่ 5', title: 'สรุปผล อภิปรายผล และข้อเสนอแนะ',
      headings: [
        'สรุปผลการดำเนินโครงงาน', 'สรุปผล',
        'อภิปรายผล', 'อภิปรายผลการดำเนินงาน',
        'ปัญหาและอุปสรรค',
        'ข้อเสนอแนะ', 'ข้อเสนอแนะในการนำไปใช้',
        'ข้อเสนอแนะในการทำโครงงานครั้งต่อไป'
      ]
    }
  };

  /* ------------------------------------------------------------------
   * ช่องกรอกประวัติผู้จัดทำ
   * ------------------------------------------------------------------ */
  var VITA_FIELDS = [
    { key: 'name',      label: 'ชื่อ–นามสกุล' },
    { key: 'studentId', label: 'เลขประจำตัวนักเรียน' },
    { key: 'grade',     label: 'ระดับชั้น' },
    { key: 'birthDate', label: 'วัน เดือน ปีเกิด' },
    { key: 'address',   label: 'ที่อยู่', multiline: true },
    { key: 'phone',     label: 'เบอร์โทรศัพท์' },
    { key: 'email',     label: 'อีเมล' },
    { key: 'interest',  label: 'ความสนใจ / ความถนัด', multiline: true },
    { key: 'awards',    label: 'ผลงานหรือรางวัลที่เคยได้รับ', multiline: true }
  ];

  /* ------------------------------------------------------------------
   * ชุดรูปแบบ (Preset) — เลือกได้จากแถบบนสุดของโปรแกรม
   * ------------------------------------------------------------------ */
  var PRESETS = {
    angsana: {
      id: 'angsana',
      label: 'แบบที่ 1 — AngsanaUPC',
      note: 'ตัวอักษร AngsanaUPC · ขอบบน–ซ้าย 3.81 ซม. · เลขหน้ากึ่งกลาง · ส่วนหน้าใช้ ก ข ค',
      spec: SPEC_ANGSANA,
      vitaLabelWidth: 126,
      figureListTitle: 'สารบัญภาพ',
      figurePrefix: 'ภาพที่ '
    },
    sarabun: {
      id: 'sarabun',
      label: 'แบบที่ 2 — TH SarabunPSK',
      note: 'ตัวอักษร TH SarabunPSK · ขอบบน 2.54 ซม. · เนื้อความชิดขอบทั้งสองข้าง · เลขหน้าชิดขวา · ส่วนหน้าใช้ i ii iii · บรรณานุกรมแบบ APA',
      spec: SPEC_SARABUN,
      vitaLabelWidth: 144,
      figureListTitle: 'สารบัญภาพประกอบ',
      figurePrefix: 'ภาพที่ '
    }
  };

  var PRESET_ORDER = ['angsana', 'sarabun'];
  var DEFAULT_PRESET = 'angsana';

  function preset(id) { return PRESETS[id] || PRESETS[DEFAULT_PRESET]; }

  // ทุกชุดใช้แบบฟอร์มประวัติและชื่อเรียกเดียวกัน (บริบทโรงเรียน)
  PRESET_ORDER.forEach(function (id) {
    PRESETS[id].vitaTitle = 'ประวัติผู้จัดทำ';
    PRESETS[id].vitaFields = VITA_FIELDS;
  });

  /* ------------------------------------------------------------------
   * ป้ายกำกับประเภทย่อหน้า (ใช้ในตัวแก้โครงสร้าง)
   * ------------------------------------------------------------------ */
  var BLOCK_LABELS = {
    chapterNum:   'บทที่ (เลขบท)',
    chapterTitle: 'ชื่อบท',
    h1:           'หัวข้อหลัก',
    h2:           'หัวข้อระดับ 2',
    h3:           'หัวข้อระดับ 3',
    h4:           'หัวข้อระดับ 4',
    body:         'เนื้อความ',
    list:         'รายการ/ข้อย่อย',
    quote:        'อ้างอิงยกมา',
    caption:      'ชื่อตาราง/ภาพ',
    table:        'ตาราง',
    bib:          'รายการบรรณานุกรม',
    center:       'จัดกึ่งกลาง',
    blank:        'บรรทัดว่าง'
  };

  /* ------------------------------------------------------------------
   * ตัวอย่างข้อความ
   * ------------------------------------------------------------------ */
  var SAMPLE_CH1 = [
    'บทที่ 1',
    'บทนำ',
    '',
    'ที่มาและความสำคัญของโครงงาน',
    'ปัจจุบันขยะพลาสติกในโรงเรียนมีปริมาณเพิ่มขึ้นทุกปี โดยเฉพาะขวดน้ำดื่มที่นักเรียนใช้แล้วทิ้ง ซึ่งใช้เวลาย่อยสลายนานหลายร้อยปี ส่งผลกระทบต่อสิ่งแวดล้อมภายในโรงเรียนและชุมชนโดยรอบ',
    'คณะผู้จัดทำจึงสนใจนำขวดพลาสติกที่ใช้แล้วมาประดิษฐ์เป็นกระถางต้นไม้ เพื่อลดปริมาณขยะและสร้างมูลค่าเพิ่มให้กับวัสดุเหลือใช้',
    '',
    'วัตถุประสงค์ของโครงงาน',
    '1. เพื่อประดิษฐ์กระถางต้นไม้จากขวดพลาสติกที่ใช้แล้ว',
    '2. เพื่อศึกษาความพึงพอใจของผู้ใช้ที่มีต่อกระถางต้นไม้ที่ประดิษฐ์ขึ้น',
    '',
    'สมมติฐานของโครงงาน',
    'กระถางต้นไม้ที่ประดิษฐ์จากขวดพลาสติกสามารถใช้ปลูกต้นไม้ได้ดีไม่แตกต่างจากกระถางทั่วไป',
    '',
    'ขอบเขตของโครงงาน',
    '1.1 ขอบเขตด้านเนื้อหา',
    'ศึกษาการนำขวดพลาสติกชนิด PET ขนาด 600 มิลลิลิตร มาประดิษฐ์เป็นกระถางต้นไม้',
    '1.2 ขอบเขตด้านระยะเวลา',
    'ดำเนินการระหว่างเดือนมิถุนายนถึงเดือนสิงหาคม ปีการศึกษา 2568',
    '',
    'นิยามศัพท์เฉพาะ',
    'กระถางรีไซเคิล หมายถึง กระถางต้นไม้ที่ประดิษฐ์ขึ้นจากขวดพลาสติกที่ใช้แล้วตามวิธีการในโครงงานนี้',
    '',
    'ประโยชน์ที่คาดว่าจะได้รับ',
    '1. ลดปริมาณขยะพลาสติกภายในโรงเรียน',
    '2. ได้แนวทางการนำวัสดุเหลือใช้มาสร้างประโยชน์'
  ].join('\n');

  var SAMPLE_BIB = {
    angsana: [
      'กรมส่งเสริมคุณภาพสิ่งแวดล้อม (2566) คู่มือการจัดการขยะในสถานศึกษา กรุงเทพมหานคร กระทรวงทรัพยากรธรรมชาติและสิ่งแวดล้อม',
      'สมชาย ใจดี (2565) "การนำขวดพลาสติกกลับมาใช้ใหม่" วารสารสิ่งแวดล้อมศึกษา 12, 2 (พฤษภาคม-สิงหาคม) : 45-52',
      'National Geographic. (2023). Plastic Pollution. Washington, DC: National Geographic Society.'
    ].join('\n'),
    sarabun: [
      'กรมส่งเสริมคุณภาพสิ่งแวดล้อม. (2566). คู่มือการจัดการขยะในสถานศึกษา. กรุงเทพมหานคร: กระทรวงทรัพยากรธรรมชาติและสิ่งแวดล้อม.',
      'สมชาย ใจดี. (2565). การนำขวดพลาสติกกลับมาใช้ใหม่. วารสารสิ่งแวดล้อมศึกษา, 12(2), 45-52.',
      'National Geographic. (2023). Plastic pollution. Washington, DC: National Geographic Society.'
    ].join('\n')
  };

  return {
    PRESETS: PRESETS,
    PRESET_ORDER: PRESET_ORDER,
    DEFAULT_PRESET: DEFAULT_PRESET,
    preset: preset,
    DEFAULT_SPEC: SPEC_ANGSANA,
    CHAPTERS: CHAPTERS,
    VITA_FIELDS: VITA_FIELDS,
    BLOCK_LABELS: BLOCK_LABELS,
    SAMPLE_CH1: SAMPLE_CH1,
    SAMPLE_BIB: SAMPLE_BIB,
    clone: clone
  };
})();
