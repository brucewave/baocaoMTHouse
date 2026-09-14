/* =========================================================
   store.js — lớp dữ liệu (IndexedDB) + dữ liệu mẫu
   Dữ liệu nằm trong trình duyệt của máy này. Xem README để
   biết cách chuyển sang máy chủ dùng chung cho cả công ty.
   ========================================================= */
(function (global) {
  'use strict';

  var DB_NAME = 'mthouse_report';
  var DB_VER = 1;
  var SEED_VERSION = 6;   /* tăng số này khi đổi cấu trúc dữ liệu mẫu */
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

  /* =========================================================
     DỮ LIỆU MẪU
     Tái dựng đúng hai file Excel: tổng 132 giờ HC, 30,75 giờ TC,
     lương 12.620.739 VNĐ cho nhân viên Võ Thị Huỳnh Như — T7/2026.
     ========================================================= */
  var SEED_PROJECTS = [
    ['CT01', 'LONG THÀNH - CHỊ NHUNG',        'Chị Nhung',  'Long Thành, Đồng Nai'],
    ['CT02', 'CHỊ QUYỀN - QUẬN 1',            'Chị Quyền',  'Quận 1, TP.HCM'],
    ['CT03', 'CHỊ HƯƠNG - ĐÀ LẠT',            'Chị Hương',  'Đà Lạt, Lâm Đồng'],
    ['CT04', 'CHỊ HẠNH - NHƠN TRẠCH',         'Chị Hạnh',   'Nhơn Trạch, Đồng Nai'],
    ['CT05', 'CHỊ DUNG - QUẬN 9',             'Chị Dung',   'TP. Thủ Đức, TP.HCM'],
    ['CT06', 'CHỊ NHUNG - TÂN PHÚ',           'Chị Nhung',  'Tân Phú, TP.HCM'],
    ['CT07', 'NHÀ TANG LỄ - G.XỨ THIÊN THẦN', 'Giáo xứ',    'TP.HCM'],
    ['CT08', 'KHÁCH SẠN ĐÀ LẠT - CHỊ HƯƠNG',  'Chị Hương',  'Đà Lạt, Lâm Đồng']
  ];

  /* Sinh thêm khách hàng cho đủ 50 hồ sơ — cố định, không ngẫu nhiên,
     để dữ liệu mẫu luôn giống nhau giữa các lần mở. */
  /* Tách tên nữ / nam để danh xưng “Chị / Anh” không bị ghép sai.
     Độ dài 23 là số nguyên tố nên nhân với 7 sẽ duyệt hết danh sách, không lặp sớm. */
  var GEN_FEMALE = ['THẢO', 'TRANG', 'LINH', 'PHƯỢNG', 'YẾN', 'LOAN', 'VÂN', 'HIỀN',
    'NGÂN', 'THUỶ', 'LAN', 'CHÂU', 'OANH', 'DIỄM', 'TÂM', 'NHÃ', 'XUÂN', 'THƯ',
    'CÚC', 'HẰNG', 'NGỌC', 'TUYẾT', 'KIM'];
  var GEN_MALE = ['TUẤN', 'HÙNG', 'MINH', 'NAM', 'THẮNG', 'KHANH', 'DUY', 'TÙNG',
    'SƠN', 'ĐẠT', 'PHÚC', 'KIỆT', 'THÀNH', 'TRÍ', 'HOÀNG', 'QUÂN', 'BÌNH', 'LỘC',
    'GIANG', 'HÀO', 'HUY', 'LONG', 'PHONG'];
  var GEN_PLACES = ['QUẬN 1', 'QUẬN 3', 'QUẬN 7', 'TÂN PHÚ', 'BÌNH THẠNH', 'GÒ VẤP',
    'PHÚ NHUẬN', 'THỦ ĐỨC', 'LONG THÀNH', 'NHƠN TRẠCH', 'BIÊN HOÀ', 'ĐÀ LẠT',
    'VŨNG TÀU', 'BÌNH DƯƠNG', 'CẦN THƠ', 'NHA TRANG', 'PHÚ MỸ HƯNG', 'AN PHÚ'];
  var GEN_TYPES = ['NHÀ PHỐ', 'BIỆT THỰ', 'CĂN HỘ', 'VĂN PHÒNG', 'SHOWROOM', 'NHÀ HÀNG',
    'QUÁN CAFÉ', 'KHÁCH SẠN'];
  var GEN_ADDR = {
    'QUẬN 1': 'Quận 1, TP.HCM', 'QUẬN 3': 'Quận 3, TP.HCM', 'QUẬN 7': 'Quận 7, TP.HCM',
    'TÂN PHÚ': 'Tân Phú, TP.HCM', 'BÌNH THẠNH': 'Bình Thạnh, TP.HCM', 'GÒ VẤP': 'Gò Vấp, TP.HCM',
    'PHÚ NHUẬN': 'Phú Nhuận, TP.HCM', 'THỦ ĐỨC': 'TP. Thủ Đức, TP.HCM',
    'LONG THÀNH': 'Long Thành, Đồng Nai', 'NHƠN TRẠCH': 'Nhơn Trạch, Đồng Nai',
    'BIÊN HOÀ': 'Biên Hoà, Đồng Nai', 'ĐÀ LẠT': 'Đà Lạt, Lâm Đồng',
    'VŨNG TÀU': 'Vũng Tàu, Bà Rịa - Vũng Tàu', 'BÌNH DƯƠNG': 'Thuận An, Bình Dương',
    'CẦN THƠ': 'Ninh Kiều, Cần Thơ', 'NHA TRANG': 'Nha Trang, Khánh Hoà',
    'PHÚ MỸ HƯNG': 'Phú Mỹ Hưng, Quận 7', 'AN PHÚ': 'An Phú, TP. Thủ Đức'
  };

  function titleCase(s) {
    return s.split(' ').map(function (w) {
      return w.charAt(0) + w.slice(1).toLowerCase();
    }).join(' ');
  }

  /* Lịch nhắc mẫu: lệch so với hôm nay, để thấy đủ các mức quá hạn / hôm nay / sắp tới */
  var FOLLOW_OFFSETS = [-9, -4, -1, 0, 0, 1, 2, 3, 5, 8, 14, 30, 60, 90];
  /* {x} thay bằng “chị” hoặc “anh” theo đúng khách hàng */
  var FOLLOW_NOTES = [
    ['call', '{X} xem lại phương án mặt bằng rồi báo lại, gọi hỏi kết quả.'],
    ['call', 'Gọi lại xác nhận {x} đã duyệt màu vật liệu chưa.'],
    ['meet', 'Hẹn gặp {x} tại công trình để chốt vị trí bếp và tủ áo.'],
    ['send', 'Gửi báo giá thi công phần nội thất gỗ cho {x} xem.'],
    ['call', '{X} đang cân nhắc ngân sách, vài hôm nữa gọi lại hỏi thêm.'],
    ['other', 'Nhắc lại sau khi {x} xây xong phần thô.'],
    ['call', '{X} hẹn 2–3 tháng nữa mới làm nội thất, nhắc lại đúng hẹn.'],
    ['send', 'Gửi hồ sơ kỹ thuật bản cập nhật cho bên thi công.'],
    ['meet', 'Hẹn nghiệm thu và bàn giao cùng {x}.']
  ];

  function buildFollowUp(i, today, client) {
    if (i % 3 === 0) return null;                       /* 1/3 hồ sơ chưa đặt nhắc */
    var male = /^anh\b/i.test(String(client || ''));
    var off = FOLLOW_OFFSETS[(i * 5 + 2) % FOLLOW_OFFSETS.length];
    var n = FOLLOW_NOTES[(i * 4 + 1) % FOLLOW_NOTES.length];
    var note = n[1]
      .replace(/\{X\}/g, male ? 'Anh' : 'Chị')
      .replace(/\{x\}/g, male ? 'anh' : 'chị');
    return { date: U.addDays(today, off), kind: n[0], note: note, createdAt: Date.now() };
  }

  var SEED_NOTES = [
    ['contact', 'Gọi lần đầu, {x} đang bận, hẹn gọi lại buổi chiều.'],
    ['note',    '{X} gửi ảnh hiện trạng và bản vẽ cũ qua Zalo, đã lưu vào hồ sơ.'],
    ['contact', '{X} xem phối cảnh rồi, muốn đổi màu tủ bếp sang vân gỗ sáng.'],
    ['note',    'Ngân sách {x} đưa ra khoảng 350 triệu cho phần nội thất.'],
    ['contact', 'Gọi 2 lần không nghe máy, nhắn Zalo chưa thấy trả lời.'],
    ['note',    '{X} ưng phong cách hiện đại, không thích màu tối.'],
    ['contact', '{X} nói cuối tháng mới quyết, đang so sánh với một bên nữa.']
  ];

  var SEED_CLOSE = ['junk', 'nodemand', 'budget', 'other_co'];
  var SEED_CLOSE_NOTE = {
    junk:     'Gọi 5 lần không ai nghe, nhắn Zalo cũng không phản hồi.',
    nodemand: 'Khách báo đã đổi ý, năm nay chưa làm nội thất nữa.',
    budget:   'Báo giá vượt ngân sách khách dự tính, khách xin dừng.',
    other_co: 'Khách đã chốt với một đơn vị khác có giá thấp hơn.'
  };

  function buildNotes(i, today, client) {
    var male = /^anh\b/i.test(String(client || ''));
    var n = i % 4;                                   /* 0–3 ghi chú mỗi hồ sơ */
    var out = [];
    for (var j = 0; j < n; j++) {
      var t = SEED_NOTES[(i * 3 + j * 2) % SEED_NOTES.length];
      out.push({
        id: 'nt_' + i + '_' + j,
        at: Date.now() - (j + 1) * 86400000 * (2 + (i % 5)),
        by: 'admin', type: t[0],
        text: t[1].replace(/\{X\}/g, male ? 'Anh' : 'Chị').replace(/\{x\}/g, male ? 'anh' : 'chị')
      });
    }
    return out;                                       /* mới nhất nằm đầu */
  }

  function buildProjects(total) {
    var today = U.todayISO();
    var out = SEED_PROJECTS.map(function (p, i) {
      return {
        id: p[0], code: p[0], name: p[1], client: p[2], address: p[3],
        phone: '09' + (10000000 + i * 1234567 % 89999999),
        stageId: STAGES[(i + 3) % STAGES.length].id,
        startDate: '2026-0' + (1 + i % 6) + '-1' + (i % 9),
        followUp: buildFollowUp(i, today, p[2]),
        notes: buildNotes(i, today, p[2]),
        noFollow: false, closeReason: '', active: true
      };
    });
    for (var i = out.length; i < total; i++) {
      var female = i % 2 === 0;
      var pool = female ? GEN_FEMALE : GEN_MALE;
      var title = female ? 'CHỊ' : 'ANH';
      var nm = pool[(i * 7 + 3) % pool.length];
      var place = GEN_PLACES[(i * 7) % GEN_PLACES.length];
      var type = GEN_TYPES[(i * 3) % GEN_TYPES.length];
      var useType = i % 3 === 0;
      var code = 'CT' + (i + 1 < 10 ? '0' : '') + (i + 1);
      var mo = 1 + (i % 9);
      var client = titleCase(title + ' ' + nm);
      var closed = i % 11 === 0;
      var reason = closed ? SEED_CLOSE[(i / 11 | 0) % SEED_CLOSE.length] : '';
      var notes = buildNotes(i, today, client);
      if (closed) {
        notes.unshift({
          id: 'nt_' + i + '_close', at: Date.now() - 86400000 * (3 + i % 7), by: 'admin',
          type: 'close', text: closeReason(reason).name + ' — ' + SEED_CLOSE_NOTE[reason]
        });
      }
      out.push({
        id: code, code: code,
        name: useType ? (type + ' - ' + title + ' ' + nm) : (title + ' ' + nm + ' - ' + place),
        client: client,
        address: GEN_ADDR[place] || place,
        phone: '09' + String(30000000 + i * 765431 % 69999999),
        /* hệ số 5 nguyên tố cùng nhau với 6 bước → hồ sơ rải đều khắp hành trình */
        stageId: STAGES[(i * 5 + 1) % STAGES.length].id,
        startDate: '2026-' + (mo < 10 ? '0' : '') + mo + '-' + (i % 27 + 1 < 10 ? '0' : '') + (i % 27 + 1),
        followUp: closed ? null : buildFollowUp(i, today, title),
        notes: notes,
        noFollow: closed || i % 9 === 0, /* hồ sơ đã đóng và vài hồ sơ khách chốt là không nhắc nữa */
        closeReason: reason,
        active: !closed
      });
    }
    return out;
  }

  var SEED_CATS = [
    { id: 'kt', name: 'Kiến trúc',  color: 'var(--series-1)', hex: '#EB6834', order: 1 },
    { id: 'nt', name: 'Nội thất',   color: 'var(--series-2)', hex: '#2A78D6', order: 2 },
    { id: 'tk', name: 'Triển khai', color: 'var(--series-3)', hex: '#1BAF7A', order: 3 }
  ];

  /* [ngày, mã CT, hạng mục, từ, đến, HC, TC, diễn giải, lý do] */
  var SEED_ROWS = [
    ['2026-07-01','CT03','kt','07:30','12:00',5,0,
      'Xem file phối cảnh, mặt bằng công năng và hồ sơ hiện trạng khách sạn Đà Lạt.',
      'Nắm ý tưởng thiết kế và yêu cầu chủ đầu tư trước khi triển khai hồ sơ.'],
    ['2026-07-01','CT01','nt','13:30','17:30',4,0,
      'Xem file phối cảnh, mặt bằng bố trí nội thất nhà Long Thành.',
      'Nắm ý tưởng thiết kế và yêu cầu chủ đầu tư trước khi triển khai hồ sơ.'],
    ['2026-07-02','CT01','tk','07:30','12:00',5,0,
      'Triển khai bản vẽ nội thất chi tiết thi công tầng 1 (Chị Nhung).',
      'Cung cấp bản vẽ thi công chi tiết cho xưởng gỗ sản xuất đúng tiến độ.'],
    ['2026-07-02','CT01','tk','13:30','17:30',4,0,
      'Triển khai bản vẽ nội thất chi tiết thi công tầng 2 (Chị Nhung).',
      'Cung cấp bản vẽ thi công chi tiết cho xưởng gỗ sản xuất đúng tiến độ.'],
    ['2026-07-03','CT05','kt','07:30','12:00',5,0,
      'Tham quan và khảo sát thực tế, đo vẽ hiện trạng công trình Quận 9.',
      'Thu thập thông số thực tế để điều chỉnh bản vẽ chính xác, tránh sai sót khi thi công.'],
    ['2026-07-03','CT01','tk','13:30','17:30',4,0,
      'Triển khai bản vẽ nội thất chi tiết thi công tầng 3 (Chị Nhung).',
      'Cung cấp bản vẽ thi công chi tiết cho xưởng gỗ sản xuất đúng tiến độ.'],
    ['2026-07-06','CT01','kt','07:30','12:00',5,0,
      'Khảo sát thực tế công trình, đối chiếu kích thước hiện trạng với bản vẽ.',
      'Thu thập thông số thực tế để điều chỉnh bản vẽ chính xác, tránh sai sót khi thi công.'],
    ['2026-07-06','CT01','tk','13:30','17:30',4,0,
      'Chỉnh sửa bản vẽ theo kích thước đo đạc thực tế sau khảo sát.',
      'Cung cấp bản vẽ thi công chi tiết cho xưởng gỗ sản xuất đúng tiến độ.'],
    ['2026-07-07','CT01','nt','07:30','12:00',6,0,
      'Tìm hiểu và bóc tách khối lượng vật tư, ván CNC cho hạng mục tủ bếp.',
      'Chuẩn bị hồ sơ báo giá thi công chính xác và kiểm soát chi phí sản xuất.'],
    ['2026-07-07','CT02','nt','13:30','17:30',4,0,
      'Thống kê sản phẩm, lựa chọn mẫu rèm và tranh canvas cho căn hộ Quận 1.',
      'Chốt mẫu thực tế với chủ nhà và gửi xưởng/đơn vị cung cấp sản xuất.'],
    ['2026-07-08','CT01','nt','07:30','12:00',5,0,
      'Bóc tách khối lượng vật liệu trần, tường và sàn toàn bộ công trình.',
      'Chuẩn bị hồ sơ báo giá thi công chính xác và kiểm soát chi phí sản xuất.'],
    ['2026-07-08','CT01','nt','13:30','17:30',5,0,
      'Thống kê toàn bộ vật tư hoàn thiện và thiết bị vệ sinh, phụ kiện.',
      'Chốt mẫu thực tế với chủ nhà và gửi xưởng/đơn vị cung cấp sản xuất.'],
    ['2026-07-09','CT06','kt','07:30','12:00',5,0,
      'Khảo sát, đo vẽ hiện trạng nhà phố Tân Phú.',
      'Thu thập thông số thực tế để điều chỉnh bản vẽ chính xác, tránh sai sót khi thi công.'],
    ['2026-07-09','CT01','tk','13:30','17:30',4,0,
      'Dàn trang layout, hoàn thiện HSTK và lập Mindmap rà soát hạng mục.',
      'Chuẩn bị đầy đủ hồ sơ bàn giao và kiểm soát quy trình thi công thực tế.'],
    ['2026-07-10','CT02','kt','13:30','17:30',4,0,
      'Vẽ HSTK mặt bằng và mặt cắt ban công căn hộ Quận 1.',
      'Đáp ứng yêu cầu cải tạo mặt tiền và phương án kết cấu mới của chủ nhà.'],
    ['2026-07-13','CT04','kt','08:00','17:30',8,1.5,
      'Bố trí mặt bằng chiếu sáng và phương án công năng công trình Nhơn Trạch.',
      'Tối ưu hoá không gian và hệ thống chiếu sáng cho công trình dịch vụ.'],
    ['2026-07-14','CT04','nt','08:00','17:30',8,16,
      'Học cách dựng và render 3D không gian phòng bếp, phòng ăn, phòng khách.',
      'Chủ đầu tư yêu cầu điều chỉnh vật liệu và màu sắc không gian sống.'],
    ['2026-07-15','CT03','nt','08:00','19:00',8,8.25,
      'Chỉnh sửa render phối cảnh phòng ngủ theo vật liệu và màu sắc mới.',
      'Chủ đầu tư yêu cầu điều chỉnh vật liệu và màu sắc không gian sống.'],
    ['2026-07-16','CT07','kt','07:30','16:30',8,0,
      'Khảo sát công trình nhà tang lễ, đo đạc và ghi nhận hiện trạng khu đất.',
      'Thu thập thông số thực tế để điều chỉnh bản vẽ chính xác, tránh sai sót khi thi công.'],
    ['2026-07-17','CT07','kt','07:30','16:30',8,0,
      'Bố trí mặt bằng công năng và phương án chiếu sáng nhà tang lễ.',
      'Tối ưu hoá không gian và hệ thống chiếu sáng cho công trình dịch vụ.'],
    ['2026-07-20','CT03','kt','07:30','17:30',8,0,
      'Bố trí mặt bằng đèn và phương án chiếu sáng khách sạn Đà Lạt.',
      'Tối ưu hoá không gian và hệ thống chiếu sáng cho công trình dịch vụ.'],
    ['2026-07-21','CT02','kt','10:00','17:30',7,1.5,
      'Khai triển mặt bằng lối vào và chi tiết bậc tam cấp căn hộ Quận 1.',
      'Đáp ứng yêu cầu cải tạo mặt tiền và phương án kết cấu mới của chủ nhà.'],
    ['2026-07-22','CT02','kt','07:30','23:00',8,3.5,
      'Khai triển tường xây mặt tiền và mặt cắt chi tiết ban công.',
      'Đáp ứng yêu cầu cải tạo mặt tiền và phương án kết cấu mới của chủ nhà.']
  ];

  /* =========================================================
     Sinh báo cáo cho toàn bộ nhân viên trong 3 tháng gần nhất.
     Mọi thứ đều tính theo chỉ số, không dùng Math.random, nên dữ liệu
     mẫu giống hệt nhau ở mọi máy — tiện khi đưa lên GitHub làm bản thử.
     ========================================================= */
  var WORK_DESCS = {
    kt: [
      ['Khảo sát hiện trạng và đo vẽ mặt bằng công trình.',
        'Thu thập thông số thực tế để bản vẽ khớp hiện trạng.'],
      ['Bố trí mặt bằng công năng tầng trệt theo yêu cầu chủ nhà.',
        'Tối ưu công năng và lối đi theo thói quen sinh hoạt của gia đình.'],
      ['Dựng mặt đứng và mặt cắt công trình.',
        'Chốt hình khối mặt tiền trước khi triển khai hồ sơ.'],
      ['Điều chỉnh mặt bằng theo góp ý của chủ đầu tư.',
        'Chủ đầu tư yêu cầu mở rộng khu bếp và đổi vị trí cầu thang.'],
      ['Bố trí hệ thống chiếu sáng và ổ cắm toàn nhà.',
        'Bảo đảm đủ sáng và thuận tiện sử dụng cho từng khu vực.'],
      ['Lập hồ sơ xin phép xây dựng.',
        'Chuẩn bị hồ sơ nộp cơ quan quản lý đúng hạn.'],
      ['Khai triển tường xây mặt tiền và chi tiết ban công.',
        'Đáp ứng yêu cầu cải tạo mặt tiền của chủ nhà.']
    ],
    nt: [
      ['Dựng mô hình 3D phòng khách và phòng bếp.',
        'Chủ đầu tư cần xem trước không gian trước khi chốt vật liệu.'],
      ['Render phối cảnh phòng ngủ master, chỉnh lại ánh sáng.',
        'Chủ đầu tư muốn xem thêm phương án ánh sáng buổi tối.'],
      ['Chọn vật liệu, mẫu gỗ và màu sơn cho toàn bộ căn.',
        'Chốt mẫu thực tế với chủ nhà trước khi đặt hàng.'],
      ['Bóc tách khối lượng ván CNC và phụ kiện tủ bếp.',
        'Chuẩn bị hồ sơ báo giá thi công chính xác.'],
      ['Thiết kế chi tiết tủ áo và vách trang trí phòng ngủ.',
        'Xưởng cần bản vẽ chi tiết để cắt CNC.'],
      ['Lựa chọn rèm, tranh và đèn trang trí hoàn thiện.',
        'Hoàn thiện tổng thể không gian theo phong cách đã chốt.'],
      ['Chỉnh sửa phối cảnh theo góp ý lần 2 của chủ nhà.',
        'Chủ nhà muốn đổi tông màu và vật liệu mặt bàn bếp.']
    ],
    tk: [
      ['Triển khai bản vẽ chi tiết thi công tầng trệt.',
        'Cung cấp bản vẽ cho đội thi công đúng tiến độ.'],
      ['Chỉnh sửa bản vẽ theo số đo thực tế sau khảo sát.',
        'Tránh sai lệch khi sản xuất và lắp đặt.'],
      ['Dàn trang và hoàn thiện hồ sơ thiết kế bàn giao.',
        'Chuẩn bị đủ hồ sơ bàn giao cho chủ đầu tư.'],
      ['Kiểm tra bản vẽ kết cấu, thống nhất với bên kết cấu.',
        'Bảo đảm kiến trúc và kết cấu khớp nhau trước khi thi công.'],
      ['Liên hệ xưởng gia công lan can và cửa nhôm.',
        'Tìm đơn vị gia công chất lượng với chi phí hợp lý.'],
      ['Giám sát thi công tại công trình, ghi nhận phát sinh.',
        'Kiểm soát chất lượng và xử lý phát sinh kịp thời.'],
      ['Thống kê vật tư và lập bảng khối lượng bàn giao.',
        'Làm cơ sở nghiệm thu và quyết toán với chủ đầu tư.']
    ]
  };

  /* [giờ vào, giờ ra, giờ HC, giờ TC] */
  var SLOTS_FULL = [
    ['07:30', '17:30', 8, 0],
    ['07:30', '16:30', 8, 0],
    ['08:00', '19:00', 8, 1.5],
    ['08:00', '20:30', 8, 3],
    ['07:30', '17:30', 8, 0]
  ];
  var SLOTS_HALF = [['07:30', '12:00', 5, 0], ['13:30', '17:30', 4, 0]];

  /* Hạng mục thường làm của từng vị trí */
  var EMP_CATS = {
    nv1: ['kt', 'nt', 'tk'], nv2: ['kt', 'tk'], nv3: ['nt', 'tk'],
    nv4: ['tk', 'kt'], nv5: ['nt']
  };

  var REJECT_NOTES = [
    'Số giờ tăng ca chưa khớp khung giờ, vui lòng kiểm tra lại.',
    'Diễn giải còn chung chung, ghi rõ hạng mục và tầng nào.',
    'Sai công trình, đây là hạng mục của công trình khác.'
  ];

  /** Ngày làm việc trong tháng, nghỉ Chủ nhật, không vượt quá hôm nay */
  function workDaysOf(month, today) {
    return U.daysOfMonth(month).filter(function (d) {
      return d <= today && U.parseISO(d).getDay() !== 0;
    });
  }

  function buildReports(projects, today) {
    var pool = projects.filter(function (p) { return p.active !== false; });
    var hot = pool.slice(0, Math.min(pool.length, 18));   /* gom việc vào ~18 công trình cho biểu đồ có ý nghĩa */
    var now = Date.now();
    var out = [];

    /* 1. Tháng 7/2026 của Võ Thị Huỳnh Như — giữ nguyên từng dòng để tổng
          vẫn đúng 132 giờ HC / 30,75 giờ TC / 12.620.739 VNĐ như file Excel. */
    SEED_ROWS.forEach(function (r, i) {
      out.push({
        id: 'rp_x_' + U.pad(i + 1), employeeId: 'nv1',
        date: r[0], projectId: r[1], categoryId: r[2],
        timeFrom: r[3], timeTo: r[4], hc: r[5], tc: r[6],
        description: r[7], reason: r[8],
        status: 'approved', reviewNote: '', reviewedBy: 'admin', reviewedAt: now,
        createdAt: now - (SEED_ROWS.length - i) * 3600000, updatedAt: now,
        imageCount: 0, demo: true
      });
    });

    /* 2. Ba tháng gần nhất cho cả 5 nhân viên */
    var months = [U.monthISO(U.addMonths(today, -2)), U.monthISO(U.addMonths(today, -1)), U.monthISO(today)];
    var n = 0;

    Object.keys(EMP_CATS).forEach(function (empId, ei) {
      months.forEach(function (m, mi) {
        if (empId === 'nv1' && m === '2026-07') return;   /* không đụng vào khối cố định */
        workDaysOf(m, today).forEach(function (d, di) {
          var seed = ei * 31 + di * 7 + mi * 13 + ei * di;
          var mode = seed % 10;
          if (mode < 2) return;                            /* ngày nghỉ / không có báo cáo */
          var slots = mode < 6 ? [SLOTS_FULL[seed % SLOTS_FULL.length]] : SLOTS_HALF;
          var age = U.diffDays(d, today);

          slots.forEach(function (s, si) {
            n++;
            var cats = EMP_CATS[empId];
            var catId = cats[(seed + si) % cats.length];
            var w = WORK_DESCS[catId][(seed * 3 + si * 5) % WORK_DESCS[catId].length];
            var p = hot[(seed * 5 + si * 11 + ei) % hot.length];

            var status = age >= 5 ? 'approved' : ((seed + si) % 3 === 0 ? 'approved' : 'pending');
            if (age < 12 && n % 41 === 0) status = 'rejected';

            out.push({
              id: 'rp_g_' + U.pad(n), employeeId: empId,
              date: d, projectId: p.id, categoryId: catId,
              timeFrom: s[0], timeTo: s[1], hc: s[2], tc: s[3],
              description: w[0], reason: w[1],
              status: status,
              reviewNote: status === 'rejected' ? REJECT_NOTES[n % REJECT_NOTES.length] : '',
              reviewedBy: status === 'pending' ? '' : 'admin',
              reviewedAt: status === 'pending' ? 0 : now,
              createdAt: now - age * 86400000, updatedAt: now,
              imageCount: 0, demo: true
            });
          });
        });
      });
    });

    return out;
  }

  /** Ảnh minh hoạ cho dữ liệu mẫu — vẽ bằng canvas, ghi rõ là ảnh mẫu. */
  function makePlaceholder(title, sub) {
    return new Promise(function (resolve) {
      var w = 1280, h = 800;
      var cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      var c = cv.getContext('2d');

      var g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#4C4C4C'); g.addColorStop(1, '#2E2E2E');
      c.fillStyle = g; c.fillRect(0, 0, w, h);

      c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = 1;
      for (var x = 0; x < w; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      for (var y = 0; y < h; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }

      c.strokeStyle = 'rgba(255,255,255,.34)'; c.lineWidth = 3;
      c.beginPath();
      c.moveTo(300, 620); c.lineTo(300, 300); c.lineTo(640, 180); c.lineTo(980, 300); c.lineTo(980, 620);
      c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(560, 620); c.lineTo(560, 430); c.lineTo(720, 430); c.lineTo(720, 620); c.stroke();
      c.beginPath(); c.moveTo(240, 620); c.lineTo(1040, 620); c.stroke();

      c.fillStyle = '#FFFFFF';
      c.font = '600 40px "Segoe UI", system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillText(title, w / 2, 700);
      c.fillStyle = 'rgba(255,255,255,.62)';
      c.font = '400 24px "Segoe UI", system-ui, sans-serif';
      c.fillText(sub, w / 2, 742);

      c.fillStyle = 'rgba(237,106,31,.92)';
      c.fillRect(0, 0, 330, 48);
      c.fillStyle = '#FFFFFF';
      c.font = '700 19px "Segoe UI", system-ui, sans-serif';
      c.textAlign = 'left';
      c.fillText('ẢNH MINH HOẠ · DỮ LIỆU MẪU', 18, 32);

      cv.toBlob(function (b) { resolve({ blob: b, w: w, h: h }); }, 'image/jpeg', 0.8);
    });
  }

  function seed() {
    var st = Object.assign({}, DEFAULT_SETTINGS,
      { seededAt: Date.now(), isDemo: true, seedVersion: SEED_VERSION });

    var employees = [
      { id: 'admin', name: 'QUẢN LÝ MT HOUSE', position: 'Ban quản lý', role: 'admin',
        username: 'admin', password: 'admin123', salaryMonth: 0, workDays: 22, active: true },
      { id: 'nv1', name: 'VÕ THỊ HUỲNH NHƯ', position: 'Kiến trúc sư', role: 'staff',
        username: 'nhu', password: '123456', salaryMonth: 10000000, workDays: 22, active: true },
      { id: 'nv2', name: 'TRẦN MINH KHOA', position: 'Hoạ viên kiến trúc', role: 'staff',
        username: 'khoa', password: '123456', salaryMonth: 9000000, workDays: 22, active: true },
      { id: 'nv3', name: 'NGUYỄN THỊ THU HÀ', position: 'Thiết kế nội thất', role: 'staff',
        username: 'ha', password: '123456', salaryMonth: 11000000, workDays: 22, active: true },
      { id: 'nv4', name: 'LÊ QUỐC BẢO', position: 'Kỹ sư triển khai', role: 'staff',
        username: 'bao', password: '123456', salaryMonth: 9500000, workDays: 22, active: true },
      { id: 'nv5', name: 'PHẠM NGỌC MAI', position: 'Diễn hoạ 3D', role: 'staff',
        username: 'mai', password: '123456', salaryMonth: 10500000, workDays: 22, active: true }
    ];

    var today = U.todayISO();
    var projects = buildProjects(50);
    var reports = buildReports(projects, today);

    return Promise.all([
      put('settings', st),
      putMany('employees', employees),
      putMany('projects', projects),
      putMany('categories', SEED_CATS),
      putMany('reports', reports)
    ]).then(function () {
      /* Gắn ảnh minh hoạ vào vài báo cáo nội thất gần đây để thấy bố cục ảnh */
      var withImg = reports.filter(function (r) {
        return r.categoryId === 'nt' && U.diffDays(r.date, today) <= 30;
      }).slice(0, 6);

      var captions = [
        'Phối cảnh 3D phòng khách', 'Phối cảnh 3D phòng ngủ',
        'Phương án vật liệu mặt bàn', 'Mặt bằng bố trí nội thất',
        'Chi tiết tủ bếp', 'Phối cảnh phòng ăn'
      ];

      return Promise.all(withImg.map(function (r, i) {
        return makePlaceholder(captions[i % captions.length],
          (projects.filter(function (p) { return p.id === r.projectId; })[0] || {}).name || '')
          .then(function (im) {
            return addImage(r.id, im.blob, im.w, im.h, captions[i % captions.length] + '.jpg');
          });
      })).then(function () {
        return Promise.all(withImg.map(function (r) {
          return get('reports', r.id).then(function (rec) {
            if (!rec) return; rec.imageCount = 1; return put('reports', rec);
          });
        }));
      });
    });
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

  function ready() {
    return open().then(function () { return get('settings', 'app'); })
      .then(function (s) {
        if (!s) return seed();
        /* Dữ liệu vẫn là bản mẫu nhưng đã cũ → dựng lại cho khớp cấu trúc mới */
        if (s.isDemo && s.seedVersion !== SEED_VERSION) {
          return resetAll().then(seed);
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
