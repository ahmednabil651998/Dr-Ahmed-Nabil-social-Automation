// محاكاة Node لبيئة Apps Script (Mocks فقط — ليست Apps Script الحقيقي)
var vm = require('vm'), fs = require('fs'), path = require('path'), crypto = require('crypto');

function fmtParts(d, tz) {
  var f = new Intl.DateTimeFormat('en-GB', { timeZone: tz === 'UTC' ? 'UTC' : tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
  var o = {}; f.formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
  return o;
}

function makeEnv(dir, opts) {
  opts = opts || {};
  var log = { tg: [], fetch: [], alerts: [], logger: [], drive: [] };
  var sheets = {};
  function Sheet(name, rows) {
    this.name = name; this.data = rows.map(function (r) { return r.slice(); });
  }
  Sheet.prototype.getLastRow = function () { var n = this.data.length; while (n > 0 && this.data[n - 1].every(function (v) { return v === '' || v === null || v === undefined; })) n--; return n; };
  Sheet.prototype.getMaxRows = function () { return Math.max(this.data.length, 1000); };
  Sheet.prototype._ensure = function (r, c) { while (this.data.length < r) this.data.push([]); var row = this.data[r - 1]; while (row.length < c) row.push(''); };
  Sheet.prototype.getRange = function (r, c, nr, nc) {
    var sh = this;
    if (typeof r === 'string') return { setNumberFormat: function () { return this; }, setValues: function () { return this; }, setFontWeight: function () { return this; } };
    nr = nr || 1; nc = nc || 1;
    var rg = {
      getValue: function () { sh._ensure(r, c); var v = sh.data[r - 1][c - 1]; return v === undefined ? '' : v; },
      setValue: function (v) { sh._ensure(r, c); sh.data[r - 1][c - 1] = v; return rg; },
      getValues: function () { var out = []; for (var i = 0; i < nr; i++) { var row = []; for (var j = 0; j < nc; j++) { sh._ensure(r + i, c + j); var v = sh.data[r + i - 1][c + j - 1]; row.push(v === undefined ? '' : v); } out.push(row); } return out; },
      setValues: function (vals) { for (var i = 0; i < vals.length; i++) for (var j = 0; j < vals[i].length; j++) { sh._ensure(r + i, c + j); sh.data[r + i - 1][c + j - 1] = vals[i][j]; } return rg; },
      setNumberFormat: function () { return rg; }, setFontWeight: function () { return rg; }
    };
    return rg;
  };
  Sheet.prototype.appendRow = function (row) { var n = this.getLastRow(); this.data.length = n; this.data.push(row.slice()); };
  Sheet.prototype.setFrozenRows = function () {}; Sheet.prototype.setRightToLeft = function () {};
  Object.keys(opts.sheets || {}).forEach(function (k) { sheets[k] = new Sheet(k, opts.sheets[k]); });

  var props = {}; Object.keys(opts.props || {}).forEach(function (k) { props[k] = String(opts.props[k]); });
  var files = opts.files || {};

  function resp(code, body, headers) {
    return { getContentText: function () { return typeof body === 'string' ? body : JSON.stringify(body); }, getResponseCode: function () { return code; }, getHeaders: function () { return headers || {}; } };
  }
  var msgId = 100;
  var tgHandler = opts.tg || function () { return { ok: true, result: { message_id: ++msgId } }; };
  var graphHandler = opts.graph || function () { return { error: { message: 'no graph mock', code: 1 } }; };
  var otherHandler = opts.other || function () { return { code: 404, body: '{}' }; };

  var UrlFetchApp = {
    fetch: function (url, o) {
      log.fetch.push(url);
      var m = /api\.telegram\.org\/bot[^/]*\/([A-Za-z]+)/.exec(url);
      if (m) {
        var call = { method: m[1], payload: (o && o.payload) || {} };
        log.tg.push(call);
        var r = tgHandler(call, ++msgId);
        if (r instanceof Error) throw r;
        return resp(r && r.ok ? 200 : (r && r.error_code) || 400, r);
      }
      if (url.indexOf('https://graph.facebook.com/') === 0) {
        var g = graphHandler(url.replace('https://graph.facebook.com/v25.0/', ''), o || {});
        if (g instanceof Error) throw g;
        return resp(g.error ? 400 : 200, g);
      }
      var x = otherHandler(url, o || {});
      if (x instanceof Error) throw x;
      return resp(x.code, x.body, x.headers);
    }
  };
  function blobFor(id, f) {
    return { _id: id, getBytes: function () { return [1, 2, 3]; }, getName: function () { return f.name || 'f'; }, setContentType: function () { return this; } };
  }
  var DriveApp = {
    getFileById: function (id) {
      log.drive.push(id);
      var f = files[id];
      if (typeof f === 'function') f = f();
      if (f instanceof Error) throw f;
      if (!f) throw new Error('Exception: No item with the given ID could be found. Or perhaps you do not have permission to access it.');
      return { getBlob: function () { return blobFor(id, f); }, getSize: function () { return f.size || 1000; }, getName: function () { return f.name || id; }, getId: function () { return id; } };
    }
  };
  var Utilities = {
    DigestAlgorithm: { MD5: 'md5' }, Charset: { UTF_8: 'utf8' },
    computeDigest: function (alg, s) { var b = crypto.createHash('md5').update(String(s), 'utf8').digest(); return Array.prototype.map.call(b, function (x) { return x > 127 ? x - 256 : x; }); },
    base64EncodeWebSafe: function (bytes) { return Buffer.from(bytes.map(function (x) { return x & 0xFF; })).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'); },
    formatDate: function (d, tz, fmt) {
      if (isNaN(d.getTime())) throw new Error('Invalid argument: date');
      var p = fmtParts(d, tz);
      return fmt.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace(/\bH\b/, String(Number(p.hour)))
        .replace('mm', p.minute).replace(/\bu\b/, String({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday])).replace('ww', '01');
    },
    newBlob: function (b, mime, name) { return { getBytes: function () { return b; }, getName: function () { return name; } }; },
    sleep: function () {}, getUuid: function () { return 'uuid-' + Math.random(); }
  };
  var ctx = {
    console: { log: function () {} },
    SpreadsheetApp: {
      getActive: function () { return { getSheetByName: function (n) { return sheets[n] || null; }, insertSheet: function (n) { sheets[n] = new Sheet(n, [[]]); return sheets[n]; } }; },
      getUi: function () { return { alert: function (t) { log.alerts.push(t); }, ButtonSet: {}, Button: {} }; }
    },
    PropertiesService: { getScriptProperties: function () { return {
      getProperty: function (k) { return props.hasOwnProperty(k) ? props[k] : null; },
      setProperty: function (k, v) { props[k] = String(v); }, deleteProperty: function (k) { delete props[k]; } }; } },
    UrlFetchApp: UrlFetchApp, DriveApp: DriveApp, Utilities: Utilities,
    Logger: { log: function (t) { log.logger.push(String(t)); } },
    LockService: { getScriptLock: function () { return { tryLock: function () { return true; }, releaseLock: function () {} }; } },
    ScriptApp: { getProjectTriggers: function () { return [{ getHandlerFunction: function () { return 'dailyJob'; } }, { getHandlerFunction: function () { return 'pollTelegram'; } }]; }, getService: function () { return { getUrl: function () { return ''; } }; } },
    HtmlService: { createHtmlOutput: function (h) { return { setTitle: function () { return this; }, addMetaTag: function () { return this; }, html: h }; } },
    ContentService: { createTextOutput: function (t) { return t; } }
  };
  vm.createContext(ctx);
  fs.readdirSync(dir).filter(function (f) { return /\.gs$/.test(f); }).sort().forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
  });
  return { ctx: ctx, log: log, sheets: sheets, props: props, files: files };
}

module.exports = { makeEnv: makeEnv, fmtParts: fmtParts };
