/* =========================================================
   app.js — định tuyến, phân quyền và toàn bộ màn hình
   ========================================================= */
(function () {
  'use strict';

  var S = {
    settings: null,
    employees: [], projects: [], categories: [],
    user: null,
    reports: [],
    objectUrls: []
  };

  /* Thư mục ảnh. Chạy độc lập thì là 'assets/'; khi làm theme WordPress,
     functions.php gán window.MTH_ASSETS thành đường dẫn đầy đủ của theme. */
  var ASSETS = window.MTH_ASSETS || 'assets/';

  var STATUS = {
    pending:  { label: 'Chờ duyệt', icon: 'clock',       cls: 'badge-pending' },
    approved: { label: 'Đã duyệt',  icon: 'checkCircle', cls: 'badge-approved' },
    rejected: { label: 'Từ chối',   icon: 'xCircle',     cls: 'badge-rejected' }
  };

  var NAV = [
    { id: 'send',      label: 'Gửi báo cáo',   short: 'Gửi',      icon: 'send',     roles: ['staff', 'admin'] },
    { id: 'list',      label: 'Báo cáo',       short: 'Báo cáo',  icon: 'inbox',    roles: ['staff', 'admin'] },
    { id: 'projects',  label: 'Khách hàng',    short: 'Khách',    icon: 'building', roles: ['admin'] },
    { id: 'quotes',    label: 'Báo giá',       short: 'Báo giá',  icon: 'money',    roles: ['admin'] },
    { id: 'timesheet', label: 'Bảng chấm công',short: 'Chấm công',icon: 'table',    roles: ['staff', 'admin'] },
    { id: 'summary',   label: 'Tổng hợp',      short: 'Tổng hợp', icon: 'chart',    roles: ['staff', 'admin'] },
    { id: 'settings',  label: 'Cài đặt',       short: 'Cài đặt',  icon: 'settings', roles: ['admin'] }
  ];

  /* ---------------- tra cứu ---------------- */
  function emp(id) { return S.employees.filter(function (e) { return e.id === id; })[0] || { name: '—', salaryMonth: 0, workDays: 22 }; }
  function proj(id) { return S.projects.filter(function (p) { return p.id === id; })[0] || { name: '—', code: '' }; }
  function cat(id) { return S.categories.filter(function (c) { return c.id === id; })[0] || { name: '—', hex: '#9A9A9A' }; }
  function isAdmin() { return S.user && S.user.role === 'admin'; }
  function staffList() { return S.employees.filter(function (e) { return e.role !== 'admin' && e.active !== false; }); }

  function revokeUrls() {
    S.objectUrls.forEach(function (u) { URL.revokeObjectURL(u); });
    S.objectUrls = [];
  }
  function urlOf(blob) { var u = URL.createObjectURL(blob); S.objectUrls.push(u); return u; }

  /* ---------------- lọc & tổng hợp ---------------- */
  function reportsIn(opt) {
    return S.reports.filter(function (r) {
      if (opt.month && r.date.slice(0, 7) !== opt.month) return false;
      if (opt.employeeId && r.employeeId !== opt.employeeId) return false;
      if (opt.status && r.status !== opt.status) return false;
      if (opt.projectId && r.projectId !== opt.projectId) return false;
      if (opt.categoryId && r.categoryId !== opt.categoryId) return false;
      if (opt.q) {
        var hay = U.noAccent([r.description, r.reason, proj(r.projectId).name, cat(r.categoryId).name, emp(r.employeeId).name].join(' '));
        if (hay.indexOf(U.noAccent(opt.q)) < 0) return false;
      }
      return true;
    }).sort(function (a, b) { return a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1; });
  }

  function aggregate(rows) {
    var out = { hc: 0, tc: 0, total: 0, byProject: {}, byCategory: {}, byEmployee: {}, byReason: {} };
    rows.forEach(function (r) {
      var hc = Number(r.hc) || 0, tc = Number(r.tc) || 0;
      out.hc += hc; out.tc += tc;

      function bump(bag, key, extra) {
        if (!bag[key]) bag[key] = Object.assign({ hc: 0, tc: 0, n: 0 }, extra || {});
        bag[key].hc += hc; bag[key].tc += tc; bag[key].n++;
        return bag[key];
      }
      bump(out.byProject, r.projectId);
      bump(out.byCategory, r.categoryId);
      bump(out.byEmployee, r.employeeId);

      var key = r.categoryId + '|' + (r.reason || '(Không ghi lý do)');
      var g = bump(out.byReason, key, { categoryId: r.categoryId, reason: r.reason || '(Không ghi lý do)', items: [] });
      if (r.description && g.items.indexOf(r.description) < 0) g.items.push(r.description);
    });
    out.hc = U.round2(out.hc); out.tc = U.round2(out.tc);
    out.total = U.round2(out.hc + out.tc);
    return out;
  }

  function defaultMonth() {
    var ap = S.reports.filter(function (r) { return r.status === 'approved'; });
    if (!ap.length) return U.monthISO();
    var max = ap.reduce(function (m, r) { return r.date > m ? r.date : m; }, ap[0].date);
    return max.slice(0, 7);
  }

  /* ---------------- trạng thái xem (lưu trên URL để quay lại được) ---------------- */
  function route() {
    var h = (location.hash || '#/list').replace(/^#\/?/, '');
    var parts = h.split('?');
    var q = {};
    (parts[1] || '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
    });
    return { view: parts[0] || 'list', q: q };
  }

  function go(view, q) {
    var s = Object.keys(q || {}).filter(function (k) { return q[k] !== '' && q[k] != null; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]); }).join('&');
    location.hash = '#/' + view + (s ? '?' + s : '');
  }
  function setQ(patch) {
    var r = route();
    go(r.view, Object.assign({}, r.q, patch));
  }

  /* =========================================================
     ĐĂNG NHẬP
     ========================================================= */
  /* ---------------- Ghi nhớ đăng nhập ----------------
     Có ghi nhớ  → lưu ở localStorage, đóng trình duyệt mở lại vẫn còn đăng nhập.
     Không ghi nhớ → lưu ở sessionStorage, đóng trình duyệt là thoát.
     Tên đăng nhập luôn được nhớ riêng để lần sau điền sẵn cho đỡ gõ. */
  var K_USER = 'mth_user', K_LAST = 'mth_last_user', K_REMEMBER = 'mth_remember';

  function store(kind, key, val) {
    try {
      var s = kind === 'session' ? sessionStorage : localStorage;
      if (val === undefined) return s.getItem(key);
      if (val === null) s.removeItem(key); else s.setItem(key, val);
    } catch (err) { /* trình duyệt chặn lưu trữ thì bỏ qua */ }
    return null;
  }

  function rememberLogin(id, username, remember) {
    if (remember) {
      store('local', K_USER, id);
      store('session', K_USER, null);
    } else {
      store('session', K_USER, id);
      store('local', K_USER, null);
    }
    store('local', K_REMEMBER, remember ? '1' : '0');
    store('local', K_LAST, username || '');
  }

  function storedUserId() {
    return store('session', K_USER) || store('local', K_USER);
  }

  function clearLogin() {
    store('local', K_USER, null);
    store('session', K_USER, null);
  }

  /** Ô mật khẩu kèm nút con mắt để kiểm tra mình gõ đúng chưa */
  function passField(id, label, autocomplete, help) {
    return '<div class="field">' +
        '<label for="' + id + '">' + label + '</label>' +
        '<div class="pass-wrap">' +
          '<input class="input" type="password" id="' + id + '" autocomplete="' + autocomplete + '">' +
          '<button class="pass-eye" type="button" data-eye="' + id + '" ' +
            'aria-label="Hiện mật khẩu" aria-pressed="false">' + U.icon('eye') + '</button>' +
        '</div>' +
        (help ? '<span class="help">' + help + '</span>' : '') +
      '</div>';
  }

  /* Bấm con mắt thì đổi giữa che và hiện. Gắn một lần trên document nên
     dùng được cho mọi ô mật khẩu, kể cả ô nằm trong hộp thoại. */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-eye]');
    if (!b) return;
    var inp = document.getElementById(b.getAttribute('data-eye'));
    if (!inp) return;
    var show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    b.setAttribute('aria-pressed', String(show));
    b.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    b.innerHTML = U.icon(show ? 'eyeOff' : 'eye');
    inp.focus();
  });

  function renderLogin() {
    revokeUrls();
    var app = document.getElementById('app');
    var lastUser = store('local', K_LAST) || '';
    var remember = store('local', K_REMEMBER) !== '0';   /* mặc định có ghi nhớ */

    app.innerHTML =
      '<div class="login">' +

        /* Nét mặt bằng chìm làm nền — thuần trang trí */
        '<svg class="login-plan" viewBox="0 0 320 240" fill="none" stroke="currentColor" ' +
          'stroke-width="3" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M14 14h292v212H14z"/>' +
          '<path d="M14 120h104M118 14v106M118 120h188M196 120v106"/>' +
          '<path d="M256 226a60 60 0 0 0-60-60"/>' +
          '<path d="M60 14v106M14 66h46"/>' +
          '<path d="M196 14v40M230 54h76"/>' +
          '<path d="M14 244h292M14 238v12M306 238v12"/>' +
        '</svg>' +

        '<div class="login-card">' +
        '<div class="login-brand">' +
          '<img src="' + ASSETS + 'logo.png" alt="Logo MT House" width="480" height="350">' +
          '<h1>Hệ thống báo cáo công việc</h1>' +
        '</div>' +

        '<form id="login-form" novalidate>' +
          '<div class="field">' +
            '<label for="lg-user">Tên đăng nhập <span class="req">*</span></label>' +
            '<input class="input" id="lg-user" autocomplete="username" autocapitalize="off" ' +
              'spellcheck="false" value="' + U.esc(lastUser) + '" required' +
              (lastUser ? '' : ' autofocus') + '>' +
          '</div>' +
          '<div class="field">' +
            '<label for="lg-pass">Mật khẩu <span class="req">*</span></label>' +
            '<div class="pass-wrap">' +
              '<input class="input" id="lg-pass" type="password" autocomplete="current-password" required>' +
              '<button class="pass-eye" type="button" data-eye="lg-pass" ' +
                'aria-label="Hiện mật khẩu" aria-pressed="false">' + U.icon('eye') + '</button>' +
            '</div>' +
            '<span class="err" id="lg-err" hidden></span>' +
          '</div>' +

          '<div class="check-row">' +
            '<input type="checkbox" id="lg-remember"' + (remember ? ' checked' : '') + '>' +
            '<label for="lg-remember">Ghi nhớ đăng nhập trên máy này</label>' +
          '</div>' +

          '<button class="btn btn-primary btn-lg btn-block" type="submit">' + U.icon('check') + ' Đăng nhập</button>' +
        '</form>' +

        '<p class="login-hint">' +
          'Tài khoản do quản lý cấp. Quên mật khẩu thì liên hệ quản lý để cấp lại.' +
        '</p>' +
      '</div></div>';

    if (lastUser) { var pw = U.$('#lg-pass', app); if (pw) pw.focus(); }

    U.$('#login-form', app).addEventListener('submit', function (e) {
      e.preventDefault();
      var errEl = U.$('#lg-err', app);
      var u = U.$('#lg-user', app).value.trim().toLowerCase();
      var p = U.$('#lg-pass', app).value;

      var target = S.employees.filter(function (x) {
        return String(x.username || '').toLowerCase() === u;
      })[0];

      if (!target || String(target.password) !== p) {
        errEl.innerHTML = U.icon('alert') + '<span>Tên đăng nhập hoặc mật khẩu không đúng.</span>';
        errEl.hidden = false;
        U.$('#lg-pass', app).setAttribute('aria-invalid', 'true');
        return;
      }
      if (target.active === false) {
        errEl.innerHTML = U.icon('alert') + '<span>Tài khoản này đã ngưng hoạt động. Liên hệ quản lý.</span>';
        errEl.hidden = false;
        return;
      }

      rememberLogin(target.id, target.username, U.$('#lg-remember', app).checked);
      S.user = target;
      errEl.hidden = true;
      var home = '#/' + homeView();
      if (location.hash === home) render(); else location.hash = home;
    });
  }

  /* --- Tài khoản của tôi: đổi mật khẩu --- */
  function openAccountDialog() {
    var me = S.user;
    var el = U.openOverlay('<div class="dialog" style="max-width:460px">' +
      '<div class="dialog-head"><h3>Tài khoản của tôi</h3>' +
        '<button class="icon-btn" type="button" data-close aria-label="Đóng">' + U.icon('x') + '</button></div>' +
      '<div class="dialog-body">' +
        '<div class="field"><span class="field-label">Họ và tên</span>' +
          '<input class="input" value="' + U.esc(me.name) + '" readonly tabindex="-1"></div>' +
        '<div class="field"><span class="field-label">Tên đăng nhập</span>' +
          '<input class="input" value="' + U.esc(me.username || '') + '" readonly tabindex="-1">' +
          '<span class="help">Tên đăng nhập do quản lý cấp, không tự đổi được.</span></div>' +
        '<h4 style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;' +
          'color:var(--ink-3);margin:22px 0 12px">Đổi mật khẩu</h4>' +
        passField('ac-old', 'Mật khẩu hiện tại <span class="req">*</span>', 'current-password') +
        passField('ac-new', 'Mật khẩu mới <span class="req">*</span>', 'new-password', 'Ít nhất 6 ký tự.') +
        '<div class="field"><label for="ac-new2">Nhập lại mật khẩu mới <span class="req">*</span></label>' +
          '<div class="pass-wrap">' +
            '<input class="input" type="password" id="ac-new2" autocomplete="new-password">' +
            '<button class="pass-eye" type="button" data-eye="ac-new2" ' +
              'aria-label="Hiện mật khẩu" aria-pressed="false">' + U.icon('eye') + '</button>' +
          '</div>' +
          '<span class="err" id="ac-err" hidden></span></div>' +
      '</div>' +
      '<div class="dialog-foot"><button class="btn" type="button" data-close>Đóng</button>' +
        '<button class="btn btn-primary" type="button" data-save>' + U.icon('check') + ' Đổi mật khẩu</button></div>' +
    '</div>');

    el.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-close]')) return U.closeOverlay();
      if (!ev.target.closest('[data-save]')) return;
      var errEl = U.$('#ac-err', el);
      var old = U.$('#ac-old', el).value, n1 = U.$('#ac-new', el).value, n2 = U.$('#ac-new2', el).value;

      function fail(msg) {
        errEl.innerHTML = U.icon('alert') + '<span>' + U.esc(msg) + '</span>';
        errEl.hidden = false;
      }
      if (String(me.password) !== old) return fail('Mật khẩu hiện tại không đúng.');
      if (n1.length < 6) return fail('Mật khẩu mới phải có ít nhất 6 ký tự.');
      if (n1 !== n2) return fail('Hai lần nhập mật khẩu mới không giống nhau.');

      Store.get('employees', me.id).then(function (rec) {
        rec.password = n1;
        return Store.put('employees', rec);
      }).then(function () {
        U.closeOverlay();
        U.toast('Đã đổi mật khẩu', 'ok');
        return reload();
      });
    });
  }

  function logout() {
    clearLogin();
    S.user = null;
    location.hash = '';
    renderLogin();
  }

  /* =========================================================
     KHUNG ỨNG DỤNG
     ========================================================= */
  /** Quản lý: số báo cáo chờ duyệt. Nhân viên: số báo cáo bị trả lại cần sửa. */
  function pendingCount() {
    if (isAdmin()) {
      return S.reports.filter(function (r) { return r.status === 'pending'; }).length;
    }
    return S.reports.filter(function (r) {
      return r.status === 'rejected' && r.employeeId === S.user.id;
    }).length;
  }

  /** Tối đa 5 mục trên thanh dưới cùng ở điện thoại.
      Quản lý mở đầu bằng Tổng hợp; nhân viên mở đầu bằng ô nhập việc.
      Quản lý vẫn vào được màn hình gửi báo cáo qua nút “Báo cáo mới”. */
  function navFor() {
    var order = isAdmin()
      ? ['summary', 'list', 'projects', 'quotes', 'timesheet']
      : ['send', 'list', 'timesheet', 'summary'];
    return order.map(function (id) {
      return NAV.filter(function (n) { return n.id === id; })[0];
    }).filter(function (it) { return it && it.roles.indexOf(S.user.role) >= 0; });
  }
  function allowedViews() {
    var ids = navFor().map(function (n) { return n.id; }).concat(['send']);
    if (isAdmin()) ids.push('settings', 'quotes', 'quote');
    return ids;
  }
  function homeView() { return navFor()[0].id; }

  function navHtml(current, compact) {
    var n = pendingCount();
    var due = isAdmin() ? dueNowCount() : 0;
    return navFor()
      .map(function (it) {
        var badge = '';
        if (it.id === 'list' && n) {
          badge = '<span class="nav-badge" aria-label="' + n +
            (isAdmin() ? ' báo cáo chờ duyệt' : ' báo cáo bị trả lại cần sửa') + '">' + n + '</span>';
        } else if (it.id === 'projects' && due) {
          badge = '<span class="nav-badge" aria-label="' + due + ' khách cần liên hệ">' + due + '</span>';
        }
        return '<a class="nav-item" href="#/' + it.id + '"' +
          (current === it.id ? ' aria-current="page"' : '') + '>' +
          U.icon(it.icon) + '<span>' + U.esc(compact ? it.short : it.label) + '</span>' + badge + '</a>';
      }).join('');
  }

  function renderShell(current) {
    var app = document.getElementById('app');
    app.innerHTML =
      '<div class="shell">' +
        '<header class="topbar">' +
          '<span class="brand-chip"><img src="' + ASSETS + 'logo-wide.png" alt="MT House" width="503" height="139"></span>' +
          '<div class="topbar-title">Hệ thống báo cáo công việc</div>' +
          '<div class="topbar-spacer"></div>' +
          '<button class="topbar-user" id="btn-account" type="button" ' +
            'aria-label="Tài khoản của tôi, đổi mật khẩu">' +
            '<span class="avatar" aria-hidden="true">' + U.esc(U.initials(S.user.name)) + '</span>' +
            '<b>' + U.esc(S.user.name) + '</b>' +
          '</button>' +
          (isAdmin()
            ? '<a class="icon-btn" href="#/settings" aria-label="Cài đặt hệ thống" title="Cài đặt">' +
              U.icon('settings') + '</a>'
            : '') +
          '<button class="icon-btn" id="btn-logout" type="button" aria-label="Đăng xuất">' + U.icon('logout') + '</button>' +
        '</header>' +

        '<div class="body-row">' +
          '<nav class="sidebar" aria-label="Điều hướng chính">' +
            '<div class="nav-group-label">' + (isAdmin() ? 'Quản lý' : 'Nhân viên') + '</div>' +
            navHtml(current, false) +
            '<div class="sidebar-foot">' +
              U.esc(S.user.position || (isAdmin() ? 'Ban quản lý' : '')) +
              '<br>Dữ liệu lưu trên máy này.' +
            '</div>' +
          '</nav>' +
          '<main class="main" id="main" tabindex="-1"></main>' +
        '</div>' +

        '<nav class="bottomnav" aria-label="Điều hướng chính (di động)">' + navHtml(current, true) + '</nav>' +
      '</div>';

    U.$('#btn-account').addEventListener('click', openAccountDialog);
    U.$('#btn-logout').addEventListener('click', function () {
      U.confirmDialog({ title: 'Đăng xuất', message: 'Bạn có chắc muốn đăng xuất khỏi hệ thống?', okText: 'Đăng xuất' })
        .then(function (ok) { if (ok) logout(); });
    });
    return U.$('#main');
  }

  /* =========================================================
     BỘ LỌC DÙNG CHUNG
     ========================================================= */
  /** Chỉ liệt kê những tháng thực sự có dữ liệu — một ô chọn thay cho ba nút */
  function monthsWithData() {
    var set = {};
    S.reports.forEach(function (r) { set[r.date.slice(0, 7)] = true; });
    set[U.monthISO()] = true;
    return Object.keys(set).sort().reverse();
  }

  function monthSelect(month, allowAll) {
    var ms = monthsWithData();
    if (month && ms.indexOf(month) < 0) ms.unshift(month);
    return '<div class="field" style="min-width:168px"><label for="f-month">Tháng</label>' +
      '<select class="select" id="f-month">' +
        (allowAll ? '<option value="_all"' + (!month ? ' selected' : '') + '>Tất cả các tháng</option>' : '') +
        ms.map(function (m) {
          return '<option value="' + m + '"' + (m === month ? ' selected' : '') + '>' + U.monthVN(m) + '</option>';
        }).join('') +
      '</select></div>';
  }

  function bindMonthSelect(root) {
    var el = U.$('#f-month', root);
    if (el) el.addEventListener('change', function () { setQ({ month: el.value }); });
  }

  /**
   * Ba bước khởi động, chỉ hiện khi hệ thống còn trống.
   * Tự biến mất khi đã có nhân viên, khách hàng và báo cáo đầu tiên.
   */
  function setupGuideHtml() {
    if (!isAdmin()) return '';
    var nStaff = staffList().length;
    var nProj = S.projects.length;
    var nRep = S.reports.length;
    if (nStaff && nProj && nRep) return '';

    var steps = [
      [nStaff > 0, 'Thêm nhân viên và cấp tài khoản đăng nhập',
        'Cài đặt → Nhân viên', '#/settings?tab=emp', 'Thêm nhân viên'],
      [nProj > 0, 'Thêm khách hàng / công trình đang làm',
        'Menu Khách hàng', '#/projects', 'Thêm khách hàng'],
      [nRep > 0, 'Nhân viên gửi báo cáo đầu tiên',
        'Nhân viên tự gửi, hoặc quản lý nhập hộ', '#/send', 'Nhập hộ báo cáo']
    ];
    var next = steps.filter(function (s) { return !s[0]; })[0];

    return '<div class="card" style="border-left:4px solid var(--brand-500);margin-bottom:20px">' +
      '<div class="card-head"><h3>Bắt đầu sử dụng</h3>' +
        '<span class="sub">Ba bước để hệ thống chạy được với dữ liệu thật</span></div>' +
      '<div class="card-body">' +
        '<ol class="stage-list" style="--bar:var(--brand-600)">' +
          steps.map(function (s, i) {
            var cls = s[0] ? 'done' : (s === next ? 'cur' : '');
            return '<li class="' + cls + '">' +
              '<b>' + (s[0] ? '✓' : (i + 1)) + '</b>' +
              '<span>' + U.esc(s[1]) +
                '<span class="t-muted" style="font-weight:400"> · ' + U.esc(s[2]) + '</span></span>' +
              (s[0] ? '' : '<a class="btn btn-sm' + (s === next ? ' btn-primary' : '') +
                '" href="' + s[3] + '">' + U.esc(s[4]) + '</a>') +
            '</li>';
          }).join('') +
        '</ol>' +
      '</div></div>';
  }

  /**
   * Dòng nhắc dưới bộ lọc.
   * Quản lý cần biết còn bao nhiêu báo cáo chờ duyệt.
   * Nhân viên không duyệt gì cả, nên chỉ nhắc những báo cáo bị trả lại cần sửa.
   */
  function pendingNote(month, employeeId) {
    if (isAdmin()) {
      var n = reportsIn({ month: month, employeeId: employeeId, status: 'pending' }).length;
      if (!n) return '';
      return '<p class="help no-print" style="margin:-8px 0 16px">' + U.icon('clock') +
        ' Còn <b>' + n + ' báo cáo chờ duyệt</b> chưa được tính vào số liệu bên dưới. ' +
        '<a href="#/list?status=pending&amp;month=' + encodeURIComponent(month) + '">Duyệt ngay</a></p>';
    }
    var r = reportsIn({ month: month, employeeId: S.user.id, status: 'rejected' }).length;
    if (!r) return '';
    return '<p class="help no-print" style="margin:-8px 0 16px;color:#A82F2F">' + U.icon('alert') +
      ' Có <b>' + r + ' báo cáo bị trả lại</b> cần sửa rồi gửi lại. ' +
      '<a href="#/list?status=rejected&amp;month=' + encodeURIComponent(month) + '">Xem ngay</a></p>';
  }

  function employeePicker(value, allowAll) {
    if (!isAdmin()) return '';
    return '<div class="field grow" style="min-width:200px">' +
      '<label for="f-emp">Nhân viên</label>' +
      '<select class="select" id="f-emp">' +
        (allowAll ? '<option value="">Tất cả nhân viên</option>' : '') +
        staffList().map(function (e) {
          return '<option value="' + e.id + '"' + (value === e.id ? ' selected' : '') + '>' + U.esc(e.name) + '</option>';
        }).join('') +
      '</select></div>';
  }

  /* =========================================================
     MÀN HÌNH 1 — GỬI BÁO CÁO
     ========================================================= */
  function viewSend(main, q) {
    var editing = q.edit ? S.reports.filter(function (r) { return r.id === q.edit; })[0] : null;
    var pendingImgs = [];  /* ảnh mới chọn, chưa lưu */
    var keptImgs = [];     /* ảnh cũ khi sửa */

    var r = editing || {
      date: U.todayISO(), projectId: '', categoryId: S.categories[0] ? S.categories[0].id : '',
      timeFrom: S.settings.hcFrom, timeTo: S.settings.hcTo, hc: '', tc: '', description: '', reason: ''
    };
    var targetEmp = editing ? editing.employeeId : (isAdmin() ? (q.emp || (staffList()[0] || {}).id || '') : S.user.id);

    function step(n, title) {
      return '<div class="step"><span class="step-n" aria-hidden="true">' + n + '</span>' +
        '<span class="step-t">' + title + '</span></div>';
    }

    main.innerHTML =
      '<div class="page-head">' +
        '<div><h2>' + (editing ? 'Sửa báo cáo' : 'Gửi báo cáo công việc') + '</h2></div>' +
      '</div>' +

      '<form id="rp-form" novalidate><div class="form-2col">' +

      /* ---------- Cột trái: công trình → hạng mục → công việc ---------- */
      '<div class="card"><div class="card-body">' +

        (isAdmin() && !editing
          ? '<div class="field"><label for="f-emp-of">Gửi thay cho nhân viên</label>' +
            '<select class="select" id="f-emp-of">' +
              staffList().map(function (e) {
                return '<option value="' + e.id + '"' + (targetEmp === e.id ? ' selected' : '') + '>' + U.esc(e.name) + '</option>';
              }).join('') +
            '</select></div>'
          : '') +

        '<div class="step-block">' + step(1, 'Mã công trình') +
          '<div class="field">' +
            '<label class="visually-hidden" for="f-proj">Mã công trình</label>' +
            '<select class="select" id="f-proj" required><option value="">— Chọn công trình —</option>' +
              S.projects.filter(function (p) { return p.active !== false || p.id === r.projectId; })
                .map(function (p) {
                  return '<option value="' + p.id + '"' + (r.projectId === p.id ? ' selected' : '') + '>' +
                    U.esc(p.code + ' · ' + p.name) + '</option>';
                }).join('') +
            '</select></div>' +
        '</div>' +

        '<div class="step-block">' + step(2, 'Hạng mục') +
          '<div class="segmented">' +
            S.categories.map(function (c) {
              return '<input type="radio" name="cat" id="cat-' + c.id + '" value="' + c.id + '"' +
                ((r.categoryId || S.categories[0].id) === c.id ? ' checked' : '') + '>' +
                '<label for="cat-' + c.id + '"><span class="seg-dot" style="background:' + c.hex + '"></span>' +
                U.esc(c.name) + '</label>';
            }).join('') +
          '</div>' +
        '</div>' +

        '<div class="step-block">' + step(3, 'Công việc đã làm') +
          '<div class="field">' +
            '<label class="visually-hidden" for="f-desc">Diễn giải nội dung công việc</label>' +
            '<textarea class="textarea" id="f-desc" rows="3" required ' +
              'placeholder="Ví dụ: Triển khai bản vẽ nội thất chi tiết thi công tầng 2.">' + U.esc(r.description) + '</textarea>' +
          '</div>' +

          '<div class="inline-row" style="margin-top:10px">' +
            '<div class="field"><label for="f-date">Ngày</label>' +
              '<input class="input" type="date" id="f-date" value="' + U.esc(r.date) + '" required></div>' +
            '<div class="field"><label for="f-from">Bắt đầu</label>' +
              '<input class="input" type="time" id="f-from" value="' + U.esc(r.timeFrom) + '" required></div>' +
            '<div class="field"><label for="f-to">Kết thúc</label>' +
              '<input class="input" type="time" id="f-to" value="' + U.esc(r.timeTo) + '" required></div>' +
            '<div class="field"><label for="f-hc">Giờ HC</label>' +
              '<input class="input num" type="number" id="f-hc" min="0" max="24" step="0.25" value="' + (r.hc === '' ? '' : r.hc) + '" required></div>' +
            '<div class="field"><label for="f-tc">Giờ TC</label>' +
              '<input class="input num" type="number" id="f-tc" min="0" max="24" step="0.25" value="' + (r.tc === '' ? '' : r.tc) + '"></div>' +
          '</div>' +
          '<span class="help" id="calc-hint">Giờ HC / TC tự tính theo khung giờ, sửa lại được.</span>' +

          '<div><button class="link-more" type="button" id="btn-reason">' +
            (r.reason ? 'Ẩn lý do / mục tiêu' : '+ Thêm lý do / mục tiêu (không bắt buộc)') + '</button></div>' +
          '<div class="field" id="reason-wrap"' + (r.reason ? '' : ' hidden') + '>' +
            '<label class="visually-hidden" for="f-reason">Lý do / Mục tiêu thực hiện</label>' +
            '<input class="input" id="f-reason" value="' + U.esc(r.reason || '') + '" ' +
              'placeholder="Ví dụ: Chuẩn bị hồ sơ báo giá thi công chính xác."></div>' +

          '<span class="err" id="f-err" hidden></span>' +
        '</div>' +
      '</div></div>' +

      /* ---------- Cột phải: ảnh + nút gửi ---------- */
      '<div class="card"><div class="card-body">' +
        step(4, 'Hình ảnh công việc') +
        '<div class="dropzone" id="dz">' + U.icon('upload') +
          '<p>Kéo thả ảnh, hoặc dán <span class="kbd">Ctrl</span>+<span class="kbd">V</span></p>' +
          '<div class="btn-row" style="justify-content:center;margin-top:10px">' +
            '<button class="btn btn-sm" type="button" id="btn-pick">' + U.icon('image') + ' Chọn ảnh</button>' +
          '</div>' +
          '<input type="file" id="f-files" accept="image/*" multiple hidden>' +
        '</div>' +
        '<div class="shots" id="shots" style="margin-top:12px"></div>' +

        '<div class="btn-row" style="margin-top:18px">' +
          '<button class="btn btn-primary btn-lg btn-block" type="submit">' + U.icon('send') + ' ' +
            (editing ? 'Cập nhật &amp; gửi duyệt lại' : 'Gửi báo cáo') + '</button>' +
          (editing ? '<a class="btn btn-block" href="#/list">Huỷ</a>' : '') +
        '</div>' +
      '</div></div>' +

      '</div></form>';

    /* --- ảnh --- */
    var shotsEl = U.$('#shots', main);

    function paintShots() {
      var html = '';
      keptImgs.forEach(function (im, i) {
        html += '<div class="shot" style="cursor:default">' +
          '<img src="' + urlOf(im.blob) + '" alt="Ảnh đã đính kèm ' + (i + 1) + '">' +
          '<button class="shot-del" type="button" data-kept="' + i + '" aria-label="Gỡ ảnh này">' + U.icon('x') + '</button></div>';
      });
      pendingImgs.forEach(function (im, i) {
        html += '<div class="shot" style="cursor:default">' +
          '<img src="' + im.url + '" alt="Ảnh mới ' + (i + 1) + '">' +
          '<button class="shot-del" type="button" data-new="' + i + '" aria-label="Gỡ ảnh này">' + U.icon('x') + '</button></div>';
      });
      shotsEl.innerHTML = html;
    }

    if (editing) {
      Store.imagesOf(editing.id).then(function (list) { keptImgs = list; paintShots(); });
    }

    shotsEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-new],[data-kept]');
      if (!b) return;
      if (b.hasAttribute('data-new')) pendingImgs.splice(Number(b.getAttribute('data-new')), 1);
      else keptImgs.splice(Number(b.getAttribute('data-kept')), 1);
      paintShots();
    });

    function addFiles(files) {
      var imgs = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type); });
      if (!imgs.length) return;
      Promise.all(imgs.map(function (f) {
        return U.compressImage(f).then(function (o) {
          return { blob: o.blob, w: o.w, h: o.h, name: f.name, url: urlOf(o.blob) };
        }).catch(function () { return null; });
      })).then(function (list) {
        list.filter(Boolean).forEach(function (i) { pendingImgs.push(i); });
        paintShots();
        U.toast('Đã thêm ' + list.filter(Boolean).length + ' ảnh', 'ok');
      });
    }

    var dz = U.$('#dz', main), fileInput = U.$('#f-files', main);
    U.$('#btn-pick', main).addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () { addFiles(fileInput.files); fileInput.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('over'); });
    });
    dz.addEventListener('drop', function (e) { if (e.dataTransfer) addFiles(e.dataTransfer.files); });

    main._onPaste = function (e) {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length) {
        addFiles(e.clipboardData.files);
      }
    };
    document.addEventListener('paste', main._onPaste);

    /* --- lý do: chỉ hiện khi cần --- */
    var reasonBtn = U.$('#btn-reason', main), reasonWrap = U.$('#reason-wrap', main);
    reasonBtn.addEventListener('click', function () {
      reasonWrap.hidden = !reasonWrap.hidden;
      reasonBtn.textContent = reasonWrap.hidden
        ? '+ Thêm lý do / mục tiêu (không bắt buộc)' : 'Ẩn lý do / mục tiêu';
      if (!reasonWrap.hidden) U.$('#f-reason', main).focus();
    });

    /* --- giờ HC / TC tự tính theo khung giờ --- */
    function recalcHours() {
      var res = U.splitHours(U.$('#f-from', main).value, U.$('#f-to', main).value, {
        hcFrom: S.settings.hcFrom, hcTo: S.settings.hcTo,
        lunchFrom: S.settings.lunchFrom, lunchTo: S.settings.lunchTo,
        weekend: U.isWeekend(U.$('#f-date', main).value)
      });
      if (!res) return;
      U.$('#f-hc', main).value = res.hc;
      U.$('#f-tc', main).value = res.tc;
      U.$('#calc-hint', main).textContent =
        'Tự tính từ khung giờ: ' + U.hours(res.hc) + ' giờ HC, ' + U.hours(res.tc) + ' giờ TC — sửa lại được.';
    }
    ['#f-from', '#f-to', '#f-date'].forEach(function (s) {
      U.$(s, main).addEventListener('change', recalcHours);
    });
    if (!editing && r.hc === '') recalcHours();

    /* --- gửi --- */
    U.$('#rp-form', main).addEventListener('submit', function (e) {
      e.preventDefault();
      var errEl = U.$('#f-err', main);
      var picked = U.$('input[name=cat]:checked', main);
      var data = {
        employeeId: isAdmin() && !editing ? U.$('#f-emp-of', main).value : targetEmp,
        date: U.$('#f-date', main).value,
        projectId: U.$('#f-proj', main).value,
        categoryId: picked ? picked.value : '',
        description: U.$('#f-desc', main).value.trim(),
        reason: U.$('#f-reason', main).value.trim(),
        timeFrom: U.$('#f-from', main).value,
        timeTo: U.$('#f-to', main).value,
        hc: Number(U.$('#f-hc', main).value) || 0,
        tc: Number(U.$('#f-tc', main).value) || 0
      };

      var miss = [];
      if (!data.employeeId) miss.push('nhân viên (hãy thêm nhân viên trong Cài đặt trước)');
      if (!data.date) miss.push('ngày làm việc');
      if (!data.projectId) miss.push('công trình');
      if (!data.description) miss.push('diễn giải công việc');
      if (!data.timeFrom || !data.timeTo) miss.push('khung giờ');
      if (data.hc + data.tc <= 0) miss.push('số giờ (HC hoặc TC phải lớn hơn 0)');
      if (miss.length) {
        errEl.innerHTML = U.icon('alert') + '<span>Còn thiếu: ' + U.esc(miss.join(', ')) + '.</span>';
        errEl.hidden = false;
        errEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      errEl.hidden = true;

      var rec = editing
        ? Object.assign({}, editing, data, { status: 'pending', reviewNote: '', reviewedBy: '', reviewedAt: 0 })
        : Object.assign({ status: 'pending', reviewNote: '', reviewedBy: '', reviewedAt: 0 }, data);

      Store.saveReport(rec)
        .then(function (saved) {
          var work = [];
          if (editing) {
            work.push(Store.imagesOf(saved.id).then(function (old) {
              var keep = keptImgs.map(function (k) { return k.id; });
              return Promise.all(old.filter(function (o) { return keep.indexOf(o.id) < 0; })
                .map(function (o) { return Store.del('images', o.id); }));
            }));
          }
          pendingImgs.forEach(function (im) {
            work.push(Store.addImage(saved.id, im.blob, im.w, im.h, im.name));
          });
          return Promise.all(work).then(function () {
            saved.imageCount = keptImgs.length + pendingImgs.length;
            return Store.put('reports', saved);
          });
        })
        .then(function () {
          U.toast(editing ? 'Đã cập nhật và gửi duyệt lại' : 'Đã gửi báo cáo, chờ quản lý duyệt', 'ok');
          return reload();
        })
        .then(function () { go('list', { month: U.monthISO(data.date), status: 'pending' }); })
        .catch(function (err) { U.toast('Lỗi khi lưu: ' + err.message, 'err'); });
    });
  }

  /* =========================================================
     MÀN HÌNH 2 — DANH SÁCH & DUYỆT BÁO CÁO
     ========================================================= */
  /** '' = tất cả các tháng (dùng cho hàng đợi duyệt) */
  function readMonth(q, fallback) {
    if (q.month === '_all') return '';
    return q.month || fallback;
  }

  function viewList(main, q) {
    var month = readMonth(q, '');
    var scopeEmp = isAdmin() ? (q.emp || '') : S.user.id;

    /* Mở màn hình là thấy ngay việc cần xử lý. Nếu không còn gì chờ duyệt
       thì hiện tất cả, tránh mở ra một trang trống. */
    var hasPending = reportsIn({ employeeId: scopeEmp, status: 'pending' }).length > 0;
    var curStatus = q.status === '_all' ? '_all' : (q.status || (hasPending ? 'pending' : '_all'));

    var f = {
      month: month,
      employeeId: scopeEmp,
      status: curStatus === '_all' ? '' : curStatus,
      projectId: q.proj || '',
      q: q.q || ''
    };
    var all = reportsIn(f).reverse();
    var LIMIT = 60;
    var rows = all.slice(0, LIMIT);
    var nPending = reportsIn({ month: month, employeeId: f.employeeId, status: 'pending' }).length;
    var scope = month ? U.monthVN(month) : 'Tất cả các tháng';

    main.innerHTML =
      '<div class="page-head">' +
        '<div><h2>' + (isAdmin() ? 'Duyệt &amp; quản lý báo cáo' : 'Báo cáo của tôi') + '</h2>' +
        '<p>' + U.esc(scope) + ' · ' + all.length + ' báo cáo' +
          (curStatus !== '_all' ? ' ' + STATUS[curStatus].label.toLowerCase() : '') +
          (nPending && curStatus === '_all'
            ? ' · <b style="color:var(--st-warn)">' + nPending + ' chờ duyệt</b>' : '') + '</p></div>' +
        '<div class="grow"></div>' +
        (isAdmin() && nPending
          ? '<button class="btn btn-good" id="btn-approve-all">' + U.icon('check') + ' Duyệt tất cả (' + nPending + ')</button>'
          : '') +
        '<a class="btn btn-primary" href="#/send">' + U.icon('plus') + ' Báo cáo mới</a>' +
      '</div>' +

      '<div class="filterbar" id="fbar">' +
        monthSelect(month, true) +
        employeePicker(f.employeeId, true) +
        '<div class="field" style="min-width:150px"><label for="f-status">Trạng thái</label>' +
          '<select class="select" id="f-status">' +
            ['_all', 'pending', 'approved', 'rejected'].map(function (s) {
              return '<option value="' + s + '"' + (curStatus === s ? ' selected' : '') + '>' +
                (s === '_all' ? 'Tất cả trạng thái' : STATUS[s].label) + '</option>';
            }).join('') +
          '</select></div>' +
        '<div class="field grow" style="min-width:170px"><label for="f-q">Tìm kiếm</label>' +
          '<input class="input" id="f-q" value="' + U.esc(f.q) + '" placeholder="Công trình, nội dung công việc…"></div>' +
      '</div>' +

      '<div class="report-list" id="rl"></div>';

    var fbar = U.$('#fbar', main);
    bindMonthSelect(fbar);
    var sel = U.$('#f-emp', fbar); if (sel) sel.addEventListener('change', function () { setQ({ emp: sel.value }); });
    U.$('#f-status', fbar).addEventListener('change', function (e) { setQ({ status: e.target.value }); });
    U.$('#f-q', fbar).addEventListener('input', U.debounce(function (e) { setQ({ q: e.target.value }); }, 350));

    var listEl = U.$('#rl', main);
    if (!rows.length) {
      listEl.innerHTML = '<div class="card"><div class="empty">' + U.icon('inbox') +
        '<h3>Chưa có báo cáo nào</h3>' +
        '<p>Không tìm thấy báo cáo phù hợp với bộ lọc' + (month ? ' trong ' + U.monthVN(month).toLowerCase() : '') + '.</p>' +
        '<a class="btn btn-primary" href="#/send">' + U.icon('plus') + ' Tạo báo cáo đầu tiên</a>' +
        '</div></div>';
    } else {
      Promise.all(rows.map(function (r) {
        return r.imageCount ? Store.imagesOf(r.id) : Promise.resolve([]);
      })).then(function (imgSets) {
        listEl.innerHTML = rows.map(function (r, i) { return reportCard(r, imgSets[i]); }).join('') +
          (all.length > LIMIT
            ? '<p class="help" style="text-align:center;padding:8px">Đang hiển thị ' + LIMIT + ' báo cáo mới nhất trên tổng số ' +
              all.length + '. Hãy lọc theo tháng hoặc công trình để thu hẹp danh sách.</p>'
            : '');
        bindCardActions(listEl, rows, imgSets);
      });
    }

    var approveAll = U.$('#btn-approve-all', main);
    if (approveAll) approveAll.addEventListener('click', function () {
      U.confirmDialog({
        title: 'Duyệt tất cả',
        message: 'Duyệt ' + nPending + ' báo cáo đang chờ' + (month ? ' trong ' + U.monthVN(month).toLowerCase() : ' (tất cả các tháng)') + '?',
        okText: 'Duyệt tất cả'
      }).then(function (ok) {
        if (!ok) return;
        var list = reportsIn({ month: month, employeeId: f.employeeId, status: 'pending' });
        return Promise.all(list.map(function (r) {
          r.status = 'approved'; r.reviewedBy = S.user.id; r.reviewedAt = Date.now(); r.reviewNote = '';
          return Store.put('reports', r);
        })).then(function () {
          U.toast('Đã duyệt ' + list.length + ' báo cáo', 'ok');
          return reload();
        }).then(render);
      });
    });
  }

  function reportCard(r, imgs) {
    var st = STATUS[r.status] || STATUS.pending;
    var p = proj(r.projectId), c = cat(r.categoryId), e = emp(r.employeeId);
    var canEdit = isAdmin() || (r.employeeId === S.user.id && r.status !== 'approved');

    return '<article class="report is-' + r.status + '" data-id="' + r.id + '">' +
      '<div class="report-head">' +
        '<span class="report-date">' + U.weekdayVN(r.date) + ' · ' + U.dateVN(r.date) + '</span>' +
        (isAdmin() ? '<span class="t-muted" style="font-size:13px">' + U.esc(e.name) + '</span>' : '') +
        '<div class="grow"></div>' +
        '<span class="badge ' + st.cls + '">' + U.icon(st.icon) + U.esc(st.label) + '</span>' +
      '</div>' +

      '<div class="report-body">' +
        '<h3 class="report-title">' + U.esc(p.name) + '</h3>' +
        '<p class="report-desc">' + U.esc(r.description) +
          (r.reason ? ' <span class="t-muted" style="font-size:13px">— ' + U.esc(r.reason) + '</span>' : '') + '</p>' +
        '<div class="report-meta">' +
          '<span class="chip"><i class="chip-dot" style="background:' + c.hex + '"></i>' + U.esc(c.name) + '</span>' +
          '<span>' + U.esc(U.rangeVN(r.timeFrom, r.timeTo)) + '</span>' +
          '<span>HC <b>' + U.hours(r.hc) + '</b></span>' +
          '<span>TC <b>' + U.hours(r.tc) + '</b></span>' +
        '</div>' +
        (r.status === 'rejected' && r.reviewNote
          ? '<p class="report-note">' + U.icon('alert') + ' <b>Quản lý yêu cầu sửa:</b> ' + U.esc(r.reviewNote) + '</p>' : '') +
        (imgs && imgs.length
          ? '<div class="shots">' + imgs.map(function (im, i) {
              return '<button class="shot" type="button" data-img="' + r.id + '" data-idx="' + i + '" ' +
                'aria-label="Xem ảnh lớn ' + (i + 1) + ' / ' + imgs.length + '">' +
                '<img src="' + urlOf(im.blob) + '" alt="Ảnh công việc: ' + U.esc(r.description.slice(0, 60)) + '" loading="lazy" ' +
                'width="' + im.w + '" height="' + im.h + '">' +
                '<span class="shot-zoom">' + U.icon('zoom') + '</span></button>';
            }).join('') + '</div>'
          : '') +
      '</div>' +

      '<div class="report-actions">' +
        (isAdmin() && r.status !== 'approved'
          ? '<button class="btn btn-good btn-sm" data-act="approve">' + U.icon('check') + ' Duyệt</button>' : '') +
        (isAdmin() && r.status !== 'rejected'
          ? '<button class="btn btn-sm" data-act="reject">' + U.icon('x') + ' Yêu cầu sửa</button>' : '') +
        (canEdit ? '<button class="btn btn-sm" data-act="edit">' + U.icon('edit') + ' Sửa</button>' : '') +
        '<div class="grow"></div>' +
        (canEdit ? '<button class="btn btn-danger btn-sm" data-act="del">' + U.icon('trash') + ' Xoá</button>' : '') +
      '</div>' +
    '</article>';
  }

  function bindCardActions(root, rows, imgSets) {
    U.on(root, 'click', '[data-act]', function (e, btn) {
      var card = btn.closest('.report');
      var id = card.getAttribute('data-id');
      var r = rows.filter(function (x) { return x.id === id; })[0];
      if (!r) return;
      var act = btn.getAttribute('data-act');

      if (act === 'edit') return go('send', { edit: id });

      if (act === 'approve') {
        r.status = 'approved'; r.reviewedBy = S.user.id; r.reviewedAt = Date.now(); r.reviewNote = '';
        return Store.put('reports', r).then(function () {
          U.toast('Đã duyệt báo cáo', 'ok'); return reload();
        }).then(render);
      }

      if (act === 'reject') return openRejectDialog(r);

      if (act === 'del') {
        return U.confirmDialog({
          title: 'Xoá báo cáo',
          message: 'Xoá báo cáo ngày ' + U.dateVN(r.date) + ' — “' + r.description.slice(0, 70) + '”? Ảnh đính kèm cũng sẽ bị xoá.',
          okText: 'Xoá báo cáo', danger: true
        }).then(function (ok) {
          if (!ok) return;
          return Store.deleteReport(id).then(function () {
            U.toast('Đã xoá báo cáo', 'ok'); return reload();
          }).then(render);
        });
      }
    });

    U.on(root, 'click', '[data-img]', function (e, btn) {
      var id = btn.getAttribute('data-img');
      var idx = Number(btn.getAttribute('data-idx'));
      var i = rows.map(function (x) { return x.id; }).indexOf(id);
      if (i >= 0) openLightbox(imgSets[i], idx, rows[i]);
    });
  }

  function openRejectDialog(r) {
    var el = U.openOverlay(
      '<div class="dialog">' +
        '<div class="dialog-head"><h3>Yêu cầu sửa báo cáo</h3>' +
          '<button class="icon-btn" type="button" data-close aria-label="Đóng">' + U.icon('x') + '</button></div>' +
        '<div class="dialog-body">' +
          '<p class="help" style="margin-bottom:14px">Ngày ' + U.dateVN(r.date) + ' · ' + U.esc(proj(r.projectId).name) + '</p>' +
          '<div class="field"><label for="rj-note">Nội dung cần nhân viên chỉnh sửa <span class="req">*</span></label>' +
            '<textarea class="textarea" id="rj-note" placeholder="Ví dụ: Số giờ tăng ca chưa khớp khung giờ, vui lòng kiểm tra lại."></textarea>' +
            '<span class="help">Nhân viên sẽ thấy ghi chú này ngay trên báo cáo bị trả lại.</span></div>' +
        '</div>' +
        '<div class="dialog-foot">' +
          '<button class="btn" type="button" data-close>Huỷ</button>' +
          '<button class="btn btn-primary" type="button" data-save>Gửi yêu cầu sửa</button>' +
        '</div>' +
      '</div>');

    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) return U.closeOverlay();
      if (!e.target.closest('[data-save]')) return;
      var note = U.$('#rj-note', el).value.trim();
      if (!note) { U.$('#rj-note', el).setAttribute('aria-invalid', 'true'); return U.toast('Vui lòng ghi rõ nội dung cần sửa', 'err'); }
      r.status = 'rejected'; r.reviewNote = note; r.reviewedBy = S.user.id; r.reviewedAt = Date.now();
      Store.put('reports', r).then(function () {
        U.closeOverlay();
        U.toast('Đã gửi yêu cầu sửa cho nhân viên', 'ok');
        return reload();
      }).then(render);
    });
  }

  /* =========================================================
     LIGHTBOX — xem ảnh lớn
     ========================================================= */
  function openLightbox(imgs, idx, r) {
    var i = idx;
    var el = U.openOverlay(
      '<div class="lightbox">' +
        '<div class="lightbox-bar">' +
          '<div class="grow"><b id="lb-title"></b><br><span id="lb-sub" style="opacity:.7"></span></div>' +
          '<button class="icon-btn" type="button" data-dl aria-label="Tải ảnh về máy">' + U.icon('download') + '</button>' +
          '<button class="icon-btn" type="button" data-close aria-label="Đóng">' + U.icon('x') + '</button>' +
        '</div>' +
        '<div class="lightbox-stage"><img id="lb-img" alt=""></div>' +
        '<div class="lightbox-foot">' +
          '<button class="icon-btn" type="button" data-prev aria-label="Ảnh trước">' + U.icon('chevronL') + '</button>' +
          '<span class="icon-btn" style="min-width:84px;font-size:13px" id="lb-count"></span>' +
          '<button class="icon-btn" type="button" data-next aria-label="Ảnh sau">' + U.icon('chevronR') + '</button>' +
        '</div>' +
      '</div>', { bare: true });

    function paint() {
      var im = imgs[i];
      U.$('#lb-img', el).src = urlOf(im.blob);
      U.$('#lb-img', el).alt = 'Ảnh công việc ' + (i + 1) + ': ' + (r ? r.description : '');
      U.$('#lb-title', el).textContent = r ? proj(r.projectId).name : (im.name || 'Ảnh');
      U.$('#lb-sub', el).textContent = r ? (U.dateVN(r.date) + ' · ' + emp(r.employeeId).name) : '';
      U.$('#lb-count', el).textContent = (i + 1) + ' / ' + imgs.length;
      U.$$('[data-prev],[data-next]', el).forEach(function (b) { b.disabled = imgs.length < 2; });
    }
    paint();

    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) return U.closeOverlay();
      if (e.target.closest('[data-prev]')) { i = (i - 1 + imgs.length) % imgs.length; return paint(); }
      if (e.target.closest('[data-next]')) { i = (i + 1) % imgs.length; return paint(); }
      if (e.target.closest('[data-dl]')) {
        return U.downloadBlob('MTHouse_' + (r ? r.date : 'anh') + '_' + (i + 1) + '.jpg', imgs[i].blob);
      }
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { i = (i - 1 + imgs.length) % imgs.length; paint(); }
      if (e.key === 'ArrowRight') { i = (i + 1) % imgs.length; paint(); }
    });
    el.querySelector('[data-close]').focus();
  }

  /* =========================================================
     MÀN HÌNH 3 — BẢNG THEO DÕI BÁO CÁO NGÀY VÀ THÁNG
     ========================================================= */
  function viewTimesheet(main, q) {
    var month = readMonth(q, defaultMonth()) || defaultMonth();
    /* '' = toàn bộ nhân viên (chỉ quản lý mới chọn được) */
    var empId = isAdmin() ? (q.emp || '') : S.user.id;
    var allStaff = !empId;
    var e = allStaff ? null : emp(empId);

    var rows = reportsIn({ month: month, employeeId: empId, status: 'approved' });
    var agg = aggregate(rows);
    var rate = allStaff ? 0 : Store.hourlyRate(e, S.settings);

    var days = U.daysOfMonth(month);
    var used = {};
    rows.forEach(function (r) { used[r.date] = true; });
    var showAll = q.alldays === '1';
    var cols = showAll ? days : days.filter(function (d) { return used[d]; });

    main.innerHTML =
      '<div class="page-head">' +
        '<div><h2>Bảng theo dõi báo cáo ngày và tháng</h2></div>' +
        '<div class="grow"></div>' +
        '<button class="btn btn-primary" id="btn-fs">' + U.icon('zoom') + ' Xem toàn màn hình</button>' +
        '<button class="btn" id="btn-csv">' + U.icon('download') + ' Xuất Excel</button>' +
        '<button class="btn" id="btn-print">' + U.icon('print') + ' Xuất PDF</button>' +
      '</div>' +

      '<div class="filterbar" id="fbar">' +
        monthSelect(month, false) +
        employeePicker(empId, true) +
        '<div class="field"><span class="field-label">Số cột ngày</span>' +
          '<button class="btn btn-sm" type="button" id="tg-days" aria-pressed="' + showAll + '">' +
            (showAll ? 'Tất cả ngày trong tháng' : 'Chỉ ngày có dữ liệu') + '</button></div>' +
      '</div>' +

      pendingNote(month, empId) +

      '<div class="print-head">' +
        '<p style="font-size:11px;text-transform:uppercase;letter-spacing:.06em">' + U.esc(S.settings.company) + '</p>' +
        '<h2 style="color:#B03318;font-size:18px">BẢNG THEO DÕI BÁO CÁO NGÀY VÀ THÁNG</h2>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-head">' +
          '<h3>' + (allStaff ? 'Toàn bộ nhân viên' : U.esc(e.name)) + '</h3>' +
          '<div class="grow"></div>' +
          '<span class="sub num">' + (allStaff
            ? Object.keys(agg.byEmployee).length + ' nhân viên · ' + rows.length + ' đầu việc · ' +
              U.hours(agg.total) + ' giờ'
            : U.vnd(e.salaryMonth) + ' / tháng · ' + (e.workDays || S.settings.standardDays) +
              ' ngày công · ' + U.vnd(rate) + ' mỗi giờ') + '</span>' +
        '</div>' +
        '<div class="card-body flush">' +
          (rows.length
            ? '<div class="table-scroll">' + timesheetTable(rows, cols, agg, allStaff) + '</div>'
            : '<div class="empty">' + U.icon('floorplan') + '<h3>Chưa có dữ liệu</h3>' +
              '<p>Chưa có báo cáo đã duyệt của ' +
              (allStaff ? 'nhân viên nào' : U.esc(e.name)) + ' trong ' + U.monthVN(month).toLowerCase() + '.</p></div>') +
        '</div>' +
      '</div>' +

      /* Khi xem toàn bộ nhân viên thì thêm bảng cộng giờ theo từng người */
      (allStaff && rows.length
        ? '<div class="card"><div class="card-head"><h3>Tổng giờ theo nhân viên</h3></div>' +
          '<div class="card-body flush"><div class="table-scroll"><table class="tbl">' +
            '<thead><tr><th class="c">STT</th><th>Nhân viên</th><th>Vị trí</th>' +
            '<th class="n">Số đầu việc</th><th class="n">Giờ HC</th><th class="n">Giờ TC</th>' +
            '<th class="n">Tổng giờ</th></tr></thead><tbody>' +
            Object.keys(agg.byEmployee).sort(function (a, b) {
              return (agg.byEmployee[b].hc + agg.byEmployee[b].tc) - (agg.byEmployee[a].hc + agg.byEmployee[a].tc);
            }).map(function (k, i) {
              var v = agg.byEmployee[k], who = emp(k);
              return '<tr><td class="c num">' + (i + 1) + '</td>' +
                '<td class="t-strong">' + U.esc(who.name) + '</td>' +
                '<td class="t-muted">' + U.esc(who.position || '') + '</td>' +
                '<td class="n">' + v.n + '</td>' +
                '<td class="n">' + U.hours(v.hc) + '</td>' +
                '<td class="n">' + U.hours(v.tc) + '</td>' +
                '<td class="n t-strong">' + U.hours(v.hc + v.tc) + '</td></tr>';
            }).join('') + '</tbody>' +
            '<tfoot><tr><td colspan="3">TỔNG CỘNG</td><td class="n">' + rows.length + '</td>' +
              '<td class="n">' + U.hours(agg.hc) + '</td><td class="n">' + U.hours(agg.tc) + '</td>' +
              '<td class="n">' + U.hours(agg.total) + '</td></tr></tfoot>' +
          '</table></div></div></div>'
        : '');

    var fbar = U.$('#fbar', main);
    bindMonthSelect(fbar);
    var sel = U.$('#f-emp', fbar); if (sel) sel.addEventListener('change', function () { setQ({ emp: sel.value }); });
    U.$('#tg-days', fbar).addEventListener('click', function () { setQ({ alldays: showAll ? '' : '1' }); });
    U.$('#btn-print', main).addEventListener('click', function () { window.print(); });
    U.$('#btn-csv', main).addEventListener('click', function () {
      exportTimesheetXLSX(e, month, rows, cols, agg, allStaff);
    });

    var fsBtn = U.$('#btn-fs', main);
    fsBtn.disabled = !rows.length;
    fsBtn.addEventListener('click', function () {
      openTableFullscreen(
        'Bảng theo dõi báo cáo ngày và tháng',
        (allStaff ? 'Toàn bộ nhân viên' : e.name) + ' · ' + U.monthVN(month) +
          ' · ' + cols.length + ' ngày · ' + rows.length + ' đầu việc',
        timesheetTable(rows, cols, agg, allStaff));
    });
  }

  /** Mở một bảng ra toàn màn hình, có ba cỡ chữ để bớt phải kéo ngang */
  function openTableFullscreen(title, sub, tableHtml) {
    var el = U.openOverlay(
      '<div class="fullscreen">' +
        '<div class="fs-bar">' +
          '<div><h3>' + U.esc(title) + '</h3>' +
            (sub ? '<div class="sub">' + U.esc(sub) + '</div>' : '') + '</div>' +
          '<div class="grow"></div>' +
          '<span class="sub">Cỡ chữ</span>' +
          '<div class="zoom-group" id="fs-zoom" role="group" aria-label="Cỡ chữ bảng">' +
            '<button type="button" data-z="s" aria-pressed="false">Nhỏ</button>' +
            '<button type="button" data-z="m" aria-pressed="true">Vừa</button>' +
            '<button type="button" data-z="l" aria-pressed="false">Lớn</button>' +
          '</div>' +
          '<button class="icon-btn" type="button" data-print aria-label="In bảng">' + U.icon('print') + '</button>' +
          '<button class="icon-btn" type="button" data-close aria-label="Thoát toàn màn hình">' + U.icon('x') + '</button>' +
        '</div>' +
        '<div class="fs-body" id="fs-body" data-zoom="m">' + tableHtml + '</div>' +
      '</div>', { bare: true });

    var body = U.$('#fs-body', el);
    U.on(U.$('#fs-zoom', el), 'click', '[data-z]', function (ev, b) {
      body.setAttribute('data-zoom', b.getAttribute('data-z'));
      U.$$('#fs-zoom button', el).forEach(function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
      try { localStorage.setItem('mth_ts_zoom', b.getAttribute('data-z')); } catch (err) { /* bỏ qua */ }
    });

    /* Nhớ cỡ chữ đã chọn lần trước */
    var saved = null;
    try { saved = localStorage.getItem('mth_ts_zoom'); } catch (err) { /* bỏ qua */ }
    if (saved) {
      body.setAttribute('data-zoom', saved);
      U.$$('#fs-zoom button', el).forEach(function (x) {
        x.setAttribute('aria-pressed', String(x.getAttribute('data-z') === saved));
      });
    }

    el.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-close]')) return U.closeOverlay();
      if (ev.target.closest('[data-print]')) {
        /* Chỉ in đúng bảng đang mở, không in trang nằm phía sau lớp phủ */
        document.body.classList.add('printing-fs');
        window.print();
        setTimeout(function () { document.body.classList.remove('printing-fs'); }, 500);
      }
    });
    el.querySelector('[data-close]').focus();
  }

  function timesheetTable(rows, cols, agg, showEmployee) {
    var head1 = '<tr>' +
      '<th class="stick" rowspan="2">STT</th>' +
      '<th class="stick" style="left:52px" rowspan="2">Mã công trình</th>' +
      (showEmployee ? '<th rowspan="2">Nhân viên</th>' : '') +
      '<th rowspan="2">Hạng mục</th>' +
      '<th rowspan="2">Diễn giải nội dung công việc</th>' +
      '<th rowspan="2">Khung giờ</th>' +
      '<th class="n" rowspan="2">Tổng HC</th>' +
      '<th class="n" rowspan="2">Tổng TC</th>' +
      cols.map(function (d) {
        return '<th class="dayhead day-group" colspan="2">' + U.weekdayVN(d) + ' (' + U.dayShort(d) + ')</th>';
      }).join('') + '</tr>';

    var head2 = '<tr>' + cols.map(function () {
      return '<th class="daysub day-group">HC</th><th class="daysub">TC</th>';
    }).join('') + '</tr>';

    var body = rows.map(function (r, i) {
      var p = proj(r.projectId), c = cat(r.categoryId);
      return '<tr>' +
        '<td class="stick c num">' + (i + 1) + '</td>' +
        '<td class="stick t-strong" style="left:52px;min-width:180px">' + U.esc(p.name) + '</td>' +
        (showEmployee ? '<td class="t-muted">' + U.esc(emp(r.employeeId).name) + '</td>' : '') +
        '<td><span class="chip"><i class="chip-dot" style="background:' + c.hex + '"></i>' + U.esc(c.name) + '</span></td>' +
        '<td class="t-wrap">' + U.esc(r.description) + '</td>' +
        '<td class="num">' + U.esc(U.rangeVN(r.timeFrom, r.timeTo)) + '</td>' +
        '<td class="n">' + U.hours(r.hc) + '</td>' +
        '<td class="n">' + U.hours(r.tc) + '</td>' +
        cols.map(function (d) {
          var on = d === r.date;
          return '<td class="dayval day-group' + (on && r.hc ? '' : ' zero') + '">' + (on && r.hc ? U.hours(r.hc) : '·') + '</td>' +
            '<td class="dayval' + (on && r.tc ? '' : ' zero') + '">' + (on && r.tc ? U.hours(r.tc) : '·') + '</td>';
        }).join('') +
      '</tr>';
    }).join('');

    var dayTot = {};
    cols.forEach(function (d) { dayTot[d] = { hc: 0, tc: 0 }; });
    rows.forEach(function (r) {
      if (dayTot[r.date]) { dayTot[r.date].hc += Number(r.hc) || 0; dayTot[r.date].tc += Number(r.tc) || 0; }
    });

    var foot = '<tr>' +
      '<td colspan="' + (showEmployee ? 6 : 5) + '" style="text-align:right">TỔNG CỘNG HÀNG THÁNG</td>' +
      '<td class="n">' + U.hours(agg.hc) + '</td>' +
      '<td class="n">' + U.hours(agg.tc) + '</td>' +
      cols.map(function (d) {
        return '<td class="dayval day-group">' + (dayTot[d].hc ? U.hours(dayTot[d].hc) : '·') + '</td>' +
          '<td class="dayval">' + (dayTot[d].tc ? U.hours(dayTot[d].tc) : '·') + '</td>';
      }).join('') +
    '</tr>';

    return '<table class="tbl timesheet"><thead>' + head1 + head2 + '</thead><tbody>' + body +
      '</tbody><tfoot>' + foot + '</tfoot></table>';
  }

  /**
   * Xuất bảng chấm công ra .xlsx có định dạng, dựng đúng bố cục file Excel
   * đang dùng: hai dòng tiêu đề, khối thông tin nhân viên, dải tiêu đề xanh
   * với cột ngày gộp HC/TC, và dòng tổng cộng.
   */
  function exportTimesheetXLSX(e, month, rows, cols, agg, allStaff) {
    var X = XLSX.S;
    var fixed = ['STT', 'Mã công trình'];
    if (allStaff) fixed.push('Nhân viên');
    fixed = fixed.concat(['Hạng mục', 'Diễn giải nội dung công việc', 'Khung giờ', 'Tổng HC', 'Tổng TC']);
    var base = fixed.length;
    var rate = allStaff ? 0 : Store.hourlyRate(e, S.settings);

    var R = [], M = [];

    R[0] = [{ v: S.settings.company, s: X.company }];
    R[1] = [{ v: 'BẢNG THEO DÕI BÁO CÁO NGÀY VÀ THÁNG', h: 22, s: X.title }];
    R[1].h = 24;
    M.push([0, 0, 0, base - 1], [1, 0, 1, base - 1]);

    if (allStaff) {
      R[3] = [{ v: 'Phạm vi:', s: X.label }, { v: 'Toàn bộ nhân viên', s: X.labelFill }, null,
              { v: 'Số nhân viên:', s: X.label }, { v: Object.keys(agg.byEmployee).length },
              { v: 'Tổng giờ:', s: X.label }, { v: agg.total, s: X.num1 }];
      R[4] = [null, null, null, { v: 'Kỳ báo cáo:', s: X.label }, { v: U.monthVN(month) }];
    } else {
      R[3] = [{ v: 'Họ & tên:', s: X.label }, { v: e.name, s: X.labelFill }, null,
              { v: 'Mức lương / tháng:', s: X.label }, { v: Number(e.salaryMonth) || 0, s: X.moneyPlain },
              { v: 'Tổng số ngày:', s: X.label }, { v: Number(e.workDays || S.settings.standardDays) }];
      R[4] = [null, null, null, { v: 'Lương 1 giờ:', s: X.label }, { v: Math.round(rate), s: X.moneyPlain },
              { v: 'Kỳ báo cáo:', s: X.label }, { v: U.monthVN(month) }];
    }
    M.push([3, 1, 3, 2]);

    /* hai dòng tiêu đề: cột cố định gộp dọc, mỗi ngày gộp ngang hai ô HC/TC */
    var HR = 6;
    R[HR] = []; R[HR + 1] = [];
    R[HR].h = 20; R[HR + 1].h = 18;
    fixed.forEach(function (t, i2) {
      R[HR][i2] = { v: t, s: X.head };
      R[HR + 1][i2] = { v: '', s: X.head };
      M.push([HR, i2, HR + 1, i2]);
    });
    cols.forEach(function (d, k) {
      var c = base + k * 2;
      R[HR][c] = { v: U.weekdayVN(d) + ' (' + U.dayShort(d) + ')', s: X.headDay };
      R[HR][c + 1] = { v: '', s: X.headDay };
      M.push([HR, c, HR, c + 1]);
      R[HR + 1][c] = { v: 'HC', s: X.headSub };
      R[HR + 1][c + 1] = { v: 'TC', s: X.headSub };
    });

    var first = HR + 2;
    rows.forEach(function (r, i2) {
      var line = [{ v: i2 + 1, s: X.cellCenter }, { v: proj(r.projectId).name, s: X.cell }];
      if (allStaff) line.push({ v: emp(r.employeeId).name, s: X.cell });
      line.push(
        { v: cat(r.categoryId).name, s: X.cellCenter },
        { v: r.description, s: X.cellWrap },
        { v: U.rangeVN(r.timeFrom, r.timeTo), s: X.cellCenter },
        { v: Number(r.hc) || 0, s: X.num1 },
        { v: Number(r.tc) || 0, s: X.num1 }
      );
      cols.forEach(function (d) {
        var on = d === r.date;
        line.push({ v: on && r.hc ? Number(r.hc) : '', s: X.dayVal });
        line.push({ v: on && r.tc ? Number(r.tc) : '', s: X.dayVal });
      });
      R[first + i2] = line;
    });

    var dayTot = {};
    cols.forEach(function (d) { dayTot[d] = { hc: 0, tc: 0 }; });
    rows.forEach(function (r) {
      if (!dayTot[r.date]) return;
      dayTot[r.date].hc += Number(r.hc) || 0;
      dayTot[r.date].tc += Number(r.tc) || 0;
    });

    var tr = first + rows.length;
    var tot = [];
    for (var i3 = 0; i3 < base - 2; i3++) tot.push({ v: i3 === 0 ? 'TỔNG CỘNG HÀNG THÁNG' : '', s: X.total });
    tot.push({ v: agg.hc, s: X.totalNum }, { v: agg.tc, s: X.totalNum });
    cols.forEach(function (d) {
      tot.push({ v: dayTot[d].hc || '', s: X.totalNum });
      tot.push({ v: dayTot[d].tc || '', s: X.totalNum });
    });
    R[tr] = tot;
    M.push([tr, 0, tr, base - 3]);

    var widths = [6, 30];
    if (allStaff) widths.push(22);
    widths = widths.concat([14, 50, 16, 10, 10]);
    cols.forEach(function () { widths.push(7, 7); });

    var sheets = [{
      name: 'Báo cáo ngày', cols: widths, rows: R, merges: M, freeze: [first, 2]
    }];

    /* Khi xem toàn bộ nhân viên thì thêm sheet cộng giờ theo từng người */
    if (allStaff) {
      var keys = Object.keys(agg.byEmployee).sort(function (a, b) {
        return (agg.byEmployee[b].hc + agg.byEmployee[b].tc) - (agg.byEmployee[a].hc + agg.byEmployee[a].tc);
      });
      var R2 = [
        [{ v: 'TỔNG GIỜ THEO NHÂN VIÊN — ' + U.monthVN(month), s: X.title }],
        [],
        [{ v: 'STT', s: X.head }, { v: 'Nhân viên', s: X.head }, { v: 'Vị trí', s: X.head },
         { v: 'Số đầu việc', s: X.head }, { v: 'Giờ HC', s: X.head }, { v: 'Giờ TC', s: X.head },
         { v: 'Tổng giờ', s: X.head }]
      ];
      keys.forEach(function (k, i4) {
        var v = agg.byEmployee[k], who = emp(k);
        R2.push([{ v: i4 + 1, s: X.cellCenter }, { v: who.name, s: X.cell }, { v: who.position || '', s: X.cell },
          { v: v.n, s: X.cellCenter }, { v: v.hc, s: X.num1 }, { v: v.tc, s: X.num1 },
          { v: U.round2(v.hc + v.tc), s: X.num1 }]);
      });
      R2.push([{ v: 'TỔNG CỘNG', s: X.total }, { v: '', s: X.total }, { v: '', s: X.total },
        { v: rows.length, s: X.totalNum }, { v: agg.hc, s: X.totalNum },
        { v: agg.tc, s: X.totalNum }, { v: agg.total, s: X.totalNum }]);
      sheets.push({
        name: 'Tổng giờ theo nhân viên', cols: [6, 30, 24, 14, 12, 12, 14], rows: R2,
        merges: [[0, 0, 0, 6], [R2.length - 1, 0, R2.length - 1, 2]]
      });
    }

    XLSX.download('BangChamCong_' +
      (allStaff ? 'ToanBoNhanVien' : U.noAccent(e.name).replace(/\s+/g, '')) + '_' + month + '.xlsx', sheets);
    U.toast('Đã tải file Excel', 'ok');
  }

  /* =========================================================
     MÀN HÌNH 4 — BÁO CÁO TỔNG HỢP
     ========================================================= */
  function viewSummary(main, q) {
    var month = readMonth(q, defaultMonth()) || defaultMonth();
    var empId = isAdmin() ? (q.emp || '') : S.user.id;

    var rows = reportsIn({ month: month, employeeId: empId, status: 'approved' });
    var agg = aggregate(rows);

    var single = empId ? emp(empId) : null;
    var pay = single ? Store.payroll(single, S.settings, agg.hc, agg.tc) : null;

    main.innerHTML =
      '<div class="page-head">' +
        '<div><h2>Báo cáo tổng hợp tháng</h2></div>' +
        '<div class="grow"></div>' +
        '<button class="btn" id="btn-csv">' + U.icon('download') + ' Xuất Excel</button>' +
        '<button class="btn" id="btn-print">' + U.icon('print') + ' Xuất PDF</button>' +
      '</div>' +

      '<div class="filterbar" id="fbar">' +
        monthSelect(month, false) +
        employeePicker(empId, true) +
      '</div>' +

      setupGuideHtml() +
      pendingNote(month, empId) +

      '<div class="print-head">' +
        '<p style="font-size:11px;text-transform:uppercase;letter-spacing:.06em">' + U.esc(S.settings.company) + '</p>' +
        '<h2 style="color:#B03318;font-size:18px">BÁO CÁO TỔNG HỢP CÔNG VIỆC VÀ PHÂN TÍCH TIẾN ĐỘ THÁNG</h2>' +
        '<p style="font-size:12px">' + (single ? U.esc(single.name) + ' · ' : '') + U.monthVN(month) + '</p>' +
      '</div>' +

      (!rows.length
        ? '<div class="card"><div class="empty">' + U.icon('chart') + '<h3>Chưa có dữ liệu để tổng hợp</h3>' +
          '<p>Không có báo cáo đã duyệt trong ' + U.monthVN(month).toLowerCase() + '.</p>' +
          (isAdmin()
            ? '<a class="btn btn-primary" href="#/list?status=pending">' + U.icon('inbox') + ' Xem báo cáo chờ duyệt</a>'
            : '<a class="btn btn-primary" href="#/send">' + U.icon('plus') + ' Gửi báo cáo</a>') + '</div></div>'

        /* 1 — Ba con số chính */
        : '<div class="kpi-row">' +
            '<div class="kpi hc"><div class="kpi-label">Tổng giờ hành chính</div>' +
              '<div class="kpi-value">' + U.hours(agg.hc) + '<span class="kpi-unit">giờ</span></div></div>' +
            '<div class="kpi tc"><div class="kpi-label">Tổng giờ tăng ca</div>' +
              '<div class="kpi-value">' + U.hours(agg.tc) + '<span class="kpi-unit">giờ</span></div></div>' +
            (pay
              ? '<div class="kpi accent"><div class="kpi-label">Tổng lương tháng</div>' +
                '<div class="kpi-value">' + U.vnd(pay.total) + '</div></div>'
              : '<div class="kpi"><div class="kpi-label">Tổng thời gian</div>' +
                '<div class="kpi-value">' + U.hours(agg.total) + '<span class="kpi-unit">giờ</span></div></div>') +
          '</div>' +

          /* 2 — Hai bảng thông tin chung */
          sectionTables(agg) +

          /* 3 — Biểu đồ */
          '<div class="card" style="margin-top:20px"><div class="card-body"><div class="chart-grid">' +
            '<figure class="chart-figure">' +
              '<figcaption style="margin:0 0 12px;font-size:13.5px;font-weight:600;color:var(--ink)">' +
                'Tổng thời gian theo công trình (giờ)</figcaption>' +
              '<div class="chart" id="chart-proj"></div></figure>' +
            '<figure class="chart-figure">' +
              '<figcaption style="margin:0 0 12px;font-size:13.5px;font-weight:600;color:var(--ink)">' +
                'Tỷ trọng thời gian theo hạng mục</figcaption>' +
              '<div class="chart" id="chart-cat"></div></figure>' +
          '</div></div></div>' +

          /* 4 — Phần chi tiết, gập lại cho đỡ rối */
          sectionDetails(agg) +
          (pay ? sectionSalary(single, pay, agg) : sectionPayrollAll(agg)) +
          '<details class="block" id="card-gallery"><summary>Hình ảnh công việc trong tháng ' +
            '<span class="sub">bấm để mở</span></summary>' +
            '<div class="block-body"><div class="shots" id="gallery"></div></div></details>');

    var fbar = U.$('#fbar', main);
    bindMonthSelect(fbar);
    var sel = U.$('#f-emp', fbar); if (sel) sel.addEventListener('change', function () { setQ({ emp: sel.value }); });
    U.$('#btn-print', main).addEventListener('click', function () { window.print(); });
    U.$('#btn-csv', main).addEventListener('click', function () { exportSummaryXLSX(single, month, agg, rows); });

    if (!rows.length) return;

    /* Biểu đồ — vẽ sau khi DOM có sẵn kích thước */
    Charts.bars(U.$('#chart-proj', main), {
      unit: 'giờ',
      aria: 'Biểu đồ cột tổng thời gian theo công trình',
      items: Object.keys(agg.byProject).map(function (k) {
        var v = agg.byProject[k];
        return { label: proj(k).name, value: U.round2(v.hc + v.tc), parts: [{ name: 'Giờ HC', value: v.hc }, { name: 'Giờ TC', value: v.tc }] };
      }).sort(function (a, b) { return b.value - a.value; })
    });

    Charts.donut(U.$('#chart-cat', main), {
      unit: 'giờ',
      aria: 'Biểu đồ tỷ trọng thời gian theo hạng mục',
      items: S.categories.filter(function (c) { return agg.byCategory[c.id]; }).map(function (c) {
        var v = agg.byCategory[c.id];
        return { label: c.name, value: U.round2(v.hc + v.tc), hex: c.hex };
      })
    });

    /* Thư viện ảnh */
    var withImg = rows.filter(function (r) { return r.imageCount; });
    Promise.all(withImg.map(function (r) { return Store.imagesOf(r.id); })).then(function (sets) {
      var flat = [];
      sets.forEach(function (set, i) {
        set.forEach(function (im) { flat.push({ im: im, r: withImg[i] }); });
      });
      var g = U.$('#gallery', main);
      if (!g) return;
      if (!flat.length) {
        var wrap = U.$('#card-gallery', main);
        if (wrap) wrap.querySelector('.block-body').innerHTML =
          '<p class="t-muted" style="font-size:14px">Chưa có ảnh nào được đính kèm trong tháng này.</p>';
        return;
      }
      g.innerHTML = flat.map(function (f, i) {
        return '<figure style="margin:0">' +
          '<button class="shot" type="button" data-g="' + i + '" aria-label="Xem ảnh lớn: ' + U.esc(f.r.description.slice(0, 50)) + '">' +
            '<img src="' + urlOf(f.im.blob) + '" alt="' + U.esc(f.r.description) + '" loading="lazy" ' +
            'width="' + f.im.w + '" height="' + f.im.h + '">' +
            '<span class="shot-zoom">' + U.icon('zoom') + '</span></button>' +
          '<figcaption class="help" style="margin-top:6px">' + U.dateVN(f.r.date) + ' · ' +
            U.esc(proj(f.r.projectId).name) + '</figcaption></figure>';
      }).join('');
      U.on(g, 'click', '[data-g]', function (e, b) {
        var i = Number(b.getAttribute('data-g'));
        openLightbox(flat.map(function (x) { return x.im; }), i, flat[i].r);
      });
    });
  }

  /** Hai bảng cạnh nhau như trong file Excel: theo công trình và theo hạng mục */
  function sectionTables(agg) {
    var keys = Object.keys(agg.byProject).sort(function (a, b) {
      return (agg.byProject[b].hc + agg.byProject[b].tc) - (agg.byProject[a].hc + agg.byProject[a].tc);
    });
    var projRows = keys.map(function (k, i) {
      var v = agg.byProject[k], tot = U.round2(v.hc + v.tc);
      return '<tr><td class="c num">' + (i + 1) + '</td>' +
        '<td class="t-strong t-wrap">' + U.esc(proj(k).name) + '</td>' +
        '<td class="n">' + U.hours(v.hc) + '</td>' +
        '<td class="n">' + U.hours(v.tc) + '</td>' +
        '<td class="n t-strong">' + U.hours(tot) + '</td>' +
        '<td class="n">' + U.pct(tot, agg.total) + '</td></tr>';
    }).join('');

    var catRows = S.categories.filter(function (c) { return agg.byCategory[c.id]; }).map(function (c) {
      var v = agg.byCategory[c.id], tot = U.round2(v.hc + v.tc);
      return '<tr><td class="t-strong"><span class="chip"><i class="chip-dot" style="background:' + c.hex + '"></i>' +
        U.esc(c.name) + '</span></td>' +
        '<td class="n">' + U.hours(v.hc) + '</td><td class="n">' + U.hours(v.tc) + '</td>' +
        '<td class="n t-strong">' + U.hours(tot) + '</td><td class="n">' + U.pct(tot, agg.total) + '</td></tr>';
    }).join('');

    return '<div class="card"><div class="card-body"><div class="chart-grid">' +
      '<div>' +
        '<h3 style="font-size:14px;font-weight:700;margin-bottom:10px">Theo công trình</h3>' +
        '<div class="table-scroll"><table class="tbl">' +
          '<thead><tr><th class="c">STT</th><th>Công trình</th>' +
          '<th class="n">HC</th><th class="n">TC</th><th class="n">Tổng</th><th class="n">Tỷ trọng</th></tr></thead>' +
          '<tbody>' + projRows + '</tbody>' +
          '<tfoot><tr><td colspan="2">TỔNG CỘNG</td><td class="n">' + U.hours(agg.hc) + '</td>' +
            '<td class="n">' + U.hours(agg.tc) + '</td><td class="n">' + U.hours(agg.total) + '</td>' +
            '<td class="n">100,0%</td></tr></tfoot>' +
        '</table></div></div>' +
      '<div>' +
        '<h3 style="font-size:14px;font-weight:700;margin-bottom:10px">Theo hạng mục</h3>' +
        '<div class="table-scroll"><table class="tbl">' +
          '<thead><tr><th>Hạng mục</th><th class="n">HC</th><th class="n">TC</th>' +
          '<th class="n">Tổng</th><th class="n">Tỷ trọng</th></tr></thead>' +
          '<tbody>' + catRows + '</tbody>' +
          '<tfoot><tr><td>TỔNG CỘNG</td><td class="n">' + U.hours(agg.hc) + '</td>' +
            '<td class="n">' + U.hours(agg.tc) + '</td><td class="n">' + U.hours(agg.total) + '</td>' +
            '<td class="n">100,0%</td></tr></tfoot>' +
        '</table></div></div>' +
      '</div></div></div>';
  }

  function sectionDetails(agg) {
    var groups = Object.keys(agg.byReason).map(function (k) { return agg.byReason[k]; })
      .sort(function (a, b) {
        if (a.categoryId !== b.categoryId) {
          return (cat(a.categoryId).order || 9) - (cat(b.categoryId).order || 9);
        }
        return (b.hc + b.tc) - (a.hc + a.tc);
      });

    var i = 0;
    var body = groups.map(function (g) {
      i++;
      var c = cat(g.categoryId), tot = U.round2(g.hc + g.tc);
      return '<tr><td class="c num">' + i + '</td>' +
        '<td><span class="chip"><i class="chip-dot" style="background:' + c.hex + '"></i>' + U.esc(c.name) + '</span></td>' +
        '<td class="t-wrap"><ul style="margin:0;padding-left:18px">' +
          g.items.map(function (t) { return '<li>' + U.esc(t) + '</li>'; }).join('') + '</ul></td>' +
        '<td class="n t-strong">' + U.hours(tot) + '</td>' +
        '<td class="t-wrap">' + U.esc(g.reason) + '</td></tr>';
    }).join('');

    return '<details class="block"><summary>Phân tích diễn giải chi tiết &amp; lý do thực hiện ' +
      '<span class="sub">' + groups.length + ' nhóm công việc</span></summary>' +
      '<div class="block-body flush"><div class="table-scroll"><table class="tbl">' +
        '<thead><tr><th class="c">STT</th><th>Hạng mục</th><th>Chi tiết công việc thực hiện</th>' +
        '<th class="n">Thời gian (giờ)</th><th>Lý do / Nguyên nhân / Mục tiêu</th></tr></thead>' +
        '<tbody>' + body + '</tbody>' +
        '<tfoot><tr><td colspan="3">TỔNG CỘNG GIỜ THỰC HIỆN</td>' +
          '<td class="n">' + U.hours(agg.total) + '</td><td></td></tr></tfoot>' +
      '</table></div></div></details>';
  }

  function sectionSalary(e, pay, agg) {
    var isMonthly = pay.mode === 'monthly';
    return '<details class="block"><summary>Bảng tính lương tự động ' +
      '<span class="sub">' + U.esc(e.name) + ' · ' + U.vnd(pay.total) + '</span></summary>' +
      '<div class="block-body">' +
        '<div class="salary-break">' +
          '<div><span>Đơn giá 1 giờ (' + U.vnd(e.salaryMonth) + ' ÷ ' + (e.workDays || S.settings.standardDays) +
            ' ngày ÷ ' + S.settings.hoursPerDay + ' giờ)</span><span>' + U.vnd(pay.rate) + '</span></div>' +
          (isMonthly
            ? '<div><span>Lương cứng theo tháng</span><span>' + U.vnd(pay.base) + '</span></div>'
            : '<div><span>Lương giờ hành chính (' + U.hours(agg.hc) + ' giờ × ' + U.vnd(pay.rate) + ')</span><span>' +
              U.vnd(pay.base) + '</span></div>') +
          '<div><span>Lương tăng ca (' + U.hours(agg.tc) + ' giờ × ' + U.vnd(pay.rate) + ' × ' +
            U.num(pay.otRate, 1) + ')</span><span>' + U.vnd(pay.ot) + '</span></div>' +
          '<div><span>TỔNG LƯƠNG THÁNG</span><span>' + U.vnd(pay.total) + '</span></div>' +
        '</div>' +
        '<div class="callout" style="margin-top:16px">' + U.icon('info') +
          '<span>Công thức đang áp dụng: <b>' +
          (isMonthly ? 'Lương cứng tháng + Giờ TC × Đơn giá giờ × Hệ số ' + U.num(pay.otRate, 1)
                     : '(Giờ HC + Giờ TC × Hệ số ' + U.num(pay.otRate, 1) + ') × Đơn giá giờ') +
          '</b>. Quản lý đổi công thức và hệ số trong mục Cài đặt.</span></div>' +
      '</div></details>';
  }

  function sectionPayrollAll(agg) {
    var keys = Object.keys(agg.byEmployee);
    var body = keys.map(function (k, i) {
      var e = emp(k), v = agg.byEmployee[k];
      var p = Store.payroll(e, S.settings, v.hc, v.tc);
      return '<tr><td class="c num">' + (i + 1) + '</td>' +
        '<td class="t-strong">' + U.esc(e.name) + '</td>' +
        '<td class="t-muted">' + U.esc(e.position || '') + '</td>' +
        '<td class="n">' + U.hours(v.hc) + '</td><td class="n">' + U.hours(v.tc) + '</td>' +
        '<td class="n">' + U.vnd(p.rate) + '</td>' +
        '<td class="n t-strong">' + U.vnd(p.total) + '</td></tr>';
    }).join('');
    var grand = keys.reduce(function (s, k) {
      var v = agg.byEmployee[k];
      return s + Store.payroll(emp(k), S.settings, v.hc, v.tc).total;
    }, 0);

    return '<details class="block"><summary>Bảng lương toàn bộ nhân viên ' +
      '<span class="sub">' + keys.length + ' người · ' + U.vnd(grand) + '</span></summary>' +
      '<div class="block-body flush"><div class="table-scroll"><table class="tbl">' +
        '<thead><tr><th class="c">STT</th><th>Nhân viên</th><th>Vị trí</th>' +
        '<th class="n">Giờ HC</th><th class="n">Giờ TC</th><th class="n">Đơn giá giờ</th><th class="n">Tổng lương</th></tr></thead>' +
        '<tbody>' + body + '</tbody>' +
        '<tfoot><tr><td colspan="3">TỔNG CỘNG</td><td class="n">' + U.hours(agg.hc) + '</td>' +
          '<td class="n">' + U.hours(agg.tc) + '</td><td></td><td class="n">' + U.vnd(grand) + '</td></tr></tfoot>' +
      '</table></div></div></details>';
  }

  /**
   * Xuất báo cáo tổng hợp ra .xlsx, dựng đúng bố cục file Excel đang dùng:
   * ba ô số lớn trên cùng, mục I thống kê theo công trình cạnh bảng tổng hợp
   * theo hạng mục, rồi mục II phân tích diễn giải chi tiết.
   */
  function exportSummaryXLSX(single, month, agg, rows) {
    var X = XLSX.S;
    var pay = single ? Store.payroll(single, S.settings, agg.hc, agg.tc) : null;
    var R = [], M = [];

    R[0] = [{ v: S.settings.company, s: X.company }];
    R[1] = [{ v: 'BÁO CÁO TỔNG HỢP CÔNG VIỆC VÀ PHÂN TÍCH TIẾN ĐỘ THÁNG', s: X.title }];
    R[1].h = 24;
    R[2] = [{ v: (single ? single.name + ' · ' : 'Toàn bộ nhân viên · ') + U.monthVN(month), s: X.muted }];
    M.push([0, 0, 0, 11], [1, 0, 1, 11], [2, 0, 2, 11]);

    /* ba ô số lớn */
    R[4] = [{ v: 'TỔNG GIỜ LÀM HÀNH CHÍNH', s: X.banner }, { v: '', s: X.banner }, { v: '', s: X.banner },
            { v: '', s: X.banner }, { v: 'TỔNG GIỜ TĂNG CA (TC)', s: X.banner }, { v: '', s: X.banner },
            { v: '', s: X.banner }, { v: '', s: X.banner },
            { v: pay ? 'TỔNG LƯƠNG TỰ ĐỘNG THÁNG' : 'TỔNG THỜI GIAN LÀM VIỆC', s: X.banner },
            { v: '', s: X.banner }, { v: '', s: X.banner }, { v: '', s: X.banner }];
    R[5] = [{ v: agg.hc, s: X.bannerVal }, { v: '', s: X.bannerVal }, { v: '', s: X.bannerVal },
            { v: '', s: X.bannerVal }, { v: agg.tc, s: X.bannerVal }, { v: '', s: X.bannerVal },
            { v: '', s: X.bannerVal }, { v: '', s: X.bannerVal },
            { v: pay ? Math.round(pay.total) : agg.total, s: pay ? X.bannerMoney : X.bannerVal },
            { v: '', s: X.bannerVal }, { v: '', s: X.bannerVal }, { v: '', s: X.bannerVal }];
    R[5].h = 26;
    M.push([4, 0, 4, 3], [4, 4, 4, 7], [4, 8, 4, 11],
           [5, 0, 5, 3], [5, 4, 5, 7], [5, 8, 5, 11]);

    /* mục I bên trái, tổng hợp theo hạng mục bên phải */
    R[7] = [{ v: 'I. THỐNG KÊ THỜI GIAN THEO CÔNG TRÌNH', s: X.section }];
    R[7][7] = { v: 'TỔNG HỢP THEO HẠNG MỤC (TỰ ĐỘNG TỪ BÁO CÁO NGÀY)', s: X.section };
    M.push([7, 0, 7, 5], [7, 7, 7, 11]);

    R[8] = [{ v: 'STT', s: X.head }, { v: 'Tên Công Trình / Khách Hàng', s: X.head },
            { v: 'Giờ HC', s: X.head }, { v: 'Giờ TC', s: X.head },
            { v: 'Tổng Thời Gian (Giờ)', s: X.head }, { v: 'Tỷ Trọng (%)', s: X.head }, null,
            { v: 'Hạng Mục', s: X.head }, { v: 'Tổng Giờ HC', s: X.head },
            { v: 'Tổng Giờ TC', s: X.head }, { v: 'Tổng Cộng', s: X.head }, { v: 'Tỷ Trọng (%)', s: X.head }];

    var pKeys = Object.keys(agg.byProject).sort(function (a, b) {
      return (agg.byProject[b].hc + agg.byProject[b].tc) - (agg.byProject[a].hc + agg.byProject[a].tc);
    });
    var cList = S.categories.filter(function (c) { return agg.byCategory[c.id]; });
    var nBody = Math.max(pKeys.length, cList.length);

    for (var i2 = 0; i2 < nBody; i2++) {
      var line = [];
      if (i2 < pKeys.length) {
        var v = agg.byProject[pKeys[i2]], t = U.round2(v.hc + v.tc);
        line = [{ v: i2 + 1, s: X.cellCenter }, { v: proj(pKeys[i2]).name, s: X.cell },
                { v: v.hc, s: X.num1 }, { v: v.tc, s: X.num1 }, { v: t, s: X.num1 },
                { v: agg.total ? t / agg.total : 0, s: X.pct }];
      } else {
        line = [null, null, null, null, null, null];
      }
      line[6] = null;
      if (i2 < cList.length) {
        var c = cList[i2], cv = agg.byCategory[c.id], ct = U.round2(cv.hc + cv.tc);
        line[7] = { v: c.name, s: X.cell };
        line[8] = { v: cv.hc, s: X.num1 };
        line[9] = { v: cv.tc, s: X.num1 };
        line[10] = { v: ct, s: X.num1 };
        line[11] = { v: agg.total ? ct / agg.total : 0, s: X.pct };
      }
      R[9 + i2] = line;
    }

    var tRow = 9 + nBody;
    R[tRow] = [{ v: 'TỔNG CỘNG', s: X.total }, { v: '', s: X.total },
               { v: agg.hc, s: X.totalNum }, { v: agg.tc, s: X.totalNum },
               { v: agg.total, s: X.totalNum }, { v: 1, s: X.pct }, null,
               { v: 'TỔNG CỘNG', s: X.total }, { v: agg.hc, s: X.totalNum },
               { v: agg.tc, s: X.totalNum }, { v: agg.total, s: X.totalNum }, { v: 1, s: X.pct }];
    M.push([tRow, 0, tRow, 1]);

    /* mục II — phân tích diễn giải chi tiết */
    var s2 = tRow + 3;
    R[s2] = [{ v: 'II. PHÂN TÍCH DIỄN GIẢI CHI TIẾT VÀ LÝ DO THỰC HIỆN CÔNG VIỆC', s: X.section }];
    M.push([s2, 0, s2, 11]);

    R[s2 + 1] = [{ v: 'STT', s: X.head }, { v: 'Hạng Mục', s: X.head },
                 { v: 'Chi Tiết Công Việc Thực Hiện', s: X.head }, { v: '', s: X.head },
                 { v: 'Thời Gian (Giờ)', s: X.head },
                 { v: 'Lý Do / Nguyên Nhân / Mục Tiêu Chi Tiết', s: X.head },
                 { v: '', s: X.head }, { v: '', s: X.head }];
    M.push([s2 + 1, 2, s2 + 1, 3], [s2 + 1, 5, s2 + 1, 7]);

    var groups = Object.keys(agg.byReason).map(function (k) { return agg.byReason[k]; })
      .sort(function (a, b) {
        if (a.categoryId !== b.categoryId) return (cat(a.categoryId).order || 9) - (cat(b.categoryId).order || 9);
        return (b.hc + b.tc) - (a.hc + a.tc);
      });

    groups.forEach(function (g, i3) {
      var r0 = s2 + 2 + i3;
      R[r0] = [{ v: i3 + 1, s: X.cellCenter }, { v: cat(g.categoryId).name, s: X.cellCenter },
               { v: g.items.join(' · '), s: X.cellWrap }, { v: '', s: X.cellWrap },
               { v: U.round2(g.hc + g.tc), s: X.num1 },
               { v: g.reason, s: X.cellWrap }, { v: '', s: X.cellWrap }, { v: '', s: X.cellWrap }];
      M.push([r0, 2, r0, 3], [r0, 5, r0, 7]);
    });

    var t2 = s2 + 2 + groups.length;
    R[t2] = [{ v: 'TỔNG CỘNG GIỜ THỰC HIỆN', s: X.total }, { v: '', s: X.total },
             { v: '', s: X.total }, { v: '', s: X.total },
             { v: agg.total, s: X.totalNum }, { v: '', s: X.total },
             { v: '', s: X.total }, { v: '', s: X.total }];
    M.push([t2, 0, t2, 3], [t2, 5, t2, 7]);

    var sheets = [{
      name: 'Tổng hợp & Phân tích',
      cols: [6, 34, 22, 22, 26, 14, 3, 18, 13, 13, 13, 13],
      rows: R, merges: M
    }];

    /* sheet phụ: bảng lương từng người khi xem toàn bộ nhân viên */
    if (!single) {
      var eKeys = Object.keys(agg.byEmployee);
      var R2 = [
        [{ v: 'BẢNG LƯƠNG NHÂN VIÊN — ' + U.monthVN(month), s: X.title }],
        [],
        [{ v: 'STT', s: X.head }, { v: 'Nhân viên', s: X.head }, { v: 'Vị trí', s: X.head },
         { v: 'Giờ HC', s: X.head }, { v: 'Giờ TC', s: X.head },
         { v: 'Đơn giá giờ', s: X.head }, { v: 'Tổng lương', s: X.head }]
      ];
      var grand = 0;
      eKeys.forEach(function (k, i4) {
        var who = emp(k), v = agg.byEmployee[k];
        var pp = Store.payroll(who, S.settings, v.hc, v.tc);
        grand += pp.total;
        R2.push([{ v: i4 + 1, s: X.cellCenter }, { v: who.name, s: X.cell },
          { v: who.position || '', s: X.cell }, { v: v.hc, s: X.num1 }, { v: v.tc, s: X.num1 },
          { v: Math.round(pp.rate), s: X.money }, { v: Math.round(pp.total), s: X.money }]);
      });
      R2.push([{ v: 'TỔNG CỘNG', s: X.total }, { v: '', s: X.total }, { v: '', s: X.total },
        { v: agg.hc, s: X.totalNum }, { v: agg.tc, s: X.totalNum },
        { v: '', s: X.total }, { v: Math.round(grand), s: X.totalMoney }]);
      sheets.push({
        name: 'Bảng lương', cols: [6, 30, 24, 12, 12, 16, 18], rows: R2,
        merges: [[0, 0, 0, 6], [R2.length - 1, 0, R2.length - 1, 2]]
      });
    }

    XLSX.download('BaoCaoTongHop_' +
      (single ? U.noAccent(single.name).replace(/\s+/g, '') + '_' : '') + month + '.xlsx', sheets);
    U.toast('Đã tải file Excel', 'ok');
  }

  /* =========================================================
     MÀN HÌNH 5 — CÀI ĐẶT (quản lý)
     ========================================================= */
  function viewSettings(main, q) {
    var tab = q.tab || 'emp';
    var tabs = [
      { id: 'emp',  label: 'Nhân viên',    icon: 'users' },
      { id: 'cat',  label: 'Hạng mục',     icon: 'filter' },
      { id: 'gen',  label: 'Thông số chung', icon: 'settings' },
      { id: 'data', label: 'Dữ liệu',      icon: 'download' }
    ];

    main.innerHTML =
      '<div class="page-head"><div><h2>Cài đặt hệ thống</h2>' +
        '<p>Quản lý nhân viên, danh mục công trình và cách tính lương.</p></div></div>' +
      '<div class="filterbar" style="gap:8px">' +
        tabs.map(function (t) {
          return '<a class="btn btn-sm' + (tab === t.id ? ' btn-primary' : '') + '" href="#/settings?tab=' + t.id + '">' +
            U.icon(t.icon) + ' ' + t.label + '</a>';
        }).join('') +
      '</div>' +
      '<div id="tabbody"></div>';

    var body = U.$('#tabbody', main);
    if (tab === 'emp') return tabEmployees(body);
    if (tab === 'cat') return tabCategories(body);
    if (tab === 'gen') return tabGeneral(body);
    return tabData(body);
  }

  function tabEmployees(body) {
    body.innerHTML = '<div class="card">' +
      '<div class="card-head"><h3>Danh sách nhân viên</h3><div class="grow"></div>' +
        '<button class="btn btn-primary btn-sm" data-new-emp>' + U.icon('plus') + ' Thêm nhân viên</button></div>' +
      '<div class="card-body flush"><div class="table-scroll"><table class="tbl">' +
        '<thead><tr><th>Họ và tên</th><th>Vị trí</th><th>Tên đăng nhập</th><th class="n">Lương / tháng</th>' +
        '<th class="n">Ngày công</th><th class="n">Lương 1 giờ</th><th>Trạng thái</th><th></th></tr></thead>' +
        '<tbody>' + S.employees.filter(function (e) { return e.role !== 'admin'; }).map(function (e) {
          return '<tr><td class="t-strong">' + U.esc(e.name) + '</td>' +
            '<td class="t-muted">' + U.esc(e.position || '') + '</td>' +
            '<td class="num t-strong">' + U.esc(e.username || '—') + '</td>' +
            '<td class="n">' + U.vnd(e.salaryMonth) + '</td>' +
            '<td class="n">' + (e.workDays || S.settings.standardDays) + '</td>' +
            '<td class="n">' + U.vnd(Store.hourlyRate(e, S.settings)) + '</td>' +
            '<td>' + (e.active === false
              ? '<span class="badge badge-rejected">' + U.icon('xCircle') + 'Ngưng</span>'
              : '<span class="badge badge-approved">' + U.icon('checkCircle') + 'Đang làm</span>') + '</td>' +
            '<td class="n"><button class="btn btn-sm" data-edit-emp="' + e.id + '">' + U.icon('edit') + ' Sửa</button></td></tr>';
        }).join('') + '</tbody>' +
      '</table></div></div></div>' +
      '<div class="callout" style="margin-top:16px">' + U.icon('info') +
        '<span>Mỗi nhân viên đăng nhập bằng <b>tên đăng nhập</b> và <b>mật khẩu</b> riêng. ' +
        'Sau khi cấp tài khoản, nhân viên tự đổi mật khẩu bằng cách bấm vào tên mình ở góc trên bên phải.</span></div>';

    U.on(body, 'click', '[data-new-emp]', function () { editEmployee(null); });
    U.on(body, 'click', '[data-edit-emp]', function (e, b) { editEmployee(emp(b.getAttribute('data-edit-emp'))); });
  }

  function editEmployee(e) {
    var isNew = !e;
    e = e || { id: '', name: '', position: '', salaryMonth: 10000000,
      workDays: S.settings.standardDays, username: '', password: '123456', active: true, role: 'staff' };
    var el = U.openOverlay('<div class="dialog">' +
      '<div class="dialog-head"><h3>' + (isNew ? 'Thêm nhân viên' : 'Sửa thông tin nhân viên') + '</h3>' +
        '<button class="icon-btn" type="button" data-close aria-label="Đóng">' + U.icon('x') + '</button></div>' +
      '<div class="dialog-body">' +
        '<div class="field"><label for="e-name">Họ và tên <span class="req">*</span></label>' +
          '<input class="input" id="e-name" value="' + U.esc(e.name) + '" required></div>' +
        '<div class="field"><label for="e-pos">Vị trí công việc</label>' +
          '<input class="input" id="e-pos" value="' + U.esc(e.position || '') + '" placeholder="Kiến trúc sư, Hoạ viên…"></div>' +

        '<h4 style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;' +
          'color:var(--ink-3);margin:20px 0 12px">Tài khoản đăng nhập</h4>' +
        '<div class="field-row">' +
          '<div class="field"><label for="e-user">Tên đăng nhập <span class="req">*</span></label>' +
            '<input class="input" id="e-user" autocapitalize="off" spellcheck="false" ' +
              'value="' + U.esc(e.username || '') + '" placeholder="vd: nhu">' +
            '<span class="help">Chữ thường, không dấu, không khoảng trắng.</span></div>' +
          '<div class="field"><label for="e-pass">Mật khẩu <span class="req">*</span></label>' +
            '<input class="input" id="e-pass" value="' + U.esc(e.password || '') + '">' +
            '<span class="help">' + (isNew ? 'Báo riêng cho nhân viên, họ tự đổi sau.' : 'Sửa ô này để cấp lại mật khẩu.') + '</span></div>' +
        '</div>' +

        '<h4 style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;' +
          'color:var(--ink-3);margin:20px 0 12px">Lương &amp; trạng thái</h4>' +
        '<div class="field-row">' +
          '<div class="field"><label for="e-sal">Mức lương / tháng (VNĐ) <span class="req">*</span></label>' +
            '<input class="input num" type="number" id="e-sal" min="0" step="100000" value="' + (e.salaryMonth || 0) + '"></div>' +
          '<div class="field"><label for="e-days">Tổng số ngày công chuẩn</label>' +
            '<input class="input num" type="number" id="e-days" min="1" max="31" value="' + (e.workDays || 22) + '"></div>' +
          '<div class="field"><label for="e-act">Trạng thái</label>' +
            '<select class="select" id="e-act">' +
              '<option value="1"' + (e.active !== false ? ' selected' : '') + '>Đang làm việc</option>' +
              '<option value="0"' + (e.active === false ? ' selected' : '') + '>Đã ngưng</option>' +
            '</select></div>' +
        '</div>' +
        '<p class="help" id="e-rate"></p>' +
        '<span class="err" id="e-err" hidden></span>' +
      '</div>' +
      '<div class="dialog-foot"><button class="btn" type="button" data-close>Huỷ</button>' +
        '<button class="btn btn-primary" type="button" data-save>' + U.icon('check') + ' Lưu</button></div>' +
    '</div>');

    function paintRate() {
      var sal = Number(U.$('#e-sal', el).value) || 0;
      var d = Number(U.$('#e-days', el).value) || 22;
      U.$('#e-rate', el).textContent = 'Lương 1 giờ sẽ là ' +
        U.vnd(sal / (d * (Number(S.settings.hoursPerDay) || 8))) +
        ' (lương tháng ÷ ' + d + ' ngày ÷ ' + S.settings.hoursPerDay + ' giờ).';
    }
    paintRate();
    ['#e-sal', '#e-days'].forEach(function (s) { U.$(s, el).addEventListener('input', paintRate); });

    el.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-close]')) return U.closeOverlay();
      if (!ev.target.closest('[data-save]')) return;
      var errEl = U.$('#e-err', el);
      function fail(msg) {
        errEl.innerHTML = U.icon('alert') + '<span>' + U.esc(msg) + '</span>';
        errEl.hidden = false;
      }
      var name = U.$('#e-name', el).value.trim();
      var user = U.$('#e-user', el).value.trim().toLowerCase();
      var pass = U.$('#e-pass', el).value;

      if (!name) return fail('Vui lòng nhập họ và tên.');
      if (!/^[a-z0-9._-]{3,20}$/.test(user)) {
        return fail('Tên đăng nhập phải từ 3–20 ký tự, chỉ dùng chữ thường không dấu, số, dấu chấm hoặc gạch.');
      }
      var taken = S.employees.filter(function (x) {
        return x.id !== e.id && String(x.username || '').toLowerCase() === user;
      })[0];
      if (taken) return fail('Tên đăng nhập “' + user + '” đã được dùng cho ' + taken.name + '.');
      if (!pass || pass.length < 6) return fail('Mật khẩu phải có ít nhất 6 ký tự.');
      errEl.hidden = true;

      var rec = {
        id: e.id || U.uid('nv'), role: e.role || 'staff', name: name,
        position: U.$('#e-pos', el).value.trim(),
        salaryMonth: Number(U.$('#e-sal', el).value) || 0,
        workDays: Number(U.$('#e-days', el).value) || 22,
        username: user, password: pass,
        active: U.$('#e-act', el).value === '1'
      };
      Store.put('employees', rec).then(function () {
        U.closeOverlay(); U.toast('Đã lưu thông tin nhân viên', 'ok'); return reload();
      }).then(render);
    });
  }

  /* =========================================================
     MÀN HÌNH — HÀNH TRÌNH KHÁCH HÀNG
     7 bước cố định cho cả kiến trúc và nội thất.
     ========================================================= */
  /** Mỗi bước một màu riêng cho dễ nhận ra — đã chạy validator, đạt mọi ngưỡng mù màu
      (CVD ΔE 9,1 · thị lực thường ΔE 19,6). Màu luôn đi kèm số bước và tên bước. */
  var STAGE_BAR = ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#4A3AA7', '#008300'];
  function stageColor(stageId) { return STAGE_BAR[Store.stageIndex(stageId)]; }

  function stepperHtml(stageId) {
    var cur = Store.stageIndex(stageId);
    return '<span class="stepper" style="--bar:' + stageColor(stageId) + '" aria-hidden="true">' +
      Store.STAGES.map(function (s, i) {
        return '<i class="' + (i < cur ? 'on' : i === cur ? 'cur' : '') + '"></i>';
      }).join('') + '</span>';
  }

  /* ---------------- Nhắc hẹn chăm sóc khách ---------------- */
  var FOLLOW_KINDS = {
    call:  { label: 'Gọi điện',   icon: 'phone' },
    meet:  { label: 'Hẹn gặp',    icon: 'handshake' },
    send:  { label: 'Gửi hồ sơ',  icon: 'send' },
    other: { label: 'Việc khác',  icon: 'bell' }
  };

  /** Phân mức gấp của một lịch nhắc: quá hạn · hôm nay · trong 7 ngày · còn xa */
  function dueInfo(fu) {
    if (!fu || !fu.date) return null;
    var d = U.diffDays(U.todayISO(), fu.date);
    if (d < 0)  return { key: 'over',  cls: 'due-over',  icon: 'alert',
      text: 'Quá hạn ' + Math.abs(d) + ' ngày', days: d };
    if (d === 0) return { key: 'today', cls: 'due-today', icon: 'bell', text: 'Hôm nay', days: 0 };
    if (d === 1) return { key: 'soon',  cls: 'due-soon',  icon: 'clock', text: 'Ngày mai', days: 1 };
    if (d <= 7)  return { key: 'soon',  cls: 'due-soon',  icon: 'clock', text: 'Còn ' + d + ' ngày', days: d };
    if (d <= 45) return { key: 'later', cls: 'due-later', icon: 'calendar', text: 'Còn ' + d + ' ngày', days: d };
    return { key: 'later', cls: 'due-later', icon: 'calendar',
      text: 'Còn ' + Math.round(d / 30) + ' tháng', days: d };
  }

  function duePill(p) {
    if (p.noFollow) {
      return '<span class="due due-off">' + U.icon('bellOff') + 'Không nhắc nữa</span>';
    }
    var info = dueInfo(p.followUp);
    if (!info) return '<span class="due-none">Chưa đặt nhắc</span>';
    return '<span class="due ' + info.cls + '">' + U.icon(info.icon) + info.text + '</span>' +
      '<span class="t-muted num" style="font-size:12px;margin-left:6px">' + U.dateVN(p.followUp.date) + '</span>';
  }

  /** Số việc cần liên hệ ngay = quá hạn + đến hạn hôm nay */
  function dueNowCount() {
    return S.projects.filter(function (p) {
      if (p.active === false || p.noFollow) return false;
      var i = dueInfo(p.followUp);
      return i && (i.key === 'over' || i.key === 'today');
    }).length;
  }

  function viewProjects(main, q) {
    var fStage = q.stage || '';
    var fDue = q.due || '';
    var search = q.q || '';
    var showClosed = q.closed === '1';

    var hoursBy = {};
    S.reports.forEach(function (r) {
      if (r.status !== 'approved') return;
      hoursBy[r.projectId] = (hoursBy[r.projectId] || 0) + (Number(r.hc) || 0) + (Number(r.tc) || 0);
    });

    var counted = S.projects.filter(function (p) { return showClosed || p.active !== false; });
    var byStage = {};
    counted.forEach(function (p) { byStage[p.stageId] = (byStage[p.stageId] || 0) + 1; });

    var list = counted.filter(function (p) {
      if (fStage && p.stageId !== fStage) return false;
      if (fDue) {
        var i = p.noFollow ? null : dueInfo(p.followUp);
        if (fDue === 'none' && (i || p.noFollow)) return false;
        if (fDue === 'now' && !(i && (i.key === 'over' || i.key === 'today'))) return false;
        if (fDue === 'week' && !(i && i.days >= 0 && i.days <= 7)) return false;
        if (fDue === 'set' && !i) return false;
        if (fDue === 'off' && !p.noFollow) return false;
      }
      if (search && U.noAccent(p.name + ' ' + (p.client || '') + ' ' + (p.address || '') + ' ' +
        p.code + ' ' + ((p.followUp && p.followUp.note) || '')).indexOf(U.noAccent(search)) < 0) return false;
      return true;
    }).sort(function (a, b) {
      var da = a.followUp && a.followUp.date, db = b.followUp && b.followUp.date;
      if (da && db) return da < db ? -1 : da > db ? 1 : 0;
      if (da) return -1;
      if (db) return 1;
      return a.code < b.code ? -1 : 1;
    });

    /* Việc phải liên hệ ngay — hiển thị trên cùng vì đây là phần cần hành động */
    var todo = counted.filter(function (p) {
      if (p.noFollow) return false;
      var i = dueInfo(p.followUp);
      return i && (i.key === 'over' || i.key === 'today');
    }).sort(function (a, b) { return a.followUp.date < b.followUp.date ? -1 : 1; });

    main.innerHTML =
      '<div class="page-head">' +
        '<div><h2>Hành trình khách hàng</h2>' +
        '<p>' + counted.length + ' hồ sơ đang theo dõi</p></div>' +
        '<div class="grow"></div>' +
        (isAdmin() ? '<button class="btn btn-primary" id="btn-new-proj">' + U.icon('plus') + ' Thêm khách hàng</button>' : '') +
      '</div>' +

      /* ---- 1. Cần liên hệ ---- */
      (todo.length
        ? '<div class="card todo-card" id="todo"><div class="card-head">' +
            '<h3>' + U.icon('bell') + ' Cần liên hệ (' + todo.length + ')</h3>' +
            '<span class="sub">Khách đã hẹn sẽ báo lại hoặc tới hạn gọi lại hôm nay</span></div>' +
            '<div class="card-body flush">' +
              todo.slice(0, 6).map(function (p) {
                var info = dueInfo(p.followUp);
                var k = FOLLOW_KINDS[p.followUp.kind] || FOLLOW_KINDS.other;
                return '<div class="todo-row" data-id="' + p.id + '">' +
                  '<span class="due ' + info.cls + '">' + U.icon(info.icon) + info.text + '</span>' +
                  '<div class="todo-main">' +
                    '<div class="todo-name">' +
                      '<button class="row-open" type="button" data-open="' + p.id + '">' + U.esc(p.name) + '</button>' +
                      (p.phone ? ' <span class="t-muted" style="font-weight:400;font-size:12.5px">· ' + U.esc(p.phone) + '</span>' : '') +
                    '</div>' +
                    '<div class="due-note" style="max-width:none">' + U.icon(k.icon) + ' ' +
                      U.esc(p.followUp.note || k.label) + '</div>' +
                  '</div>' +
                  (isAdmin()
                    ? '<div class="todo-actions">' +
                        '<button class="btn btn-sm btn-good" data-done="' + p.id + '">' + U.icon('check') + ' Đã liên hệ</button>' +
                        '<button class="btn btn-sm" data-snooze="' + p.id + '">' + U.icon('clock') + ' Dời 3 ngày</button>' +
                        '<button class="btn btn-sm" data-remind="' + p.id + '">' + U.icon('edit') + ' Đổi lịch</button>' +
                      '</div>'
                    : '') +
                '</div>';
              }).join('') +
              (todo.length > 6
                ? '<p class="help" style="padding:10px 20px">Còn ' + (todo.length - 6) +
                  ' khách nữa — xem đầy đủ ở bộ lọc <b>Cần liên hệ ngay</b> bên dưới.</p>'
                : '') +
            '</div></div>'
        : '<p class="help">' + U.icon('checkCircle') +
          ' Hôm nay không có khách nào tới hạn liên hệ.</p>') +

      /* ---- 2. Bảy bước của hành trình ---- */
      '<div class="pipeline" id="pipe">' +
        '<button class="pipe-card" type="button" data-stage="" aria-pressed="' + (!fStage) + '" style="--bar:var(--steel-500)">' +
          '<span class="pipe-step">TẤT CẢ</span>' +
          '<span class="pipe-name">Toàn bộ hồ sơ</span>' +
          '<span class="pipe-n">' + counted.length + '<span>hồ sơ</span></span>' +
        '</button>' +
        Store.STAGES.map(function (s, i) {
          return '<button class="pipe-card" type="button" data-stage="' + s.id + '" ' +
            'aria-pressed="' + (fStage === s.id) + '" title="' + U.esc(s.note) + '" ' +
            'style="--bar:' + STAGE_BAR[i] + '">' +
            '<span class="pipe-step"><span class="pipe-dot"></span> BƯỚC ' + (i + 1) + '</span>' +
            '<span class="pipe-name">' + U.esc(s.name) + '</span>' +
            '<span class="pipe-n">' + (byStage[s.id] || 0) + '<span>hồ sơ</span></span>' +
          '</button>';
        }).join('') +
      '</div>' +

      /* ---- 3. Bộ lọc + bảng ---- */
      '<div class="filterbar" id="fbar">' +
        '<div class="field grow" style="min-width:190px"><label for="f-q">Tìm khách hàng</label>' +
          '<input class="input" id="f-q" value="' + U.esc(search) + '" placeholder="Tên khách, mã, nội dung nhắc…"></div>' +
        '<div class="field" style="min-width:180px"><label for="f-due">Lịch nhắc</label>' +
          '<select class="select" id="f-due">' +
            [['', 'Tất cả'], ['now', 'Cần liên hệ ngay'], ['week', 'Trong 7 ngày tới'],
             ['set', 'Đã đặt lịch nhắc'], ['none', 'Chưa đặt nhắc'], ['off', 'Không nhắc nữa']].map(function (o) {
              return '<option value="' + o[0] + '"' + (fDue === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
            }).join('') +
          '</select></div>' +
        '<div class="field"><span class="field-label">Hồ sơ đã đóng</span>' +
          '<button class="btn btn-sm" type="button" id="tg-closed" aria-pressed="' + showClosed + '">' +
            (showClosed ? 'Đang hiện cả hồ sơ đã đóng' : 'Đang ẩn hồ sơ đã đóng') + '</button></div>' +
      '</div>' +

      '<div class="card"><div class="card-body flush">' +
        (list.length
          ? '<div class="table-scroll"><table class="tbl">' +
              '<thead><tr><th>Mã</th><th>Khách hàng / Công trình</th>' +
              '<th style="min-width:180px">Đang ở bước</th>' +
              '<th style="min-width:210px">Nhắc hẹn lần tới</th>' +
              '<th class="n">Giờ đã dùng</th><th></th></tr></thead>' +
              '<tbody>' + list.map(function (p) {
                var i = Store.stageIndex(p.stageId);
                var k = p.followUp ? (FOLLOW_KINDS[p.followUp.kind] || FOLLOW_KINDS.other) : null;
                var cr = p.closeReason ? Store.closeReason(p.closeReason) : null;
                var nNotes = (p.notes || []).length;
                return '<tr class="rowlink" data-open="' + p.id + '">' +
                  '<td class="num t-strong">' + U.esc(p.code) + '</td>' +
                  '<td class="t-strong t-wrap">' +
                    '<button class="row-open" type="button" data-open="' + p.id + '">' + U.esc(p.name) + '</button>' +
                    (p.active === false
                      ? ' <span class="badge badge-rejected">' + U.icon('xCircle') +
                        U.esc(cr ? cr.name : 'Đã đóng') + '</span>'
                      : '') +
                    '<div class="t-muted" style="font-weight:400;font-size:12.5px">' +
                      U.esc(p.client || '') + (p.phone ? ' · ' + U.esc(p.phone) : '') +
                      (p.address ? ' · ' + U.esc(p.address) : '') +
                      (nNotes ? ' · ' + nNotes + ' ghi chú' : '') + '</div></td>' +
                  '<td><b style="font-size:13px">' + (i + 1) + '. ' + U.esc(Store.STAGES[i].name) + '</b>' +
                    stepperHtml(p.stageId) + '</td>' +
                  '<td>' + duePill(p) +
                    (!p.noFollow && p.followUp && p.followUp.note
                      ? '<div class="due-note">' + U.icon(k.icon) + ' ' + U.esc(p.followUp.note) + '</div>' : '') +
                  '</td>' +
                  '<td class="n">' + U.hours(hoursBy[p.id] || 0) + '</td>' +
                  '<td class="n">' + (isAdmin()
                    ? '<div class="btn-row" style="flex-wrap:nowrap;justify-content:flex-end">' +
                      '<button class="btn btn-sm" data-remind="' + p.id + '" title="Đặt lịch nhắc" ' +
                        'aria-label="Đặt lịch nhắc cho ' + U.esc(p.name) + '">' + U.icon('bell') + '</button>' +
                      '<button class="btn btn-sm" data-edit-proj="' + p.id + '" title="Sửa hồ sơ" ' +
                        'aria-label="Sửa hồ sơ ' + U.esc(p.name) + '">' + U.icon('edit') + '</button></div>'
                    : '') + '</td></tr>';
              }).join('') + '</tbody></table></div>'
          : '<div class="empty">' + U.icon('building') + '<h3>Không có hồ sơ nào</h3>' +
            '<p>Không tìm thấy khách hàng phù hợp với bộ lọc hiện tại.</p></div>') +
      '</div></div>';

    U.on(U.$('#pipe', main), 'click', '[data-stage]', function (e, b) {
      setQ({ stage: b.getAttribute('data-stage') });
    });
    U.$('#f-q', main).addEventListener('input', U.debounce(function (e) { setQ({ q: e.target.value }); }, 350));
    U.$('#f-due', main).addEventListener('change', function (e) { setQ({ due: e.target.value }); });
    U.$('#tg-closed', main).addEventListener('click', function () { setQ({ closed: showClosed ? '' : '1' }); });
    var nb = U.$('#btn-new-proj', main);
    if (nb) nb.addEventListener('click', function () { editProject(null); });

    /* Bấm bất kỳ đâu trong dòng (trừ các nút thao tác) để mở hồ sơ khách hàng */
    U.on(main, 'click', 'tr.rowlink', function (e, tr) {
      if (e.target.closest('button, a')) return;
      openProjectDialog(proj(tr.getAttribute('data-open')));
    });
    U.on(main, 'click', '.row-open', function (e, b) {
      openProjectDialog(proj(b.getAttribute('data-open')));
    });

    U.on(main, 'click', '[data-edit-proj]', function (e, b) { editProject(proj(b.getAttribute('data-edit-proj'))); });
    U.on(main, 'click', '[data-remind]', function (e, b) { openReminderDialog(proj(b.getAttribute('data-remind'))); });
    U.on(main, 'click', '[data-snooze]', function (e, b) { snoozeFollowUp(proj(b.getAttribute('data-snooze')), 3); });
    U.on(main, 'click', '[data-done]', function (e, b) { completeFollowUp(proj(b.getAttribute('data-done'))); });
  }

  /* ---------------- Ghi chú khách hàng ---------------- */
  var NOTE_TYPES = {
    note:    { label: 'Ghi chú',          icon: 'edit' },
    contact: { label: 'Kết quả liên hệ',  icon: 'phone' },
    stage:   { label: 'Chuyển bước',      icon: 'chevronR' },
    close:   { label: 'Đóng hồ sơ',       icon: 'xCircle' },
    reopen:  { label: 'Mở lại hồ sơ',     icon: 'refresh' },
    off:     { label: 'Ngưng nhắc',       icon: 'bellOff' }
  };

  /** Ghi một mốc vào dòng thời gian của hồ sơ (mới nhất nằm đầu) */
  function addNote(p, type, text) {
    if (!text) return p;
    p.notes = p.notes || [];
    p.notes.unshift({ id: U.uid('nt'), at: Date.now(), by: S.user.id, type: type, text: text });
    if (p.notes.length > 200) p.notes.length = 200;
    return p;
  }

  function timelineHtml(notes) {
    if (!notes || !notes.length) {
      return '<p class="t-muted" style="font-size:13.5px">Chưa có ghi chú nào cho khách này.</p>';
    }
    return '<ul class="timeline">' + notes.map(function (n) {
      var t = NOTE_TYPES[n.type] || NOTE_TYPES.note;
      var who = n.by ? emp(n.by).name : '';
      return '<li class="tl-item t-' + n.type + '">' +
        '<span class="tl-dot">' + U.icon(t.icon) + '</span>' +
        '<div><div class="tl-head"><b>' + U.esc(t.label) + '</b>' +
          '<span>' + U.dateTimeVN(n.at) + '</span>' +
          (who ? '<span>· ' + U.esc(who) + '</span>' : '') + '</div>' +
          '<p class="tl-text">' + U.esc(n.text) + '</p></div></li>';
    }).join('') + '</ul>';
  }

  /* ---------------- Ghi kết quả sau khi liên hệ ---------------- */
  var CONTACT_PRESETS = [
    'Không nghe máy, hẹn gọi lại sau.',
    'Khách hẹn xem lại rồi báo sau.',
    'Khách đồng ý phương án, chuyển bước tiếp theo.',
    'Khách đang so sánh giá với đơn vị khác.',
    'Khách hẹn gặp trực tiếp tại công trình.',
    'Khách xin hoãn, chưa làm trong thời gian tới.'
  ];

  function openContactResultDialog(p) {
    var fu = p.followUp;
    var el = U.openOverlay('<div class="dialog">' +
      '<div class="dialog-head"><h3>Kết quả liên hệ</h3>' +
        '<button class="icon-btn" type="button" data-close aria-label="Đóng">' + U.icon('x') + '</button></div>' +
      '<div class="dialog-body">' +
        '<p style="font-size:14px;font-weight:700;margin-bottom:2px">' + U.esc(p.name) + '</p>' +
        '<p class="help" style="margin-bottom:18px">' + U.esc(p.client || '') +
          (p.phone ? ' · ' + U.esc(p.phone) : '') +
          (fu && fu.note ? '<br>Việc cần làm: ' + U.esc(fu.note) : '') + '</p>' +

        '<div class="field"><label for="ct-note">Khách nói gì? <span class="req">*</span></label>' +
          '<textarea class="textarea" id="ct-note" rows="3" ' +
            'placeholder="Ghi lại nội dung khách trao đổi để lần sau còn nhớ."></textarea></div>' +

        '<div class="field"><span class="field-label">Chọn nhanh</span>' +
          '<div class="quick-dates" id="ct-quick">' +
            CONTACT_PRESETS.map(function (s, i) {
              return '<button type="button" data-cp="' + i + '">' + U.esc(s) + '</button>';
            }).join('') +
          '</div></div>' +
      '</div>' +
      '<div class="dialog-foot">' +
        '<button class="btn btn-danger" type="button" data-off>' + U.icon('bellOff') + ' Lưu &amp; không nhắc nữa</button>' +
        '<div style="flex:1"></div>' +
        '<button class="btn" type="button" data-close>Huỷ</button>' +
        '<button class="btn btn-primary" type="button" data-next>' + U.icon('bell') + ' Lưu &amp; hẹn lần tới</button>' +
      '</div></div>');

    var ta = U.$('#ct-note', el);
    U.on(U.$('#ct-quick', el), 'click', '[data-cp]', function (ev, b) {
      var s = CONTACT_PRESETS[Number(b.getAttribute('data-cp'))];
      ta.value = ta.value.trim() ? ta.value.trim() + ' ' + s : s;
      ta.focus();
    });

    function commit(then) {
      var text = ta.value.trim();
      if (!text) { ta.setAttribute('aria-invalid', 'true'); return U.toast('Hãy ghi lại nội dung khách trao đổi', 'err'); }
      addNote(p, 'contact', text);
      p.followUp = null;
      then(p);
      saveProject(p).then(function () {
        U.closeOverlay();
        U.toast('Đã lưu ghi chú liên hệ', 'ok');
        if (then.openNext) openReminderDialog(proj(p.id), true);
      });
    }

    var next = function (pp) { pp.noFollow = false; };
    next.openNext = true;

    el.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-close]')) return U.closeOverlay();
      if (ev.target.closest('[data-off]')) {
        return commit(function (pp) { pp.noFollow = true; addNote(pp, 'off', 'Chuyển sang không nhắc nữa.'); });
      }
      if (ev.target.closest('[data-next]')) return commit(next);
    });
  }

  /* ---------------- Hồ sơ khách hàng ---------------- */
  function openProjectDialog(p) {
    if (!p || !p.id) return;
    var si = Store.stageIndex(p.stageId);
    var color = stageColor(p.stageId);
    var reason = p.closeReason ? Store.closeReason(p.closeReason) : null;

    var rows = S.reports.filter(function (r) {
      return r.projectId === p.id && r.status === 'approved';
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var agg = aggregate(rows);

    var fu = p.followUp, info = dueInfo(fu);
    var k = fu ? (FOLLOW_KINDS[fu.kind] || FOLLOW_KINDS.other) : null;

    var el = U.openOverlay('<div class="dialog wide">' +
      '<div class="dialog-head">' +
        '<h3>' + U.esc(p.name) + '</h3>' +
        '<button class="icon-btn" type="button" data-close aria-label="Đóng">' + U.icon('x') + '</button></div>' +

      '<div class="dialog-body">' +
        (p.active === false
          ? '<div class="close-banner" style="margin-bottom:18px">' + U.icon('xCircle') +
            '<span><b>Hồ sơ đã đóng</b>' + (reason ? ' — ' + U.esc(reason.name) : '') + '</span></div>'
          : '') +
        '<div class="kv">' +
          '<div><dt>Mã công trình</dt><dd class="num">' + U.esc(p.code) + '</dd></div>' +
          '<div><dt>Chủ đầu tư</dt><dd>' + U.esc(p.client || '—') + '</dd></div>' +
          '<div><dt>Điện thoại</dt><dd class="num">' +
            (p.phone ? '<a href="tel:' + U.esc(p.phone) + '">' + U.esc(p.phone) + '</a>' : '—') + '</dd></div>' +
          '<div><dt>Địa điểm</dt><dd>' + U.esc(p.address || '—') + '</dd></div>' +
          '<div><dt>Ngày tiếp nhận</dt><dd class="num">' +
            (p.startDate ? U.dateVN(p.startDate) : '—') + '</dd></div>' +
          '<div><dt>Trạng thái hồ sơ</dt><dd>' + (p.active === false ? 'Đã đóng' : 'Đang theo dõi') + '</dd></div>' +
        '</div>' +

        '<div class="dlg-section">Nhắc hẹn lần tới</div>' +
        (p.noFollow
          ? '<span class="due due-off">' + U.icon('bellOff') + 'Không nhắc nữa</span>'
          : fu
            ? '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px">' +
                '<span class="due ' + info.cls + '">' + U.icon(info.icon) + info.text + '</span>' +
                '<span class="num t-muted" style="font-size:13px">' + U.dateVN(fu.date) + '</span>' +
                '<span class="chip">' + U.icon(k.icon) + k.label + '</span>' +
              '</div>' +
              (fu.note ? '<p class="due-note" style="max-width:none;margin-top:8px">' + U.esc(fu.note) + '</p>' : '')
            : '<p class="t-muted" style="font-size:13.5px">Chưa đặt lịch nhắc cho khách này.</p>') +
        (isAdmin()
          ? '<div class="btn-row" style="margin-top:12px">' +
              '<button class="btn btn-sm btn-primary" data-remind2>' + U.icon('bell') + ' ' +
                (p.noFollow ? 'Theo dõi lại' : fu ? 'Đổi lịch nhắc' : 'Đặt lịch nhắc') + '</button>' +
              (fu ? '<button class="btn btn-sm btn-good" data-done2>' + U.icon('check') + ' Đã liên hệ</button>' : '') +
            '</div>'
          : '') +

        '<div class="dlg-section">Đang ở bước ' + (si + 1) + ' / ' + Store.STAGES.length + '</div>' +
        '<ol class="stage-list" style="--bar:' + color + '">' +
          Store.STAGES.map(function (s, i) {
            return '<li class="' + (i < si ? 'done' : i === si ? 'cur' : '') + '">' +
              '<b>' + (i < si ? '✓' : (i + 1)) + '</b>' +
              '<span>' + U.esc(s.name) + '</span></li>';
          }).join('') +
        '</ol>' +

        '<div class="dlg-section">Giờ công đã dùng</div>' +
        '<div class="kv">' +
          '<div><dt>Giờ hành chính</dt><dd class="num">' + U.hours(agg.hc) + ' giờ</dd></div>' +
          '<div><dt>Giờ tăng ca</dt><dd class="num">' + U.hours(agg.tc) + ' giờ</dd></div>' +
          '<div><dt>Tổng cộng</dt><dd class="num">' + U.hours(agg.total) + ' giờ</dd></div>' +
          '<div><dt>Số đầu việc</dt><dd class="num">' + rows.length + '</dd></div>' +
        '</div>' +
        (rows.length
          ? '<div class="table-scroll" style="margin-top:12px"><table class="tbl">' +
              '<thead><tr><th>Ngày</th><th>Nhân viên</th><th>Công việc</th><th class="n">Giờ</th></tr></thead>' +
              '<tbody>' + rows.slice(0, 6).map(function (r) {
                return '<tr><td class="num">' + U.dateVN(r.date) + '</td>' +
                  '<td>' + U.esc(emp(r.employeeId).name) + '</td>' +
                  '<td class="t-wrap">' + U.esc(r.description) + '</td>' +
                  '<td class="n">' + U.hours((Number(r.hc) || 0) + (Number(r.tc) || 0)) + '</td></tr>';
              }).join('') + '</tbody></table></div>' +
              (rows.length > 6 ? '<p class="help" style="margin-top:8px">Hiển thị 6 đầu việc gần nhất trên tổng số ' +
                rows.length + '.</p>' : '')
          : '<p class="t-muted" style="font-size:13.5px;margin-top:8px">Chưa có báo cáo nào đã duyệt cho công trình này.</p>') +

        '<div class="dlg-section">Ghi chú &amp; lịch sử ' +
          ((p.notes && p.notes.length) ? '(' + p.notes.length + ')' : '') + '</div>' +
        (isAdmin()
          ? '<div class="field">' +
              '<label class="visually-hidden" for="nt-text">Nội dung ghi chú</label>' +
              '<textarea class="textarea" id="nt-text" rows="2" ' +
                'placeholder="Khách nói gì, hẹn gì, lưu ý gì…"></textarea>' +
              '<div class="btn-row" style="margin-top:8px">' +
                '<button class="btn btn-sm btn-primary" type="button" data-addnote>' +
                  U.icon('plus') + ' Thêm ghi chú</button></div>' +
            '</div>'
          : '') +
        '<div style="margin-top:14px">' + timelineHtml(p.notes) + '</div>' +
      '</div>' +

      '<div class="dialog-foot">' +
        (isAdmin()
          ? (p.active === false
              ? '<button class="btn" type="button" data-reopen>' + U.icon('refresh') + ' Mở lại hồ sơ</button>'
              : '<button class="btn btn-danger" type="button" data-closefile>' + U.icon('xCircle') + ' Đóng hồ sơ</button>') +
            '<button class="btn" type="button" data-edit2>' + U.icon('edit') + ' Sửa hồ sơ</button>'
          : '') +
        '<div style="flex:1"></div>' +
        '<button class="btn btn-primary" type="button" data-close>Đóng</button>' +
      '</div></div>');

    el.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-close]')) return U.closeOverlay();
      if (ev.target.closest('[data-edit2]')) { U.closeOverlay(); return editProject(proj(p.id)); }
      if (ev.target.closest('[data-remind2]')) { U.closeOverlay(); return openReminderDialog(proj(p.id)); }
      if (ev.target.closest('[data-done2]')) { U.closeOverlay(); return completeFollowUp(proj(p.id)); }
      if (ev.target.closest('[data-closefile]')) { U.closeOverlay(); return openCloseDialog(proj(p.id)); }

      if (ev.target.closest('[data-reopen]')) {
        var fresh = proj(p.id);
        fresh.active = true; fresh.closeReason = ''; fresh.noFollow = false;
        addNote(fresh, 'reopen', 'Mở lại hồ sơ để tiếp tục theo dõi.');
        return saveProject(fresh).then(function () {
          U.closeOverlay(); U.toast('Đã mở lại hồ sơ', 'ok');
        });
      }

      if (ev.target.closest('[data-addnote]')) {
        var ta = U.$('#nt-text', el);
        var text = ta.value.trim();
        if (!text) { ta.setAttribute('aria-invalid', 'true'); return U.toast('Hãy nhập nội dung ghi chú', 'err'); }
        var rec = proj(p.id);
        addNote(rec, 'note', text);
        return saveProject(rec).then(function () {
          U.closeOverlay();
          U.toast('Đã thêm ghi chú', 'ok');
          openProjectDialog(proj(p.id));
        });
      }
    });
  }

  /* ---------------- Đóng hồ sơ kèm lý do ---------------- */
  function openCloseDialog(p) {
    var el = U.openOverlay('<div class="dialog" style="max-width:500px">' +
      '<div class="dialog-head"><h3>Đóng hồ sơ khách hàng</h3>' +
        '<button class="icon-btn" type="button" data-close aria-label="Đóng">' + U.icon('x') + '</button></div>' +
      '<div class="dialog-body">' +
        '<p style="font-size:14px;font-weight:700;margin-bottom:2px">' + U.esc(p.name) + '</p>' +
        '<p class="help" style="margin-bottom:18px">' + U.esc(p.client || '') +
          (p.phone ? ' · ' + U.esc(p.phone) : '') + '</p>' +

        '<div class="field"><label for="cl-reason">Lý do đóng <span class="req">*</span></label>' +
          '<select class="select" id="cl-reason">' +
            '<option value="">— Chọn lý do —</option>' +
            Store.CLOSE_REASONS.map(function (r) {
              return '<option value="' + r.id + '">' + U.esc(r.name) + '</option>';
            }).join('') +
          '</select></div>' +

        '<div class="field"><label for="cl-note">Ghi chú thêm</label>' +
          '<textarea class="textarea" id="cl-note" rows="2" ' +
            'placeholder="Ví dụ: Gọi 5 lần không ai nghe, số không liên lạc được."></textarea>' +
          '<span class="help">Lý do và ghi chú sẽ được lưu vào lịch sử của hồ sơ.</span>' +
          '<span class="err" id="cl-err" hidden></span></div>' +
      '</div>' +
      '<div class="dialog-foot">' +
        '<button class="btn" type="button" data-close>Huỷ</button>' +
        '<button class="btn btn-danger" type="button" data-save>' + U.icon('xCircle') + ' Đóng hồ sơ</button>' +
      '</div></div>');

    el.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-close]')) return U.closeOverlay();
      if (!ev.target.closest('[data-save]')) return;

      var rid = U.$('#cl-reason', el).value;
      if (!rid) {
        var errEl = U.$('#cl-err', el);
        errEl.innerHTML = U.icon('alert') + '<span>Vui lòng chọn lý do đóng hồ sơ.</span>';
        errEl.hidden = false;
        return;
      }
      var note = U.$('#cl-note', el).value.trim();
      p.active = false;
      p.closeReason = rid;
      p.followUp = null;
      p.noFollow = true;
      addNote(p, 'close', Store.closeReason(rid).name + (note ? ' — ' + note : ''));
      saveProject(p).then(function () {
        U.closeOverlay();
        U.toast('Đã đóng hồ sơ: ' + Store.closeReason(rid).name, 'ok');
      });
    });
  }

  /* ---------------- Thao tác nhanh với lịch nhắc ---------------- */
  function saveProject(p) {
    return Store.put('projects', p).then(reload).then(render);
  }

  function snoozeFollowUp(p, days) {
    if (!p.followUp) return;
    var base = U.diffDays(U.todayISO(), p.followUp.date) < 0 ? U.todayISO() : p.followUp.date;
    p.followUp = Object.assign({}, p.followUp, { date: U.addDays(base, days) });
    saveProject(p).then(function () {
      U.toast('Đã dời lịch nhắc sang ' + U.dateVN(p.followUp.date), 'ok');
    });
  }

  /** “Đã liên hệ” luôn hỏi kết quả trước khi ghi nhận */
  function completeFollowUp(p) {
    if (!p || !p.followUp) return;
    openContactResultDialog(p);
  }

  /* ---------------- Hộp thoại đặt lịch nhắc ---------------- */
  var QUICK_DATES = [
    ['Ngày mai',    'd', 1],
    ['3 ngày nữa',  'd', 3],
    ['1 tuần nữa',  'd', 7],
    ['2 tuần nữa',  'd', 14],
    ['1 tháng nữa', 'm', 1],
    ['2 tháng nữa', 'm', 2],
    ['3 tháng nữa', 'm', 3],
    ['6 tháng nữa', 'm', 6]
  ];

  function openReminderDialog(p, afterDone) {
    var fu = p.followUp || { date: U.addDays(U.todayISO(), 3), kind: 'call', note: '' };
    var log = (p.notes || []).slice(0, 5);

    var el = U.openOverlay('<div class="dialog">' +
      '<div class="dialog-head"><h3>' + (afterDone ? 'Đặt lịch nhắc lần tới' : 'Nhắc hẹn chăm sóc khách') + '</h3>' +
        '<button class="icon-btn" type="button" data-close aria-label="Đóng">' + U.icon('x') + '</button></div>' +
      '<div class="dialog-body">' +
        '<p style="font-size:14px;font-weight:700;margin-bottom:2px">' + U.esc(p.name) + '</p>' +
        '<p class="help" style="margin-bottom:18px">' + U.esc(p.client || '') +
          (p.phone ? ' · ' + U.esc(p.phone) : '') + '</p>' +

        (p.noFollow
          ? '<div class="callout warn" style="margin-bottom:18px">' + U.icon('bellOff') +
            '<span>Hồ sơ này đang đặt <b>Không nhắc nữa</b>. Chọn ngày rồi bấm ' +
            '<b>Lưu lịch nhắc</b> để theo dõi lại.</span></div>'
          : '') +

        '<div class="field"><span class="field-label">Nhắc lại khi nào</span>' +
          '<div class="quick-dates" id="rm-quick">' +
            QUICK_DATES.map(function (o, i) {
              return '<button type="button" data-qd="' + i + '">' + o[0] + '</button>';
            }).join('') +
          '</div></div>' +

        '<div class="field-row">' +
          '<div class="field"><label for="rm-date">Ngày nhắc <span class="req">*</span></label>' +
            '<input class="input" type="date" id="rm-date" value="' + U.esc(fu.date) + '">' +
            '<span class="help" id="rm-rel"></span></div>' +
          '<div class="field"><label for="rm-kind">Hình thức</label>' +
            '<select class="select" id="rm-kind">' +
              Object.keys(FOLLOW_KINDS).map(function (k) {
                return '<option value="' + k + '"' + (fu.kind === k ? ' selected' : '') + '>' +
                  FOLLOW_KINDS[k].label + '</option>';
              }).join('') +
            '</select></div>' +
        '</div>' +

        '<div class="field"><label for="rm-note">Nội dung cần nhắc</label>' +
          '<textarea class="textarea" id="rm-note" rows="2" ' +
            'placeholder="Ví dụ: Chị xem lại phương án rồi mai báo — gọi hỏi kết quả.">' +
            U.esc(fu.note || '') + '</textarea></div>' +

        (log.length
          ? '<details class="block" style="margin-top:18px;box-shadow:none">' +
            '<summary>Ghi chú gần đây <span class="sub">' + log.length + ' mục</span></summary>' +
            '<div class="block-body" style="padding-top:0">' + timelineHtml(log) + '</div></details>'
          : '') +
      '</div>' +
      '<div class="dialog-foot">' +
        (p.noFollow ? '' :
          '<button class="btn btn-danger" type="button" data-off>' + U.icon('bellOff') + ' Không nhắc nữa</button>') +
        '<div style="flex:1"></div>' +
        '<button class="btn" type="button" data-close>Huỷ</button>' +
        '<button class="btn btn-primary" type="button" data-save>' + U.icon('check') + ' Lưu lịch nhắc</button>' +
      '</div></div>');

    var dateEl = U.$('#rm-date', el);

    function paintRel() {
      var info = dueInfo({ date: dateEl.value });
      U.$('#rm-rel', el).textContent = info ? (info.text + ' · ' + U.weekdayVN(dateEl.value)) : '';
      U.$$('#rm-quick button', el).forEach(function (b) {
        var o = QUICK_DATES[Number(b.getAttribute('data-qd'))];
        var d = o[1] === 'd' ? U.addDays(U.todayISO(), o[2]) : U.addMonths(U.todayISO(), o[2]);
        b.setAttribute('aria-pressed', String(d === dateEl.value));
      });
    }
    paintRel();
    dateEl.addEventListener('change', paintRel);

    U.on(U.$('#rm-quick', el), 'click', '[data-qd]', function (ev, b) {
      var o = QUICK_DATES[Number(b.getAttribute('data-qd'))];
      dateEl.value = o[1] === 'd' ? U.addDays(U.todayISO(), o[2]) : U.addMonths(U.todayISO(), o[2]);
      paintRel();
    });

    el.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-close]')) return U.closeOverlay();

      if (ev.target.closest('[data-off]')) {
        p.followUp = null;
        p.noFollow = true;
        return saveProject(p).then(function () {
          U.closeOverlay();
          U.toast('Đã chuyển ' + p.client + ' sang “Không nhắc nữa”', 'ok');
        });
      }
      if (!ev.target.closest('[data-save]')) return;

      if (!dateEl.value) return U.toast('Vui lòng chọn ngày nhắc', 'err');
      p.noFollow = false;
      p.followUp = {
        date: dateEl.value,
        kind: U.$('#rm-kind', el).value,
        note: U.$('#rm-note', el).value.trim(),
        createdAt: Date.now()
      };
      saveProject(p).then(function () {
        U.closeOverlay();
        U.toast('Sẽ nhắc lại ngày ' + U.dateVN(p.followUp.date), 'ok');
      });
    });
  }

  function editProject(p) {
    var isNew = !p;
    if (isNew) {
      var n = S.projects.length + 1;
      p = { id: '', code: 'CT' + U.pad(n), name: '', client: '', phone: '', address: '',
        stageId: Store.STAGES[0].id, startDate: U.todayISO(), active: true };
    }
    var el = U.openOverlay('<div class="dialog">' +
      '<div class="dialog-head"><h3>' + (isNew ? 'Thêm khách hàng / công trình' : 'Sửa hồ sơ khách hàng') + '</h3>' +
        '<button class="icon-btn" type="button" data-close aria-label="Đóng">' + U.icon('x') + '</button></div>' +
      '<div class="dialog-body">' +
        '<div class="field-row">' +
          '<div class="field"><label for="p-code">Mã công trình <span class="req">*</span></label>' +
            '<input class="input num" id="p-code" value="' + U.esc(p.code) + '"></div>' +
          '<div class="field"><label for="p-start">Ngày tiếp nhận</label>' +
            '<input class="input" type="date" id="p-start" value="' + U.esc(p.startDate || U.todayISO()) + '"></div>' +
          '<div class="field"><label for="p-act">Trạng thái hồ sơ</label>' +
            '<select class="select" id="p-act">' +
              '<option value="1"' + (p.active !== false ? ' selected' : '') + '>Đang theo dõi</option>' +
              '<option value="0"' + (p.active === false ? ' selected' : '') + '>Đã đóng</option></select></div>' +
        '</div>' +

        '<div class="field" id="p-reason-wrap"' + (p.active === false ? '' : ' hidden') + '>' +
          '<label for="p-reason">Lý do đóng hồ sơ <span class="req">*</span></label>' +
          '<select class="select" id="p-reason"><option value="">— Chọn lý do —</option>' +
            Store.CLOSE_REASONS.map(function (r) {
              return '<option value="' + r.id + '"' + (p.closeReason === r.id ? ' selected' : '') + '>' +
                U.esc(r.name) + '</option>';
            }).join('') +
          '</select></div>' +
        '<div class="field"><label for="p-name">Tên công trình / Khách hàng <span class="req">*</span></label>' +
          '<input class="input" id="p-name" value="' + U.esc(p.name) + '" placeholder="LONG THÀNH - CHỊ NHUNG"></div>' +
        '<div class="field-row">' +
          '<div class="field"><label for="p-client">Chủ đầu tư</label>' +
            '<input class="input" id="p-client" value="' + U.esc(p.client || '') + '"></div>' +
          '<div class="field"><label for="p-phone">Số điện thoại</label>' +
            '<input class="input num" id="p-phone" value="' + U.esc(p.phone || '') + '"></div>' +
        '</div>' +
        '<div class="field"><label for="p-addr">Địa điểm</label>' +
          '<input class="input" id="p-addr" value="' + U.esc(p.address || '') + '"></div>' +

        '<div class="field"><label for="p-stage">Đang ở bước nào trong hành trình</label>' +
          '<select class="select" id="p-stage">' +
            Store.STAGES.map(function (s, i) {
              return '<option value="' + s.id + '"' + (p.stageId === s.id ? ' selected' : '') + '>' +
                (i + 1) + '. ' + U.esc(s.name) + '</option>';
            }).join('') +
          '</select>' +
          '<span class="help" id="p-stage-note"></span></div>' +
        '<span class="err" id="p-err" hidden></span>' +
      '</div>' +
      '<div class="dialog-foot"><button class="btn" type="button" data-close>Huỷ</button>' +
        '<button class="btn btn-primary" type="button" data-save>' + U.icon('check') + ' Lưu</button></div></div>');

    function paintNote() {
      U.$('#p-stage-note', el).textContent = Store.stage(U.$('#p-stage', el).value).note;
    }
    paintNote();
    U.$('#p-stage', el).addEventListener('change', paintNote);

    var actEl = U.$('#p-act', el);
    actEl.addEventListener('change', function () {
      U.$('#p-reason-wrap', el).hidden = actEl.value !== '0';
    });

    el.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-close]')) return U.closeOverlay();
      if (!ev.target.closest('[data-save]')) return;
      var name = U.$('#p-name', el).value.trim(), code = U.$('#p-code', el).value.trim();
      if (!name || !code) return U.toast('Vui lòng nhập mã và tên công trình', 'err');

      var willClose = actEl.value === '0';
      var pickedReason = U.$('#p-reason', el).value;
      if (willClose && !pickedReason) {
        var errEl = U.$('#p-err', el);
        errEl.innerHTML = U.icon('alert') + '<span>Hồ sơ đóng thì phải chọn lý do đóng.</span>';
        errEl.hidden = false;
        return;
      }
      var rec = {
        id: p.id || code, code: code, name: name,
        client: U.$('#p-client', el).value.trim(),
        phone: U.$('#p-phone', el).value.trim(),
        address: U.$('#p-addr', el).value.trim(),
        stageId: U.$('#p-stage', el).value,
        startDate: U.$('#p-start', el).value,
        followUp: willClose ? null : (p.followUp || null),
        notes: (p.notes || []).slice(),
        noFollow: willClose ? true : !!p.noFollow,
        closeReason: willClose ? pickedReason : '',
        active: !willClose
      };

      /* Ghi lại các thay đổi đáng nhớ vào dòng thời gian */
      if (!isNew && rec.stageId !== p.stageId) {
        addNote(rec, 'stage', 'Chuyển từ “' + Store.stage(p.stageId).name +
          '” sang “' + Store.stage(rec.stageId).name + '”.');
      }
      if (!isNew && willClose && p.active !== false) {
        addNote(rec, 'close', Store.closeReason(pickedReason).name + '.');
      }
      if (!isNew && !willClose && p.active === false) {
        addNote(rec, 'reopen', 'Mở lại hồ sơ để tiếp tục theo dõi.');
      }

      Store.put('projects', rec).then(function () {
        U.closeOverlay(); U.toast('Đã lưu hồ sơ khách hàng', 'ok'); return reload();
      }).then(render);
    });
  }

  function tabCategories(body) {
    body.innerHTML = '<div class="card">' +
      '<div class="card-head"><h3>Hạng mục công việc</h3></div>' +
      '<div class="card-body">' +
        '<p class="help" style="margin-bottom:16px">Ba hạng mục này quyết định màu sắc và cách nhóm trong báo cáo tổng hợp. ' +
        'Bảng màu đã được kiểm tra để người mù màu vẫn phân biệt được.</p>' +
        '<div class="chart-grid">' +
          S.categories.map(function (c) {
            return '<div class="card" style="margin:0"><div class="card-body">' +
              '<div style="display:flex;align-items:center;gap:12px">' +
                '<span style="width:34px;height:34px;border-radius:8px;background:' + c.hex + ';flex:none"></span>' +
                '<div><b>' + U.esc(c.name) + '</b><br><span class="help num">' + U.esc(c.hex) + '</span></div>' +
              '</div>' +
              '<div class="field" style="margin:16px 0 0"><label for="c-' + c.id + '">Đổi tên hiển thị</label>' +
                '<input class="input" id="c-' + c.id + '" value="' + U.esc(c.name) + '" data-cat="' + c.id + '"></div>' +
            '</div></div>';
          }).join('') +
        '</div>' +
        '<div class="btn-row" style="margin-top:18px"><button class="btn btn-primary" data-save-cats>' +
          U.icon('check') + ' Lưu tên hạng mục</button></div>' +
      '</div></div>';

    U.on(body, 'click', '[data-save-cats]', function () {
      Promise.all(U.$$('[data-cat]', body).map(function (i) {
        var c = cat(i.getAttribute('data-cat'));
        var v = i.value.trim();
        if (!v || v === c.name) return Promise.resolve();
        return Store.put('categories', Object.assign({}, c, { name: v }));
      })).then(function () {
        U.toast('Đã lưu tên hạng mục', 'ok'); return reload();
      }).then(render);
    });
  }

  function tabGeneral(body) {
    var st = S.settings;
    body.innerHTML = '<div class="card">' +
      '<div class="card-head"><h3>Thông số chung</h3></div><div class="card-body">' +
        '<div class="field"><label for="g-company">Tên công ty (hiện trên đầu báo cáo in)</label>' +
          '<input class="input" id="g-company" value="' + U.esc(st.company) + '"></div>' +

        '<h4 style="font-size:13px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);margin:24px 0 12px">Ca làm việc</h4>' +
        '<div class="field-row">' +
          '<div class="field"><label for="g-hcf">Giờ vào ca hành chính</label>' +
            '<input class="input" type="time" id="g-hcf" value="' + U.esc(st.hcFrom) + '"></div>' +
          '<div class="field"><label for="g-hct">Giờ tan ca hành chính</label>' +
            '<input class="input" type="time" id="g-hct" value="' + U.esc(st.hcTo) + '"></div>' +
          '<div class="field"><label for="g-luf">Bắt đầu nghỉ trưa</label>' +
            '<input class="input" type="time" id="g-luf" value="' + U.esc(st.lunchFrom) + '"></div>' +
          '<div class="field"><label for="g-lut">Kết thúc nghỉ trưa</label>' +
            '<input class="input" type="time" id="g-lut" value="' + U.esc(st.lunchTo) + '"></div>' +
        '</div>' +

        '<h4 style="font-size:13px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);margin:24px 0 12px">Cách tính lương</h4>' +
        '<div class="field"><label for="g-mode">Công thức lương tháng</label>' +
          '<select class="select" id="g-mode">' +
            '<option value="monthly"' + (st.salaryMode === 'monthly' ? ' selected' : '') + '>' +
              'Lương cứng tháng + Giờ TC × Đơn giá giờ × Hệ số</option>' +
            '<option value="hourly"' + (st.salaryMode === 'hourly' ? ' selected' : '') + '>' +
              '(Giờ HC + Giờ TC × Hệ số) × Đơn giá giờ</option>' +
          '</select>' +
          '<span class="help">Công thức đầu tiên khớp với file Excel đang dùng.</span></div>' +
        '<div class="field-row">' +
          '<div class="field"><label for="g-ot">Hệ số tăng ca</label>' +
            '<input class="input num" type="number" id="g-ot" min="1" max="3" step="0.1" value="' + st.otRate + '"></div>' +
          '<div class="field"><label for="g-days">Số ngày công chuẩn / tháng</label>' +
            '<input class="input num" type="number" id="g-days" min="1" max="31" value="' + st.standardDays + '"></div>' +
          '<div class="field"><label for="g-hpd">Số giờ làm / ngày</label>' +
            '<input class="input num" type="number" id="g-hpd" min="1" max="12" step="0.5" value="' + st.hoursPerDay + '"></div>' +
        '</div>' +

        '<div class="btn-row" style="margin-top:8px">' +
          '<button class="btn btn-primary" data-save-gen>' + U.icon('check') + ' Lưu thông số</button></div>' +
      '</div></div>';

    U.on(body, 'click', '[data-save-gen]', function () {
      var rec = Object.assign({}, st, {
        company: U.$('#g-company', body).value.trim() || st.company,
        hcFrom: U.$('#g-hcf', body).value, hcTo: U.$('#g-hct', body).value,
        lunchFrom: U.$('#g-luf', body).value, lunchTo: U.$('#g-lut', body).value,
        salaryMode: U.$('#g-mode', body).value,
        otRate: Number(U.$('#g-ot', body).value) || 1.5,
        standardDays: Number(U.$('#g-days', body).value) || 22,
        hoursPerDay: Number(U.$('#g-hpd', body).value) || 8
      });
      Store.put('settings', rec).then(function () {
        U.toast('Đã lưu thông số chung', 'ok'); return reload();
      }).then(render);
    });
  }

  function tabData(body) {
    body.innerHTML = '<div class="card">' +
      '<div class="card-head"><h3>Sao lưu &amp; phục hồi</h3></div><div class="card-body">' +
        '<div class="callout">' + U.icon('info') +
          '<span>Toàn bộ dữ liệu (kể cả ảnh) đang nằm trong trình duyệt của <b>máy này</b>. ' +
          'Hãy sao lưu định kỳ, hoặc đọc mục “Dùng chung cho cả công ty” trong tệp README để chuyển lên máy chủ.</span></div>' +
        '<div class="btn-row" style="margin-top:18px">' +
          '<button class="btn btn-primary" data-backup>' + U.icon('download') + ' Tải file sao lưu (.json)</button>' +
          '<button class="btn" data-restore>' + U.icon('upload') + ' Phục hồi từ file sao lưu</button>' +
          '<input type="file" accept="application/json" id="restore-file" hidden>' +
        '</div>' +
      '</div></div>' +

      '<div class="card"><div class="card-head"><h3>Xoá dữ liệu</h3></div><div class="card-body">' +
        '<div class="btn-row">' +
          '<button class="btn btn-danger" data-wipe-all>' + U.icon('trash') + ' Xoá sạch và tạo lại từ đầu</button>' +
        '</div>' +
        '<p class="help" style="margin-top:10px">Xoá toàn bộ nhân viên, khách hàng, báo cáo và ảnh trên máy này, ' +
        'đưa hệ thống về trạng thái ban đầu chỉ còn tài khoản quản lý. Hãy sao lưu trước khi dùng.</p>' +
      '</div></div>';

    U.on(body, 'click', '[data-backup]', function () {
      Promise.all([Store.all('employees'), Store.all('projects'), Store.all('categories'),
        Store.all('reports'), Store.all('images'), Store.settings()])
        .then(function (r) {
          return Promise.all(r[4].map(function (im) {
            return new Promise(function (res) {
              var fr = new FileReader();
              fr.onload = function () { res(Object.assign({}, im, { blob: null, data: fr.result })); };
              fr.readAsDataURL(im.blob);
            });
          })).then(function (imgs) {
            return { v: 1, at: new Date().toISOString(), settings: r[5], employees: r[0],
              projects: r[1], categories: r[2], reports: r[3], images: imgs };
          });
        })
        .then(function (data) {
          U.downloadBlob('MTHouse_SaoLuu_' + U.todayISO() + '.json',
            new Blob([JSON.stringify(data)], { type: 'application/json' }));
          U.toast('Đã tải file sao lưu', 'ok');
        });
    });

    var fileEl = U.$('#restore-file', body);
    U.on(body, 'click', '[data-restore]', function () { fileEl.click(); });
    fileEl.addEventListener('change', function () {
      var f = fileEl.files[0]; if (!f) return;
      U.confirmDialog({
        title: 'Phục hồi dữ liệu',
        message: 'Toàn bộ dữ liệu hiện tại sẽ bị thay thế bằng nội dung trong file sao lưu.',
        okText: 'Phục hồi', danger: true
      }).then(function (ok) {
        if (!ok) { fileEl.value = ''; return; }
        f.text().then(function (txt) {
          var d = JSON.parse(txt);
          return Store.resetAll().then(function () {
            return Promise.all([
              Store.put('settings', d.settings),
              Store.putMany('employees', d.employees || []),
              Store.putMany('projects', d.projects || []),
              Store.putMany('categories', d.categories || []),
              Store.putMany('reports', d.reports || []),
              Promise.all((d.images || []).map(function (im) {
                return fetch(im.data).then(function (r) { return r.blob(); }).then(function (b) {
                  return Store.put('images', Object.assign({}, im, { blob: b, data: undefined }));
                });
              }))
            ]);
          });
        }).then(function () {
          U.toast('Đã phục hồi dữ liệu', 'ok'); return reload();
        }).then(render).catch(function (err) { U.toast('File sao lưu không hợp lệ: ' + err.message, 'err'); });
      });
    });

    U.on(body, 'click', '[data-wipe-all]', function () {
      U.confirmDialog({ title: 'Xoá sạch toàn bộ dữ liệu',
        message: 'Toàn bộ nhân viên, công trình, báo cáo và ảnh sẽ bị xoá, hệ thống trở về trạng thái ban đầu.',
        okText: 'Xoá sạch tất cả', danger: true })
        .then(function (ok) {
          if (!ok) return;
          return Store.resetAll().then(Store.seed).then(function () {
            clearLogin();
            location.hash = '';
            location.reload();
          });
        });
    });
  }

  /* =========================================================
     VÒNG ĐỜI
     ========================================================= */
  function reload() {
    return Promise.all([Store.settings(), Store.all('employees'), Store.all('projects'),
      Store.all('categories'), Store.all('reports'), Store.all('quotes')])
      .then(function (r) {
        S.settings = r[0];
        S.employees = r[1];
        S.projects = r[2].sort(function (a, b) { return a.code < b.code ? -1 : 1; });
        S.categories = r[3].sort(function (a, b) { return (a.order || 9) - (b.order || 9); });
        S.reports = r[4];
        S.quotes = r[5] || [];
        if (S.user) S.user = emp(S.user.id);
      });
  }

  function render() {
    Charts.hideTip();
    if (!S.user) return renderLogin();

    var r = route();
    var allowed = allowedViews();
    if (allowed.indexOf(r.view) < 0) { return go(homeView()); }

    var prevMain = document.getElementById('main');
    if (prevMain && prevMain._onPaste) document.removeEventListener('paste', prevMain._onPaste);
    revokeUrls();

    /* Giữ con trỏ ở ô đang gõ — đổi bộ lọc sẽ vẽ lại cả trang */
    var ae = document.activeElement;
    var keepFocus = null;
    if (ae && ae.id && /^(INPUT|SELECT|TEXTAREA)$/.test(ae.tagName)) {
      keepFocus = { id: ae.id, start: null, end: null };
      try { keepFocus.start = ae.selectionStart; keepFocus.end = ae.selectionEnd; } catch (err) { /* input không hỗ trợ */ }
    }

    var main = renderShell(r.view);
    if (r.view === 'send') viewSend(main, r.q);
    else if (r.view === 'list') viewList(main, r.q);
    else if (r.view === 'projects') viewProjects(main, r.q);
    else if (r.view === 'quotes') Quote.viewList(main, r.q);
    else if (r.view === 'quote') Quote.viewEdit(main, r.q);
    else if (r.view === 'timesheet') viewTimesheet(main, r.q);
    else if (r.view === 'summary') viewSummary(main, r.q);
    else if (r.view === 'settings') viewSettings(main, r.q);

    if (keepFocus) {
      var back = document.getElementById(keepFocus.id);
      if (back) {
        back.focus();
        if (keepFocus.start != null) {
          try { back.setSelectionRange(keepFocus.start, keepFocus.end); } catch (err) { /* bỏ qua */ }
        }
      }
    }

    document.title = 'MT HOUSE — ' +
      (NAV.filter(function (n) { return n.id === r.view; })[0] || { label: 'Báo cáo' }).label;
  }

  /* Cầu nối cho quote.js dùng lại trạng thái và các hàm chung của ứng dụng */
  Quote.init({
    state: S, assets: ASSETS,
    proj: proj, emp: emp, cat: cat, isAdmin: isAdmin, staffList: staffList,
    reload: reload, render: render, setQ: setQ, go: go, urlOf: urlOf
  });

  window.addEventListener('hashchange', render);

  Store.ready()
    .then(reload)
    .then(function () {
      var uid = storedUserId();
      var u = uid ? S.employees.filter(function (e) { return e.id === uid; })[0] : null;
      S.user = u || null;
      /* Quản lý vào là thấy biểu đồ trước; nhân viên vào thẳng ô nhập việc */
      if (S.user && !location.hash) location.hash = '#/' + homeView();
      render();
    })
    .catch(function (err) {
      document.getElementById('app').innerHTML =
        '<div class="login"><div class="login-card"><div class="empty">' + U.icon('alert') +
        '<h3>Không khởi động được hệ thống</h3><p>' + U.esc(err.message) +
        '</p><p class="help">Nếu bạn đang mở bằng chế độ ẩn danh, hãy thử mở lại bằng cửa sổ thường.</p></div></div></div>';
    });
})();
