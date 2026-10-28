/**
 * Tab: RAWACF Data Statistics（rawacfStat）
 * 图表：Continuous RAWACF Data Statistics By Radar（Gantt）
 * 支持两种视图：All Years（全量时间线）/ By Year（按月查看某年数据连续性）
 */
(function ($, Superdarn) {
  'use strict';

  var radarnameArr = [];
  var radardataArr = [];
  var radarSegmentMap = {};
  var rawacfStatLoaded = false;

  /* 视图状态：'allYears' | 'byYear' */
  var currentView = 'allYears';
  var allYearsRawData = null;   // 缓存 All Years 数据
  var availableYears = [];       // 从 All Years 数据中提取的年份列表
  var monthViewRadarNames = [];  // 月视图的雷达名称列表
  var currentZoomRangeDays = 9000; // 当前时间轴可见范围（天），用于动态格式化标签

  var MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var SEGMENT_COLOR = '#4D8BFF';
  var HAS_DATA_COLOR = '#165DFF';
  var NO_DATA_BG = '#F0F4FA';
  var ROW_BG_COLOR = '#F5F8FD';
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

  function resizeRawacfStatCharts() {
    Superdarn.safeResizeChartByDomId('fileBarChart', 'file');
  }

  function getChart(domId, chartKey) {
    var dom = document.getElementById(domId);
    if (!dom || typeof echarts === 'undefined') return null;

    var chart = echarts.getInstanceByDom(dom);
    if (!chart) chart = echarts.init(dom);
    if (chartKey) Superdarn.charts[chartKey] = chart;
    return chart;
  }

  /* ========== All Years 视图（原始 Gantt 时间线） ========== */

  /** 隐藏加载指示器 */
  function hideLoading() {
    var el = document.getElementById('fileBarChartLoading');
    if (el) el.hidden = true;
  }

  /**
   * 仅预取数据到缓存（不渲染图表）。
   * 页面加载时调用，让后端缓存命中，后续点击 Tab 时直接渲染。
   */
  function prefetchAllYearsData() {
    if (allYearsRawData) return;
    Superdarn.apiGet(Superdarn.api + '/api/dashboard/getAWACFDataStatisticsSegments', {}, {
      target: '#fileBarChart',
      success: function (res) {
        var fileData = (res && res.data) ? res.data : res;
        if (!fileData) return;
        allYearsRawData = fileData;
        extractYearsFromSegments(fileData.segments);
      }
    });
  }

  function renderAllYearsChart() {
    if (allYearsRawData) {
      loadechartData(allYearsRawData);
      return;
    }
    Superdarn.apiGet(Superdarn.api + '/api/dashboard/getAWACFDataStatisticsSegments', {}, {
      target: '#fileBarChart',
      success: function (res) {
        var fileData = (res && res.data) ? res.data : res;
        if (!fileData) { hideLoading(); return; }
        allYearsRawData = fileData;
        extractYearsFromSegments(fileData.segments);
        loadechartData(fileData);
        hideLoading();
      },
      error: function () { hideLoading(); }
    });
  }

  /** 从段数据中提取可用的年份范围（用于填充年份下拉框） */
  function extractYearsFromSegments(segments) {
    if (!segments || !segments.length) {
      availableYears = [];
      return;
    }
    var minYear = 9999, maxYear = 0;
    segments.forEach(function (seg) {
      var s = new Date(seg.start);
      var e = new Date(seg.end);
      var sy = s.getFullYear();
      var ey = e.getFullYear();
      if (sy < minYear) minYear = sy;
      if (ey > maxYear) maxYear = ey;
    });
    availableYears = [];
    for (var y = maxYear; y >= minYear; y--) {
      availableYears.push(y);
    }
  }

  function loadechartData(res) {
    if (!res || !res.radarNames || !res.segments) return;

    radarnameArr = res.radarNames.map(function (name, i) {
      return name || ('Station ' + (i + 1));
    });

    radardataArr = res.segments.map(function (seg, globalIdx) {
      var fc = Number(seg.fileCount) || 0;
      return {
        itemStyle: { color: SEGMENT_COLOR },
        value: [
          Number(seg.radarIndex),
          Number(seg.start),
          Number(seg.end),
          fc
        ],
        segId: globalIdx,
        radarIndex: Number(seg.radarIndex),
        fileCount: fc
      };
    });

    buildRadarSegmentMap();
    loadAllYearsEchart();
  }

  /**
   * 根据可见时间范围动态决定 X 轴标签格式。
   * 缩放越大（范围越小），显示越精细：年 → 月 → 日
   */
  function timeAxisFormatter(value, index) {
    var d = new Date(value);
    var rangeDays = currentZoomRangeDays || 9000;
    if (rangeDays <= 90) {
      // 日级别：显示 yyyy-MM-dd
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    } else if (rangeDays <= 730) {
      // 月级别：显示 yyyy-MM
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }
    // 年级别：显示 yyyy
    return String(d.getFullYear());
  }

  function loadAllYearsEchart() {
    var chartDom = document.getElementById('fileBarChart');
    if (!chartDom) return;

    chartDom.style.height = Math.max(480, radarnameArr.length * 28 + 120) + 'px';

    var myChart = getChart('fileBarChart', 'file');
    if (!myChart) return;

    // 根据时间范围计算当前缩放级别对应的天数
    var minTs = new Date('2004-01-01').getTime();
    var maxTs = new Date('2028-12-31').getTime();
    var totalDays = (maxTs - minTs) / 86400000;
    currentZoomRangeDays = totalDays; // 初始为全量范围

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
            if (!data || !data.value || data.radarIndex === undefined) return '';

            var radarIndex = data.radarIndex;
            var currentSegId = data.segId;
            var radarName = radarnameArr[radarIndex] || ('Station ' + (radarIndex + 1));
            var segments = radarSegmentMap[radarIndex] || [];

            if (!segments.length) return radarName;

            // 根据缩放级别选择日期格式
            var rangeDays = currentZoomRangeDays || 9000;
            var fmtDate = function (ts) {
              var d = new Date(ts);
              if (rangeDays <= 90) {
                return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
              } else if (rangeDays <= 730) {
                return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
              }
              return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            };

            var html = '<div style="font-weight:bold;margin-bottom:5px;">' + radarName + '</div>';
            segments.forEach(function (seg, idx) {
              var sStr = fmtDate(seg.value[1]);
              var eStr = fmtDate(seg.value[2]);
              var fc = seg.fileCount || 0;
              var isCurrent = seg.segId === currentSegId;
              var color = isCurrent ? (seg.itemStyle ? seg.itemStyle.color : SEGMENT_COLOR) : '#999';
              var prefix = isCurrent ? '●' : '○';
              html += '<div style="color:' + color + ';">'
                + prefix + ' Segment ' + (idx + 1) + ': ' + sStr + ' ~ ' + eStr
                + ' <span style="color:#666;">(' + fc + ' files)</span></div>';
            });
            return html;
          }
        },
        legend: { show: false },
        grid: {
          left: '0%',
          right: '5%',
          top: '4%',
          bottom: '20%',
          containLabel: true
        },
        xAxis: [
          {
            // 底部 X 轴
            type: 'time',
            position: 'bottom',
            axisTick: { alignWithLabel: true },
            axisLabel: {
              color: AXIS_LABEL_COLOR,
              fontSize: 11,
              formatter: timeAxisFormatter
            },
            axisLine: { lineStyle: { color: GRID_LINE_COLOR } },
            splitLine: {
              show: true,
              lineStyle: { type: 'dashed', color: GRID_LINE_COLOR }
            },
            min: minTs,
            max: maxTs
          },
          {
            // 顶部 X 轴（镜像，与底部同步缩放）
            type: 'time',
            position: 'top',
            axisTick: { alignWithLabel: true },
            axisLabel: {
              color: AXIS_LABEL_COLOR,
              fontSize: 11,
              formatter: timeAxisFormatter
            },
            axisLine: { lineStyle: { color: GRID_LINE_COLOR } },
            splitLine: { show: false },
            min: minTs,
            max: maxTs
          }
        ],
        yAxis: {
          data: radarnameArr,
          axisTick: { alignWithLabel: true },
          axisLabel: { color: AXIS_TEXT_COLOR, fontSize: 11 }
        },
        dataZoom: [
          {
            type: 'slider',
            xAxisIndex: [0, 1],
            start: 0,
            end: 100,
            bottom: 4,
            height: 36,
            left: '3%',
            right: '3%',
            borderColor: GRID_LINE_COLOR,
            fillerColor: 'rgba(77,139,255,0.15)',
            handleIcon: 'path://M10.7,11.9H9.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4h1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z',
            handleSize: '120%',
            handleStyle: {
              color: '#4D8BFF',
              borderColor: '#4D8BFF',
              shadowBlur: 4,
              shadowColor: 'rgba(77,139,255,0.3)',
              shadowOffsetX: 0,
              shadowOffsetY: 2
            },
            textStyle: { color: AXIS_LABEL_COLOR, fontSize: 11 },
            labelFormatter: function (value) {
              if (!value && value !== 0) return '';
              var d = new Date(value);
              if (isNaN(d.getTime())) return '';
              return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            },
            dataBackground: {
              lineStyle: { color: '#4D8BFF', opacity: 0.3 },
              areaStyle: { color: '#4D8BFF', opacity: 0.08 }
            },
            selectedDataBackground: {
              lineStyle: { color: '#4D8BFF' },
              areaStyle: { color: '#4D8BFF', opacity: 0.15 }
            },
            brushSelect: false,
            throttle: 50
          },
          {
            type: 'inside',
            xAxisIndex: [0, 1],
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            moveOnMouseWheel: false,
            throttle: 50
          }
        ],
        series: [
          {
            // 背景行：每个雷达站始终有浅色背景条
            type: 'custom',
            renderItem: function (params, api) {
              var categoryIndex = api.value(0);
              var bandWidth = api.size([0, 1])[1];
              var y = api.coord([0, categoryIndex])[1];
              var xStart = params.coordSys.x;
              var width = params.coordSys.width;
              var rowHeight = Math.max(bandWidth * 0.6, 14);

              return {
                type: 'rect',
                shape: {
                  x: xStart,
                  y: y - rowHeight / 2,
                  width: width,
                  height: rowHeight
                },
                style: {
                  fill: ROW_BG_COLOR,
                  stroke: 'none'
                },
                silent: true,
                z: 0
              };
            },
            encode: { y: 0 },
            data: radarnameArr.map(function (name, i) {
              return { value: [i] };
            }),
            z: 0
          },
          {
            // 数据段
            type: 'custom',
            renderItem: function (params, api) {
              var categoryIndex = api.value(0);
              var start = api.coord([api.value(1), categoryIndex]);
              var end = api.coord([api.value(2), categoryIndex]);
              var bandWidth = api.size([0, 1])[1];
              var height = Math.max(bandWidth * 0.5, 12);

              if (!start || !end || isNaN(start[0]) || isNaN(end[0])) {
                return null;
              }

              var segWidth = Math.max(end[0] - start[0], 4);

              var rectShape = echarts.graphic.clipRectByRect({
                x: start[0],
                y: start[1] - height / 2,
                width: segWidth,
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
                style: api.style(),
                z: 10
              };
            },
            encode: { x: [1, 2], y: 0 },
            data: radardataArr,
            z: 10
          }
        ]
      }, true);

      // 监听 dataZoom 事件，动态更新 currentZoomRangeDays 并刷新轴标签
      myChart.on('datazoom', function (params) {
        try {
          var option = myChart.getOption();
          if (!option || !option.dataZoom || !option.dataZoom.length) return;
          var dz = option.dataZoom[0];
          var startPct = (dz.start != null) ? dz.start : 0;
          var endPct = (dz.end != null) ? dz.end : 100;
          // 根据百分比和全量时间范围计算可见天数
          var minTs = new Date('2004-01-01').getTime();
          var maxTs = new Date('2028-12-31').getTime();
          var totalDays = (maxTs - minTs) / 86400000;
          currentZoomRangeDays = totalDays * (endPct - startPct) / 100;
          // 强制 ECharts 重新渲染两根 X 轴的标签
          myChart.setOption({
            xAxis: [
              { axisLabel: { formatter: timeAxisFormatter } },
              { axisLabel: { formatter: timeAxisFormatter } }
            ]
          });
        } catch (ex) {
          console.warn('[rawacfStat] datazoom handler error:', ex);
        }
      });

      myChart.resize();
    } catch (e) {
      console.error('[rawacfStat] all-years gantt chart error:', e);
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

  /* ========== By Year 视图（月维度热力图） ========== */

  function renderMonthView(year) {
    Superdarn.apiGet(Superdarn.api + '/api/dashboard/rawacf-monthly-by-year', { year: year }, {
      target: '#fileBarChart',
      success: function (res) {
        var rows = (res && res.data) ? res.data : res;
        if (!rows) return;
        loadMonthViewChart(rows, year);
      }
    });
  }

  function loadMonthViewChart(rows, year) {
    var chartDom = document.getElementById('fileBarChart');
    if (!chartDom) return;

    // 首先获取所有雷达站列表（使用与全量时间线视图相同的数据源）
    Superdarn.apiGet(Superdarn.api + '/api/dashboard/getAWACFDataStatisticsSegments', {}, {
      target: '#fileBarChart',
      success: function (res) {
        var allYearsData = (res && res.data) ? res.data : res;
        if (!allYearsData || !allYearsData.radarNames) return;

        // 按 radarcode 分组月度数据
        var radarDataMap = {};
        rows.forEach(function (row) {
          var code = pick(row, 'radarcode', 'RADARCODE', 'radarCode');
          var name = pick(row, 'radarname', 'radar_name', 'RADARNAME', 'RADAR_NAME', 'radarName') || code;
          if (!radarDataMap[code]) {
            radarDataMap[code] = { name: name, months: {} };
          }
          var monthNum = parseInt(pick(row, 'month_num', 'MONTH_NUM', 'monthNum', 'month'), 10) || 0;
          radarDataMap[code].months[monthNum] = {
            fileCount: parseInt(pick(row, 'file_count', 'fileCount', 'FILE_COUNT', 'count'), 10) || 0,
            fileSize: parseFloat(pick(row, 'filesize', 'fileSize', 'FILESIZE')) || 0
          };
        });

        // 使用与全量时间线视图相同的雷达名称列表
        var allRadarNames = allYearsData.radarNames;

        chartDom.style.height = Math.max(480, allRadarNames.length * 28 + 100) + 'px';

        // 构建热力图数据：[monthIndex, radarIndex, fileCount]
        var heatData = [];
        var maxCount = 0;
        
        // 遍历所有雷达（按全量数据中的顺序）
        for (var radarIdx = 0; radarIdx < allRadarNames.length; radarIdx++) {
          // 查找该雷达在月度数据中的code
          var radarName = allRadarNames[radarIdx];
          
          // 由于我们不知道雷达名称对应的code，我们需要反向查找
          var radarCode = null;
          for (var code in radarDataMap) {
            if (radarDataMap[code].name === radarName) {
              radarCode = code;
              break;
            }
          }
          
          // 如果找到了对应的雷达数据，则使用它，否则使用空数据
          var radarData = radarCode ? radarDataMap[radarCode] : null;
          
          // 为每个月份生成数据
          for (var m = 1; m <= 12; m++) {
            var md = radarData ? radarData.months[m] : null;
            var count = md ? md.fileCount : 0;
            var size = md ? md.fileSize : 0;
            heatData.push([m - 1, radarIdx, count, size]);
            if (count > maxCount) maxCount = count;
          }
        }

        var myChart = getChart('fileBarChart', 'file');
        if (!myChart) return;

        try {
          myChart.setOption({
            tooltip: {
              position: 'top',
              backgroundColor: 'rgba(255,255,255,0.96)',
              borderColor: GRID_LINE_COLOR,
              borderWidth: 1,
              padding: [10, 14],
              textStyle: { color: AXIS_TEXT_COLOR, fontSize: 13 },
              formatter: function (params) {
                var d = params.data;
                var radarName = allRadarNames[d[1]] || ('Station ' + (d[1] + 1));
                var monthLabel = MONTH_LABELS[d[0]];
                var count = d[2];
                var size = d[3];
                var statusHtml = count > 0
                  ? '<span style="color:' + HAS_DATA_COLOR + ';font-weight:600;">● Has Data</span>'
                  : '<span style="color:#aaa;">○ No Data</span>';
                return '<div style="font-weight:bold;margin-bottom:5px;">' + radarName + ' — ' + year + ' ' + monthLabel + '</div>'
                  + '<div>' + statusHtml + '</div>'
                  + (count > 0
                    ? '<div style="margin-top:3px;">Files: <b>' + count + '</b> &nbsp;|&nbsp; Size: <b>' + size + ' GB</b></div>'
                    : '');
              }
            },
            grid: {
              left: '0%',
              right: '3%',
              top: '8%',
              bottom: '3%',
              containLabel: true
            },
            xAxis: {
              type: 'category',
              data: MONTH_LABELS,
              position: 'top',
              splitArea: { show: true, areaStyle: { color: ['#fff', '#FAFBFF'] } },
              axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 12, fontWeight: 500 },
              axisLine: { lineStyle: { color: GRID_LINE_COLOR } },
              axisTick: { show: false }
            },
            yAxis: {
              type: 'category',
              data: allRadarNames,
              axisLabel: { color: AXIS_TEXT_COLOR, fontSize: 11 },
              axisTick: { alignWithLabel: true },
              axisLine: { lineStyle: { color: GRID_LINE_COLOR } }
            },
            visualMap: {
              show: false,
              dimension: 2,
              pieces: [
                { gte: 0, lt: 1, color: '#E8ECF2' },
                { gte: 1, color: '#4D8BFF' }
              ],
              outOfRange: {
                color: '#E8ECF2'
              }
            },
            series: [{
              type: 'heatmap',
              data: heatData,
              label: {
                show: true,
                formatter: function (params) {
                  return params.data[2] > 0 ? params.data[2] : '';
                },
                color: '#fff',
                fontSize: 10,
                fontWeight: 600
              },
              emphasis: {
                itemStyle: {
                  shadowBlur: 6,
                  shadowColor: 'rgba(22, 93, 255, 0.4)'
                }
              },
              itemStyle: {
                borderColor: '#fff',
                borderWidth: 2,
                borderRadius: 3
              }
            }]
          }, true);

          myChart.resize();
        } catch (e) {
          console.error('[rawacfStat] month view chart error:', e);
        }
      }
    });
  }

  /* ========== 工具栏交互 ========== */

  function populateYearSelect() {
    var $select = $('#rawacfYearSelect');
    $select.empty();
    if (!availableYears.length) {
      // 如果还没加载过数据，用当前年份附近范围
      var curYear = new Date().getFullYear();
      for (var y = curYear; y >= curYear - 20; y--) {
        availableYears.push(y);
      }
    }
    availableYears.forEach(function (y) {
      $select.append('<option value="' + y + '">' + y + '</option>');
    });
  }

  function switchView(view) {
    currentView = view;

    // 更新按钮激活状态
    $('.rawacf-view-btn').removeClass('active');
    $('.rawacf-view-btn[data-view="' + view + '"]').addClass('active');

    // 显示/隐藏年份选择器
    if (view === 'byYear') {
      if (!$('#rawacfYearSelect option').length) {
        populateYearSelect();
      }
      $('#rawacfYearPicker').show();
      $('#rawacfGanttDesc').text('Monthly RAWACF data continuity for all radar stations in the selected year');
      var year = $('#rawacfYearSelect').val() || String(new Date().getFullYear());
      renderMonthView(year);
    } else {
      $('#rawacfYearPicker').hide();
      $('#rawacfGanttDesc').text('Continuous RAWACF release coverage per radar station on the timeline');
      renderAllYearsChart();
    }
  }

  function bindToolbar() {
    $(document).on('click', '.rawacf-view-btn', function () {
      var view = $(this).data('view');
      if (view === currentView) return;
      switchView(view);
    });

    $(document).on('change', '#rawacfYearSelect', function () {
      var year = $(this).val();
      if (year && currentView === 'byYear') {
        renderMonthView(year);
      }
    });
  }

  /* ========== Tab 注册 ========== */

  Superdarn.registerTab('rawacfStat', {
    init: function () {
      bindToolbar();
      // 页面加载即异步预取数据（后端有缓存，二次访问极快）
      // 仅取数据不渲染图表（隐藏 div 尺寸为 0，ECharts 需可见时才渲染）
      setTimeout(prefetchAllYearsData, 100);
    },
    onShow: function () {
      if (!rawacfStatLoaded) {
        rawacfStatLoaded = true;
        if (allYearsRawData) {
          // 数据已预取，直接渲染（无需等待网络请求）
          setTimeout(function () {
            loadechartData(allYearsRawData);
            hideLoading();
          }, 80);
        } else {
          // 数据尚未返回，等待网络请求完成后渲染
          setTimeout(function () {
            renderAllYearsChart();
          }, 120);
        }
        return;
      }
      setTimeout(resizeRawacfStatCharts, 80);
    },
    resize: resizeRawacfStatCharts
  });

})(jQuery, window.Superdarn);
