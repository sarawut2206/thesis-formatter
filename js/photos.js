/*!
 * photos.js — คลังรูปภาพของงาน (เก็บในเบราว์เซอร์เครื่องนี้)
 *
 * ตัวไฟล์รูปเก็บใน IndexedDB (จุได้มาก) ส่วนขนาดกว้าง×สูงเก็บใน localStorage
 * เพื่อให้ตัวอย่างหน้ากระดาษคำนวณการแบ่งหน้าได้ทันทีโดยไม่ต้องรอโหลดรูป
 *
 * ในข้อความของบท รูปแทนด้วยบรรทัด  [รูป:รหัสรูป]
 */
var TFPhotos = (function () {
  'use strict';

  var DB_NAME = 'project-formatter-photos';
  var STORE = 'photos';
  var META_KEY = 'project-formatter-photo-meta-v1';
  var MAX_SIDE = 1600;     // ย่อรูปจากมือถือให้ไม่เกินนี้ (พอสำหรับพิมพ์ A4)
  var AI_SIDE = 768;       // ขนาดที่ส่งให้ AI ดู

  var meta = loadMeta();
  var urlCache = {};
  var dbPromise = null;

  function loadMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveMeta() {
    try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) { /* เต็ม */ }
  }

  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('เบราว์เซอร์นี้เก็บรูปไม่ได้ (ไม่มี IndexedDB)')); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('เปิดคลังรูปไม่สำเร็จ')); };
    });
    return dbPromise;
  }

  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (resolve, reject) {
        var t = d.transaction(STORE, mode);
        var out = fn(t.objectStore(STORE));
        t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { reject(t.error || new Error('คลังรูปทำงานผิดพลาด')); };
      });
    });
  }

  function newId() {
    var a = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return 'p' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  /** อ่านไฟล์รูป → ย่อขนาด → Blob JPEG */
  function toJpeg(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.max(1, Math.round(img.naturalWidth * k));
        var h = Math.max(1, Math.round(img.naturalHeight * k));
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);   // PNG โปร่งใสให้เป็นพื้นขาว
        g.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) {
          if (b) resolve({ blob: b, w: w, h: h });
          else reject(new Error('แปลงรูปไม่สำเร็จ'));
        }, 'image/jpeg', quality || 0.82);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('อ่านรูป ' + (file.name || '') + ' ไม่ได้ — ลองแปลงเป็น JPG หรือ PNG'));
      };
      img.src = url;
    });
  }

  /** เพิ่มรูปจากไฟล์ที่ผู้ใช้เลือก → { id, w, h, name } */
  function add(file) {
    if (!file || !/^image\//.test(file.type)) return Promise.reject(new Error((file && file.name || 'ไฟล์') + ' ไม่ใช่รูปภาพ'));
    if (file.size > 25 * 1024 * 1024) return Promise.reject(new Error(file.name + ' ใหญ่เกิน 25 MB'));
    return toJpeg(file, MAX_SIDE).then(function (r) {
      var id = newId();
      return tx('readwrite', function (s) { s.put(r.blob, id); }).then(function () {
        meta[id] = { w: r.w, h: r.h, name: file.name || '' };
        saveMeta();
        return { id: id, w: r.w, h: r.h, name: file.name || '' };
      });
    });
  }

  function getBlob(id) {
    return tx('readonly', function (s) { return s.get(id); });
  }

  /** URL สำหรับแสดงรูปในหน้าเว็บ (null ถ้าไม่มีรูปนี้ในเครื่อง) */
  function url(id) {
    if (urlCache[id]) return Promise.resolve(urlCache[id]);
    return getBlob(id).then(function (b) {
      if (!b) return null;
      urlCache[id] = URL.createObjectURL(b);
      return urlCache[id];
    });
  }

  /** ใส่รูปให้ <img> แบบไม่ต้องรอ */
  function attach(img, id) {
    url(id).then(function (u) {
      if (u) img.src = u;
      else img.replaceWith(Object.assign(document.createElement('span'), { className: 'photo-missing', textContent: 'ไม่พบรูปนี้ในเครื่อง' }));
    }).catch(function () { /* ปล่อยว่าง */ });
  }

  function bytes(id) {
    return getBlob(id).then(function (b) {
      if (!b) return null;
      return b.arrayBuffer().then(function (buf) { return new Uint8Array(buf); });
    });
  }

  /** โหลดรูปทั้งหมดที่ใช้ในเอกสาร → { id: { bytes, w, h } } (ใช้ตอนสร้าง .docx) */
  function collect(ids) {
    var uniq = ids.filter(function (id, i) { return id && ids.indexOf(id) === i; });
    var out = {};
    return Promise.all(uniq.map(function (id) {
      return bytes(id).then(function (u8) {
        if (u8 && meta[id]) out[id] = { bytes: u8, w: meta[id].w, h: meta[id].h };
      });
    })).then(function () { return out; });
  }

  /** รูปขนาดเล็กเป็น base64 สำหรับส่งให้ AI ดู */
  function forAI(id) {
    return getBlob(id).then(function (b) {
      if (!b) return null;
      return toJpeg(b, AI_SIDE, 0.7).then(function (r) { return blobToBase64(r.blob); })
        .then(function (data) { return { mime: 'image/jpeg', data: data }; });
    });
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(String(fr.result).split(',')[1] || ''); };
      fr.onerror = function () { reject(fr.error); };
      fr.readAsDataURL(blob);
    });
  }

  function remove(id) {
    if (urlCache[id]) { URL.revokeObjectURL(urlCache[id]); delete urlCache[id]; }
    delete meta[id];
    saveMeta();
    return tx('readwrite', function (s) { s.delete(id); });
  }

  function info(id) { return meta[id] || null; }

  /** ส่งออกรูปที่ใช้ เพื่อแนบไปกับไฟล์ "บันทึกงาน" (.json) */
  function exportAll(ids) {
    var out = {};
    return Promise.all(ids.filter(Boolean).map(function (id) {
      return getBlob(id).then(function (b) {
        if (!b) return;
        return blobToBase64(b).then(function (data) { out[id] = Object.assign({ data: data }, meta[id] || {}); });
      });
    })).then(function () { return out; });
  }

  /** รับรูปจากไฟล์ "บันทึกงาน" กลับเข้าคลัง */
  function importAll(map) {
    var ids = Object.keys(map || {});
    return Promise.all(ids.map(function (id) {
      var p = map[id];
      if (!p || !p.data || !/^p[0-9a-f]{12}$/.test(id)) return null;
      var bin = atob(p.data);
      var u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      var blob = new Blob([u8], { type: 'image/jpeg' });
      return tx('readwrite', function (s) { s.put(blob, id); }).then(function () {
        meta[id] = { w: Number(p.w) || 4, h: Number(p.h) || 3, name: String(p.name || '') };
      });
    })).then(function () { saveMeta(); return ids.length; });
  }

  /** ขนาดรูปบนหน้ากระดาษ (pt) — กว้างไม่เกิน 80% ของพื้นที่พิมพ์ สูงไม่เกิน 260 pt */
  function fitPt(id, spec) {
    var m = meta[id] || { w: 4, h: 3 };
    var maxW = (spec.page.width - spec.page.marginLeft - spec.page.marginRight) * 0.8;
    var maxH = 260;
    var k = Math.min(maxW / m.w, maxH / m.h);
    return { w: Math.round(m.w * k), h: Math.round(m.h * k) };
  }

  /** ดึงรหัสรูปทั้งหมดจากข้อความ */
  var LINE_RE = /^\s*\[\s*รูป\s*:\s*(p[0-9a-f]{12})\s*\]\s*$/;
  function idsInText(text) {
    var out = [];
    String(text || '').split('\n').forEach(function (l) { var m = l.match(LINE_RE); if (m) out.push(m[1]); });
    return out;
  }

  return {
    add: add, url: url, attach: attach, collect: collect, forAI: forAI, remove: remove, info: info,
    exportAll: exportAll, importAll: importAll, fitPt: fitPt, idsInText: idsInText, LINE_RE: LINE_RE
  };
})();
