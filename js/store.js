/* =========================================================
   store.js — lớp dữ liệu (IndexedDB)
   Dữ liệu nằm trong trình duyệt của máy này. Xem README để
   biết cách chuyển sang máy chủ dùng chung cho cả công ty.
   ========================================================= */
(function (global) {
  'use strict';

  var DB_NAME = 'mthouse_report';
  var DB_VER = 1;
  var SEED_VERSION = 7;   /* tăng số này khi đổi cấu trúc dữ liệu khởi tạo */
  var db = null;

  /* Hành trình khách hàng — 6 bước, dùng chung cho kiến trúc và nội thất.
     Mã bước đặt theo nghĩa (không đánh số) để thêm/bớt bước không phải đánh số lại. */
  var STAGES = [
    { id: 'lead',     name: 'Tiếp nhận nhu cầu',    note: 'Khách liên hệ, ghi nhận yêu cầu và diện tích.' },
    { id: 'survey',   name: 'Khảo sát & báo giá',   note: 'Đo vẽ hiện trạng, gửi báo giá thiết kế.' },
    { id: 'contract', name: 'Ký hợp đồng',          note: 'Chốt giá, ký hợp đồng và nhận tạm ứng.' },
    { id: 'design',   name: 'Thiết kế & duyệt PA',  note: 'Mặt bằng công năng, phối cảnh 3D, hồ sơ kỹ thuật.' },
    { id: 'build',    name: 'Thi công & giám sát',  note: 'Xưởng sản xuất, thi công tại công trình.' },
    { id: 'handover', name: 'Nghiệm thu & bàn giao', note: 'Nghiệm thu, bàn giao và bảo hành.' }
  ];

  /* Lý do đóng hồ sơ khách hàng */
  var CLOSE_REASONS = [
    { id: 'junk',     name: 'Số rác / không liên hệ được' },
    { id: 'nodemand', name: 'Khách không còn nhu cầu' },
    { id: 'budget',   name: 'Vượt ngân sách của khách' },
    { id: 'other_co', name: 'Khách chọn đơn vị khác' },
    { id: 'postpone', name: 'Khách hoãn sang dịp khác' },
    { id: 'done',     name: 'Đã hoàn thành & bàn giao' },
    { id: 'other',    name: 'Lý do khác' }
  ];
  function closeReason(id) {
    for (var i = 0; i < CLOSE_REASONS.length; i++) if (CLOSE_REASONS[i].id === id) return CLOSE_REASONS[i];
    return null;
  }

  /* Bản đồ chuyển từ bộ 7 bước cũ sang bộ 6 bước hiện tại */
  var STAGE_ALIAS = {
    s1: 'lead', s2: 'survey', s3: 'contract',
    s4: 'design', s5: 'design',            /* “Triển khai hồ sơ” gộp vào bước thiết kế */
    s6: 'build', s7: 'handover'
  };
  function hasStage(id) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return true;
    return false;
  }
  function stageIndex(id) {
    for (var i = 0; i < STAGES.length; i++) if (STAGES[i].id === id) return i;
    return 0;
  }
  function stage(id) { return STAGES[stageIndex(id)]; }

  var STORES = {
    settings:   { keyPath: 'id' },
    employees:  { keyPath: 'id' },
    projects:   { keyPath: 'id' },
    categories: { keyPath: 'id' },
    reports:    { keyPath: 'id', indexes: [['date', 'date'], ['employeeId', 'employeeId'], ['status', 'status']] },
    images:     { keyPath: 'id', indexes: [['reportId', 'reportId']] }
  };

  function open() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var d = e.target.result;
        Object.keys(STORES).forEach(function (name) {
          if (d.objectStoreNames.contains(name)) return;
          var cfg = STORES[name];
          var os = d.createObjectStore(name, { keyPath: cfg.keyPath });
          (cfg.indexes || []).forEach(function (ix) { os.createIndex(ix[0], ix[1]); });
        });
      };
      req.onsuccess = function () { db = req.result; resolve(db); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function tx(name, mode) { return db.transaction(name, mode || 'readonly').objectStore(name); }

  function wrap(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function all(name)      { return wrap(tx(name).getAll()); }
  function get(name, id)  { return wrap(tx(name).get(id)); }
  function put(name, obj) { return wrap(tx(name, 'readwrite').put(obj)); }
  function del(name, id)  { return wrap(tx(name, 'readwrite').delete(id)); }

  function putMany(name, arr) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction(name, 'readwrite'), os = t.objectStore(name);
      arr.forEach(function (o) { os.put(o); });
      t.oncomplete = resolve; t.onerror = function () { reject(t.error); };
    });
  }

  function clearStore(name) { return wrap(tx(name, 'readwrite').clear()); }

  /* =========================================================
     Ảnh
     ========================================================= */
  function addImage(reportId, blob, w, h, name) {
    var rec = { id: U.uid('img'), reportId: reportId, blob: blob, w: w, h: h, name: name || '', size: blob.size, createdAt: Date.now() };
    return put('images', rec).then(function () { return rec; });
  }

  function imagesOf(reportId) {
    return new Promise(function (resolve, reject) {
      var req = tx('images').index('reportId').getAll(reportId);
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function deleteImagesOf(reportId) {
    return imagesOf(reportId).then(function (list) {
      return Promise.all(list.map(function (i) { return del('images', i.id); }));
    });
  }

  /* =========================================================
     Báo cáo
     ========================================================= */
  function saveReport(r) {
    r.updatedAt = Date.now();
    if (!r.id) { r.id = U.uid('rp'); r.createdAt = Date.now(); }
    return put('reports', r).then(function () { return r; });
  }

  function deleteReport(id) {
    return deleteImagesOf(id).then(function () { return del('reports', id); });
  }

  /* =========================================================
     Cài đặt
     ========================================================= */
  var DEFAULT_SETTINGS = {
    id: 'app',
    company: 'CÔNG TY THIẾT KẾ NỘI THẤT, KIẾN TRÚC VÀ XÂY DỰNG MT HOUSE',
    otRate: 1.5,
    standardDays: 22,
    hoursPerDay: 8,
    hcFrom: '07:30', hcTo: '17:30',
    lunchFrom: '12:00', lunchTo: '13:30',
    salaryMode: 'monthly', /* monthly: lương tháng + TC×hệ số · hourly: (HC + TC×hệ số) × đơn giá giờ */
    seedVersion: 0
  };

  function settings() {
    return get('settings', 'app').then(function (s) {
      if (!s) { s = Object.assign({}, DEFAULT_SETTINGS); return put('settings', s).then(function () { return s; }); }
      return Object.assign({}, DEFAULT_SETTINGS, s);
    });
  }

  /* =========================================================
     Tính lương
     ========================================================= */
  /**
   * Đơn giá giờ = Lương tháng ÷ (Số ngày công chuẩn × Số giờ/ngày).
   * Ví dụ 10.000.000 ÷ (22 × 8) = 56.818 VNĐ/giờ — khớp file Excel hiện tại.
   */
  function hourlyRate(emp, st) {
    var days = Number(emp.workDays || st.standardDays) || 22;
    var hpd = Number(st.hoursPerDay) || 8;
    return (Number(emp.salaryMonth) || 0) / (days * hpd);
  }

  /**
   * Lương tháng:
   *  · monthly (mặc định) = Lương cứng + Giờ TC × Đơn giá giờ × Hệ số TC
   *  · hourly             = (Giờ HC + Giờ TC × Hệ số TC) × Đơn giá giờ
   */
  function payroll(emp, st, hc, tc) {
    var rate = hourlyRate(emp, st);
    var otRate = Number(st.otRate) || 1.5;
    var otPay = tc * rate * otRate;
    if (st.salaryMode === 'hourly') {
      var basePay = hc * rate;
      return { rate: rate, otRate: otRate, base: basePay, ot: otPay, total: basePay + otPay, mode: 'hourly' };
    }
    var base = Number(emp.salaryMonth) || 0;
    return { rate: rate, otRate: otRate, base: base, ot: otPay, total: base + otPay, mode: 'monthly' };
  }
  var SEED_CATS = [
    { id: 'kt', name: 'Kiến trúc',  color: 'var(--series-1)', hex: '#EB6834', order: 1 },
    { id: 'nt', name: 'Nội thất',   color: 'var(--series-2)', hex: '#2A78D6', order: 2 },
    { id: 'tk', name: 'Triển khai', color: 'var(--series-3)', hex: '#1BAF7A', order: 3 }
  ];


  /**
   * Trạng thái ban đầu: chỉ một tài khoản quản lý và ba hạng mục công việc.
   * Không có dữ liệu mẫu — nhân viên, khách hàng và báo cáo do người dùng tự nhập.
   */
  var ADMIN_ACCOUNT = {
    id: 'admin',
    name: 'QUẢN LÝ MT HOUSE',
    position: 'Ban quản lý',
    role: 'admin',
    username: 'admin',
    password: '!Mthouse123',
    salaryMonth: 0,
    workDays: 22,
    active: true
  };

  function seed() {
    var st = Object.assign({}, DEFAULT_SETTINGS, {
      seededAt: Date.now(),
      isDemo: false,                 /* không phải dữ liệu mẫu → không bao giờ tự xoá */
      seedVersion: SEED_VERSION
    });

    return Promise.all([
      put('settings', st),
      putMany('employees', [Object.assign({}, ADMIN_ACCOUNT)]),
      putMany('categories', SEED_CATS)
    ]);
  }

  function resetAll() {
    return Promise.all(Object.keys(STORES).map(clearStore));
  }

  /* =========================================================
     Khởi tạo
     ========================================================= */
  /** Vá dữ liệu cũ khi nâng cấp: thêm tên đăng nhập, mật khẩu, giai đoạn công trình */
  function migrate() {
    return Promise.all([all('employees'), all('projects')]).then(function (r) {
      var used = {};
      var emps = r[0].map(function (e) {
        if (!e.password) e.password = e.pin || '123456';
        if (!e.username) {
          var parts = String(e.name || 'nv').trim().split(/\s+/);
          var base = (e.role === 'admin' ? 'admin' : parts[parts.length - 1] || 'nv')
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');
          var u = base, n = 1;
          while (used[u]) { u = base + (++n); }
          e.username = u;
        }
        used[e.username] = true;
        delete e.pin;
        return e;
      });
      var projs = r[1].map(function (p) {
        if (STAGE_ALIAS[p.stageId]) p.stageId = STAGE_ALIAS[p.stageId];
        if (!hasStage(p.stageId)) p.stageId = STAGES[0].id;
        if (p.followUp === undefined) p.followUp = null;
        if (p.noFollow === undefined) p.noFollow = false;
        if (p.closeReason === undefined) p.closeReason = '';
        /* Lịch sử liên hệ cũ gộp vào dòng thời gian ghi chú */
        if (!p.notes) {
          p.notes = (p.followUpLog || []).map(function (h) {
            return { id: 'nt_' + (h.doneAt || Date.now()), at: h.doneAt || Date.now(),
              by: h.doneBy || '', type: 'contact', text: h.note || '' };
          });
          delete p.followUpLog;
        }
        return p;
      });
      return Promise.all([putMany('employees', emps), putMany('projects', projs)]);
    });
  }

  /** Cơ sở dữ liệu chỉ chứa báo cáo của bản demo, chưa có dữ liệu thật nào */
  function onlyDemoData() {
    return all('reports').then(function (rows) {
      return rows.every(function (r) { return r.demo === true; });
    });
  }

  function ready() {
    return open().then(function () { return get('settings', 'app'); })
      .then(function (s) {
        if (!s) return seed();
        /* Máy còn dữ liệu mẫu của bản cũ → dọn sạch, dựng lại trạng thái ban đầu.
           Nếu người dùng đã nhập dữ liệu thật thì tuyệt đối không xoá, chỉ nâng cấp
           cấu trúc — thà giữ lại vài dòng mẫu còn hơn mất số liệu của công ty. */
        if (s.isDemo && s.seedVersion !== SEED_VERSION) {
          return onlyDemoData().then(function (safe) {
            return safe ? resetAll().then(seed) : migrate();
          });
        }
        return migrate();
      })
      .then(function () {
        return Promise.all([
          settings(), all('employees'), all('projects'), all('categories')
        ]);
      })
      .then(function (res) {
        return { settings: res[0], employees: res[1], projects: res[2], categories: res[3] };
      });
  }

  global.Store = {
    ready: ready, seed: seed, resetAll: resetAll,
    all: all, get: get, put: put, del: del, putMany: putMany, clear: clearStore,
    settings: settings, saveReport: saveReport, deleteReport: deleteReport,
    addImage: addImage, imagesOf: imagesOf, deleteImagesOf: deleteImagesOf,
    hourlyRate: hourlyRate, payroll: payroll,
    STAGES: STAGES, stage: stage, stageIndex: stageIndex,
    CLOSE_REASONS: CLOSE_REASONS, closeReason: closeReason,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS
  };
})(window);
