/**
 * Tab: Membership
 * 从 DDWG charter.md 解析并展示成员信息（Chair / Members / Observers）
 */
(function ($, Superdarn) {
  'use strict';

  var membershipLoaded = false;

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
      if (match) {
        flush();
        currentTitle = match[1].trim();
        buffer = [];
        return;
      }
      if (currentTitle) buffer.push(line);
    });
    flush();
    return sections;
  }

  function findSection(sections, title) {
    var lower = title.toLowerCase();
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].title.toLowerCase().indexOf(lower) >= 0) return sections[i];
    }
    return null;
  }

  function parseMembershipRows(text) {
    var rows = [];
    if (!text) return rows;
    text.split('\n').forEach(function (line) {
      var m = line.match(/^\|?\s*(Chair|Member|Observer)\s*\|\s*([^|]+)\|\s*([^|]+)/i);
      if (m) {
        rows.push({
          role: m[1].trim(),
          name: m[2].trim(),
          institution: m[3].trim()
        });
      }
    });
    return rows;
  }

  function extractMembershipIntro(body) {
    if (!body) return '';
    var lines = body.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line || line.charAt(0) === '|' || /^---/.test(line)) continue;
      if (/responsibilty|radars/i.test(line) && /name|institution/i.test(line)) continue;
      return line;
    }
    return '';
  }

  function extractEmail(body) {
    if (!body) return '';
    var m = body.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    return m ? m[0] : '';
  }

  /* ========== 渲染 ========== */

  function renderMembership(content) {
    var $wrap = $('#membershipWrap');
    if (!content) {
      $wrap.html('<p class="membership-empty">Charter data not available. Please check back later.</p>');
      return;
    }

    var sections = parseMarkdownSections(content);
    var membershipSec = findSection(sections, 'Membership');
    var communicationsSec = findSection(sections, 'Communications');

    if (!membershipSec) {
      $wrap.html('<p class="membership-empty">Membership section not found in charter.</p>');
      return;
    }

    var rows = parseMembershipRows(membershipSec.body);
    var intro = extractMembershipIntro(membershipSec.body);
    var email = extractEmail(communicationsSec ? communicationsSec.body : '');

    var chair = null;
    var members = [];
    var observers = [];

    rows.forEach(function (r) {
      if (/^chair$/i.test(r.role)) chair = r;
      else if (/^member$/i.test(r.role)) members.push(r);
      else if (/^observer$/i.test(r.role)) observers.push(r);
    });

    var html = '';

    // 顶部统计卡片
    html += '<div class="membership-stats">';
    html += '<div class="membership-stat-card">';
    html += '<div class="membership-stat-icon"><i class="fas fa-crown"></i></div>';
    html += '<div class="membership-stat-info"><span class="membership-stat-num">1</span><span class="membership-stat-label">Chair</span></div>';
    html += '</div>';
    html += '<div class="membership-stat-card">';
    html += '<div class="membership-stat-icon"><i class="fas fa-user"></i></div>';
    html += '<div class="membership-stat-info"><span class="membership-stat-num">' + members.length + '</span><span class="membership-stat-label">Members</span></div>';
    html += '</div>';
    html += '<div class="membership-stat-card">';
    html += '<div class="membership-stat-icon"><i class="fas fa-eye"></i></div>';
    html += '<div class="membership-stat-info"><span class="membership-stat-num">' + observers.length + '</span><span class="membership-stat-label">Observers</span></div>';
    html += '</div>';
    html += '<div class="membership-stat-card membership-stat-total">';
    html += '<div class="membership-stat-icon"><i class="fas fa-users"></i></div>';
    html += '<div class="membership-stat-info"><span class="membership-stat-num">' + rows.length + '</span><span class="membership-stat-label">Total</span></div>';
    html += '</div>';
    html += '</div>';

    // 简介
    if (intro) {
      html += '<p class="membership-intro">' + Superdarn.escapeHtml(intro) + '</p>';
    }

    // Chair 信息（含联系邮箱）
    if (chair) {
      html += '<div class="membership-chair-card">';
      html += '<div class="membership-chair-badge"><i class="fas fa-crown"></i></div>';
      html += '<div class="membership-chair-info">';
      html += '<span class="membership-chair-name">' + Superdarn.escapeHtml(chair.name) + '</span>';
      html += '<span class="membership-chair-inst">' + Superdarn.escapeHtml(chair.institution) + '</span>';
      if (email) {
        html += '<span class="membership-chair-contact"><i class="fas fa-envelope"></i> Contact: <a href="mailto:mafuli007@nssc.ac.cn">mafuli007@nssc.ac.cn</a></span>';
      }
      html += '</div>';
      html += '</div>';
    }

    // 成员表格
    html += '<div class="membership-table-wrap">';
    html += '<table class="membership-table">';
    html += '<thead><tr><th style="width:60px;">#</th><th style="width:120px;">Role</th><th>Name</th><th>Institution</th></tr></thead>';
    html += '<tbody>';

    var idx = 1;
    // Chair first
    if (chair) {
      html += '<tr class="membership-row-chair">';
      html += '<td>' + idx++ + '</td>';
      html += '<td><span class="membership-role-badge role-chair">Chair</span></td>';
      html += '<td>' + Superdarn.escapeHtml(chair.name) + '</td>';
      html += '<td>' + Superdarn.escapeHtml(chair.institution) + '</td>';
      html += '</tr>';
    }
    // Members
    members.forEach(function (m) {
      html += '<tr>';
      html += '<td>' + idx++ + '</td>';
      html += '<td><span class="membership-role-badge role-member">Member</span></td>';
      html += '<td>' + Superdarn.escapeHtml(m.name) + '</td>';
      html += '<td>' + Superdarn.escapeHtml(m.institution) + '</td>';
      html += '</tr>';
    });
    // Observers
    observers.forEach(function (o) {
      html += '<tr>';
      html += '<td>' + idx++ + '</td>';
      html += '<td><span class="membership-role-badge role-observer">Observer</span></td>';
      html += '<td>' + Superdarn.escapeHtml(o.name) + '</td>';
      html += '<td>' + Superdarn.escapeHtml(o.institution) + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';

    $wrap.html(html);
  }

  function loadMembership() {
    Superdarn.apiGet(Superdarn.api + '/api/dashboard/charter', {}, {
      target: '#membershipWrap',
      success: function (res) {
        var data = (res && res.data) ? res.data : res;
        var content = data ? data.content : '';
        renderMembership(content);
      }
    });
  }

  /* ========== Tab 注册 ========== */

  Superdarn.registerTab('membership', {
    init: function () {},
    onShow: function () {
      if (!membershipLoaded) {
        membershipLoaded = true;
        setTimeout(loadMembership, 120);
      }
    },
    resize: function () {}
  });

})(jQuery, window.Superdarn);
