/*!
 * importer.js — นำเข้าข้อความจากไฟล์ PDF / Word (.docx) / ข้อความ (.txt)
 *
 * เขียนตัวอ่านเองทั้งหมด ไม่พึ่งไลบรารีภายนอก เพื่อให้เว็บยังเป็นไฟล์สแตติกล้วน
 * และทำงานได้แม้ไม่มีอินเทอร์เน็ต
 *
 * ข้อจำกัดที่ทราบ
 *   - PDF ที่เป็นภาพสแกน (ไม่มีชั้นข้อความ) ดึงข้อความไม่ได้ ต้องใช้ OCR
 *   - PDF ที่ใส่รหัสผ่าน/เข้ารหัสไว้ อ่านไม่ได้
 *   - PDF ที่ฟอนต์ไม่ฝังตาราง ToUnicode ตัวอักษรไทยอาจเพี้ยน
 */
var TFImport = (function () {
  'use strict';

  /* ==================================================================
   * ตัวช่วยระดับล่าง
   * ================================================================== */

  /** แปลง Uint8Array -> สตริงแบบ latin1 (1 ไบต์ = 1 ตัวอักษร) สำหรับสแกนโครงสร้าง */
  function latin1(u8, from, to) {
    var s = '', CH = 0x8000;
    from = from || 0;
    to = to == null ? u8.length : to;
    for (var i = from; i < to; i += CH) {
      s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + CH, to)));
    }
    return s;
  }

  function decompress(u8, fmt) {
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('เบราว์เซอร์นี้ไม่รองรับการคลายบีบอัด'));
    }
    return new Response(
      new Blob([u8]).stream().pipeThrough(new DecompressionStream(fmt))
    ).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  /** FlateDecode = zlib; เผื่อบางไฟล์ใช้ raw deflate จึงลองสองแบบ */
  function inflate(u8) {
    return decompress(u8, 'deflate').catch(function () {
      return decompress(u8, 'deflate-raw');
    });
  }

  /** ยกเลิก PNG predictor (ใช้ในบาง stream ของ PDF) */
  function undoPngPredictor(data, colors, bpc, columns) {
    var bpp = Math.ceil(colors * bpc / 8);
    var rowLen = Math.ceil(colors * bpc * columns / 8);
    var rows = Math.floor(data.length / (rowLen + 1));
    var out = new Uint8Array(rows * rowLen);
    var prev = new Uint8Array(rowLen);
    for (var r = 0; r < rows; r++) {
      var ft = data[r * (rowLen + 1)];
      var row = data.subarray(r * (rowLen + 1) + 1, (r + 1) * (rowLen + 1));
      var cur = new Uint8Array(rowLen);
      for (var i = 0; i < rowLen; i++) {
        var raw = row[i] || 0;
        var a = i >= bpp ? cur[i - bpp] : 0;
        var b = prev[i];
        var c = i >= bpp ? prev[i - bpp] : 0;
        var v;
        switch (ft) {
          case 0: v = raw; break;
          case 1: v = raw + a; break;
          case 2: v = raw + b; break;
          case 3: v = raw + ((a + b) >> 1); break;
          case 4:
            var p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
            v = raw + (pa <= pb && pa <= pc ? a : (pb <= pc ? b : c));
            break;
          default: v = raw;
        }
        cur[i] = v & 0xFF;
      }
      out.set(cur, r * rowLen);
      prev = cur;
    }
    return out;
  }

  /* ==================================================================
   * ตัวแยกวิเคราะห์ไวยากรณ์ PDF
   * ================================================================== */

  var DELIM = '()<>[]{}/%';

  function isWs(c) { return c === ' ' || c === '\n' || c === '\r' || c === '\t' || c === '\f' || c === '\0'; }
  function isDelim(c) { return DELIM.indexOf(c) >= 0; }

  function skipWs(s, i) {
    while (i < s.length) {
      var c = s[i];
      if (isWs(c)) { i++; continue; }
      if (c === '%') { while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i++; continue; }
      break;
    }
    return i;
  }

  /** อ่านค่าหนึ่งค่าจากตำแหน่ง i คืน { v, i } */
  function readValue(s, i) {
    i = skipWs(s, i);
    if (i >= s.length) return { v: null, i: i };
    var c = s[i];

    // พจนานุกรม << ... >>
    if (c === '<' && s[i + 1] === '<') {
      i += 2;
      var dict = {};
      for (;;) {
        i = skipWs(s, i);
        if (i >= s.length) break;
        if (s[i] === '>' && s[i + 1] === '>') { i += 2; break; }
        if (s[i] !== '/') { i++; continue; }
        var kk = readName(s, i);
        var vv = readValue(s, kk.i);
        dict[kk.v] = vv.v;
        i = vv.i;
      }
      return { v: dict, i: i };
    }

    // สตริงเลขฐานสิบหก < ... >
    if (c === '<') {
      var end = s.indexOf('>', i);
      if (end < 0) end = s.length;
      var hex = s.slice(i + 1, end).replace(/[^0-9A-Fa-f]/g, '');
      if (hex.length % 2) hex += '0';
      var bytes = [];
      for (var h = 0; h < hex.length; h += 2) bytes.push(parseInt(hex.substr(h, 2), 16));
      return { v: { str: bytes }, i: end + 1 };
    }

    // อาร์เรย์ [ ... ]
    if (c === '[') {
      i++;
      var arr = [];
      for (;;) {
        i = skipWs(s, i);
        if (i >= s.length || s[i] === ']') { i++; break; }
        var e = readValue(s, i);
        if (e.i === i) { i++; continue; }
        arr.push(e.v);
        i = e.i;
      }
      return { v: arr, i: i };
    }

    // ชื่อ /Name
    if (c === '/') { var n = readName(s, i); return { v: { name: n.v }, i: n.i }; }

    // สตริงลิเทอรัล ( ... )
    if (c === '(') return readLiteralString(s, i);

    // ตัวเลข / การอ้างอิง n g R
    var m = /^[+-]?[0-9]*\.?[0-9]+/.exec(s.slice(i, i + 32));
    if (m) {
      var num = parseFloat(m[0]);
      var after = i + m[0].length;
      var ref = /^\s+(\d+)\s+R\b/.exec(s.slice(after, after + 24));
      if (ref && Number.isInteger(num)) return { v: { ref: num }, i: after + ref[0].length };
      return { v: num, i: after };
    }

    // คำสำคัญ
    if (s.startsWith('true', i)) return { v: true, i: i + 4 };
    if (s.startsWith('false', i)) return { v: false, i: i + 5 };
    if (s.startsWith('null', i)) return { v: null, i: i + 4 };

    return { v: null, i: i + 1 };
  }

  function readName(s, i) {
    i++; // ข้าม '/'
    var out = '';
    while (i < s.length && !isWs(s[i]) && !isDelim(s[i])) {
      if (s[i] === '#' && /[0-9A-Fa-f]{2}/.test(s.substr(i + 1, 2))) {
        out += String.fromCharCode(parseInt(s.substr(i + 1, 2), 16));
        i += 3;
      } else { out += s[i]; i++; }
    }
    return { v: out, i: i };
  }

  function readLiteralString(s, i) {
    i++; // ข้าม '('
    var depth = 1, bytes = [];
    while (i < s.length) {
      var c = s[i];
      if (c === '\\') {
        var n = s[i + 1];
        var map = { n: 10, r: 13, t: 9, b: 8, f: 12 };
        if (map[n] != null) { bytes.push(map[n]); i += 2; }
        else if (n >= '0' && n <= '7') {
          var oct = /^[0-7]{1,3}/.exec(s.slice(i + 1, i + 4))[0];
          bytes.push(parseInt(oct, 8) & 0xFF);
          i += 1 + oct.length;
        } else if (n === '\n') { i += 2; }
        else if (n === '\r') { i += (s[i + 2] === '\n' ? 3 : 2); }
        else { bytes.push(n.charCodeAt(0)); i += 2; }
        continue;
      }
      if (c === '(') depth++;
      if (c === ')') { depth--; if (!depth) { i++; break; } }
      bytes.push(c.charCodeAt(0) & 0xFF);
      i++;
    }
    return { v: { str: bytes }, i: i };
  }

  /* ==================================================================
   * เอกสาร PDF
   * ================================================================== */

  function PdfDoc(u8) {
    this.u8 = u8;
    this.s = latin1(u8);
    this.objs = {};       // num -> {start, end}  (ตำแหน่งในสตริง)
    this.cache = {};      // num -> ค่าที่แยกวิเคราะห์แล้ว
    this.streams = {};    // num -> {dict, raw}
  }

  /** สแกนหา "N G obj" ทั้งไฟล์ (ไม่ต้องพึ่งตาราง xref ซึ่งมีหลายรูปแบบ) */
  PdfDoc.prototype.scan = function () {
    var re = /(?:^|[\s>\]])(\d+)\s+(\d+)\s+obj\b/g, m;
    while ((m = re.exec(this.s))) {
      var num = parseInt(m[1], 10);
      var start = m.index + m[0].length;
      // ฉบับแก้ไขภายหลังอยู่ท้ายไฟล์ จึงให้ตัวหลังทับตัวก่อน
      this.objs[num] = { start: start };
      re.lastIndex = start;
    }
  };

  PdfDoc.prototype.rawObject = function (num) {
    var info = this.objs[num];
    if (!info) return null;
    if (this.cache[num] !== undefined) return this.cache[num];

    var r = readValue(this.s, info.start);
    var value = r.v;

    // มี stream ต่อท้ายหรือไม่
    var j = skipWs(this.s, r.i);
    if (this.s.startsWith('stream', j)) {
      j += 6;
      if (this.s[j] === '\r') j++;
      if (this.s[j] === '\n') j++;
      var len = this.resolve(value && value.Length);
      var dataEnd;
      if (typeof len === 'number' && len >= 0 && j + len <= this.u8.length) {
        dataEnd = j + len;
        // ตรวจว่าตามด้วย endstream จริงไหม ถ้าไม่ ให้ค้นหาเอา
        var probe = this.s.slice(dataEnd, dataEnd + 20);
        if (!/^\s*endstream/.test(probe)) dataEnd = -1;
      } else dataEnd = -1;

      if (dataEnd < 0) {
        var e = this.s.indexOf('endstream', j);
        dataEnd = e < 0 ? this.u8.length : e;
        while (dataEnd > j && (this.s[dataEnd - 1] === '\n' || this.s[dataEnd - 1] === '\r')) dataEnd--;
      }
      this.streams[num] = { dict: value, raw: this.u8.subarray(j, dataEnd) };
    }

    this.cache[num] = value;
    return value;
  };

  PdfDoc.prototype.resolve = function (v) {
    var seen = 0;
    while (v && typeof v === 'object' && typeof v.ref === 'number' && seen++ < 32) {
      v = this.rawObject(v.ref);
    }
    return v;
  };

  /** คลายบีบอัด stream ของอ็อบเจกต์ */
  PdfDoc.prototype.streamData = function (num) {
    var self = this;
    this.rawObject(num);
    var st = this.streams[num];
    if (!st) return Promise.resolve(null);

    var filters = this.resolve(st.dict.Filter);
    if (!filters) return Promise.resolve(st.raw);
    if (!Array.isArray(filters)) filters = [filters];

    var parms = this.resolve(st.dict.DecodeParms) || this.resolve(st.dict.DP);
    if (!Array.isArray(parms)) parms = [parms];

    var data = Promise.resolve(st.raw);
    filters.forEach(function (f, idx) {
      var name = f && f.name;
      data = data.then(function (d) {
        if (!d) return d;
        if (name === 'FlateDecode' || name === 'Fl') {
          return inflate(d).then(function (out) {
            var p = self.resolve(parms[idx]);
            if (p && self.resolve(p.Predictor) >= 10) {
              return undoPngPredictor(out,
                self.resolve(p.Colors) || 1,
                self.resolve(p.BitsPerComponent) || 8,
                self.resolve(p.Columns) || 1);
            }
            return out;
          });
        }
        if (name === 'ASCIIHexDecode' || name === 'AHx') {
          var hex = latin1(d).replace(/[^0-9A-Fa-f]/g, '');
          var o = new Uint8Array(hex.length >> 1);
          for (var i = 0; i < o.length; i++) o[i] = parseInt(hex.substr(i * 2, 2), 16);
          return o;
        }
        if (name === 'ASCII85Decode' || name === 'A85') return ascii85(d);
        // ตัวกรองรูปภาพ (DCTDecode ฯลฯ) ไม่ใช่ข้อความ
        return null;
      });
    });
    return data.catch(function () { return null; });
  };

  function ascii85(u8) {
    var s = latin1(u8).replace(/\s/g, '').replace(/^<~/, '');
    var end = s.indexOf('~>');
    if (end >= 0) s = s.slice(0, end);
    var out = [], i = 0;
    while (i < s.length) {
      if (s[i] === 'z') { out.push(0, 0, 0, 0); i++; continue; }
      var chunk = s.substr(i, 5);
      var pad = 5 - chunk.length;
      chunk += 'uuuu'.slice(0, pad);
      var n = 0;
      for (var k = 0; k < 5; k++) n = n * 85 + (chunk.charCodeAt(k) - 33);
      var b = [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
      for (var j = 0; j < 4 - pad; j++) out.push(b[j]);
      i += 5;
    }
    return new Uint8Array(out);
  }

  /** ขยายอ็อบเจกต์ที่ถูกบีบไว้ใน ObjStm (PDF รุ่นใหม่ใช้บ่อย) */
  PdfDoc.prototype.expandObjectStreams = function () {
    var self = this;
    var nums = Object.keys(this.objs);
    var jobs = [];
    nums.forEach(function (n) {
      var d = self.rawObject(+n);
      if (d && d.Type && d.Type.name === 'ObjStm') jobs.push(+n);
    });
    return jobs.reduce(function (chain, n) {
      return chain.then(function () {
        return self.streamData(n).then(function (data) {
          if (!data) return;
          var dict = self.streams[n].dict;
          var count = self.resolve(dict.N) || 0;
          var first = self.resolve(dict.First) || 0;
          var str = latin1(data);
          var header = str.slice(0, first).trim().split(/\s+/);
          for (var k = 0; k < count; k++) {
            var onum = parseInt(header[k * 2], 10);
            var off = parseInt(header[k * 2 + 1], 10);
            if (isNaN(onum) || isNaN(off)) continue;
            if (self.objs[onum]) continue;   // อ็อบเจกต์ปกติมาก่อน
            var v = readValue(str, first + off).v;
            self.cache[onum] = v;
            self.objs[onum] = { start: -1 };
          }
        }).catch(function () { /* ข้าม stream ที่เสีย */ });
      });
    }, Promise.resolve());
  };

  /** ไล่ต้นไม้หน้ากระดาษเพื่อให้ได้ลำดับหน้าที่ถูกต้อง */
  PdfDoc.prototype.pages = function () {
    var self = this;
    var out = [];

    function walk(nodeRef, inherited, depth) {
      if (depth > 64) return;
      var node = self.resolve(nodeRef);
      if (!node || typeof node !== 'object') return;
      var inh = {
        Resources: node.Resources !== undefined ? node.Resources : inherited.Resources
      };
      var type = node.Type && node.Type.name;
      if (type === 'Page') { out.push({ dict: node, inherited: inh }); return; }
      var kids = self.resolve(node.Kids);
      if (Array.isArray(kids)) {
        kids.forEach(function (k) { walk(k, inh, depth + 1); });
      } else if (type !== 'Pages' && node.Contents) {
        out.push({ dict: node, inherited: inh });
      }
    }

    // หา Catalog
    var rootRef = null;
    for (var n in this.objs) {
      var d = this.rawObject(+n);
      if (d && d.Type && d.Type.name === 'Catalog' && d.Pages) { rootRef = d.Pages; break; }
    }
    if (rootRef) walk(rootRef, {}, 0);

    // สำรอง: ไล่ตามหมายเลขอ็อบเจกต์
    if (!out.length) {
      Object.keys(this.objs).map(Number).sort(function (a, b) { return a - b; }).forEach(function (n) {
        var d = self.rawObject(n);
        if (d && d.Type && d.Type.name === 'Page') out.push({ dict: d, inherited: {} });
      });
    }
    return out;
  };

  /* ==================================================================
   * ตาราง ToUnicode (แปลงรหัสในฟอนต์ -> ตัวอักษรจริง)
   * ================================================================== */

  function parseToUnicode(text) {
    var map = {};
    var codeLen = 0;

    var csr = /begincodespacerange([\s\S]*?)endcodespacerange/g, mm;
    while ((mm = csr.exec(text))) {
      var pair = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/.exec(mm[1]);
      if (pair) codeLen = Math.max(codeLen, pair[1].length / 2);
    }

    function hexToStr(h) {
      var s = '';
      for (var i = 0; i + 3 < h.length + 1 && i < h.length; i += 4) {
        s += String.fromCharCode(parseInt(h.substr(i, 4), 16));
      }
      return s;
    }

    var bfc = /beginbfchar([\s\S]*?)endbfchar/g;
    while ((mm = bfc.exec(text))) {
      var re = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g, e;
      while ((e = re.exec(mm[1]))) {
        map[parseInt(e[1], 16)] = hexToStr(e[2]);
        codeLen = Math.max(codeLen, e[1].length / 2);
      }
    }

    var bfr = /beginbfrange([\s\S]*?)endbfrange/g;
    while ((mm = bfr.exec(text))) {
      var body = mm[1];
      var reArr = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[([\s\S]*?)\]/g, a;
      while ((a = reArr.exec(body))) {
        var lo = parseInt(a[1], 16);
        var items = a[3].match(/<([0-9A-Fa-f]*)>/g) || [];
        items.forEach(function (it, k) { map[lo + k] = hexToStr(it.slice(1, -1)); });
        codeLen = Math.max(codeLen, a[1].length / 2);
      }
      var reRng = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g, b;
      while ((b = reRng.exec(body))) {
        var lo2 = parseInt(b[1], 16), hi2 = parseInt(b[2], 16);
        var dst = b[3];
        var base = parseInt(dst.slice(-4), 16);
        var prefix = dst.slice(0, -4);
        if (hi2 - lo2 > 65535) continue;
        for (var c = lo2; c <= hi2; c++) {
          map[c] = hexToStr(prefix) + String.fromCharCode(base + (c - lo2));
        }
        codeLen = Math.max(codeLen, b[1].length / 2);
      }
    }
    return { map: map, codeLen: codeLen || 1 };
  }

  /**
   * อ่านความกว้างจริงของแต่ละกลิฟจากฟอนต์
   *
   * ต้องใช้ค่านี้เพื่อรู้ว่าตัวอักษรตัวหนึ่งจบที่ตำแหน่งใด
   * มิฉะนั้นจะแยกไม่ออกว่า "ช่องว่างกว้าง" คือขอบคอลัมน์ของตาราง
   * หรือเป็นเพียงข้อความยาว ๆ ที่ตามมา
   * หน่วยเป็น 1/1000 ของขนาดตัวอักษร ตามข้อกำหนดของ PDF
   */
  function readWidths(doc, f, isType0, out) {
    out.widths = {};
    out.defaultWidth = null;
    try {
      if (isType0) {
        var desc = doc.resolve(f.DescendantFonts);
        var df = doc.resolve(Array.isArray(desc) ? desc[0] : desc);
        if (!df) return;
        if (typeof df.DW === 'number') out.defaultWidth = df.DW;
        var W = doc.resolve(df.W);
        if (!Array.isArray(W)) return;
        for (var i = 0; i < W.length; i++) {
          var a = doc.resolve(W[i]), b = doc.resolve(W[i + 1]);
          if (Array.isArray(b)) {                     // รูปแบบ: เริ่ม [w1 w2 ...]
            for (var j = 0; j < b.length; j++) out.widths[a + j] = doc.resolve(b[j]);
            i++;
          } else if (typeof b === 'number') {         // รูปแบบ: เริ่ม จบ ความกว้าง
            var w = doc.resolve(W[i + 2]);
            if (typeof w !== 'number' || b - a > 65535) { i++; continue; }
            for (var c = a; c <= b; c++) out.widths[c] = w;
            i += 2;
          }
        }
      } else {
        var first = doc.resolve(f.FirstChar);
        var arr = doc.resolve(f.Widths);
        if (!Array.isArray(arr) || typeof first !== 'number') return;
        for (var k = 0; k < arr.length; k++) {
          var v = doc.resolve(arr[k]);
          if (typeof v === 'number') out.widths[first + k] = v;
        }
      }
    } catch (e) { /* ไม่มีข้อมูลความกว้าง จะใช้ค่าประมาณแทน */ }
  }

  /**
   * แก้ตาราง ToUnicode ที่ Word สร้างผิดสำหรับสระอำ
   *
   * Word วาด "ำ" เป็นสองกลิฟ คือ นิคหิต + สระอา แต่ตัวย่อฟอนต์ (subset)
   * มักใส่ตารางว่ากลิฟสระอาคือ "ำ" ทำให้ "การ" ถูกอ่านเป็น "กำร"
   * สังเกตได้จาก: ฟอนต์มีรายการ "ำ" แต่ไม่มี "า" เลย ซึ่งเป็นไปไม่ได้ในข้อความไทยจริง
   * (สระอาพบบ่อยกว่าสระอำมาก) เมื่อเจอรูปแบบนี้จึงแก้กลับเป็นสระอา
   * แล้วปล่อยให้ cleanThai ประกอบนิคหิตกลับเป็นสระอำตามบริบท
   */
  function fixThaiSaraAm(map) {
    var hasAm = false, hasAa = false;
    for (var k in map) {
      if (map[k].indexOf('ำ') >= 0) hasAm = true;
      if (map[k].indexOf('า') >= 0) hasAa = true;
    }
    if (hasAm && !hasAa) {
      for (var j in map) map[j] = map[j].replace(/ำ/g, 'า');
    }
  }

  /** โหลดฟอนต์ทั้งหมดของหน้าหนึ่ง */
  function loadFonts(doc, resources) {
    var res = doc.resolve(resources);
    var fontsDict = res && doc.resolve(res.Font);
    var fonts = {};
    if (!fontsDict) return Promise.resolve(fonts);

    var names = Object.keys(fontsDict);
    return names.reduce(function (chain, nm) {
      return chain.then(function () {
        var f = doc.resolve(fontsDict[nm]);
        if (!f) return;
        var isType0 = f.Subtype && f.Subtype.name === 'Type0';
        fonts[nm] = { codeLen: isType0 ? 2 : 1, map: null };
        readWidths(doc, f, isType0, fonts[nm]);

        var tu = f.ToUnicode;
        if (!tu || typeof tu.ref !== 'number') return;
        return doc.streamData(tu.ref).then(function (d) {
          if (!d) return;
          var parsed = parseToUnicode(latin1(d));
          fixThaiSaraAm(parsed.map);
          fonts[nm].map = parsed.map;
          fonts[nm].codeLen = parsed.codeLen || fonts[nm].codeLen;
        }).catch(function () { /* ฟอนต์นี้แปลงไม่ได้ */ });
      });
    }, Promise.resolve()).then(function () { return fonts; });
  }

  /**
   * วัดความกว้างของสตริง หน่วยเป็นเท่าของขนาดตัวอักษร (em)
   * คืน null ถ้าฟอนต์ไม่มีข้อมูลความกว้าง เพื่อให้ผู้เรียกใช้ค่าประมาณแทน
   */
  function measureBytes(bytes, font) {
    if (!font || !font.widths) return null;
    var total = 0, len = font.codeLen || 1, any = false;
    for (var i = 0; i < bytes.length; i += len) {
      var code = 0;
      for (var k = 0; k < len && i + k < bytes.length; k++) code = (code << 8) | bytes[i + k];
      var w = font.widths[code];
      if (w == null) w = font.defaultWidth;
      if (w == null) return null;
      any = true;
      total += w;
    }
    return any ? total / 1000 : 0;
  }

  /* ==================================================================
   * ดึงข้อความจาก content stream
   * ================================================================== */

  // เครื่องหมายแทนกลิฟที่ตาราง ToUnicode ไม่ได้บอกไว้ (ใช้ชั่วคราวก่อนเก็บกวาด)
  var UNKNOWN = '￼';

  function decodeBytes(bytes, font) {
    if (!font) return bytes.map(function (b) { return String.fromCharCode(b); }).join('');
    var out = '', len = font.codeLen || 1;
    for (var i = 0; i < bytes.length; i += len) {
      var code = 0;
      for (var k = 0; k < len && i + k < bytes.length; k++) code = (code << 8) | bytes[i + k];
      if (font.map && font.map[code] != null) out += font.map[code];
      else if (len === 1) out += String.fromCharCode(code);
      else out += UNKNOWN;   // เก็บตำแหน่งไว้ เผื่อเป็นนิคหิตของสระอำ
    }
    return out;
  }

  function extractFromContent(content, fonts) {
    var items = [];
    var s = content;
    var stack = [];
    var tm = [1, 0, 0, 1, 0, 0], tlm = tm.slice();
    var leading = 0, font = null, fontSize = 1;

    function mul(m, n) {
      return [
        m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
        m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
        m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]
      ];
    }
    function td(tx, ty) { tlm = mul([1, 0, 0, 1, tx, ty], tlm); tm = tlm.slice(); }
    function show(text, ems) {
      if (!text) return;
      // ขนาดตัวอักษรจริงบนหน้ากระดาษ = ขนาดฟอนต์ × สเกลของเมทริกซ์
      var scale = Math.sqrt(tm[0] * tm[0] + tm[1] * tm[1]) || 1;
      var size = Math.abs(fontSize * scale) || 10;
      items.push({ x: tm[4], y: tm[5], t: text, size: size, w: ems == null ? null : ems * size });
    }

    var i = 0;
    while (i < s.length) {
      i = skipWs(s, i);
      if (i >= s.length) break;
      var c = s[i];

      if (c === '(' || c === '<' || c === '[' || c === '/' ||
          (c >= '0' && c <= '9') || c === '-' || c === '+' || c === '.') {
        if (c === '<' && s[i + 1] === '<') {
          var d = readValue(s, i); stack.push(d.v); i = d.i; continue;
        }
        var r = readValue(s, i);
        if (r.i === i) { i++; continue; }
        stack.push(r.v);
        i = r.i;
        continue;
      }

      // ตัวดำเนินการ
      var opStart = i;
      while (i < s.length && !isWs(s[i]) && !isDelim(s[i])) i++;
      var op = s.slice(opStart, i);
      if (!op) { i++; continue; }

      switch (op) {
        case 'BT': tm = [1, 0, 0, 1, 0, 0]; tlm = tm.slice(); break;
        case 'Tf':
          fontSize = num(stack[stack.length - 1]) || 1;
          var fn = stack[stack.length - 2];
          font = (fn && fn.name && fonts[fn.name]) || null;
          break;
        case 'TL': leading = num(stack[stack.length - 1]) || 0; break;
        case 'Td': td(num(stack[stack.length - 2]), num(stack[stack.length - 1])); break;
        case 'TD':
          leading = -num(stack[stack.length - 1]);
          td(num(stack[stack.length - 2]), num(stack[stack.length - 1]));
          break;
        case 'Tm':
          tlm = [num(stack[stack.length - 6]), num(stack[stack.length - 5]),
                 num(stack[stack.length - 4]), num(stack[stack.length - 3]),
                 num(stack[stack.length - 2]), num(stack[stack.length - 1])];
          tm = tlm.slice();
          break;
        case 'T*': td(0, -leading); break;
        case 'Tj': show(strOf(stack[stack.length - 1], font), emsOf(stack[stack.length - 1], font)); break;
        case "'": td(0, -leading); show(strOf(stack[stack.length - 1], font), emsOf(stack[stack.length - 1], font)); break;
        case '"': td(0, -leading); show(strOf(stack[stack.length - 1], font), emsOf(stack[stack.length - 1], font)); break;
        case 'TJ':
          var arr = stack[stack.length - 1];
          if (Array.isArray(arr)) {
            var buf = '', ems = 0, known = true;
            arr.forEach(function (el) {
              if (typeof el === 'number') {
                // ระยะห่างมาก = ช่องว่าง (ค่าติดลบคือเลื่อนไปข้างหน้า)
                if (el < -180) buf += ' ';
                ems -= el / 1000;
              } else {
                buf += strOf(el, font);
                var e = emsOf(el, font);
                if (e == null) known = false; else ems += e;
              }
            });
            show(buf, known ? ems : null);
          }
          break;
      }
      stack.length = 0;
    }

    function num(v) { return typeof v === 'number' ? v : 0; }
    function strOf(v, f) { return (v && v.str) ? decodeBytes(v.str, f) : ''; }
    /** ความกว้างของสตริง หน่วยเป็นเท่าของขนาดตัวอักษร (em) */
    function emsOf(v, f) { return (v && v.str) ? measureBytes(v.str, f) : 0; }

    return items;
  }

  /* เครื่องหมายไทยที่ไม่มีความกว้าง (สระบน/ล่าง วรรณยุกต์) — ห้ามมีช่องว่างนำหน้า */
  var THAI_MARK = /[ัำ-ฺ็-๎]/;
  var THAI_ANY = /[฀-๿]/;

  /**
   * เรียงชิ้นข้อความให้เป็นบรรทัด
   *
   * PDF วางตัวอักษรทีละกลุ่ม โดยเฉพาะภาษาไทยที่แยกสระ/วรรณยุกต์เป็นคนละชิ้น
   * จึงต้องประเมินความกว้างของชิ้นก่อนหน้า แล้วจึงตัดสินว่าช่องว่างจริงหรือไม่
   * ถ้าเดาผิดทางฝั่ง "ใส่ช่องว่างเกิน" จะทำให้คำไทยขาดกลางคำ ซึ่งแย่กว่าการขาดช่องว่าง
   * โค้ดนี้จึงตั้งเกณฑ์ไว้เข้มงวด (ยอมพลาดช่องว่างดีกว่าแทรกผิด)
   */
  function itemsToLines(items) {
    if (!items.length) return [];

    // จัดเข้าบรรทัดตามพิกัด y โดย "คงลำดับเดิมในสตรีม" ไว้
    // (ห้ามเรียงตาม x เพราะสระ/วรรณยุกต์ไทยถูกวางที่พิกัดใกล้เคียงกับพยัญชนะตัวถัดไป
    //  การเรียงตาม x จะสลับ "วัสดุ" เป็น "วสัดุ")
    var lines = [];
    items.forEach(function (it) {
      var line = null;
      for (var i = lines.length - 1; i >= 0 && i >= lines.length - 4; i--) {
        if (Math.abs(it.y - lines[i].y) <= 2.5) { line = lines[i]; break; }
      }
      if (!line) { line = { y: it.y, items: [] }; lines.push(line); }
      line.items.push(it);
    });

    lines.sort(function (a, b) { return b.y - a.y; });

    return lines.map(function (l) {
      // แต่ละบรรทัดแบ่งเป็น "ช่วง" (segment) ตามระยะห่างที่กว้างผิดปกติ
      // ช่วงเหล่านี้คือช่องตารางที่เป็นไปได้ พร้อมขอบซ้าย-ขวาจริงของข้อความ
      var segs = [], cur = null, maxEnd = null;
      l.items.forEach(function (it) {
        var end = it.x + (it.w != null ? it.w : estimateWidth(it.t, it.size));
        if (maxEnd != null && cur) {
          var gap = it.x - maxEnd;
          var joined = cur.parts.join('');
          // เครื่องหมายไทยไม่มีความกว้าง ห้ามแทรกช่องว่างนำหน้าเด็ดขาด
          var markFollows = THAI_MARK.test(it.t.charAt(0));
          // ช่องว่างกว้างผิดปกติ = ขอบช่องตาราง (PDF ไม่ได้บอกว่าอะไรเป็นตาราง
          // จึงต้องเดาจากระยะห่าง) เว้นวรรคปกติถูกเก็บเป็นตัวอักษรในสตริงอยู่แล้ว
          // ไม่โผล่มาเป็นระยะห่าง ระยะห่างเกิน 1 เท่าของขนาดตัวอักษร
          // จึงมาจากการกระโดดตำแหน่ง = ขอบช่องตาราง
          if (!markFollows && joined) {
            if (it.w != null && gap > it.size) cur = null;
            else if (gap > it.size * 0.4 && !/\s$/.test(joined)) cur.parts.push(' ');
          }
        }
        if (!cur) { cur = { x: it.x, right: end, parts: [] }; segs.push(cur); }
        cur.parts.push(it.t);
        // สระ/วรรณยุกต์วางย้อนกลับได้ จึงใช้ขอบขวาสุดที่เคยไปถึง
        cur.right = Math.max(cur.right, end);
        maxEnd = maxEnd == null ? end : Math.max(maxEnd, end);
      });
      segs.forEach(function (s) { s.text = cleanThai(s.parts.join('')); });
      segs = segs.filter(function (s) { return s.text.length; });
      return { y: l.y, segs: segs, text: segs.map(function (s) { return s.text; }).join('\t') };
    }).filter(function (l) { return l.segs.length; });
  }

  /**
   * หาเส้นแบ่งคอลัมน์จาก "แถบช่องว่างแนวตั้ง"
   *
   * ใช้ขอบซ้ายของข้อความเทียบกันไม่ได้ เพราะข้อความในช่องตารางมักจัดกึ่งกลาง
   * ขอบซ้ายจึงไม่ตรงกันสักแถว วิธีที่ถูกคือหาช่วงแนวนอนที่ "ไม่มีข้อความเลย"
   * ตลอดทั้งตาราง ช่วงเหล่านั้นคือเส้นแบ่งคอลัมน์
   */
  function detectColumns(rows) {
    var minX = Infinity, maxX = -Infinity;
    rows.forEach(function (r) {
      r.segs.forEach(function (s) {
        if (s.x < minX) minX = s.x;
        if (s.right > maxX) maxX = s.right;
      });
    });
    if (!isFinite(minX) || maxX <= minX) return [];

    var n = Math.ceil(maxX - minX) + 1;
    var occupied = new Uint8Array(n);
    rows.forEach(function (r) {
      r.segs.forEach(function (s) {
        var a = Math.max(0, Math.floor(s.x - minX));
        var b = Math.min(n, Math.ceil(s.right - minX));
        for (var i = a; i < b; i++) occupied[i] = 1;
      });
    });

    var seps = [], run = 0;
    for (var i = 0; i <= n; i++) {
      if (i < n && !occupied[i]) { run++; continue; }
      // ช่วงข้อความถูกตัดที่ระยะห่างมากกว่า 1 เท่าของตัวอักษรอยู่แล้ว
      // ช่องว่างเล็ก ๆ ที่เหลือจึงเกิดจากเซลล์ของคนละแถวเกือบชนกัน ไม่ใช่ช่องว่างในคำ
      if (run >= 5) seps.push(minX + i - run / 2);
      run = 0;
    }
    return seps;
  }

  /** ช่วงข้อความนี้อยู่คอลัมน์ที่เท่าไร (นับเส้นแบ่งที่อยู่ทางซ้ายของมัน) */
  function colIndex(seps, x) {
    var i = 0;
    while (i < seps.length && seps[i] < x) i++;
    return i;
  }

  /**
   * ประกอบช่องตารางที่ถูกตัดขึ้นบรรทัดใหม่กลับเข้าแถวเดิม
   *
   * ในตาราง ช่องที่ข้อความยาวจะถูกตัดเป็นหลายบรรทัด PDF เก็บแต่ละบรรทัดแยกกัน
   * บรรทัดต่อเนื่องเหล่านี้จะมีคอลัมน์เดียว ทำให้แถวตารางขาดเป็นท่อน ๆ
   * จึงต้องดูจากพิกัดแนวนอนว่าบรรทัดนั้นอยู่ในคอลัมน์ไหน แล้วต่อกลับเข้าเซลล์เดิม
   */
  function mergeWrappedCells(lines) {
    var NEAR = 50;      // ระยะแนวตั้งที่ยังถือว่าอยู่ในตารางเดียวกัน (pt)

    var multi = lines.filter(function (l) { return l.segs.length >= 2; });
    if (!multi.length) return lines;

    // แบ่งเป็น "เขตตาราง" ทีละตาราง เพราะแต่ละตารางมีเส้นแบ่งคอลัมน์คนละชุด
    // ถ้ารวมทุกตารางเข้าด้วยกัน คอลัมน์จะปนกันจนแถวเพี้ยน
    var zones = [];
    multi.forEach(function (l) {
      var z = zones[zones.length - 1];
      if (z && Math.abs(z.rows[z.rows.length - 1].y - l.y) <= NEAR) z.rows.push(l);
      else zones.push({ rows: [l] });
    });

    zones.forEach(function (z) {
      // ถ้าทุกแถวมีจำนวนช่องเท่ากัน แปลว่าไม่มีช่องว่าง เชื่อลำดับการอ่านได้เลย
      // (ข้อความที่จัดกึ่งกลางจะมีขอบซ้ายไม่ตรงกันทุกแถว การเดาจากพิกัดจะแตกคอลัมน์เกิน)
      var same = z.rows.every(function (l) { return l.segs.length === z.rows[0].segs.length; });
      z.seps = same && z.rows[0].segs.length >= 2 ? null : detectColumns(z.rows);
      z.top = z.rows[0].y;
      z.bottom = z.rows[z.rows.length - 1].y;
      // ระยะห่างระหว่างแถว ใช้ตัดสินว่าบรรทัดเดี่ยวเป็น "ส่วนต่อของเซลล์" หรือ
      // เป็นหัวข้อ/ย่อหน้าที่อยู่นอกตาราง (ส่วนต่อของเซลล์จะชิดกว่าระยะแถวมาก)
      var gaps = [];
      for (var g = 1; g < z.rows.length; g++) gaps.push(z.rows[g - 1].y - z.rows[g].y);
      gaps.sort(function (a, b) { return a - b; });
      z.absorb = gaps.length ? gaps[Math.floor(gaps.length / 2)] * 0.7 : 18;
      // จัดแต่ละแถวให้ช่องตรงคอลัมน์จริง (แถวที่คอลัมน์แรกว่างจะได้ไม่เลื่อน)
      z.rows.forEach(function (l) {
        if (!z.seps) {
          l.cells = l.segs.map(function (s) { return s.text; });
          return;
        }
        l.cells = [];
        for (var i = 0; i <= z.seps.length; i++) l.cells.push('');
        l.segs.forEach(function (s) {
          var ci = colIndex(z.seps, s.x);
          l.cells[ci] = l.cells[ci] ? l.cells[ci] + ' ' + s.text : s.text;
        });
      });
    });

    var used = [];
    lines.forEach(function (l, idx) {
      if (l.segs.length !== 1) return;
      var seg = l.segs[0];

      // หาเขตตารางที่บรรทัดนี้อยู่ในระยะ
      var z = null;
      for (var i = 0; i < zones.length; i++) {
        if (l.y <= zones[i].top + NEAR && l.y >= zones[i].bottom - NEAR) { z = zones[i]; break; }
      }
      if (!z || !z.seps || !z.seps.length) return;

      // ต้องอยู่ในคอลัมน์เดียวพอดี ถ้าข้อความคร่อมเส้นแบ่ง แสดงว่าเป็นย่อหน้าปกติ
      var ci = colIndex(z.seps, seg.x);
      if (ci < z.seps.length && seg.right > z.seps[ci]) return;

      // ต่อเข้ากับแถวที่ใกล้ที่สุดในแนวตั้ง
      var best = null, bestD = Infinity;
      z.rows.forEach(function (m) {
        var d = Math.abs(m.y - l.y);
        if (d < bestD) { bestD = d; best = m; }
      });
      if (!best || bestD > z.absorb) return;

      // บรรทัดที่อยู่สูงกว่า คือส่วนต้นของข้อความในเซลล์
      best.cells[ci] = l.y > best.y ? (seg.text + best.cells[ci]).trim()
                                    : (best.cells[ci] + seg.text).trim();
      used[idx] = true;
    });

    zones.forEach(function (z) {
      z.rows.forEach(function (l) { l.text = l.cells.join('\t'); });
    });
    return lines.filter(function (l, idx) { return !used[idx]; });
  }

  function estimateWidth(text, size) {
    var w = 0;
    for (var i = 0; i < text.length; i++) {
      w += THAI_MARK.test(text[i]) ? 0 : 0.5;
    }
    return w * size;
  }

  /**
   * เก็บกวาดผลลัพธ์ภาษาไทย
   *
   * Word ส่งออก PDF โดยแยก "ำ" ออกเป็นนิคหิต + สระอา สองกลิฟ และตาราง ToUnicode
   * ของฟอนต์ย่อยมักไม่ครบ ทำให้นิคหิตหายไปหรือสระอาถูกแปลงเป็น ำ ผิด ๆ
   * ฟังก์ชันนี้ประกอบกลับตามรูปแบบที่พบจริง
   */
  function cleanThai(s) {
    return s
      // กลิฟนิคหิตที่ตาราง ToUnicode แปลงเป็น "ช่องว่าง" หรือแปลงไม่ได้
      // ภาษาไทยไม่มีทางเว้นวรรคก่อนสระอา ช่องว่างตรงนี้จึงคือนิคหิตเสมอ
      .replace(new RegExp('([ก-ฮ][่-๋]?)(?:[ \\t]|' + UNKNOWN + ')+(?=า)', 'g'), '$1ํ')
      // นิคหิต + สระอา = สระอำ
      .replace(/ํ\s*า/g, 'ำ')
      // กลิฟที่แปลงไม่ได้ คั่นระหว่างพยัญชนะกับสระอา -> เกือบทั้งหมดคือนิคหิตของ "ำ"
      .replace(new RegExp('([ก-ฮ][่-๋]?)' + UNKNOWN + '\\s*า', 'g'), '$1ำ')
      // กลิฟที่แปลงไม่ได้ ตามด้วยสระอำ (ฟอนต์ตัวหนาที่ map ผิด) -> ตัดตัวซ้ำทิ้ง
      .replace(new RegExp(UNKNOWN + '\\s*(?=ำ)', 'g'), '')
      .replace(new RegExp(UNKNOWN, 'g'), '')
      // ลบช่องว่างที่คั่นระหว่างตัวอักษรไทยกับเครื่องหมายไทย
      .replace(/([฀-๿])[ ]+([ัำ-ฺ็-๎])/g, '$1$2')
      // เก็บแท็บไว้ (เป็นตัวคั่นคอลัมน์ของตาราง) ยุบเฉพาะช่องว่างธรรมดา
      .replace(/ {2,}/g, ' ')
      .replace(/[ ]*\t[ \t]*/g, '\t')
      .replace(/^[ \t]+|[ \t]+$/g, '');
  }

  /* ==================================================================
   * API: อ่าน PDF
   * ================================================================== */

  function readPdf(buf) {
    var u8 = new Uint8Array(buf);
    var head = latin1(u8, 0, Math.min(1024, u8.length));
    if (head.indexOf('%PDF') < 0) throw new Error('ไฟล์นี้ไม่ใช่ PDF');

    var doc = new PdfDoc(u8);
    doc.scan();

    // ตรวจการเข้ารหัส
    var encrypted = false;
    for (var n in doc.objs) {
      var d = doc.rawObject(+n);
      if (d && d.Filter && d.Filter.name && d.O && d.U) { encrypted = true; break; }
    }
    if (encrypted) throw new Error('PDF นี้ถูกเข้ารหัส/ใส่รหัสผ่านไว้ จึงอ่านข้อความไม่ได้');

    return doc.expandObjectStreams().then(function () {
      var pages = doc.pages();
      if (!pages.length) throw new Error('อ่านโครงสร้างหน้ากระดาษไม่ได้');

      var pageTexts = [];
      return pages.reduce(function (chain, pg, idx) {
        return chain.then(function () {
          var resources = pg.dict.Resources !== undefined ? pg.dict.Resources : pg.inherited.Resources;
          return loadFonts(doc, resources).then(function (fonts) {
            var contents = pg.dict.Contents;
            var refs = [];
            var resolved = doc.resolve(contents);
            if (Array.isArray(resolved)) {
              (contents.ref ? resolved : contents).forEach(function (c) {
                if (c && typeof c.ref === 'number') refs.push(c.ref);
              });
            } else if (contents && typeof contents.ref === 'number') {
              refs.push(contents.ref);
            }
            return refs.reduce(function (c2, r) {
              return c2.then(function (acc) {
                return doc.streamData(r).then(function (d) {
                  return acc + (d ? latin1(d) : '');
                }).catch(function () { return acc; });
              });
            }, Promise.resolve('')).then(function (content) {
              if (!content) { pageTexts.push(''); return; }
              var items = extractFromContent(content, fonts);
              var lines = mergeWrappedCells(itemsToLines(items));
              pageTexts.push(lines.map(function (l) { return l.text; }).join('\n'));
            });
          });
        }).catch(function () { pageTexts.push(''); });
      }, Promise.resolve()).then(function () {
        var text = pageTexts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
        var warning = '';
        if (!text) {
          throw new Error('ไม่พบชั้นข้อความใน PDF นี้ — น่าจะเป็นไฟล์สแกนเป็นภาพ ' +
                          'ต้องแปลงเป็นข้อความด้วยโปรแกรม OCR ก่อน');
        }
        if (/[�]/.test(text)) {
          warning = 'บางตัวอักษรใน PDF นี้แปลงไม่ได้ กรุณาตรวจทานให้ละเอียด';
        } else {
          // PDF เก็บแต่ตำแหน่งตัวอักษร ไม่ได้เก็บว่าอะไรเป็นตาราง
          // ช่องตารางที่ข้อความยาวเกินความกว้างจะถูกตัดเป็นหลายบรรทัด
          warning = 'ดึงข้อความจาก PDF แล้ว — ตารางอาจตกบรรทัด กรุณาตรวจทาน ' +
                    '(ถ้ามีไฟล์ .docx ให้ใช้ .docx จะตรงกว่า)';
        }
        return { text: text, pages: pages.length, warning: warning };
      });
    });
  }

  /* ==================================================================
   * API: อ่าน .docx
   * ================================================================== */

  function readDocx(buf) {
    var u8 = new Uint8Array(buf);
    var dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (dv.getUint32(0, true) !== 0x04034b50) throw new Error('ไฟล์นี้ไม่ใช่ .docx');

    var off = 0, target = null, dec = new TextDecoder();
    while (off + 30 <= u8.length && dv.getUint32(off, true) === 0x04034b50) {
      var method = dv.getUint16(off + 8, true);
      var csize = dv.getUint32(off + 18, true);
      var nlen = dv.getUint16(off + 26, true), elen = dv.getUint16(off + 28, true);
      var name = dec.decode(u8.subarray(off + 30, off + 30 + nlen));
      var dataAt = off + 30 + nlen + elen;
      if (name === 'word/document.xml') { target = { method: method, data: u8.subarray(dataAt, dataAt + csize) }; break; }
      off = dataAt + csize;
    }
    if (!target) throw new Error('อ่านเนื้อหาในไฟล์ Word ไม่ได้');

    var xmlP = target.method === 8 ? decompress(target.data, 'deflate-raw')
                                   : Promise.resolve(target.data);
    return xmlP.then(function (d) {
      var xml = new TextDecoder().decode(d);
      var bm = xml.match(/<w:body[^>]*>([\s\S]*)<\/w:body>/);
      var text = walkBody(bm ? bm[1] : xml);
      if (!text) throw new Error('ไฟล์ Word นี้ไม่มีข้อความ');
      return { text: text, pages: 0, warning: '' };
    });
  }

  function unescapeXml(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); })
      .replace(/&amp;/g, '&');
  }

  /**
   * เดินอ่านเนื้อหา Word ตามลำดับจริง
   *
   * สำคัญ: ต้องแปลง <w:tbl> เป็นบรรทัดที่คั่นช่องด้วยแท็บ
   * เพราะตัวแยกวิเคราะห์ของโปรแกรมรู้จักตารางจากแท็บ
   * ถ้าอ่านแค่ <w:p> เฉย ๆ ทุกช่องจะกลายเป็นบรรทัดเดี่ยว ตารางจะหายไป
   */
  function walkBody(s) {
    var TAG = /<w:tbl[ >]|<\/w:tbl>|<w:tr[ >]|<\/w:tr>|<w:tc[ >]|<\/w:tc>|<w:p[ >]|<\/w:p>|<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:(?:br|cr)\s*\/>/g;
    var lines = [], row = null, cell = null, para = null, m;

    while ((m = TAG.exec(s))) {
      var tag = m[0];
      if (m[1] !== undefined) {                       // <w:t>ข้อความ</w:t>
        if (para) para.push(unescapeXml(m[1]));
      } else if (tag.indexOf('<w:tbl') === 0) {
        lines.push('');                               // เว้นบรรทัดก่อนตาราง
      } else if (tag === '</w:tbl>') {
        lines.push('');                               // เว้นบรรทัดหลังตาราง
      } else if (tag.indexOf('<w:tr') === 0) {
        row = [];
      } else if (tag === '</w:tr>') {
        if (row && row.length) lines.push(row.join('\t'));
        row = null;
      } else if (tag.indexOf('<w:tc') === 0) {
        cell = [];
      } else if (tag === '</w:tc>') {
        if (row) row.push(cell ? cell.join(' ').trim() : '');
        cell = null;
      } else if (tag.indexOf('<w:p') === 0) {
        para = [];
      } else if (tag === '</w:p>') {
        var t = para ? para.join('') : '';
        if (cell) cell.push(t); else lines.push(t);
        para = null;
      } else if (tag.indexOf('<w:tab') === 0) {
        // แท็บในช่องตารางจะทำให้จำนวนช่องเพี้ยน จึงแทนด้วยช่องว่าง
        if (para) para.push(cell ? ' ' : '\t');
      } else {                                        // <w:br/> หรือ <w:cr/>
        if (para) para.push(cell ? ' ' : '\n');
      }
    }
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /* ==================================================================
   * API หลัก
   * ================================================================== */

  /**
   * อ่านไฟล์แล้วคืนข้อความ
   * @param {File} file
   * @returns {Promise<{text, kind, pages, warning}>}
   */
  function readFile(file) {
    var name = (file.name || '').toLowerCase();
    if (file.size > 40 * 1024 * 1024) {
      return Promise.reject(new Error('ไฟล์ใหญ่เกิน 40 MB'));
    }

    if (/\.txt$|\.md$/.test(name)) {
      return file.text().then(function (t) {
        return { text: t.trim(), kind: 'text', pages: 0, warning: '' };
      });
    }

    return file.arrayBuffer().then(function (buf) {
      if (/\.docx$/.test(name)) {
        return Promise.resolve().then(function () { return readDocx(buf); })
          .then(function (r) { r.kind = 'word'; return r; });
      }
      if (/\.pdf$/.test(name)) {
        return Promise.resolve().then(function () { return readPdf(buf); })
          .then(function (r) { r.kind = 'pdf'; return r; });
      }
      if (/\.doc$/.test(name)) {
        throw new Error('ไฟล์ .doc รุ่นเก่ายังไม่รองรับ — เปิดใน Word แล้ว "บันทึกเป็น" .docx หรือ PDF ก่อน');
      }
      throw new Error('รองรับเฉพาะไฟล์ .pdf .docx .txt');
    });
  }

  return {
    readFile: readFile,
    readPdf: readPdf,
    readDocx: readDocx
  };
})();
