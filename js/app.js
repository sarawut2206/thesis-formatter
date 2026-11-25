/*!
 * app.js — ส่วนติดต่อผู้ใช้และการเชื่อมทุกโมดูลเข้าด้วยกัน
 */
(function () {
  'use strict';

  var LS_KEY = 'project-formatter-state-v1';
  // เพิ่มเลขนี้เมื่อค่ารูปแบบมาตรฐานเปลี่ยน เพื่อให้ค่าที่ผู้ใช้บันทึกไว้ถูกปรับตาม
  var SPEC_VERSION = 4;

  /* ==================================================================
   * สถานะของโปรแกรม
   * ================================================================== */
  function emptyDoc(extra) {
    return Object.assign({ text: '', join: 'auto', smart: true, overrides: {} }, extra || {});
  }

  /** ผู้จัดทำหนึ่งคน — คีย์ตรงกับ TFTemplates.VITA_FIELDS */
  function emptyPerson() {
    var p = {};
    TFTemplates.VITA_FIELDS.forEach(function (f) { p[f.key] = ''; });
    return p;
  }

  function defaultState() {
    return {
      version: 2,
      specVersion: SPEC_VERSION,
      activeTab: 'ch1',
      presetId: TFTemplates.DEFAULT_PRESET,
      spec: TFTemplates.clone(TFTemplates.preset(TFTemplates.DEFAULT_PRESET).spec),
      docs: {
        ch1: emptyDoc(), ch2: emptyDoc(), ch3: emptyDoc(), ch4: emptyDoc(), ch5: emptyDoc(), ch6: emptyDoc(),
        bib: emptyDoc({ join: 'never', smart: false, sort: true }),
        appendix: emptyDoc({ join: 'auto', smart: true })
      },
      meta: {
        titleTh: '', titleEn: '', projectCode: '',
        authorsTh: '', authorsEn: '',
        gradeLevel: 'มัธยมศึกษาปีที่ 2', gradeLevelEn: '',
        subjectTh: '', subjectEn: '', learningArea: '',
        schoolTh: '', schoolEn: '',
        termTh: '', yearTh: '', yearEn: '',
        teacher1: '', teacher2: '', teacher1En: '',
        headOfArea: '', director: '', approvalDate: '',
        keywordsTh: '', keywordsEn: ''
      },
      abstracts: { th: '', en: '' },
      // ข้อมูลสำหรับเขียนบทที่ 4–6 (รูปเก็บใน TFPhotos อ้างด้วยรหัส)
      results: {
        notes: '', usage: '', share: '', suggestions: '',
        trials: [{ id: 't1', name: 'สูตรที่ 1', recipe: '', result: '', value: '', unit: '', photo: '' }],
        photos: []
      },
      ack: '',
      vita: [emptyPerson()],
      front: {
        coverTh: true, coverInner: false, coverEn: false, approval: true,
        abstractTh: true, abstractEn: false, ack: true,
        toc: true, tocMode: 'static', listTables: false, listFigures: false,
        tables: '', figures: ''
      },
      exportParts: {
        front: true, ch1: true, ch2: true, ch3: true, ch4: true, ch5: true, ch6: true,
        bib: true, appendix: true, vita: true
      }
    };
  }

  var S = load() || defaultState();

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      // เติมค่าที่อาจขาดหายจากเวอร์ชันเก่า
      var d = defaultState();
      o = deepFill(o, d);
      upgradeSpec(o);
      return o;
    } catch (e) { return null; }
  }

  /**
   * ปรับค่ารูปแบบที่ผู้ใช้เคยบันทึกไว้ให้เป็นแบบใหม่
   *
   * ค่ารูปแบบถูกเก็บไว้ในเครื่องผู้ใช้ การแก้ไฟล์แม่แบบอย่างเดียวจึงไม่ถึงคนที่เคยใช้แล้ว
   * รายการเดิมเยื้องเฉพาะบรรทัดแรก ทำให้บรรทัดที่ตกลงมาย้อนไปชิดขอบซ้าย ผิดแบบเอกสารราชการ
   * จึงเปลี่ยนเป็นเยื้องแบบแขวนให้อัตโนมัติ
   */
  function upgradeSpec(o) {
    if (!o || !o.spec || !o.spec.styles) return;
    if (o.specVersion === SPEC_VERSION) return;

    var preset = TFTemplates.preset(o.presetId || TFTemplates.DEFAULT_PRESET);
    var def = preset && preset.spec.styles.list;
    if (def) {
      // ใช้ค่ารายการชุดใหม่ทั้งหมด (เยื้องแขวน + ไม่กระจายตัวอักษร)
      o.spec.styles.list = TFTemplates.clone(def);
    }
    o.specVersion = SPEC_VERSION;
  }

  function deepFill(target, defaults) {
    if (target == null || typeof target !== 'object' || Array.isArray(target)) return defaults;
    Object.keys(defaults).forEach(function (k) {
      if (defaults[k] && typeof defaults[k] === 'object' && !Array.isArray(defaults[k])) {
        target[k] = deepFill(target[k], defaults[k]);
      } else if (target[k] === undefined) {
        target[k] = defaults[k];
      }
    });
    return target;
  }

  var saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { /* เต็ม */ }
    }, 300);
  }

  /* ==================================================================
   * ชุดรูปแบบ (Preset)
   * ================================================================== */
  function currentPreset() { return TFTemplates.preset(S.presetId); }

  /** เปลี่ยนชุดรูปแบบ — แทนที่ค่ารูปแบบทั้งหมด แต่ไม่แตะข้อความที่ผู้ใช้พิมพ์ไว้ */
  function applyPreset(id) {
    var pre = TFTemplates.preset(id);
    S.presetId = pre.id;
    S.spec = TFTemplates.clone(pre.spec);
    save();
  }

  function renderPresetSelect() {
    var sel = document.getElementById('preset-select');
    sel.innerHTML = '';
    TFTemplates.PRESET_ORDER.forEach(function (id) {
      var p = TFTemplates.PRESETS[id];
      var o = document.createElement('option');
      o.value = id;
      o.textContent = p.label;
      sel.appendChild(o);
    });
    sel.value = S.presetId;
    sel.title = currentPreset().note;
    sel.onchange = function () {
      if (!confirm('เปลี่ยนเป็นรูปแบบ "' + TFTemplates.PRESETS[sel.value].label + '" ?\n\n' +
                   'ค่ารูปแบบทั้งหมด (ฟอนต์ ขนาด ระยะขอบ เลขหน้า) จะถูกตั้งใหม่ตามชุดนี้\n' +
                   'ข้อความที่พิมพ์ไว้ทุกบทยังอยู่ครบ')) {
        sel.value = S.presetId;
        return;
      }
      applyPreset(sel.value);
      sel.title = currentPreset().note;
      renderMain();
      toast('เปลี่ยนเป็นรูปแบบ ' + currentPreset().label + ' แล้ว');
    };
  }

  /* ==================================================================
   * ตัวช่วยทั่วไป
   * ================================================================== */
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] === true) n.setAttribute(k, '');
      else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  var toastTimer;
  function toast(msg, isErr) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast' + (isErr ? ' err' : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var a = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, a); }, ms);
    };
  }

  /* ==================================================================
   * การแยกวิเคราะห์ + การกำหนดประเภทเอง (overrides)
   * ================================================================== */
  function docBlocks(docId) {
    var d = S.docs[docId];
    if (!d) return [];
    var blocks;

    if (docId === 'bib') {
      blocks = TFParser.parseBibliography(d.text, {
        splitMode: d.join === 'always' ? 'blank' : 'line',
        sort: d.sort !== false
      });
    } else if (docId === 'appendix') {
      blocks = TFParser.parseAppendix(d.text, { joinMode: d.join, smartHeadings: d.smart });
    } else {
      var chapter = parseInt(docId.replace('ch', ''), 10);
      blocks = TFParser.parse(d.text, {
        chapter: chapter,
        joinMode: d.join,
        smartHeadings: d.smart
      });
    }

    // ใส่ประเภทที่ผู้ใช้กำหนดเอง
    var ov = d.overrides || {};
    blocks.forEach(function (b) {
      var to = ov[overrideKey(b)];
      if (!to || to === b.type) return;

      if (b.type === 'table' && b.rows) {
        // เปลี่ยนตารางกลับเป็นข้อความธรรมดา
        b.text = b.rows.map(function (r) { return r.join('  '); }).join('  ');
        delete b.rows;
      } else if (to === 'table' && !b.rows) {
        // เปลี่ยนข้อความหนึ่งบรรทัดให้เป็นตารางแถวเดียว
        var cells = String(b.text || '').split('|').map(function (c) { return c.trim(); }).filter(Boolean);
        b.rows = [cells.length >= 2 ? cells : [b.text || '']];
        b.header = false;
        b.text = TFParser.tableSummary(b);
      }
      b.type = to;
    });
    return blocks;
  }

  function overrideKey(b) { return (b.text || '').slice(0, 80); }

  /* ==================================================================
   * แท็บ
   * ================================================================== */
  var TABS = [
    { id: 'ch1', label: 'บทที่ 1', kind: 'chapter', chapter: 1 },
    { id: 'ch2', label: 'บทที่ 2', kind: 'chapter', chapter: 2 },
    { id: 'ch3', label: 'บทที่ 3', kind: 'chapter', chapter: 3 },
    { id: 'results', label: '📷 บันทึกผล → บท 4–6', kind: 'results' },
    { id: 'ch4', label: 'บทที่ 4', kind: 'chapter', chapter: 4 },
    { id: 'ch5', label: 'บทที่ 5', kind: 'chapter', chapter: 5 },
    { id: 'ch6', label: 'บทที่ 6', kind: 'chapter', chapter: 6 },
    { id: 'bib', label: 'บรรณานุกรม', kind: 'bib' },
    { id: 'appendix', label: 'ภาคผนวก', kind: 'appendix' },
    { id: 'front', label: 'ส่วนหน้า', kind: 'front' },
    { id: 'vita', label: 'ประวัติผู้จัดทำ', kind: 'vita' },
    { id: 'ai', label: '✨ ผู้ช่วย AI', kind: 'ai' },
    { id: 'settings', label: 'ตั้งค่ารูปแบบ', kind: 'settings' },
    { id: 'export', label: 'ส่งออกทั้งเล่ม', kind: 'export' },
    { id: 'help', label: 'วิธีใช้', kind: 'help' }
  ];

  function renderTabs() {
    var nav = document.getElementById('tabs');
    nav.innerHTML = '';
    TABS.forEach(function (t) {
      nav.appendChild(el('button', {
        class: 'tab' + (S.activeTab === t.id ? ' active' : ''),
        text: t.label,
        onclick: function () { S.activeTab = t.id; save(); renderTabs(); renderMain(); }
      }));
    });
  }

  function renderMain() {
    var main = document.getElementById('main');
    main.innerHTML = '';
    var tab = TABS.filter(function (t) { return t.id === S.activeTab; })[0] || TABS[0];

    switch (tab.kind) {
      case 'chapter':  main.appendChild(buildEditor(tab)); break;
      case 'bib':      main.appendChild(buildEditor(tab)); break;
      case 'appendix': main.appendChild(buildEditor(tab)); break;
      case 'front':    main.appendChild(buildFront()); break;
      case 'vita':     main.appendChild(buildVita()); break;
      case 'ai':       main.appendChild(buildAI()); break;
      case 'results':  main.appendChild(buildResults()); break;
      case 'settings': main.appendChild(buildSettings()); break;
      case 'export':   main.appendChild(buildExport()); break;
      case 'help':     main.appendChild(buildHelp()); break;
    }
    window.scrollTo(0, 0);
  }

  /* ==================================================================
   * หน้าแก้ไขบท / บรรณานุกรม / ภาคผนวก
   * ================================================================== */
  var HINTS = {
    chapter: 'วางข้อความทั้งหมดของบทนี้ลงในช่องด้านล่าง โปรแกรมจะแยก “ชื่อบท / หัวข้อหลัก / เนื้อความ / ตาราง” ให้อัตโนมัติ แล้วจัดหน้า ฟอนต์ ขนาด และย่อหน้าตามรูปแบบมาตรฐาน · ตารางให้คั่นช่องด้วยเครื่องหมาย | หรือวางตารางจาก Word/Excel มาตรง ๆ ก็ได้',
    bib: 'วางรายการบรรณานุกรม บรรทัดละ 1 รายการ โปรแกรมจะจัดย่อหน้าแบบแขวน (บรรทัดแรกชิดซ้าย บรรทัดต่อไปเยื้องเข้า) และเรียงลำดับให้',
    appendix: 'วางเนื้อหาภาคผนวก บรรทัดที่เขียนว่า “ภาคผนวก ก” “ภาคผนวก ข” จะกลายเป็นหน้าคั่นกึ่งกลางโดยอัตโนมัติ'
  };

  function buildEditor(tab) {
    var docId = tab.id;
    var d = S.docs[docId];
    var node = document.getElementById('tpl-editor').content.cloneNode(true);
    var root = node.querySelector('.editor');

    var chInfo = tab.chapter ? TFTemplates.CHAPTERS[tab.chapter] : null;
    root.querySelector('.pane-input .pane-title').textContent =
      chInfo ? ('บทที่ ' + tab.chapter + '  ' + chInfo.title) : tab.label;
    root.querySelector('.js-hint').textContent = HINTS[tab.kind];

    var ta = root.querySelector('.js-text');
    var joinSel = root.querySelector('.js-join');
    var smartCb = root.querySelector('.js-smart');
    var sortWrap = root.querySelector('.js-sort-wrap');
    var sortCb = root.querySelector('.js-sort');
    var structure = root.querySelector('.js-structure');
    var countEl = root.querySelector('.js-count');
    var preview = root.querySelector('.js-preview');
    var zoom = root.querySelector('.js-zoom');
    var zoomVal = root.querySelector('.js-zoom-val');

    ta.value = d.text;
    joinSel.value = d.join;
    smartCb.checked = !!d.smart;

    if (docId === 'bib') {
      sortWrap.hidden = false;
      sortCb.checked = d.sort !== false;
      smartCb.parentElement.hidden = true;
      joinSel.options[0].textContent = 'อัตโนมัติ';
      joinSel.options[1].textContent = 'แยกรายการด้วยบรรทัดว่าง';
      joinSel.options[2].textContent = '1 บรรทัด = 1 รายการ';
    }

    var refresh = function () {
      var blocks = docBlocks(docId);
      renderStructure(structure, docId, blocks);
      countEl.textContent = blocks.length + ' ย่อหน้า';
      TFPreview.render(preview, blocks, S.spec, {
        startPage: 1,
        pageNumFormat: S.spec.pageNumber.bodyFormat
      });
    };
    var refreshSoon = debounce(refresh, 220);

    ta.addEventListener('input', function () { d.text = ta.value; save(); refreshSoon(); });
    joinSel.addEventListener('change', function () { d.join = joinSel.value; save(); refresh(); });
    smartCb.addEventListener('change', function () { d.smart = smartCb.checked; save(); refresh(); });
    sortCb.addEventListener('change', function () { d.sort = sortCb.checked; save(); refresh(); });

    root.querySelector('.js-clear').addEventListener('click', function () {
      if (!ta.value || confirm('ล้างข้อความในช่องนี้?')) { ta.value = ''; d.text = ''; d.overrides = {}; save(); refresh(); }
    });
    root.querySelector('.js-sample').addEventListener('click', function () {
      var sample = sampleFor(docId);
      if (ta.value && !confirm('แทนที่ข้อความเดิมด้วยตัวอย่าง?')) return;
      ta.value = sample; d.text = sample; d.overrides = {}; save(); refresh();
    });
    root.querySelector('.js-reset-overrides').addEventListener('click', function () {
      d.overrides = {}; save(); refresh(); toast('คืนค่าการแยกประเภทอัตโนมัติแล้ว');
    });

    // ---- นำเข้าข้อความจากไฟล์ PDF / Word / ข้อความ ----
    var importBtn = root.querySelector('.js-import');
    var importFile = root.querySelector('.js-import-file');
    importBtn.addEventListener('click', function () { importFile.click(); });
    importFile.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      if (ta.value.trim() && !confirm('ช่องนี้มีข้อความอยู่แล้ว จะแทนที่ด้วยข้อความจากไฟล์?')) return;

      importBtn.disabled = true;
      importBtn.textContent = 'กำลังอ่านไฟล์…';
      TFImport.readFile(file)
        .then(function (r) {
          ta.value = r.text;
          d.text = r.text;
          d.overrides = {};
          // ข้อความจาก PDF ถูกตัดเป็นบรรทัดสั้น ๆ จึงต้องรวมบรรทัดกลับ
          if (r.kind === 'pdf') { d.join = 'auto'; joinSel.value = 'auto'; }
          save();
          refresh();
          var msg = 'นำเข้าข้อความจาก ' + file.name + ' แล้ว';
          if (r.pages) msg += ' (' + r.pages + ' หน้า)';
          toast(r.warning ? msg + ' — ' + r.warning : msg);
        })
        .catch(function (err) { toast(err.message || 'อ่านไฟล์ไม่สำเร็จ', true); })
        .then(function () {
          importBtn.disabled = false;
          importBtn.textContent = '📄 อัปโหลดไฟล์';
        });
    });

    // ปุ่มให้ AI ร่างบทนี้ — แสดงเฉพาะบทที่ 2–5 และเมื่อใส่คีย์ไว้แล้ว
    var aiBtn = root.querySelector('.js-ai');
    if (tab.chapter >= 2 && tab.chapter <= 6) {
      aiBtn.hidden = false;
      aiBtn.addEventListener('click', function () {
        if (!TFAI.hasKey()) {
          toast('ยังไม่ได้ตั้งค่าคีย์ AI — ไปที่แท็บ “✨ ผู้ช่วย AI”', true);
          S.activeTab = 'ai'; save(); renderTabs(); renderMain();
          return;
        }
        if (ta.value.trim() && !confirm('บทนี้มีข้อความอยู่แล้ว จะให้ AI เขียนทับ?')) return;
        aiBtn.disabled = true;
        aiBtn.textContent = 'กำลังร่าง…';
        aiDraftChapter(tab.chapter, '')
          .then(function (text) {
            ta.value = text;
            refresh();
            toast('AI ร่างบทที่ ' + tab.chapter + ' ให้แล้ว — อย่าลืมตรวจและแก้ไข');
          })
          .catch(function (e) { toast(e.message, true); })
          .then(function () { aiBtn.disabled = false; aiBtn.textContent = '✨ ให้ AI ร่างบทนี้'; });
      });
    }

    zoom.addEventListener('input', function () {
      preview.style.zoom = (zoom.value / 100);
      zoomVal.textContent = zoom.value + '%';
    });
    preview.style.zoom = 0.75;

    root.querySelector('.js-download').addEventListener('click', function () {
      exportSingle(docId, tab);
    });

    setTimeout(refresh, 0);
    return root;
  }

  function sampleFor(docId) {
    if (docId === 'ch1') return TFTemplates.SAMPLE_CH1;
    if (docId === 'bib') {
      return TFTemplates.SAMPLE_BIB[S.presetId] || TFTemplates.SAMPLE_BIB.angsana;
    }
    if (docId === 'appendix') {
      return [
        'ภาคผนวก',
        '',
        'ภาคผนวก ก',
        'แบบสอบถามที่ใช้ในโครงงาน',
        '',
        'แบบสอบถามฉบับนี้จัดทำขึ้นเพื่อเก็บรวบรวมข้อมูลประกอบการทำโครงงาน โดยแบ่งออกเป็น 3 ตอน',
        '1. ข้อมูลทั่วไปของผู้ตอบแบบสอบถาม',
        '2. ความคิดเห็นเกี่ยวกับผลงานที่จัดทำ',
        '3. ข้อเสนอแนะเพิ่มเติม',
        '',
        'ภาคผนวก ข',
        'รายนามผู้เชี่ยวชาญตรวจสอบเครื่องมือ'
      ].join('\n');
    }
    var n = parseInt(docId.replace('ch', ''), 10);
    var info = TFTemplates.CHAPTERS[n];
    if (!info) return '';
    return ['บทที่ ' + n, info.title, ''].concat(
      info.headings.slice(0, 5).map(function (h) {
        return h + '\n(พิมพ์เนื้อหาของหัวข้อนี้ต่อจากบรรทัดนี้)\n';
      })
    ).join('\n');
  }

  function renderStructure(host, docId, blocks) {
    host.innerHTML = '';
    var d = S.docs[docId];
    var types = Object.keys(TFTemplates.BLOCK_LABELS);

    if (!blocks.length) {
      host.appendChild(el('div', { class: 'srow' }, [
        el('span', { class: 'stext', text: 'ยังไม่มีข้อความ' })
      ]));
      return;
    }

    var frag = document.createDocumentFragment();
    blocks.forEach(function (b) {
      var key = overrideKey(b);
      var changed = !!(d.overrides && d.overrides[key]);
      var sel = el('select', {
        onchange: function () {
          d.overrides = d.overrides || {};
          d.overrides[key] = sel.value;
          save();
          var blocks2 = docBlocks(docId);
          renderStructure(host, docId, blocks2);
          var pv = host.closest('.editor').querySelector('.js-preview');
          TFPreview.render(pv, blocks2, S.spec, { startPage: 1 });
        }
      });
      types.forEach(function (t) {
        sel.appendChild(el('option', { value: t, text: TFTemplates.BLOCK_LABELS[t] }));
      });
      sel.value = b.type;

      frag.appendChild(el('div', { class: 'srow' + (changed ? ' changed' : ''), 'data-t': b.type }, [
        sel,
        el('span', { class: 'stext', text: b.text || '(บรรทัดว่าง)', title: b.text })
      ]));
    });
    host.appendChild(frag);
  }

  /* ==================================================================
   * บันทึกผลการทดลอง → เขียนบทที่ 4–6
   *   นักเรียนเล่า (พิมพ์หรือพูด) + ใส่สูตรพร้อมตัวเลข + โยนรูปลงไป
   *   แล้วให้ AI อ่านบทที่ 1–3 ดูรูป และเขียนบทที่ 4–6 ลงในแท็บของแต่ละบท
   * ================================================================== */
  function emptyTrial(n) {
    return {
      id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: 'สูตรที่ ' + n, recipe: '', result: '', value: '', unit: '', photo: ''
    };
  }

  /** ช่องข้อความที่พิมพ์ได้ และกด 🎤 พูดภาษาไทยได้ (ถ้าเบราว์เซอร์รองรับ) */
  function voiceBox(value, onInput, placeholder, rows) {
    var ta = el('textarea', { placeholder: placeholder || '', rows: rows || 3 });
    ta.value = value || '';
    ta.addEventListener('input', function () { onInput(ta.value); });
    var wrap = el('div', { class: 'voice' }, [ta]);

    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return wrap;

    var status = el('span', { class: 'voice-status' });
    var rec = null;
    var btn = el('button', { class: 'btn tiny voice-btn', type: 'button', text: '🎤 พูด' });
    btn.addEventListener('click', function () {
      if (rec) { rec.stop(); return; }
      rec = new SR();
      rec.lang = 'th-TH';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = function (e) {
        var fin = '', tmp = '';
        for (var i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) fin += e.results[i][0].transcript;
          else tmp += e.results[i][0].transcript;
        }
        if (fin.trim()) {
          ta.value += (ta.value && !/\s$/.test(ta.value) ? ' ' : '') + fin.trim();
          onInput(ta.value);
        }
        status.textContent = tmp ? 'กำลังฟัง… ' + tmp : 'กำลังฟัง…';
      };
      rec.onerror = function (e) {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน', true);
        else if (e.error === 'network') toast('ระบบฟังเสียงต้องต่ออินเทอร์เน็ต', true);
      };
      rec.onend = function () { rec = null; btn.textContent = '🎤 พูด'; btn.classList.remove('on'); status.textContent = ''; };
      try { rec.start(); btn.textContent = '■ หยุดฟัง'; btn.classList.add('on'); status.textContent = 'กำลังฟัง…'; }
      catch (err) { rec = null; }
    });
    wrap.appendChild(el('div', { class: 'voice-bar' }, [btn, status]));
    return wrap;
  }

  function thumb(id, cls) {
    var img = el('img', { class: cls || 'res-thumb', alt: '' });
    TFPhotos.attach(img, id);
    return img;
  }

  /** รูปทั้งหมดของผลการทดลอง เรียงตามลำดับ พร้อมป้าย P1, P2, ... สำหรับให้ AI อ้างถึง */
  function resultPhotoList() {
    var r = S.results, seen = {}, out = [];
    r.trials.forEach(function (t) {
      if (t.photo && !seen[t.photo] && TFPhotos.info(t.photo)) {
        seen[t.photo] = 1;
        out.push({ id: t.photo, note: t.name + (t.result ? ' (ผล: ' + t.result + ')' : '') });
      }
    });
    r.photos.forEach(function (p) {
      if (p.id && !seen[p.id] && TFPhotos.info(p.id)) { seen[p.id] = 1; out.push({ id: p.id, note: p.note || '' }); }
    });
    return out.map(function (p, i) { return Object.assign(p, { label: 'P' + (i + 1) }); });
  }

  /** ลบรูปออกจากคลัง ถ้าไม่มีที่ไหนใช้แล้ว (ผลการทดลอง หรือข้อความบทใด ๆ) */
  function dropPhotoIfUnused(id) {
    if (!id) return;
    var used = S.results.trials.some(function (t) { return t.photo === id; }) ||
               S.results.photos.some(function (p) { return p.id === id; }) ||
               Object.keys(S.docs).some(function (k) { return TFPhotos.idsInText(S.docs[k].text).indexOf(id) >= 0; });
    if (!used) TFPhotos.remove(id);
  }

  function addPhotoFiles(files, onEach) {
    var list = Array.prototype.slice.call(files || []);
    var done = 0, errors = [];
    return list.reduce(function (p, f) {
      return p.then(function () {
        toast('กำลังเพิ่มรูป ' + (done + 1) + '/' + list.length + '…');
        return TFPhotos.add(f).then(onEach).catch(function (e) { errors.push(e.message); })
          .then(function () { done++; });
      });
    }, Promise.resolve()).then(function () {
      if (errors.length) toast('เพิ่มได้ ' + (list.length - errors.length) + ' รูป — ' + errors.join(', '), true);
      else if (list.length) toast('เพิ่มรูปแล้ว ' + list.length + ' รูป');
    });
  }

  function buildResults() {
    var r = S.results;
    var wrap = el('div', { class: 'form-page results-page' });

    // ---- 0) คำอธิบาย + สถานะบทที่ 1–3 ----
    var c0 = el('div', { class: 'card' }, [
      el('h2', { text: '📷 บันทึกผลการทดลอง แล้วให้ AI เขียนบทที่ 4–6' }),
      el('p', { class: 'hint', html:
        'เล่าว่าทำอะไรไป ได้ผลอย่างไร (พิมพ์หรือกด <b>🎤 พูด</b>) ใส่สูตรพร้อมตัวเลขที่วัดได้ แล้วโยนรูปทั้งหมดลงไป ' +
        'ระบบจะอ่าน<b>บทที่ 1–3 ที่เขียนไว้ในแท็บของแต่ละบท</b> ดูรูป แล้วเขียน<b>บทที่ 4 ผลการดำเนินงาน · บทที่ 5 สรุป อภิปรายผล · บทที่ 6 การนำไปใช้</b> ' +
        'พร้อมใส่รูปและคำบรรยาย “ภาพที่ 4.x” ให้ แก้ข้อความต่อได้ในแท็บบทที่ 4–6' })
    ]);
    var st = el('div', { class: 'res-status' });
    [1, 2, 3].forEach(function (n) {
      var len = (S.docs['ch' + n].text || '').trim().length;
      st.appendChild(el('span', { class: 'chip ' + (len ? 'ok' : 'empty'),
        text: 'บทที่ ' + n + (len ? ' ✓ ' + len.toLocaleString('th-TH') + ' ตัวอักษร' : ' ยังว่าง') }));
    });
    st.appendChild(el('span', { class: 'chip ' + (TFAI.hasKey() ? 'ok' : 'empty'),
      text: TFAI.hasKey() ? 'AI พร้อมใช้' : 'ยังไม่ได้ใส่คีย์ AI (จะได้ร่างแบบเรียงข้อมูลให้)' }));
    c0.appendChild(st);
    wrap.appendChild(c0);

    // ---- 1) เล่าผล ----
    wrap.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: '1. เล่าผลการดำเนินงาน' }),
      el('p', { class: 'hint', text: 'เล่าแบบภาษาพูดได้เลย เช่น ทำกี่สูตร วางไว้ที่ไหน กี่วัน สูตรไหนดีที่สุด เพราะอะไร' }),
      voiceBox(r.notes, function (v) { r.notes = v; save(); },
        'เช่น พวกเราทำเครื่องดักแมลงจากขวดพลาสติก ลองน้ำล่อ 3 สูตร วางที่โรงอาหาร 2 วัน สูตรน้ำหวานผสมยีสต์จับได้มากที่สุด…', 5)
    ]));

    // ---- 2) สูตร / การทดลอง ----
    var c2 = el('div', { class: 'card' }, [
      el('h2', { text: '2. สูตร / การทดลองแต่ละครั้ง' }),
      el('p', { class: 'hint', text: 'ใส่ตัวเลขที่วัดได้จริง ระบบจะทำเป็น “ตารางที่ 4.1” ให้เอง (AI จะไม่แต่งตัวเลขเพิ่ม)' })
    ]);
    r.trials.forEach(function (t, i) {
      var photoArea = el('div', { class: 'res-photo-row' });
      var pick = el('input', { type: 'file', accept: 'image/*', hidden: true });
      pick.addEventListener('change', function () {
        var f = pick.files && pick.files[0];
        pick.value = '';
        if (!f) return;
        addPhotoFiles([f], function (ph) { var old = t.photo; t.photo = ph.id; save(); dropPhotoIfUnused(old); })
          .then(renderMain);
      });
      photoArea.appendChild(el('button', { class: 'btn tiny', type: 'button', text: t.photo ? '🔄 เปลี่ยนรูป' : '📷 ใส่รูปของสูตรนี้',
        onclick: function () { pick.click(); } }));
      photoArea.appendChild(pick);
      if (t.photo) {
        photoArea.appendChild(thumb(t.photo));
        photoArea.appendChild(el('button', { class: 'btn tiny ghost danger', type: 'button', text: 'เอารูปออก',
          onclick: function () { var old = t.photo; t.photo = ''; save(); dropPhotoIfUnused(old); renderMain(); } }));
      }

      var nameIn = el('input', { type: 'text', placeholder: 'เช่น สูตรที่ 1 น้ำหวาน + ยีสต์' });
      nameIn.value = t.name;
      nameIn.addEventListener('input', function () { t.name = nameIn.value; save(); });
      var valIn = el('input', { type: 'text', inputmode: 'decimal', placeholder: 'เช่น 25' });
      valIn.value = t.value;
      valIn.addEventListener('input', function () { t.value = valIn.value; save(); });
      var unitIn = el('input', { type: 'text', placeholder: 'เช่น ตัว' });
      unitIn.value = t.unit;
      unitIn.addEventListener('input', function () { t.unit = unitIn.value; save(); });

      c2.appendChild(el('div', { class: 'res-trial' }, [
        el('div', { class: 'res-trial-head' }, [
          el('strong', { text: 'รายการที่ ' + (i + 1) }),
          el('button', { class: 'btn tiny ghost danger', type: 'button', text: 'ลบรายการ', onclick: function () {
            if (!confirm('ลบ ' + (t.name || 'รายการนี้') + '?')) return;
            r.trials.splice(i, 1); save(); dropPhotoIfUnused(t.photo); renderMain();
          } })
        ]),
        el('div', { class: 'field' }, [el('label', { text: 'ชื่อสูตร / การทดลอง' }), nameIn]),
        el('div', { class: 'field' }, [el('label', { text: 'วิธีทำ / ส่วนผสม' }),
          voiceBox(t.recipe, function (v) { t.recipe = v; save(); }, 'เช่น น้ำตาล 2 ช้อนโต๊ะ ยีสต์ 1 ช้อนชา น้ำอุ่น 200 มิลลิลิตร', 2)]),
        el('div', { class: 'field' }, [el('label', { text: 'ผลที่ได้' }),
          voiceBox(t.result, function (v) { t.result = v; save(); }, 'เช่น จับแมลงวันได้มาก กลิ่นแรง', 2)]),
        el('div', { class: 'grid2' }, [
          el('div', { class: 'field' }, [el('label', { text: 'ตัวเลขที่วัดได้ (ถ้ามี)' }), valIn]),
          el('div', { class: 'field' }, [el('label', { text: 'หน่วย' }), unitIn])
        ]),
        photoArea
      ]));
    });
    c2.appendChild(el('button', { class: 'btn', type: 'button', text: '＋ เพิ่มสูตร / การทดลอง', onclick: function () {
      var last = r.trials[r.trials.length - 1];
      var t = emptyTrial(r.trials.length + 1);
      if (last) t.unit = last.unit;
      r.trials.push(t); save(); renderMain();
    } }));
    wrap.appendChild(c2);

    // ---- 3) รูปภาพ ----
    var c3 = el('div', { class: 'card' }, [
      el('h2', { text: '3. รูปภาพผลงาน (' + r.photos.length + ' รูป)' }),
      el('p', { class: 'hint', text: 'รูปตอนทดลอง ตอนนำไปใช้ ผลที่ได้ ตอนนำเสนอ — เลือกได้หลายรูปพร้อมกัน คำอธิบายใต้รูปไม่ใส่ก็ได้ AI จะดูรูปเอง (ควรเลี่ยงรูปที่เห็นหน้านักเรียนชัด)' })
    ]);
    var multi = el('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
    var drop = el('div', { class: 'dropzone', tabindex: '0', role: 'button' }, [
      el('b', { text: '📷 แตะเพื่อเลือกรูป หรือลากรูปมาวางที่นี่' }),
      el('small', { text: 'รูปเก็บไว้ในเบราว์เซอร์เครื่องนี้ — ใช้ปุ่ม “บันทึกงาน” ด้านบนเพื่อเก็บสำรองพร้อมรูป' })
    ]);
    var addMany = function (files) {
      addPhotoFiles(files, function (ph) { r.photos.push({ id: ph.id, note: '' }); save(); }).then(renderMain);
    };
    drop.addEventListener('click', function () { multi.click(); });
    drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); multi.click(); } });
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('drag'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('drag'); addMany(e.dataTransfer.files); });
    multi.addEventListener('change', function () { var f = multi.files; addMany(f); multi.value = ''; });
    c3.appendChild(drop);
    c3.appendChild(multi);

    var grid = el('div', { class: 'res-grid' });
    r.photos.forEach(function (p, i) {
      grid.appendChild(el('div', { class: 'res-card' }, [
        thumb(p.id, 'res-card-img'),
        el('div', { class: 'res-card-tools' }, [
          el('button', { class: 'btn tiny ghost', type: 'button', text: '◀', title: 'เลื่อนไปก่อน', disabled: i === 0,
            onclick: function () { var a = r.photos; var x = a[i - 1]; a[i - 1] = a[i]; a[i] = x; save(); renderMain(); } }),
          el('button', { class: 'btn tiny ghost', type: 'button', text: '▶', title: 'เลื่อนไปหลัง', disabled: i === r.photos.length - 1,
            onclick: function () { var a = r.photos; var x = a[i + 1]; a[i + 1] = a[i]; a[i] = x; save(); renderMain(); } }),
          el('button', { class: 'btn tiny ghost danger', type: 'button', text: 'ลบ',
            onclick: function () { r.photos.splice(i, 1); save(); dropPhotoIfUnused(p.id); renderMain(); } })
        ]),
        voiceBox(p.note, function (v) { p.note = v; save(); }, 'รูปนี้คืออะไร (ไม่ใส่ก็ได้)', 2)
      ]));
    });
    c3.appendChild(grid);
    wrap.appendChild(c3);

    // ---- 4) การนำไปใช้ / เผยแพร่ ----
    wrap.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: '4. การนำไปใช้ การเผยแพร่ และข้อเสนอแนะ' }),
      el('div', { class: 'field' }, [el('label', { text: 'นำไปใช้ที่ไหน กับใคร ได้ผลอย่างไร (บทที่ 6)' }),
        voiceBox(r.usage, function (v) { r.usage = v; save(); }, 'เช่น นำไปวางที่โรงอาหาร แม่ค้าบอกว่าแมลงวันลดลง', 3)]),
      el('div', { class: 'field' }, [el('label', { text: 'เผยแพร่ผลงานอย่างไร (บทที่ 6)' }),
        voiceBox(r.share, function (v) { r.share = v; save(); }, 'เช่น นำเสนอหน้าเสาธง ทำโปสเตอร์ โพสต์เพจโรงเรียน', 2)]),
      el('div', { class: 'field' }, [el('label', { text: 'ถ้าจะพัฒนาต่อ ควรทำอะไร (ข้อเสนอแนะ บทที่ 5)' }),
        voiceBox(r.suggestions, function (v) { r.suggestions = v; save(); }, 'เช่น ลองขวดใหญ่ขึ้น ทดลองให้นานขึ้น', 2)])
    ]));

    // ---- 5) สร้างบท ----
    var c5 = el('div', { class: 'card' }, [
      el('h2', { text: '5. เขียนบทที่ 4–6' }),
      el('p', { class: 'hint', text: TFAI.hasKey()
        ? 'AI จะดูรูป (สูงสุด 12 รูป แบบย่อขนาด) และอ่านบทที่ 1–3 แล้วเขียนบทที่ 4, 5, 6 ลงในแท็บของแต่ละบท — ใช้เวลาประมาณ 1 นาที'
        : 'ยังไม่ได้ใส่คีย์ AI — ระบบจะเรียงข้อมูลที่กรอกเป็นร่างบทที่ 4–6 ให้ก่อน (ใส่คีย์ได้ที่แท็บ “✨ ผู้ช่วย AI” เพื่อให้ AI เรียบเรียงและดูรูป)' })
    ]);
    var extra = el('textarea', { placeholder: 'คำสั่งเพิ่มเติมถึง AI (ไม่บังคับ) เช่น "บทที่ 4 แบ่งเป็นตอนที่ 1 การสร้าง ตอนที่ 2 การทดลอง"' });
    extra.style.minHeight = '60px';
    c5.appendChild(el('div', { class: 'field' }, [extra]));
    var log = el('div', { class: 'ai-log' });
    var go = el('button', { class: 'btn primary', type: 'button', text: '✨ เขียนบทที่ 4–6' });
    go.addEventListener('click', function () {
      go.disabled = true;
      go.textContent = TFAI.hasKey() ? 'AI กำลังดูรูปและเขียน… (ประมาณ 1 นาที)' : 'กำลังสร้างร่าง…';
      log.textContent = '';
      writeChapters456(extra.value)
        .then(function (res) {
          log.textContent = res.message;
          toast('เขียนบทที่ ' + res.written.join(', ') + ' แล้ว — เปิดแท็บของแต่ละบทเพื่อตรวจและแก้ไข');
          renderTabs();
          renderResultLinks(res.written);
        })
        .catch(function (e) { if (e && e.message) log.textContent = '❌ ' + e.message; })
        .then(function () { go.disabled = false; go.textContent = '✨ เขียนบทที่ 4–6'; });
    });
    var links = el('div', { class: 'res-links' });
    function renderResultLinks(written) {
      links.innerHTML = '';
      (written || []).forEach(function (n) {
        links.appendChild(el('button', { class: 'btn', type: 'button', text: 'เปิดบทที่ ' + n + ' →', onclick: function () {
          S.activeTab = 'ch' + n; save(); renderTabs(); renderMain();
        } }));
      });
    }
    c5.appendChild(el('div', { class: 'pane-tools' }, [go]));
    c5.appendChild(log);
    c5.appendChild(links);
    wrap.appendChild(c5);
    return wrap;
  }

  /** ตารางผลการทดลองในรูปแบบที่โปรแกรมแปลงเป็นตาราง Word ได้ */
  function trialsTableText() {
    var rows = S.results.trials.filter(function (t) { return (t.name || '').trim() || (t.result || '').trim(); });
    if (!rows.length) return '';
    var cell = function (s) { return String(s || '-').replace(/\|/g, '/').replace(/\s*\n\s*/g, ' ').trim() || '-'; };
    var out = ['ตารางที่ 4.1 ผลการทดลองแต่ละสูตร', '| ลำดับ | สูตร/การทดลอง | วิธีทำ/ส่วนผสม | ผลที่ได้ |', '|---|---|---|---|'];
    rows.forEach(function (t, i) {
      var val = (t.value || '').trim() ? '(' + [t.value.trim(), (t.unit || '').trim()].filter(Boolean).join(' ') + ')' : '';
      out.push('| ' + (i + 1) + ' | ' + cell(t.name) + ' | ' + cell(t.recipe) + ' | ' + cell([t.result, val].filter(Boolean).join(' ')) + ' |');
    });
    return out.join('\n');
  }

  /** ร่างแบบไม่ใช้ AI — เรียงข้อมูลที่นักเรียนกรอกเป็นโครงบทที่ 4–6 */
  function fallbackChapters(photoList) {
    var r = S.results, T = TFTemplates.CHAPTERS;
    var byId = {};
    photoList.forEach(function (p) { byId[p.id] = p; });
    var used = {};
    var L = ['===== บทที่ 4 =====', 'บทที่ 4', T[4].title, ''];
    L.push('จากการดำเนินงาน' + (S.meta.titleTh ? 'สร้าง' + String(S.meta.titleTh).replace(/\n/g, ' ') : '') + ' ผู้จัดทำได้ผลการดำเนินงานดังนี้' + (r.notes ? ' ' + r.notes.replace(/\s*\n\s*/g, ' ') : ''));
    r.trials.filter(function (t) { return t.name || t.result; }).forEach(function (t) {
      L.push('', '# ' + (t.name || 'การทดลอง'));
      L.push([t.recipe ? 'วิธีทำและส่วนผสม ' + t.recipe : '', t.result ? 'ผลที่ได้ ' + t.result : '',
              t.value ? 'วัดได้ ' + t.value + ' ' + (t.unit || '') : ''].filter(Boolean).join(' ').replace(/\s*\n\s*/g, ' ') || '(เติมผลการทดลอง)');
      if (t.photo && byId[t.photo]) { used[t.photo] = 1; L.push('[รูป ' + byId[t.photo].label + ']', 'ภาพที่ 4.1 ' + (t.name || 'ภาพการทดลอง')); }
    });
    L.push('', '[ตารางผลการทดลอง]');
    var rest = photoList.filter(function (p) { return !used[p.id]; });
    if (rest.length) {
      L.push('', '# ภาพการดำเนินงาน');
      rest.forEach(function (p) { L.push('[รูป ' + p.label + ']', 'ภาพที่ 4.1 ' + (p.note || 'ภาพการดำเนินงาน')); });
    }
    L.push('', '===== บทที่ 5 =====', 'บทที่ 5', T[5].title, '');
    L.push('# สรุปผล', 'จากการดำเนินงาน สรุปผลได้ว่า (สรุปผลให้ตอบวัตถุประสงค์ทุกข้อในบทที่ 1)' + (r.notes ? ' ' + r.notes.replace(/\s*\n\s*/g, ' ') : ''), '');
    L.push('# อภิปรายผล', '(อธิบายว่าเพราะเหตุใดผลจึงเป็นเช่นนี้ โดยโยงกับความรู้ในบทที่ 2)', '');
    L.push('# ข้อเสนอแนะ');
    var sug = [r.suggestions].filter(Boolean).join('\n').split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!sug.length) sug = ['(เติมข้อเสนอแนะ)'];
    sug.forEach(function (s, i) { L.push((i + 1) + '. ' + s); });
    L.push('', '===== บทที่ 6 =====', 'บทที่ 6', T[6].title, '');
    L.push('# การนำไปใช้ประโยชน์', r.usage ? r.usage.replace(/\s*\n\s*/g, ' ') : '(เติมว่านำไปใช้ที่ไหน กับใคร ได้ผลอย่างไร)', '');
    L.push('# การเผยแพร่ผลงาน', r.share ? r.share.replace(/\s*\n\s*/g, ' ') : '(เติมช่องทางการเผยแพร่ผลงาน)', '');
    L.push('# ประโยชน์ที่ได้รับ', '(เติมประโยชน์ที่ได้รับจากโครงงานนี้)');
    return L.join('\n');
  }

  /**
   * แปลงข้อความที่ได้ (จาก AI หรือร่างสำรอง) เป็นข้อความของบทที่ 4, 5, 6
   *  - [รูป P1]  -> [รูป:รหัสรูปจริง]  (ตัดป้ายที่ไม่มีอยู่จริงหรือใช้ซ้ำ)
   *  - [ตารางผลการทดลอง] -> ตารางจากตัวเลขที่นักเรียนกรอก
   *  - เรียงเลข "ภาพที่ N.x" และ "ตารางที่ N.x" ใหม่ในแต่ละบท
   */
  function finalizeChapters(raw, photoList) {
    var text = TFAI.cleanOutput(raw).replace(/\r/g, '');
    var chunks = {};
    var sep = /^\s*=+\s*บทที่\s*([456])\s*=+\s*$/gm;
    var marks = [], m;
    while ((m = sep.exec(text))) marks.push({ n: m[1], start: m.index, end: sep.lastIndex });
    if (!marks.length) {   // AI ไม่ได้ใส่บรรทัดคั่น — แยกจากบรรทัด "บทที่ N" แทน
      var re2 = /^\s*บทที่\s*([456])\s*$/gm;
      while ((m = re2.exec(text))) marks.push({ n: m[1], start: m.index, end: m.index });
    }
    marks.forEach(function (mk, i) {
      if (!chunks[mk.n]) chunks[mk.n] = text.slice(mk.end, i + 1 < marks.length ? marks[i + 1].start : text.length).trim();
    });

    var byLabel = {};
    photoList.forEach(function (p) { byLabel[p.label.toUpperCase()] = p; });
    var usedIds = {};
    var table = trialsTableText();
    var out = {};

    Object.keys(chunks).forEach(function (n) {
      var lines = chunks[n].split('\n');
      var title = TFTemplates.CHAPTERS[n].title;
      // ให้ขึ้นต้นด้วย "บทที่ N" + ชื่อบท เสมอ
      var firstIdx = lines.findIndex(function (l) { return l.trim(); });
      if (firstIdx < 0 || !new RegExp('^\\s*บทที่\\s*' + n + '\\s*$').test(lines[firstIdx])) lines.unshift('บทที่ ' + n, title, '');

      var res = [], tablePlaced = false;
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var im = line.match(/^\s*\[\s*รูป\s*:?\s*(P\d+)\s*\]\s*$/i);
        if (im) {
          var p = byLabel[im[1].toUpperCase()];
          var j = i + 1;
          while (j < lines.length && !lines[j].trim()) j++;
          var hasCaption = j < lines.length && /^\s*(ภาพที่|ภาพประกอบที่)/.test(lines[j]);
          if (!p || usedIds[p.id]) { if (hasCaption) i = j; continue; }   // ป้ายแต่งขึ้นหรือใช้ซ้ำ: ตัดทิ้งพร้อมคำบรรยาย
          usedIds[p.id] = 1;
          res.push('[รูป:' + p.id + ']');
          if (!hasCaption) res.push('ภาพที่ ' + n + '.1 ' + (p.note || 'ภาพประกอบ'));
          continue;
        }
        if (/^\s*\[\s*ตารางผลการทดลอง\s*\]\s*$/.test(line)) {
          if (table && !tablePlaced) { res.push('', table, ''); tablePlaced = true; }
          continue;
        }
        res.push(line);
      }
      if (n === '4' && table && !tablePlaced) res.push('', table);

      // เรียงเลขภาพและตารางใหม่ภายในบท
      var fig = 0, tbl = 0;
      res = res.map(function (l) {
        if (/^\s*(ภาพที่|ภาพประกอบที่)\s*[\d๐-๙]+(\.[\d๐-๙]+)*/.test(l)) {
          fig++;
          return l.replace(/^\s*(ภาพที่|ภาพประกอบที่)\s*[\d๐-๙]+(\.[\d๐-๙]+)*\s*/, 'ภาพที่ ' + n + '.' + fig + ' ');
        }
        if (/^\s*ตารางที่\s*[\d๐-๙]+(\.[\d๐-๙]+)*/.test(l)) {
          tbl++;
          return l.replace(/^\s*ตารางที่\s*[\d๐-๙]+(\.[\d๐-๙]+)*\s*/, 'ตารางที่ ' + n + '.' + tbl + ' ');
        }
        return l;
      });
      out[n] = res.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    });
    return out;
  }

  function writeChapters456(extra) {
    var filled = [4, 5, 6].filter(function (n) { return (S.docs['ch' + n].text || '').trim(); });
    if (filled.length && !confirm('บทที่ ' + filled.join(', ') + ' มีข้อความอยู่แล้ว จะเขียนทับด้วยร่างใหม่?')) {
      return Promise.reject(new Error(''));
    }
    var photoList = resultPhotoList();
    var r = S.results;
    var labelOf = {};
    photoList.forEach(function (p) { labelOf[p.id] = p.label; });

    var getRaw;
    var aiUsed = TFAI.hasKey();
    if (aiUsed) {
      var forAI = photoList.slice(0, 12);
      getRaw = Promise.all(forAI.map(function (p) {
        return TFPhotos.forAI(p.id).then(function (im) { return im ? Object.assign(im, { label: 'รูป ' + p.label }) : null; });
      })).then(function (images) {
        var prompt = TFAI.buildResultsPrompt({
          meta: S.meta,
          ch1: S.docs.ch1.text, ch2: S.docs.ch2.text, ch3: S.docs.ch3.text,
          results: {
            notes: r.notes, usage: r.usage, share: r.share, suggestions: r.suggestions,
            trials: r.trials.map(function (t) { return Object.assign({}, t, { photoLabel: labelOf[t.photo] || '' }); })
          },
          photoList: forAI,
          titles: { 4: TFTemplates.CHAPTERS[4].title, 5: TFTemplates.CHAPTERS[5].title, 6: TFTemplates.CHAPTERS[6].title },
          extra: extra
        });
        return TFAI.generate({ text: prompt, images: images.filter(Boolean) }, TFAI.SYSTEM_RESULTS);
      });
      photoList = forAI;
    } else {
      getRaw = Promise.resolve(fallbackChapters(photoList));
    }

    return getRaw.then(function (raw) {
      var ch = finalizeChapters(raw, photoList);
      var written = [];
      [4, 5, 6].forEach(function (n) {
        if (!ch[n]) return;
        S.docs['ch' + n].text = ch[n];
        S.docs['ch' + n].overrides = {};
        // หัวข้อมีเครื่องหมาย # กำกับครบแล้ว จึงปิดการเดาหัวข้อจากบรรทัดสั้น (ไม่ให้ย่อหน้าสั้นกลายเป็นหัวข้อ)
        S.docs['ch' + n].smart = false;
        written.push(n);
      });
      if (!written.length) throw new Error('ไม่สามารถแยกบทจากคำตอบได้ ลองกดใหม่อีกครั้ง');
      save();
      var missing = [4, 5, 6].filter(function (n) { return written.indexOf(n) < 0; });
      return {
        written: written,
        message: (aiUsed ? '✅ AI เขียนเสร็จ' : '✅ สร้างร่างจากข้อมูลที่กรอกแล้ว (ยังไม่ได้ใช้ AI)') +
          ' — บทที่ ' + written.join(', ') +
          (missing.length ? ' · ⚠ ไม่ได้บทที่ ' + missing.join(', ') + ' (คำตอบอาจยาวเกิน ลองกดใหม่)' : '') +
          ' · ตรวจทุกย่อหน้าให้ตรงกับที่ทำจริงก่อนส่ง'
      };
    });
  }

  /** โหลดรูปที่ใช้ในบล็อกทั้งหมด (สำหรับฝังลงไฟล์ Word) */
  function imagesFor(blockLists) {
    var ids = [];
    blockLists.forEach(function (bs) { (bs || []).forEach(function (b) { if (b.type === 'image') ids.push(b.photoId); }); });
    return ids.length ? TFPhotos.collect(ids) : Promise.resolve({});
  }

  /* ==================================================================
   * ส่งออกเอกสารเดี่ยว
   * ================================================================== */
  function exportSingle(docId, tab) {
    var blocks = docBlocks(docId);
    if (!blocks.length) { toast('ยังไม่มีข้อความให้ส่งออก', true); return; }

    var name = tab.chapter ? ('บทที่-' + tab.chapter) : tab.label;
    imagesFor([blocks])
      .then(function (images) {
        return TFDocx.buildSingle(blocks, S.spec, { title: S.meta.titleTh, author: S.meta.authorsTh }, null, images);
      })
      .then(function (blob) {
        TFDocx.download(blob, name + '.docx');
        toast('สร้างไฟล์ ' + name + '.docx แล้ว');
      })
      .catch(function (e) { console.error(e); toast('สร้างไฟล์ไม่สำเร็จ: ' + e.message, true); });
  }

  /* ==================================================================
   * ส่วนหน้า
   * ================================================================== */
  function field(labelText, value, onInput, opt) {
    opt = opt || {};
    var input = opt.multiline
      ? el('textarea', { oninput: function () { onInput(input.value); } })
      : el('input', { type: 'text', oninput: function () { onInput(input.value); } });
    input.value = value || '';
    if (opt.placeholder) input.setAttribute('placeholder', opt.placeholder);
    return el('div', { class: 'field' + (opt.wide ? ' wide' : '') }, [
      el('label', { text: labelText }), input
    ]);
  }

  function checkbox(labelText, checked, onChange) {
    var input = el('input', { type: 'checkbox', onchange: function () { onChange(input.checked); } });
    input.checked = !!checked;
    return el('label', { class: 'opt chk' }, [input, el('span', { text: labelText })]);
  }

  function buildFront() {
    var m = S.meta, f = S.front;
    var pre = currentPreset();
    var wrap = el('div', { class: 'form-page' });

    wrap.appendChild(el('p', {
      class: 'notice',
      text: 'กรอกข้อมูลโครงงานที่นี่ครั้งเดียว โปรแกรมจะนำไปสร้าง ปก หน้ารับรอง บทคัดย่อ กิตติกรรมประกาศ และสารบัญ ให้อัตโนมัติในแท็บ “ส่งออกทั้งเล่ม” · ขณะนี้ใช้รูปแบบ: ' + pre.label
    }));

    // ---- ข้อมูลโครงงาน ----
    var c1 = el('div', { class: 'card' }, [el('h2', { text: 'ข้อมูลโครงงาน' })]);
    var g1 = el('div', { class: 'grid2' });
    [
      ['ชื่อโครงงาน (ไทย)', 'titleTh', { wide: true, multiline: true, placeholder: 'ถ้าชื่อยาว กด Enter ขึ้นบรรทัดใหม่เพื่อแบ่งบรรทัดบนหน้าปก' }],
      ['ชื่อโครงงาน (อังกฤษ) — ถ้ามี', 'titleEn', { wide: true }],
      ['รหัสโครงงาน — ถ้ามี', 'projectCode', { placeholder: 'เช่น ว-2568-012' }],
      ['ชื่อผู้จัดทำ', 'authorsTh', { wide: true, multiline: true, placeholder: 'พิมพ์บรรทัดละ 1 คน\nอยากให้ชื่อ-นามสกุล-เลขที่ ตรงเป็นคอลัมน์ ให้คั่นด้วย |\nเด็กหญิงสมหญิง | ใจดี | เลขที่ 12\nเด็กชายสมชาย | เก่งกล้า | เลขที่ 15' }],
      ['ชื่อผู้จัดทำ (อังกฤษ) — ถ้ามี', 'authorsEn', { wide: true, multiline: true }],
      ['ระดับชั้น', 'gradeLevel', { placeholder: 'มัธยมศึกษาปีที่ 2' }],
      ['รายวิชา', 'subjectTh', { placeholder: 'เช่น วิทยาศาสตร์ 2 (ว22102)' }],
      ['กลุ่มสาระการเรียนรู้', 'learningArea', { placeholder: 'เช่น วิทยาศาสตร์และเทคโนโลยี' }],
      ['โรงเรียน', 'schoolTh'],
      ['ภาคเรียนที่ — ถ้ามี', 'termTh', { placeholder: 'เช่น 1' }],
      ['ปีการศึกษา', 'yearTh', { placeholder: '2568' }],
      ['School (English) — ถ้ามี', 'schoolEn'],
      ['Academic year (ค.ศ.) — ถ้ามี', 'yearEn']
    ].forEach(function (r) {
      g1.appendChild(field(r[0], m[r[1]], function (v) { m[r[1]] = v; save(); }, r[2]));
    });
    c1.appendChild(g1);
    wrap.appendChild(c1);

    // ---- ครูที่ปรึกษาและผู้รับรอง ----
    var c2 = el('div', { class: 'card' }, [
      el('h2', { text: 'ครูที่ปรึกษาและผู้รับรอง' }),
      el('p', { class: 'hint', text: 'ช่องไหนเว้นว่างไว้ จะไม่ปรากฏในหน้ารับรอง' })
    ]);
    var g2 = el('div', { class: 'grid2' });
    [
      ['ครูที่ปรึกษาโครงงาน', 'teacher1', { placeholder: 'เช่น นายสราวุธ ใจงาม' }],
      ['ครูที่ปรึกษาร่วม (ถ้ามี)', 'teacher2'],
      ['หัวหน้ากลุ่มสาระการเรียนรู้', 'headOfArea'],
      ['ผู้อำนวยการโรงเรียน', 'director'],
      ['วันที่อนุมัติ', 'approvalDate', { placeholder: 'เช่น 15 กันยายน 2568' }],
      ['ครูที่ปรึกษา (อังกฤษ) — ถ้ามี', 'teacher1En']
    ].forEach(function (r) {
      g2.appendChild(field(r[0], m[r[1]], function (v) { m[r[1]] = v; save(); }, r[2]));
    });
    c2.appendChild(g2);
    wrap.appendChild(c2);

    // ---- บทคัดย่อ ----
    var c3 = el('div', { class: 'card' }, [
      el('h2', { text: 'บทคัดย่อ / Abstract / กิตติกรรมประกาศ' }),
      el('p', { class: 'hint', text: 'ขึ้นย่อหน้าใหม่ด้วยการเว้นบรรทัด' })
    ]);
    var g3 = el('div', { class: 'grid2' });
    g3.appendChild(field('บทคัดย่อ (ภาษาไทย)', S.abstracts.th, function (v) { S.abstracts.th = v; save(); }, { multiline: true, wide: true }));
    g3.appendChild(field('คำสำคัญ (ไทย)', m.keywordsTh, function (v) { m.keywordsTh = v; save(); }, { wide: true }));
    g3.appendChild(field('Abstract (English)', S.abstracts.en, function (v) { S.abstracts.en = v; save(); }, { multiline: true, wide: true }));
    g3.appendChild(field('Keywords (English)', m.keywordsEn, function (v) { m.keywordsEn = v; save(); }, { wide: true }));
    g3.appendChild(field('กิตติกรรมประกาศ', S.ack, function (v) { S.ack = v; save(); }, { multiline: true, wide: true }));
    c3.appendChild(g3);
    wrap.appendChild(c3);

    // ---- สารบัญตาราง/ภาพ ----
    var c4 = el('div', { class: 'card' }, [
      el('h2', { text: 'สารบัญตาราง / ' + pre.figureListTitle }),
      el('p', { class: 'hint', text: 'พิมพ์บรรทัดละ 1 รายการ รูปแบบ:  เลขที่ | ชื่อเรื่อง | เลขหน้า   (เช่น  4.1 | ผลการทดลองครั้งที่ 1 | 18)' })
    ]);
    var g4 = el('div', { class: 'grid2' });
    g4.appendChild(field('สารบัญตาราง', f.tables, function (v) { f.tables = v; save(); }, { multiline: true, wide: true, placeholder: '4.1 | ผลการทดลองปลูกต้นไม้ | 18' }));
    g4.appendChild(field(pre.figureListTitle, f.figures, function (v) { f.figures = v; save(); }, { multiline: true, wide: true, placeholder: '3.1 | ขั้นตอนการประดิษฐ์กระถาง | 12' }));
    c4.appendChild(g4);
    wrap.appendChild(c4);

    // ---- ตัวอย่างส่วนหน้า ----
    var c5 = el('div', { class: 'card' }, [el('h2', { text: 'ตัวอย่างส่วนหน้า' })]);
    var pv = el('div', { class: 'preview' });
    var scroll = el('div', { class: 'preview-scroll' }, [pv]);
    c5.appendChild(scroll);
    wrap.appendChild(c5);

    setTimeout(function () {
      pv.style.zoom = 0.6;
      TFPreview.render(pv, buildFrontBlocks().blocks, S.spec, {
        startPage: 1, pageNumFormat: S.spec.pageNumber.frontFormat, showPageNumber: true
      });
    }, 0);

    return wrap;
  }

  /** สร้างบล็อกของส่วนหน้าทั้งหมด (ยกเว้นปก ซึ่งอยู่คนละ section) */
  function buildFrontBlocks() {
    var f = S.front, m = S.meta, spec = S.spec;
    var blocks = [];
    var marks = [];   // จุดเริ่มของแต่ละส่วน (ใช้ทำสารบัญ)

    function part(name, arr) {
      if (!arr || !arr.length) return;
      arr[0] = Object.assign({}, arr[0], { pageBreakBefore: blocks.length > 0 });
      if (name) marks.push({ name: name, index: blocks.length });
      blocks = blocks.concat(arr);
    }

    // ปกไม่มีเลขหน้าและไม่นับในสารบัญ แต่ต้องเห็นในตัวอย่างด้วย
    if (f.coverTh)     part('', TFFront.cover(m, spec, 'th'));
    if (f.coverInner)  part('', TFFront.cover(m, spec, 'th'));
    if (f.coverEn)     part('', TFFront.cover(m, spec, 'en'));
    if (f.approval)    part('หน้าอนุมัติ', TFFront.approval(m, spec));
    if (f.abstractTh)  part('บทคัดย่อภาษาไทย', TFFront.abstractTh(m, spec, S.abstracts.th));
    if (f.abstractEn)  part('บทคัดย่อภาษาอังกฤษ', TFFront.abstractEn(m, spec, S.abstracts.en));
    if (f.ack)         part('กิตติกรรมประกาศ', TFFront.acknowledgement(S.ack, m, spec));

    return { blocks: blocks, marks: marks };
  }

  function parseListItems(text) {
    return TFParser.normalize(text).split('\n')
      .map(function (s) { return s.trim(); })
      .filter(Boolean)
      .map(function (s) {
        var p = s.split('|').map(function (x) { return x.trim(); });
        return { no: p[0] || '', text: p[1] || '', page: p[2] || '' };
      });
  }

  /* ==================================================================
   * ประวัติผู้จัดทำ (รองรับหลายคน — โครงงานมักทำเป็นกลุ่ม)
   * ================================================================== */
  function buildVita() {
    var pre = currentPreset();
    if (!Array.isArray(S.vita)) S.vita = [emptyPerson()];
    if (!S.vita.length) S.vita.push(emptyPerson());

    var wrap = el('div', { class: 'editor' });
    var left = el('div', { class: 'pane' });
    var pv = el('div', { class: 'preview' });

    function refresh() {
      pv.style.zoom = 0.7;
      TFPreview.render(pv, TFFront.vita(S.vita, S.spec), S.spec, { startPage: 1 });
    }

    function renderForms() {
      left.innerHTML = '';
      left.appendChild(el('div', { class: 'pane-head' }, [
        el('h2', { class: 'pane-title', text: pre.vitaTitle }),
        el('div', { class: 'pane-tools' }, [
          el('button', {
            class: 'btn tiny', text: '+ เพิ่มผู้จัดทำ',
            onclick: function () { S.vita.push(emptyPerson()); save(); renderForms(); refresh(); }
          })
        ])
      ]));
      left.appendChild(el('p', {
        class: 'hint',
        text: 'โครงงานที่ทำเป็นกลุ่ม กด “เพิ่มผู้จัดทำ” เพื่อใส่ประวัติของเพื่อนร่วมกลุ่มได้ · ช่องที่มีหลายบรรทัดกด Enter ขึ้นบรรทัดใหม่ได้'
      }));

      S.vita.forEach(function (person, idx) {
        var card = el('div', { class: 'card', style: 'margin-bottom:12px' });
        card.appendChild(el('div', { class: 'pane-head' }, [
          el('h2', { text: 'ผู้จัดทำคนที่ ' + (idx + 1), style: 'font-size:14.5px' }),
          S.vita.length > 1 ? el('button', {
            class: 'btn tiny danger', text: 'ลบ',
            onclick: function () {
              if (!confirm('ลบประวัติผู้จัดทำคนที่ ' + (idx + 1) + '?')) return;
              S.vita.splice(idx, 1);
              if (!S.vita.length) S.vita.push(emptyPerson());
              save(); renderForms(); refresh();
            }
          }) : null
        ]));
        var g = el('div', { class: 'grid2' });
        pre.vitaFields.forEach(function (fd) {
          g.appendChild(field(fd.label, person[fd.key], function (v) {
            person[fd.key] = v; save(); refresh();
          }, { multiline: !!fd.multiline, wide: !!fd.multiline }));
        });
        card.appendChild(g);
        left.appendChild(card);
      });
    }

    var right = el('div', { class: 'pane' }, [
      el('div', { class: 'pane-head' }, [
        el('h2', { class: 'pane-title', text: 'ตัวอย่างเอกสาร' }),
        el('div', { class: 'pane-tools' }, [
          el('button', {
            class: 'btn primary', text: '⬇ ดาวน์โหลด .docx',
            onclick: function () {
              TFDocx.buildSingle(TFFront.vita(S.vita, S.spec), S.spec,
                { title: S.meta.titleTh, author: S.meta.authorsTh })
                .then(function (b) { TFDocx.download(b, pre.vitaTitle + '.docx'); toast('สร้างไฟล์แล้ว'); });
            }
          })
        ])
      ]),
      el('div', { class: 'preview-scroll' }, [pv])
    ]);

    renderForms();
    setTimeout(refresh, 0);

    wrap.appendChild(left);
    wrap.appendChild(right);
    return wrap;
  }

  /* ==================================================================
   * ผู้ช่วย AI
   * ================================================================== */

  /** ร่างบทหนึ่งด้วย AI แล้วใส่ลงในช่องข้อความของบทนั้น */
  function aiDraftChapter(chapter, extra) {
    var ch1 = (S.docs.ch1 && S.docs.ch1.text || '').trim();
    if (!ch1) return Promise.reject(new Error('ต้องเขียนบทที่ 1 ก่อน แล้ว AI จึงจะร่างบทอื่นให้ได้'));
    var prompt = TFAI.buildPrompt(chapter, ch1, S.meta, extra);
    return TFAI.generate(prompt).then(function (text) {
      var clean = TFAI.cleanOutput(text);
      if (!clean) throw new Error('AI ตอบกลับมาว่าง');
      S.docs['ch' + chapter].text = clean;
      S.docs['ch' + chapter].overrides = {};
      save();
      return clean;
    });
  }

  function buildAI() {
    var wrap = el('div', { class: 'form-page' });
    var cfg = TFAI.loadConfig();

    wrap.appendChild(el('p', {
      class: 'notice warn',
      html: '<b>อ่านก่อนใช้</b> — AI ช่วย<b>ร่าง</b>โครงเนื้อหาเท่านั้น ไม่ได้ทำโครงงานแทนนักเรียน ' +
            'ข้อความที่ได้ต้องให้นักเรียนอ่าน แก้ไข และเติมผลจริงด้วยตนเองทุกครั้ง ' +
            'โดยเฉพาะ<b>ผลการทดลองและรายการอ้างอิง AI อาจแต่งขึ้นเองได้</b> ต้องตรวจสอบก่อนใช้เสมอ'
    }));

    // ---- ตั้งค่าคีย์ ----
    var c1 = el('div', { class: 'card' }, [
      el('h2', { text: 'เชื่อมต่อ AI' }),
      el('p', {
        class: 'hint',
        html: 'เว็บนี้ไม่มีเซิร์ฟเวอร์ จึงต้องใช้ <b>คีย์ของคุณเอง</b> คีย์เก็บอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น ' +
              'ไม่ถูกส่งไปที่ใดนอกจากผู้ให้บริการที่เลือก และ<b>ไม่ติดไปกับไฟล์ “บันทึกงาน”</b>'
      })
    ]);

    var g1 = el('div', { class: 'grid2' });

    var provSel = el('select', {
      onchange: function () {
        cfg.provider = provSel.value;
        cfg.model = TFAI.PROVIDERS[cfg.provider].defaultModel;
        TFAI.saveConfig(cfg);
        renderMain();
      }
    });
    TFAI.PROVIDER_ORDER.forEach(function (id) {
      provSel.appendChild(el('option', { value: id, text: TFAI.PROVIDERS[id].label }));
    });
    provSel.value = cfg.provider;
    g1.appendChild(el('div', { class: 'field' }, [el('label', { text: 'ผู้ให้บริการ' }), provSel]));

    var prov = TFAI.PROVIDERS[cfg.provider];
    g1.appendChild(field('ชื่อโมเดล', cfg.model, function (v) { cfg.model = v; TFAI.saveConfig(cfg); }));

    var keyInput = el('input', {
      type: 'password',
      placeholder: 'วางคีย์ที่นี่',
      oninput: function () { cfg.key = keyInput.value; TFAI.saveConfig(cfg); }
    });
    keyInput.value = cfg.key || '';
    g1.appendChild(el('div', { class: 'field wide' }, [
      el('label', { text: 'คีย์ (API key)' }), keyInput,
      el('p', { class: 'hint small', html: prov.note + ' · <a href="' + prov.keyUrl + '" target="_blank" rel="noopener">ขอคีย์ที่นี่</a>' })
    ]));

    c1.appendChild(g1);

    var status = el('span', { class: 'meta' });
    var testBtn = el('button', {
      class: 'btn', text: 'ทดสอบการเชื่อมต่อ',
      onclick: function () {
        status.textContent = 'กำลังทดสอบ…';
        testBtn.disabled = true;
        TFAI.test()
          .then(function (t) { status.textContent = '✅ ใช้งานได้ — ' + t; })
          .catch(function (e) { status.textContent = '❌ ' + e.message; })
          .then(function () { testBtn.disabled = false; });
      }
    });
    c1.appendChild(el('div', { class: 'pane-tools', style: 'margin-top:10px' }, [
      testBtn,
      el('button', {
        class: 'btn ghost danger', text: 'ลบคีย์ออกจากเครื่อง',
        onclick: function () {
          if (!confirm('ลบคีย์ที่เก็บไว้ในเบราว์เซอร์นี้?')) return;
          TFAI.clearConfig(); renderMain(); toast('ลบคีย์แล้ว');
        }
      }),
      status
    ]));
    wrap.appendChild(c1);

    // ---- สร้างบท ----
    var c2 = el('div', { class: 'card' }, [
      el('h2', { text: 'ให้ AI ร่างบทที่ 2–5 จากบทที่ 1' }),
      el('p', {
        class: 'hint',
        text: 'AI จะอ่านบทที่ 1 ที่นักเรียนเขียนไว้ แล้วร่างบทอื่นให้ในรูปแบบที่โปรแกรมนำไปจัดหน้าได้ทันที — ข้อความเดิมในบทนั้นจะถูกแทนที่'
      })
    ]);

    var extraBox = el('textarea', { placeholder: 'คำสั่งเพิ่มเติม (ไม่บังคับ) เช่น "เน้นเรื่องพลังงานทดแทน" หรือ "ให้มี 4 หัวข้อหลัก"' });
    extraBox.style.minHeight = '70px';
    c2.appendChild(el('div', { class: 'field' }, [el('label', { text: 'คำสั่งเพิ่มเติมถึง AI' }), extraBox]));

    var log = el('div', { class: 'ai-log' });
    var ch1Empty = !(S.docs.ch1.text || '').trim();

    if (ch1Empty) {
      c2.appendChild(el('p', { class: 'notice warn', text: 'ยังไม่มีเนื้อหาบทที่ 1 — กรุณาเขียนบทที่ 1 ก่อน' }));
    }

    var list = el('div', { class: 'export-list' });
    [2, 3, 4, 5, 6].forEach(function (n) {
      var info = TFTemplates.CHAPTERS[n];
      var has = (S.docs['ch' + n].text || '').trim().length > 0;
      var btn = el('button', {
        class: 'btn tiny', text: has ? 'ร่างใหม่ (ทับของเดิม)' : '✨ ให้ AI ร่าง',
        onclick: function () {
          if (has && !confirm('บทที่ ' + n + ' มีข้อความอยู่แล้ว จะให้ AI เขียนทับ?')) return;
          btn.disabled = true; btn.textContent = 'กำลังร่าง…';
          aiDraftChapter(n, extraBox.value)
            .then(function () { toast('ร่างบทที่ ' + n + ' เสร็จแล้ว'); renderMain(); })
            .catch(function (e) {
              btn.disabled = false; btn.textContent = '✨ ให้ AI ร่าง';
              log.textContent = 'บทที่ ' + n + ': ' + e.message;
            });
        }
      });
      btn.disabled = ch1Empty;
      list.appendChild(el('div', { class: 'export-row' }, [
        el('div', { style: 'flex:1' }, [
          el('strong', { text: 'บทที่ ' + n + '  ' + info.title }),
          el('div', { class: 'meta', text: has ? 'มีข้อความแล้ว ' + docBlocks('ch' + n).length + ' ย่อหน้า' : 'ยังว่าง' })
        ]),
        btn
      ]));
    });
    c2.appendChild(list);

    var allBtn = el('button', { class: 'btn primary', text: '✨ ร่างบทที่ 2–5 ทั้งหมด', style: 'margin-top:12px' });
    allBtn.disabled = ch1Empty;
    allBtn.addEventListener('click', function () {
      if (!confirm('ให้ AI ร่างบทที่ 2 ถึง 5 ทั้งหมด?\nข้อความเดิมในบทเหล่านั้นจะถูกเขียนทับ')) return;
      allBtn.disabled = true;
      var chapters = [2, 3, 4, 5];
      var i = 0;
      log.textContent = '';
      (function next() {
        if (i >= chapters.length) {
          allBtn.disabled = false;
          toast('ร่างครบทุกบทแล้ว');
          renderMain();
          return;
        }
        var n = chapters[i++];
        allBtn.textContent = 'กำลังร่างบทที่ ' + n + '… (' + i + '/4)';
        aiDraftChapter(n, extraBox.value)
          .then(function () { log.textContent += 'บทที่ ' + n + ': เสร็จแล้ว\n'; next(); })
          .catch(function (e) {
            log.textContent += 'บทที่ ' + n + ': ' + e.message + '\n';
            next();
          });
      })();
    });
    c2.appendChild(allBtn);
    c2.appendChild(log);
    wrap.appendChild(c2);

    // ---- บทคัดย่อ ----
    var c3 = el('div', { class: 'card' }, [
      el('h2', { text: 'ให้ AI ร่างบทคัดย่อ' }),
      el('p', { class: 'hint', text: 'อ่านทุกบทที่เขียนไว้ แล้วสรุปเป็นบทคัดย่อ ผลลัพธ์จะไปอยู่ในแท็บ “ส่วนหน้า”' })
    ]);
    var absBtn = el('button', {
      class: 'btn', text: '✨ ร่างบทคัดย่อ',
      onclick: function () {
        var all = [1, 2, 3, 4, 5, 6].map(function (n) { return S.docs['ch' + n].text || ''; })
          .filter(Boolean).join('\n\n');
        if (!all.trim()) { toast('ยังไม่มีเนื้อหาให้สรุป', true); return; }
        absBtn.disabled = true; absBtn.textContent = 'กำลังร่าง…';
        TFAI.generate(TFAI.buildAbstractPrompt(all, S.meta))
          .then(function (t) {
            S.abstracts.th = TFAI.cleanOutput(t);
            save();
            toast('ร่างบทคัดย่อแล้ว — ดูได้ที่แท็บ “ส่วนหน้า”');
          })
          .catch(function (e) { log.textContent = e.message; })
          .then(function () { absBtn.disabled = false; absBtn.textContent = '✨ ร่างบทคัดย่อ'; });
      }
    });
    c3.appendChild(absBtn);
    wrap.appendChild(c3);

    // ---- สิ่งที่ AI จะไม่ทำให้ ----
    var c4 = el('div', { class: 'card help' });
    c4.appendChild(el('h2', { text: 'สิ่งที่ AI จะไม่ทำให้ (โดยตั้งใจ)' }));
    c4.appendChild(el('ul', {
      html:
        '<li><b>ไม่แต่งผลการทดลอง</b> — จะเว้นเป็นวงเล็บให้นักเรียนกรอกผลจริง</li>' +
        '<li><b>ไม่แต่งรายการบรรณานุกรม</b> — AI มักสร้างชื่อหนังสือและงานวิจัยที่ไม่มีอยู่จริง นักเรียนต้องค้นและพิมพ์เอง</li>' +
        '<li><b>ไม่เปลี่ยนหัวข้อโครงงาน</b> — ร่างต่อยอดจากบทที่ 1 เท่านั้น</li>' +
        '<li>ผลลัพธ์เป็นเพียง<b>ร่างแรก</b> ครูที่ปรึกษาและนักเรียนต้องตรวจและแก้ทุกครั้ง</li>'
    }));
    wrap.appendChild(c4);

    return wrap;
  }

  /* ==================================================================
   * ตั้งค่ารูปแบบ
   * ================================================================== */
  function numInput(value, onChange, step) {
    var i = el('input', {
      type: 'number', step: step || 1,
      onchange: function () { onChange(parseFloat(i.value) || 0); }
    });
    i.value = value;
    return i;
  }

  function selectInput(options, value, onChange) {
    var s = el('select', { onchange: function () { onChange(s.value); } });
    options.forEach(function (o) { s.appendChild(el('option', { value: o[0], text: o[1] })); });
    s.value = value;
    return s;
  }

  function buildSettings() {
    var spec = S.spec;
    var wrap = el('div', { class: 'form-page' });

    wrap.appendChild(el('p', {
      class: 'notice',
      text: 'รูปแบบปัจจุบัน: ' + currentPreset().label + ' — ' + currentPreset().note
    }));
    wrap.appendChild(el('p', {
      class: 'preset-note',
      text: 'ค่าทั้งหมดสกัดมาจากไฟล์ต้นแบบจริง เปลี่ยนชุดรูปแบบได้จากช่อง “รูปแบบ” มุมขวาบน หรือปรับทีละค่าที่นี่ก็ได้'
    }));

    var rerender = function () { save(); renderMain(); };

    // ---- ปุ่มคืนค่าตามชุดรูปแบบ ----
    wrap.appendChild(el('div', { class: 'card' }, [
      el('h2', { text: 'คืนค่าตามชุดรูปแบบ' }),
      el('p', { class: 'hint', text: 'ตั้งค่าทุกอย่างกลับไปตามต้นแบบของสถาบันที่เลือกไว้' }),
      el('div', { class: 'pane-tools' }, TFTemplates.PRESET_ORDER.map(function (id) {
        var p = TFTemplates.PRESETS[id];
        return el('button', {
          class: 'btn' + (id === S.presetId ? ' primary' : ''),
          text: p.label,
          onclick: function () {
            if (!confirm('ตั้งค่ารูปแบบทั้งหมดตาม "' + p.label + '" ?')) return;
            applyPreset(id);
            renderPresetSelect();
            renderMain();
            toast('ใช้รูปแบบ ' + p.label + ' แล้ว');
          }
        });
      }))
    ]));

    // ---- หน้ากระดาษ ----
    var cPage = el('div', { class: 'card' }, [el('h2', { text: 'หน้ากระดาษ (หน่วย: พอยต์ — 72 pt = 1 นิ้ว = 2.54 ซม.)' })]);
    var tPage = el('table', { class: 'spec-table' });
    [
      ['ความกว้างกระดาษ', 'width'], ['ความสูงกระดาษ', 'height'],
      ['ขอบบน', 'marginTop'], ['ขอบล่าง', 'marginBottom'],
      ['ขอบซ้าย', 'marginLeft'], ['ขอบขวา', 'marginRight'],
      ['ระยะหัวกระดาษ', 'headerDistance'], ['ระยะท้ายกระดาษ', 'footerDistance']
    ].forEach(function (r) {
      var td = el('td');
      td.appendChild(numInput(spec.page[r[1]], function (v) { spec.page[r[1]] = v; save(); }, 0.1));
      var cm = el('td', { class: 'meta', text: (spec.page[r[1]] / 28.3465).toFixed(2) + ' ซม.' });
      tPage.appendChild(el('tr', {}, [el('th', { text: r[0] }), td, cm]));
    });
    cPage.appendChild(tPage);
    cPage.appendChild(el('div', { class: 'pane-tools', style: 'margin-top:10px' }, [
      el('button', {
        class: 'btn tiny', text: 'A4 มาตรฐาน',
        onclick: function () { Object.assign(spec.page, { width: 595.3, height: 841.9 }); rerender(); }
      }),
      el('button', {
        class: 'btn tiny', text: 'ขอบ 1.5/1/1.5/1 นิ้ว (ตามต้นแบบ)',
        onclick: function () {
          Object.assign(spec.page, { marginTop: 108, marginBottom: 72, marginLeft: 108, marginRight: 72 });
          rerender();
        }
      })
    ]));
    wrap.appendChild(cPage);

    // ---- ฟอนต์ + ระยะบรรทัด ----
    var cFont = el('div', { class: 'card' }, [el('h2', { text: 'แบบอักษรและระยะบรรทัด' })]);
    var gFont = el('div', { class: 'grid2' });
    gFont.appendChild(field('ชื่อฟอนต์ (ต้องมีในเครื่องที่เปิดไฟล์)', spec.font.name, function (v) {
      spec.font.name = v;
      spec.font.fallback = "'" + v + "','Angsana New','TH SarabunPSK','TH Sarabun New',serif";
      save();
    }));
    var fPreset = el('div', { class: 'field' }, [
      el('label', { text: 'ฟอนต์ที่ใช้บ่อย' }),
      selectInput([
        ['AngsanaUPC', 'AngsanaUPC (ตามต้นแบบ)'],
        ['Angsana New', 'Angsana New'],
        ['TH SarabunPSK', 'TH SarabunPSK'],
        ['TH Sarabun New', 'TH Sarabun New'],
        ['Browallia New', 'Browallia New'],
        ['Cordia New', 'Cordia New']
      ], spec.font.name, function (v) {
        spec.font.name = v;
        spec.font.fallback = "'" + v + "','Angsana New','TH SarabunPSK',serif";
        rerender();
      })
    ]);
    gFont.appendChild(fPreset);

    var lsWrap = el('div', { class: 'field' }, [
      el('label', { text: 'ระยะระหว่างบรรทัด' }),
      selectInput([
        ['single', 'บรรทัดเดี่ยว (ตามต้นแบบ)'],
        ['onehalf', '1.5 บรรทัด'],
        ['double', '2 บรรทัด'],
        ['exact', 'กำหนดเป็นพอยต์'],
        ['multiple', 'คูณจากบรรทัดเดี่ยว']
      ], spec.lineSpacing.rule, function (v) { spec.lineSpacing.rule = v; rerender(); })
    ]);
    gFont.appendChild(lsWrap);
    if (spec.lineSpacing.rule === 'exact' || spec.lineSpacing.rule === 'multiple') {
      gFont.appendChild(field(spec.lineSpacing.rule === 'exact' ? 'ค่าพอยต์' : 'ตัวคูณ',
        spec.lineSpacing.value, function (v) { spec.lineSpacing.value = parseFloat(v) || 1; save(); }));
    }
    cFont.appendChild(gFont);
    wrap.appendChild(cFont);

    // ---- ตารางสไตล์ย่อหน้า ----
    var cSty = el('div', { class: 'card' }, [
      el('h2', { text: 'รูปแบบย่อหน้าแต่ละประเภท' }),
      el('p', { class: 'hint', text: 'ขนาด = พอยต์ · เยื้อง/บรรทัดแรก/ระยะห่าง = พอยต์ (54 pt ≈ 1.9 ซม.)' })
    ]);
    var tSty = el('table', { class: 'spec-table' });
    tSty.appendChild(el('tr', {}, ['ประเภท', 'ขนาด', 'หนา', 'จัดชิด', 'เยื้องซ้าย', 'บรรทัดแรก', 'แขวน', 'ก่อน', 'หลัง']
      .map(function (h) { return el('th', { text: h }); })));

    Object.keys(TFTemplates.BLOCK_LABELS).forEach(function (key) {
      var st = spec.styles[key];
      if (!st) return;
      var cells = [el('th', { text: TFTemplates.BLOCK_LABELS[key] })];

      cells.push(el('td', {}, [numInput(st.size, function (v) { st.size = v; save(); }, 0.5)]));

      var cb = el('input', { type: 'checkbox', onchange: function () { st.bold = cb.checked; save(); } });
      cb.checked = !!st.bold;
      cells.push(el('td', {}, [cb]));

      cells.push(el('td', {}, [selectInput([
        ['left', 'ซ้าย'], ['center', 'กึ่งกลาง'], ['right', 'ขวา'],
        ['both', 'ชิดขอบ'], ['thaiDistribute', 'ชิดขอบ (ไทย)']
      ], st.align, function (v) { st.align = v; save(); })]));

      ['indent', 'firstLine', 'hanging', 'before', 'after'].forEach(function (k) {
        cells.push(el('td', {}, [numInput(st[k] || 0, function (v) {
          st[k] = v;
          if (k === 'hanging' && v) st.firstLine = 0;
          if (k === 'firstLine' && v) st.hanging = 0;
          save();
        }, 1)]));
      });

      tSty.appendChild(el('tr', {}, cells));
    });
    cSty.appendChild(tSty);
    cSty.appendChild(el('div', { class: 'pane-tools', style: 'margin-top:10px' }, [
      el('button', {
        class: 'btn tiny danger', text: 'คืนค่ามาตรฐานทั้งหมด',
        onclick: function () {
          if (!confirm('คืนค่ารูปแบบทั้งหมดกลับเป็นค่ามาตรฐานของ ' + currentPreset().label + ' ?')) return;
          applyPreset(S.presetId);
          rerender(); toast('คืนค่ามาตรฐานแล้ว');
        }
      })
    ]));
    wrap.appendChild(cSty);

    // ---- การตัดคำไทย ----
    var cTb = el('div', { class: 'card' }, [
      el('h2', { text: 'การขึ้นบรรทัดใหม่ของข้อความไทย' }),
      el('p', { class: 'hint', text:
        'Word จะตัดบรรทัดภาษาไทยตามคำได้ ก็ต่อเมื่อเครื่องนั้นติดตั้งภาษาไทยไว้ ' +
        'ถ้าไม่ได้ติดตั้ง Word จะตัดที่ช่องว่างอย่างเดียว ทำให้ขอบขวาไม่ตรงกัน ' +
        'หรือมีช่องว่างกลางคำ เมื่อเปิดตัวเลือกนี้ โปรแกรมจะฝังจุดตัดคำที่มองไม่เห็นไว้ให้ ' +
        'เอกสารจึงออกมาเหมือนกันทุกเครื่อง' })
    ]);
    var gTb = el('div', { class: 'grid2' });
    gTb.appendChild(el('div', { class: 'field' }, [
      checkbox('ฝังจุดตัดคำไทยให้ไฟล์ Word (แนะนำ)',
        spec.options.thaiWordBreak !== false,
        function (v) { spec.options.thaiWordBreak = v; save(); refresh(); })
    ]));
    cTb.appendChild(gTb);
    if (typeof TFThai !== 'undefined' && !TFThai.available()) {
      cTb.appendChild(el('p', { class: 'hint', text:
        'เบราว์เซอร์นี้ตัดคำไทยไม่ได้ จึงข้ามขั้นนี้ไป — ลองใช้ Chrome หรือ Edge รุ่นใหม่' }));
    }
    wrap.appendChild(cTb);

    // ---- เลขหน้า ----
    var cPn = el('div', { class: 'card' }, [el('h2', { text: 'เลขหน้า' })]);
    var gPn = el('div', { class: 'grid2' });
    gPn.appendChild(el('div', { class: 'field' }, [
      checkbox('แสดงเลขหน้า', spec.pageNumber.show, function (v) { spec.pageNumber.show = v; save(); })
    ]));
    gPn.appendChild(el('div', { class: 'field' }, [
      el('label', { text: 'ตำแหน่งเลขหน้า (บนหัวกระดาษ)' }),
      selectInput([['left', 'ชิดซ้าย'], ['center', 'กึ่งกลาง (ตามต้นแบบ)'], ['right', 'ชิดขวา']],
        spec.pageNumber.position, function (v) { spec.pageNumber.position = v; save(); })
    ]));
    gPn.appendChild(el('div', { class: 'field' }, [
      checkbox('ไม่แสดงเลขหน้าที่หน้าแรกของแต่ละบท', spec.pageNumber.hideOnFirstPageOfChapter,
        function (v) { spec.pageNumber.hideOnFirstPageOfChapter = v; save(); })
    ]));
    gPn.appendChild(el('div', { class: 'field' }, [
      el('label', { text: 'รูปแบบเลขหน้าส่วนหน้า' }),
      selectInput([
        ['thaiLetters', 'ก ข ค ฆ ง (ตามต้นแบบ)'],
        ['lowerRoman', 'i ii iii'],
        ['decimal', '1 2 3']
      ], spec.pageNumber.frontFormat, function (v) { spec.pageNumber.frontFormat = v; save(); })
    ]));
    cPn.appendChild(gPn);
    wrap.appendChild(cPn);

    return wrap;
  }

  /* ==================================================================
   * ส่งออกทั้งเล่ม
   * ================================================================== */
  function buildExport() {
    var wrap = el('div', { class: 'form-page' });
    var ep = S.exportParts, f = S.front;

    wrap.appendChild(el('p', {
      class: 'notice',
      text: 'รวมทุกส่วนเป็นไฟล์ Word ไฟล์เดียว โดยแยก section ให้อัตโนมัติ: ส่วนหน้าใช้เลขหน้า ก ข ค · เนื้อเรื่องเริ่มนับ 1 ใหม่ · ทุกบทขึ้นหน้าใหม่'
    }));

    // ---- เลือกส่วนหน้า ----
    var cFront = el('div', { class: 'card' }, [el('h2', { text: 'ส่วนหน้าที่จะรวม' })]);
    var gF = el('div', { class: 'grid2' });
    [
      ['coverTh', 'ปก (ภาษาไทย)'],
      ['coverInner', 'หน้าปกใน (เนื้อหาเหมือนปก ใช้ตอนเข้าเล่ม)'],
      ['coverEn', 'ปก (ภาษาอังกฤษ)'],
      ['approval', 'หน้ารับรองโครงงาน'],
      ['abstractTh', 'บทคัดย่อภาษาไทย'],
      ['abstractEn', 'บทคัดย่อภาษาอังกฤษ (Abstract)'],
      ['ack', 'กิตติกรรมประกาศ'],
      ['toc', 'สารบัญ'],
      ['listTables', 'สารบัญตาราง'],
      ['listFigures', currentPreset().figureListTitle]
    ].forEach(function (r) {
      gF.appendChild(checkbox(r[1], f[r[0]], function (v) { f[r[0]] = v; save(); }));
    });
    cFront.appendChild(gF);
    cFront.appendChild(el('div', { class: 'field', style: 'margin-top:10px;max-width:420px' }, [
      el('label', { text: 'วิธีสร้างสารบัญ' }),
      selectInput([
        ['static', 'สร้างรายการพร้อมเลขหน้าโดยประมาณ'],
        ['field', 'ใช้ฟิลด์สารบัญอัตโนมัติของ Word (กด F9 อัปเดตเลขหน้าจริง)']
      ], f.tocMode, function (v) {
        f.tocMode = v;
        S.spec.options.autoTocField = (v === 'field');
        save();
      })
    ]));
    wrap.appendChild(cFront);

    // ---- เลือกเนื้อเรื่อง ----
    var cBody = el('div', { class: 'card' }, [el('h2', { text: 'เนื้อเรื่องและส่วนท้าย' })]);
    var list = el('div', { class: 'export-list' });
    [
      ['ch1', 'บทที่ 1'], ['ch2', 'บทที่ 2'], ['ch3', 'บทที่ 3'],
      ['ch4', 'บทที่ 4'], ['ch5', 'บทที่ 5'], ['ch6', 'บทที่ 6'],
      ['bib', 'บรรณานุกรม'], ['appendix', 'ภาคผนวก'], ['vita', currentPreset().vitaTitle]
    ].forEach(function (r) {
      var n = r[0] === 'vita'
        ? (S.vita.name ? 'กรอกแล้ว' : 'ยังไม่ได้กรอก')
        : (docBlocks(r[0]).length + ' ย่อหน้า');
      var row = el('div', { class: 'export-row' }, [
        el('div', {}, [
          checkbox('', ep[r[0]], function (v) { ep[r[0]] = v; save(); }),
        ]),
        el('div', { style: 'flex:1' }, [
          el('strong', { text: r[1] }),
          el('div', { class: 'meta', text: n })
        ]),
        el('button', {
          class: 'btn tiny', text: 'ดาวน์โหลดแยกไฟล์',
          onclick: function () {
            if (r[0] === 'vita') {
              TFDocx.buildSingle(TFFront.vita(S.vita, S.spec), S.spec, {})
                .then(function (b) { TFDocx.download(b, currentPreset().vitaTitle + '.docx'); });
              return;
            }
            var tab = TABS.filter(function (t) { return t.id === r[0]; })[0];
            exportSingle(r[0], tab);
          }
        })
      ]);
      // ให้ checkbox อยู่แถวเดียวกันอย่างสวยงาม
      row.firstChild.style.display = 'flex';
      list.appendChild(row);
    });
    cBody.appendChild(list);
    wrap.appendChild(cBody);

    // ---- ปุ่มส่งออก ----
    var cGo = el('div', { class: 'card' }, [
      el('h2', { text: 'สร้างไฟล์' }),
      el('p', { class: 'hint', text: 'เมื่อเปิดใน Word ครั้งแรก แนะนำให้กด Ctrl+A แล้ว F9 เพื่ออัปเดตเลขหน้าและสารบัญ' })
    ]);
    var btn = el('button', { class: 'btn primary', text: '⬇ ดาวน์โหลดรายงานโครงงานทั้งเล่ม (.docx)' });
    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = 'กำลังสร้างไฟล์…';
      exportWholeThesis().then(function () {
        btn.disabled = false;
        btn.textContent = '⬇ ดาวน์โหลดรายงานโครงงานทั้งเล่ม (.docx)';
      });
    });
    cGo.appendChild(btn);
    wrap.appendChild(cGo);

    return wrap;
  }

  function exportWholeThesis() {
    var spec = S.spec, m = S.meta, f = S.front, ep = S.exportParts;
    var sections = [];

    // ---------- 1) ปก (ไม่นับเลขหน้า) ----------
    if (ep.front && f.coverTh) {
      sections.push({ blocks: TFFront.cover(m, spec, 'th'), hidePageNumber: true, pageNumFormat: spec.pageNumber.frontFormat, pageNumStart: 1 });
    }
    // หน้าปกในใช้เนื้อหาชุดเดียวกับปก ต่างกันแค่เป็นคนละหน้า
    if (ep.front && f.coverInner) {
      sections.push({ blocks: TFFront.cover(m, spec, 'th'), hidePageNumber: true, pageNumFormat: spec.pageNumber.frontFormat });
    }
    if (ep.front && f.coverEn) {
      sections.push({ blocks: TFFront.cover(m, spec, 'en'), hidePageNumber: true, pageNumFormat: spec.pageNumber.frontFormat });
    }

    // ---------- 2) เตรียมเนื้อเรื่อง (เพื่อคำนวณเลขหน้าในสารบัญ) ----------
    var bodySections = [];
    ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6'].forEach(function (id) {
      if (!ep[id]) return;
      var b = docBlocks(id);
      if (!b.length) return;
      bodySections.push({ id: id, blocks: b, label: 'บทที่ ' + id.replace('ch', '') });
    });
    if (ep.bib) {
      var bb = docBlocks('bib');
      if (bb.length) bodySections.push({ id: 'bib', blocks: bb, label: '' });
    }
    if (ep.appendix) {
      var ab = docBlocks('appendix');
      if (ab.length) bodySections.push({ id: 'appendix', blocks: ab, label: '' });
    }
    if (ep.vita && (S.vita.name || S.vita.education)) {
      bodySections.push({ id: 'vita', blocks: TFFront.vita(S.vita, spec), label: '' });
    }

    // ประเมินเลขหน้าของแต่ละหัวข้อ
    var tocEntries = [];
    var pageCursor = 1;
    bodySections.forEach(function (sec) {
      var pages = TFPreview.measurePages(sec.blocks, spec);
      var totalPages = pages.length ? pages[pages.length - 1] : 1;
      sec.blocks.forEach(function (b, i) {
        if (b.type === 'chapterTitle' || b.type === 'h1' || b.type === 'h2') {
          tocEntries.push({
            level: b.type === 'chapterTitle' ? 0 : (b.type === 'h1' ? 1 : 2),
            text: b.text,
            page: pageCursor + pages[i] - 1,
            chapterLabel: (b.type === 'chapterTitle' && sec.label) ? sec.label : ''
          });
        }
      });
      pageCursor += totalPages;
    });

    // ---------- 3) ส่วนหน้าที่ใช้เลขหน้าแยกชุด (ก ข ค หรือ i ii iii) ----------
    if (ep.front) {
      var figTitle = currentPreset().figureListTitle;

      // นิยามแต่ละส่วน พร้อมชื่อที่จะไปปรากฏในสารบัญ
      var parts = [];
      if (f.approval)    parts.push({ key: 'approval', build: function () { return TFFront.approval(m, spec); } });
      if (f.abstractTh)  parts.push({ key: 'abstractTh', toc: 'บทคัดย่อ',
                                      build: function () { return TFFront.abstractTh(m, spec, S.abstracts.th); } });
      if (f.abstractEn)  parts.push({ key: 'abstractEn', toc: 'Abstract',
                                      build: function () { return TFFront.abstractEn(m, spec, S.abstracts.en); } });
      if (f.ack)         parts.push({ key: 'ack', toc: 'กิตติกรรมประกาศ',
                                      build: function () { return TFFront.acknowledgement(S.ack, m, spec); } });
      if (f.toc)         parts.push({ key: 'toc', toc: 'สารบัญ', isToc: true });
      if (f.listTables)  parts.push({ key: 'listTables', toc: 'สารบัญตาราง',
                                      build: function () { return TFFront.listOf('table', parseListItems(f.tables), spec); } });
      if (f.listFigures) parts.push({ key: 'listFigures', toc: figTitle,
                                      build: function () { return TFFront.listOf('figure', parseListItems(f.figures), spec); } });

      var useField = f.tocMode === 'field';

      // สร้างสารบัญจากเลขหน้าที่ให้มา (รอบแรกยังไม่รู้ จึงส่งค่าว่าง)
      function buildToc(pageOf) {
        var fe = parts
          .filter(function (p) { return p.toc; })
          .map(function (p) {
            return { text: p.toc, page: pageOf ? pageOf[p.key] : '' };
          });
        return TFFront.toc(tocEntries, spec, { useField: useField, frontEntries: fe });
      }

      // ประกอบส่วนหน้าทั้งหมด แล้วคืนทั้งบล็อกและเลขหน้าเริ่มต้นของแต่ละส่วน
      function assemble(pageOf) {
        var blocks = [];
        var starts = {};
        parts.forEach(function (p) {
          var arr = p.isToc ? buildToc(pageOf) : p.build();
          if (!arr || !arr.length) return;
          arr = arr.slice();
          arr[0] = Object.assign({}, arr[0], { pageBreakBefore: blocks.length > 0 });
          starts[p.key] = blocks.length;   // ดัชนีบล็อกแรกของส่วนนี้
          blocks = blocks.concat(arr);
        });
        return { blocks: blocks, starts: starts };
      }

      // รอบที่ 1 — วัดว่าแต่ละส่วนเริ่มที่หน้าไหน
      var first = assemble(null);
      var frontBlocks = first.blocks;

      if (frontBlocks.length && !useField) {
        var fmt = spec.pageNumber.frontFormat;
        var pagesOfFront = TFPreview.measurePages(frontBlocks, spec);
        var pageOf = {};
        Object.keys(first.starts).forEach(function (k) {
          pageOf[k] = TFPreview.formatPageNum(pagesOfFront[first.starts[k]], fmt);
        });
        // รอบที่ 2 — ใส่เลขหน้าจริงลงในสารบัญ (จำนวนบรรทัดเท่าเดิม การแบ่งหน้าจึงไม่เปลี่ยน)
        frontBlocks = assemble(pageOf).blocks;
      }

      if (frontBlocks.length) {
        sections.push({
          blocks: frontBlocks,
          pageNumFormat: spec.pageNumber.frontFormat,
          pageNumStart: 1,
          titlePg: false
        });
      }
    }

    // ---------- 4) เนื้อเรื่อง ----------
    bodySections.forEach(function (sec, i) {
      sections.push({
        blocks: sec.blocks,
        pageNumFormat: spec.pageNumber.bodyFormat,
        pageNumStart: i === 0 ? 1 : null,
        titlePg: !!spec.pageNumber.hideOnFirstPageOfChapter
      });
    });

    if (!sections.length) {
      toast('ยังไม่มีเนื้อหาให้ส่งออก', true);
      return Promise.resolve();
    }

    // ตัด pageNumStart ที่เป็น null ออก (เพื่อให้ Word นับต่อเนื่อง)
    sections.forEach(function (s) { if (s.pageNumStart == null) delete s.pageNumStart; });

    var fname = (m.titleTh ? m.titleTh.slice(0, 40).replace(/[\\/:*?"<>|]/g, '') : 'รายงานโครงงาน') + '.docx';

    return imagesFor(sections.map(function (s) { return s.blocks; }))
      .then(function (images) {
        return TFDocx.build({ sections: sections, spec: spec, meta: { title: m.titleTh, author: m.authorsTh }, images: images });
      })
      .then(function (blob) {
        TFDocx.download(blob, fname);
        toast('สร้างไฟล์ ' + fname + ' แล้ว (' + sections.length + ' section)');
      })
      .catch(function (e) {
        console.error(e);
        toast('สร้างไฟล์ไม่สำเร็จ: ' + e.message, true);
      });
  }

  /* ==================================================================
   * วิธีใช้
   * ================================================================== */
  function buildHelp() {
    var wrap = el('div', { class: 'form-page' });

    var c1 = el('div', { class: 'card help' });
    c1.appendChild(el('h2', { text: 'ใช้งานอย่างไร' }));
    c1.appendChild(el('ul', {
      html:
        '<li>เลือกแท็บบทที่ต้องการ เช่น <b>บทที่ 1</b></li>' +
        '<li>คัดลอกข้อความของบทนั้นมาวางในช่องด้านซ้าย (จะมาจาก Word, PDF, Google Docs หรือพิมพ์เองก็ได้)</li>' +
        '<li>ดูตัวอย่างหน้ากระดาษด้านขวา ถ้าโปรแกรมแยกประเภทบรรทัดผิด แก้ได้ที่ “โครงสร้างที่ตรวจพบ”</li>' +
        '<li>กด <b>ดาวน์โหลด .docx</b> จะได้ไฟล์ Word ที่จัดรูปแบบเรียบร้อย</li>' +
        '<li>ถ้าต้องการทั้งเล่ม ให้กรอก <b>ส่วนหน้า</b> แล้วไปที่แท็บ <b>ส่งออกทั้งเล่ม</b></li>'
    }));
    wrap.appendChild(c1);

    var c0 = el('div', { class: 'card help' });
    c0.appendChild(el('h2', { text: 'รายงานโครงงานมีอะไรบ้าง' }));
    c0.appendChild(el('ul', {
      html:
        '<li><b>ส่วนหน้า</b> — ปก · หน้ารับรอง · บทคัดย่อ · กิตติกรรมประกาศ · สารบัญ</li>' +
        '<li><b>บทที่ 1 บทนำ</b> — ที่มาและความสำคัญ · วัตถุประสงค์ · สมมติฐาน · ขอบเขต · นิยามศัพท์เฉพาะ · ประโยชน์ที่คาดว่าจะได้รับ</li>' +
        '<li><b>บทที่ 2 เอกสารและโครงงานที่เกี่ยวข้อง</b> — ความรู้ ทฤษฎี และโครงงานอื่นที่เกี่ยวข้อง</li>' +
        '<li><b>บทที่ 3 วิธีดำเนินการโครงงาน</b> — วัสดุอุปกรณ์ · ขั้นตอนการดำเนินงาน · การเก็บและวิเคราะห์ข้อมูล</li>' +
        '<li><b>บทที่ 4 ผลการดำเนินโครงงาน</b> — ผลการทดลอง ตาราง และภาพประกอบ</li>' +
        '<li><b>บทที่ 5 สรุปผล อภิปรายผล และข้อเสนอแนะ</b></li>' +
        '<li><b>บทที่ 6 การนำไปใช้ประโยชน์และการเผยแพร่</b> (ถ้าโรงเรียนไม่ใช้บทที่ 6 ปล่อยว่างไว้ จะไม่ถูกรวมในเล่ม)</li>' +
        '<li><b>📷 บันทึกผล → บท 4–6</b> — เล่าผล (พิมพ์หรือพูด) ใส่สูตรพร้อมตัวเลข โยนรูปลงไป แล้วให้ AI เขียนบทที่ 4–6 พร้อมรูปและคำบรรยาย</li>' +
        '<li><b>ส่วนท้าย</b> — บรรณานุกรม · ภาคผนวก · ประวัติผู้จัดทำ</li>'
    }));
    wrap.appendChild(c1);

    var c2 = el('div', { class: 'card help' });
    c2.appendChild(el('h2', { text: 'เครื่องหมายช่วยกำกับ (ถ้าต้องการควบคุมเอง)' }));
    c2.appendChild(el('ul', {
      html:
        '<li><kbd>#</kbd> หน้าบรรทัด = หัวข้อหลัก (18 พอยต์ ตัวหนา)</li>' +
        '<li><kbd>##</kbd> = หัวข้อรอง · <kbd>###</kbd> = หัวข้อย่อย · <kbd>####</kbd> = หัวข้อย่อยระดับ 4</li>' +
        '<li><kbd>&gt;</kbd> = ข้อความอ้างอิงยกมา (เยื้องเข้า)</li>' +
        '<li><kbd>**ข้อความ**</kbd> = ตัวหนาในบรรทัด</li>' +
        '<li>บรรทัดที่ขึ้นต้นด้วย <kbd>1.1</kbd> <kbd>1.1.1</kbd> จะกลายเป็นหัวข้อรอง/ย่อยอัตโนมัติ</li>'
    }));
    wrap.appendChild(c0);
    wrap.appendChild(c2);

    var c3 = el('div', { class: 'card help' });
    c3.appendChild(el('h2', { text: 'ชุดรูปแบบที่เลือกได้' }));
    c3.appendChild(el('p', { class: 'hint', text: 'สลับได้จากช่อง “รูปแบบ” มุมขวาบน · ข้อความที่พิมพ์ไว้ไม่หาย' }));
    var cm = function (pt) { return (pt / 28.3465).toFixed(2); };
    TFTemplates.PRESET_ORDER.forEach(function (id) {
      var p = TFTemplates.PRESETS[id], sp = p.spec, st = sp.styles, pg = sp.page;
      var posTh = { left: 'ชิดซ้าย', center: 'กึ่งกลาง', right: 'ชิดขวา' }[sp.pageNumber.position];
      var fmtTh = { thaiLetters: 'ก ข ค', lowerRoman: 'i ii iii', decimal: '1 2 3' }[sp.pageNumber.frontFormat];
      c3.appendChild(el('h3', { text: (id === S.presetId ? '▶ ' : '') + p.label, style: 'margin-top:12px' }));
      c3.appendChild(el('ul', {
        html:
          '<li>กระดาษ A4 · ขอบ บน ' + cm(pg.marginTop) + ' / ล่าง ' + cm(pg.marginBottom) +
            ' / ซ้าย ' + cm(pg.marginLeft) + ' / ขวา ' + cm(pg.marginRight) + ' ซม.</li>' +
          '<li>ฟอนต์ ' + sp.font.name + ' — เนื้อความ ' + st.body.size + ' พอยต์ · ' +
            '“บทที่ X” ' + st.chapterNum.size + ' · ชื่อบท ' + st.chapterTitle.size +
            ' · หัวข้อหลัก ' + st.h1.size + ' พอยต์ตัวหนา</li>' +
          '<li>เนื้อความเยื้องบรรทัดแรก ' + st.body.firstLine + ' พอยต์ (≈' + cm(st.body.firstLine) + ' ซม.)</li>' +
          '<li>บรรณานุกรมย่อหน้าแบบแขวน ' + st.bib.hanging + ' พอยต์</li>' +
          '<li>เลขหน้า' + posTh + 'หัวกระดาษ · ส่วนหน้าใช้ ' + fmtTh + ' · เนื้อเรื่องเริ่มนับ 1 ใหม่</li>'
      }));
    });
    wrap.appendChild(c3);

    var c4 = el('div', { class: 'card help' });
    c4.appendChild(el('h2', { text: 'ข้อควรรู้' }));
    c4.appendChild(el('ul', {
      html:
        '<li>ตัวอย่างด้านขวาเป็นการ<b>ประมาณ</b>การแบ่งหน้า เลขหน้าจริงให้ยึดตามที่ Word แสดง</li>' +
        '<li>เครื่องที่เปิดไฟล์ต้องมีฟอนต์ที่เลือกไว้ (Windows ที่ติดตั้งภาษาไทยมี AngsanaUPC อยู่แล้ว)</li>' +
        '<li>งานทั้งหมดเก็บไว้ในเบราว์เซอร์ของคุณเอง — ใช้ปุ่ม “บันทึกงาน” เพื่อเก็บเป็นไฟล์สำรอง</li>' +
        '<li>ข้อความจะถูกส่งออกไปภายนอก<b>เฉพาะตอนกดใช้ผู้ช่วย AI</b> เท่านั้น ไปยังผู้ให้บริการที่คุณเลือกเอง</li>' +
        '<li>โปรแกรมช่วย<b>จัดรูปแบบ</b> ไม่ได้ตรวจความถูกต้องทางวิชาการหรือเขียนเนื้อหาให้</li>'
    }));
    wrap.appendChild(c4);

    return wrap;
  }

  /* ==================================================================
   * บันทึก / เปิด / ล้าง
   * ================================================================== */
  document.getElementById('btn-save').addEventListener('click', function () {
    // แนบรูปที่ใช้ไปด้วย เพื่อให้เปิดงานต่อในเครื่องอื่นได้ครบ
    var ids = [];
    S.results.trials.forEach(function (t) { if (t.photo) ids.push(t.photo); });
    S.results.photos.forEach(function (p) { ids.push(p.id); });
    Object.keys(S.docs).forEach(function (k) { ids = ids.concat(TFPhotos.idsInText(S.docs[k].text)); });
    TFPhotos.exportAll(ids).then(function (photos) {
      var data = Object.assign({}, S, { photos: photos });
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      TFDocx.download(blob, 'thesis-project.json');
      toast('บันทึกไฟล์งานแล้ว' + (Object.keys(photos).length ? ' (พร้อมรูป ' + Object.keys(photos).length + ' รูป)' : ''));
    }).catch(function (e) { toast('บันทึกไม่สำเร็จ: ' + e.message, true); });
  });

  document.getElementById('btn-load').addEventListener('click', function () {
    document.getElementById('file-load').click();
  });

  document.getElementById('file-load').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var o = JSON.parse(fr.result);
        var photos = o.photos;
        delete o.photos;
        S = deepFill(o, defaultState());
        save();
        TFPhotos.importAll(photos).then(function (n) {
          renderTabs(); renderMain();
          toast('เปิดไฟล์งานแล้ว' + (n ? ' (รูป ' + n + ' รูป)' : ''));
        });
      } catch (err) {
        toast('ไฟล์ไม่ถูกต้อง', true);
      }
    };
    fr.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btn-reset').addEventListener('click', function () {
    if (!confirm('ล้างข้อมูลทั้งหมดและเริ่มใหม่?')) return;
    localStorage.removeItem(LS_KEY);
    S = defaultState();
    renderTabs(); renderMain();
    toast('ล้างข้อมูลแล้ว');
  });

  /* ==================================================================
   * เริ่มทำงาน
   * ================================================================== */
  renderPresetSelect();
  renderTabs();
  renderMain();
})();
