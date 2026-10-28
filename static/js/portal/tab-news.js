/**
 * Tab: Platform & O&M News（news）
 * 对应导航 data-page="news"，负责运维动态列表渲染。
 */
(function ($, Superdarn) {
  'use strict';

  var escapeHtml = Superdarn.escapeHtml;

  /** 加载新闻列表并插入 #newsList */
  function loadNews() {
    Superdarn.apiGet(Superdarn.api + '/api/dashboard/news', {
      target: '#news',
      success: function (res) {
        if (res.code !== 0) return;
        var html = '';
        (res.data || []).forEach(function (n) {
          html += '<li class="list-item">' +
            '<p class="list-date"><i class="far fa-calendar"></i>' + (n.newsDate || '') + '</p>' +
            '<h3 class="list-title"><i class="fas fa-cog"></i>' + escapeHtml(n.title) + '</h3>' +
            '<p class="list-desc">' + escapeHtml(n.description) + '</p>' +
            '<div class="list-bottom"><span class="list-tag"><i class="fas fa-tag"></i>' + escapeHtml(n.tag) + '</span></div>' +
            '</li>';
        });
        $('#newsList').html(html);
      }
    });
  }

  Superdarn.registerTab('news', {
    init: function () {
      loadNews();
    },
    onShow: function () { /* 列表已在 init 加载 */ }
  });

})(jQuery, window.Superdarn);
