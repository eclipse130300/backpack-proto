// Модалка «Настройки и тесты» (у хоста): группы с цветами, у каждой настройки ⓘ —
// развёрнутое пояснение по клику (подсказки при наведении нет — она закрывала соседние поля).
window.BP = window.BP || {};

BP.UISettings = (function () {
  const esc = (s) => BP.UIGame.esc(s);
  const open = {}; // какие пояснения развёрнуты (по пути настройки)

  // type: num | chk | sel (opts: [[value, label]]). help — что значит настройка.
  const GROUPS = [
    { id: "merge", title: "Мердж", color: "#b77cff", items: [
      { path: "tests.merge.donorDamage", type: "sel", num: true, label: "Урон отданной карты", opts: [["0.5", "50%"], ["1", "100%"]], help: "Какая часть урона отданной карты прибавляется к карте союзника. У карт защиты (защита в защиту) — такая же часть блока. Дары переходят всегда." },
      { path: "tests.merge.keepDamage", type: "sel", bool: true, label: "Урон от мерджа", opts: [["true", "до конца боя"], ["false", "одноразовый"]], help: "До конца боя: прибавка урона живёт на карте весь бой, переживает сброс. Одноразовый: после розыгрыша карта возвращается к своему урону, а дары остаются до конца боя." },
      { path: "tests.merge.lifetime", type: "sel", label: "Lifetime after merge", opts: [["all", "all — всё возвращается"], ["fused", "сплав"], ["turn", "на один ход"]], help: "Что происходит с картами после мерджа. All (как было): отданная карта уходит в сброс чистой, мерджнутая после розыгрыша уходит в сброс с бонусами и до конца боя возвращается в руку усиленной. Сплав: отданная карта сгорает до конца боя, мерджнутая остаётся и дальше ходит по колоде с бонусами. На один ход: обе исходные карты уходят в сброс чистыми, мерджнутая (⏳) живёт только этот ход — сыграли её или нет, она исчезает." },
      { path: "tests.merge.aoeReceive", type: "chk", label: "Массовки принимают мердж", help: "Включено — в массовку можно мерджить (урон и дары). Выключено — массовку можно только отдать." },
      { path: "tests.merge.payCost", type: "chk", label: "Мердж стоит энергию", help: "Мердж стоит столько же энергии, сколько отданная карта. Выключено — мердж бесплатный." },
    ] },
    { id: "fight", title: "Бой", color: "#ff8a5c", items: [
      { path: "rules.energy", type: "num", label: "Энергия за ход", help: "Сколько энергии получает каждый герой в начале хода." },
      { path: "rules.critMultiplier", type: "num", label: "Множитель крита", help: "Во сколько раз крит сильнее обычного удара." },
      { path: "rules.collisionBonus", type: "num", label: "Бонус столкновения", help: "Толкнули врага в другого врага — оба до конца хода получают больше урона: 0.5 = +50%. Край поля не считается. 0 — выключить." },
      { path: "rules.collisionDamage", type: "num", label: "Урон столкновения", help: "Урон обоим, когда толкнутый враг врезается в другого врага или в край поля." },
      { path: "tests.vectorAoe.enabled", type: "chk", label: "Векторные массовки", help: "Наводишься массовкой на клетку — фигура поворачивается в сторону курсора (6 направлений). Клетки за краем поля пропадают. Выключено — фигура неподвижна." },
    ] },
    { id: "meta", title: "Забег", color: "#f2c94a", items: [
      { path: "meta.upgradeMode", type: "sel", label: "«Усиление» карты", opts: [["percent", "+% (процент)"], ["flat", "+N (число)"]], help: "Как работает улучшение «Усиление» в наградах и кузнице. Процент: +50% урона (у карт защиты — блока), два усиления = +100%. Число: +3 урона или блока, два = +6." },
      { path: "meta.upPercent", type: "num", label: "Процент усиления", help: "Для режима «процент»: 0.5 = +50%. Складывается, дробное округляем вверх." },
      { path: "meta.upFlat", type: "num", label: "Число усиления", help: "Для режима «число»: сколько урона или блока добавляет одно усиление." },
      { path: "meta.multiUpgrade", type: "chk", label: "Улучшать одну карту много раз", help: "Включено — одну и ту же карту можно улучшать снова и снова. Выключено — уже улучшенная карта больше не предлагается для улучшений (ни в наградах, ни в кузнице)." },
      { path: "meta.minDeck", type: "num", label: "Минимум колоды (кузница)", help: "В кузнице нельзя удалить карту, если в колоде героя столько карт или меньше." },
      { path: "meta.mforgeDestroy", type: "chk", label: "Мердж-кузня уничтожает исходные", help: "Включено — после мерджа в мердж-кузне обе исходные карты исчезают, в колоде остаётся только новая (колода −1). Выключено — исходные остаются, новая добавляется (колода +1)." },
      { path: "meta.campHeal", type: "num", label: "Лечение костра", help: "Доля макс. ХП, которую костёр лечит каждому герою: 0.3 = 30%." },
      { path: "meta.enemyHp", type: "num", label: "ХП врагов (множитель)", help: "Множитель ХП и брони всех врагов в забеге. 1 — как в списке врагов, 0.8 — на 20% меньше." },
      { path: "meta.hpPerFloor", type: "num", label: "Рост ХП врагов за этаж", help: "На сколько растут ХП и броня врагов с каждым этажом: 0.1 = +10% за этаж." },
    ] },
    { id: "deck", title: "Колода", color: "#5fc48a", items: [
      { path: "rules.drawPerTurn", type: "num", label: "Добор за ход", help: "В начале хода каждый герой берёт ровно N карт (не «до N»). Рука рассчитана на N карт: если карт больше, они накладываются друг на друга." },
    ] },
    { id: "enemies", title: "Враги", color: "#6cb4ff", items: [
      { path: "tests.enemyTargeting", type: "sel", label: "Цели врагов", opts: [["A", "A — коридоры"], ["B", "B — любой герой"]], help: "A: враг бьёт героя своего коридора (по 2 колонки на героя, подсвечены цветом). B: любой враг выбирает любого героя случайно." },
      { path: "rules.enemyStepDelayMs", type: "num", label: "Пауза врагов, мс", help: "Пауза между действиями врагов, чтобы было видно, кто что сделал." },
    ] },
  ];

  const get = (cfg, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), cfg);

  function field(c, it) {
    const v = get(c, it.path);
    if (it.type === "chk") return `<input type="checkbox" data-cfg="${it.path}" ${v ? "checked" : ""}>`;
    if (it.type === "sel") return `<select data-cfg="${it.path}">${it.opts.map(([val, l]) => `<option value="${val}" ${String(v) === val ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    return `<input type="number" step="any" data-cfg="${it.path}" value="${v == null ? 0 : v}">`;
  }

  function item(c, it) {
    return `<div class="set-item">
      <label><span class="set-label">${esc(it.label)}<button type="button" class="info" data-act="set-help" data-path="${it.path}">i</button></span>${field(c, it)}</label>
      ${open[it.path] ? `<div class="set-help">${esc(it.help)}</div>` : ""}
    </div>`;
  }

  function render(s) {
    const c = s.config;
    const groups = GROUPS.map((g) => `<section class="set-group" style="--gc:${g.color}"><h3>${esc(g.title)}</h3><div class="set-items">${g.items.map((it) => item(c, it)).join("")}</div></section>`).join("");
    return `<div class="modal-back"><div class="modal settings">
      <h2>Настройки и тесты</h2>
      <div class="muted small">Клик по <b>i</b> — пояснение. Применение перезапускает забег. Настройки сохраняются в этом браузере и перекрывают config.js, пока не нажать «Вернуть config.js».</div>
      <div class="set-groups">${groups}</div>
      <details><summary>Весь конфиг (JSON) — для правки карт, оружия, врагов</summary>
        <textarea id="cfg-json" rows="18" style="width:100%;margin-top:8px">${esc(JSON.stringify(c, null, 2))}</textarea>
        <div class="muted small">Если правили JSON здесь — применится он (поля выше игнорируются).</div></details>
      <div class="row" style="margin-top:14px">
        <button class="primary" data-act="cfg-apply">Применить и начать заново</button>
        <button data-act="cfg-download">Скачать config.js</button>
        <button data-act="reset-config">Вернуть config.js</button><span class="grow"></span>
        <button data-act="modal-close">Закрыть</button></div>
    </div></div>`;
  }

  // Собрать конфиг из полей модалки (или из JSON, если его правили)
  function collect(s, toast) {
    const ta = document.getElementById("cfg-json");
    if (ta && ta.value !== JSON.stringify(s.config, null, 2)) {
      try { return JSON.parse(ta.value); } catch (e) { toast("Ошибка в JSON: " + e.message, "bad"); return null; }
    }
    const cfg = JSON.parse(JSON.stringify(s.config));
    document.querySelectorAll("[data-cfg]").forEach((el) => {
      const path = el.dataset.cfg.split(".");
      let o = cfg;
      for (let i = 0; i < path.length - 1; i++) o = o[path[i]] = o[path[i]] || {};
      const it = findItem(el.dataset.cfg) || {};
      let v = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
      if (it.num) v = Number(v); // выпадающий список с числами (0.5 / 1)
      if (it.bool) v = v === "true"; // выпадающий список да/нет
      o[path[path.length - 1]] = v;
    });
    return cfg;
  }

  const findItem = (p) => GROUPS.flatMap((g) => g.items).find((it) => it.path === p);

  // Клик по «i»: развернуть/свернуть пояснение, не теряя введённых значений
  function toggleHelp(btn) {
    const p = btn.dataset.path, wrap = btn.closest(".set-item");
    open[p] = !open[p];
    const ex = wrap.querySelector(".set-help");
    if (ex) ex.remove();
    if (open[p]) { const d = document.createElement("div"); d.className = "set-help"; d.textContent = (findItem(p) || {}).help || ""; wrap.appendChild(d); }
  }

  return { render, collect, toggleHelp };
})();
