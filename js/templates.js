/*!
 * templates.js — ข้อกำหนดรูปแบบ (Pattern) ของแต่ละสถาบัน และแม่แบบหัวข้อของแต่ละบท
 *
 * ค่าทั้งหมดสกัดมาจากไฟล์ต้นแบบจริง ไม่ได้ประมาณเอง
 *   • ชุด "stou" : Thesis/CHAP1–5.doc, BIB, APPENDIX, VITA, COVER, INTRO
 *                 (คู่มือการพิมพ์วิทยานิพนธ์ มสธ. ฉบับปรับปรุง พ.ศ. 2546)
 *   • ชุด "siu"  : เทมเพลตพิมพ์วิทยานิพนธ์-งานวิจัย.docx
 *                 (มหาวิทยาลัยชินวัตร · บรรณานุกรมแบบ APA 6th)
 *
 * หน่วยที่ใช้ในสเปกคือ "พอยต์ (pt)" ทั้งหมด
 *   pt -> twips   : x20   (ระยะขอบ/ระยะย่อหน้า)
 *   pt -> half-pt : x2    (ขนาดตัวอักษรใน OOXML)
 */
var TFTemplates = (function () {
  'use strict';

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ==================================================================
   * ชุดที่ 1 — มหาวิทยาลัยสุโขทัยธรรมาธิราช (มสธ.)
   * ================================================================== */
  var SPEC_STOU = {
    layout: 'stou',
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
      list:         { size: 16, bold: false, align: 'thaiDistribute', indent: 0,   firstLine: 54, before: 0, after: 0 },
      quote:        { size: 16, bold: false, align: 'thaiDistribute', indent: 108, firstLine: 0,  before: 0, after: 0 },
      caption:      { size: 16, bold: true,  align: 'left',           indent: 0,   firstLine: 0,  before: 6, after: 6 },
      bib:          { size: 16, bold: false, align: 'left',           indent: 54,  hanging: 54,   before: 0, after: 0 },
      center:       { size: 16, bold: false, align: 'center',         indent: 0,   firstLine: 0,  before: 0, after: 0 },
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
   * ชุดที่ 2 — มหาวิทยาลัยชินวัตร (APA 6th)
   * ================================================================== */
  var SPEC_SIU = {
    layout: 'siu',
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
      // หัวข้อไม่มีเลขกำกับ (ระดับ 1)
      h1:           { size: 16, bold: true,  align: 'left',   indent: 0,  firstLine: 0,  before: 6, after: 0 },
      // "1.1 ..."  ระดับ 2
      h2:           { size: 16, bold: true,  align: 'left',   indent: 0,  firstLine: 0,  before: 6, after: 0 },
      // "1.1.1 ..." ระดับ 3
      h3:           { size: 16, bold: true,  align: 'left',   indent: 0,  firstLine: 36, before: 0, after: 0 },
      // "1.1.2.1 ..." ระดับ 4
      h4:           { size: 16, bold: true,  align: 'left',   indent: 36, firstLine: 0,  before: 0, after: 0 },
      body:         { size: 16, bold: false, align: 'left',   indent: 0,  firstLine: 36, before: 0, after: 0 },
      list:         { size: 16, bold: false, align: 'left',   indent: 0,  firstLine: 36, before: 0, after: 0 },
      quote:        { size: 16, bold: false, align: 'left',   indent: 72, firstLine: 0,  before: 0, after: 0 },
      caption:      { size: 16, bold: false, align: 'left',   indent: 0,  firstLine: 0,  before: 6, after: 6 },
      bib:          { size: 16, bold: false, align: 'left',   indent: 36, hanging: 36,   before: 0, after: 0 },
      center:       { size: 16, bold: false, align: 'center', indent: 0,  firstLine: 0,  before: 0, after: 0 },
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
        'ความเป็นมาและความสำคัญของปัญหา', 'ความสำคัญของปัญหา', 'ความเป็นมาของปัญหา',
        'หลักการและเหตุผล', 'ที่มาและความสำคัญ',
        'วัตถุประสงค์การวิจัย', 'วัตถุประสงค์ของการวิจัย',
        'กรอบแนวคิดการวิจัย', 'กรอบแนวคิดในการวิจัย',
        'สมมติฐานการวิจัย', 'สมมติฐานของการวิจัย',
        'ขอบเขตของการวิจัย', 'ขอบเขตการวิจัย',
        'ข้อตกลงเบื้องต้น', 'ข้อจำกัดในการวิจัย', 'ข้อจำกัดของการวิจัย',
        'นิยามศัพท์เฉพาะ', 'นิยามศัพท์เชิงปฏิบัติการ',
        'ประโยชน์ที่คาดว่าจะได้รับ', 'ประโยชน์ของการวิจัย'
      ]
    },
    2: {
      num: 'บทที่ 2', title: 'วรรณกรรมที่เกี่ยวข้อง',
      headings: [
        'แนวคิดและทฤษฎีที่เกี่ยวข้อง', 'แนวคิดทฤษฎีที่เกี่ยวข้อง',
        'เอกสารที่เกี่ยวข้อง', 'งานวิจัยที่เกี่ยวข้อง',
        'วรรณกรรมที่เกี่ยวข้อง', 'กรอบแนวคิดการวิจัย', 'สรุป'
      ]
    },
    3: {
      num: 'บทที่ 3', title: 'วิธีดำเนินการวิจัย',
      headings: [
        'รูปแบบการวิจัย', 'ประชากรและกลุ่มตัวอย่าง',
        'ประชากรและกลุ่มตัวอย่างที่ใช้ในการวิจัย',
        'เครื่องมือที่ใช้ในการวิจัย', 'การสร้างและตรวจสอบคุณภาพเครื่องมือ',
        'การเก็บรวบรวมข้อมูล', 'การเก็บรวมรวมข้อมูล',
        'การวิเคราะห์ข้อมูล', 'สถิติที่ใช้ในการวิเคราะห์ข้อมูล'
      ]
    },
    4: {
      num: 'บทที่ 4', title: 'ผลการวิเคราะห์ข้อมูล',
      headings: [
        'สัญลักษณ์ที่ใช้ในการวิเคราะห์ข้อมูล', 'ผลการวิเคราะห์ข้อมูล',
        'ตอนที่ 1', 'ตอนที่ 2', 'ตอนที่ 3', 'ตอนที่ 4', 'ตอนที่ 5'
      ]
    },
    5: {
      num: 'บทที่ 5', title: 'สรุปการวิจัย อภิปรายผล และข้อเสนอแนะ',
      headings: [
        'สรุปการวิจัย', 'สรุปผลการวิจัย', 'อภิปรายผล', 'อภิปรายผลการวิจัย',
        'ข้อเสนอแนะ', 'ข้อเสนอแนะในการนำผลการวิจัยไปใช้',
        'ข้อเสนอแนะในการทำวิจัยครั้งต่อไป'
      ]
    }
  };

  /* ------------------------------------------------------------------
   * ชุดรูปแบบ (Preset) — เลือกได้จากแถบบนสุดของโปรแกรม
   * ------------------------------------------------------------------ */
  var PRESETS = {
    stou: {
      id: 'stou',
      label: 'มสธ. — มหาวิทยาลัยสุโขทัยธรรมาธิราช',
      note: 'คู่มือการพิมพ์วิทยานิพนธ์ ฉบับปรับปรุง พ.ศ. 2546 · AngsanaUPC · เลขหน้ากึ่งกลาง · ส่วนหน้า ก ข ค',
      spec: SPEC_STOU,
      chapters: CHAPTERS,
      universityTh: 'มหาวิทยาลัยสุโขทัยธรรมาธิราช',
      universityEn: 'Sukhothai Thammathirat Open University',
      vitaTitle: 'ประวัติผู้วิจัย',
      vitaLabelWidth: 126,
      figureListTitle: 'สารบัญภาพ',
      figurePrefix: 'ภาพที่ ',
      vitaFields: [
        { key: 'name',       label: 'ชื่อ' },
        { key: 'birthDate',  label: 'วัน เดือน ปีเกิด' },
        { key: 'birthPlace', label: 'สถานที่เกิด' },
        { key: 'education',  label: 'ประวัติการศึกษา', multiline: true },
        { key: 'workPlace',  label: 'สถานที่ทำงาน' },
        { key: 'position',   label: 'ตำแหน่ง' }
      ]
    },

    siu: {
      id: 'siu',
      label: 'มหาวิทยาลัยชินวัตร (APA 6th)',
      note: 'เทมเพลตพิมพ์วิทยานิพนธ์-งานวิจัย · TH SarabunPSK · เลขหน้าชิดขวา · ส่วนหน้า i ii iii',
      spec: SPEC_SIU,
      chapters: CHAPTERS,
      universityTh: 'มหาวิทยาลัยชินวัตร',
      universityEn: 'Shinawatra University',
      vitaTitle: 'ประวัติผู้เขียนวิทยานิพนธ์',
      vitaLabelWidth: 171,
      figureListTitle: 'สารบัญภาพประกอบ',
      figurePrefix: 'ภาพที่ ',
      vitaFields: [
        { key: 'name',       label: 'ชื่อ นามสกุล' },
        { key: 'birthDate',  label: 'วัน เดือน ปี เกิด' },
        { key: 'birthPlace', label: 'สถานที่เกิด' },
        { key: 'education',  label: 'การศึกษา', multiline: true },
        { key: 'workPlace',  label: 'ตำแหน่งและสถานที่ทำงาน' },
        { key: 'address',    label: 'ที่อยู่' },
        { key: 'phone',      label: 'เบอร์โทรศัพท์' },
        { key: 'email',      label: 'อีเมล' },
        { key: 'publications', label: 'สิ่งพิมพ์หรือผลงานวิชาการที่เผยแพร่', multiline: true }
      ]
    }
  };

  var PRESET_ORDER = ['stou', 'siu'];
  var DEFAULT_PRESET = 'stou';

  function preset(id) { return PRESETS[id] || PRESETS[DEFAULT_PRESET]; }

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
    'ความเป็นมาและความสำคัญของปัญหา',
    'การจัดการเรียนการสอนในศตวรรษที่ 21 ให้ความสำคัญกับการพัฒนาผู้เรียนให้มีทักษะการคิดวิเคราะห์ การแก้ปัญหา และการเรียนรู้ด้วยตนเอง ซึ่งสอดคล้องกับพระราชบัญญัติการศึกษาแห่งชาติที่กำหนดให้ผู้เรียนเป็นศูนย์กลางของการเรียนรู้',
    'จากสภาพปัญหาดังกล่าว ผู้วิจัยจึงสนใจศึกษาผลของการจัดการเรียนรู้แบบโครงงานเป็นฐานที่มีต่อผลสัมฤทธิ์ทางการเรียนของนักเรียน เพื่อนำผลการวิจัยไปใช้ในการพัฒนาการเรียนการสอนต่อไป',
    '',
    'วัตถุประสงค์การวิจัย',
    '1. เพื่อเปรียบเทียบผลสัมฤทธิ์ทางการเรียนก่อนและหลังการจัดการเรียนรู้แบบโครงงานเป็นฐาน',
    '2. เพื่อศึกษาความพึงพอใจของนักเรียนที่มีต่อการจัดการเรียนรู้แบบโครงงานเป็นฐาน',
    '',
    'สมมติฐานการวิจัย',
    'นักเรียนที่ได้รับการจัดการเรียนรู้แบบโครงงานเป็นฐานมีผลสัมฤทธิ์ทางการเรียนหลังเรียนสูงกว่าก่อนเรียน',
    '',
    'ขอบเขตของการวิจัย',
    '1.1 ขอบเขตด้านประชากร',
    'ประชากรที่ใช้ในการวิจัยครั้งนี้ คือ นักเรียนชั้นมัธยมศึกษาปีที่ 3 ภาคเรียนที่ 2 ปีการศึกษา 2567',
    '1.1.1 กลุ่มตัวอย่าง',
    'กลุ่มตัวอย่างได้มาโดยการสุ่มแบบกลุ่ม จำนวน 40 คน',
    '1.2 ขอบเขตด้านเนื้อหา',
    'เนื้อหาที่ใช้ในการวิจัยเป็นเนื้อหาในรายวิชาวิทยาการคำนวณ',
    '',
    'นิยามศัพท์เฉพาะ',
    'การจัดการเรียนรู้แบบโครงงานเป็นฐาน หมายถึง การจัดกิจกรรมการเรียนรู้ที่ให้ผู้เรียนลงมือปฏิบัติจริงผ่านการทำโครงงาน',
    '',
    'ประโยชน์ที่คาดว่าจะได้รับ',
    '1. ได้แนวทางการจัดการเรียนรู้ที่ส่งเสริมผลสัมฤทธิ์ทางการเรียนของนักเรียน',
    '2. เป็นข้อมูลพื้นฐานสำหรับครูผู้สอนในการพัฒนาการจัดการเรียนการสอน'
  ].join('\n');

  var SAMPLE_BIB = {
    stou: [
      'นิศา ชูโต (2545) การวิจัยเชิงคุณภาพ พิมพ์ครั้งที่ 2 กรุงเทพมหานคร แม็ทส์ปอยท์',
      'สุชาดา ตั้งทางธรรม (2545) "การแปรรูปรัฐวิสาหกิจ : กรณีโรงงานยาสูบ กระทรวงการคลัง" วารสารสุโขทัยธรรมาธิราช 15, 3 (กันยายน-ธันวาคม) : 23-37',
      'Gummerson, Event. (2000). Qualitative Method in Management Research. 2nd ed. London: Sage Publications.',
      'Himmelfrab, Gertrude. (1999) "Revolution in the Library". Library Trends. 47, 4 (Spring): 612-619'
    ].join('\n'),
    siu: [
      'นิศา ชูโต. (2545). การวิจัยเชิงคุณภาพ (พิมพ์ครั้งที่ 2). กรุงเทพมหานคร: แม็ทส์ปอยท์.',
      'สุชาดา ตั้งทางธรรม. (2545). การแปรรูปรัฐวิสาหกิจ: กรณีโรงงานยาสูบ. วารสารสุโขทัยธรรมาธิราช, 15(3), 23-37.',
      'Gummerson, E. (2000). Qualitative method in management research (2nd ed.). London: Sage Publications.',
      'Himmelfrab, G. (1999). Revolution in the library. Library Trends, 47(4), 612-619.'
    ].join('\n')
  };

  return {
    PRESETS: PRESETS,
    PRESET_ORDER: PRESET_ORDER,
    DEFAULT_PRESET: DEFAULT_PRESET,
    preset: preset,
    // ค่าเริ่มต้น (เพื่อความเข้ากันได้ย้อนหลัง)
    DEFAULT_SPEC: SPEC_STOU,
    CHAPTERS: CHAPTERS,
    BLOCK_LABELS: BLOCK_LABELS,
    SAMPLE_CH1: SAMPLE_CH1,
    SAMPLE_BIB: SAMPLE_BIB,
    clone: clone
  };
})();
