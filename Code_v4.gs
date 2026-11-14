// MAY CHU LUU LICH GDX - BAN v4 (them cong tac phi + anh Cuong)
// MAY CHU LUU LICH GDX - dan DUNG MOT LAN, khong dan lap lai
const EDITORS = {
  'khanhtoan.hubt@gmail.com': 'nqqv-svfr-zf9e',
  'hohainhcs@gmail.com': '3rkz-g9a5-g3dm',
  // anh Lê Quốc Cường (Tổ tổng hợp): THAY dòng dưới bằng Gmail thật của anh Cường trước khi dán
  'EMAIL_ANH_CUONG@gmail.com': 'adgj-987a-ee4f'
};
const TOKEN_TTL = 6 * 3600;      // phiên đăng nhập 6 giờ
const MAX_FAIL = 5;              // sai quá 5 lần → khóa 15 phút
const SYNC_KEYS = ['gdx_edits','gdx_added','gdx_rules','gdx_ids','gdx_staff','gdx_remap','gdx_newmonths','gdx_ctp'];  // v4: thêm gdx_ctp (công tác phí)

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SSID');
  if (id) return SpreadsheetApp.openById(id);
  const s = SpreadsheetApp.create('Du lieu Lich GDX (khong xoa)');
  PropertiesService.getScriptProperties().setProperty('SSID', s.getId());
  s.getActiveSheet().setName('Data');
  s.insertSheet('Log').appendRow(['Thời gian','Người sửa','Phiên bản','Thay đổi']);
  return s;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function readState_() {
  const sh = ss_().getSheetByName('Data');
  const rows = sh.getLastRow() ? sh.getRange(1, 1, sh.getLastRow(), 3).getValues() : [];
  const parts = {};
  rows.forEach(r => { (parts[r[0]] = parts[r[0]] || []).push([Number(r[1]), String(r[2])]); });
  const data = {};
  Object.keys(parts).forEach(k => { data[k] = parts[k].sort((a, b) => a[0] - b[0]).map(x => x[1]).join(''); });
  const ver = Number(PropertiesService.getScriptProperties().getProperty('VER') || 0);
  return { ver: ver, data: data };
}


function visits_() {
  const ss = ss_();
  return ss.getSheetByName('Visits') || (function () { const sh = ss.insertSheet('Visits'); sh.appendRow(['Thoi gian', 'Ma thiet bi']); return sh; })();
}
function stats_() {
  const sh = visits_(), n = sh.getLastRow() - 1;
  if (n < 1) return { ok: true, total: 0, today: 0, devices: 0 };
  const rows = sh.getRange(2, 1, n, 2).getValues();
  const tz = 'Asia/Ho_Chi_Minh', td = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  let today = 0; const ids = {};
  rows.forEach(r => { if (Utilities.formatDate(new Date(r[0]), tz, 'yyyy-MM-dd') === td) today++; if (r[1]) ids[r[1]] = 1; });
  return { ok: true, total: n, today: today, devices: Object.keys(ids).length };
}

function doGet(e) {
  return json_(Object.assign({ ok: true }, readState_()));
}

function doPost(e) {
  let b;
  try { b = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, err: 'bad' }); }
  const cache = CacheService.getScriptCache();
  if (b.action === 'hit') {
    const vid = String(b.vid || '').slice(0, 40), ck = 'v_' + vid;
    if (vid && !cache.get(ck)) { cache.put(ck, '1', 1800); visits_().appendRow([new Date(), vid]); }
    return json_(stats_());
  }
  if (b.action === 'stats') return json_(stats_());
  if (b.action === 'login') {
    const em = String(b.email || '').trim().toLowerCase();
    const fk = 'fail_' + em, fails = Number(cache.get(fk) || 0);
    if (fails >= MAX_FAIL) return json_({ ok: false, err: 'Sai quá nhiều lần – thử lại sau 15 phút' });
    const pw = Object.keys(EDITORS).filter(k => k.toLowerCase() === em).map(k => EDITORS[k])[0];
    if (!pw || pw !== String(b.password || '')) { cache.put(fk, String(fails + 1), 900); return json_({ ok: false, err: 'Sai email hoặc mật khẩu' }); }
    cache.remove(fk);
    const tok = Utilities.getUuid() + Utilities.getUuid();
    cache.put('tok_' + tok, em, TOKEN_TTL);
    return json_({ ok: true, token: tok, email: em });
  }
  if (b.action === 'save') {
    const em = cache.get('tok_' + b.token);
    if (!em) return json_({ ok: false, auth: true, err: 'Hết phiên đăng nhập' });
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const cur = readState_();
      if (Number(b.baseVer) !== cur.ver) return json_({ ok: false, conflict: true, ver: cur.ver, err: 'Dữ liệu đã được người khác cập nhật' });
      const sh = ss_().getSheetByName('Data');
      const out = [], changed = [];
      SYNC_KEYS.forEach(k => {
        let v = (b.data && typeof b.data[k] === 'string') ? b.data[k] : null;
        // v4: máy gửi lên không có mục này (web bản cũ) -> GIỮ NGUYÊN dữ liệu đang có, không xóa
        if (v === null) v = cur.data[k] || null;
        if (v === null) return;
        if (v !== (cur.data[k] || '')) changed.push(k.replace('gdx_', '') + ' (' + v.length + ')');
        for (let i = 0, n = 0; i < v.length || n === 0; i += 40000, n++) out.push([k, n, v.slice(i, i + 40000)]);
      });
      sh.clear();
      if (out.length) sh.getRange(1, 1, out.length, 3).setNumberFormat('@').setValues(out);
      const ver = cur.ver + 1;
      PropertiesService.getScriptProperties().setProperty('VER', String(ver));
      ss_().getSheetByName('Log').appendRow([new Date(), em, ver, changed.join(', ') || 'không đổi']);
      return json_({ ok: true, ver: ver });
    } finally { lock.releaseLock(); }
  }
  return json_({ ok: false, err: 'unknown' });
}
