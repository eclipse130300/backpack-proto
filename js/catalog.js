// Страница «Карты» (cards.html): каталог всех карт из config.js, группировка, фильтры, подробности.
// Ничего не меняет в игре — только показывает. Вкладка «Симулятор» — в js/catalog-sim.js.
window.BP = window.BP || {};

BP.Catalog = (function () {
  // Доска заявок на новые карты (страница в Claude). Пусто — кнопка скрыта.
  const BOARD_URL = "https://claude.ai/artifact/1LYsvgGYij3UPPchKTmKJE";

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  const store = {
    get(k, d) { try { const v = localStorage.getItem("bprpg-cat-" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("bprpg-cat-" + k, JSON.stringify(v)); } catch (e) {} },
  };

  const ui = { tab: "cards", group: store.get("group", "weapon"), q: "", fx: [], onlyNew: false, open: null, useOverride: store.get("override", false), closed: store.get("closed", {}) };

  const FX_LABEL = { damage: "Урон", block: "Блок", blockSelf: "Блок себе", push: "Толчок", stun: "Оглушение", taunt: "Вызов", cleanse: "Очищение",
    draw: "Добор", energy: "Энергия", sharedPool: "Общий пул", blockParty: "Блок всем", damageAllEnemies: "Урон всем врагам" };
  const ATTACK_LABEL = { melee: "Мили", ranged: "Дальние", aoe: "Массовки" };
  const TARGET_LABEL = { enemy: "враг", cell: "клетка поля", self: "себя", hero: "себя или союзника", ally: "только союзник", none: "без цели" };

  // ---------- конфиг: config.js или «Настройки ⚙» хоста из этого браузера ----------
  function override() {
    try {
      const o = JSON.parse(localStorage.getItem("bprpg-config-override") || "null");
      return o && o.config && o.config.version === window.GAME_CONFIG.version ? o : null;
    } catch (e) { return null; }
  }
  function config() { const o = ui.useOverride && override(); return o ? o.config : window.GAME_CONFIG; }

  // ---------- данные карт ----------
  // Карта собирается тем же кодом, что в игре (текст, фигура, крит)
  function build(cfg) {
    const st = { config: cfg, seq: 1 };
    const src = sources(cfg);
    return Object.keys(cfg.cards).map((id) => {
      let c;
      try { c = BP.Engine.makeCard(st, id); } catch (e) { c = Object.assign({ id, name: id, text: "Ошибка в карте: " + e.message, effects: [] }, cfg.cards[id]); }
      c.src = src[id] || [];
      c.kind = BP.Cards.kind(c);
      return c;
    });
  }

  // Где лежит карта: оружие/щит (у каких героев), доп. карты героев, особые карты, добивка
  function sources(cfg) {
    const map = {};
    const add = (id, s) => (map[id] = map[id] || []).push(s);
    Object.entries(cfg.weapons || {}).forEach(([wid, w]) => {
      const heroes = cfg.heroes.filter((h) => (h.weapons || []).includes(wid)).map((h) => h.name);
      Object.entries(w.cards || {}).forEach(([cid, n]) => add(cid, { type: "weapon", wid, label: w.name, n, heroes }));
    });
    cfg.heroes.forEach((h) => Object.entries(h.cards || {}).forEach(([cid, n]) => add(cid, { type: "hero", label: h.name, n, heroes: [h.name] })));
    (cfg.questRewards || []).forEach((cid) => add(cid, { type: "quest", label: "награда квеста", n: 1, heroes: [] }));
    // добивка колоды: слабый удар каждого оружия (у героев с этим оружием) и запасная rules.fillerCard
    Object.entries(cfg.weapons || {}).forEach(([wid, w]) => {
      if (!w.weakCard) return;
      const heroes = cfg.heroes.filter((h) => (h.weapons || []).includes(wid)).map((h) => h.name);
      add(w.weakCard, { type: "filler", label: "добивка: " + w.name, n: 0, heroes });
    });
    if (cfg.rules.fillerCard && !map[cfg.rules.fillerCard]) add(cfg.rules.fillerCard, { type: "filler", label: "добивка колоды", n: 0, heroes: [] });
    return map;
  }

  function srcText(c) {
    if (!c.src.length) return "не в колодах";
    return c.src.map((s) => s.type === "filler" ? s.label : s.type === "special" ? "особая" : s.type === "quest" ? "награда квеста" : `${s.label}${s.n > 1 ? " ×" + s.n : ""}`).join(", ");
  }

  // Простая «сила» карты: урон / блок и сколько это на 1 энергию
  function power(c) {
    const out = [];
    const d = c.effects.find((e) => e.type === "damage");
    const b = c.effects.filter((e) => e.type === "block" || e.type === "blockSelf").reduce((a, e) => a + e.amount, 0);
    const per = (v) => (c.cost > 0 ? ` (${+(v / c.cost).toFixed(1)} за 1 энергию)` : " (бесплатно)");
    if (d) { const v = d.amount * (d.hits || 1); out.push(`Урон ${v}${c.attack === "aoe" || c.area === "line" ? " каждому задетому" : ""}${per(v)}`); }
    if (b) out.push(`Блок ${b}${per(b)}`);
    return out;
  }

  // ---------- фильтры и группы ----------
  function matches(c) {
    if (ui.onlyNew && !c.isNew) return false;
    if (ui.q) { const q = ui.q.toLowerCase(); if (!(c.name + " " + c.id + " " + c.text).toLowerCase().includes(q)) return false; }
    return ui.fx.every((f) => (f.startsWith("atk:") ? c.attack === f.slice(4) : c.effects.some((e) => e.type === f)));
  }

  function groups(cfg, cards) {
    const out = [];
    if (ui.group === "weapon") {
      Object.entries(cfg.weapons || {}).forEach(([wid, w]) => {
        const heroes = cfg.heroes.filter((h) => (h.weapons || []).includes(wid)).map((h) => h.name);
        const sub = [w.kind === "shield" ? "щит" : "оружие", heroes.length ? heroes.join(", ") : "ни у кого", w.critEvery ? `крит раз в ${w.critEvery} удара` : ""].filter(Boolean).join(" · ");
        out.push({ key: "w:" + wid, title: w.name, icon: w.icon, sub, cards: cards.filter((c) => c.src.some((s) => s.wid === wid)) });
      });
      out.push({ key: "hero", title: "Кооп-карты героев", sub: "доп. карты сверх оружия", cards: cards.filter((c) => c.src.some((s) => s.type === "hero")) });
      out.push({ key: "quest", title: "Награды квеста боя", sub: "одноразовые, получает герой, выполнивший квест", cards: cards.filter((c) => c.src.some((s) => s.type === "quest")) });
      out.push({ key: "filler", title: "Добивка колоды", sub: `слабые удары оружия, до ${cfg.rules.minDeck} карт`, cards: cards.filter((c) => c.src.some((s) => s.type === "filler")) });
      out.push({ key: "none", title: "Не в колодах", sub: "есть в конфиге, но ни у кого не лежит", cards: cards.filter((c) => !c.src.length) });
    } else if (ui.group === "type") {
      ["melee", "ranged", "aoe", "block", "coop", "special", "filler"].forEach((k) =>
        out.push({ key: "k:" + k, title: BP.Icons.KIND_LABEL[k][0].toUpperCase() + BP.Icons.KIND_LABEL[k].slice(1), color: BP.Icons.KIND_COLOR[k], cards: cards.filter((c) => c.kind === k) }));
    } else {
      const costs = [...new Set(cards.map((c) => c.cost))].sort((a, b) => a - b);
      costs.forEach((n) => out.push({ key: "c:" + n, title: `Стоимость ${n}`, cards: cards.filter((c) => c.cost === n) }));
    }
    return out.filter((g) => g.cards.length);
  }

  // ---------- отрисовка ----------
  function cardTile(c, sim) {
    const kc = BP.Icons.KIND_COLOR[c.kind];
    const v = sim && BP.Sim.verdict(sim.cards[c.id]);
    const r = sim && sim.cards[c.id];
    const pill = v ? `<span class="pill v-${v}" title="Боты играли эту карту в ${Math.round(r.playRate * 100)}% случаев, когда она была в руке">${Math.round(r.playRate * 100)}%</span>` : "";
    return `<div class="ctile${ui.open === c.id ? " open" : ""}" data-card="${esc(c.id)}">
      <div class="card readonly k-${c.kind}" style="--kc:${kc}">
        ${BP.Icons.costHtml(c)}${BP.Icons.statsHtml(c)}
        ${c.isNew ? `<div class="cnew">🆕</div>` : ""}
        <div class="cart">${BP.Icons.svg(c.icon)}${c.area === "shape" ? BP.Icons.shapeSvg(c.shapeSteps, 0) : ""}</div>
        <div class="cname">${esc(c.name)}</div>
        <div class="ctext">${esc(c.text)}</div>
      </div>
      <div class="ccap">${esc(srcText(c))} ${pill}</div>
    </div>`;
  }

  function chipsHtml(cards) {
    const present = new Set();
    cards.forEach((c) => c.effects.forEach((e) => present.add(e.type)));
    const atk = Object.keys(ATTACK_LABEL).filter((a) => cards.some((c) => c.attack === a));
    const chip = (key, label) => `<button class="fchip${ui.fx.includes(key) ? " on" : ""}" data-fx="${key}">${label}</button>`;
    return atk.map((a) => chip("atk:" + a, ATTACK_LABEL[a])).join("") + Object.keys(FX_LABEL).filter((t) => present.has(t)).map((t) => chip(t, FX_LABEL[t])).join("") +
      (cards.some((c) => c.isNew) ? `<button class="fchip${ui.onlyNew ? " on" : ""}" data-fx="new">🆕 новые</button>` : "");
  }

  function renderCards(cfg, cards, sim) {
    const shown = cards.filter(matches);
    const gs = groups(cfg, shown);
    const seg = (k, l) => `<button class="seg${ui.group === k ? " on" : ""}" data-group="${k}">${l}</button>`;
    return `<div class="toolbar">
        <span class="muted small">Группировать:</span><div class="segs">${seg("weapon", "по оружию")}${seg("type", "по типу")}${seg("cost", "по стоимости")}</div>
        <input id="q" type="search" placeholder="Поиск по названию или тексту" value="${esc(ui.q)}">
        <span class="muted small">${shown.length} из ${cards.length}</span>
      </div>
      <div class="chips">${chipsHtml(cards)}${ui.fx.length || ui.onlyNew ? `<button class="fchip clear" data-fx="clear">✕ сбросить</button>` : ""}</div>
      ${sim ? `<div class="muted small simnote">% под картой — как часто боты (${esc(sim.bot)}, ${sim.summary.runs} забегов) играли её, когда она была в руке: <span class="pill v-good">≥60%</span> берут почти всегда · <span class="pill v-ok">30–60%</span> норм · <span class="pill v-bad">&lt;30%</span> почти не берут${sim.stale ? " · <b>конфиг с тех пор менялся — прогоните заново</b>" : ""}</div>` : ""}
      <div class="groups">${gs.map((g) => `<details class="group" data-key="${esc(g.key)}"${ui.closed[g.key] ? "" : " open"}>
        <summary>${g.icon ? BP.Icons.svg(g.icon, "gicon") : g.color ? `<i class="gdot" style="background:${g.color}"></i>` : ""}<b>${esc(g.title)}</b>
          <span class="muted small">${g.sub ? esc(g.sub) + " · " : ""}${g.cards.length} ${plural(g.cards.length, "карта", "карты", "карт")}</span></summary>
        <div class="grid">${g.cards.map((c) => cardTile(c, sim && sim.summary)).join("")}</div>
      </details>`).join("") || `<div class="empty muted">Ничего не найдено</div>`}</div>`;
  }

  function plural(n, a, b, c) { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; }

  function drawer(cfg, cards) {
    const c = cards.find((x) => x.id === ui.open);
    if (!c) return "";
    const row = (k, v) => (v ? `<tr><th>${k}</th><td>${v}</td></tr>` : "");
    const fxList = c.effects.map((e) => {
      let v = e.amount !== undefined ? String(e.amount) + (e.hits > 1 ? ` ×${e.hits} удара` : "") : "";
      return `<li><b>${esc(FX_LABEL[e.type] || e.type)}</b>${v ? " " + esc(v) : ""} <span class="muted small">(${esc(e.type)})</span></li>`;
    }).join("");
    const where = c.src.length ? c.src.map((s) => `<li>${s.type === "weapon" ? `${esc(s.label)} ×${s.n} — ${esc(s.heroes.join(", ") || "ни у кого")}` : s.type === "hero" ? `доп. карта: ${esc(s.label)} ×${s.n}` : esc(s.label)}</li>`).join("") : "<li>ни у кого — карта есть в конфиге, но не попадает в колоды</li>";
    const sims = BP.CatalogSim.results();
    const simRows = Object.entries(sims).map(([bot, r]) => {
      const s = r.summary.cards[c.id];
      return `<tr><th>${esc(bot)}</th><td>${s && s.seen ? `в руке ${Math.round(s.playRate * 100)}% → сыграна · ${s.perFight.toFixed(2)} за бой${s.merged ? ` · в мердж ${Math.round(s.mergeRate * 100)}%` : ""}` : "не попадалась"}${r.stale ? " <span class='muted'>(устарело)</span>" : ""}</td></tr>`;
    }).join("");
    return `<aside class="drawer">
      <button class="close" data-act="close">✕</button>
      <div class="dhead">${cardTile(c, null).replace('class="ctile', 'class="ctile big')}</div>
      <table class="kv">
        ${row("id", `<code>${esc(c.id)}</code>`)}
        ${row("Стоимость", c.cost + " энергии")}
        ${row("Тип", esc(BP.Icons.KIND_LABEL[c.kind]))}
        ${row("Цель", esc(TARGET_LABEL[c.target] || c.target))}
        ${row("Атака", c.attack ? esc({ melee: "мили — только открытые враги", ranged: "дальняя — любой враг", aoe: "массовая" }[c.attack]) : "")}
        ${row("Область", c.area && c.area !== "single" ? esc(BP.Cards.areaLabel(c)) + (c.area === "shape" ? `<span class="dshape">${BP.Icons.shapeSvg(c.shapeSteps, 0)}</span> <span class="muted">(крутится ПКМ)</span>` : "") : "")}
        ${row("Сила", power(c).join("<br>"))}
        ${row("Добавлена", c.added ? esc(c.added) : "")}
      </table>
      <h3>Эффекты</h3><ul class="fx">${fxList || "<li class='muted'>нет</li>"}</ul>
      <h3>Где лежит</h3><ul class="fx">${where}</ul>
      ${c.note ? `<p class="muted small">${esc(c.note)}</p>` : ""}
      <h3>Боты</h3>${simRows ? `<table class="kv">${simRows}</table>` : `<p class="muted small">Ещё не прогоняли — вкладка «Симулятор».</p>`}
    </aside>`;
  }

  function render() {
    const cfg = config(), cards = build(cfg);
    const ov = override();
    const sim = BP.CatalogSim.latest();
    const tab = (k, l) => `<button class="tab${ui.tab === k ? " on" : ""}" data-tab="${k}">${l}</button>`;
    document.getElementById("app").innerHTML = `<div class="cat${ui.open ? " with-drawer" : ""}">
      <header class="cbar">
        <span class="title">Backpack RPG · Карты</span>
        <nav>${tab("cards", "🃏 Карты")}${tab("sim", "🤖 Симулятор")}</nav>
        <span class="grow"></span>
        ${ov ? `<label class="small src" title="Хост менял числа в «⚙ Настройки» в игре — они хранятся только в этом браузере"><input type="checkbox" data-act="override"${ui.useOverride ? " checked" : ""}> учитывать «⚙ Настройки» из этого браузера</label>` : `<span class="muted small src">данные: config.js</span>`}
        ${BOARD_URL ? `<a class="btn primary" href="${esc(BOARD_URL)}" target="_blank" rel="noopener">＋ Новая карта</a>` : ""}
        <a class="btn" href="index.html">← В игру</a>
      </header>
      <main>${ui.tab === "cards" ? renderCards(cfg, cards, sim) : BP.CatalogSim.render(cfg, cards)}</main>
      ${ui.tab === "cards" ? drawer(cfg, cards) : ""}
    </div>`;
  }

  // ---------- события ----------
  function setHash() {
    const h = ui.tab === "sim" ? "#sim" : ui.open ? "#card=" + ui.open : "";
    if (location.hash !== h) history.replaceState(null, "", h || location.pathname + location.search);
  }
  function readHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    ui.tab = h === "sim" ? "sim" : "cards";
    ui.open = h.startsWith("card=") ? h.slice(5) : null;
  }

  function on() {
    const app = document.getElementById("app");
    app.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-tab],[data-group],[data-fx],[data-act],.ctile,summary");
      if (!t) return;
      if (t.matches("summary")) return; // свернуть/развернуть — в обработчике toggle
      if (t.dataset.tab) { ui.tab = t.dataset.tab; ui.open = null; }
      else if (t.dataset.group) { ui.group = t.dataset.group; store.set("group", ui.group); }
      else if (t.dataset.fx) {
        const f = t.dataset.fx;
        if (f === "clear") { ui.fx = []; ui.onlyNew = false; }
        else if (f === "new") ui.onlyNew = !ui.onlyNew;
        else ui.fx = ui.fx.includes(f) ? ui.fx.filter((x) => x !== f) : ui.fx.concat([f]);
      } else if (t.dataset.act === "close") ui.open = null;
      else if (t.dataset.act === "override") { ui.useOverride = t.checked; store.set("override", ui.useOverride); }
      else if (t.dataset.act) return BP.CatalogSim.action(t.dataset.act, t);
      else if (t.classList.contains("ctile") && !t.classList.contains("big")) ui.open = ui.open === t.dataset.card ? null : t.dataset.card;
      else return;
      setHash(); render();
    });
    app.addEventListener("toggle", (ev) => {
      const d = ev.target;
      if (!d.matches || !d.matches("details.group")) return;
      if (d.open) delete ui.closed[d.dataset.key]; else ui.closed[d.dataset.key] = true;
      store.set("closed", ui.closed);
    }, true);
    app.addEventListener("input", (ev) => {
      if (ev.target.id !== "q") return;
      ui.q = ev.target.value;
      const pos = ev.target.selectionStart;
      render();
      const q = document.getElementById("q"); q.focus(); q.setSelectionRange(pos, pos);
    });
    app.addEventListener("change", (ev) => { if (ev.target.dataset && ev.target.dataset.sim) BP.CatalogSim.action("set", ev.target); });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && ui.open) { ui.open = null; setHash(); render(); } });
    window.addEventListener("hashchange", () => { readHash(); render(); });
  }

  function init() { readHash(); on(); render(); }

  return { init, render, config, esc, build, store };
})();
