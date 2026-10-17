// Версия (ветка) игры. На GitHub Pages каждая ветка выкладывается своей папкой:
//   main → /backpack-proto/,  merge → /backpack-proto/merge/  и т.д. (см. tools/build-pages.sh).
// Сборка вписывает в страницу window.BP_BRANCH = "имя-папки" (для main и при запуске с диска — "").
// Все версии живут на одном сайте и делят localStorage браузера, поэтому для не-main версий
// ключи "bprpg-…" (кроме имени игрока) незаметно получают приставку "bprpg@<ветка>-…": настройки ⚙
// и результаты симулятора каждой версии хранятся отдельно и не перетекают между ссылками.
window.BP_BRANCH = window.BP_BRANCH || "";

(function () {
  const b = window.BP_BRANCH;
  if (!b) return;
  try {
    const p = Storage.prototype;
    const ns = "bprpg@" + b + "-";
    const shared = { "bprpg-name": 1 }; // имя игрока общее для всех версий
    const map = (k) => (typeof k === "string" && k.indexOf("bprpg-") === 0 && !shared[k] ? ns + k.slice(6) : k);
    ["getItem", "setItem", "removeItem"].forEach((m) => {
      const orig = p[m];
      p[m] = function (k) { const a = Array.prototype.slice.call(arguments); a[0] = map(k); return orig.apply(this, a); };
    });
  } catch (e) { /* ignore */ }
  // Чтобы вкладки разных версий не путались
  document.addEventListener("DOMContentLoaded", () => { document.title = "[" + b + "] " + document.title; });
})();

// Строка «Версия: … · все версии» для меню. Список версий (versions.html) собирается при выкладке,
// поэтому ссылку показываем только на сайте, не при запуске с диска.
window.BP_versionLine = function () {
  const b = window.BP_BRANCH || "main";
  const online = /^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname);
  const href = window.BP_BRANCH ? "../versions.html" : "versions.html";
  return `<div class="muted small">Версия: <b>${b}</b>${online ? ` · <a href="${href}">все версии</a>` : ""}</div>`;
};
