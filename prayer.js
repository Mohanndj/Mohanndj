'use strict';
// Prayer-time calculation done on the device (astronomical formulas as used by PrayTimes.org).
// Times use the device's time zone, so the chosen city should be in the same zone as the phone.

const Prayer = (() => {
  const dtr = (d) => (d * Math.PI) / 180;
  const rtd = (r) => (r * 180) / Math.PI;
  const sin = (d) => Math.sin(dtr(d));
  const cos = (d) => Math.cos(dtr(d));
  const tan = (d) => Math.tan(dtr(d));
  const arcsin = (x) => rtd(Math.asin(x));
  const arccos = (x) => rtd(Math.acos(Math.max(-1, Math.min(1, x))));
  const arctan2 = (y, x) => rtd(Math.atan2(y, x));
  const arccot = (x) => rtd(Math.atan(1 / x));
  const fix = (a, b) => { a -= b * Math.floor(a / b); return a < 0 ? a + b : a; };
  const fixAngle = (a) => fix(a, 360);
  const fixHour = (a) => fix(a, 24);

  // isha: a number is an angle in degrees; {min} is minutes after maghrib
  const METHODS = {
    makkah: { name: 'أم القرى (السعودية)', fajr: 18.5, isha: { min: 90 } },
    egypt: { name: 'الهيئة المصرية العامة للمساحة', fajr: 19.5, isha: 17.5 },
    mwl: { name: 'رابطة العالم الإسلامي', fajr: 18, isha: 17 },
    gulf: { name: 'منطقة الخليج', fajr: 19.5, isha: { min: 90 } },
    kuwait: { name: 'الكويت', fajr: 18, isha: 17.5 },
    qatar: { name: 'قطر', fajr: 18, isha: { min: 90 } },
    uae: { name: 'الإمارات', fajr: 18.2, isha: 18.2 },
    jordan: { name: 'الأردن', fajr: 18, isha: 18 },
    karachi: { name: 'جامعة كراتشي', fajr: 18, isha: 18 },
    morocco: { name: 'المغرب', fajr: 19, isha: 17 },
    algeria: { name: 'الجزائر', fajr: 18, isha: 17 },
    tunisia: { name: 'تونس', fajr: 18, isha: 18 },
    turkey: { name: 'تركيا', fajr: 18, isha: 17 },
    isna: { name: 'أمريكا الشمالية', fajr: 15, isha: 15 },
  };

  const CITIES = [
    ['riyadh', 'الرياض', 24.7136, 46.6753, 'makkah'],
    ['jeddah', 'جدة', 21.4858, 39.1925, 'makkah'],
    ['makkah', 'مكة المكرمة', 21.3891, 39.8579, 'makkah'],
    ['madinah', 'المدينة المنورة', 24.5247, 39.5692, 'makkah'],
    ['dammam', 'الدمام', 26.4207, 50.0888, 'makkah'],
    ['taif', 'الطائف', 21.2703, 40.4158, 'makkah'],
    ['abha', 'أبها', 18.2164, 42.5053, 'makkah'],
    ['tabuk', 'تبوك', 28.3835, 36.5662, 'makkah'],
    ['buraydah', 'بريدة', 26.326, 43.975, 'makkah'],
    ['hail', 'حائل', 27.5114, 41.7208, 'makkah'],
    ['jazan', 'جازان', 16.8892, 42.5511, 'makkah'],
    ['kuwait', 'الكويت', 29.3759, 47.9774, 'kuwait'],
    ['doha', 'الدوحة', 25.2854, 51.531, 'qatar'],
    ['manama', 'المنامة', 26.2285, 50.586, 'gulf'],
    ['abudhabi', 'أبوظبي', 24.4539, 54.3773, 'uae'],
    ['dubai', 'دبي', 25.2048, 55.2708, 'uae'],
    ['muscat', 'مسقط', 23.588, 58.3829, 'karachi'],
    ['amman', 'عمّان', 31.9539, 35.9106, 'jordan'],
    ['jerusalem', 'القدس', 31.7683, 35.2137, 'jordan'],
    ['cairo', 'القاهرة', 30.0444, 31.2357, 'egypt'],
    ['alexandria', 'الإسكندرية', 31.2001, 29.9187, 'egypt'],
    ['baghdad', 'بغداد', 33.3152, 44.3661, 'mwl'],
    ['damascus', 'دمشق', 33.5138, 36.2765, 'mwl'],
    ['beirut', 'بيروت', 33.8938, 35.5018, 'mwl'],
    ['sanaa', 'صنعاء', 15.3694, 44.191, 'mwl'],
    ['khartoum', 'الخرطوم', 15.5007, 32.5599, 'egypt'],
    ['tripoli', 'طرابلس', 32.8872, 13.1913, 'egypt'],
    ['tunis', 'تونس', 36.8065, 10.1815, 'tunisia'],
    ['algiers', 'الجزائر', 36.7538, 3.0588, 'algeria'],
    ['rabat', 'الرباط', 34.0209, -6.8416, 'morocco'],
    ['casablanca', 'الدار البيضاء', 33.5731, -7.5898, 'morocco'],
    ['nouakchott', 'نواكشوط', 18.0735, -15.9582, 'mwl'],
    ['istanbul', 'إسطنبول', 41.0082, 28.9784, 'turkey'],
  ].map(([id, name, lat, lng, method]) => ({ id, name, lat, lng, method }));

  const NAMES = { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
  const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  function sunPosition(jd) {
    const D = jd - 2451545.0;
    const g = fixAngle(357.529 + 0.98560028 * D);
    const q = fixAngle(280.459 + 0.98564736 * D);
    const L = fixAngle(q + 1.915 * sin(g) + 0.020 * sin(2 * g));
    const e = 23.439 - 0.00000036 * D;
    const RA = fixHour(arctan2(cos(e) * sin(L), cos(L)) / 15);
    return { decl: arcsin(sin(e) * sin(L)), eqt: q / 15 - RA };
  }

  // Returns minutes after local midnight for each time, for an ISO date (YYYY-MM-DD)
  function times(dateIso, cfg) {
    const { lat, lng } = cfg;
    const M = METHODS[cfg.method] || METHODS.makkah;
    const asrFactor = cfg.asr === 'hanafi' ? 2 : 1;
    const [y, m, d] = dateIso.split('-').map(Number);
    const jDate = julian(y, m, d) - lng / (15 * 24);
    const tz = -new Date(y, m - 1, d, 12).getTimezoneOffset() / 60;

    const midDay = (t) => fixHour(12 - sunPosition(jDate + t).eqt);
    const angleTime = (angle, t, ccw) => {
      const decl = sunPosition(jDate + t).decl;
      const noon = midDay(t);
      const tt = arccos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
      return noon + (ccw ? -tt : tt);
    };
    const asrTime = (f, t) => {
      const decl = sunPosition(jDate + t).decl;
      return angleTime(-arccot(f + tan(Math.abs(lat - decl))), t);
    };

    const r = {
      fajr: angleTime(M.fajr, 5 / 24, true),
      sunrise: angleTime(0.833, 6 / 24, true),
      dhuhr: midDay(12 / 24),
      asr: asrTime(asrFactor, 13 / 24),
      maghrib: angleTime(0.833, 18 / 24),
      isha: typeof M.isha === 'number' ? angleTime(M.isha, 18 / 24) : null,
    };
    for (const k of Object.keys(r)) if (r[k] !== null) r[k] += tz - lng / 15;
    if (r.isha === null) r.isha = r.maghrib + M.isha.min / 60;
    const out = {};
    for (const k of Object.keys(r)) out[k] = Math.round(r[k] * 60);
    return out;
  }

  return { METHODS, CITIES, NAMES, PRAYERS, times };
})();
