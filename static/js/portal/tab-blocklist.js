/**
 * Tab: Blocklist（blocklist）
 * 展示 GitHub SuperDARN/DDWG Blocklist 目录文件列表，支持预览与手动同步。
 */
(function ($, Superdarn) {
  'use strict';

  var escapeHtml = Superdarn.escapeHtml;
  var loaded = false;

  function formatSize(bytes) {
    if (bytes == null || bytes === 0) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function formatTime(val) {
    if (!val) return '-';
    return String(val).replace('T', ' ').substring(0, 19);
  }

  function truncateCommitMessage(message, maxLength) {
    if (!message) return '-';
    return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
  }

  function bindPreviewButtons() {
    $('.blocklist-preview-btn').off('click').on('click', function () {
      var id = $(this).data('id');
      $('#modalTitle').text('Loading...');
      $('#modalBody').html('');
      $('#modalMask').addClass('show');
      Superdarn.apiGet(Superdarn.api + '/api/dashboard/blocklist/' + id, {
        target: '.modal-box',
        success: function (res) {
          if (res.code !== 0 || !res.data) return;
          var d = res.data;
          $('#modalTitle').text(d.fileName || 'Blocklist');
          $('#modalBody').html(
            '<div class="blocklist-preview-meta">' +
            '<span><i class="fas fa-weight-hanging"></i> ' + formatSize(d.fileSize) + '</span>' +
            '<span><i class="fas fa-clock"></i> Synced: ' + formatTime(d.syncTime) + '</span>' +
            (d.downloadUrl ? '<a href="' + escapeHtml(d.downloadUrl) + '" target="_blank" rel="noopener">' +
              '<i class="fas fa-download"></i> Download</a>' : '') +
            '</div>' +
            '<pre class="blocklist-preview">' + escapeHtml(d.content || '') + '</pre>'
          );
        }
      });
    });
  }

  function bindModalClose() {
    $('#modalClose, #modalMask').off('click.blocklist').on('click.blocklist', function (e) {
      if (e.target === this || $(this).is('#modalClose')) {
        $('#modalMask').removeClass('show');
      }
    });
  }

  function renderList(data) {
    var files = data.files || [];
    var html = '';

    if (!files.length) {
      html = '<div class="blocklist-empty"><i class="fas fa-folder-open"></i><p>No blocklist files yet. Syncing from GitHub...</p></div>';
    } else {
      html += '<div class="blocklist-table-wrap"><table class="blocklist-table">' +
        '<colgroup>' +
        '<col class="col-name"><col class="col-size"><col class="col-commit"><col class="col-message"><col class="col-actions">' +
        '</colgroup>' +
        '<thead><tr>' +
        '<th>File Name</th><th>Size</th><th>Last commit date</th><th>Last commit message</th><th>Actions</th>'
        '</tr></thead><tbody>';
      files.forEach(function (f) {
        html += '<tr>' +
          '<td class="blocklist-name"><i class="fas fa-file-alt"></i>' + escapeHtml(f.fileName) + '</td>' +
          '<td class="blocklist-size">' + formatSize(f.fileSize) + '</td>' +
          '<td class="blocklist-commit-time">' + formatTime(f.githubUpdatedAt || f.syncTime) + '</td>' +
          '<td class="blocklist-commit-message" title="' + escapeHtml(f.githubCommitMessage || '') + '">' + escapeHtml(truncateCommitMessage(f.githubCommitMessage || '', 50)) + '</td>' +
          '<td class="blocklist-actions">' +
          // '<button type="button" class="blocklist-preview-btn" data-id="' + f.id + '">' +
          // '<i class="fas fa-eye"></i> Preview</button>' +
          (f.id ? '<a class="blocklist-download-btn" href="' + Superdarn.api + '/api/dashboard/blocklist/' + f.id + '/download"' +
            ' title="Download"><i class="fas fa-download"></i></a>' : '') +
          '</td></tr>';
      });
      html += '</tbody></table></div>';
    }

    $('#blocklistContent').html(html);
    bindPreviewButtons();
  }

  function updateMeta(data) {
    var source = data.sourceUrl || 'https://github.com/SuperDARN/DDWG/tree/main/Blocklist';
    var sync = formatTime(data.lastSyncTime);
    $('#blocklistMeta').html(
      '<span class="meta-item">' +
      '<i class="fab fa-github"></i>' +
      '<span>Source: <a href="' + escapeHtml(source) +
      '" target="_blank" rel="noopener">SuperDARN/DDWG/Blocklist</a></span></span>' +
      '<span class="meta-item">' +
      '<i class="fas fa-clock"></i>' +
      '<span>Last sync: ' + sync + '</span></span>'
    );
  }

  function loadBlocklist() {
    Superdarn.apiGet(Superdarn.api + '/api/dashboard/blocklist', {
      target: '#blocklist',
      success: function (res) {
        if (res.code !== 0) return;
        updateMeta(res.data || {});
        renderList(res.data || {});
        loaded = true;
      }
    });
  }

  function syncBlocklist($btn) {
    $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Syncing...');
    Superdarn.apiAjax({
      url: Superdarn.api + '/api/dashboard/blocklist/sync',
      type: 'POST',
      target: '#blocklist',
      loadingText: 'Syncing blocklist...',
      success: function (res) {
        if (res.code === 0) {
          loadBlocklist();
        } else {
          loadBlocklist();
          var tip = res.msg || 'Sync failed';
          $('#blocklistMeta').append(
            '<span class="meta-item" style="color:#b45309"><i class="fas fa-exclamation-triangle"></i> ' +
            escapeHtml(tip) + '</span>'
          );
        }
      },
      complete: function () {
        $btn.prop('disabled', false).html('<i class="fas fa-sync-alt"></i> Sync Now');
      }
    });
  }

  Superdarn.registerTab('blocklist', {
    init: function () {
      bindModalClose();
      $('#blocklistSyncBtn').on('click', function () {
        syncBlocklist($(this));
      });
      loadBlocklist();
    },
    onShow: function () {
      if (!loaded) {
        loadBlocklist();
      }
    }
  });

})(jQuery, window.Superdarn);
