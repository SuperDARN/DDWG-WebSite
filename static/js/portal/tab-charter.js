/**
 * Tab: DDWG Charter（charter）
 * 手风琴式展示 DDWG Charter 完整内容（除 Membership）
 * 点击标题展开对应卡片，其余卡片自动收起
 */
(function ($, Superdarn) {
  'use strict';

  var charterLoaded = false;

  /* ========== Markdown 解析工具 ========== */

  function parseMarkdownSections(markdown) {
    var sections = [];
    if (!markdown) return sections;
    var lines = markdown.split('\n');
    var currentTitle = null;
    var buffer = [];

    function flush() {
      if (!currentTitle) return;
      sections.push({ title: currentTitle, body: buffer.join('\n').trim() });
    }

    lines.forEach(function (line) {
      var match = line.match(/^##\s+(.+)/);
      if (match) { flush(); currentTitle = match[1].trim(); buffer = []; return; }
      if (currentTitle) buffer.push(line);
    });
    flush();
    return sections;
  }

  function findSection(sections, key) {
    return sections.find(function (s) { return s.title.indexOf(key) === 0; });
  }

  function extractLastCharterUpdate(content) {
    var rows = content.match(/\|\s*([A-Za-z]+\s+\d{4})\s*\|/g);
    if (rows && rows.length) {
      var last = rows[rows.length - 1].match(/\|\s*([A-Za-z]+\s+\d{4})/);
      return last ? last[1].trim() : '';
    }
    return '';
  }

  /**
   * 轻量 Markdown → HTML 转换：段落、列表、粗体、链接、表格、内联 HTML
   */
  function md2html(text) {
    if (!text) return '';
    var blocks = text.split(/\n{2,}/);
    var html = '';

    blocks.forEach(function (block) {
      block = block.trim();
      if (!block) return;

      // Markdown 表格
      if (/^\|/.test(block) && /^[\s|:-]+$/.test(block.split('\n')[1] || '')) {
        html += renderMdTable(block);
        return;
      }

      // 有序列表
      if (/^\s*\d+[\.\)]\s/.test(block)) {
        var items = [];
        block.split('\n').forEach(function (line) {
          var m = line.match(/^\s*\d+[\.\)]\s+(.+)/);
          if (m) items.push(inlineFormat(m[1].trim()));
        });
        if (items.length) {
          html += '<ol>' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ol>';
          return;
        }
      }

      // 无序列表
      if (/^\s*[-*]\s/.test(block)) {
        var items2 = [];
        block.split('\n').forEach(function (line) {
          var m = line.match(/^\s*[-*]\s+(.+)/);
          if (m) items2.push(inlineFormat(m[1].trim()));
        });
        if (items2.length) {
          html += '<ul>' + items2.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>';
          return;
        }
      }

      // 普通段落（保留内联 HTML 如 <sup>）
      var lines = block.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      html += '<p>' + lines.map(inlineFormat).join('<br>') + '</p>';
    });

    return html;
  }

  function renderMdTable(block) {
    var rows = block.split('\n').filter(function (l) { return l.trim(); });
    if (rows.length < 2) return '';
    var html = '<table class="charter-md-table"><tbody>';
    var startRow = /^[\s|:-]+$/.test(rows[1]) ? 0 : 0; // 表头也展示
    rows.forEach(function (row, i) {
      if (i === 1 && /^[\s|:-]+$/.test(row)) return; // 跳过分隔行
      var cells = row.split('|').map(function (c) { return c.trim(); }).filter(Boolean);
      if (!cells.length) return;
      var tag = (i === 0 && /^[\s|:-]+$/.test(rows[1] || '')) ? 'th' : 'td';
      html += '<tr>' + cells.map(function (c) { return '<' + tag + '>' + inlineFormat(c) + '</' + tag + '>'; }).join('') + '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  function inlineFormat(text) {
    // 保留已有的 HTML 标签（如 <sup>, <a>）
    // 粗体
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // 链接 [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // 纯 URL
    text = text.replace(/(?<!["\(=])(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    return text;
  }

  /** 预览摘要：取纯文本前 200 字符 */
  function previewOf(text) {
    if (!text) return '';
    var clean = text
      .replace(/<[^>]+>/g, '')           // 去 HTML 标签
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 链接只保留文字
      .replace(/\*\*([^*]+)\*\*/g, '$1')        // 去粗体
      .replace(/^\s*[-*]\s+/gm, '')       // 去列表标记
      .replace(/^\s*\d+[\.\)]\s+/gm, '')  // 去序号
      .replace(/^\|.*$/gm, function (l) { // 表格行拼成一行
        return l.replace(/\|/g, ' ').trim();
      })
      .replace(/\s+/g, ' ')
      .trim();
    return clean.length > 200 ? clean.substring(0, 200) + '…' : clean;
  }

  /* ========== 手风琴渲染 ========== */

  var ACCORDION_CONFIG = [
    { sectionKey: 'Updates',               icon: 'fa-history',       title: 'Updates' },
    { sectionKey: 'Definitions',           icon: 'fa-book',          title: 'Definitions' },
    { sectionKey: 'Purpose',               icon: 'fa-bullseye',      title: 'Purpose' },
    { sectionKey: 'Institutions',           icon: 'fa-university',    title: 'Institutions' },
    { sectionKey: 'Holding Institution',   icon: 'fa-warehouse',     title: 'Holding Institution(s)' },
    { sectionKey: 'Distribution Institution', icon: 'fa-cloud-upload-alt', title: 'Distribution Institution(s)' },
    { sectionKey: 'Communications',        icon: 'fa-envelope',      title: 'Communications' },
    { sectionKey: 'Responsibilities',      icon: 'fa-tasks',         title: 'Responsibilities' }
  ];

  function renderCharterBoard(content) {
    var $board = $('#charterTabBoard');
    if (!content) {
      $board.html('<p class="charter-loading-text">Charter not synced yet.</p>');
      return;
    }

    var sections = parseMarkdownSections(content);
    var html = '<div class="charter-accordion">';

    ACCORDION_CONFIG.forEach(function (cfg, idx) {
      var sec = findSection(sections, cfg.sectionKey);
      var body = sec ? sec.body : '';
      var pv = previewOf(body);

      html += '<div class="charter-acc-item' + (idx === 0 ? ' active' : '') + '" data-key="' + cfg.sectionKey + '">';
      html += '<div class="charter-acc-header">';
      html += '<span class="charter-acc-icon"><i class="fas ' + cfg.icon + '"></i></span>';
      html += '<span class="charter-acc-title">' + Superdarn.escapeHtml(cfg.title) + '</span>';
      html += '<i class="fas fa-chevron-right charter-acc-arrow"></i>';
      html += '</div>';
      html += '<div class="charter-acc-preview">' + Superdarn.escapeHtml(pv) + '</div>';
      html += '<div class="charter-acc-body"><div class="charter-acc-content">';
      html += md2html(body);
      html += '</div></div>';
      html += '</div>';
    });

    html += '</div>';
    $board.html(html);
    bindAccordion();
  }

  /* ========== 手风琴交互 ========== */

  function bindAccordion() {
    $('#charterTabBoard').off('click.acc').on('click.acc', '.charter-acc-header', function () {
      var $item = $(this).closest('.charter-acc-item');
      if ($item.hasClass('active')) {
        $item.removeClass('active');
      } else {
        $item.siblings('.active').removeClass('active');
        $item.addClass('active');
      }
    });
  }

  /* ========== 元信息 ========== */

  function formatSyncTime(val) {
    if (!val) return '';
    return String(val).replace('T', ' ').substring(0, 16);
  }

  function updateCharterMeta(data, content) {
    var lastUpdate = content ? extractLastCharterUpdate(content) : '';
    var syncTime = data && data.syncTime ? formatSyncTime(data.syncTime) : '';
    var label = lastUpdate ? 'Last updated: ' + lastUpdate : (syncTime ? 'Synced: ' + syncTime : '');
    $('#charterTabLastUpdate').html(label ? '<i class="far fa-calendar-alt"></i> ' + Superdarn.escapeHtml(label) : '');
    if (data && data.sourceUrl) {
      $('#charterTabGithubLink').attr('href', data.sourceUrl);
    }
  }

  /* ========== 数据加载 ========== */

  function loadCharter() {
    Superdarn.apiGet(Superdarn.api + '/api/dashboard/charter', {
      target: '#charterTabBoard',
      text: 'Loading...',
      success: function (res) {
        if (res.code !== 0) return;
        var data = res.data || {};
        updateCharterMeta(data, data.content);
        renderCharterBoard(data.content);
        charterLoaded = true;
      },
      fail: function () {
        $('#charterTabLastUpdate').html('');
        $('#charterTabBoard').html('<p class="charter-loading-text">Failed to load charter.</p>');
      }
    });
  }

  /* ========== Tab 注册 ========== */

  Superdarn.registerTab('charter', {
    init: function () {},
    onShow: function () {
      if (!charterLoaded) {
        setTimeout(loadCharter, 120);
      }
    },
    resize: function () {}
  });

})(jQuery, window.Superdarn);
