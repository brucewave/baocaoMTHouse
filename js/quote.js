/* =========================================================
   quote.js — Bảng báo giá chi tiết
   Dựng đúng bố cục file Excel của MT House: ba cấp hạng mục,
   cột đơn giá tách nhân công / vật tư, ô gộp kiểu Excel,
   ảnh dán thẳng bằng Ctrl+V, in ra A4 ngang.
   ========================================================= */
(function (global) {
  'use strict';

  /* Các cột được phép gộp ô, theo đúng thứ tự hiển thị */
  var MERGE_COLS = [
    { k: 'img',  label: 'Hình ảnh' },
    { k: 'n',    label: 'Hạng mục' },
    { k: 's',    label: 'Kích thước' },
    { k: 'm',    label: 'Mô tả chất liệu' },
    { k: 'u',    label: 'ĐVT' },
    { k: 'g',    label: 'Ghi chú' }
  ];

  var STATUS = {
    draft:    { label: 'Bản nháp',   cls: 'badge-pending',  icon: 'edit' },
    sent:     { label: 'Đã gửi',     cls: 'badge-approved', icon: 'send' },
    accepted: { label: 'Khách duyệt', cls: 'badge-approved', icon: 'checkCircle' },
    rejected: { label: 'Khách từ chối', cls: 'badge-rejected', icon: 'xCircle' }
  };

  /* Cầu nối sang app.js, gán khi khởi động */
  var A = null;
  function init(api) { A = api; }

  /* ---------------- tiện ích ---------------- */
  function money(v) {
    if (v == null || v === '') return '';
    return Number(v).toLocaleString('en-US');
  }
  function qtyText(v) {
    if (v == null || v === '') return '';
    return Number(v).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }
  function num(v) { var n = parseFloat(String(v).replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n; }

  /* ---------------- mô hình dữ liệu ---------------- */
  function blankRow() {
    return {
      id: U.uid('qr'),
      n: '', s: '', m: '', u: 'bộ', q: 1,
      nc: 0, vt: 0, priceOne: false,
      t: null, tManual: false,
      g: '',
      spans: { img: 1, n: 1, s: 1, m: 1, u: 1, g: 1 }
    };
  }

  function blankQuote(project) {
    var st = A.state.settings;
    return {
      id: '',
      code: 'MThouse_' + U.todayISO().replace(/-/g, ''),
      date: U.todayISO(),
      projectId: project ? project.id : '',
      customer: project ? (project.client || '') : '',
      projectName: project ? project.name : '',
      items: 'THI CÔNG HOÀN THIỆN NỘI THẤT',
      vat: 8,
      title: 'Hoàn thiện trang trí nội thất và trang trí décor',
      director: 'NGUYỄN PHƯƠNG VŨ',
      companyName: 'CÔNG TY TNHH KIẾN TRÚC VÀ XÂY DỰNG MTHOUSE',
      companyOffice: 'Office : 15, 24B, PHƯỜNG AN PHÚ, QUẬN 2, TP HCM',
      companyWeb: '[W] : http://mthouse.vn/ _ [FB] : Mthouse',
      groups: [{ id: U.uid('qg'), name: 'Phòng khách, bàn ăn và bếp', rows: [blankRow()] }],
      legend: [],
      gifts: [],
      notes: [
        'Chi phí sẽ được thay đổi điều chỉnh theo chất liệu hoàn thiện và theo phương án thiết kế hoàn thiện mong muốn của chủ đầu tư',
        'Khối lượng tính theo đơn vị md, m2 sẽ được kiểm tra đo đạc theo thực tế thi công hoàn thiện',
        'Đơn giá chỉ có thể thay đổi do biến động giá vật liệu và trang thiết bị điện nước (đơn giá chỉ có hiệu lực trong 15 ngày kể từ ngày báo giá)'
      ],
      status: 'draft',
      createdBy: A.state.user ? A.state.user.id : '',
      settingsCompany: st ? st.company : ''
    };
  }

  /** Thành tiền của một dòng: tự tính từ số lượng × đơn giá, trừ khi đã gõ tay */
  function rowAmount(r) {
    if (r.tManual) return r.t == null ? null : Number(r.t);
    var unit = r.priceOne ? num(r.vt) : (num(r.nc) + num(r.vt));
    return Math.round(num(r.q) * unit);
  }

  function compute(q) {
    var subs = (q.groups || []).map(function (g) {
      return (g.rows || []).reduce(function (s, r) { return s + (rowAmount(r) || 0); }, 0);
    });
    return { subs: subs, grand: subs.reduce(function (s, v) { return s + v; }, 0) };
  }

  /* ---------------- gộp ô ---------------- */
  /** Tìm dòng đang "làm chủ" ô gộp phủ lên dòng thứ i */
  function ownerOf(rows, i, col) {
    for (var j = i; j >= 0; j--) {
      var sp = rows[j].spans[col];
      if (sp === 0) continue;
      return (j + sp - 1 >= i) ? j : i;
    }
    return i;
  }

  function resetSpan(rows, i, col) {
    var o = ownerOf(rows, i, col);
    var sp = rows[o].spans[col] || 1;
    for (var k = o; k < o + sp && k < rows.length; k++) rows[k].spans[col] = 1;
  }

  function mergeCells(rows, idxs, col) {
    idxs = idxs.slice().sort(function (a, b) { return a - b; });
    idxs.forEach(function (i) { resetSpan(rows, i, col); });
    var first = idxs[0], last = idxs[idxs.length - 1];
    rows[first].spans[col] = last - first + 1;
    for (var k = first + 1; k <= last; k++) rows[k].spans[col] = 0;
  }

  /* =========================================================
     BẢN IN — dựng lại đúng bố cục file Excel
     ========================================================= */
  function sheetHtml(q, imgMap) {
    var c = compute(q);
    var esc = U.esc;
    var html = '';

    html +=
      '<div class="doc-head">' +
        '<div class="co"><h2>' + esc(q.companyName) + '</h2>' +
          '<p>' + esc(q.companyOffice) + '</p><p>' + esc(q.companyWeb) + '</p></div>' +
        '<div class="logo"><img src="' + A.assets + 'logo.png" alt="MT House"></div>' +
        '<div class="rt"><h3>BÁO GIÁ CHI TIẾT</h3>' +
          '<p>' + esc(q.code) + '</p>' +
          '<p>Ngày: <span>' + U.dateVN(q.date) + '</span></p></div>' +
      '</div>';

    html +=
      '<table class="qinfo"><tbody>' +
        '<tr><td>KHÁCH HÀNG/ Customer</td><td>' + esc(q.customer) + '</td></tr>' +
        '<tr><td>CÔNG TRÌNH/ Project</td><td>' + esc(q.projectName) + '</td></tr>' +
        '<tr><td>HẠNG MỤC/ Items</td><td>' + esc(q.items) + '</td></tr>' +
      '</tbody></table>';

    html +=
      '<table class="qtbl"><colgroup>' +
        '<col style="width:3.6%"><col style="width:18.5%"><col style="width:8.5%"><col style="width:11.5%">' +
        '<col style="width:20%"><col style="width:3.6%"><col style="width:5%">' +
        '<col style="width:6%"><col style="width:6%"><col style="width:8.4%"><col style="width:5.4%">' +
      '</colgroup><thead>' +
        '<tr><th class="stt" rowspan="2">STT</th><th rowspan="2">HẠNG MỤC</th>' +
        '<th rowspan="2">Kích thước</th><th rowspan="2">Mô tả chất liệu</th>' +
        '<th rowspan="2">HÌNH ẢNH</th><th rowspan="2">ĐVT</th><th rowspan="2">SỐ LƯỢNG</th>' +
        '<th colspan="2">ĐƠN GIÁ</th><th rowspan="2">THÀNH TIỀN</th><th rowspan="2">GHI CHÚ</th></tr>' +
        '<tr><th>nhân công</th><th>vật tư</th></tr>' +
      '</thead><tbody>';

    html +=
      '<tr class="lv1"><td class="stt">1</td><td colspan="8">' + esc(q.title) + '</td>' +
        '<td class="r">' + money(c.grand) + '</td><td></td></tr>';

    (q.groups || []).forEach(function (g, gi) {
      html +=
        '<tr class="lv2"><td class="c">1.' + (gi + 1) + '</td><td colspan="8">' + esc(g.name) + '</td>' +
          '<td class="r">' + money(c.subs[gi]) + '</td><td></td></tr>';

      (g.rows || []).forEach(function (r, ri) {
        var amt = rowAmount(r);
        function cell(col, cls, content) {
          var sp = r.spans[col];
          if (sp === 0) return '';
          return '<td class="' + cls + '"' + (sp > 1 ? ' rowspan="' + sp + '"' : '') + '>' + content + '</td>';
        }
        var imgs = (imgMap && imgMap[r.id]) || [];
        var imgHtml = imgs.length
          ? '<div class="qimgs">' + imgs.map(function (u) {
              return '<img src="' + u + '" alt="">';
            }).join('') + '</div>'
          : '';

        html += '<tr>' +
          '<td class="c">1.' + (gi + 1) + '.' + (ri + 1) + '</td>' +
          cell('n', 'multi', esc(r.n) + (r.spec ? '<span class="spec">' + esc(r.spec) + '</span>' : '')) +
          cell('s', 'b', esc(r.s || '')) +
          cell('m', 'b', esc(r.m || '')) +
          cell('img', 'c', imgHtml) +
          cell('u', 'c', esc(r.u || '')) +
          '<td class="c">' + qtyText(r.q) + '</td>' +
          (r.priceOne
            ? '<td class="c b" colspan="2">' + money(r.vt) + '</td>'
            : '<td class="r">' + (num(r.nc) ? money(r.nc) : '-') + '</td>' +
              '<td class="r">' + money(r.vt) + '</td>') +
          '<td class="r' + (amt == null ? ' pending' : '') + '">' + money(amt) + '</td>' +
          cell('g', 'c multi small', esc(r.g || '')) +
        '</tr>';
      });
    });

    html += '</tbody></table>';

    if ((q.legend || []).length) {
      html += '<div class="legend-title">Giải thích vật liệu nội thất và phụ kiện đã bao gồm báo giá</div>' +
        '<table class="qlegend"><tbody><tr>' +
          q.legend.map(function (l, i) {
            var u = imgMap && imgMap['legend:' + i] && imgMap['legend:' + i][0];
            return '<td style="width:' + (100 / q.legend.length) + '%">' +
              (u ? '<img src="' + u + '" alt="">' : '<div class="sw">ảnh vật liệu</div>') +
              esc(l.text || '') + '</td>';
          }).join('') +
        '</tr></tbody></table>';
    }

    html += '<table class="qsum"><tbody>' +
        '<tr class="total"><td>Thành tiền (chưa bao gồm ' + num(q.vat) + '% VAT)</td>' +
          '<td style="width:70px">VNĐ</td>' +
          '<td class="money" style="width:150px">' + money(c.grand) + '</td>' +
          '<td style="width:130px">đã làm tròn số</td></tr>' +
        ((q.gifts || []).length
          ? '<tr class="gift"><td class="c" style="width:44px">A</td><td colspan="3">Các hạng mục tặng kèm</td></tr>' +
            q.gifts.map(function (t, i) {
              return '<tr><td class="c">a' + (i + 1) + '</td><td colspan="3">' + esc(t) + '</td></tr>';
            }).join('')
          : '') +
      '</tbody></table>';

    if ((q.notes || []).length) {
      html += '<div class="qnote"><b>Ghi chú:</b><ul>' +
        q.notes.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></div>';
    }

    html += '<div class="qsign">' +
        '<div><b>' + esc(q.companyName) + '</b>' +
          '<div class="role">GIÁM ĐỐC/ DIRECTOR</div>' +
          '<div class="name">' + esc(q.director) + '</div></div>' +
        '<div><b>CHỦ ĐẦU TƯ/ CONFIRM BY OWNER</b>' +
          '<div class="role">&nbsp;</div>' +
          '<div class="name">' + esc(q.customer) + '</div></div>' +
      '</div>';

    return html;
  }

  /** Nạp toàn bộ ảnh của một báo giá thành bản đồ id dòng → danh sách URL */
  function loadImages(q) {
    var keys = [];
    (q.groups || []).forEach(function (g) {
      (g.rows || []).forEach(function (r) { keys.push(['q:' + r.id, r.id]); });
    });
    (q.legend || []).forEach(function (l, i) { keys.push(['q:legend:' + q.id + ':' + i, 'legend:' + i]); });

    return Promise.all(keys.map(function (k) {
      return Store.imagesOf(k[0]).then(function (list) { return [k[1], list]; });
    })).then(function (pairs) {
      var map = {};
      pairs.forEach(function (p) {
        if (p[1].length) map[p[0]] = p[1].map(function (im) { return A.urlOf(im.blob); });
      });
      return map;
    });
  }

  /* =========================================================
     MÀN HÌNH 1 — DANH SÁCH BÁO GIÁ
     ========================================================= */
  function viewList(main, params) {
    var S = A.state;
    var search = params.q || '';
    var list = (S.quotes || []).filter(function (q) {
      if (!search) return true;
      return U.noAccent(q.code + ' ' + q.customer + ' ' + q.projectName)
        .indexOf(U.noAccent(search)) >= 0;
    }).sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });

    main.innerHTML =
      '<div class="page-head">' +
        '<div><h2>Bảng báo giá</h2><p>' + list.length + ' bản báo giá</p></div>' +
        '<div class="grow"></div>' +
        '<button class="btn btn-primary" id="q-new">' + U.icon('plus') + ' Tạo báo giá</button>' +
      '</div>' +

      '<div class="filterbar">' +
        '<div class="field grow" style="min-width:200px"><label for="q-search">Tìm báo giá</label>' +
          '<input class="input" id="q-search" value="' + U.esc(search) + '" placeholder="Mã báo giá, khách hàng, công trình…"></div>' +
      '</div>' +

      '<div class="card"><div class="card-body flush">' +
        (list.length
          ? '<div class="table-scroll"><table class="tbl"><thead><tr>' +
              '<th>Mã báo giá</th><th>Khách hàng / Công trình</th><th class="c">Ngày</th>' +
              '<th class="n">Số hạng mục</th><th class="n">Thành tiền</th><th>Trạng thái</th><th></th>' +
            '</tr></thead><tbody>' +
              list.map(function (q) {
                var c = compute(q);
                var nRows = (q.groups || []).reduce(function (s, g) { return s + g.rows.length; }, 0);
                var st = STATUS[q.status] || STATUS.draft;
                return '<tr class="rowlink" data-open="' + q.id + '">' +
                  '<td class="num t-strong"><button class="row-open" type="button" data-open="' + q.id + '">' +
                    U.esc(q.code) + '</button></td>' +
                  '<td class="t-wrap"><b>' + U.esc(q.customer || '—') + '</b>' +
                    '<div class="t-muted" style="font-size:12.5px">' + U.esc(q.projectName || '') + '</div></td>' +
                  '<td class="c num">' + U.dateVN(q.date) + '</td>' +
                  '<td class="n">' + nRows + '</td>' +
                  '<td class="n t-strong">' + money(c.grand) + '</td>' +
                  '<td><span class="badge ' + st.cls + '">' + U.icon(st.icon) + st.label + '</span></td>' +
                  '<td class="n"><button class="btn btn-sm" data-print="' + q.id + '" ' +
                    'aria-label="Xem và in">' + U.icon('print') + '</button></td>' +
                '</tr>';
              }).join('') +
            '</tbody></table></div>'
          : '<div class="empty">' + U.icon('floorplan') + '<h3>Chưa có báo giá nào</h3>' +
            '<p>Tạo bản báo giá đầu tiên, hệ thống sẽ tự đánh số, cộng tổng theo khu vực và dựng bản in A4 ngang.</p></div>') +
      '</div></div>';

    U.$('#q-search', main).addEventListener('input', U.debounce(function (e) {
      A.setQ({ q: e.target.value });
    }, 350));
    U.$('#q-new', main).addEventListener('click', function () { newQuoteDialog(); });

    U.on(main, 'click', 'tr.rowlink', function (e, tr) {
      if (e.target.closest('button, a')) return;
      A.go('quote', { id: tr.getAttribute('data-open') });
    });
    U.on(main, 'click', '.row-open', function (e, b) {
      A.go('quote', { id: b.getAttribute('data-open') });
    });
    U.on(main, 'click', '[data-print]', function (e, b) {
      var q = findQuote(b.getAttribute('data-print'));
      if (q) openSheet(q);
    });
  }

  function findQuote(id) {
    return (A.state.quotes || []).filter(function (x) { return x.id === id; })[0];
  }

  /** Hộp thoại chọn khách hàng rồi tạo báo giá mới */
  function newQuoteDialog() {
    var S = A.state;
    var projects = S.projects.filter(function (p) { return p.active !== false; });
    var el = U.openOverlay('<div class="dialog">' +
      '<div class="dialog-head"><h3>Tạo báo giá mới</h3>' +
        '<button class="icon-btn" type="button" data-close aria-label="Đóng">' + U.icon('x') + '</button></div>' +
      '<div class="dialog-body">' +
        '<div class="field"><label for="nq-proj">Khách hàng / công trình <span class="req">*</span></label>' +
          '<select class="select" id="nq-proj"><option value="">— Chọn khách hàng —</option>' +
            projects.map(function (p) {
              return '<option value="' + p.id + '">' + U.esc(p.code + ' · ' + p.name) + '</option>';
            }).join('') +
          '</select>' +
          '<span class="help">Lấy từ danh sách ở mục Khách hàng. Báo giá sẽ gắn vào hồ sơ khách đó.</span></div>' +
        '<div class="field"><label for="nq-items">Hạng mục báo giá</label>' +
          '<input class="input" id="nq-items" value="THI CÔNG HOÀN THIỆN NỘI THẤT"></div>' +
        '<span class="err" id="nq-err" hidden></span>' +
      '</div>' +
      '<div class="dialog-foot"><button class="btn" type="button" data-close>Huỷ</button>' +
        '<button class="btn btn-primary" type="button" data-save>' + U.icon('check') + ' Tạo báo giá</button></div>' +
    '</div>');

    el.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-close]')) return U.closeOverlay();
      if (!ev.target.closest('[data-save]')) return;
      var pid = U.$('#nq-proj', el).value;
      if (!pid) {
        var errEl = U.$('#nq-err', el);
        errEl.innerHTML = U.icon('alert') + '<span>Vui lòng chọn khách hàng.</span>';
        errEl.hidden = false;
        return;
      }
      var p = A.proj(pid);
      var q = blankQuote(p);
      q.items = U.$('#nq-items', el).value.trim() || q.items;
      q.code = 'MThouse_' + (p.code || '') + '_' + U.todayISO().replace(/-/g, '');
      Store.saveQuote(q).then(function (saved) {
        U.closeOverlay();
        return A.reload().then(function () { A.go('quote', { id: saved.id }); });
      });
    });
  }

  /* =========================================================
     MÀN HÌNH 2 — SOẠN BÁO GIÁ
     ========================================================= */
  var sel = {};      /* id dòng đang chọn để gộp ô */
  var pasteTarget = null;

  function viewEdit(main, params) {
    var q = findQuote(params.id);
    if (!q) { A.go('quotes'); return; }
    sel = {};
    pasteTarget = null;

    /* Vẽ lại bảng nhưng KHÔNG gắn lại sự kiện — mọi handler đều uỷ quyền
       trên phần tử main, gắn đúng một lần ở dưới, nếu không mỗi lần vẽ lại
       sẽ chồng thêm một lớp listener và một cú bấm chạy nhiều lần. */
    var ctx = { main: main, q: q };
    ctx.redraw = function () {
      return countImages(q).then(function () { paint(main, q); });
    };
    bind(ctx);
    ctx.redraw();
    var redraw = ctx.redraw;

    /* Dán ảnh từ Snipping Tool: Ctrl+V vào dòng đang chọn */
    main._onPaste = function (e) {
      if (!e.clipboardData || !e.clipboardData.files || !e.clipboardData.files.length) return;
      var ids = Object.keys(sel);
      var rowId = pasteTarget || (ids.length === 1 ? ids[0] : null);
      if (!rowId) {
        U.toast('Hãy bấm vào ô ảnh của dòng cần dán trước, rồi Ctrl+V', 'err');
        return;
      }
      addImagesTo(rowId, e.clipboardData.files).then(redraw);
    };
    document.addEventListener('paste', main._onPaste);
  }

  function addImagesTo(rowId, files) {
    var imgs = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type); });
    if (!imgs.length) return Promise.resolve();
    return Promise.all(imgs.map(function (f) {
      return U.compressImage(f, 1400, 0.82).then(function (o) {
        return Store.addImage('q:' + rowId, o.blob, o.w, o.h, f.name || 'anh.jpg');
      }).catch(function () { return null; });
    })).then(function () {
      U.toast('Đã thêm ' + imgs.length + ' ảnh', 'ok');
    });
  }

  function paint(main, q) {
    var c = compute(q);
    var nSel = Object.keys(sel).length;

    main.innerHTML =
      '<div class="page-head">' +
        '<div><h2>Soạn báo giá</h2><p>' + U.esc(q.code) + ' · ' + U.esc(q.customer || '') + '</p></div>' +
        '<div class="grow"></div>' +
        '<a class="btn" href="#/quotes">' + U.icon('chevronL') + ' Danh sách</a>' +
        '<button class="btn" id="q-sheet">' + U.icon('print') + ' Xem &amp; In</button>' +
        '<button class="btn btn-primary" id="q-save">' + U.icon('check') + ' Lưu</button>' +
      '</div>' +

      /* --- thông tin chung --- */
      '<details class="block" id="q-info"><summary>Thông tin chung ' +
        '<span class="sub">' + U.esc(q.projectName || '') + '</span></summary>' +
        '<div class="block-body"><div class="field-row">' +
          fld('code', 'Mã báo giá', q.code) +
          fldDate('date', 'Ngày báo giá', q.date) +
          fld('customer', 'Khách hàng', q.customer) +
        '</div><div class="field-row">' +
          fld('projectName', 'Tên công trình', q.projectName) +
          fld('items', 'Hạng mục báo giá', q.items) +
          fldNum('vat', 'VAT (%)', q.vat) +
        '</div><div class="field-row">' +
          fld('title', 'Tiêu đề hàng cấp 1', q.title) +
          fld('director', 'Giám đốc ký tên', q.director) +
          fldSel('status', 'Trạng thái', q.status) +
        '</div></div></details>' +

      /* --- thanh gộp ô --- */
      '<div class="qbar' + (nSel ? ' on' : '') + '" id="q-mergebar">' +
        (nSel
          ? '<b>' + nSel + ' dòng đang chọn</b><span class="t-muted">Gộp ô:</span>' +
            MERGE_COLS.map(function (m) {
              return '<button class="btn btn-sm" data-merge="' + m.k + '">' + m.label + '</button>';
            }).join('') +
            '<button class="btn btn-sm btn-danger" data-unmerge>' + U.icon('x') + ' Bỏ gộp</button>' +
            '<div class="grow"></div>' +
            '<button class="btn btn-sm" data-clearsel>Bỏ chọn</button>'
          : '<span class="t-muted">' + U.icon('info') +
            ' Tích chọn nhiều dòng liền nhau để gộp ô như Excel. Bấm ô ảnh rồi Ctrl+V để dán ảnh chụp màn hình.</span>') +
      '</div>' +

      /* --- bảng hạng mục --- */
      '<div class="card"><div class="card-body flush">' +
        '<div class="table-scroll"><table class="tbl qedit">' +
          '<thead><tr>' +
            '<th style="width:34px"></th><th style="width:58px">STT</th>' +
            '<th style="min-width:200px">Hạng mục</th><th style="min-width:110px">Kích thước</th>' +
            '<th style="min-width:130px">Mô tả chất liệu</th><th style="width:96px">Ảnh</th>' +
            '<th style="width:70px">ĐVT</th><th style="width:74px" class="n">SL</th>' +
            '<th style="width:104px" class="n">Nhân công</th><th style="width:104px" class="n">Vật tư</th>' +
            '<th style="width:124px" class="n">Thành tiền</th><th style="min-width:110px">Ghi chú</th>' +
            '<th style="width:38px"></th>' +
          '</tr></thead><tbody>' +
            q.groups.map(function (g, gi) { return groupHtml(q, g, gi, c.subs[gi]); }).join('') +
          '</tbody>' +
          '<tfoot><tr><td colspan="10" style="text-align:right">TỔNG CỘNG</td>' +
            '<td class="n" id="q-grand">' + money(c.grand) + '</td><td colspan="2"></td></tr></tfoot>' +
        '</table></div>' +
        '<div class="btn-row" style="padding:12px 16px">' +
          '<button class="btn btn-sm" data-addgroup>' + U.icon('plus') + ' Thêm khu vực</button></div>' +
      '</div></div>' +

      /* --- phần phụ --- */
      '<details class="block"><summary>Vật liệu, tặng kèm và ghi chú ' +
        '<span class="sub">' + (q.legend || []).length + ' vật liệu · ' +
        (q.gifts || []).length + ' hạng mục tặng · ' + (q.notes || []).length + ' ghi chú</span></summary>' +
        '<div class="block-body">' +
          listEditor('legend', 'Giải thích vật liệu (hiện thành dải ảnh cuối bản báo giá)',
            (q.legend || []).map(function (l) { return l.text; })) +
          listEditor('gifts', 'Các hạng mục tặng kèm', q.gifts || []) +
          listEditor('notes', 'Ghi chú cuối bản báo giá', q.notes || []) +
        '</div></details>';
  }

  /* ---------- các mảnh HTML nhỏ ---------- */
  function fld(k, label, v) {
    return '<div class="field"><label for="qf-' + k + '">' + label + '</label>' +
      '<input class="input" id="qf-' + k + '" data-head="' + k + '" value="' + U.esc(v || '') + '"></div>';
  }
  function fldDate(k, label, v) {
    return '<div class="field"><label for="qf-' + k + '">' + label + '</label>' +
      '<input class="input" type="date" id="qf-' + k + '" data-head="' + k + '" value="' + U.esc(v || '') + '"></div>';
  }
  function fldNum(k, label, v) {
    return '<div class="field"><label for="qf-' + k + '">' + label + '</label>' +
      '<input class="input num" type="number" id="qf-' + k + '" data-head="' + k + '" value="' + (v || 0) + '"></div>';
  }
  function fldSel(k, label, v) {
    return '<div class="field"><label for="qf-' + k + '">' + label + '</label>' +
      '<select class="select" id="qf-' + k + '" data-head="' + k + '">' +
        Object.keys(STATUS).map(function (s) {
          return '<option value="' + s + '"' + (v === s ? ' selected' : '') + '>' + STATUS[s].label + '</option>';
        }).join('') +
      '</select></div>';
  }

  function listEditor(key, label, arr) {
    return '<div class="field"><span class="field-label">' + label + '</span>' +
      '<div class="qlist" data-list="' + key + '">' +
        arr.map(function (t, i) {
          return '<div class="qlist-row">' +
            '<input class="input" data-li="' + key + ':' + i + '" value="' + U.esc(t) + '">' +
            '<button class="btn btn-sm btn-danger" type="button" data-lidel="' + key + ':' + i + '" ' +
              'aria-label="Xoá dòng">' + U.icon('trash') + '</button></div>';
        }).join('') +
      '</div>' +
      '<div class="btn-row" style="margin-top:8px">' +
        '<button class="btn btn-sm" type="button" data-liadd="' + key + '">' + U.icon('plus') + ' Thêm dòng</button></div>' +
    '</div>';
  }

  function groupHtml(q, g, gi, sub) {
    var html =
      '<tr class="qgroup"><td></td><td class="c">1.' + (gi + 1) + '</td>' +
        '<td colspan="8"><input class="input input-flat" data-group="' + g.id + '" value="' + U.esc(g.name) + '" ' +
          'placeholder="Tên khu vực, ví dụ: Phòng ngủ Master"></td>' +
        '<td class="n">' + money(sub) + '</td>' +
        '<td></td>' +
        '<td class="n"><button class="btn btn-sm btn-danger" data-delgroup="' + g.id + '" ' +
          'aria-label="Xoá khu vực">' + U.icon('trash') + '</button></td></tr>';

    g.rows.forEach(function (r, ri) {
      var amt = rowAmount(r);
      var auto = r.tManual ? '' : ' readonly';
      html += '<tr data-row="' + r.id + '"' + (sel[r.id] ? ' class="picked"' : '') + '>' +
        '<td class="c"><input type="checkbox" data-pick="' + r.id + '"' + (sel[r.id] ? ' checked' : '') + '></td>' +
        '<td class="c num">1.' + (gi + 1) + '.' + (ri + 1) + '</td>' +
        cellIn(r, 'n', 'Tên hạng mục') +
        cellIn(r, 's', '') +
        cellIn(r, 'm', '') +
        cellImg(r) +
        cellIn(r, 'u', '') +
        '<td><input class="input input-flat num r" data-f="q" data-r="' + r.id + '" value="' + (r.q == null ? '' : r.q) + '"></td>' +
        (r.priceOne
          ? '<td colspan="2"><input class="input input-flat num r" data-f="vt" data-r="' + r.id + '" value="' + (r.vt || '') + '" ' +
            'placeholder="đơn giá trọn gói"></td>'
          : '<td><input class="input input-flat num r" data-f="nc" data-r="' + r.id + '" value="' + (r.nc || '') + '"></td>' +
            '<td><input class="input input-flat num r" data-f="vt" data-r="' + r.id + '" value="' + (r.vt || '') + '"></td>') +
        '<td class="qamount"><input class="input input-flat num r" data-f="t" data-r="' + r.id + '" ' +
          'value="' + (r.tManual ? (r.t == null ? '' : r.t) : money(amt)) + '"' + auto + '>' +
          '<button class="qlock" data-lock="' + r.id + '" type="button" title="' +
            (r.tManual ? 'Đang gõ tay, bấm để tự tính lại' : 'Đang tự tính, bấm để gõ tay') + '">' +
            U.icon(r.tManual ? 'edit' : 'refresh') + '</button></td>' +
        cellIn(r, 'g', '') +
        '<td class="c"><button class="btn btn-sm btn-ghost" data-rowmenu="' + r.id + '" ' +
          'aria-label="Thao tác dòng">' + U.icon('list') + '</button></td>' +
      '</tr>';
    });

    html += '<tr class="qadd"><td colspan="13">' +
      '<button class="btn btn-sm" data-addrow="' + g.id + '">' + U.icon('plus') + ' Thêm hạng mục</button></td></tr>';
    return html;
  }

  function cellIn(r, f, ph) {
    var sp = r.spans[f];
    if (sp === 0) return '';
    return '<td' + (sp > 1 ? ' rowspan="' + sp + '" class="merged"' : '') + '>' +
      '<input class="input input-flat" data-f="' + f + '" data-r="' + r.id + '" ' +
      'value="' + U.esc(r[f] == null ? '' : r[f]) + '"' + (ph ? ' placeholder="' + ph + '"' : '') + '></td>';
  }

  function cellImg(r) {
    var sp = r.spans.img;
    if (sp === 0) return '';
    var n = r.imgCount || 0;
    return '<td class="c' + (sp > 1 ? ' merged' : '') + '"' + (sp > 1 ? ' rowspan="' + sp + '"' : '') + '>' +
      '<button class="qimg-btn' + (pasteTarget === r.id ? ' aim' : '') + '" data-img="' + r.id + '" type="button">' +
        U.icon('image') + '<span>' + (n ? n + ' ảnh' : 'Thêm') + '</span></button></td>';
  }

  /* ---------- gắn sự kiện ---------- */
  function bind(ctx) {
    var main = ctx.main, q = ctx.q, redraw = ctx.redraw;
    function save(silent) {
      return Store.saveQuote(q).then(function () {
        if (!silent) U.toast('Đã lưu báo giá', 'ok');
        return A.reload();
      });
    }

    function rowById(id) {
      for (var i = 0; i < q.groups.length; i++) {
        var rows = q.groups[i].rows;
        for (var j = 0; j < rows.length; j++) if (rows[j].id === id) return { g: q.groups[i], r: rows[j], gi: i, ri: j };
      }
      return null;
    }

    /* --- gõ vào ô --- */
    main.addEventListener('input', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-head')) {
        q[t.getAttribute('data-head')] = t.type === 'number' ? num(t.value) : t.value;
        return;
      }
      if (t.hasAttribute('data-group')) {
        var gid = t.getAttribute('data-group');
        q.groups.forEach(function (g) { if (g.id === gid) g.name = t.value; });
        return;
      }
      if (t.hasAttribute('data-li')) {
        var p = t.getAttribute('data-li').split(':');
        if (p[0] === 'legend') q.legend[Number(p[1])].text = t.value;
        else q[p[0]][Number(p[1])] = t.value;
        return;
      }
      if (t.hasAttribute('data-f')) {
        var hit = rowById(t.getAttribute('data-r'));
        if (!hit) return;
        var f = t.getAttribute('data-f');
        if (f === 'q' || f === 'nc' || f === 'vt') hit.r[f] = num(t.value);
        else if (f === 't') { hit.r.tManual = true; hit.r.t = num(t.value); }
        else hit.r[f] = t.value;
        refreshTotals(main, q);
      }
    });

    main.addEventListener('change', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-head')) { q[t.getAttribute('data-head')] = t.value; }
      if (t.hasAttribute('data-pick')) {
        var id = t.getAttribute('data-pick');
        if (t.checked) sel[id] = true; else delete sel[id];
        redraw();
      }
    });

    /* --- các nút --- */
    U.on(main, 'click', '[data-addrow]', function (e, b) {
      var gid = b.getAttribute('data-addrow');
      q.groups.forEach(function (g) { if (g.id === gid) g.rows.push(blankRow()); });
      save(true).then(redraw);
    });
    U.on(main, 'click', '[data-addgroup]', function () {
      q.groups.push({ id: U.uid('qg'), name: 'Khu vực mới', rows: [blankRow()] });
      save(true).then(redraw);
    });
    U.on(main, 'click', '[data-delgroup]', function (e, b) {
      var gid = b.getAttribute('data-delgroup');
      U.confirmDialog({ title: 'Xoá khu vực',
        message: 'Xoá khu vực này cùng toàn bộ hạng mục bên trong?', okText: 'Xoá', danger: true })
        .then(function (ok) {
          if (!ok) return;
          q.groups = q.groups.filter(function (g) { return g.id !== gid; });
          return save(true).then(redraw);
        });
    });

    U.on(main, 'click', '[data-lock]', function (e, b) {
      var hit = rowById(b.getAttribute('data-lock'));
      if (!hit) return;
      hit.r.tManual = !hit.r.tManual;
      if (!hit.r.tManual) hit.r.t = null;
      redraw();
    });

    U.on(main, 'click', '[data-rowmenu]', function (e, b) { rowMenu(rowById(b.getAttribute('data-rowmenu')), q, save, redraw); });

    U.on(main, 'click', '[data-img]', function (e, b) {
      var id = b.getAttribute('data-img');
      pasteTarget = id;
      imageDialog(id, q, redraw);
    });

    /* --- gộp ô --- */
    U.on(main, 'click', '[data-merge]', function (e, b) { doMerge(b.getAttribute('data-merge')); });
    U.on(main, 'click', '[data-unmerge]', function () { doUnmerge(); });
    U.on(main, 'click', '[data-clearsel]', function () { sel = {}; redraw(); });

    function selectedIn() {
      var ids = Object.keys(sel);
      var found = null;
      for (var i = 0; i < q.groups.length; i++) {
        var idxs = [];
        q.groups[i].rows.forEach(function (r, j) { if (sel[r.id]) idxs.push(j); });
        if (!idxs.length) continue;
        if (found) return null;                       /* chọn vắt qua hai khu vực */
        found = { g: q.groups[i], idxs: idxs };
      }
      if (!found || found.idxs.length !== ids.length) return null;
      return found;
    }

    function doMerge(col) {
      var hit = selectedIn();
      if (!hit || hit.idxs.length < 2) {
        return U.toast('Hãy chọn ít nhất 2 dòng trong cùng một khu vực', 'err');
      }
      var a = hit.idxs[0], b2 = hit.idxs[hit.idxs.length - 1];
      if (b2 - a + 1 !== hit.idxs.length) {
        return U.toast('Chỉ gộp được các dòng nằm liền nhau', 'err');
      }
      mergeCells(hit.g.rows, hit.idxs, col);
      sel = {};
      save(true).then(redraw);
    }

    function doUnmerge() {
      var hit = selectedIn();
      if (!hit) return U.toast('Hãy chọn dòng trong cùng một khu vực', 'err');
      hit.idxs.forEach(function (i) {
        MERGE_COLS.forEach(function (m) { resetSpan(hit.g.rows, i, m.k); });
      });
      sel = {};
      save(true).then(redraw);
    }

    /* --- danh sách phụ --- */
    U.on(main, 'click', '[data-liadd]', function (e, b) {
      var k = b.getAttribute('data-liadd');
      if (k === 'legend') (q.legend = q.legend || []).push({ text: '' });
      else (q[k] = q[k] || []).push('');
      save(true).then(redraw);
    });
    U.on(main, 'click', '[data-lidel]', function (e, b) {
      var p = b.getAttribute('data-lidel').split(':');
      q[p[0]].splice(Number(p[1]), 1);
      save(true).then(redraw);
    });

    /* --- lưu & in --- */
    U.on(main, 'click', '#q-save', function () { save(); });
    U.on(main, 'click', '#q-sheet', function () { save(true).then(function () { openSheet(q); }); });
  }

  /** Đếm số ảnh mỗi dòng để hiện trên nút, chỉ vẽ lại khi có thay đổi */
  function countImages(q) {
    var rows = [];
    q.groups.forEach(function (g) { g.rows.forEach(function (r) { rows.push(r); }); });
    return Promise.all(rows.map(function (r) {
      return Store.imagesOf('q:' + r.id).then(function (l) { return [r, l.length]; });
    })).then(function (pairs) {
      var changed = false;
      pairs.forEach(function (p) {
        if ((p[0].imgCount || 0) !== p[1]) { p[0].imgCount = p[1]; changed = true; }
      });
      return changed;
    });
  }

  /* ---------- menu thao tác một dòng ---------- */
  function rowMenu(hit, q, save, redraw) {
    if (!hit) return;
    var r = hit.r;
    var el = U.openOverlay('<div class="dialog" style="max-width:420px">' +
      '<div class="dialog-head"><h3>Thao tác dòng</h3>' +
        '<button class="icon-btn" type="button" data-close aria-label="Đóng">' + U.icon('x') + '</button></div>' +
      '<div class="dialog-body"><div class="btn-row" style="flex-direction:column;align-items:stretch;gap:8px">' +
        '<button class="btn" data-act="one">' + U.icon('table') + ' ' +
          (r.priceOne ? 'Tách lại hai cột nhân công / vật tư' : 'Gộp đơn giá thành một ô (trọn gói)') + '</button>' +
        '<button class="btn" data-act="up">' + U.icon('chevronL') + ' Đưa lên trên</button>' +
        '<button class="btn" data-act="down">' + U.icon('chevronR') + ' Đưa xuống dưới</button>' +
        '<button class="btn" data-act="dup">' + U.icon('copy') + ' Nhân đôi dòng</button>' +
        '<button class="btn btn-danger" data-act="del">' + U.icon('trash') + ' Xoá dòng</button>' +
      '</div></div></div>');

    el.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-close]')) return U.closeOverlay();
      var b = ev.target.closest('[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act'), rows = hit.g.rows, i = hit.ri;

      if (act === 'one') r.priceOne = !r.priceOne;
      if (act === 'up' && i > 0) { rows.splice(i, 1); rows.splice(i - 1, 0, r); }
      if (act === 'down' && i < rows.length - 1) { rows.splice(i, 1); rows.splice(i + 1, 0, r); }
      if (act === 'dup') {
        var copy = JSON.parse(JSON.stringify(r));
        copy.id = U.uid('qr'); copy.imgCount = 0;
        copy.spans = { img: 1, n: 1, s: 1, m: 1, u: 1, g: 1 };
        rows.splice(i + 1, 0, copy);
      }
      if (act === 'del') {
        MERGE_COLS.forEach(function (m) { resetSpan(rows, i, m.k); });
        rows.splice(i, 1);
        if (!rows.length) rows.push(blankRow());
      }
      U.closeOverlay();
      save(true).then(redraw);
    });
  }

  /* ---------- hộp thoại ảnh, có dán Ctrl+V ---------- */
  function imageDialog(rowId, q, redraw) {
    var el = U.openOverlay('<div class="dialog">' +
      '<div class="dialog-head"><h3>Ảnh của hạng mục</h3>' +
        '<button class="icon-btn" type="button" data-close aria-label="Đóng">' + U.icon('x') + '</button></div>' +
      '<div class="dialog-body">' +
        '<div class="dropzone" id="qi-dz">' + U.icon('upload') +
          '<p><b>Chụp bằng Snipping Tool rồi bấm Ctrl+V vào đây</b><br>' +
          'hoặc kéo thả ảnh, hoặc chọn tệp</p>' +
          '<div class="btn-row" style="justify-content:center;margin-top:10px">' +
            '<button class="btn btn-sm" type="button" id="qi-pick">' + U.icon('image') + ' Chọn ảnh</button></div>' +
          '<input type="file" id="qi-file" accept="image/*" multiple hidden></div>' +
        '<div class="shots" id="qi-list" style="margin-top:14px"></div>' +
      '</div>' +
      '<div class="dialog-foot"><button class="btn btn-primary" type="button" data-close>Xong</button></div>' +
    '</div>');

    var listEl = U.$('#qi-list', el);

    function refresh() {
      return Store.imagesOf('q:' + rowId).then(function (list) {
        listEl.innerHTML = list.length
          ? list.map(function (im) {
              return '<div class="shot" style="cursor:default">' +
                '<img src="' + A.urlOf(im.blob) + '" alt="">' +
                '<button class="shot-del" type="button" data-del="' + im.id + '" ' +
                'aria-label="Gỡ ảnh">' + U.icon('x') + '</button></div>';
            }).join('')
          : '<p class="t-muted" style="font-size:13.5px">Chưa có ảnh nào.</p>';
      });
    }
    refresh();

    function take(files) {
      addImagesTo(rowId, files).then(refresh).then(redraw);
    }

    var dz = U.$('#qi-dz', el), fileEl = U.$('#qi-file', el);
    U.$('#qi-pick', el).addEventListener('click', function () { fileEl.click(); });
    fileEl.addEventListener('change', function () { take(fileEl.files); fileEl.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('over'); });
    });
    dz.addEventListener('drop', function (e) { if (e.dataTransfer) take(e.dataTransfer.files); });

    el.addEventListener('paste', function (e) {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length) {
        e.preventDefault();
        take(e.clipboardData.files);
      }
    });

    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) return U.closeOverlay();
      var d = e.target.closest('[data-del]');
      if (d) Store.del('images', d.getAttribute('data-del')).then(refresh).then(redraw);
    });

    setTimeout(function () { dz.focus && dz.focus(); }, 30);
  }

  /* ---------- cập nhật các ô tổng mà không vẽ lại cả bảng ---------- */
  function refreshTotals(main, q) {
    var c = compute(q);
    var g = U.$('#q-grand', main);
    if (g) g.textContent = money(c.grand);
    U.$$('tr.qgroup', main).forEach(function (tr, i) {
      var td = tr.children[tr.children.length - 3];
      if (td) td.textContent = money(c.subs[i]);
    });
    q.groups.forEach(function (grp) {
      grp.rows.forEach(function (r) {
        if (r.tManual) return;
        var inp = main.querySelector('input[data-f="t"][data-r="' + r.id + '"]');
        if (inp) inp.value = money(rowAmount(r));
      });
    });
  }

  /* ---------- xem và in ---------- */
  function openSheet(q) {
    loadImages(q).then(function (map) {
      var el = U.openOverlay(
        '<div class="fullscreen">' +
          '<div class="fs-bar">' +
            '<div><h3>' + U.esc(q.code) + '</h3>' +
              '<div class="sub">' + U.esc(q.customer || '') + ' · ' + U.esc(q.projectName || '') + '</div></div>' +
            '<div class="grow"></div>' +
            '<button class="btn" type="button" data-print>' + U.icon('print') + ' In / Lưu PDF</button>' +
            '<button class="icon-btn" type="button" data-close aria-label="Đóng">' + U.icon('x') + '</button>' +
          '</div>' +
          '<div class="fs-body qsheet-wrap"><div class="qsheet">' + sheetHtml(q, map) + '</div></div>' +
        '</div>', { bare: true });

      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-close]')) return U.closeOverlay();
        if (e.target.closest('[data-print]')) {
          document.body.classList.add('printing-quote');
          window.print();
          setTimeout(function () { document.body.classList.remove('printing-quote'); }, 500);
        }
      });
      el.querySelector('[data-close]').focus();
    });
  }

  global.Quote = {
    init: init,
    viewList: viewList,
    viewEdit: viewEdit,
    compute: compute,
    openSheet: openSheet,
    findQuote: findQuote,
    STATUS: STATUS
  };
})(window);
