/*!
 * ai.js — ผู้ช่วย AI สำหรับร่างเนื้อหาบทที่ 2–5 จากบทที่ 1
 *
 * เว็บนี้เป็นไฟล์สแตติกล้วน ไม่มีเซิร์ฟเวอร์ จึงเรียก AI จากเบราว์เซอร์โดยตรง
 * ผู้ใช้ต้องใส่ "คีย์ของตัวเอง" ซึ่งเก็บไว้ใน localStorage ของเครื่องผู้ใช้เท่านั้น
 *
 *  ⚠ ข้อควรระวังด้านความปลอดภัย
 *    - คีย์ถูกเก็บในเบราว์เซอร์เครื่องนั้น ใครใช้เครื่องนั้นก็เปิดดูได้
 *    - ห้ามใส่คีย์ลงในซอร์สโค้ดแล้วอัปขึ้น GitHub เด็ดขาด
 *    - ไฟล์ "บันทึกงาน" (.json) จะไม่มีคีย์ติดไปด้วย (เก็บคนละที่)
 */
var TFAI = (function () {
  'use strict';

  var KEY_STORE = 'project-formatter-ai-v1';

  /* ------------------------------------------------------------------
   * ผู้ให้บริการที่รองรับ
   * ------------------------------------------------------------------ */
  var PROVIDERS = {
    gemini: {
      id: 'gemini',
      label: 'Google Gemini (มีโควตาใช้ฟรี)',
      note: 'สมัครคีย์ฟรีที่ aistudio.google.com/apikey — เหมาะกับโรงเรียนที่ไม่มีงบ',
      keyUrl: 'https://aistudio.google.com/apikey',
      defaultModel: 'gemini-2.0-flash',
      call: function (cfg, sys, user, onChunk) {
        var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
          encodeURIComponent(cfg.model) + ':generateContent?key=' + encodeURIComponent(cfg.key);
        return fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sys }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { maxOutputTokens: 8192 }
          })
        }).then(readJson).then(function (d) {
          var c = d.candidates && d.candidates[0];
          if (!c) throw new Error(describe(d) || 'ไม่ได้รับคำตอบจาก Gemini');
          return (c.content && c.content.parts || [])
            .map(function (p) { return p.text || ''; }).join('');
        });
      }
    },

    anthropic: {
      id: 'anthropic',
      label: 'Anthropic Claude',
      note: 'คีย์จาก console.anthropic.com — คุณภาพภาษาไทยดีมาก แต่เป็นบริการแบบเสียเงิน',
      keyUrl: 'https://console.anthropic.com/settings/keys',
      defaultModel: 'claude-opus-5',
      call: function (cfg, sys, user) {
        return fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': cfg.key,
            'anthropic-version': '2023-06-01',
            // จำเป็นเมื่อเรียกจากเบราว์เซอร์โดยตรง
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: cfg.model,
            max_tokens: 16000,
            system: sys,
            output_config: { effort: 'medium' },
            messages: [{ role: 'user', content: user }]
          })
        }).then(readJson).then(function (d) {
          if (d.stop_reason === 'refusal') throw new Error('ผู้ช่วยปฏิเสธคำขอนี้');
          var blocks = d.content || [];
          var text = blocks.filter(function (b) { return b.type === 'text'; })
                           .map(function (b) { return b.text; }).join('');
          if (!text) throw new Error(describe(d) || 'ไม่ได้รับข้อความตอบกลับ');
          return text;
        });
      }
    },

    openai: {
      id: 'openai',
      label: 'OpenAI',
      note: 'คีย์จาก platform.openai.com — บริการแบบเสียเงิน',
      keyUrl: 'https://platform.openai.com/api-keys',
      defaultModel: 'gpt-4o-mini',
      call: function (cfg, sys, user) {
        return fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'authorization': 'Bearer ' + cfg.key
          },
          body: JSON.stringify({
            model: cfg.model,
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: user }
            ]
          })
        }).then(readJson).then(function (d) {
          var c = d.choices && d.choices[0];
          if (!c) throw new Error(describe(d) || 'ไม่ได้รับคำตอบ');
          return c.message.content || '';
        });
      }
    }
  };

  var PROVIDER_ORDER = ['gemini', 'anthropic', 'openai'];

  function readJson(res) {
    return res.text().then(function (t) {
      var d;
      try { d = JSON.parse(t); } catch (e) { d = null; }
      if (!res.ok) {
        var msg = (d && describe(d)) || t.slice(0, 300) || ('HTTP ' + res.status);
        if (res.status === 401 || res.status === 403) msg = 'คีย์ไม่ถูกต้องหรือหมดอายุ — ' + msg;
        if (res.status === 429) msg = 'เรียกใช้บ่อยเกินโควตา รอสักครู่แล้วลองใหม่ — ' + msg;
        throw new Error(msg);
      }
      if (!d) throw new Error('อ่านคำตอบไม่ได้');
      return d;
    });
  }

  function describe(d) {
    if (!d) return '';
    if (d.error) return d.error.message || JSON.stringify(d.error).slice(0, 200);
    if (d.message) return d.message;
    return '';
  }

  /* ------------------------------------------------------------------
   * การเก็บคีย์ (แยกจากไฟล์บันทึกงาน เพื่อไม่ให้คีย์หลุดตอนแชร์ไฟล์)
   * ------------------------------------------------------------------ */
  function loadConfig() {
    var d = { provider: 'gemini', model: PROVIDERS.gemini.defaultModel, key: '' };
    try {
      var raw = localStorage.getItem(KEY_STORE);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && PROVIDERS[o.provider]) d = Object.assign(d, o);
      }
    } catch (e) { /* ไม่มีก็ใช้ค่าเริ่มต้น */ }
    if (!d.model) d.model = PROVIDERS[d.provider].defaultModel;
    return d;
  }

  function saveConfig(cfg) {
    try { localStorage.setItem(KEY_STORE, JSON.stringify(cfg)); } catch (e) { /* เต็ม */ }
  }

  function clearConfig() {
    try { localStorage.removeItem(KEY_STORE); } catch (e) { /* ไม่เป็นไร */ }
  }

  function hasKey() { return !!(loadConfig().key || '').trim(); }

  /* ------------------------------------------------------------------
   * คำสั่งระบบ (system prompt)
   * ------------------------------------------------------------------ */
  var SYSTEM = [
    'คุณเป็นผู้ช่วยครูที่ปรึกษาโครงงาน ช่วยนักเรียนระดับมัธยมศึกษาตอนต้นร่างเนื้อหารายงานโครงงาน',
    '',
    'หลักการเขียน',
    '- ใช้ภาษาไทยที่เป็นทางการแบบรายงานวิชาการ แต่อ่านง่ายสำหรับนักเรียน ม.2',
    '- เขียนต่อยอดจากข้อมูลในบทที่ 1 ที่ผู้ใช้ให้มาเท่านั้น ห้ามเปลี่ยนหัวข้อโครงงาน',
    '- ถ้าข้อมูลไม่พอ ให้เขียนเป็นโครงร่างพร้อมวงเล็บบอกสิ่งที่นักเรียนต้องเติม เช่น (ใส่ผลการทดลองจริงที่นี่)',
    '- ห้ามแต่งตัวเลข ผลการทดลอง หรือชื่อเอกสารอ้างอิงขึ้นเอง ถ้ายังไม่มีข้อมูลจริง',
    '',
    'รูปแบบผลลัพธ์ — สำคัญมาก ให้ตอบเป็นข้อความล้วนตามรูปแบบนี้',
    '- บรรทัดแรก: บทที่ N',
    '- บรรทัดที่สอง: ชื่อบท',
    '- หัวข้อหลักขึ้นต้นด้วย #  (เช่น  # เอกสารที่เกี่ยวข้อง)',
    '- หัวข้อย่อยขึ้นต้นด้วย ## หรือใช้เลขกำกับ เช่น 2.1 ชื่อหัวข้อ',
    '- ย่อหน้าเนื้อความเขียนติดกันเป็นบรรทัดเดียว ไม่ต้องเว้นวรรคหน้าบรรทัด',
    '- ตารางใช้เครื่องหมาย | คั่นช่อง และมีบรรทัด |---|---| ใต้แถวหัวตาราง',
    '- ห้ามใส่คำอธิบายอื่นนอกเหนือจากเนื้อหาบท ห้ามใส่ ``` ครอบ'
  ].join('\n');

  /* ------------------------------------------------------------------
   * ตัวสร้างคำสั่งของแต่ละบท
   * ------------------------------------------------------------------ */
  var CHAPTER_BRIEF = {
    2: [
      'เขียน "บทที่ 2 เอกสารและโครงงานที่เกี่ยวข้อง"',
      'ให้มีหัวข้อหลักประมาณ 3–5 หัวข้อ ครอบคลุมความรู้พื้นฐานและทฤษฎีที่เกี่ยวข้องกับโครงงานนี้',
      'แต่ละหัวข้อเขียนอธิบาย 1–3 ย่อหน้า ด้วยความรู้ทั่วไปที่ถูกต้องและเหมาะกับระดับ ม.2',
      'ปิดท้ายด้วยหัวข้อ "โครงงานที่เกี่ยวข้อง" โดยเขียนเป็นโครงร่างให้นักเรียนไปค้นคว้าเติมเอง',
      'อย่าแต่งชื่อผู้แต่ง ปี พ.ศ. หรือชื่องานวิจัยขึ้นมาเอง'
    ],
    3: [
      'เขียน "บทที่ 3 วิธีดำเนินการโครงงาน"',
      'ให้มีหัวข้อ: วัสดุ อุปกรณ์ และเครื่องมือที่ใช้ / ขั้นตอนการดำเนินงาน / การเก็บรวบรวมข้อมูล / การวิเคราะห์ข้อมูล',
      'หัวข้อวัสดุอุปกรณ์ให้ทำเป็นตาราง 4 คอลัมน์: ลำดับ | วัสดุและอุปกรณ์ | จำนวน | หน้าที่',
      'หัวข้อขั้นตอนการดำเนินงานให้ทำเป็นตารางแผนการดำเนินงานรายสัปดาห์ด้วย',
      'เขียนขั้นตอนให้ละเอียดพอที่คนอื่นทำตามซ้ำได้'
    ],
    4: [
      'เขียน "บทที่ 4 ผลการดำเนินโครงงาน"',
      'เขียนเป็นโครงร่างตามวัตถุประสงค์แต่ละข้อในบทที่ 1 (ตอนที่ 1, ตอนที่ 2, ...)',
      'ใส่ตารางเปล่าพร้อมหัวตารางที่เหมาะสมไว้ให้นักเรียนกรอกผลจริง',
      'ห้ามแต่งตัวเลขผลการทดลอง ให้เขียน (กรอกผลที่ได้จริง) แทน',
      'เขียนประโยคนำและประโยคสรุปของแต่ละตารางไว้ให้ โดยเว้นช่องตัวเลขไว้'
    ],
    5: [
      'เขียน "บทที่ 5 สรุปผล อภิปรายผล และข้อเสนอแนะ"',
      'ให้มีหัวข้อ: สรุปผลการดำเนินโครงงาน / อภิปรายผล / ปัญหาและอุปสรรค / ข้อเสนอแนะ',
      'สรุปผลให้อ้างอิงกลับไปที่วัตถุประสงค์ทุกข้อในบทที่ 1',
      'ส่วนที่ต้องใช้ผลจริงให้เว้นเป็น (สรุปจากผลในบทที่ 4)',
      'ข้อเสนอแนะแบ่งเป็น การนำไปใช้ และ การทำโครงงานครั้งต่อไป'
    ]
  };

  /**
   * สร้างคำสั่งสำหรับร่างบทหนึ่ง
   * @param {number} chapter 2–5
   * @param {string} ch1Text ข้อความบทที่ 1
   * @param {object} meta ข้อมูลโครงงาน
   * @param {string} extra คำสั่งเพิ่มเติมจากผู้ใช้
   */
  function buildPrompt(chapter, ch1Text, meta, extra) {
    var info = TFTemplates.CHAPTERS[chapter];
    var lines = [];

    lines.push('ข้อมูลโครงงาน');
    if (meta.titleTh) lines.push('- ชื่อโครงงาน: ' + String(meta.titleTh).replace(/\n/g, ' '));
    if (meta.subjectTh) lines.push('- รายวิชา: ' + meta.subjectTh);
    if (meta.learningArea) lines.push('- กลุ่มสาระการเรียนรู้: ' + meta.learningArea);
    if (meta.gradeLevel) lines.push('- ระดับชั้น: ' + meta.gradeLevel);
    lines.push('');
    lines.push('เนื้อหาบทที่ 1 ที่นักเรียนเขียนไว้');
    lines.push('"""');
    lines.push(String(ch1Text || '').slice(0, 12000));
    lines.push('"""');
    lines.push('');
    lines.push('งานที่ต้องทำ');
    (CHAPTER_BRIEF[chapter] || []).forEach(function (l) { lines.push('- ' + l); });
    lines.push('- บรรทัดแรกของคำตอบต้องเป็น "บทที่ ' + chapter + '" และบรรทัดที่สองเป็น "' + info.title + '"');
    if (extra && extra.trim()) {
      lines.push('');
      lines.push('คำสั่งเพิ่มเติมจากครู/นักเรียน');
      lines.push(extra.trim());
    }
    return lines.join('\n');
  }

  /** คำสั่งสำหรับร่างบทคัดย่อ */
  function buildAbstractPrompt(allText, meta) {
    return [
      'ข้อมูลโครงงาน',
      meta.titleTh ? '- ชื่อโครงงาน: ' + String(meta.titleTh).replace(/\n/g, ' ') : '',
      '',
      'เนื้อหาที่นักเรียนเขียนไว้',
      '"""',
      String(allText || '').slice(0, 14000),
      '"""',
      '',
      'งานที่ต้องทำ',
      '- เขียนบทคัดย่อภาษาไทยของโครงงานนี้ ความยาว 1–2 ย่อหน้า ประมาณ 150–250 คำ',
      '- ครอบคลุม: วัตถุประสงค์ วิธีดำเนินการ ผลที่ได้ และข้อสรุป',
      '- ตอบเป็นข้อความล้วน ไม่ต้องใส่หัวข้อ ไม่ต้องใส่คำว่า "บทคัดย่อ"',
      '- ส่วนที่ยังไม่มีข้อมูลจริงให้เว้นเป็นวงเล็บ เช่น (สรุปผลที่ได้จริง)'
    ].filter(Boolean).join('\n');
  }

  /* ------------------------------------------------------------------
   * เรียกใช้งาน
   * ------------------------------------------------------------------ */
  function generate(userPrompt, systemPrompt) {
    var cfg = loadConfig();
    var p = PROVIDERS[cfg.provider];
    if (!p) return Promise.reject(new Error('ยังไม่ได้เลือกผู้ให้บริการ AI'));
    if (!(cfg.key || '').trim()) return Promise.reject(new Error('ยังไม่ได้ใส่คีย์ AI (ไปที่แท็บ "ผู้ช่วย AI")'));
    return p.call(cfg, systemPrompt || SYSTEM, userPrompt);
  }

  /** ทดสอบว่าคีย์ใช้ได้ไหม */
  function test() {
    return generate('ตอบกลับสั้น ๆ ว่า "พร้อมใช้งาน" เท่านั้น', 'คุณคือผู้ช่วยทดสอบการเชื่อมต่อ ตอบสั้นที่สุด')
      .then(function (t) { return (t || '').trim().slice(0, 80); });
  }

  /** ล้าง ``` ที่บางโมเดลชอบใส่ครอบ */
  function cleanOutput(text) {
    return String(text || '')
      .replace(/^\s*```[a-zA-Z]*\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
      .trim();
  }

  return {
    PROVIDERS: PROVIDERS,
    PROVIDER_ORDER: PROVIDER_ORDER,
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    clearConfig: clearConfig,
    hasKey: hasKey,
    buildPrompt: buildPrompt,
    buildAbstractPrompt: buildAbstractPrompt,
    generate: generate,
    test: test,
    cleanOutput: cleanOutput,
    SYSTEM: SYSTEM
  };
})();
