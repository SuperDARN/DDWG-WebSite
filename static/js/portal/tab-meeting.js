/**
 * Tab: Meeting Minutes（radarNet）
 * 对应导航 data-page="radarNet"，负责会议卡片列表渲染与详情弹窗。
 */
(function ($, Superdarn) {
  'use strict';

  var escapeHtml = Superdarn.escapeHtml;

  /** 为详情按钮绑定 Ajax 请求与弹窗展示 */
  function bindDetailButtons() {
    $('.meet-detail-btn').off('click').on('click', function () {
      var id = $(this).data('id');
      $('#modalTitle').text('Loading...');
      $('#modalBody').html('');
      $('#modalMask').addClass('show');
      Superdarn.apiGet(Superdarn.api + '/api/dashboard/meetings/' + id, {
        target: '.modal-box',
        success: function (res) {
          if (res.code !== 0 || !res.data) return;
          var d = res.data;
          $('#modalTitle').text(d.title || 'Meeting');
          var metaHtml = '<div class="meet-modal-meta">';
          if (d.meetingDate) {
            metaHtml += '<span class="meet-modal-meta-item"><i class="far fa-calendar-alt"></i>' + escapeHtml(d.meetingDate) + '</span>';
          }
          if (d.location) {
            metaHtml += '<span class="meet-modal-meta-item"><i class="fas fa-map-marker-alt"></i>' + escapeHtml(d.location) + '</span>';
          }
          metaHtml += '</div>';
          var contentHtml = d.content ? '<div class="meet-modal-content">' + d.content + '</div>' : '';
          $('#modalBody').html(metaHtml + contentHtml);
          Superdarn.rewriteBackendUrls('#modalBody');
          // 处理富文本中的附件链接，使其可下载
          $('#modalBody').find('a[href*="/uploads/"]').each(function () {
            var $a = $(this);
            var href = $a.attr('href');
            var fileName = href.split('/').pop() || 'file';
            var altName = $a.attr('alt') || $a.text() || fileName;
            $a.attr({
              'target': '_blank',
              'download': altName,
              'title': 'Click to download: ' + altName
            }).addClass('attachment-link').prepend('<i class="fas fa-paperclip"></i> ');
          });
        }
      });
    });
  }

  /** 加载会议列表并插入 #meetingList */
  function loadMeetings() {
    Superdarn.apiGet(Superdarn.api + '/api/dashboard/meetings', {
      target: '#radarNet',
      success: function (res) {
        if (res.code !== 0) return;
        var html = '';
        (res.data || []).forEach(function (m) {
          html += '<li class="meet-card">' +
            '<div class="meet-card-header">' +
              '<h4 class="meet-card-title">' + escapeHtml(m.title) + '</h4>' +
              '<span class="meet-card-date"><i class="far fa-calendar-alt"></i>' + (m.meetingDate || '') + '</span>' +
            '</div>' +
            (m.mainTopics ? '<p class="meet-card-topics"><i class="fas fa-bookmark"></i>' + escapeHtml(m.mainTopics) + '</p>' : '') +
            '<div class="meet-card-footer">' +
              '<button class="meet-detail-btn" data-id="' + m.id + '"><i class="fas fa-file-alt"></i>View Detail</button>' +
            '</div>' +
          '</li>';
        });
        $('#meetingList').html(html);
        bindDetailButtons();
      }
    });
  }

  /** 绑定弹窗关闭事件（会议详情共用 modal.jspf） */
  function bindModalClose() {
    $('#modalClose, #modalMask').on('click', function (e) {
      if (e.target === this || $(this).is('#modalClose')) {
        $('#modalMask').removeClass('show');
      }
    });
  }

  Superdarn.registerTab('radarNet', {
    init: function () {
      bindModalClose();
      loadMeetings();
    },
    onShow: function () { /* 列表已在 init 加载 */ }
  });

})(jQuery, window.Superdarn);
