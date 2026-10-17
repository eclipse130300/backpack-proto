// Экраны: меню, лобби, бой, модалки (настройки, итоги). Делегирование кликов.
window.BP = window.BP || {};

BP.UI = (function () {
  const esc = (s) => BP.UIGame.esc(s);
  const ui = { activeHero: null, selected: null, dirPick: null, aoeRot: 0, showLog: false, modal: null, lastBanner: null, menuMsg: "" };
  const app = () => document.getElementById("app");

  function lsGet(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  // ---------- Тосты ----------
  function toast(msg, kind) {
    let box = document.querySelector(".toasts");
    if (!box) { box = document.createElement("div"); box.className = "toasts"; document.body.appendChild(box); }
    const t = document.createElement("div");
    t.className = "toast " + (kind || "");
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), kind === "good" ? 4500 : 3000);
  }

  // ---------- Меню ----------
  function renderMenu() {
    const room = new URLSearchParams(location.search).get("room") || "";
    return `<div class="screen-center"><div class="box">
      <h1>Backpack RPG — прототип механик</h1>
      <div class="muted">Кооп-бой: 3 героя, враги на поле 6×2. Только для монитора.</div>
      ${window.BP_versionLine ? window.BP_versionLine() : ""}
      <div class="menu-block">
        <label class="row">Ваше имя <input id="name" class="grow" maxlength="20" value="${esc(lsGet("bprpg-name", ""))}" placeholder="Например, Дима"></label>
        <div class="row"><button class="primary grow" data-act="host">Создать комнату (по сети)</button></div>
        <div class="row"><input id="code" placeholder="КОД" maxlength="5" style="width:130px;text-transform:uppercase;letter-spacing:3px" value="${esc(room)}"><button class="${room ? "primary" : ""} grow" data-act="join">Войти по коду</button></div>
        <div class="row"><button class="grow" data-act="local">Играть локально (все герои у меня)</button></div>
        <div class="row"><a class="grow" href="cards.html" style="text-align:center;color:var(--gold)">🃏 Все карты и симулятор ботов</a></div>
        ${ui.menuMsg ? `<div class="warn">${esc(ui.menuMsg)}</div>` : ""}
      </div></div></div>`;
  }

  // ---------- Лобби ----------
  function renderLobby(s) {
    const me = BP.Session.myPid, host = BP.Session.isHost();
    const local = BP.Session.role === "local";
    const link = location.origin + location.pathname + "?room=" + BP.Session.code + (new URLSearchParams(location.search).get("net") ? "&net=bc" : "");
    const players = Object.entries(s.players);
    const override = host && BP.Session.getOverride();
    const heroes = s.heroes.map((h, i) => {
      const hc = s.config.heroes[i];
      const owner = s.players[h.owner];
      let ctrl = "";
      if (local) ctrl = `<span class="muted">ваш</span>`;
      else if (host) ctrl = `<select data-act="assign" data-hero="${h.id}"><option value="">— никто —</option>${players.map(([pid, p]) => `<option value="${pid}" ${h.owner === pid ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select>`;
      else if (!h.owner) ctrl = `<button class="primary" data-act="claim" data-hero="${h.id}">Взять</button>`;
      else if (h.owner === me) ctrl = `<button data-act="release" data-hero="${h.id}">Отпустить</button>`;
      return `<div class="lobby-hero"><h3>${esc(h.name)}</h3><div class="muted small">❤ ${hc.hp} · ⛨ ${hc.startBlock} · ${esc(h.weapons.join(", "))}</div>
        <div class="owner">${owner ? "Игрок: <b>" + esc(owner.name) + "</b>" : '<span class="muted">свободен</span>'}</div>${ctrl}</div>`;
    }).join("");
    return `<div class="screen-center"><div class="box" style="min-width:820px">
      <h1>${local ? "Локальная игра" : "Комната"}</h1>
      ${local ? "" : `<div class="row"><span class="code-big">${esc(BP.Session.code || "…")}</span><span class="grow"></span><button data-act="copy-link" data-link="${esc(link)}">Скопировать ссылку</button></div>
      <div class="muted small" style="margin-top:6px">Друзья открывают ссылку или вводят код. Игроки: ${players.map(([, p]) => esc(p.name)).join(", ")}</div>`}
      ${override ? `<div class="warn" style="margin-top:12px">Используется конфиг из «Настроек» (сохранён ${esc(override.savedAt.slice(0, 16).replace("T", " "))}), а не config.js. <button class="small" data-act="reset-config">Вернуть config.js</button></div>` : ""}
      <div class="lobby-heroes">${heroes}</div>
      <div class="muted small">Свободные герои при старте достанутся хосту. Хост без героев — наблюдатель.</div>
      <div class="row" style="margin-top:14px">${host ? `<button class="primary" data-act="start">Начать бой</button><button data-act="settings">⚙ Настройки и тесты</button>` : `<span class="muted">Ждём, пока хост начнёт…</span>`}</div>
    </div></div>`;
  }

  // ---------- Модалка настроек (хост) — js/ui-settings.js ----------
  const renderSettings = (s) => BP.UISettings.render(s);
  const collectSettings = (s) => BP.UISettings.collect(s, toast);

  // ---------- Итоги боя ----------
  function renderSummary(s) {
    const sm = s.summary, host = BP.Session.isHost();
    if (!sm) return "";
    const title = s.phase === "victory" ? "Победа! Все бои пройдены" : sm.win ? `Бой ${sm.fight} выигран` : `Поражение в бою ${sm.fight}`;
    const rows = sm.heroes.map((h) => `<tr><td>${esc(h.name)}</td><td>${h.hp}/${h.maxHp}</td><td>${h.cards}</td><td>${h.energy}</td><td>${h.damage}</td><td>${h.blockGiven}</td><td>${h.taken}</td><td>${h.merges}</td></tr>`).join("");
    return `<div class="modal-back"><div class="modal" style="max-width:860px">
      <h2>${title}</h2>
      <div class="muted">«${esc(sm.name)}» · ходов: ${sm.turns} · столкновений: ${sm.collisions}${sm.quest ? ` · квест боя: ${sm.quest.done ? "✔ выполнен" : "✘ нет"}` : ""}</div>
      <table><tr><th>Герой</th><th>ХП</th><th>Карт</th><th>Энергии</th><th>Урон</th><th>Блок дал</th><th>Урона получил</th><th>Мерджей</th></tr>${rows}</table>
      <div class="row">${host ? (s.phase === "won" ? `<button class="primary" data-act="next">Следующий бой</button>` : `<button class="primary" data-act="retry">Заново</button>`) : `<span class="muted">Ждём хоста…</span>`}
      <button data-act="log-csv">Скачать лог (CSV)</button><button data-act="toggle-log">Показать лог</button></div>
    </div></div>`;
  }

  // ---------- Выбор направления толчка ----------
  function placeDirPick(s) {
    if (!ui.dirPick) return;
    const e = s.enemies.find((x) => x.uid === ui.dirPick.enemy && x.alive);
    const field = document.querySelector(".field");
    if (!e || !field) { ui.dirPick = null; return; }
    const g = BP.UIGame.geometry(s), p = BP.UIGame.cellPos(g, e.col, e.row);
    const cx = p.left + g.hw / 2, cy = p.top + g.hh / 2, R = g.hw * 0.78;
    const box = document.createElement("div");
    box.className = "dirpick";
    box.style.left = "0"; box.style.top = "0";
    box.innerHTML = BP.Hex.DIRS.map((d) => {
      const a = (d.angle * Math.PI) / 180;
      return `<button data-act="dir" data-dir="${d.id}" title="${d.name}" style="left:${cx + Math.cos(a) * R}px;top:${cy - Math.sin(a) * R}px">${d.label}</button>`;
    }).join("") + `<div class="hint" style="left:${g.width / 2}px;top:-46px">Куда толкнуть «${BP.UIGame.esc(e.name)}»? Край поля или другой враг = столкновение <button data-act="dir-cancel">Отмена (Esc)</button></div>`;
    field.appendChild(box);
  }

  // ---------- Главный рендер ----------
  function render() {
    const s = BP.Session.state;
    if (!s) { app().innerHTML = renderMenu(); BP.FX.afterRender(null); return; }
    const me = BP.Session.myPid;
    if (s.banner && s.banner.id !== ui.lastBanner) { ui.lastBanner = s.banner.id; toast(s.banner.text, "good"); }
    if (s.phase === "lobby") {
      app().innerHTML = renderLobby(s) + (ui.modal === "settings" ? renderSettings(s) : "");
      BP.FX.afterRender(s);
      return;
    }
    const mine = s.heroes.filter((h) => h.owner === me);
    if (!s.heroes.find((h) => h.id === ui.activeHero) || (mine.length && !mine.find((h) => h.id === ui.activeHero))) {
      ui.activeHero = (mine.find((h) => h.alive) || mine[0] || s.heroes[0]).id;
    }
    const logEl = document.getElementById("log-entries");
    const logAtBottom = !logEl || logEl.scrollTop + logEl.clientHeight >= logEl.scrollHeight - 30;
    const deckEl = document.getElementById("deck-scroll");
    const deckScroll = deckEl ? deckEl.scrollTop : 0;
    let html = BP.UIGame.render(s, me, ui);
    if (["won", "lost", "victory"].includes(s.phase)) {
      // Конец боя: ~2.5 с экран заблокирован (досмотреть цифры урона), потом окно итогов (rules.endFightDelayMs)
      const delay = s.config.rules.endFightDelayMs || 0, sid = s.summary && s.summary.id;
      if (ui.endId !== sid) { ui.endId = sid; ui.endAt = Date.now(); if (delay) setTimeout(render, delay + 30); }
      if (Date.now() - ui.endAt < delay) html += `<div class="end-block"></div>`;
      else if (ui.modal !== "hide-summary") html += renderSummary(s);
    }
    if (ui.modal === "deck" || ui.modal === "discard") html += BP.UIDeck.render(s, ui.modal);
    if (ui.modal === "settings") html += renderSettings(s);
    app().innerHTML = html;
    const nd = document.getElementById("deck-scroll");
    if (nd) nd.scrollTop = deckScroll;
    const board = document.getElementById("board");
    if (board) board.dataset.drop = "field";
    placeDirPick(s);
    const nl = document.getElementById("log-entries");
    if (nl && logAtBottom) nl.scrollTop = nl.scrollHeight;
    BP.Drag.refresh();
    BP.FX.afterRender(s);
    BP.UIQuest.afterRender(s);
  }

  // ---------- Действия кнопок ----------
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: type || "text/plain" }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function logCsv() {
    const cols = ["fight", "turn", "time", "who", "what", "card", "cost", "merge", "detail"];
    const q = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    return "﻿" + cols.join(";") + "\n" + BP.Session.fullLog().map((l) => cols.map((c) => q(l[c])).join(";")).join("\n");
  }

  function onAction(el) {
    const act = el.dataset.act, s = BP.Session.state;
    const name = () => { const v = (document.getElementById("name") || {}).value || ""; lsSet("bprpg-name", v); return v.trim() || "Игрок"; };
    switch (act) {
      case "local": BP.Session.startLocal(name()); break;
      case "host": { const n = name(); ui.menuMsg = "Создаю комнату…"; render(); BP.Session.startHost(n, () => { ui.menuMsg = ""; }); break; }
      case "join": {
        const code = (document.getElementById("code").value || "").trim();
        if (code.length < 4) return toast("Введите код комнаты", "bad");
        const n = name();
        ui.menuMsg = "Подключаюсь…"; render();
        BP.Session.join(code, n, (m) => { ui.menuMsg = m; BP.UI.render(); });
        break;
      }
      case "copy-link":
        try { navigator.clipboard.writeText(el.dataset.link); toast("Ссылка скопирована", "good"); } catch (e) { prompt("Ссылка:", el.dataset.link); }
        break;
      case "claim": BP.Session.dispatch({ a: "claim", hero: el.dataset.hero }); break;
      case "release": BP.Session.dispatch({ a: "release", hero: el.dataset.hero }); break;
      case "start": BP.Session.dispatch({ a: "start" }); ui.modal = null; break;
      case "ready": { const me = s.players[BP.Session.myPid]; BP.Session.dispatch({ a: "ready", value: !(me && me.ready) }); break; }
      case "force-end": BP.Session.dispatch({ a: "forceEnd" }); break;
      case "next": ui.modal = null; BP.Session.dispatch({ a: "next" }); break;
      case "retry": ui.modal = null; BP.Session.dispatch({ a: "retry" }); break;
      case "hero-tab": ui.activeHero = el.dataset.hero; ui.selected = null; render(); break;
      case "toggle-log": ui.showLog = !ui.showLog; if (ui.showLog && s && s.summary && ui.modal !== "settings") ui.modal = "hide-summary"; render(); break;
      case "show-summary": ui.modal = null; render(); break;
      case "deck-view": ui.modal = "deck"; render(); break;
      case "discard-view": ui.modal = "discard"; render(); break;
      case "quest-vote": BP.Session.dispatch({ a: "questVote", idx: +el.dataset.idx }); break;
      case "settings": ui.modal = "settings"; render(); break;
      case "set-help": BP.UISettings.toggleHelp(el); break;
      case "modal-close": ui.modal = null; render(); break;
      case "cfg-apply": { const cfg = collectSettings(s); if (cfg) { ui.modal = null; BP.Session.applyConfig(cfg); toast("Конфиг применён, забег перезапущен", "good"); } break; }
      case "cfg-download": {
        const cfg = collectSettings(s);
        if (cfg) download("config.js", "// Выгружено из настроек прототипа " + new Date().toLocaleString() + "\nwindow.GAME_CONFIG = " + JSON.stringify(cfg, null, 2) + ";\n", "text/javascript");
        break;
      }
      case "reset-config": BP.Session.clearOverride(); ui.modal = null; BP.Session.restart(window.GAME_CONFIG); toast("Снова используется config.js", "good"); break;
      case "dir": { const d = ui.dirPick; ui.dirPick = null; BP.Session.dispatch({ a: "play", hero: d.hero, card: d.card, target: { enemy: d.enemy, dir: +el.dataset.dir } }); break; }
      case "dir-cancel": ui.dirPick = null; render(); break;
      case "play-self": {
        const cardEl = el.closest(".card");
        ui.selected = null;
        BP.Session.dispatch({ a: "play", hero: cardEl.dataset.hero, card: cardEl.dataset.card, target: {} });
        break;
      }
      case "log-csv": download(`bprpg-log-${Date.now()}.csv`, logCsv(), "text/csv"); break;
      case "log-json": download(`bprpg-log-${Date.now()}.json`, JSON.stringify(BP.Session.fullLog(), null, 1), "application/json"); break;
    }
  }

  function init() {
    document.addEventListener("click", (ev) => {
      const el = ev.target.closest("[data-act]");
      if (el && el.tagName !== "SELECT") { onAction(el); return; }
      // клик по тёмному фону окна колоды — закрыть
      if (ev.target.classList && ev.target.classList.contains("deck-back")) { ui.modal = null; render(); return; }
      // клик по своему герою (без выбранной карты) — сделать активным
      const heroEl = ev.target.closest(".hero[data-hero]");
      if (heroEl && !ui.selected) { ui.activeHero = heroEl.dataset.hero; render(); }
    });
    document.addEventListener("change", (ev) => {
      const el = ev.target;
      if (el.dataset.act === "assign") BP.Session.dispatch({ a: "assign", hero: el.dataset.hero, player: el.value });
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA") return;
      const s = BP.Session.state;
      if (!s || s.phase === "lobby") return;
      if (ev.key === "Escape" && (ui.modal === "deck" || ui.modal === "discard")) { ui.modal = null; render(); return; }
      const mine = s.heroes.filter((h) => h.owner === BP.Session.myPid);
      const n = parseInt(ev.key, 10);
      if (n >= 1 && n <= mine.length) { ui.activeHero = mine[n - 1].id; ui.selected = null; render(); }
    });
    window.addEventListener("resize", () => render());
    BP.Session.onChange(() => { if (ui.modal !== "settings") render(); });
    BP.Session.onError((m) => toast(m, "bad"));
    BP.Drag.init();
    BP.FX.init();
    render();
  }

  return { init, render, toast, ui };
})();
