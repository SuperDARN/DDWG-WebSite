/**
 * GitHub Pages 前端配置。
 *
 * 这里必须填「阿里云 Tomcat 上的 Java API 根路径」，
 * 不要填 GitHub Pages 自己的地址（例如 https://www.superdarngroup.online）。
 * Pages 只有 HTML/JS，没有 /api/dashboard。
 *
 * 不要末尾斜杠。WAR 若不是 ROOT，必须带 context-path。
 *
 * 示例：
 *   ROOT.war + HTTPS：     https://api.superdarngroup.online
 *   superdarn-monitor.war： https://api.superdarngroup.online/superdarn-monitor
 *
 * GitHub Pages 是 HTTPS，这里不能填 http://IP，否则浏览器会拦截。
 */
// window.SUPERDARN_API = 'https://www.superdarngroup.online';
window.SUPERDARN_API = 'https://superdarn-ddwg.nssdc.ac.cn/';
