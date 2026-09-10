/*!
 * thaibreak.js — แทรกจุดตัดคำไทยให้ Word ขึ้นบรรทัดใหม่ได้ถูกที่
 *
 * ปัญหา: Word จะตัดบรรทัดภาษาไทยตามพจนานุกรมก็ต่อเมื่อเครื่องนั้นติดตั้งภาษาไทยไว้
 * ถ้าไม่ได้ติดตั้ง Word จะตัดที่ "ช่องว่าง" อย่างเดียว ผลคือ
 *   - บรรทัดจบก่อนถึงขอบขวา ขอบขวาไม่เรียงเป็นแนวเดียวกัน
 *   - หรือถ้าสั่งจัดชิดขอบ Word จะยืดช่องไฟจนเห็นเป็นช่องว่างกลางคำ
 *   - บางครั้งตัดกลางพยางค์ เช่น "ในก | ารลด"
 *
 * วิธีแก้: ฝัง ZWSP (U+200B อักขระกว้างศูนย์ มองไม่เห็น ไม่กินที่)
 * ไว้ที่ขอบเขตคำ Word จึงขึ้นบรรทัดใหม่ตรงนั้นได้เสมอ ไม่ว่าเครื่องปลายทาง
 * จะติดตั้งภาษาไทยหรือไม่
 *
 * ขอบเขตคำได้จาก Intl.Segmenter ซึ่งใช้พจนานุกรมไทยของ ICU ที่มีอยู่ในเบราว์เซอร์แล้ว
 * (แนวทางเดียวกับที่สคริปต์เอกสารราชการใช้ pythainlp ฝั่ง Python)
 */
var TFThai = (function () {
  'use strict';

  var ZWSP = '\u200B';
  var THAI = /[\u0E00-\u0E7F]/;

  /* คำที่ห้ามตัดกลางคำ — วิสามานยนามและคำที่อ่านสะดุดถ้าถูกหั่น */
  var NOBREAK = [
    'กรุงเทพมหานคร', 'ผู้อำนวยการ', 'รองผู้อำนวยการ', 'คณะกรรมการ',
    'ประชาสัมพันธ์', 'สาธารณูปโภค', 'สมรรถภาพ', 'ยานพาหนะ',
    'สำนักงานเขตพื้นที่การศึกษา', 'กระทรวงศึกษาธิการ',
    'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน',
    'วิทยาศาสตร์และเทคโนโลยี', 'ผลสัมฤทธิ์ทางการเรียน',
    'มัธยมศึกษา', 'ประถมศึกษา', 'ปีการศึกษา', 'ภาคเรียน',
    'กลุ่มสาระการเรียนรู้', 'สถานศึกษา', 'นักเรียน', 'โรงเรียน',
    'กิตติกรรมประกาศ', 'บรรณานุกรม', 'ภาคผนวก', 'บทคัดย่อ'
  ];

  var segmenter = null;
  var checked = false;

  function getSegmenter() {
    if (checked) return segmenter;
    checked = true;
    try {
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        segmenter = new Intl.Segmenter('th', { granularity: 'word' });
      }
    } catch (e) { segmenter = null; }
    return segmenter;
  }

  /** เบราว์เซอร์นี้ตัดคำไทยได้หรือไม่ */
  function available() { return !!getSegmenter(); }

  /**
   * แทรก ZWSP ที่ขอบเขตคำไทย
   * ข้อความที่ไม่มีอักษรไทยจะคืนค่าเดิมทั้งหมด
   */
  function addBreaks(text) {
    var s = String(text == null ? '' : text);
    if (!s || !THAI.test(s)) return s;
    var seg = getSegmenter();
    if (!seg) return s;

    var out = '', prevThai = false;
    var parts = seg.segment(s);
    for (var it = parts[Symbol.iterator](), r = it.next(); !r.done; r = it.next()) {
      var w = r.value.segment;
      var isThai = THAI.test(w.charAt(0));
      // ใส่จุดตัดเฉพาะรอยต่อระหว่างคำไทยสองคำ
      // ไม่ใส่ติดกับช่องว่างหรือคำภาษาอื่น เพราะตรงนั้นตัดได้อยู่แล้ว
      if (out && isThai && prevThai) out += ZWSP;
      out += w;
      prevThai = isThai;
    }
    return protectWords(out);
  }

  /** เอาจุดตัดออกจากคำที่ห้ามตัดกลางคำ */
  function protectWords(s) {
    for (var i = 0; i < NOBREAK.length; i++) {
      var w = NOBREAK[i];
      if (s.indexOf(w.charAt(0)) < 0) continue;
      // สร้างรูปแบบที่ยอมให้มี ZWSP แทรกอยู่ระหว่างตัวอักษรได้
      // คำในรายการเป็นอักษรไทยล้วน ไม่มีอักขระพิเศษของ regex จึงต่อได้ตรง ๆ
      var pat = w.split('').join(ZWSP + '*');
      s = s.replace(new RegExp(pat, 'g'), w);
    }
    return s;
  }

  /** ลบจุดตัดออก (ใช้ตอนอ่านข้อความกลับเข้าโปรแกรม) */
  function stripBreaks(text) {
    return String(text == null ? '' : text).replace(/\u200B/g, '');
  }

  return {
    ZWSP: ZWSP,
    available: available,
    addBreaks: addBreaks,
    stripBreaks: stripBreaks,
    NOBREAK: NOBREAK
  };
})();
