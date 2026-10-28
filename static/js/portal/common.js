/**
 * 门户公共模块（common.js）
 * 提供全局命名空间 Superdarn、配置项、工具函数，供各 Tab 子脚本共享。
 */
(function ($, window) {
  'use strict';

  window.Superdarn = window.Superdarn || {};

  /**
   * API 根路径。
   * 本地 JSP：使用 index.jsp 注入的 ctx（"" 或 "/superdarn-monitor"），同源请求。
   * GitHub Pages：使用 config.js 里的 SUPERDARN_API（阿里云 HTTPS 地址）。
   */
  function resolveApiBase() {
    var fromConfig = window.SUPERDARN_API;
    var fromCtx = window.ctx;
    var raw = '';
    if (fromConfig != null && String(fromConfig).trim() !== '') {
      raw = String(fromConfig).trim();
    } else if (fromCtx != null && String(fromCtx).trim() !== '') {
      raw = String(fromCtx).trim();
    }
    return raw.replace(/\/+$/, '');
  }

  Superdarn.api = resolveApiBase();
  if (/YOUR_ALIYUN_DOMAIN/i.test(Superdarn.api)) {
    console.warn('[Superdarn] Edit docs/config.js and set window.SUPERDARN_API to your Aliyun HTTPS URL');
  }

  /** 把后端相对路径（如 /uploads/xxx）拼到 API 根上，供 GitHub Pages 使用 */
  Superdarn.assetUrl = function (path) {
    if (!path) return path;
    if (/^https?:\/\//i.test(path) || path.indexOf('data:') === 0) return path;
    var base = Superdarn.api || '';
    if (path.charAt(0) !== '/') {
      path = '/' + path;
    }
    return base + path;
  };

  /** 将富文本中的 /uploads/ 链接改写为后端绝对地址 */
  Superdarn.rewriteBackendUrls = function (target) {
    $(target).find('a[href], img[src], source[src], video[src]').each(function () {
      var $el = $(this);
      var attr = $el.is('a') ? 'href' : 'src';
      var val = $el.attr(attr);
      if (!val || /^https?:\/\//i.test(val) || val.indexOf('data:') === 0) return;
      if (val.indexOf('/uploads/') === -1) return;
      $el.attr(attr, Superdarn.assetUrl(val));
    });
  };
  /** 图表默认统计月份 */
  Superdarn.statMonth = '2026-06';
  /** 雷达站列表缓存（sync-calendar 模块写入，main 模块读取） */
  Superdarn.radarList = [];
  /** ECharts 实例集合，供 resize 使用 */
  Superdarn.charts = { sync: null, file: null, time: null, yearTrend: null };
  /** 各 Tab 模块注册表：{ init, onShow, resize } */
  Superdarn.tabs = {};

  /** 文案与图表标签配置 */
  Superdarn.config = {
    kpi3Title: 'Data Synchronization Rate',
    fitacf: 'FitACF Files',
    rawacf: 'RawACF Files',
    fileYAxis: 'Number of Files',
    timeXAxis: 'Continuous Release Duration (Hours)',
    timeSeries: 'RAWACF Release Duration',
    timeUnit: 'h',
    newsDate: 'Date: {b}<br>Sync Rate: {c}%',
    modalLoc: 'Venue',
    modalAgenda: 'Agenda',
    modalResult: 'Final Outcomes',
    modalManager: 'Person In Charge'
  };

  /** 防止 XSS：转义 HTML 特殊字符 */
  Superdarn.escapeHtml = function (str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  /** 图表容器是否处于可见 Tab 内且有尺寸 */
  Superdarn.isChartDomVisible = function (dom) {
    if (!dom || !dom.isConnected) return false;
    var panel = dom.closest('.content-panel');
    if (panel && !panel.classList.contains('active')) return false;
    return dom.clientWidth > 0 && dom.clientHeight > 0;
  };

  /**
   * 初始化 ECharts 实例（复用已有实例，不 dispose）。
   * @param {string} domId 容器元素 id
   * @param {string} chartKey charts 对象中的键名 sync|file|time
   */
  Superdarn.initChartInstance = function (domId, chartKey) {
    if (typeof echarts === 'undefined') return null;
    var dom = document.getElementById(domId);
    if (!dom) return null;

    var instance = echarts.getInstanceByDom(dom);
    if (!instance) {
      instance = echarts.init(dom);
    }

    if (chartKey) {
      Superdarn.charts[chartKey] = instance;
    }
    return instance;
  };

  /** 安全 resize：仅对可见且仍绑定 DOM 的实例执行 */
  Superdarn.safeResizeChart = function (instance) {
    if (!instance || typeof echarts === 'undefined') return;
    if (typeof instance.isDisposed === 'function' && instance.isDisposed()) return;

    var dom = instance.getDom && instance.getDom();
    if (!dom || !Superdarn.isChartDomVisible(dom)) return;

    var live = echarts.getInstanceByDom(dom);
    if (!live || live !== instance) return;

    try {
      instance.resize();
    } catch (err) {
      /* 忽略过渡阶段的 resize 异常 */
    }
  };

  /** 通过 DOM id 查找实例并安全 resize，同时刷新 charts 缓存 */
  Superdarn.safeResizeChartByDomId = function (domId, chartKey) {
    if (typeof echarts === 'undefined') return;
    var dom = document.getElementById(domId);
    if (!dom) return;

    var instance = echarts.getInstanceByDom(dom);
    if (!instance) return;

    if (chartKey) {
      Superdarn.charts[chartKey] = instance;
    }
    Superdarn.safeResizeChart(instance);
  };

  /** 窗口 resize：仅调整当前可见 Tab 内的图表 */
  Superdarn.resizeAllCharts = function () {
    var activePanel = document.querySelector('.content-panel.active');
    if (!activePanel) return;

    var panelId = activePanel.id;
    var tab = Superdarn.tabs[panelId];
    if (tab && typeof tab.resize === 'function') {
      tab.resize();
    }
  };

  /** Tab 切换后 resize 当前 Tab 图表 */
  Superdarn.resizeTabCharts = function (panelId) {
    var tab = Superdarn.tabs[panelId];
    if (tab && typeof tab.resize === 'function') {
      tab.resize();
    }
  };

  /** 注册 Tab 模块 */
  Superdarn.registerTab = function (panelId, handlers) {
    Superdarn.tabs[panelId] = handlers;
  };

  /** 触发指定 Tab 的 onShow（懒加载入口） */
  Superdarn.showTab = function (panelId) {
    var tab = Superdarn.tabs[panelId];
    if (tab && typeof tab.onShow === 'function') {
      tab.onShow();
    }
  };

  var loadingSeq = 0;
  var loadingRefs = {};

  function resolveLoadingTarget(target) {
    var $el;
    if (!target) {
      $el = $('.content-panel.active').first();
    } else if (typeof target === 'string') {
      $el = $(target).first();
    } else if (target.jquery) {
      $el = target.first();
    } else {
      $el = $(target);
    }
    return $el.length ? $el : $('body');
  }

  function getLoadingKey($el) {
    var key = $el.attr('data-portal-loading-key');
    if (!key) {
      key = 'portal-loading-' + (++loadingSeq);
      $el.attr('data-portal-loading-key', key);
    }
    return key;
  }

  function ensureLoadingHost($el) {
    if ($el.css('position') === 'static') {
      $el.attr('data-portal-loading-position', 'static');
      $el.css('position', 'relative');
    }
  }

  function restoreLoadingHost($el) {
    if ($el.attr('data-portal-loading-position') === 'static') {
      $el.css('position', '');
      $el.removeAttr('data-portal-loading-position');
    }
  }

  /** 在目标容器上显示 loading 遮罩（支持并发引用计数） */
  Superdarn.showLoading = function (target, text) {
    var $el = resolveLoadingTarget(target);
    var key = getLoadingKey($el);
    loadingRefs[key] = (loadingRefs[key] || 0) + 1;
    if (loadingRefs[key] > 1) return;

    ensureLoadingHost($el);
    $el.find('> .portal-loading-mask').remove();
    $el.append(
      '<div class="portal-loading-mask" role="status" aria-live="polite">' +
        '<div class="portal-loading-inner">' +
          '<i class="fas fa-spinner fa-spin portal-loading-icon"></i>' +
          '<span class="portal-loading-text">' + Superdarn.escapeHtml(text || 'Loading...') + '</span>' +
        '</div>' +
      '</div>'
    );
  };

  /** 隐藏目标容器 loading 遮罩 */
  Superdarn.hideLoading = function (target) {
    var $el = resolveLoadingTarget(target);
    var key = getLoadingKey($el);
    if (!loadingRefs[key]) return;

    loadingRefs[key] -= 1;
    if (loadingRefs[key] > 0) return;

    delete loadingRefs[key];
    $el.find('> .portal-loading-mask').remove();
    if (!$el.find('> .portal-loading-mask').length) {
      restoreLoadingHost($el);
    }
  };

  /** 延迟隐藏，确保同步 ECharts 渲染完成后再关闭 loading */
  Superdarn.scheduleHideLoading = function (target) {
    var hide = function () {
      Superdarn.hideLoading(target);
    };
    setTimeout(function () {
      if (window.requestAnimationFrame) {
        requestAnimationFrame(function () {
          requestAnimationFrame(hide);
        });
      } else {
        hide();
      }
    }, 0);
  };

  /**
   * 带 loading 的 GET JSON 请求。
   * @param {string} url
   * @param {object} [data]
   * @param {object} [options] { target, text, success, fail }
   */
  Superdarn.apiGet = function (url, data, options) {
    if ($.isPlainObject(data) && (data.target || data.success || data.fail || data.text)) {
      options = data;
      data = options.data || {};
    }
    options = options || {};
    var target = options.target;
    var text = options.text || 'Loading...';

    Superdarn.showLoading(target, text);

    return $.getJSON(url, data)
      .done(function (res) {
        if (typeof options.success === 'function') {
          options.success(res);
        }
      })
      .fail(function (xhr, status, err) {
        if (typeof options.fail === 'function') {
          options.fail(xhr, status, err);
        }
      })
      .always(function () {
        Superdarn.scheduleHideLoading(target);
      });
  };

  /**
   * 带 loading 的 Ajax 请求（POST/PUT/DELETE 等）。
   * options 中 target / loadingText 为 loading 配置，其余传给 $.ajax。
   */
  Superdarn.apiAjax = function (options) {
    options = options || {};
    var target = options.target;
    var text = options.loadingText || options.text || 'Loading...';
    var ajaxOptions = $.extend({}, options);
    delete ajaxOptions.target;
    delete ajaxOptions.loadingText;
    delete ajaxOptions.text;

    Superdarn.showLoading(target, text);

    return $.ajax(ajaxOptions).always(function () {
      Superdarn.scheduleHideLoading(target);
    });
  };

})(jQuery, window);
