'use strict';
// «تويتر» (v166, the owner: «هل أقدر أضيف تويتر للوعي الشخصي فأغرد فقط بدون قراءة إلا لمن أختارهم فقط؟», and his
// answers): Twitter's own site inside the Android app (android/…/XPanel.java), opening on the box to tweet, with his
// private List to read the people he chose; its tile in «المزيد» opens it there, and this page stays for a browser or an
// app before this one, saying where it is.
function xCan() { const N = window.WaiNative; return !!(N && typeof N.openX === 'function'); }
function viewTwitter() {
  const N = window.WaiNative;
  return `${moreCrumb()}
  <section class="panel">
    <h2>${esc(pageName('twitter'))}</h2>
    ${xCan() ? `<div class="btn-row"><button type="button" class="primary" data-action="x-open">${icon('chat')}افتح تويتر</button></div>`
    : N ? `<p class="note-text">تويتر داخل التطبيق في نسخة أحدث من تطبيق أندرويد. نزّلها وثبّتها فوق هذه، فتبقى بياناتك.</p>
    <div class="btn-row"><button type="button" class="primary" data-action="apk-get">نزّل تطبيق أندرويد</button></div>`
    : `<p class="note-text">تويتر في تطبيق أندرويد وحده، لا في المتصفح.</p>
    <div class="btn-row"><button type="button" class="ghost" data-action="apk-get">نزّل تطبيق أندرويد</button></div>`}
  </section>`;
}
Object.assign(LibraryViews, { twitter: viewTwitter });
// in the app that opens it, its tile opens Twitter itself (before app.js's own click, which would go to this page)
document.addEventListener('click', (e) => {
  const tile = e.target.closest('[data-tab="twitter"]');
  if (!tile || !xCan()) return;
  e.stopImmediatePropagation();
  window.WaiNative.openX();
}, true);
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="x-open"]') && xCan()) window.WaiNative.openX();
});
