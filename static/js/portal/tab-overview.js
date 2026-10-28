/**
 * Tab: Data Overview（overview）
 * KPI 统计 + 滚动消息条 (Ticker)
 */
(function ($, Superdarn) {
  'use strict';

  var tickerLoaded = false;
  var tickerTimer = null;
  var tickerIndex = 0;
  var tickerItems = [];
  var tickerHovered = false;

  /* ========== 滚动消息条 (Ticker) ========== */

  function formatSize(gb) {
    if (gb === null || gb === undefined || isNaN(gb) || gb < 0) return '0 GB';
    if (gb === 0) return '0 GB';
    if (gb < 0.01) return (gb * 1024).toFixed(1) + ' MB';
    if (gb >= 1000) return (gb / 1024).toFixed(2) + ' TB';
    return Number(gb).toFixed(2) + ' GB';
  }

  function formatCount(n) {
    if (n === null || n === undefined || isNaN(n)) return '0';
    return Number(n).toLocaleString();
  }

  function formatDateTime(val) {
    if (!val) return '-';
    var s = String(val);
    // Handle ISO-8601 format: "2026-07-24T10:30:00"
    if (s.indexOf('T') > -1) return s.replace('T', ' ').substring(0, 10);
    // Handle array format from Jackson: [2026,7,24,10,30,0]
    if (s.charAt(0) === '[') {
      try {
        var arr = JSON.parse(s);
        if (arr && arr.length >= 3) {
          var y = arr[0], m = String(arr[1]).padStart(2, '0'), d = String(arr[2]).padStart(2, '0');
          var hh = String(arr[3] || 0).padStart(2, '0'), mm = String(arr[4] || 0).padStart(2, '0');
          // return y + '-' + m + '-' + d + ' ' + hh + ':' + mm;
          return y + '-' + m + '-' + d;
        }
      } catch (e) { /* ignore */ }
    }
    if (s.length > 16) return s.substring(0, 10);
    return s;
  }

  function loadTicker() {
    Superdarn.apiGet(Superdarn.api + '/api/dashboard/radar-data-summary', {
      target: '#tickerViewport',
      text: 'Loading radar data...',
      success: function (res) {
        if (res.code !== 0 || !res.data || !res.data.length) {
          $('#tickerList').html('<li class="ticker-item"><span class="ticker-empty">No radar data available</span></li>');
          return;
        }
        tickerItems = [];
        res.data.forEach(function (item) {
          var name = Superdarn.escapeHtml(item.radarname || item.radarcode || '-');
          var totalCount = formatCount(item.totalCount);
          var totalSize = formatSize(item.totalSize);
          var monthlyCount = formatCount(item.monthlyCount);
          var monthlySize = formatSize(item.monthlySize);
          var updated = formatDateTime(item.lastUpdateTime);

          tickerItems.push(
            '<li class="ticker-item">' +
              '<span class="ticker-radar"><i class="fas fa-satellite-dish"></i> ' + name + '</span>' +
              '<span class="ticker-sep"></span>' +
              '<span class="ticker-stat">' +
                '<span class="ticker-label">Synced</span> ' +
                '<strong>' + totalSize + '</strong>' +
                '<span class="ticker-dot">&middot;</span>' +
                '<strong>' + totalCount + '</strong> <span class="ticker-unit">files</span>' +
              '</span>' +
              '<span class="ticker-sep"></span>' +
              '<span class="ticker-stat">' +
                '<span class="ticker-label">Month</span> ' +
                '<strong>' + monthlySize + '</strong>' +
                '<span class="ticker-dot">&middot;</span>' +
                '<strong>' + monthlyCount + '</strong> <span class="ticker-unit">files</span>' +
              '</span>' +
              '<span class="ticker-sep"></span>' +
              '<span class="ticker-time"><i class="far fa-clock"></i> ' + updated + '</span>' +
            '</li>'
          );
        });
        renderTicker();
        startTicker();
        tickerLoaded = true;
      },
      fail: function () {
        $('#tickerList').html('<li class="ticker-item"><span class="ticker-error">Failed to load radar data</span></li>');
      }
    });
  }

  function renderTicker() {
    var $list = $('#tickerList');
    $list.empty();
    if (tickerItems.length > 0) {
      $list.html(tickerItems[tickerIndex % tickerItems.length]);
    }
  }

  function startTicker() {
    stopTicker();
    if (tickerItems.length <= 1) return;
    tickerTimer = setInterval(function () {
      if (tickerHovered) return;
      tickerIndex++;
      var $list = $('#tickerList');
      $list.css('transition', 'opacity 0.3s ease');
      $list.css('opacity', '0');
      setTimeout(function () {
        renderTicker();
        $list.css('transition', 'opacity 0.3s ease');
        $list.css('opacity', '1');
      }, 300);
    }, 3000);
  }

  function stopTicker() {
    if (tickerTimer) {
      clearInterval(tickerTimer);
      tickerTimer = null;
    }
  }

  function bindTickerHover() {
    var $viewport = $('#tickerViewport');
    $viewport.off('mouseenter.ticker mouseleave.ticker');
    $viewport.on('mouseenter.ticker', function () { tickerHovered = true; });
    $viewport.on('mouseleave.ticker', function () { tickerHovered = false; });
  }

  Superdarn.registerTab('overview', {
    init: function () {
      loadTicker();
      bindTickerHover();
    },
    onShow: function () {
      if (!tickerLoaded) { loadTicker(); bindTickerHover(); } else { startTicker(); }
    },
    resize: function () {}
  });

})(jQuery, window.Superdarn);
