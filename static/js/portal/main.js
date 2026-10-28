/**
 * 门户入口模块（main.js）
 * 负责：Tab 导航切换、各子模块 init/onShow 调度、窗口 resize。
 *
 * 加载顺序（index.jsp）：
 * common.js → tab-*.js → main.js
 */
(function ($, Superdarn) {
  'use strict';

  /** 所有 Tab 面板 id，与 header.jspf 中 data-page 一致 */
  var TAB_IDS = ['overview', 'syncCalendar', 'fileVolume', 'rawacfStat', 'membership', 'charter', 'radarNet', 'blocklist', 'news'];

  /**
   * 绑定主导航 Tab 切换。
   * 步骤：切换样式 → 显示 panel → 控制 KPI 区 → 触发 onShow → resize 当前 Tab 图表
   */
  function bindNav() {
    $('.main-nav a[data-page]').on('click', function (e) {
      e.preventDefault();
      var targetId = $(this).data('page');

      $('.main-nav a[data-page]').removeClass('active');
      $(this).addClass('active');
      $('.content-panel').removeClass('active');
      $('#' + targetId).addClass('active');

      // Overview 面板显示 KPI 四卡片和滚动消息条，其他 Tab 隐藏
      $('#kpiWrap').toggleClass('show', targetId === 'overview');
      $('#tickerWrap').toggleClass('show', targetId === 'overview');

      // 懒加载当前 Tab 数据/图表
      Superdarn.showTab(targetId);

      // 面板显示后再 resize，仅调整当前 Tab，避免 hidden 图表报错
      setTimeout(function () {
        Superdarn.resizeTabCharts(targetId);
      }, 150);
    });
  }

  /** 依次调用各 Tab 模块的 init */
  function initAllTabs() {
    TAB_IDS.forEach(function (id) {
      var tab = Superdarn.tabs[id];
      if (tab && typeof tab.init === 'function') {
        tab.init();
      }
    });
  }

  $(function () {
    bindNav();
    initAllTabs();

    $(window).on('resize', Superdarn.resizeAllCharts);
  });

})(jQuery, window.Superdarn);
