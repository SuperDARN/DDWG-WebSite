/**
 * Tab: Data Sync Calendar（syncCalendar） v6
 * 左侧雷达列表 + 右侧信息卡与 FullYearPicker 日历
 */
(function ($, Superdarn) {
  'use strict';

  if (!Superdarn) {
    console.error('[syncCalendar] Superdarn namespace missing, load common.js first');
    return;
  }

  var syncCalendarData = [];
  var currentYear = String(new Date().getFullYear());
  var pendingStationCode = null;
  var selectedRadarCode = null;
  /** 已加载的日期，key 为 站码|年份 */
  var dateCache = {};
  var dateInflight = {};
  var rightPanelObserver = null;

  function measureRightPanelHeight() {
    var el = document.querySelector('#syncCalendar .sync-right');
    if (!el) return 0;
    return Math.ceil(el.getBoundingClientRect().height);
  }

  function syncLeftPanelHeight() {
    if (!$('#syncCalendar').hasClass('active')) return;

    var $panel = $('#syncCalendar .radar-list-panel');
    var $list = $('#radarStationList');
    if (!$panel.length || !$list.length) return;

    if (window.matchMedia('(max-width: 768px)').matches) {
      $panel.css({ height: '', maxHeight: '' });
      $list.css({ height: '', maxHeight: '' });
      return;
    }

    var rightHeight = measureRightPanelHeight();
    if (rightHeight <= 0) return;

    $panel.css({
      height: rightHeight + 'px',
      maxHeight: rightHeight + 'px'
    });

    var titleHeight = $panel.find('.radar-list-title').outerHeight() || 0;
    var listHeight = Math.max(120, rightHeight - titleHeight);
    $list.css({
      height: listHeight + 'px',
      maxHeight: listHeight + 'px',
      overflowY: 'auto'
    });
  }

  function scheduleSyncLeftPanelHeight() {
    if (window.requestAnimationFrame) {
      requestAnimationFrame(function () {
        requestAnimationFrame(syncLeftPanelHeight);
      });
    } else {
      setTimeout(syncLeftPanelHeight, 50);
    }
    setTimeout(syncLeftPanelHeight, 200);
    setTimeout(syncLeftPanelHeight, 600);
  }

  function observeRightPanel() {
    if (typeof ResizeObserver === 'undefined') return;
    var el = document.querySelector('#syncCalendar .sync-right');
    if (!el) return;
    if (rightPanelObserver) {
      rightPanelObserver.disconnect();
    }
    rightPanelObserver = new ResizeObserver(function () {
      syncLeftPanelHeight();
    });
    rightPanelObserver.observe(el);
  }

  function filterDatesByYear(dates, year) {
    year = String(year);
    return (dates || []).filter(function (d) {
      return d && String(d).indexOf(year) === 0;
    });
  }

  function updateSyncTitle(year, count) {
    $('#syncCalendarTitle').text(count + ' days synced in ' + year);
  }

  function getYearFromDate(dateStr) {
    if (!dateStr) return null;
    var parts = dateStr.split('-');
    return parts && parts.length > 0 ? parts[0] : null;
  }

  function fillYearRange(startYear) {
    var select = document.getElementById('radarYearSelect');
    if (!select) return;
    var nowYear = new Date().getFullYear();
    var from = parseInt(startYear, 10) || 2000;
    select.innerHTML = '';
    for (var y = nowYear; y >= from; y--) {
      select.add(new Option(String(y), String(y)));
    }
    if (!select.value) {
      select.value = String(nowYear);
    }
    currentYear = select.value;
  }

  function loadYearOptions(radarId, startYear) {
    fillYearRange(startYear);
  }

  function yearFromRadar(code) {
    var radar = getRadarByCode(code);
    var fromLast = radar ? getYearFromDate(radar.lastupdatetime) : null;
    if (fromLast) return fromLast;
    var selected = $('#radarYearSelect').val();
    if (selected) return String(selected);
    return String(new Date().getFullYear());
  }

  function getRadarByCode(code) {
    return Superdarn.radarList.find(function (item) {
      return item.clickablecode === code;
    });
  }

  function getSelectedRadarCode() {
    if (selectedRadarCode) {
      return selectedRadarCode;
    }
    var $active = $('#radarStationList .radar-station-item.active').first();
    return $active.length ? String($active.attr('data-code') || '') : null;
  }

  function highlightRadarListItem(code) {
    selectedRadarCode = code;
    $('#radarStationList .radar-station-item').removeClass('active');
    if (code) {
      $('#radarStationList .radar-station-item[data-code="' + code + '"]').addClass('active');
    }
  }

  function buildRadarListItem(item, isActive) {
    var code = Superdarn.escapeHtml(item.clickablecode || '');
    var name = Superdarn.escapeHtml(item.radar_name || '');
    var cls = 'radar-station-item' + (isActive ? ' active' : '');
    var isOffline = String(item.status) === '1';
    var dotCls = isOffline ? 'status-dot offline-blink' : 'status-dot normal-blink';
    return (
      '<li class="' + cls + '" data-code="' + code + '" data-radar-id="' + item.id + '" data-start-year="' + (item.startyear || '2000') + '">' +
        '<span class="radar-text">' +
          '<span class="radar-code">' + code + '</span>' +
          '<span class="radar-name">' + name + '</span>' +
        '</span>' +
        '<span class="' + dotCls + '"></span>' +
      '</li>'
    );
  }

  function initRadarList() {
    var $list = $('#radarStationList');
    if (!$list.length) return;

    var html = '';
    Superdarn.radarList.forEach(function (item, idx) {
      html += buildRadarListItem(item, idx === 0);
    });
    $list.html(html);

    if (Superdarn.radarList.length) {
      selectedRadarCode = Superdarn.radarList[0].clickablecode;
      var first = Superdarn.radarList[0];
      updateRadarInfo(first);
      loadYearOptions(first.id, first.startyear);
    }
    scheduleSyncLeftPanelHeight();
  }

  function ensureRadarListRendered() {
    if (!$('#radarStationList').children().length && Superdarn.radarList.length) {
      initRadarList();
    }
  }

  function selectRadar(code) {
    if (!code) return;
    var target = getRadarByCode(code);
    if (!target) return;

    highlightRadarListItem(code);
    updateRadarInfo(target);
    loadYearOptions(target.id, target.startyear);

    if ($('#syncCalendar').hasClass('active')) {
      renderSyncCalendar(code);
    }
  }

  function loadRadars() {
    Superdarn.apiGet(Superdarn.api + '/api/dashboard/radars', {
      target: '#syncCalendar',
      success: function (res) {
        if (res.code !== 0 || !res.data) return;
        Superdarn.radarList = res.data;
        initRadarList();
        if ($('#syncCalendar').hasClass('active')) {
          renderSyncCalendar(getSelectedRadarCode());
        }
      }
    });
  }

  function updateRadarInfo(data) {
    var fields = [
      { id: '#infoCode',          val: data.clickablecode },
      { id: '#infoArea',          val: data.radarlocation },
      { id: '#startyearid',       val: data.startyear },
      { id: '#laseupdatetimeid',  val: data.lastupdatetime },
      { id: '#pinameid',          val: data.piname },
      { id: '#radarunitid',       val: data.piinstitution }
    ];
    fields.forEach(function (f) {
      var text = f.val || '-';
      $(f.id).text(text).attr('title', text);
    });
  }

  function disposeEchartsIfAny(dom) {
    if (typeof echarts === 'undefined' || !dom) return;
    var inst = echarts.getInstanceByDom(dom);
    if (inst) inst.dispose();
  }

  function renderFullYearPicker(year, dates) {
    year = String(year || currentYear);
    var yearDates = filterDatesByYear(dates, year);
    updateSyncTitle(year, yearDates.length);

    if (typeof $.fn.fullYearPicker !== 'function') {
      $('#syncCalendarTitle').text('Calendar plugin not loaded. Please refresh the page.');
      console.error('[syncCalendar] fullYearPicker plugin not loaded');
      return;
    }

    var $box = $('#syncCalendarChart');
    if (!$box.length) return;

    disposeEchartsIfAny($box[0]);
    $box.removeClass('fullYearPicker').empty();

    var yearNum = parseInt(year, 10);
    var startYear = yearNum - 5;
    var endYear = yearNum + 5;

    $box.fullYearPicker({
      disable: true,
      year: yearNum,
      initDate: yearDates,
      format: 'YYYY-MM-DD',
      yearScale: { min: Math.max(1949, startYear), max: Math.min(2100, endYear) },
      cellClick: function () {},
      choose: function () {}
    });

    scheduleSyncLeftPanelHeight();
  }

  function renderSyncCalendar(stationCode, year) {
    var code = stationCode || getSelectedRadarCode();
    if (!code) {
      renderFullYearPicker(currentYear, []);
      return;
    }

    if (!year) {
      year = yearFromRadar(code);
    }
    year = String(year);
    var $yearSelect = $('#radarYearSelect');
    if ($yearSelect.length && $yearSelect.find('option[value="' + year + '"]').length) {
      $yearSelect.val(year);
    }
    currentYear = year;
    pendingStationCode = code;

    var cacheKey = code + '|' + year;
    if (Object.prototype.hasOwnProperty.call(dateCache, cacheKey)) {
      syncCalendarData = dateCache[cacheKey];
      renderFullYearPicker(year, syncCalendarData);
      return;
    }
    if (dateInflight[cacheKey]) {
      return;
    }

    dateInflight[cacheKey] = true;
    Superdarn.apiGet(Superdarn.api + '/api/dashboard/sync-calendar', { radarid: code, year: year }, {
      target: '#syncCalendarChart',
      success: function (res) {
        delete dateInflight[cacheKey];
        var dates = (res.code === 0 && res.data) ? res.data : [];
        dateCache[cacheKey] = dates;
        if (pendingStationCode !== code || String(currentYear) !== year) return;
        syncCalendarData = dates;
        renderFullYearPicker(year, syncCalendarData);
        scheduleSyncLeftPanelHeight();
      },
      fail: function () {
        delete dateInflight[cacheKey];
        if (pendingStationCode !== code || String(currentYear) !== year) return;
        syncCalendarData = [];
        renderFullYearPicker(year, []);
        $('#syncCalendarTitle').text('Failed to load sync data for ' + year);
        scheduleSyncLeftPanelHeight();
      }
    });
  }

  function bindEvents() {
    $('#radarStationList').on('click', '.radar-station-item', function () {
      selectRadar(String($(this).attr('data-code') || ''));
    });

    $('#radarYearSelect').on('change', function () {
      renderSyncCalendar(getSelectedRadarCode(), String(this.value));
    });
  }

  Superdarn.registerTab('syncCalendar', {
    init: function () {
      bindEvents();
      loadRadars();
    },
    onShow: function () {
      observeRightPanel();
      var run = function () {
        ensureRadarListRendered();
        var code = getSelectedRadarCode();
        if (code) {
          renderSyncCalendar(code);
        } else if (Superdarn.radarList.length) {
          selectRadar(Superdarn.radarList[0].clickablecode);
        } else {
          renderFullYearPicker(currentYear, []);
        }
      };
      if (window.requestAnimationFrame) {
        requestAnimationFrame(function () {
          requestAnimationFrame(run);
        });
      } else {
        setTimeout(run, 100);
      }
      scheduleSyncLeftPanelHeight();
    },
    resize: function () {
      scheduleSyncLeftPanelHeight();
    }
  });

})(jQuery, window.Superdarn);
