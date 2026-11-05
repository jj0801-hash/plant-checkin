// @AI_GENERATED
// M2 存储层：GithubStore。数据是私有仓库里的 JSON 文件，通过 GitHub Contents API 读写。
// 角色与令牌（需求文档 3.3）：
//   孩子：kidWrite 读写 data-kid；kidRead 只读 data-parent
//   家长：parent 令牌读写两个仓库
// 并发：写入使用 sha 乐观锁，冲突时重新读取并重放修改函数（按日期键合并），最多重试 N 次。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dates.js'));
  else root.Store = factory(root.Dates);
})(typeof self !== 'undefined' ? self : this, function (D) {
  function StoreError(kind, message, status) {
    var e = new Error(message); e.kind = kind; e.status = status || 0; return e;
  }
  function utf8ToB64(str) {
    if (typeof Buffer !== 'undefined') return Buffer.from(str, 'utf8').toString('base64');
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64ToUtf8(b64) {
    var clean = String(b64).replace(/\s/g, '');
    if (typeof Buffer !== 'undefined') return Buffer.from(clean, 'base64').toString('utf8');
    var bin = atob(clean), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function GithubStore(opts) {
    this.api = (opts.api || 'https://api.github.com').replace(/\/+$/, '');
    this.owner = opts.owner; this.repoKid = opts.repoKid; this.repoParent = opts.repoParent;
    this.role = opts.role;                       // 'kid' | 'parent'
    this.tokens = opts.tokens || {};
    this.fetch = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    this.retries = opts.retries === undefined ? 6 : opts.retries;
    this.timeoutMs = opts.timeoutMs || 15000;
  }
  var P = GithubStore.prototype;

  // 某仓库在当前角色下读/写应使用哪个令牌
  P._token = function (repoKey, write) {
    var t = this.tokens;
    if (this.role === 'parent') return t.parent;
    if (repoKey === 'kid') return t.kidWrite;
    return write ? null : t.kidRead;
  };
  P._repo = function (repoKey) { return repoKey === 'kid' ? this.repoKid : this.repoParent; };

  P._req = async function (method, repoKey, path, body, write) {
    var token = this._token(repoKey, write);
    if (!token) throw StoreError('forbidden', '当前角色没有' + (write ? '写' : '读') + '这个仓库的令牌', 0);
    var url = this.api + '/repos/' + encodeURIComponent(this.owner) + '/' + encodeURIComponent(this._repo(repoKey)) + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
    var headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: 'Bearer ' + token };
    if (body) headers['Content-Type'] = 'application/json';
    var c = new AbortController(), timer = setTimeout(function () { c.abort(); }, this.timeoutMs), r;
    try {
      r = await this.fetch(url, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined, signal: c.signal });
    } catch (e) {
      throw StoreError('network', e && e.name === 'AbortError' ? '请求超时' : '网络错误');
    } finally { clearTimeout(timer); }
    var json = null; try { json = await r.json(); } catch (e) { json = null; }
    return { status: r.status, json: json };
  };
  function fail(r, what) {
    if (r.status === 401) return StoreError('auth', '令牌无效或已过期，请重新绑定', 401);
    if (r.status === 403) return StoreError('forbidden', '没有权限：' + what, 403);
    if (r.status === 404) return StoreError('notfound', '找不到：' + what + '（检查用户名、仓库名和令牌授权）', 404);
    if (r.status === 409 || r.status === 422) return StoreError('conflict', '保存冲突：' + what, r.status);
    return StoreError('server', '服务返回 ' + r.status + '：' + what, r.status);
  }

  // 读取 JSON 文件；文件不存在返回 null
  P.getJson = async function (repoKey, path) {
    var r = await this._req('GET', repoKey, path, null, false);
    if (r.status === 404) return null;
    if (r.status !== 200) throw fail(r, path);
    var text = b64ToUtf8(r.json.content);
    try { return { data: JSON.parse(text), sha: r.json.sha }; }
    catch (e) { throw StoreError('corrupt', '文件内容不是合法 JSON：' + path); }
  };
  // 乐观锁更新：读取 → mutate(当前内容) → 带 sha 写入；冲突则重读重放
  P.updateJson = async function (repoKey, path, mutate, message) {
    for (var attempt = 0; attempt <= this.retries; attempt++) {
      var cur = await this.getJson(repoKey, path);
      var next = mutate(cur ? cur.data : null);
      var body = { message: message || ('update ' + path), content: utf8ToB64(JSON.stringify(next, null, 2) + '\n') };
      if (cur) body.sha = cur.sha;
      var r = await this._req('PUT', repoKey, path, body, true);
      if (r.status === 200 || r.status === 201) return next;
      if (r.status === 409 || r.status === 422) {                        // 别处先改了：退避后重放
        await sleep(20 + Math.random() * 60 * (attempt + 1));
        continue;
      }
      throw fail(r, path);
    }
    throw StoreError('conflict', '多次重试后仍然冲突：' + path, 409);
  };

  // 绑定令牌时的自检，返回给界面可读的结果
  P.verify = async function () {
    var out = { ok: true, problems: [] };
    var checks = this.role === 'parent' ? [['kid', false], ['parent', false]] : [['kid', false], ['parent', false]];
    for (var i = 0; i < checks.length; i++) {
      try {
        var r = await this._req('GET', checks[i][0], '', null, false);
        if (r.status !== 200) throw fail(r, checks[i][0] === 'kid' ? this.repoKid : this.repoParent);
      } catch (e) { out.ok = false; out.problems.push(e.message); }
    }
    return out;
  };

  // ---- 业务读写 ----
  function monthOf(date) { return date.slice(0, 7); }
  function months(from, to) {
    var out = [], y = +from.slice(0, 4), m = +from.slice(5, 7), ey = +to.slice(0, 4), em = +to.slice(5, 7);
    while (y < ey || (y === ey && m <= em)) { out.push(y + '-' + String(m).padStart(2, '0')); if (++m > 12) { m = 1; y++; } }
    return out;
  }
  function mergeInto(target, src) { Object.keys(src || {}).forEach(function (k) { target[k] = src[k]; }); }

  P.saveSubmission = function (date, sub) {
    if (this.role !== 'kid') return Promise.reject(StoreError('forbidden', '只有孩子端可以提交'));
    return this.updateJson('kid', 'submissions/' + monthOf(date) + '.json', function (cur) {
      var o = cur || {}; o[date] = sub; return o;
    }, 'submit ' + date);
  };
  P.saveReview = function (date, review) {
    return this.updateJson('parent', 'reviews/' + monthOf(date) + '.json', function (cur) {
      var o = cur || {}; o[date] = review; return o;
    }, 'review ' + date + ' ' + review.result);
  };
  P.saveGrades = function (weekKey, g) {
    var year = weekKey.slice(0, 4);
    return this.updateJson('parent', 'grades/' + year + '.json', function (cur) {
      var o = cur || {}; o[weekKey] = Object.assign({}, g, { recordedAt: new Date().toISOString() }); return o;
    }, 'grades ' + weekKey);
  };
  P.saveConfig = function (cfg) {                // 配置整体覆盖，最后写入者生效
    return this.updateJson('parent', 'config.json', function () { return cfg; }, 'config');
  };
  P.requestRedeem = function (req) {             // 孩子端申请
    return this.updateJson('kid', 'redeem_requests.json', function (cur) {
      var o = cur || {}; o[req.id] = req; return o;
    }, 'redeem request ' + req.id);
  };
  P.decideRedeem = function (dec) {              // 家长端决定
    var year = String(dec.decidedAt || new Date().toISOString()).slice(0, 4);
    return this.updateJson('parent', 'redeems/' + year + '.json', function (cur) {
      var o = cur || {}; o[dec.id] = dec; return o;
    }, 'redeem ' + dec.id + ' ' + dec.status);
  };

  // 读取某个“今天”所需的全部数据
  P.loadAll = async function (today) {
    var self = this;
    var cfgFile = await this.getJson('parent', 'config.json');
    var config = cfgFile ? cfgFile.data : null;
    var start = config && config.semester && config.semester.rewardStart;
    var ms = start ? months(start, today) : [];
    var years = start ? Array.from(new Set(ms.map(function (m) { return m.slice(0, 4); }))) : [];
    // ISO 周可能属于上一年，多读一年
    if (years.length) years.unshift(String(+years[0] - 1));
    var jobs = [];
    ms.forEach(function (m) {
      jobs.push(self.getJson('kid', 'submissions/' + m + '.json').then(function (f) { return ['submissions', f]; }));
      jobs.push(self.getJson('parent', 'reviews/' + m + '.json').then(function (f) { return ['reviews', f]; }));
    });
    years.forEach(function (y) {
      jobs.push(self.getJson('parent', 'grades/' + y + '.json').then(function (f) { return ['grades', f]; }));
      jobs.push(self.getJson('parent', 'redeems/' + y + '.json').then(function (f) { return ['redeems', f]; }));
    });
    jobs.push(this.getJson('kid', 'redeem_requests.json').then(function (f) { return ['requests', f]; }));
    jobs.push(this.getJson('parent', 'content/installed.json').then(function (f) { return ['installed', f]; }));
    var res = await Promise.all(jobs);
    var out = { config: config, submissions: {}, reviews: {}, grades: {}, decisions: {}, requests: {}, installed: null };
    res.forEach(function (x) {
      var kind = x[0], f = x[1]; if (!f) return;
      if (kind === 'redeems') mergeInto(out.decisions, f.data);
      else if (kind === 'requests') mergeInto(out.requests, f.data);
      else if (kind === 'installed') out.installed = f.data;
      else mergeInto(out[kind], f.data);
    });
    // 兑换：家长的决定优先；没有决定的申请显示为 requested
    var redeems = Object.keys(out.decisions).map(function (k) { return out.decisions[k]; });
    Object.keys(out.requests).forEach(function (k) {
      if (!out.decisions[k]) redeems.push(Object.assign({ status: 'requested' }, out.requests[k]));
    });
    out.redeems = redeems;
    return out;
  };

  return { GithubStore: GithubStore, StoreError: StoreError, months: months, utf8ToB64: utf8ToB64, b64ToUtf8: b64ToUtf8 };
});
// @AI_GENERATED: end
