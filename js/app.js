/*!
 * app.js — ส่วนติดต่อผู้ใช้และการเชื่อมทุกโมดูลเข้าด้วยกัน
 */
(function () {
  'use strict';

  var LS_KEY = 'thesis-formatter-state-v1';

  /* ==================================================================
   * สถานะของโปรแกรม
   * ================================================================== */
  function emptyDoc(extra) {
    return Object.assign({ text: '', join: 'auto', smart: true, overrides: {} }, extra || {});
  }

  function defaultState() {
    return {
      version: 2,
      activeTab: 'ch1',
      presetId: TFTemplates.DEFAULT_PRESET,
      spec: TFTemplates.clone(TFTemplates.preset(TFTemplates.DEFAULT_PRESET).spec),
      docs: {
        ch1: emptyDoc(), ch2: emptyDoc(), ch3: emptyDoc(), ch4: emptyDoc(), ch5: emptyDoc(),
        bib: emptyDoc({ join: 'never', smart: false, sort: true }),
        appendix: emptyDoc({ join: 'auto', smart: true })
      },
      meta: {
        titleTh: '', titleEn: '', authorTh: '', authorEn: '', studentId: '',
        degreeTh: '', degreeEn: '', degreeLevel: 'ปริญญาโท',
        branchTh: '', fieldTh: '', facultyTh: '', schoolEn: '',
        universityTh: TFTemplates.preset(TFTemplates.DEFAULT_PRESET).universityTh,
        universityEn: TFTemplates.preset(TFTemplates.DEFAULT_PRESET).universityEn,
        yearTh: '', yearEn: '',
        advisor1: '', advisor2: '', advisor1En: '', advisor2En: '',
        approvalDate: '', chair: '', member1: '', member2: '', gradChair: '',
        // เฉพาะรูปแบบชินวัตร
        dean: '', examDate: '', siuCode: '', workType: 'วิทยานิพนธ์',
        keywordsTh: '', keywordsEn: ''
      },
      abstracts: { th: '', en: '' },
      ack: '',
      vita: {
        name: '', birthDate: '', birthPlace: '', education: '',
        workPlace: '', position: '', address: '', phone: '', email: '', publications: ''
      },
      front: {
        coverTh: true, coverEn: false, approval: true,
        abstractTh: true, abstractEn: true, ack: true,
        toc: true, tocMode: 'static', listTables: false, listFigures: false,
        tables: '', figures: ''
      },
      exportParts: {
        front: true, ch1: true, ch2: true, ch3: true, ch4: true, ch5: true,
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
      return deepFill(o, d);
    } catch (e) { return null; }
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
    // อัปเดตชื่อมหาวิทยาลัยให้ตรงชุด ถ้าผู้ใช้ยังไม่ได้แก้เอง
    var others = TFTemplates.PRESET_ORDER.map(function (k) { return TFTemplates.PRESETS[k]; });
    if (!S.meta.universityTh || others.some(function (p) { return p.universityTh === S.meta.universityTh; })) {
      S.meta.universityTh = pre.universityTh;
    }
    if (!S.meta.universityEn || others.some(function (p) { return p.universityEn === S.meta.universityEn; })) {
      S.meta.universityEn = pre.universityEn;
    }
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
      var k = overrideKey(b);
      if (ov[k]) b.type = ov[k];
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
    { id: 'ch4', label: 'บทที่ 4', kind: 'chapter', chapter: 4 },
    { id: 'ch5', label: 'บทที่ 5', kind: 'chapter', chapter: 5 },
    { id: 'bib', label: 'บรรณานุกรม', kind: 'bib' },
    { id: 'appendix', label: 'ภาคผนวก', kind: 'appendix' },
    { id: 'front', label: 'ส่วนหน้า', kind: 'front' },
    { id: 'vita', label: 'ประวัติผู้เขียน', kind: 'vita' },
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
    chapter: 'วางข้อความทั้งหมดของบทนี้ลงในช่องด้านล่าง โปรแกรมจะแยก “ชื่อบท / หัวข้อหลัก / หัวข้อรอง / เนื้อความ” ให้อัตโนมัติ แล้วจัดหน้า ฟอนต์ ขนาด และย่อหน้าตามคู่มือการพิมพ์วิทยานิพนธ์',
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
      return TFTemplates.SAMPLE_BIB[S.presetId] || TFTemplates.SAMPLE_BIB.stou;
    }
    if (docId === 'appendix') {
      return [
        'ภาคผนวก',
        '',
        'ภาคผนวก ก',
        'แบบสอบถามที่ใช้ในการวิจัย',
        '',
        'แบบสอบถามฉบับนี้จัดทำขึ้นเพื่อเก็บรวบรวมข้อมูลประกอบการทำวิทยานิพนธ์ โดยแบ่งออกเป็น 3 ตอน',
        '1. ข้อมูลทั่วไปของผู้ตอบแบบสอบถาม',
        '2. ความคิดเห็นเกี่ยวกับการจัดการเรียนรู้',
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
   * ส่งออกเอกสารเดี่ยว
   * ================================================================== */
  function exportSingle(docId, tab) {
    var blocks = docBlocks(docId);
    if (!blocks.length) { toast('ยังไม่มีข้อความให้ส่งออก', true); return; }

    var name = tab.chapter ? ('บทที่-' + tab.chapter) : tab.label;
    TFDocx.buildSingle(blocks, S.spec, { title: S.meta.titleTh, author: S.meta.authorTh })
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
    var isSiu = S.spec.layout === 'siu';
    var wrap = el('div', { class: 'form-page' });

    wrap.appendChild(el('p', {
      class: 'notice',
      text: 'กรอกข้อมูลเล่มที่นี่ครั้งเดียว โปรแกรมจะนำไปสร้าง ปกนอก ปกใน หน้าอนุมัติ บทคัดย่อ กิตติกรรมประกาศ และสารบัญ ให้อัตโนมัติในแท็บ “ส่งออกทั้งเล่ม” · ขณะนี้ใช้รูปแบบ: ' + pre.label
    }));

    // ---- ข้อมูลทั่วไป ----
    var c1 = el('div', { class: 'card' }, [el('h2', { text: 'ข้อมูลวิทยานิพนธ์' })]);
    var g1 = el('div', { class: 'grid2' });
    var rows1 = [
      ['ชื่อวิทยานิพนธ์ (ไทย)', 'titleTh', { wide: true }],
      ['ชื่อวิทยานิพนธ์ (อังกฤษ)', 'titleEn', { wide: true }],
      ['ชื่อ–นามสกุลผู้เขียน (ไทย)', 'authorTh'],
      ['ชื่อผู้เขียน (อังกฤษ)', 'authorEn'],
      ['รหัสนักศึกษา', 'studentId'],
      ['ระดับปริญญา', 'degreeLevel'],
      ['หลักสูตร/ปริญญา (ไทย)', 'degreeTh', { placeholder: 'เช่น ศึกษาศาสตรมหาบัณฑิต' }],
      ['หลักสูตร/ปริญญา (อังกฤษ)', 'degreeEn', { placeholder: 'e.g. Master of Education' }],
      ['สาขาวิชา', 'fieldTh']
    ];
    if (isSiu) {
      rows1.push(['คณะ', 'facultyTh', { placeholder: 'เช่น เทคโนโลยีสารสนเทศ' }]);
      rows1.push(['ประเภทผลงาน', 'workType', { placeholder: 'วิทยานิพนธ์ / ดุษฎีนิพนธ์ / งานค้นคว้าอิสระ' }]);
      rows1.push(['รหัสสิ่งพิมพ์ (SIU code)', 'siuCode', { placeholder: 'SIU THE-MT-2568-001' }]);
    } else {
      rows1.push(['แขนงวิชา', 'branchTh']);
      rows1.push(['School (English)', 'schoolEn']);
    }
    rows1.push(['มหาวิทยาลัย (ไทย)', 'universityTh']);
    rows1.push(['University (English)', 'universityEn']);
    rows1.push(['ปีการศึกษา (พ.ศ.)', 'yearTh']);
    rows1.push(['Academic year (ค.ศ.)', 'yearEn']);

    rows1.forEach(function (r) {
      g1.appendChild(field(r[0], m[r[1]], function (v) { m[r[1]] = v; save(); }, r[2]));
    });
    c1.appendChild(g1);
    wrap.appendChild(c1);

    // ---- อาจารย์ที่ปรึกษา / กรรมการ ----
    var c2 = el('div', { class: 'card' }, [
      el('h2', { text: 'อาจารย์ที่ปรึกษาและคณะกรรมการสอบ' }),
      el('p', { class: 'hint', text: 'ใช้ในหน้าอนุมัติและหน้าบทคัดย่อ' })
    ]);
    var g2 = el('div', { class: 'grid2' });
    var rows2 = isSiu ? [
      ['อาจารย์ที่ปรึกษา', 'advisor1'],
      ['อาจารย์ที่ปรึกษาร่วม (ถ้ามี)', 'advisor2'],
      ['กรรมการ', 'member1'],
      ['กรรมการภายนอก (ถ้ามี)', 'member2'],
      ['คณบดี', 'dean', { placeholder: 'ตำแหน่งทางวิชาการ ชื่อ-นามสกุล' }],
      ['เดือน ปีที่สอบ', 'examDate', { placeholder: 'เช่น พฤษภาคม 2568' }],
      ['Thesis advisor 1 (English)', 'advisor1En'],
      ['Thesis advisor 2 (English)', 'advisor2En']
    ] : [
      ['อาจารย์ที่ปรึกษาคนที่ 1', 'advisor1'],
      ['อาจารย์ที่ปรึกษาคนที่ 2', 'advisor2'],
      ['Thesis advisor 1 (English)', 'advisor1En'],
      ['Thesis advisor 2 (English)', 'advisor2En'],
      ['ประธานกรรมการสอบ', 'chair'],
      ['กรรมการคนที่ 1', 'member1'],
      ['กรรมการคนที่ 2', 'member2'],
      ['ประธานกรรมการบัณฑิตศึกษา', 'gradChair'],
      ['วันที่อนุมัติ', 'approvalDate', { placeholder: 'เช่น 15 พฤษภาคม 2568' }]
    ];
    rows2.forEach(function (r) {
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
      el('p', { class: 'hint', text: 'พิมพ์บรรทัดละ 1 รายการ รูปแบบ:  เลขที่ | ชื่อเรื่อง | เลขหน้า   (เช่น  4.1 | ค่าเฉลี่ยผลสัมฤทธิ์ | 45)' })
    ]);
    var g4 = el('div', { class: 'grid2' });
    g4.appendChild(field('สารบัญตาราง', f.tables, function (v) { f.tables = v; save(); }, { multiline: true, wide: true, placeholder: '4.1 | ค่าเฉลี่ยและส่วนเบี่ยงเบนมาตรฐาน | 45' }));
    g4.appendChild(field(pre.figureListTitle, f.figures, function (v) { f.figures = v; save(); }, { multiline: true, wide: true, placeholder: '4.1 | กรอบแนวคิดการวิจัย | 12' }));
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
      marks.push({ name: name, index: blocks.length });
      blocks = blocks.concat(arr);
    }

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
   * ประวัติผู้วิจัย
   * ================================================================== */
  function buildVita() {
    var pre = currentPreset();
    var wrap = el('div', { class: 'editor' });
    var left = el('div', { class: 'pane' }, [
      el('div', { class: 'pane-head' }, [el('h2', { class: 'pane-title', text: pre.vitaTitle })]),
      el('p', { class: 'hint', text: 'หัวข้อในแบบฟอร์มนี้เปลี่ยนตามรูปแบบที่เลือกไว้ด้านบน · ช่องที่มีหลายบรรทัดกด Enter ขึ้นบรรทัดใหม่ได้' })
    ]);
    var g = el('div', { class: 'grid2' });
    pre.vitaFields.forEach(function (fd) {
      g.appendChild(field(fd.label, S.vita[fd.key], function (v) {
        S.vita[fd.key] = v; save(); refresh();
      }, { multiline: !!fd.multiline, wide: !!fd.multiline }));
    });
    left.appendChild(g);

    var pv = el('div', { class: 'preview' });
    var right = el('div', { class: 'pane' }, [
      el('div', { class: 'pane-head' }, [
        el('h2', { class: 'pane-title', text: 'ตัวอย่างเอกสาร' }),
        el('div', { class: 'pane-tools' }, [
          el('button', {
            class: 'btn primary', text: '⬇ ดาวน์โหลด .docx',
            onclick: function () {
              TFDocx.buildSingle(TFFront.vita(S.vita, S.spec), S.spec, { title: S.meta.titleTh, author: S.meta.authorTh })
                .then(function (b) { TFDocx.download(b, pre.vitaTitle + '.docx'); toast('สร้างไฟล์แล้ว'); });
            }
          })
        ])
      ]),
      el('div', { class: 'preview-scroll' }, [pv])
    ]);

    function refresh() {
      pv.style.zoom = 0.7;
      TFPreview.render(pv, TFFront.vita(S.vita, S.spec), S.spec, { startPage: 1 });
    }
    setTimeout(refresh, 0);

    wrap.appendChild(left);
    wrap.appendChild(right);
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
      ['coverEn', 'ปก (ภาษาอังกฤษ)'],
      ['approval', 'หน้าอนุมัติ'],
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
      ['ch4', 'บทที่ 4'], ['ch5', 'บทที่ 5'],
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
    var btn = el('button', { class: 'btn primary', text: '⬇ ดาวน์โหลดวิทยานิพนธ์ทั้งเล่ม (.docx)' });
    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = 'กำลังสร้างไฟล์…';
      exportWholeThesis().then(function () {
        btn.disabled = false;
        btn.textContent = '⬇ ดาวน์โหลดวิทยานิพนธ์ทั้งเล่ม (.docx)';
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
    if (ep.front && f.coverEn) {
      sections.push({ blocks: TFFront.cover(m, spec, 'en'), hidePageNumber: true, pageNumFormat: spec.pageNumber.frontFormat });
    }

    // ---------- 2) เตรียมเนื้อเรื่อง (เพื่อคำนวณเลขหน้าในสารบัญ) ----------
    var bodySections = [];
    ['ch1', 'ch2', 'ch3', 'ch4', 'ch5'].forEach(function (id) {
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
      var isSiu = spec.layout === 'siu';
      var figTitle = currentPreset().figureListTitle;

      // นิยามแต่ละส่วน พร้อมชื่อที่จะไปปรากฏในสารบัญ
      var parts = [];
      if (f.approval)    parts.push({ key: 'approval', build: function () { return TFFront.approval(m, spec); } });
      if (f.abstractTh)  parts.push({ key: 'abstractTh', toc: isSiu ? 'บทคัดย่อ' : 'บทคัดย่อภาษาไทย',
                                      build: function () { return TFFront.abstractTh(m, spec, S.abstracts.th); } });
      if (f.abstractEn)  parts.push({ key: 'abstractEn', toc: isSiu ? 'Abstract' : 'บทคัดย่อภาษาอังกฤษ',
                                      build: function () { return TFFront.abstractEn(m, spec, S.abstracts.en); } });
      if (f.ack)         parts.push({ key: 'ack', toc: 'กิตติกรรมประกาศ',
                                      build: function () { return TFFront.acknowledgement(S.ack, m, spec); } });
      if (f.toc)         parts.push({ key: 'toc', toc: isSiu ? 'สารบัญ' : null, isToc: true });
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

    var fname = (m.titleTh ? m.titleTh.slice(0, 40).replace(/[\\/:*?"<>|]/g, '') : 'วิทยานิพนธ์') + '.docx';

    return TFDocx.build({ sections: sections, spec: spec, meta: { title: m.titleTh, author: m.authorTh } })
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
        '<li>งานทั้งหมดถูกเก็บไว้ในเบราว์เซอร์ของคุณเอง ไม่ถูกส่งไปที่ใด — ใช้ปุ่ม “บันทึกงาน” เพื่อเก็บเป็นไฟล์สำรอง</li>' +
        '<li>โปรแกรมช่วย<b>จัดรูปแบบ</b> ไม่ได้ตรวจความถูกต้องทางวิชาการหรือเขียนเนื้อหาให้</li>'
    }));
    wrap.appendChild(c4);

    return wrap;
  }

  /* ==================================================================
   * บันทึก / เปิด / ล้าง
   * ================================================================== */
  document.getElementById('btn-save').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    TFDocx.download(blob, 'thesis-project.json');
    toast('บันทึกไฟล์งานแล้ว');
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
        S = deepFill(o, defaultState());
        save();
        renderTabs(); renderMain();
        toast('เปิดไฟล์งานแล้ว');
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
