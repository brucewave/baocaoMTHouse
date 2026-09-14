/* =========================================================
   xlsx.js — ghi file Excel .xlsx thật, không dùng thư viện ngoài
   Đủ cho nhu cầu báo cáo: nhiều sheet, gộp ô, tô nền, viền,
   canh lề, xuống dòng trong ô, định dạng số và tiền.
   File nén kiểu STORED nên không cần bộ nén, Excel vẫn mở bình thường.
   ========================================================= */
(function (global) {
  'use strict';

  /* ---------------- ZIP ---------------- */
  var crcTable = (function () {
    var t = new Int32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })();

  function crc32(buf) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function utf8(str) {
    var out = [], i, cp;
    for (i = 0; i < str.length; i++) {
      cp = str.charCodeAt(i);
      if (cp >= 0xD800 && cp <= 0xDBFF && i + 1 < str.length) {
        cp = 0x10000 + ((cp - 0xD800) << 10) + (str.charCodeAt(++i) - 0xDC00);
      }
      if (cp < 0x80) out.push(cp);
      else if (cp < 0x800) out.push(0xC0 | (cp >> 6), 0x80 | (cp & 63));
      else if (cp < 0x10000) out.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      else out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    }
    return new Uint8Array(out);
  }

  function zipStore(files) {
    var parts = [], central = [], offset = 0;
    var now = new Date();
    var dosTime = ((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | ((now.getSeconds() / 2) & 31);
    var dosDate = (((now.getFullYear() - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31);

    files.forEach(function (f) {
      var name = utf8(f.name), data = f.data, crc = crc32(data);
      var lfh = new Uint8Array(30 + name.length);
      var dv = new DataView(lfh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0x0800, true);      /* tên tệp mã hoá UTF-8 */
      dv.setUint16(8, 0, true);           /* không nén */
      dv.setUint16(10, dosTime, true);
      dv.setUint16(12, dosDate, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true);
      dv.setUint32(22, data.length, true);
      dv.setUint16(26, name.length, true);
      dv.setUint16(28, 0, true);
      lfh.set(name, 30);
      parts.push(lfh, data);

      var cdh = new Uint8Array(46 + name.length);
      var cv = new DataView(cdh.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dosTime, true);
      cv.setUint16(14, dosDate, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint32(42, offset, true);
      cdh.set(name, 46);
      central.push(cdh);

      offset += lfh.length + data.length;
    });

    var cdSize = central.reduce(function (s, c) { return s + c.length; }, 0);
    var eocd = new Uint8Array(22);
    var ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);

    return new Blob(parts.concat(central, [eocd]), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  /* ---------------- kiểu ô ---------------- */
  /* Thứ tự trong mảng này chính là chỉ số kiểu dùng khi khai báo ô. */
  var S = {
    normal: 0, bold: 1, company: 2, title: 3,
    label: 4, labelFill: 5,
    head: 6, headSub: 7, headDay: 8,
    cell: 9, cellWrap: 10, cellCenter: 11,
    num1: 12, money: 13, moneyPlain: 14, pct: 15,
    total: 16, totalNum: 17, totalMoney: 18,
    banner: 19, bannerVal: 20, bannerMoney: 21,
    section: 22, subTotal: 23, dayVal: 24, muted: 25
  };

  var COL = {
    blue:      'FF4472C4',
    blueDark:  'FF305496',
    blueLight: 'FFD9E1F2',
    blueMid:   'FF8EA9DB',
    yellow:    'FFFFF2CC',
    grey:      'FFF2F2F2',
    white:     'FFFFFFFF',
    ink:       'FF1F4E79',
    red:       'FFC00000'
  };

  function stylesXml() {
    var fonts = [
      '<font><sz val="10"/><name val="Arial"/></font>',                                         /* 0 */
      '<font><b/><sz val="10"/><name val="Arial"/></font>',                                     /* 1 */
      '<font><b/><sz val="11"/><name val="Arial"/></font>',                                     /* 2 company */
      '<font><b/><sz val="16"/><color rgb="' + COL.ink + '"/><name val="Arial"/></font>',       /* 3 title */
      '<font><b/><sz val="10"/><color rgb="' + COL.white + '"/><name val="Arial"/></font>',     /* 4 header */
      '<font><b/><sz val="14"/><name val="Arial"/></font>',                                     /* 5 banner value */
      '<font><b/><sz val="14"/><color rgb="' + COL.red + '"/><name val="Arial"/></font>',       /* 6 money red */
      '<font><b/><sz val="11"/><color rgb="' + COL.ink + '"/><name val="Arial"/></font>',       /* 7 section */
      '<font><sz val="10"/><color rgb="FF808080"/><name val="Arial"/></font>'                   /* 8 muted */
    ];
    var fills = [
      '<fill><patternFill patternType="none"/></fill>',
      '<fill><patternFill patternType="gray125"/></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="' + COL.blue + '"/></patternFill></fill>',       /* 2 */
      '<fill><patternFill patternType="solid"><fgColor rgb="' + COL.blueLight + '"/></patternFill></fill>',  /* 3 */
      '<fill><patternFill patternType="solid"><fgColor rgb="' + COL.yellow + '"/></patternFill></fill>',     /* 4 */
      '<fill><patternFill patternType="solid"><fgColor rgb="' + COL.blueDark + '"/></patternFill></fill>',   /* 5 */
      '<fill><patternFill patternType="solid"><fgColor rgb="' + COL.grey + '"/></patternFill></fill>',       /* 6 */
      '<fill><patternFill patternType="solid"><fgColor rgb="' + COL.blueMid + '"/></patternFill></fill>'     /* 7 */
    ];
    var thin = '<left style="thin"><color rgb="FF9FB6D9"/></left><right style="thin"><color rgb="FF9FB6D9"/></right>' +
               '<top style="thin"><color rgb="FF9FB6D9"/></top><bottom style="thin"><color rgb="FF9FB6D9"/></bottom>';
    var borders = [
      '<border><left/><right/><top/><bottom/><diagonal/></border>',                 /* 0 */
      '<border>' + thin + '<diagonal/></border>',                                   /* 1 */
      '<border><left style="thin"/><right style="thin"/><top style="medium">' +
        '<color rgb="' + COL.blue + '"/></top><bottom style="thin"/><diagonal/></border>'  /* 2 */
    ];

    var numFmts =
      '<numFmts count="3">' +
        '<numFmt numFmtId="164" formatCode="#,##0.0"/>' +
        '<numFmt numFmtId="165" formatCode="#,##0"/>' +
        '<numFmt numFmtId="166" formatCode="0.0%"/>' +
      '</numFmts>';

    /* f=font, fi=fill, b=border, nf=numFmt, al=alignment */
    function xf(o) {
      o = o || {};
      var al = o.al ? '<alignment' + o.al + '/>' : '';
      return '<xf numFmtId="' + (o.nf || 0) + '" fontId="' + (o.f || 0) + '" fillId="' + (o.fi || 0) +
        '" borderId="' + (o.b || 0) + '" xfId="0"' +
        (o.nf ? ' applyNumberFormat="1"' : '') +
        (o.f ? ' applyFont="1"' : '') + (o.fi ? ' applyFill="1"' : '') +
        (o.b ? ' applyBorder="1"' : '') + (al ? ' applyAlignment="1"' : '') + '>' + al + '</xf>';
    }

    var cellXfs = [
      xf(),                                                                     /* 0 normal */
      xf({ f: 1 }),                                                             /* 1 bold */
      xf({ f: 2 }),                                                             /* 2 company */
      xf({ f: 3 }),                                                             /* 3 title */
      xf({ f: 1 }),                                                             /* 4 label */
      xf({ f: 1, fi: 4, b: 1 }),                                                /* 5 labelFill */
      xf({ f: 4, fi: 2, b: 1, al: ' horizontal="center" vertical="center" wrapText="1"' }),   /* 6 head */
      xf({ f: 4, fi: 7, b: 1, al: ' horizontal="center" vertical="center"' }),   /* 7 headSub */
      xf({ f: 4, fi: 5, b: 1, al: ' horizontal="center" vertical="center"' }),   /* 8 headDay */
      xf({ b: 1, al: ' vertical="center"' }),                                    /* 9 cell */
      xf({ b: 1, al: ' vertical="top" wrapText="1"' }),                          /* 10 cellWrap */
      xf({ b: 1, al: ' horizontal="center" vertical="center"' }),                /* 11 cellCenter */
      xf({ nf: 164, b: 1, al: ' horizontal="right" vertical="center"' }),        /* 12 num1 */
      xf({ nf: 165, b: 1, al: ' horizontal="right" vertical="center"' }),        /* 13 money */
      xf({ nf: 165 }),                                                          /* 14 moneyPlain */
      xf({ nf: 166, b: 1, al: ' horizontal="right" vertical="center"' }),        /* 15 pct */
      xf({ f: 1, fi: 3, b: 2, al: ' horizontal="right" vertical="center"' }),    /* 16 total */
      xf({ f: 1, nf: 164, fi: 3, b: 2, al: ' horizontal="right" vertical="center"' }), /* 17 totalNum */
      xf({ f: 1, nf: 165, fi: 3, b: 2, al: ' horizontal="right" vertical="center"' }), /* 18 totalMoney */
      xf({ f: 4, fi: 5, b: 1, al: ' horizontal="center" vertical="center"' }),   /* 19 banner */
      xf({ f: 5, fi: 6, b: 1, al: ' horizontal="center" vertical="center"' }),   /* 20 bannerVal */
      xf({ f: 6, nf: 165, fi: 6, b: 1, al: ' horizontal="center" vertical="center"' }), /* 21 bannerMoney */
      xf({ f: 7 }),                                                             /* 22 section */
      xf({ f: 1, nf: 164, fi: 3, b: 1, al: ' horizontal="right" vertical="center"' }), /* 23 subTotal */
      xf({ nf: 164, b: 1, al: ' horizontal="center" vertical="center"' }),       /* 24 dayVal */
      xf({ f: 8 })                                                              /* 25 muted */
    ];

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      numFmts +
      '<fonts count="' + fonts.length + '">' + fonts.join('') + '</fonts>' +
      '<fills count="' + fills.length + '">' + fills.join('') + '</fills>' +
      '<borders count="' + borders.length + '">' + borders.join('') + '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + cellXfs.length + '">' + cellXfs.join('') + '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';
  }

  /* ---------------- sheet ---------------- */
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }

  function colName(i) {
    var s = '';
    i++;
    while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - m - 1) / 26; }
    return s;
  }
  function ref(r, c) { return colName(c) + (r + 1); }

  function sheetXml(sheet) {
    var cols = '';
    if (sheet.cols && sheet.cols.length) {
      cols = '<cols>' + sheet.cols.map(function (w, i) {
        return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
      }).join('') + '</cols>';
    }

    var rows = (sheet.rows || []).map(function (row, r) {
      if (!row) return '';
      var cells = (row.cells || row).map(function (cell, c) {
        if (cell == null || cell === '') return '';
        var v = cell, s = 0;
        if (typeof cell === 'object') { v = cell.v; s = cell.s || 0; }
        if (v == null || v === '') {
          return s ? '<c r="' + ref(r, c) + '" s="' + s + '"/>' : '';
        }
        var isNum = typeof v === 'number' && isFinite(v);
        return '<c r="' + ref(r, c) + '"' + (s ? ' s="' + s + '"' : '') +
          (isNum ? '><v>' + v + '</v></c>'
                 : ' t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>');
      }).join('');
      var h = (row.h ? ' ht="' + row.h + '" customHeight="1"' : '');
      return '<row r="' + (r + 1) + '"' + h + '>' + cells + '</row>';
    }).join('');

    var merges = (sheet.merges || []).length
      ? '<mergeCells count="' + sheet.merges.length + '">' +
        sheet.merges.map(function (m) {
          return '<mergeCell ref="' + ref(m[0], m[1]) + ':' + ref(m[2], m[3]) + '"/>';
        }).join('') + '</mergeCells>'
      : '';

    var pane = sheet.freeze
      ? '<pane xSplit="' + (sheet.freeze[1] || 0) + '" ySplit="' + (sheet.freeze[0] || 0) + '" ' +
        'topLeftCell="' + ref(sheet.freeze[0] || 0, sheet.freeze[1] || 0) + '" activePane="bottomRight" state="frozen"/>'
      : '';

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0" showGridLines="0">' + pane + '</sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/>' +
      cols +
      '<sheetData>' + rows + '</sheetData>' +
      merges +
      '<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>' +
      '<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>' +
      '</worksheet>';
  }

  /* ---------------- build ---------------- */
  function build(sheets) {
    var files = [];
    function add(name, str) { files.push({ name: name, data: utf8(str) }); }

    var sheetRefs = sheets.map(function (s, i) {
      return '<sheet name="' + esc(s.name || ('Sheet' + (i + 1))) + '" sheetId="' + (i + 1) +
        '" r:id="rId' + (i + 1) + '"/>';
    }).join('');

    add('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheets.map(function (s, i) {
        return '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
          '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      }).join('') +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>');

    add('_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>');

    add('xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets>' + sheetRefs + '</sheets></workbook>');

    add('xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (s, i) {
        return '<Relationship Id="rId' + (i + 1) +
          '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' +
          (i + 1) + '.xml"/>';
      }).join('') +
      '<Relationship Id="rId' + (sheets.length + 1) +
      '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>');

    add('xl/styles.xml', stylesXml());
    sheets.forEach(function (s, i) { add('xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(s)); });

    return zipStore(files);
  }

  function download(filename, sheets) {
    U.downloadBlob(filename, build(sheets));
  }

  global.XLSX = { build: build, download: download, S: S, colName: colName };
})(window);
