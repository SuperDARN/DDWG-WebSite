/**
 * Tab: File Volume & RAWACF Data Statistics（dataStat）
 */
(function ($, Superdarn) {
  'use strict';

  var radarnameArr = [];
  var radardataArr = [];
  var radarSegmentMap = {};
  var mixChartData = [];
  var dataStatLoaded = false;

  var SEGMENT_COLOR = '#699DFF';
  var AXIS_LABEL_COLOR = '#64748B';
  var AXIS_TEXT_COLOR = '#2c3e50';
  var GRID_LINE_COLOR = '#E5EDFF';

  /** 兼容 JDBC 返回的不同字段名 */
  function pick(obj) {
    var keys = Array.prototype.slice.call(arguments, 1);
    for (var i = 0; i < keys.length; i++) {
      var v = obj[keys[i]];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return null;
  }

  function asArray(data) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      return Object.keys(data)
        .filter(function (k) { return /^\d+$/.test(k); })
        .sort(function (a, b) { return Number(a) - Number(b); })
        .map(function (k) { return data[k]; });
    }
    return [];
  }

  function getRadarLabel(item, index) {
    return pick(item, 'radarname', 'radar_name', 'RADARNAME', 'RADAR_NAME', 'radarName')
      || pick(item, 'radarcode', 'RADARCODE', 'radarCode')
      || ('Station ' + ((index || 0) + 1));
  }

  /** 列表接口历史数据可能为字节；新接口已返回 GB */
  function toGb(bytesOrGb) {
    var n = parseFloat(bytesOrGb) || 0;
    if (n <= 0) return 0;
    if (n > 1048576) return Math.round(n / 1024 / 1024 / 1024 * 100) / 100;
    return Math.round(n * 100) / 100;
  }

  function resizeDataStatCharts() {
    Superdarn.safeResizeChartByDomId('yearVolumeTrendChart', 'yearTrend');
    Superdarn.safeResizeChartByDomId('fileBarChart', 'file');
    Superdarn.safeResizeChartByDomId('timeHorizontalBar', 'time');
  }

  function getChart(domId, chartKey) {
    var dom = document.getElementById(domId);
    if (!dom || typeof echarts === 'undefined') return null;

    var chart = echarts.getInstanceByDom(dom);
    if (!chart) chart = echarts.init(dom);
    if (chartKey) Superdarn.charts[chartKey] = chart;
    return chart;
  }

  function renderYearTrendChart() {
    Superdarn.apiGet(Superdarn.api + '/api/dashboard/yearly-volume-trend', {}, {
      target: '#yearVolumeTrendChart',
      success: function (res) {
        var payload = (res && res.data) ? res.data : res;
        if (!payload) return;
        loadYearTrendChart(payload);
      }
    });
  }

  function loadYearTrendChart(payload) {
    var myChart = getChart('yearVolumeTrendChart', 'yearTrend');
    if (!myChart) return;

    var historical = asArray(payload.historical || []);
    var forecast = payload.forecast || {};
    if (!historical.length) return;

    var forecastYear = String(forecast.year || '');
    var years = historical.map(function (item) {
      return String(pick(item, 'year', 'YEAR') || '');
    });
    var actualVolume = historical.map(function (item) {
      return toGb(pick(item, 'filesize', 'FILESIZE', 'fileSize'));
    });
    var forecastVolume = toGb(pick(forecast, 'filesize', 'FILESIZE', 'fileSize'));
    var forecastLabel = forecastYear ? forecastYear + ' (Forecast)' : 'Forecast';

    var categories = years.slice();
    var actualData = actualVolume.slice();
    var forecastData = [];
    var trendData = actualVolume.slice();

    if (forecastYear) {
      categories.push(forecastLabel);
      actualData.push(null);
      forecastData = historical.map(function () { return null; });
      forecastData.push(forecastVolume);
      trendData.push(forecastVolume);
    }

    try {
      myChart.setOption({
        color: ['#165DFF', '#FF7D00', '#36CFC9'],
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderColor: GRID_LINE_COLOR,
          borderWidth: 1,
          axisPointer: { type: 'shadow' },
          formatter: function (params) {
            if (!params || !params.length) return '';
            var title = params[0].axisValue || '';
            var html = '<div style="font-weight:600;margin-bottom:6px;">' + title + '</div>';
            params.forEach(function (p) {
              if (p.value === null || p.value === undefined || p.value === '') return;
              html += '<div>' + p.marker + ' ' + p.seriesName + ': <b>' + p.value + ' GB</b></div>';
            });
            return html;
          }
        },
        legend: {
          data: ['Actual Volume (GB)', 'Forecast Volume (GB)', 'Trend Line'],
          top: 0,
          textStyle: { color: AXIS_LABEL_COLOR, fontSize: 12 }
        },
        grid: {
          left: '2%',
          right: '3%',
          top: '16%',
          bottom: '10%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: categories,
          axisLabel: {
            rotate: categories.length > 10 ? 45 : 0,
            interval: 0,
            fontSize: 11,
            color: AXIS_LABEL_COLOR
          },
          axisLine: { lineStyle: { color: GRID_LINE_COLOR } },
          axisTick: { show: false }
        },
        yAxis: {
          type: 'value',
          name: 'Data Volume (GB)',
          nameTextStyle: { color: AXIS_LABEL_COLOR, fontSize: 12 },
          axisLabel: {
            formatter: '{value} GB',
            color: AXIS_LABEL_COLOR,
            fontSize: 11
          },
          splitLine: { lineStyle: { type: 'dashed', color: GRID_LINE_COLOR } }
        },
        series: [
          {
            name: 'Actual Volume (GB)',
            type: 'bar',
            barMaxWidth: 42,
            itemStyle: {
              borderRadius: [4, 4, 0, 0],
              color: '#165DFF'
            },
            data: actualData
          },
          {
            name: 'Forecast Volume (GB)',
            type: 'bar',
            barMaxWidth: 42,
            itemStyle: {
              borderRadius: [4, 4, 0, 0],
              color: 'rgba(255, 125, 0, 0.35)',
              borderColor: '#FF7D00',
              borderWidth: 2,
              borderType: 'dashed'
            },
            data: forecastData
          },
          {
            name: 'Trend Line',
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 7,
            lineStyle: { width: 2, color: '#36CFC9', type: 'dashed' },
            itemStyle: { color: '#36CFC9' },
            data: trendData
          }
        ]
      }, true);

      myChart.resize();
    } catch (e) {
      console.error('[dataStat] year trend chart error:', e);
    }
  }

  function renderFileChart() {
    Superdarn.apiGet(Superdarn.api + '/api/dashboard/getAWACFDataStatisticsSegments', {}, {
      target: '#fileBarChart',
      success: function (res) {
        var fileData = (res && res.data) ? res.data : res;
        if (!fileData) return;
        loadechartData(fileData);
      }
    });
  }

  function loadechartData(res) {
    if (!res || !res.radarNames || !res.segments) return;

    radarnameArr = res.radarNames.map(function (name, i) {
      return name || ('Station ' + (i + 1));
    });

    radardataArr = res.segments.map(function (seg, globalIdx) {
      return {
        itemStyle: { color: SEGMENT_COLOR },
        value: [
          Number(seg.radarIndex),
          Number(seg.start),
          Number(seg.end)
        ],
        segId: globalIdx,
        radarIndex: Number(seg.radarIndex)
      };
    });

    buildRadarSegmentMap();
    loadEchart();
  }

  function loadEchart() {
    var chartDom = document.getElementById('fileBarChart');
    if (!chartDom) return;

    chartDom.style.height = Math.max(480, radarnameArr.length * 28 + 100) + 'px';

    var myChart = getChart('fileBarChart', 'file');
    if (!myChart) return;

    try {
      myChart.setOption({
        tooltip: {
          trigger: 'item',
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderColor: GRID_LINE_COLOR,
          borderWidth: 1,
          padding: [10, 14],
          textStyle: { color: AXIS_TEXT_COLOR, fontSize: 13 },
          formatter: function (params) {
            var data = params.data;
            if (!data || !data.value) return '';

            var radarIndex = data.radarIndex;
            var currentSegId = data.segId;
            var radarName = radarnameArr[radarIndex] || ('Station ' + (radarIndex + 1));
            var segments = radarSegmentMap[radarIndex] || [];

            if (!segments.length) return radarName;

            var html = '<div style="font-weight:bold;margin-bottom:5px;">' + radarName + '</div>';
            segments.forEach(function (seg, idx) {
              var s = new Date(seg.value[1]);
              var e = new Date(seg.value[2]);
              var sStr = s.getFullYear() + '-' + String(s.getMonth() + 1).padStart(2, '0');
              var eStr = e.getFullYear() + '-' + String(e.getMonth() + 1).padStart(2, '0');
              var isCurrent = seg.segId === currentSegId;
              var color = isCurrent ? SEGMENT_COLOR : '#999';
              var prefix = isCurrent ? '●' : '○';
              html += '<div style="color:' + color + ';">'
                + prefix + ' Segment ' + (idx + 1) + ': ' + sStr + ' ~ ' + eStr + '</div>';
            });
            return html;
          }
        },
        legend: { show: false },
        grid: {
          left: '0%',
          right: '5%',
          bottom: '10%',
          containLabel: true
        },
        xAxis: {
          type: 'time',
          axisTick: { alignWithLabel: true },
          axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 11 },
          axisLine: { lineStyle: { color: GRID_LINE_COLOR } },
          splitLine: {
            show: true,
            lineStyle: { type: 'dashed', color: GRID_LINE_COLOR }
          },
          min: new Date('2004-01-01').getTime(),
          max: new Date('2028-12-31').getTime()
        },
        yAxis: {
          data: radarnameArr,
          axisTick: { alignWithLabel: true },
          axisLabel: { color: AXIS_TEXT_COLOR, fontSize: 11 }
        },
        series: [{
          type: 'custom',
          renderItem: function (params, api) {
            var categoryIndex = api.value(0);
            var start = api.coord([api.value(1), categoryIndex]);
            var end = api.coord([api.value(2), categoryIndex]);
            var height = 10;

            if (!start || !end || isNaN(start[0]) || isNaN(end[0])) {
              return null;
            }

            var rectShape = echarts.graphic.clipRectByRect({
              x: start[0],
              y: start[1] - height / 2,
              width: Math.max(end[0] - start[0], 2),
              height: height
            }, {
              x: params.coordSys.x,
              y: params.coordSys.y,
              width: params.coordSys.width,
              height: params.coordSys.height
            });

            if (!rectShape) return null;

            return {
              type: 'rect',
              shape: rectShape,
              style: api.style()
            };
          },
          encode: { x: [1, 2], y: 0 },
          data: radardataArr
        }]
      }, true);

      myChart.resize();
    } catch (e) {
      console.error('[dataStat] gantt chart error:', e);
    }
  }

  function buildRadarSegmentMap() {
    radarSegmentMap = {};
    radardataArr.forEach(function (seg) {
      var idx = seg.radarIndex;
      if (!radarSegmentMap[idx]) radarSegmentMap[idx] = [];
      radarSegmentMap[idx].push(seg);
    });
  }

  function renderTimeChart() {
    Superdarn.apiGet(Superdarn.api + '/api/dashboard/getAWACFDataStatisticsList', { month: Superdarn.statMonth }, {
      target: '#timeHorizontalBar',
      success: function (res) {
        mixChartData = asArray((res && res.data) ? res.data : []);
        loadMixChart();
      }
    });
  }

  function loadMixChart() {
    var myChart = getChart('timeHorizontalBar', 'time');
    if (!myChart) return;

    var rows = mixChartData.slice().map(function (item, index) {
      return {
        name: getRadarLabel(item, index),
        gb: toGb(pick(item, 'filesize', 'FILESIZE', 'fileSize')),
        count: parseInt(pick(item, 'count', 'COUNT', 'file_count', 'filecount'), 10) || 0
      };
    }).sort(function (a, b) {
      return b.gb - a.gb;
    });

    var xAxisData = rows.map(function (r) { return r.name; });
    var barData = rows.map(function (r) { return r.gb; });
    var lineData = rows.map(function (r) { return r.count; });

    try {
      myChart.setOption({
        color: ['#165DFF', '#FF7D00'],
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderColor: GRID_LINE_COLOR,
          borderWidth: 1,
          axisPointer: { type: 'cross', crossStyle: { color: '#999' } }
        },
        legend: {
          data: ['Data Volume (GB)', 'File Count'],
          top: 0,
          textStyle: { color: AXIS_LABEL_COLOR, fontSize: 12 }
        },
        grid: {
          left: '2%',
          right: '3%',
          top: '14%',
          bottom: '12%',
          containLabel: true
        },
        xAxis: [{
          type: 'category',
          data: xAxisData,
          axisPointer: { type: 'shadow' },
          axisLabel: {
            rotate: 45,
            interval: 0,
            fontSize: 11,
            color: AXIS_LABEL_COLOR
          },
          axisLine: { lineStyle: { color: GRID_LINE_COLOR } },
          axisTick: { show: false }
        }],
        yAxis: [
          {
            type: 'value',
            name: 'Data Volume (GB)',
            position: 'left',
            nameTextStyle: { color: AXIS_LABEL_COLOR, fontSize: 12 },
            axisLabel: {
              formatter: '{value} GB',
              color: AXIS_LABEL_COLOR,
              fontSize: 11
            },
            splitLine: { lineStyle: { type: 'dashed', color: GRID_LINE_COLOR } }
          },
          {
            type: 'value',
            name: 'File Count',
            position: 'right',
            nameTextStyle: { color: AXIS_LABEL_COLOR, fontSize: 12 },
            axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 11 },
            splitLine: { show: false }
          }
        ],
        series: [
          {
            name: 'Data Volume (GB)',
            type: 'bar',
            barMaxWidth: 36,
            itemStyle: {
              borderRadius: [4, 4, 0, 0],
              color: '#165DFF'
            },
            tooltip: {
              valueFormatter: function (value) { return value + ' GB'; }
            },
            data: barData
          },
          {
            name: 'File Count',
            type: 'line',
            yAxisIndex: 1,
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { width: 2, color: '#FF7D00' },
            itemStyle: { color: '#FF7D00' },
            data: lineData
          }
        ]
      }, true);

      myChart.resize();
    } catch (e) {
      console.error('[dataStat] mix chart error:', e);
    }
  }

  function renderAll() {
    renderYearTrendChart();
    renderFileChart();
    renderTimeChart();
  }

  Superdarn.registerTab('dataStat', {
    init: function () {},
    onShow: function () {
      if (!dataStatLoaded) {
        dataStatLoaded = true;
        setTimeout(renderAll, 120);
        return;
      }
      setTimeout(resizeDataStatCharts, 80);
    },
    resize: resizeDataStatCharts
  });

})(jQuery, window.Superdarn);
