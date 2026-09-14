/* =========================================================
   utils.js — tiện ích dùng chung
   Không dùng ES module để mở trực tiếp bằng file:// vẫn chạy.
   ========================================================= */
(function (global) {
  'use strict';

  /* ---------- DOM ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function frag(html) {
    var t = document.createElement('template');
    t.innerHTML = String(html).trim();
    return t.content;
  }

  function on(root, evt, sel, fn) {
    root.addEventListener(evt, function (e) {
      var t = e.target.closest(sel);
      if (t && root.contains(t)) fn(e, t);
    });
  }

  /* ---------- Số & tiền ---------- */
  var nfVN = new Intl.NumberFormat('vi-VN');

  function num(v, dec) {
    var n = Number(v) || 0;
    if (dec == null) dec = 1;
    return n.toLocaleString('vi-VN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function hours(v) {
    var n = Math.round((Number(v) || 0) * 100) / 100;
    return n.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  }
  function vnd(v) { return nfVN.format(Math.round(Number(v) || 0)) + ' VNĐ'; }
  function pct(part, total) {
    if (!total) return '0,0%';
    return num((Number(part) / Number(total)) * 100, 1) + '%';
  }
  function round2(v) { return Math.round((Number(v) || 0) * 100) / 100; }

  /* ---------- Ngày tháng ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function monthISO(iso) { return (iso || todayISO()).slice(0, 7); }

  function parseISO(iso) {
    var p = String(iso || '').split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2] || 1));
  }

  /** Thứ trong tuần kiểu Việt Nam: CN, T2 … T7 */
  function weekdayVN(iso) {
    var d = parseISO(iso).getDay();
    return d === 0 ? 'CN' : 'T' + (d + 1);
  }
  function isWeekend(iso) { return parseISO(iso).getDay() === 0; }

  /** "2026-07-27" → "27/07" */
  function dayShort(iso) { var p = String(iso).split('-'); return p[2] + '/' + p[1]; }
  /** "2026-07-27" → "27/07/2026" */
  function dateVN(iso) { var p = String(iso).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  /** Dấu thời gian → "14/09/2026 · 15:42" */
  function dateTimeVN(ts) {
    var d = new Date(Number(ts) || Date.now());
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() +
      ' · ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /** "2026-07" → "Tháng 07/2026" */
  function monthVN(m) { var p = String(m).split('-'); return 'Tháng ' + p[1] + '/' + p[0]; }

  function daysOfMonth(m) {
    var p = String(m).split('-'), y = Number(p[0]), mo = Number(p[1]);
    var last = new Date(y, mo, 0).getDate(), out = [];
    for (var d = 1; d <= last; d++) out.push(y + '-' + pad(mo) + '-' + pad(d));
    return out;
  }

  function addDays(iso, n) {
    var d = parseISO(iso); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /** Cộng tháng, kẹp lại ngày cuối tháng (31/01 + 1 tháng → 28/02) */
  function addMonths(iso, n) {
    var d = parseISO(iso), day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /** Số ngày từ a đến b (b - a). Dương = b ở tương lai. */
  function diffDays(a, b) {
    return Math.round((parseISO(b) - parseISO(a)) / 86400000);
  }

  function shiftMonth(m, delta) {
    var p = String(m).split('-'), d = new Date(Number(p[0]), Number(p[1]) - 1 + delta, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  /* ---------- Giờ ---------- */
  /** "07:30" → phút kể từ 0h */
  function toMin(hhmm) {
    var p = String(hhmm || '').split(':');
    if (p.length < 2) return null;
    return Number(p[0]) * 60 + Number(p[1]);
  }
  /** "07:30" → "7h30"  ·  "12:00" → "12h" (định dạng quen thuộc trong file Excel) */
  function hhmmVN(hhmm) {
    var p = String(hhmm || '').split(':');
    if (p.length < 2) return '';
    var h = Number(p[0]), m = Number(p[1]);
    return m === 0 ? h + 'h' : h + 'h' + pad(m);
  }
  function rangeVN(from, to) {
    if (!from || !to) return '';
    return hhmmVN(from) + ' - ' + hhmmVN(to);
  }

  /**
   * Gợi ý tách giờ hành chính / tăng ca từ khung giờ làm.
   * Ca hành chính mặc định 07:30–17:30, nghỉ trưa 12:00–13:30.
   * Phần nằm ngoài ca hành chính (hoặc làm ngày Chủ nhật) tính là tăng ca.
   */
  function splitHours(from, to, opt) {
    opt = opt || {};
    var f = toMin(from), t = toMin(to);
    if (f == null || t == null) return null;
    if (t <= f) t += 24 * 60; // qua đêm
    var hcFrom = toMin(opt.hcFrom || '07:30');
    var hcTo   = toMin(opt.hcTo   || '17:30');
    var luFrom = toMin(opt.lunchFrom || '12:00');
    var luTo   = toMin(opt.lunchTo   || '13:30');

    var total = t - f;
    if (opt.weekend) return { hc: 0, tc: round2(total / 60) };

    var hc = Math.max(0, Math.min(t, hcTo) - Math.max(f, hcFrom));
    var lunch = Math.max(0, Math.min(t, luTo) - Math.max(f, luFrom));
    hc = Math.max(0, hc - lunch);
    var tc = Math.max(0, total - lunch - hc);
    return { hc: round2(hc / 60), tc: round2(tc / 60) };
  }

  /* ---------- Khác ---------- */
  function uid(prefix) {
    return (prefix || 'id') + '_' +
      Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function debounce(fn, ms) {
    var h; return function () {
      var a = arguments, c = this;
      clearTimeout(h); h = setTimeout(function () { fn.apply(c, a); }, ms || 200);
    };
  }

  /** Bỏ dấu tiếng Việt để tìm kiếm */
  function noAccent(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }

  /* ---------- Icon (SVG nội tuyến, không dùng emoji) ---------- */
  var ICON_PATHS = {
    send:     '<path d="M4 12h10M4 12l-1 7 18-7L3 5l1 7Z"/>',
    list:     '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    table:    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11M15 9v11"/>',
    chart:    '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.6 1.6 0 0 0 15 19.4a1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.6 1.6 0 0 0 9 4.6h.08A1.6 1.6 0 0 0 10 3.13V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.6 1.6 0 0 0 19.4 9v.08a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
    check:    '<path d="m4.5 12.5 5 5 10-11"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.5 2.5L16 9"/>',
    clock:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
    x:        '<path d="M6 6l12 12M18 6 6 18"/>',
    xCircle:  '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    alert:    '<path d="M12 3.5 1.8 20.5h20.4L12 3.5Z"/><path d="M12 10v4.2M12 17.4h.01"/>',
    info:     '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    edit:     '<path d="M12.5 5.5 18 11 8.5 20.5 3 21l.5-5.5 9-10Z"/><path d="m15.5 2.5 3 3"/>',
    trash:    '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
    plus:     '<path d="M12 5v14M5 12h14"/>',
    image:    '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="10" r="1.8"/><path d="m3.5 17 5-5 4.5 4.5 3-2.5 4.5 4"/>',
    upload:   '<path d="M12 16V4M8 8l4-4 4 4"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
    zoom:     '<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4M8.5 11h5M11 8.5v5"/>',
    print:    '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    download: '<path d="M12 4v12M8 12l4 4 4-4"/><path d="M4 18v1.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V18"/>',
    logout:   '<path d="M14 8V5.5A1.5 1.5 0 0 0 12.5 4h-7A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20h7a1.5 1.5 0 0 0 1.5-1.5V16"/><path d="M9 12h11M17 9l3 3-3 3"/>',
    user:     '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    users:    '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.2a3.4 3.4 0 0 1 0 5.6M17.5 14.6A6.5 6.5 0 0 1 21.5 20"/>',
    building: '<path d="M4 21V4.5A1.5 1.5 0 0 1 5.5 3h8A1.5 1.5 0 0 1 15 4.5V21"/><path d="M15 10h3.5A1.5 1.5 0 0 1 20 11.5V21M2 21h20M7.5 7h4M7.5 11h4M7.5 15h4"/>',
    inbox:    '<path d="M3 13h4l2 3h6l2-3h4"/><path d="M5.5 5h13l2.5 8v5.5A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5V13l2.5-8Z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    money:    '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/>',
    chevronL: '<path d="m14 6-6 6 6 6"/>',
    chevronR: '<path d="m10 6 6 6-6 6"/>',
    filter:   '<path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/>',
    copy:     '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    refresh:  '<path d="M20 11a8 8 0 1 0-.6 4"/><path d="M20 4v7h-7"/>',
    phone:    '<path d="M7 3.5h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 5 5.7 2 2 0 0 1 7 3.5Z"/>',
    bell:     '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9Z"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/>',
    bellOff:  '<path d="M8.6 3.9A6 6 0 0 1 18 9c0 2.2.4 3.7.9 4.7M17 17H4s2-1.5 2-6.5c0-.7.1-1.4.3-2"/><path d="M10.3 20a2 2 0 0 0 3.4 0M3 3l18 18"/>',
    handshake:'<path d="m11 6 3.5-1.5L21 9v6l-3 2-4-3.5"/><path d="M13 7.5 9.5 5 3 9v6l3 2 3.5-3"/><path d="m9.5 12 2.5 2 2-1.5"/>',
    /* Mặt bằng đơn giản: tường, vách ngăn, cánh cửa mở và ô cửa sổ */
    floorplan:'<path d="M2.5 3.5h19v17h-19z"/><path d="M2.5 12.5h6M9.5 3.5v9M9.5 12.5h12M14.5 12.5v8"/><path d="M18.5 20.5a4 4 0 0 0-4-4"/><path d="M13.5 3.5h4"/>',
    ruler:    '<path d="M3 8.5h18v7H3z"/><path d="M7 8.5v3M11 8.5v4M15 8.5v3M19 8.5v4"/>'
  };

  function icon(name, cls) {
    var p = ICON_PATHS[name];
    if (!p) return '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' +
      (cls ? ' class="' + cls + '"' : '') + '>' + p + '</svg>';
  }

  /* ---------- Toast ---------- */
  function toast(msg, kind) {
    var wrap = document.getElementById('toast');
    if (!wrap) return;
    var ic = kind === 'err' ? 'alert' : kind === 'ok' ? 'checkCircle' : 'info';
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.innerHTML = icon(ic) + '<span>' + esc(msg) + '</span>';
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0'; el.style.transform = 'translateY(8px)';
      setTimeout(function () { el.remove(); }, 260);
    }, kind === 'err' ? 4200 : 2600);
  }

  /* ---------- Hộp thoại ---------- */
  var overlayStack = [];

  function closeOverlay() {
    var top = overlayStack.pop();
    if (!top) return;
    top.el.remove();
    document.body.style.overflow = overlayStack.length ? 'hidden' : '';
    if (top.prevFocus && top.prevFocus.focus) top.prevFocus.focus();
  }

  function openOverlay(html, opts) {
    opts = opts || {};
    var prevFocus = document.activeElement;
    var el = document.createElement('div');
    el.className = opts.bare ? '' : 'backdrop';
    el.innerHTML = html;
    if (!opts.bare) {
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.addEventListener('mousedown', function (e) {
        if (e.target === el && opts.dismissable !== false) closeOverlay();
      });
    }
    document.getElementById('overlay-root').appendChild(el);
    document.body.style.overflow = 'hidden';
    overlayStack.push({ el: el, prevFocus: prevFocus });

    var first = el.querySelector('[autofocus], input, select, textarea, button');
    if (first) setTimeout(function () { first.focus(); }, 30);
    return el;
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlayStack.length) { e.preventDefault(); closeOverlay(); }
  });

  /** Hộp thoại xác nhận cho hành động khó hoàn tác */
  function confirmDialog(o) {
    return new Promise(function (resolve) {
      var el = openOverlay(
        '<div class="dialog" style="max-width:460px">' +
          '<div class="dialog-head"><h3>' + esc(o.title || 'Xác nhận') + '</h3></div>' +
          '<div class="dialog-body">' +
            (o.danger ? '<div class="callout warn" style="margin-bottom:16px">' + icon('alert') +
              '<span>Thao tác này <b>không thể hoàn tác</b>.</span></div>' : '') +
            '<p style="font-size:14.5px;line-height:1.6;color:var(--ink-2)">' + esc(o.message || '') + '</p>' +
          '</div>' +
          '<div class="dialog-foot">' +
            '<button class="btn" data-act="no">' + esc(o.cancelText || 'Huỷ') + '</button>' +
            '<button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-act="yes">' +
              esc(o.okText || 'Đồng ý') + '</button>' +
          '</div>' +
        '</div>');
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b) return;
        closeOverlay();
        resolve(b.getAttribute('data-act') === 'yes');
      });
    });
  }

  /* ---------- Ảnh ---------- */
  /** Nén ảnh về tối đa maxPx cạnh dài, JPEG chất lượng q — giữ CSDL nhẹ. */
  function compressImage(file, maxPx, q) {
    maxPx = maxPx || 1600; q = q || 0.82;
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight;
        var scale = Math.min(1, maxPx / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
        var cv = document.createElement('canvas');
        cv.width = cw; cv.height = ch;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        cv.toBlob(function (blob) {
          URL.revokeObjectURL(url);
          if (!blob) return reject(new Error('Không nén được ảnh'));
          resolve({ blob: blob, w: cw, h: ch });
        }, 'image/jpeg', q);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Tệp không phải ảnh hợp lệ')); };
      img.src = url;
    });
  }

  function bytesVN(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  /* ---------- Xuất CSV (mở được bằng Excel, có BOM cho tiếng Việt) ---------- */
  function downloadCSV(filename, rows) {
    var csv = rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c == null ? '' : c);
        return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(';');
    }).join('\r\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(filename, blob);
  }

  function downloadBlob(filename, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  global.U = {
    $: $, $$: $$, esc: esc, frag: frag, on: on,
    num: num, hours: hours, vnd: vnd, pct: pct, round2: round2, pad: pad,
    todayISO: todayISO, monthISO: monthISO, parseISO: parseISO, weekdayVN: weekdayVN,
    isWeekend: isWeekend, dayShort: dayShort, dateVN: dateVN, monthVN: monthVN,
    dateTimeVN: dateTimeVN,
    daysOfMonth: daysOfMonth, shiftMonth: shiftMonth,
    addDays: addDays, addMonths: addMonths, diffDays: diffDays,
    toMin: toMin, hhmmVN: hhmmVN, rangeVN: rangeVN, splitHours: splitHours,
    uid: uid, initials: initials, debounce: debounce, noAccent: noAccent,
    icon: icon, toast: toast,
    openOverlay: openOverlay, closeOverlay: closeOverlay, confirmDialog: confirmDialog,
    compressImage: compressImage, bytesVN: bytesVN,
    downloadCSV: downloadCSV, downloadBlob: downloadBlob
  };
})(window);
