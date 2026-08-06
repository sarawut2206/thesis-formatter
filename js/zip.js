/*!
 * zip.js — ตัวสร้างไฟล์ ZIP ขนาดเล็ก ไม่พึ่งไลบรารีภายนอก
 * ใช้สำหรับประกอบไฟล์ .docx (ซึ่งก็คือ ZIP ที่บรรจุ XML)
 *
 * รองรับการบีบอัดด้วย CompressionStream('deflate-raw') ถ้าเบราว์เซอร์รองรับ
 * ถ้าไม่รองรับจะเก็บแบบไม่บีบอัด (STORE) ซึ่ง Word เปิดได้ตามปกติ
 */
var TFZip = (function () {
  'use strict';

  // ---------- CRC32 ----------
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(u8) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // ---------- utils ----------
  var encoder = new TextEncoder();

  function toBytes(data) {
    if (typeof data === 'string') return encoder.encode(data);
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    throw new Error('zip: unsupported data type');
  }

  function deflateRaw(u8) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve(null);
    try {
      var cs = new CompressionStream('deflate-raw');
      var stream = new Blob([u8]).stream().pipeThrough(cs);
      return new Response(stream).arrayBuffer()
        .then(function (buf) { return new Uint8Array(buf); })
        .catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  // เขียนตัวเลขแบบ little-endian ลงใน DataView
  function W(view, off, val, bytes) {
    if (bytes === 2) view.setUint16(off, val, true);
    else view.setUint32(off, val >>> 0, true);
  }

  // เวลาแบบ MS-DOS (ตรึงไว้ที่ 1980-01-01 เพื่อให้ผลลัพธ์เหมือนเดิมทุกครั้ง)
  var DOS_TIME = 0;
  var DOS_DATE = 33; // (1980-1980)<<9 | 1<<5 | 1

  /**
   * สร้างไฟล์ ZIP
   * @param {Array<{name:string, data:(string|Uint8Array), store?:boolean}>} entries
   * @returns {Promise<Blob>}
   */
  function create(entries) {
    var prepared = entries.map(function (e) {
      var raw = toBytes(e.data);
      var name = encoder.encode(e.name);
      if (e.store) return Promise.resolve({ name: name, raw: raw, comp: raw, method: 0 });
      return deflateRaw(raw).then(function (def) {
        if (def && def.length < raw.length) return { name: name, raw: raw, comp: def, method: 8 };
        return { name: name, raw: raw, comp: raw, method: 0 };
      });
    });

    return Promise.all(prepared).then(function (files) {
      var parts = [];
      var central = [];
      var offset = 0;

      files.forEach(function (f) {
        var crc = crc32(f.raw);
        // --- local file header ---
        var lh = new Uint8Array(30 + f.name.length);
        var lv = new DataView(lh.buffer);
        W(lv, 0, 0x04034b50, 4);
        W(lv, 4, 20, 2);          // version needed
        W(lv, 6, 0x0800, 2);      // flag: ชื่อไฟล์เป็น UTF-8
        W(lv, 8, f.method, 2);
        W(lv, 10, DOS_TIME, 2);
        W(lv, 12, DOS_DATE, 2);
        W(lv, 14, crc, 4);
        W(lv, 18, f.comp.length, 4);
        W(lv, 22, f.raw.length, 4);
        W(lv, 26, f.name.length, 2);
        W(lv, 28, 0, 2);
        lh.set(f.name, 30);

        parts.push(lh, f.comp);

        // --- central directory entry ---
        var cd = new Uint8Array(46 + f.name.length);
        var cv = new DataView(cd.buffer);
        W(cv, 0, 0x02014b50, 4);
        W(cv, 4, 20, 2);          // version made by
        W(cv, 6, 20, 2);          // version needed
        W(cv, 8, 0x0800, 2);
        W(cv, 10, f.method, 2);
        W(cv, 12, DOS_TIME, 2);
        W(cv, 14, DOS_DATE, 2);
        W(cv, 16, crc, 4);
        W(cv, 20, f.comp.length, 4);
        W(cv, 24, f.raw.length, 4);
        W(cv, 28, f.name.length, 2);
        W(cv, 30, 0, 2);          // extra len
        W(cv, 32, 0, 2);          // comment len
        W(cv, 34, 0, 2);          // disk number
        W(cv, 36, 0, 2);          // internal attrs
        W(cv, 38, 0, 4);          // external attrs
        W(cv, 42, offset, 4);
        cd.set(f.name, 46);
        central.push(cd);

        offset += lh.length + f.comp.length;
      });

      var cdSize = central.reduce(function (s, c) { return s + c.length; }, 0);
      var eocd = new Uint8Array(22);
      var ev = new DataView(eocd.buffer);
      W(ev, 0, 0x06054b50, 4);
      W(ev, 4, 0, 2);
      W(ev, 6, 0, 2);
      W(ev, 8, files.length, 2);
      W(ev, 10, files.length, 2);
      W(ev, 12, cdSize, 4);
      W(ev, 16, offset, 4);
      W(ev, 20, 0, 2);

      return new Blob(parts.concat(central, [eocd]), {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
    });
  }

  return { create: create, crc32: crc32 };
})();
