/* =========================================================
   charts.js — biểu đồ tự vẽ, không dùng thư viện ngoài
   · Cột ngang: so sánh độ lớn → MỘT màu (không tô đậm theo giá trị)
   · Vành khuyên: tỷ trọng ≤ 6 phần, luôn có chú giải + nhãn trực tiếp
   Bảng màu đã chạy validator: CVD ΔE 9,2 · thường ΔE 24,0
   ========================================================= */
(function (global) {
  'use strict';

  var tip = null;

  function ensureTip() {
    if (tip) return tip;
    tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.hidden = true;
    document.body.appendChild(tip);
    return tip;
  }

  function showTip(html, x, y) {
    var t = ensureTip();
    t.innerHTML = html;
    t.hidden = false;
    var r = t.getBoundingClientRect();
    var left = Math.min(Math.max(8, x + 14), window.innerWidth - r.width - 8);
    var top = y - r.height - 12;
    if (top < 8) top = y + 18;
    t.style.left = left + 'px';
    t.style.top = top + 'px';
  }
  function hideTip() { if (tip) tip.hidden = true; }
  window.addEventListener('scroll', hideTip, true);

  /* =========================================================
     Biểu đồ cột ngang (HTML) — nhãn công trình dài đọc được
     items: [{ label, value, parts:[{name,value}] }]
     ========================================================= */
  function bars(el, opt) {
    var items = (opt.items || []).slice();
    var unit = opt.unit || 'giờ';
    var max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat([0])) || 1;

    if (!items.length) {
      el.innerHTML = '<p class="t-muted" style="font-size:14px;padding:12px 0">Chưa có dữ liệu trong kỳ đã chọn.</p>';
      return;
    }

    var pick = typeof opt.onPick === 'function';
    var html = '<div class="bars' + (pick ? ' pickable' : '') + '" role="img" aria-label="' +
      U.esc(opt.aria || ('Biểu đồ cột so sánh ' + unit)) + '">';

    items.forEach(function (it, i) {
      var w = Math.max(1.5, (it.value / max) * 100);
      html +=
        '<div class="bar-row' + (opt.activeIndex === i ? ' on' : '') + '" tabindex="0" ' +
          (pick ? 'role="button" ' : '') + 'data-i="' + i + '">' +
          '<div class="bar-label" title="' + U.esc(it.label) + '">' + U.esc(it.label) + '</div>' +
          '<div class="bar-track"><i style="width:' + w.toFixed(2) + '%"></i></div>' +
          '<div class="bar-value num">' + U.hours(it.value) + '</div>' +
        '</div>';
    });
    html += '</div>';
    el.innerHTML = html;

    function tipFor(i) {
      var it = items[i];
      var s = '<b>' + U.esc(it.label) + '</b><br>' + U.hours(it.value) + ' ' + unit;
      (it.parts || []).forEach(function (p) {
        s += '<br><span style="opacity:.75">' + U.esc(p.name) + ':</span> <b>' + U.hours(p.value) + '</b>';
      });
      return s;
    }

    U.$$('.bar-row', el).forEach(function (row) {
      var i = Number(row.getAttribute('data-i'));
      row.addEventListener('mousemove', function (e) { showTip(tipFor(i), e.clientX, e.clientY); });
      row.addEventListener('mouseleave', hideTip);
      row.addEventListener('focus', function () {
        var r = row.getBoundingClientRect();
        showTip(tipFor(i), r.left + r.width / 2, r.top);
      });
      row.addEventListener('blur', hideTip);
      if (pick) {
        row.addEventListener('click', function () { opt.onPick(items[i], i); });
        row.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opt.onPick(items[i], i); }
        });
      }
    });
  }

  /* =========================================================
     Vành khuyên (SVG)
     items: [{ label, value, hex }]
     ========================================================= */
  function pol(cx, cy, r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function ring(cx, cy, ro, ri, a0, a1) {
    if (a1 - a0 >= 359.99) {
      return 'M' + (cx - ro) + ' ' + cy +
        'a' + ro + ' ' + ro + ' 0 1 0 ' + (ro * 2) + ' 0' +
        'a' + ro + ' ' + ro + ' 0 1 0 ' + (-ro * 2) + ' 0' +
        'M' + (cx - ri) + ' ' + cy +
        'a' + ri + ' ' + ri + ' 0 1 1 ' + (ri * 2) + ' 0' +
        'a' + ri + ' ' + ri + ' 0 1 1 ' + (-ri * 2) + ' 0Z';
    }
    var p0 = pol(cx, cy, ro, a0), p1 = pol(cx, cy, ro, a1);
    var p2 = pol(cx, cy, ri, a1), p3 = pol(cx, cy, ri, a0);
    var lg = (a1 - a0) > 180 ? 1 : 0;
    return 'M' + p0.x.toFixed(2) + ' ' + p0.y.toFixed(2) +
      ' A' + ro + ' ' + ro + ' 0 ' + lg + ' 1 ' + p1.x.toFixed(2) + ' ' + p1.y.toFixed(2) +
      ' L' + p2.x.toFixed(2) + ' ' + p2.y.toFixed(2) +
      ' A' + ri + ' ' + ri + ' 0 ' + lg + ' 0 ' + p3.x.toFixed(2) + ' ' + p3.y.toFixed(2) + ' Z';
  }

  function donut(el, opt) {
    var items = (opt.items || []).filter(function (i) { return i.value > 0; });
    var total = items.reduce(function (s, i) { return s + i.value; }, 0);
    var unit = opt.unit || 'giờ';

    if (!total) {
      el.innerHTML = '<p class="t-muted" style="font-size:14px;padding:12px 0">Chưa có dữ liệu trong kỳ đã chọn.</p>';
      return;
    }

    var pick = typeof opt.onPick === 'function';
    var S = 260, cx = 130, cy = 130, ro = 104, ri = 64;
    var gap = items.length > 1 ? 1.6 : 0;      /* khe 2px giữa các mảng, không vẽ viền */
    var acc = 0, paths = '', labels = '';

    items.forEach(function (it, i) {
      var frac = it.value / total;
      var a0 = acc * 360 + gap / 2;
      var a1 = (acc + frac) * 360 - gap / 2;
      if (a1 < a0) a1 = a0;
      acc += frac;

      paths += '<path class="' + (pick ? 'pickable' : '') +
        (opt.activeIndex === i ? ' on' : '') + '" d="' + ring(cx, cy, ro, ri, a0, a1) + '" fill="' + it.hex +
        '" data-i="' + i + '" tabindex="0" role="' + (pick ? 'button' : 'img') + '" aria-label="' +
        U.esc(it.label + ': ' + U.hours(it.value) + ' ' + unit + ', ' + U.pct(it.value, total)) + '"/>';

      /* Nhãn trực tiếp — chỉ khi mảng đủ rộng để chữ không bị cắt */
      if (frac >= 0.08) {
        var mid = (a0 + a1) / 2;
        var p = pol(cx, cy, (ro + ri) / 2, mid);
        labels += '<text x="' + p.x.toFixed(1) + '" y="' + (p.y + 4).toFixed(1) + '" text-anchor="middle" ' +
          'font-size="14" font-weight="700" fill="#fff" style="pointer-events:none">' +
          U.pct(it.value, total) + '</text>';
      }
    });

    el.innerHTML =
      '<div class="donut-wrap">' +
        '<svg viewBox="0 0 ' + S + ' ' + S + '" class="donut" aria-label="' +
          U.esc(opt.aria || 'Biểu đồ tỷ trọng') + '">' +
          paths + labels +
          '<text x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle" font-size="13" fill="var(--ink-3)">Tổng cộng</text>' +
          '<text x="' + cx + '" y="' + (cy + 22) + '" text-anchor="middle" font-size="25" font-weight="700" fill="var(--ink)">' +
            U.hours(total) + '</text>' +
        '</svg>' +
        '<div class="chart-legend donut-legend">' +
          items.map(function (it) {
            return '<span class="legend-item">' +
              '<i class="legend-swatch" style="background:' + it.hex + '"></i>' +
              U.esc(it.label) +
              ' <span class="num">' + U.hours(it.value) + ' ' + unit + '</span>' +
              ' <span class="t-muted num">(' + U.pct(it.value, total) + ')</span></span>';
          }).join('') +
        '</div>' +
      '</div>';

    function tipFor(i) {
      var it = items[i];
      return '<b>' + U.esc(it.label) + '</b><br>' + U.hours(it.value) + ' ' + unit +
        ' · ' + U.pct(it.value, total);
    }

    U.$$('path[data-i]', el).forEach(function (p) {
      var i = Number(p.getAttribute('data-i'));
      p.addEventListener('mousemove', function (e) { showTip(tipFor(i), e.clientX, e.clientY); });
      p.addEventListener('mouseleave', hideTip);
      p.addEventListener('focus', function () {
        var r = p.getBoundingClientRect();
        showTip(tipFor(i), r.left + r.width / 2, r.top + r.height / 2);
      });
      p.addEventListener('blur', hideTip);
      if (pick) {
        p.addEventListener('click', function () { opt.onPick(items[i], i); });
        p.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opt.onPick(items[i], i); }
        });
      }
    });
  }


  /* =========================================================
     Cột chồng theo ngày — giờ hành chính ở dưới, tăng ca ở trên
     items: [{ label, a, b }]   a = giờ HC, b = giờ TC
     ========================================================= */
  function columns(el, opt) {
    var items = (opt.items || []);
    var unit = opt.unit || 'giờ';
    var nameA = opt.nameA || 'Giờ HC';
    var nameB = opt.nameB || 'Giờ TC';
    var colA = opt.colA || '#2A78D6';
    var colB = opt.colB || '#EB6834';

    var max = 0;
    items.forEach(function (it) { max = Math.max(max, (it.a || 0) + (it.b || 0)); });
    if (!items.length || !max) {
      el.innerHTML = '<p class="t-muted" style="font-size:14px;padding:12px 0">Chưa có dữ liệu trong kỳ đã chọn.</p>';
      return;
    }

    var W = 720, H = 210;
    var padL = 40, padR = 6, padT = 10, padB = 30;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var step = plotW / items.length;
    var barW = Math.max(4, Math.min(26, step * 0.62));

    /* thang chia tròn số cho dễ đọc */
    var nice = Math.pow(10, Math.floor(Math.log(max) / Math.LN10));
    var tick = Math.ceil(max / 4 / nice) * nice;
    var top = Math.max(tick * 4, max);

    function y(v) { return padT + plotH - (v / top) * plotH; }

    var g = '';
    for (var t = 0; t <= top + 0.001; t += tick) {
      var yy = y(t);
      g += '<line x1="' + padL + '" y1="' + yy.toFixed(1) + '" x2="' + (W - padR) +
        '" y2="' + yy.toFixed(1) + '" stroke="var(--grid)" stroke-width="1"/>' +
        '<text x="' + (padL - 6) + '" y="' + (yy + 3.5).toFixed(1) + '" text-anchor="end" ' +
        'font-size="10" fill="var(--ink-3)">' + U.num(t, t % 1 ? 1 : 0) + '</text>';
    }

    /* nhãn trục ngang thưa bớt khi nhiều cột để chữ không chồng nhau */
    var everyN = Math.ceil(items.length / 14);
    var bars = '', labels = '';

    items.forEach(function (it, i) {
      var cx = padL + step * i + step / 2;
      var x = cx - barW / 2;
      var a = it.a || 0, b = it.b || 0;
      var yA = y(a), yB = y(a + b);
      var hA = padT + plotH - yA;
      var hB = a > 0 ? (yA - yB - 2) : (yA - yB);   /* chừa 2px giữa hai mảng */

      if (a > 0) {
        bars += '<rect x="' + x.toFixed(1) + '" y="' + yA.toFixed(1) + '" width="' + barW.toFixed(1) +
          '" height="' + Math.max(1, hA).toFixed(1) + '" fill="' + colA + '"' +
          (b > 0 ? '' : ' rx="3"') + ' data-i="' + i + '"/>';
      }
      if (b > 0 && hB > 0) {
        bars += '<rect x="' + x.toFixed(1) + '" y="' + yB.toFixed(1) + '" width="' + barW.toFixed(1) +
          '" height="' + Math.max(1, hB).toFixed(1) + '" fill="' + colB + '" rx="3" data-i="' + i + '"/>';
      }
      /* vùng bắt chuột rộng hơn cột cho dễ trỏ */
      bars += '<rect x="' + (cx - step / 2).toFixed(1) + '" y="' + padT + '" width="' + step.toFixed(1) +
        '" height="' + plotH + '" fill="transparent" data-i="' + i + '" tabindex="0" role="img" ' +
        'aria-label="' + U.esc(it.label + ': ' + U.hours(a) + ' ' + nameA + ', ' + U.hours(b) + ' ' + nameB) + '"/>';

      if (i % everyN === 0) {
        labels += '<text x="' + cx.toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle" ' +
          'font-size="10" fill="var(--ink-3)">' + U.esc(it.short || it.label) + '</text>';
      }
    });

    el.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" class="colchart" aria-label="' +
        U.esc(opt.aria || 'Biểu đồ cột theo ngày') + '">' +
        g +
        '<line x1="' + padL + '" y1="' + (padT + plotH) + '" x2="' + (W - padR) +
          '" y2="' + (padT + plotH) + '" stroke="var(--axis)" stroke-width="1"/>' +
        bars + labels +
      '</svg>' +
      '<div class="chart-legend">' +
        '<span class="legend-item"><i class="legend-swatch" style="background:' + colA + '"></i>' +
          U.esc(nameA) + '</span>' +
        '<span class="legend-item"><i class="legend-swatch" style="background:' + colB + '"></i>' +
          U.esc(nameB) + '</span>' +
      '</div>';

    function tipFor(i) {
      var it = items[i];
      return '<b>' + U.esc(it.label) + '</b><br>' +
        U.esc(nameA) + ': <b>' + U.hours(it.a || 0) + '</b> ' + unit + '<br>' +
        U.esc(nameB) + ': <b>' + U.hours(it.b || 0) + '</b> ' + unit + '<br>' +
        '<span style="opacity:.75">Tổng: ' + U.hours((it.a || 0) + (it.b || 0)) + ' ' + unit + '</span>';
    }

    U.$$('[data-i]', el).forEach(function (n) {
      var i = Number(n.getAttribute('data-i'));
      n.addEventListener('mousemove', function (e) { showTip(tipFor(i), e.clientX, e.clientY); });
      n.addEventListener('mouseleave', hideTip);
      n.addEventListener('focus', function () {
        var r = n.getBoundingClientRect();
        showTip(tipFor(i), r.left + r.width / 2, r.top);
      });
      n.addEventListener('blur', hideTip);
    });
  }

  global.Charts = { bars: bars, donut: donut, columns: columns, hideTip: hideTip };
})(window);
