// Вкладка «Симулятор» на странице карт: боты играют забеги прямо в браузере (Node не нужен).
// На сайте (http/https) считает в фоновом потоке (js/sim-worker.js) — страница не зависает.
// При открытии файла двойным кликом (file://) считает по одному забегу за раз в основном потоке.
window.BP = window.BP || {};

BP.CatalogSim = (function () {
  const esc = (s) => BP.Catalog.esc(s);
  const BOT_INFO = {
    smart: "аккуратный игрок: перебирает все карты и цели, смотрит, что сделают враги. Медленный (~0,5 с на забег)",
    medium: "средний игрок: как аккуратный, но ~35% ходов наугад",
    sloppy: "небрежный игрок: случайные карты на случайные цели. Быстрый",
  };
  const KEY = "bprpg-sim-results";
  const st = { bot: BP.Catalog.store.get("bot", "smart"), runs: BP.Catalog.store.get("runs", 100), job: null, sort: "playRate", dir: -1 };

  // ---------- сохранённые результаты (по одному на бота) ----------
  function hash(cfg) { const s = JSON.stringify(cfg); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  function results() {
    let all = {};
    try { all = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) {}
    const h = hash(BP.Catalog.config());
    Object.values(all).forEach((r) => (r.stale = r.cfgHash !== h));
    return all;
  }
  function save(bot, summary, cfg, secs) {
    const all = results();
    all[bot] = { bot, at: new Date().toISOString(), cfgHash: hash(cfg), secs, summary };
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
  }
  // Последний прогон (для процентов под картами в каталоге)
  function latest() {
    const all = Object.values(results());
    return all.sort((a, b) => (a.at < b.at ? 1 : -1))[0] || null;
  }

  // ---------- запуск ----------
  function start() {
    if (st.job) return;
    const cfg = JSON.parse(JSON.stringify(BP.Catalog.config()));
    const job = { bot: st.bot, total: st.runs, done: 0, t0: Date.now(), cfg };
    st.job = job;
    const finish = (summary) => {
      if (st.job !== job) return;
      save(job.bot, summary, job.cfg, (Date.now() - job.t0) / 1000);
      st.job = null; BP.Catalog.render();
    };
    const progress = (done) => { job.done = done; paintProgress(); };
    if (/^https?:$/.test(location.protocol) && window.Worker) {
      try {
        job.worker = new Worker("js/sim-worker.js");
        job.worker.onmessage = (ev) => (ev.data.type === "progress" ? progress(ev.data.done) : finish(ev.data.summary));
        job.worker.onerror = (e) => { job.worker.terminate(); job.worker = null; console.warn("Фоновый поток не запустился, считаю в основном", e.message); mainThread(job, progress, finish); };
        job.worker.postMessage({ cfg, bot: job.bot, runs: job.total });
      } catch (e) { mainThread(job, progress, finish); }
    } else mainThread(job, progress, finish);
    BP.Catalog.render();
  }

  function mainThread(job, progress, finish) {
    const runs = [];
    const step = () => {
      if (st.job !== job) return;
      runs.push(BP.Sim.runOnce(job.cfg, job.bot));
      progress(runs.length);
      if (runs.length < job.total) setTimeout(step, 0);
      else finish(BP.Sim.summarize(job.cfg, runs));
    };
    setTimeout(step, 30);
  }

  function stop() {
    if (!st.job) return;
    if (st.job.worker) st.job.worker.terminate();
    st.job = null; BP.Catalog.render();
  }

  function paintProgress() {
    const j = st.job, el = document.getElementById("simprog");
    if (!j || !el) return;
    const secs = (Date.now() - j.t0) / 1000;
    const left = j.done ? (secs / j.done) * (j.total - j.done) : null;
    el.querySelector("i").style.width = (100 * j.done) / j.total + "%";
    el.querySelector("span").textContent = `${j.done} из ${j.total} забегов${left !== null ? ` · осталось ~${left < 60 ? Math.ceil(left) + " с" : Math.ceil(left / 60) + " мин"}` : ""}`;
  }

  // ---------- отрисовка ----------
  const pct = (x) => Math.round(x * 100) + "%";

  function render(cfg, cards) {
    const all = results();
    const r = all[st.bot];
    const opt = (v, l, cur) => `<option value="${v}"${String(cur) === String(v) ? " selected" : ""}>${l}</option>`;
    return `<section class="sim">
      <div class="simctl">
        <label>Бот <select data-sim="bot">${BP.Sim.BOTS.map((b) => opt(b, b, st.bot)).join("")}</select></label>
        <label>Забегов <select data-sim="runs">${[30, 100, 300, 1000].map((n) => opt(n, n, st.runs)).join("")}</select></label>
        ${st.job ? `<button class="danger" data-act="sim-stop">■ Стоп</button>` : `<button class="primary" data-act="sim-run">▶ Прогнать ботов</button>`}
        <span class="muted small">${esc(BOT_INFO[st.bot] || "")}</span>
      </div>
      ${st.job ? `<div id="simprog" class="prog"><i></i><span>запускаю…</span></div>` : ""}
      <p class="muted small">Боты играют весь забег (${cfg.encounters.length} ${cfg.encounters.length === 1 ? "бой" : "боя"}) по тем же правилам и на тех же числах, что игра сейчас. Результат сохраняется в этом браузере — для каждого бота свой.
        Боты — не люди: smart играет почти идеально, sloppy — хуже любого игрока. Настоящая сложность где-то между ними.</p>
      ${r ? result(cfg, cards, r) : `<div class="empty muted">Для бота «${esc(st.bot)}» ещё нет результата — нажмите «Прогнать ботов».</div>`}
    </section>`;
  }

  function result(cfg, cards, r) {
    const s = r.summary;
    const tile = (v, l, sub) => `<div class="tile"><b>${v}</b><span>${l}</span>${sub ? `<em>${sub}</em>` : ""}</div>`;
    const when = new Date(r.at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    const fights = s.fights.map((f, i) => `<tr><td>${i + 1}. ${esc(f.name)}</td><td>${pct(f.reach)}</td><td class="${f.wipe > 0.1 ? "bad" : ""}">${pct(f.wipe)}</td><td>${pct(f.lost)}</td><td>${f.turns.toFixed(1)}</td><td>${f.deaths.toFixed(2)}</td></tr>`).join("");
    return `${r.stale ? `<div class="warn">Конфиг изменился после этого прогона — цифры могут не совпадать с текущими картами. Прогоните заново.</div>` : ""}
      <div class="muted small">Прогон: ${esc(r.bot)}, ${s.runs} забегов, ${esc(when)}${r.secs ? `, ${Math.round(r.secs)} с` : ""}</div>
      <div class="tiles">
        ${tile(pct(s.winRate), "побед", s.worstFight ? `чаще гибнут в «${esc(s.worstFight)}»` : "")}
        ${tile(pct(s.hpPerFight), "ХП теряется за бой", "от суммарного ХП пати")}
        ${tile(s.runLost ? pct(s.runLost.avg) : "—", "ХП не хватает в конце", s.runLost ? `у побед: от ${pct(s.runLost.p10)} до ${pct(s.runLost.p90)}` : "побед нет")}
        ${tile(s.turnsPerFight.toFixed(1), "ходов за бой")}
        ${tile(s.deathsPerRun.toFixed(2), "смертей героев за забег")}
      </div>
      <h3>По боям</h3>
      <table class="tbl"><tr><th>Бой</th><th>дошли</th><th>вайп</th><th>ХП потеряно</th><th>ходов</th><th>смертей</th></tr>${fights}</table>
      <h3>По картам</h3>
      <p class="muted small"><b>«Из руки»</b> — как часто бот сыграл карту, когда она лежала в руке в начале хода. Это главная цифра: если карту почти не берут, она слабая, дорогая или ей не на что сыграть.
        <span class="pill v-good">≥60%</span> берут почти всегда · <span class="pill v-ok">30–60%</span> норм · <span class="pill v-bad">&lt;30%</span> почти не берут. Клик по названию — карточка карты.</p>
      ${cardTable(cards, s)}`;
  }

  function cardTable(cards, s) {
    const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
    const rows = Object.entries(s.cards).filter(([, c]) => c.seen || c.played).map(([id, c]) => ({ id, c, card: byId[id] }));
    const key = { name: (x) => (x.card ? x.card.name : x.id), perFight: (x) => x.c.perFight, playRate: (x) => x.c.playRate || 0, mergeRate: (x) => x.c.mergeRate || 0, cost: (x) => (x.card ? x.card.cost : 0) }[st.sort];
    rows.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * st.dir);
    const th = (k, l) => `<th class="sortable${st.sort === k ? " on" : ""}" data-act="sim-sort" data-key="${k}">${l}${st.sort === k ? (st.dir < 0 ? " ▼" : " ▲") : ""}</th>`;
    const body = rows.map(({ id, c, card }) => {
      const v = BP.Sim.verdict(c);
      return `<tr><td><a href="#card=${encodeURIComponent(id)}">${card ? esc(card.name) : esc(id)}</a>${card && card.isNew ? " 🆕" : ""}</td>
        <td>${card ? card.cost : ""}</td><td class="muted">${card ? esc(card.src.map((x) => x.label).join(", ")) : ""}</td>
        <td>${c.perFight.toFixed(2)}</td>
        <td><div class="bar v-${v}"><i style="width:${pct(c.playRate || 0)}"></i></div> ${c.playRate === null ? "—" : pct(c.playRate)}</td>
        <td>${c.merged ? pct(c.mergeRate) : "—"}</td></tr>`;
    }).join("");
    return `<table class="tbl cards"><tr>${th("name", "Карта")}${th("cost", "Цена")}<th>Где</th>${th("perFight", "Сыграна за бой")}${th("playRate", "Из руки")}${th("mergeRate", "В мердж")}</tr>${body}</table>`;
  }

  function action(act, el) {
    if (act === "sim-run") start();
    else if (act === "sim-stop") stop();
    else if (act === "sim-sort") { const k = el.dataset.key; st.dir = st.sort === k ? -st.dir : k === "name" || k === "cost" ? 1 : -1; st.sort = k; BP.Catalog.render(); }
    else if (act === "set") {
      if (el.dataset.sim === "bot") { st.bot = el.value; BP.Catalog.store.set("bot", st.bot); }
      if (el.dataset.sim === "runs") { st.runs = Number(el.value); BP.Catalog.store.set("runs", st.runs); }
      BP.Catalog.render();
    }
  }

  // Прогресс перерисовывается после каждого render (элемент создаётся заново)
  const obs = new MutationObserver(() => paintProgress());
  document.addEventListener("DOMContentLoaded", () => obs.observe(document.getElementById("app"), { childList: true }));

  return { render, action, results, latest };
})();
