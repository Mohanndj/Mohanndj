'use strict';
// The smart assistant: turns an everyday Arabic sentence into a task.
// Rule-based and fully on-device, e.g. «ذكرني أتصل بأبوي بكرة الساعة 5 العصر وقبلها بربع ساعة».

const SmartParse = (() => {
  const WD = {
    'السبت': 6, 'سبت': 6,
    'الأحد': 0, 'الاحد': 0, 'أحد': 0, 'احد': 0,
    'الاثنين': 1, 'الإثنين': 1, 'اثنين': 1, 'إثنين': 1, 'الاتنين': 1,
    'الثلاثاء': 2, 'الثلاثا': 2, 'ثلاثاء': 2, 'ثلاثا': 2,
    'الأربعاء': 3, 'الاربعاء': 3, 'الأربعا': 3, 'الاربعا': 3, 'أربعاء': 3, 'اربعاء': 3,
    'الخميس': 4, 'خميس': 4,
    'الجمعة': 5, 'الجمعه': 5, 'جمعة': 5, 'جمعه': 5,
  };
  const WD_RE = Object.keys(WD).sort((a, b) => b.length - a.length).join('|');
  const MONTHS = {
    'يناير': 1, 'فبراير': 2, 'مارس': 3, 'أبريل': 4, 'ابريل': 4, 'إبريل': 4, 'مايو': 5, 'يونيو': 6, 'يونيه': 6,
    'يوليو': 7, 'يوليه': 7, 'أغسطس': 8, 'اغسطس': 8, 'سبتمبر': 9, 'أكتوبر': 10, 'اكتوبر': 10, 'نوفمبر': 11, 'ديسمبر': 12,
  };
  const MONTH_RE = Object.keys(MONTHS).join('|');
  const NUMW = {
    'واحد': 1, 'واحدة': 1, 'وحدة': 1, 'وحده': 1, 'ثنتين': 2, 'اثنين': 2, 'اتنين': 2, 'ثنين': 2,
    'ثلاث': 3, 'ثلاثة': 3, 'ثلاثه': 3, 'تلات': 3, 'أربع': 4, 'اربع': 4, 'أربعة': 4, 'اربعة': 4, 'اربعه': 4,
    'خمس': 5, 'خمسة': 5, 'خمسه': 5, 'ست': 6, 'ستة': 6, 'سته': 6, 'سبع': 7, 'سبعة': 7, 'سبعه': 7,
    'ثمان': 8, 'ثمانية': 8, 'ثمانيه': 8, 'ثمنية': 8, 'تمان': 8, 'تسع': 9, 'تسعة': 9, 'تسعه': 9,
    'عشر': 10, 'عشرة': 10, 'عشره': 10, 'احدعش': 11, 'إحدعش': 11, 'حدعش': 11, 'اثنعش': 12, 'ثنعش': 12, 'اطنعش': 12,
  };
  const NUMW_RE = Object.keys(NUMW).sort((a, b) => b.length - a.length).join('|');
  const PRAYER = { 'فجر': 'fajr', 'ظهر': 'dhuhr', 'عصر': 'asr', 'مغرب': 'maghrib', 'عشاء': 'isha', 'عشا': 'isha' };

  const E = '(?=\\s)'; // right word boundary (text is padded with spaces)
  const num = (s) => (s == null ? null : /^\d+$/.test(s) ? Number(s) : NUMW[s] ?? null);
  const toLatin = (s) => s.replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g, (c) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c));

  function amount(n, word) {
    // "ربع ساعة", "نص ساعة", "ساعة", "ساعتين", "10 دقائق", "يوم"
    if (/^(ربع|الربع)$/.test(n)) return 15;
    if (/^(نص|نصف|النص)$/.test(n)) return 30;
    if (/^(ساعة|ساعه)$/.test(n)) return 60;
    if (/^ساعتين$/.test(n)) return 120;
    if (/^(يوم)$/.test(n)) return 1440;
    if (/^يومين$/.test(n)) return 2880;
    const v = num(n);
    if (v == null) return null;
    if (word && /^(ساعة|ساعه|ساعات)$/.test(word)) return v * 60;
    if (word && /^(يوم|أيام|ايام)$/.test(word)) return v * 1440;
    return v;
  }

  function parse(text, now = new Date()) {
    const r = { kind: 'once', title: '', due: '', time: '', prayer: null, days: null, until: '', untilLen: null,
      priority: 'mid', category: '', target: 1, unit: '', before: [], found: [] };
    let s = ' ' + toLatin(text).replace(/[،,]/g, ' ، ').replace(/\s+/g, ' ').trim() + ' ';
    const take = (re, fn) => {
      s = s.replace(re, (...m) => { const keep = fn(...m); return keep === false ? m[0] : ' '; });
    };
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const plus = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return iso(d); };

    // opening words: "ذكرني أن", "أبي", "لا تنساني"…
    s = s.replace(/^\s*(?:(?:لا\s+)?(?:تنساني|تنسني|تنسى)|ذ[ّ]?ك[ّ]?ر[ّ]?ني|ذكرنى|نب[ّ]?هني|تذكير|أبي|ابي|أبغى|ابغى|أبغا|ابغا|ودي|أريد|اريد|أضف|اضف|سج[ّ]?ل|حط|ضيف)\s+(?:(?:إني|اني|أني|إن|ان|أن|ب)\s+)?/, ' ');

    // category: #عمل
    take(/\s#(\S+)/g, (_, c) => { r.category = c; });

    // priority
    take(new RegExp(`\\s(?:غير\\s+مهم|مو\\s+مهم|مش\\s+مهم|مب\\s+مهم|لما\\s+أفضى|لما\\s+افضى)${E}`, 'g'), () => { r.priority = 'low'; });
    take(new RegExp(`\\s(?:مهم\\s+جد[اً]+|ضروري\\s+جد[اً]+|عاجل|ضروري|مستعجل|مهم|هام)${E}`, 'g'), () => { r.priority = 'high'; });

    // extra alarm: "وقبلها بربع ساعة", "ونبهني قبل الموعد بـ 10 دقائق"
    take(new RegExp(`\\s(?:و\\s*)?(?:(?:ذ[ّ]?ك[ّ]?ر[ّ]?ني|نب[ّ]?هني)\\s+)?قبل(?:ها|ه|\\s+الموعد|\\s+بيوم)(?:\\s+ب\\s*(?:ـ\\s*)?(\\d+|${NUMW_RE}|ربع|نص|نصف|ساعة|ساعه|ساعتين|يوم|يومين)(?:\\s+(دقيقة|دقائق|دقايق|د|ساعة|ساعه|ساعات|يوم|أيام|ايام))?)?${E}`, 'g'),
      (m, n, w) => {
        const v = /بيوم/.test(m) ? 1440 : amount(n || 'ربع', w);
        if (v) r.before.push(v);
      });

    // prayer-relative time: "بعد العصر", "قبل المغرب بنص ساعة", "مع صلاة الفجر"
    take(new RegExp(`\\s(قبل|بعد|مع|وقت|عند)\\s+(?:صلاة\\s+|صلاه\\s+)?(?:ال)?(فجر|ظهر|عصر|مغرب|عشاء|عشا)(?:\\s+ب\\s*(?:ـ\\s*)?(\\d+|${NUMW_RE}|ربع|نص|نصف|ساعة|ساعه|ساعتين)(?:\\s+(دقيقة|دقائق|دقايق|د|ساعة|ساعه|ساعات))?)?${E}`, 'g'),
      (_, rel, p, n, w) => {
        const mins = n ? amount(n, w) : 15;
        const offset = rel === 'قبل' ? -mins : rel === 'بعد' ? mins : 0;
        r.prayer = { name: PRAYER[p], offset };
      });

    // relative time from now: "بعد ساعة", "بعد 20 دقيقة"
    take(new RegExp(`\\sبعد\\s+(\\d+|${NUMW_RE}|ساعة|ساعه|ساعتين|نص\\s+ساعة|ربع\\s+ساعة)(?:\\s+(دقيقة|دقائق|دقايق|ساعة|ساعه|ساعات))?(?:\\s*و\\s*(نص|نصف|ربع))?${E}`, 'g'),
      (m, n, w, frac) => {
        let mins;
        if (/نص/.test(n)) mins = 30; else if (/ربع/.test(n)) mins = 15;
        else if (!w && !/ساع/.test(n)) return false; // "بعد 3 أيام" is a date, handled below
        else mins = amount(n, w);
        if (!mins) return false;
        if (frac) mins += /ربع/.test(frac) ? 15 : 30; // «بعد ساعة ونص»
        const d = new Date(now.getTime() + mins * 60000);
        r.due = iso(d);
        r.time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      });

    // clock time: "الساعة 5 ونص العصر", "الساعة سبع إلا ربع", "5:30 مساءً"
    const MARK = '(صباحا|صباحاً|الصبح|صباح|ص|فجرا|فجراً|الفجر|ظهرا|ظهراً|الظهر|عصرا|عصراً|العصر|مساء|مساءً|مساءا|المسا|المساء|المغرب|بالليل|الليل|ليلا|ليلاً|م)';
    const setTime = (h, mi, mark) => {
      if (mark) {
        if (/صباح|الصبح|^ص$|فجر/.test(mark)) { if (h === 12) h = 0; }
        else if (/ظهر/.test(mark)) { if (h < 5) h += 12; }
        else if (/ليل/.test(mark)) { if (h === 12) h = 0; else if (h >= 5 && h < 12) h += 12; }
        else if (h < 12) h += 12;
      } else if (h >= 1 && h <= 6) h += 12; // "الساعة 5" usually means the afternoon
      if (h > 23 || mi > 59) return false;
      r.time = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
    };
    take(new RegExp(`\\s(?:الساعة|الساعه|ساعة|الساعة\\s+ال)\\s*(\\d{1,2}|${NUMW_RE})(?:[:.](\\d{2}))?(?:\\s*(?:و\\s*)?(نص|النص|نصف|ربع|الربع|ثلث|الثلث))?(?:\\s*(?:إلا|الا)\\s*(ربع|الربع|ثلث|الثلث|\\d+\\s*(?:دقيقة|دقائق|دقايق|د)?))?(?:\\s+${MARK})?${E}`, 'g'),
      (m0, hh, mm, frac, minus, mark) => {
        let h = num(hh), mi = mm ? Number(mm) : 0;
        if (h == null || (!/الساع/.test(m0) && !/^\d/.test(hh))) return false; // «ساعة واحدة» is a length, not a time
        if (frac) mi += /نص/.test(frac) ? 30 : /ربع/.test(frac) ? 15 : 20;
        if (minus) {
          const sub = /ربع/.test(minus) ? 15 : /ثلث/.test(minus) ? 20 : parseInt(minus, 10);
          h -= 1; mi = 60 - sub;
          if (h === 0) h = 12;
        }
        return setTime(h, mi, mark);
      });
    take(new RegExp(`\\s(\\d{1,2})[:.](\\d{2})(?:\\s+${MARK})?${E}`, 'g'), (_, hh, mm, mark) => setTime(Number(hh), Number(mm), mark));

    // repetition
    const setDays = (days) => { r.kind = 'repeat'; r.days = days; };
    take(new RegExp(`\\s(?:كل\\s+يوم(?!\\s+(?:${WD_RE})(?=\\s))|يوميا|يومياً|يوميًا|يومي)${E}`, 'g'), () => setDays([0, 1, 2, 3, 4, 5, 6]));
    take(new RegExp(`\\s(?:كل\\s+)?(?:أيام|ايام)\\s+(?:الدوام|العمل|الدراسة|الدراسه)${E}`, 'g'), () => setDays([0, 1, 2, 3, 4]));
    take(new RegExp(`\\sكل\\s+(?:ويكند|ويك\\s+اند|نهاية\\s+(?:ال)?أسبوع|نهاية\\s+(?:ال)?اسبوع)${E}`, 'g'), () => setDays([5, 6]));
    take(new RegExp(`\\sكل\\s+(?:يوم\\s+)?((?:${WD_RE})(?:\\s*(?:و|،|\\s)\\s*(?:يوم\\s+)?(?:${WD_RE}))*)${E}`, 'g'), (_, list) => {
      const days = [...new Set((list.match(new RegExp(WD_RE, 'g')) || []).map((w) => WD[w]))];
      setDays(days);
    });
    take(new RegExp(`\\sكل\\s+(?:أسبوع|اسبوع)${E}`, 'g'), () => setDays([now.getDay()]));
    take(new RegExp(`\\sلمدة\\s+(\\d+|${NUMW_RE}|يومين|أسبوع|اسبوع|أسبوعين|اسبوعين|شهر|شهرين|سنة|سنه)(?:\\s+(يوم|أيام|ايام|أسبوع|اسبوع|أسابيع|اسابيع|شهر|أشهر|اشهر|شهور|سنة|سنه|سنوات))?${E}`, 'g'),
      (_, n, w) => {
        let days = null;
        if (/^يومين$/.test(n)) days = 2;
        else if (/^(أسبوع|اسبوع)$/.test(n)) days = 7;
        else if (/^(أسبوعين|اسبوعين)$/.test(n)) days = 14;
        else if (/^شهر$/.test(n)) days = 30;
        else if (/^شهرين$/.test(n)) days = 60;
        else if (/^(سنة|سنه)$/.test(n)) days = 365;
        else {
          const v = num(n);
          if (v == null) return false;
          days = /أسبوع|اسبوع|أسابيع|اسابيع/.test(w || '') ? v * 7 : /شهر|أشهر|اشهر|شهور/.test(w || '') ? v * 30 : /سن/.test(w || '') ? v * 365 : v;
        }
        r.untilLen = days;
      });
    take(new RegExp(`\\s(?:بلا\\s+نهاية|دائما|دائماً|دايم|على\\s+طول|للأبد|للابد)${E}`, 'g'), () => { r.untilLen = null; r.until = ''; r.found.push('forever'); });

    // a date as text: used for "حتى ..." and the due date
    const dateFrom = (dd, mm, yy) => {
      let y = yy ? Number(yy) : now.getFullYear();
      if (y < 100) y += 2000;
      const d = new Date(y, mm - 1, dd);
      if (!yy && iso(d) < iso(now)) d.setFullYear(y + 1);
      return iso(d);
    };
    take(new RegExp(`\\s(?:حتى|حتي|إلى|الى|لين|لغاية|لحد)\\s+(?:(\\d{1,2})\\s*(?:من\\s+)?(${MONTH_RE})|(\\d{1,2})\\s*[/-]\\s*(\\d{1,2})(?:\\s*[/-]\\s*(\\d{2,4}))?|نهاية\\s+(?:ال)?(شهر|سنة|سنه|أسبوع|اسبوع))${E}`, 'g'),
      (_, d1, mName, d2, m2, y2, endOf) => {
        if (d1) r.until = dateFrom(Number(d1), MONTHS[mName]);
        else if (d2) r.until = dateFrom(Number(d2), Number(m2), y2);
        else if (/شهر/.test(endOf)) r.until = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        else if (/سن/.test(endOf)) r.until = `${now.getFullYear()}-12-31`;
        else r.until = plus(6 - now.getDay()); // to Saturday: the week starts on Sunday
      });

    // due date
    take(new RegExp(`\\sبعد\\s+(?:بكرة|بكره|بكرا|باكر|باجر|غد|غدٍ|الغد|بكرة)${E}`, 'g'), () => { r.due = plus(2); });
    take(new RegExp(`\\s(?:بكرة|بكره|بكرا|غدا|غداً|غدًا|الغد|باكر|باجر)${E}`, 'g'), () => { r.due = plus(1); });
    take(new RegExp(`\\s(?:اليوم|الليلة|الليله|هالحين|الحين|الآن|الان)${E}`, 'g'), (m) => { r.due = plus(0); });
    take(new RegExp(`\\sبعد\\s+(\\d+|${NUMW_RE}|يومين|أسبوع|اسبوع|أسبوعين|اسبوعين|شهر)(?:\\s+(يوم|أيام|ايام|أسبوع|اسبوع|أسابيع|اسابيع|شهر|أشهر|شهور))?${E}`, 'g'),
      (_, n, w) => {
        let d;
        if (n === 'يومين') d = 2; else if (/^(أسبوع|اسبوع)$/.test(n)) d = 7; else if (/أسبوعين|اسبوعين/.test(n)) d = 14; else if (n === 'شهر') d = 30;
        else { const v = num(n); if (v == null) return false; d = /أسبوع|اسبوع|أسابيع|اسابيع/.test(w || '') ? v * 7 : /شهر|أشهر|شهور/.test(w || '') ? v * 30 : v; }
        r.due = plus(d);
      });
    take(new RegExp(`\\s(?:ال)?(?:أسبوع|اسبوع)\\s+(?:القادم|الجاي|المقبل|الياي)${E}`, 'g'), () => { r.due = plus(7); });
    take(new RegExp(`\\s((?:يوم|في|ب)\\s+)?(${WD_RE})(?:\\s+(القادم|الجاي|المقبل|الياي|الجاية|الجايه))?${E}`, 'g'), (_, pre, w, next) => {
      if (!pre && !next && /^(?:أحد|احد|اثنين|إثنين)$/.test(w)) return false; // «كلم أحد الزملاء»، «اشتر اثنين حليب»
      let delta = (WD[w] - now.getDay() + 7) % 7;
      if (delta === 0 && next) delta = 7;
      r.due = plus(delta);
    });
    take(new RegExp(`\\s(?:يوم\\s+)?(\\d{1,2})\\s*(?:من\\s+)?(?:شهر\\s+)?(${MONTH_RE})${E}`, 'g'), (_, d, mName) => { r.due = dateFrom(Number(d), MONTHS[mName]); });
    take(new RegExp(`\\s(?:يوم\\s+)?(\\d{1,2})\\s*/\\s*(\\d{1,2})(?:\\s*/\\s*(\\d{2,4}))?${E}`, 'g'), (_, d, m, y) => { r.due = dateFrom(Number(d), Number(m), y); });

    // title: whatever is left
    let title = s.replace(/\s+/g, ' ').trim();
    const junk = /^(?:أن|ان|إن|إني|اني|ب|و|في|على|،)\s+|\s+(?:و|في|على|الساعة|الساعه|يوم|،|ب)$/;
    for (let i = 0; i < 4; i++) title = title.replace(junk, '').trim();
    title = title.replace(/^،|،$/g, '').replace(/\s+،/g, '،').trim();
    if (/^بال/.test(title)) title = title.slice(1);
    r.title = title;

    // counted goal: "اشرب 8 أكواب ماء يومياً"
    if (r.kind === 'repeat') {
      const m = title.match(/(?:^|\s)(\d+)\s+(\S+)/);
      if (m && Number(m[1]) > 1 && Number(m[1]) <= 100 && !/^(?:دقي|دقا|دقاي|ساع|ثاني)/.test(m[2])) { r.target = Number(m[1]); r.unit = m[2]; }
      if (r.due) { r.start = r.due; r.due = ''; }
      if (r.untilLen) {
        const start = r.start || iso(now);
        const d = new Date(start + 'T00:00'); d.setDate(d.getDate() + r.untilLen - 1);
        r.until = iso(d);
      }
    } else if (r.until && !r.due) r.due = r.until; // «سلّم البحث حتى ١٥ نوفمبر»: a one-time task is due by then
    if (r.kind !== 'repeat' && (r.time || r.prayer) && !r.due) {
      r.due = iso(now); // the app moves it to tomorrow if the time already passed
      r.autoDue = true;
    }
    return r;
  }

  return { parse };
})();
