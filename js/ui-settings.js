// Модалка «Настройки и тесты» (у хоста): группы с цветами, у каждой настройки ⓘ —
// развёрнутое пояснение по клику (подсказки при наведении нет — она закрывала соседние поля).
window.BP = window.BP || {};

BP.UISettings = (function () {
  const esc = (s) => BP.UIGame.esc(s);
  const open = {}; // какие пояснения развёрнуты (по пути настройки)

  // type: num | chk | sel (opts: [[value, label]]). help — что значит настройка.
  const GROUPS = [
    { id: "deck", title: "Колода и рука", color: "#5fc48a", items: [
      { path: "rules.handSize", type: "num", label: "Добор до N карт", help: "В начале хода рука каждого героя добирается до N карт. Рука рассчитана на N карт: если карт больше, они накладываются друг на друга." },
      { path: "rules.minDeck", type: "num", label: "Минимум колоды героя", help: "Если у героя меньше карт, колоду добивают «Слабые удары». В режиме общей колоды не используется — там свой минимум ниже." },
      { path: "tests.sharedDeck.enabled", type: "chk", label: "Общая колода", help: "Карты оружия и щита остаются у своего героя, все остальные (кооп-карты, слабые удары, особые) — в одной общей колоде. Герой добирает руку случайно из своего и общего. Карты героя подсвечены его цветом, общие — бирюзовой полосой «общая»." },
      { path: "tests.sharedDeck.minDeck", type: "num", label: "Минимум общей колоды", help: "Сколько карт минимум в общей колоде. Недобор добивают «Слабые удары». Работает только с включённой общей колодой." },
      { path: "tests.specialCards.perFight", type: "num", label: "Особых карт за бой", help: "Сколько разных особых карт («Единение») выдаётся на всю пати за бой. Без копий, каждая — случайному герою (или в общую колоду). 0 — без особых карт." },
    ] },
    { id: "merge", title: "Мердж", color: "#b77cff", items: [
      { path: "tests.merge.enabled", type: "chk", label: "Мердж = передача", help: "Свою карту можно перетащить на карту в руке союзника — его карта усиливается до конца боя (и после сброса тоже)." },
      { path: "tests.merge.mode", type: "sel", label: "Режим усиления", opts: [["add", "add — передать урон/блок"], ["flat", "flat — фиксированный бонус"]], help: "add: карта союзника получает урон/блок твоей карты. flat: карта союзника получает +бонус (число ниже) к урону и блоку." },
      { path: "tests.merge.flatBonus", type: "num", label: "Бонус для flat", help: "Сколько урона/блока добавляет мердж в режиме flat." },
      { path: "tests.merge.payCost", type: "chk", label: "Мердж стоит энергию", help: "Платишь ли ты энергию за передачу карты. Если выключено — мердж бесплатный и растущая стоимость не работает." },
      { path: "tests.merge.costGrowth", type: "sel", label: "Растущая стоимость", opts: [["off", "нет — как карта"], ["hero", "у героя: карта + (n−1)"], ["party", "у пати: n-я передача = n"]], help: "Каждая следующая передача за ход дороже. «У героя»: свой счётчик, n-й мердж героя = стоимость карты + (n − 1). «У пати»: общий счётчик, 1-я передача за ход стоит 1, 2-я — 2, 3-я — 3, стоимость карты не важна. Сброс каждый ход. Цена видна фиолетовым ромбом на картах союзника." },
    ] },
    { id: "coop", title: "Кооп-тесты", color: "#f2c94a", items: [
      { path: "tests.partyTask.enabled", type: "chk", label: "Задача пати на бой", help: "У каждого боя есть общая задача (🎯 сверху). Выполнили — бонус всем." },
      { path: "tests.sharedPool.enabled", type: "chk", label: "Карта «Единение»", help: "Особая карта: остаток энергии всех героев складывается в общий пул до конца хода, любой тратит из него." },
      { path: "tests.fightQuest.enabled", type: "chk", label: "Квест боя «?»", help: "Над полем врагов висит «?»: серый — квест не выполнен, золотой — выполнен. Наведи — условие и награда. Условие на весь бой. Кто закрыл условие, тот сразу получает в руку квестовую карту: одноразовую, не сгорает в конце хода." },
    ] },
    { id: "fight", title: "Бой и урон", color: "#ff8a5c", items: [
      { path: "rules.energy", type: "num", label: "Энергия за ход", help: "Сколько энергии получает каждый герой в начале хода." },
      { path: "rules.critMultiplier", type: "num", label: "Множитель крита", help: "Во сколько раз крит сильнее обычного удара." },
      { path: "rules.conditionalCrit", type: "chk", label: "Условный крит", help: "Удар по оглушённому или толкнутому в этот ход врагу — всегда крит." },
      { path: "tests.fixedShapes.enabled", type: "chk", label: "Фигуры без поворота", help: "У каждой массовки своя фигура, правой кнопкой не крутится. Фигуры из 3+ клеток симметричные и смотрят на героев. Выключено — старые фигуры с поворотом ПКМ." },
      { path: "rules.collisionDamage", type: "num", label: "Урон столкновения", help: "Урон обоим, когда толкнутый враг врезается в другого врага или в край поля." },
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
    return `<input type="number" data-cfg="${it.path}" value="${v == null ? 0 : v}">`;
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
      o[path[path.length - 1]] = el.type === "checkbox" ? el.checked : el.type === "number" ? Number(el.value) : el.value;
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
