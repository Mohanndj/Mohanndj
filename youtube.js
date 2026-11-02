'use strict';
// «يوتيوب» (v152, the owner: «أريد أن أضيف شيئا كاليوتيوب يحجب عني الإعلانات وفي نفس الوقت لو أردت أتابع تابعت»):
// YouTube's own site inside the Android app, in a window of its own whose ads are blocked (android/…/YoutubeActivity.java).
// A web page cannot touch YouTube's player, so in a browser, or an app before this one, it says where it is.
function viewYoutube() {
  const N = window.WaiNative, can = !!(N && typeof N.openYoutube === 'function');
  return `${moreCrumb()}
  <section class="panel">
    <h2>${esc(pageName('youtube'))}</h2>
    ${can ? `<p class="note-text">يوتيوب كاملاً داخل تطبيقك: ابحث وشاهد وافتح القنوات، والإعلانات محجوبة.</p>
    <div class="btn-row"><button type="button" class="primary" data-action="yt-open">${icon('play')}افتح يوتيوب</button></div>
    <p class="note-text explain">تستطيع الدخول بحسابك لترى اشتراكاتك، وقد ترفض قوقل الدخول من داخل التطبيقات. وإن عاد إعلان بعد تغيير في يوتيوب فيُحدَّث التطبيق.</p>`
    : N ? `<p class="note-text">يوتيوب بلا إعلانات في نسخة أحدث من تطبيق أندرويد. نزّلها وثبّتها فوق هذه، فتبقى بياناتك.</p>
    <div class="btn-row"><button type="button" class="primary" data-action="apk-get">نزّل تطبيق أندرويد</button></div>`
    : `<p class="note-text">يوتيوب بلا إعلانات في تطبيق أندرويد وحده، لا في المتصفح.</p>
    <div class="btn-row"><button type="button" class="ghost" data-action="apk-get">نزّل تطبيق أندرويد</button></div>`}
  </section>`;
}
Object.assign(LibraryViews, { youtube: viewYoutube });
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-action="yt-open"]')) return;
  const N = window.WaiNative;
  if (N && typeof N.openYoutube === 'function') N.openYoutube();
});
