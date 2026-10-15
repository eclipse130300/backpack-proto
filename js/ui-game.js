// Отрисовка боя: поле врагов, герои, рука, верхняя панель, лог.
window.BP = window.BP || {};

BP.UIGame = (function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function geometry(state) {
    const r = state.config.rules;
    const logW = BP.UI.ui.showLog ? 330 : 0;
    const avail = Math.min(window.innerWidth - logW - 60, 1300);
    const compact = window.innerHeight <= 860;
    const availH = window.innerHeight - 55 - (compact ? 215 : 280) - (compact ? 175 : 235) - (compact ? 60 : 75);
    const hw = Math.max(80, Math.min(175, avail / (r.cols + 0.5), availH / (1 + 0.75 * (r.rows - 1)) / 1.1547));
    const hh = hw * 1.1547;
    return { hw, hh, width: hw * (r.cols + 0.5), height: hh * (1 + 0.75 * (r.rows - 1)), cols: r.cols, rows: r.rows };
  }

  function cellPos(g, col, row) {
    // row 1 (задний) сверху, row 0 (передний) снизу
    const top = (g.rows - 1 - row) * g.hh * 0.75;
    const left = (col + (row === 1 ? 0.5 : 0)) * g.hw;
    return { left, top };
  }

  function heroName(state, id) { const h = state.heroes.find((x) => x.id === id); return h ? h.name : "?"; }

  function intentText(state, e) {
    const it = e.intent;
    if (!it) return "";
    const tgt = it.targets ? " → " + it.targets.map((id) => heroName(state, id)).join(", ") : "";
    const taunt = it.taunted ? " (вызов)" : "";
    switch (it.type) {
      case "stunned": return `<div class="intent stun">💫 оглушён</div>`;
      case "attack": return `<div class="intent">⚔ ${it.damage}${it.hits > 1 ? "×" + it.hits : ""}${esc(tgt)}${taunt}</div>`;
      case "curse": return `<div class="intent">☠ −${it.amount} урона${esc(tgt)}</div>`;
      case "block": return `<div class="intent">🛡 +${it.amount} блока</div>`;
    }
    return "";
  }

  function renderField(state) {
    const g = geometry(state);
    let html = `<div class="field" style="width:${g.width}px;height:${g.height}px;--hw:${g.hw}px">`;
    for (let row = g.rows - 1; row >= 0; row--) {
      for (let col = 0; col < g.cols; col++) {
        const p = cellPos(g, col, row);
        const e = state.enemies.find((x) => x.alive && x.col === col && x.row === row);
        if (e) {
          const badges = [e.stunned ? "оглушён" : "", e.pushedThisTurn ? "толкнут" : "", e.block ? `🛡${e.block}` : ""].filter(Boolean).join(" · ");
          html += `<div class="hex enemy row${row} ${state.actingEnemy === e.uid ? "acting" : ""}" data-drop="enemy" data-enemy="${e.uid}" data-col="${col}" data-row="${row}" style="left:${p.left}px;top:${p.top}px">
            <div class="inner"><div class="ename">${esc(e.name)}</div>
            <div class="bar"><i style="width:${(100 * e.hp) / e.maxHp}%"></i></div>
            <div class="ehp">❤ ${e.hp}/${e.maxHp}</div><div class="badges">${badges}</div>${intentText(state, e)}</div>
            <div class="preview"></div></div>`;
        } else {
          html += `<div class="hex row${row}" data-drop="cell" data-col="${col}" data-row="${row}" style="left:${p.left}px;top:${p.top}px">
            <div class="inner"><span class="rowlabel">${row === 0 ? "передний" : "задний"}</span></div><div class="preview"></div></div>`;
        }
      }
    }
    return html + `</div>`;
  }

  function incomingFor(state, hero) {
    let dmg = 0;
    state.enemies.forEach((e) => {
      if (e.alive && e.intent && e.intent.type === "attack" && (e.intent.targets || []).includes(hero.id)) dmg += e.intent.damage * (e.intent.hits || 1);
    });
    return dmg;
  }

  function renderHeroes(state, myPid, ui) {
    const g = geometry(state);
    const w = g.hw * 2 - 14;
    let html = `<div class="heroes">`;
    state.heroes.forEach((h) => {
      const mine = h.owner === myPid;
      const owner = state.players[h.owner];
      const ready = owner && owner.ready;
      const inc = incomingFor(state, h);
      const crit = Object.values(h.crit || {}).map((c) => `крит через ${c.every - c.count}`).join(", ");
      const weak = (h.debuffs || []).map((d) => `☠ −${d.amount} урона (${d.turns} х.)`).join(" ");
      const energy = state.pool ? `⚡ пул ${state.pool.amount}` : `⚡ ${h.energy}`;
      html += `<div class="hero ${mine ? "mine" : ""} ${ui.activeHero === h.id ? "active" : ""} ${h.alive ? "" : "dead"}" data-drop="hero" data-hero="${h.id}" style="width:${w}px">
        <div class="readytag">${state.phase === "players" && owner ? (ready ? "✅ готов" : "⏳ ходит") : ""}</div>
        <div class="hname">${esc(h.name)}</div>
        <div class="owner">${esc(h.weapons.join(", "))} · ${owner ? "игрок: " + esc(owner.name) : "без игрока"}</div>
        <div class="bar hp"><i style="width:${(100 * h.hp) / h.maxHp}%"></i></div>
        <div class="stats"><span>❤ ${h.hp}/${h.maxHp}</span><span>🛡 ${h.block}</span>${h.startBlock ? `<span title="Стартовый блок — не сгорает, как доп. ХП">⛨ ${h.startBlock}</span>` : ""}
          <span>${energy}</span>${inc ? `<span class="incoming">⚔ входящий ${inc}</span>` : ""}</div>
        <div class="stats small"><span class="muted">${crit}</span>${weak ? `<span class="debuff">${weak}</span>` : ""}</div>
        <div class="mini-hand">${h.alive ? h.hand.map((c) => `<span class="mini ${c.merged ? "merged" : ""}" data-drop="merge" data-hero="${h.id}" data-card="${c.uid}" title="${esc(c.text)}"><b>${c.cost}</b> ${esc(c.name)}${c.merged ? " ★" : ""}</span>`).join("") : "<span class='muted small'>пал</span>"}</div>
      </div>`;
    });
    return html + `</div>`;
  }

  function cardHtml(state, hero, c, ui, readonly) {
    const avail = state.pool ? state.pool.amount : hero.energy;
    const cls = ["card", readonly ? "readonly" : "", !readonly && c.cost > avail ? "unaffordable" : "", ui.selected === c.uid ? "selected" : "", c.id && /^(unity|oath_)/.test(c.id) ? "test" : ""].join(" ");
    const needsBtn = !readonly && ui.selected === c.uid && (c.target === "none" || c.target === "self");
    return `<div class="${cls}" data-card="${c.uid}" data-hero="${hero.id}">
      <div class="cost">${c.cost}</div><div class="cname">${esc(c.name)}</div>
      <div class="ctags">${esc(BP.Cards.tags(c).join(" · "))}</div>
      <div class="ctext">${esc(c.text)}</div>
      ${c.merged ? `<div class="merged">★ усилена мерджем</div>` : ""}
      ${needsBtn ? `<button class="play-btn primary" data-act="play-self">▶ Сыграть</button>` : ""}
    </div>`;
  }

  function renderHand(state, myPid, ui) {
    const mineHeroes = state.heroes.filter((h) => h.owner === myPid);
    const hero = state.heroes.find((h) => h.id === ui.activeHero);
    const me = state.players[myPid];
    const iNeedReady = mineHeroes.some((h) => h.alive);
    const tabs = mineHeroes.length > 1 ? `<div class="hero-tabs">${mineHeroes.map((h, i) => `<button data-act="hero-tab" data-hero="${h.id}" class="${ui.activeHero === h.id ? "active" : ""}">${i + 1}. ${esc(h.name)}</button>`).join("")}</div>` : "";
    const readonly = !hero || hero.owner !== myPid || state.phase !== "players" || !hero.alive;
    let hand = "";
    if (hero) hand = hero.hand.map((c) => cardHtml(state, hero, c, ui, readonly)).join("") || `<span class="muted">Рука пуста</span>`;
    else hand = `<span class="muted">Вы наблюдатель. Нажмите на героя, чтобы посмотреть его руку.</span>`;
    const readyBtn = iNeedReady && state.phase === "players"
      ? `<button class="readybtn ${me && me.ready ? "" : "primary"}" data-act="ready">${me && me.ready ? "Отменить готовность" : "Готов ✔"}</button>`
      : `<div class="muted small">${state.phase === "enemies" ? "Ходят враги…" : ""}</div>`;
    return `<div class="handbar">
      <div class="hand-head"><div><b>${hero ? esc(hero.name) : "—"}</b>${hero && hero.owner !== myPid ? ' <span class="muted small">(чужой, только смотреть)</span>' : ""}</div>${tabs}
        ${hero ? `<div class="pile">Колода: ${hero.draw.length} · Сброс: ${hero.discard.length}</div>` : ""}</div>
      <div class="hand">${hand}</div>
      <div class="hand-side">${readyBtn}${BP.Session.isHost() && state.phase === "players" ? `<button class="small" data-act="force-end">Завершить ход за всех</button>` : ""}</div>
    </div>`;
  }

  function lastEnemyLine(state) {
    const l = state.log[state.log.length - 1];
    return l && state.actingEnemy ? `${l.who} ${l.what}${l.detail ? " — " + l.detail : ""}` : "Ход врагов";
  }

  function renderTop(state, myPid) {
    const enc = state.config.encounters[state.fightIndex] || {};
    const task = state.task ? `<span class="chip task ${state.task.done ? "done" : ""}" title="Задача пати: бонус всем">🎯 ${esc(state.task.text)}${state.task.done ? " ✔" : ""}</span>` : "";
    const quests = state.quests.map((q) => `<span class="chip quest ${q.done ? "done" : ""}">📜 ${esc(q.text)} <span class="muted">(${esc(q.by)})</span>${q.done ? " ✔" : ""}</span>`).join("");
    const pool = state.pool ? `<span class="chip pool">⚡ Общий пул: ${state.pool.amount}</span>` : "";
    const req = BP.Engine.requiredPlayers(state);
    const ready = state.phase === "players" ? `<span class="ready-list row">${req.map((pid) => { const p = state.players[pid]; return p ? `<span class="chip ${p.ready ? "ok" : ""}">${p.ready ? "✅" : "⏳"} ${esc(p.name)}</span>` : ""; }).join("")}</span>` : (state.phase === "enemies" ? `<span class="chip">👹 ${esc(lastEnemyLine(state))}</span>` : "");
    const roomInfo = BP.Session.code ? `<span class="chip" title="Код комнаты">🔑 ${esc(BP.Session.code)}</span>` : `<span class="chip">локально</span>`;
    return `<div class="topbar">
      <span class="title">Бой ${state.fightIndex + 1}/${state.config.encounters.length}: ${esc(enc.name || "")}</span>
      <span class="chip">Ход ${state.turn}</span>${task}${quests}${pool}
      <span class="grow"></span>${ready}${roomInfo}
      <span class="chip">Цели врагов: ${state.config.tests.enemyTargeting}</span>
      ${BP.Session.isHost() ? `<button data-act="settings">⚙ Настройки</button>` : ""}
      ${state.summary ? `<button data-act="show-summary">Итоги боя</button>` : ""}
      <button data-act="toggle-log">📜 Лог</button>
    </div>`;
  }

  function renderLog(state) {
    const items = state.log.slice(-150).map((l) => `<div class="entry"><span class="muted">[${l.fight}/${l.turn}]</span> <span class="who">${esc(l.who)}</span> ${esc(l.what)}${l.detail ? ` <span class="det">— ${esc(l.detail)}</span>` : ""}</div>`).join("");
    return `<div class="logpanel"><div class="head"><b class="grow">Лог</b><button class="small" data-act="log-csv">CSV</button><button class="small" data-act="log-json">JSON</button></div>
      <div class="entries" id="log-entries">${items}</div></div>`;
  }

  function render(state, myPid, ui) {
    return `<div class="game ${ui.showLog ? "with-log" : ""}">
      ${renderTop(state, myPid)}
      <div class="board" id="board">${renderField(state)}${renderHeroes(state, myPid, ui)}</div>
      ${ui.showLog ? renderLog(state) : ""}
      ${renderHand(state, myPid, ui)}
    </div>`;
  }

  return { render, geometry, cellPos, esc };
})();
