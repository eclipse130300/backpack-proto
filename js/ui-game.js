// Отрисовка боя: поле врагов, фишки героев, руки всех героев внизу, верхняя панель, лог.
window.BP = window.BP || {};

BP.UIGame = (function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const icon = (n, cls) => BP.Icons.svg(n, cls);
  const corridors = (state) => state.config.tests.enemyTargeting === "A";

  function sizes() {
    const compact = window.innerHeight <= 860, big = window.innerHeight >= 1000;
    return { compact, handH: big ? 280 : compact ? 224 : 248, tokensH: compact ? 84 : 104, cardW: big ? 126 : compact ? 92 : 112, logW: BP.UI.ui.showLog ? 330 : 0 };
  }

  function geometry(state) {
    const r = state.config.rules, z = sizes();
    const availW = Math.min(window.innerWidth - z.logW - 2 * 190, 1300);
    const availH = window.innerHeight - 54 - z.handH - z.tokensH - 76;
    const hw = Math.max(80, Math.min(190, availW / (r.cols + 0.5), availH / (1 + 0.75 * (r.rows - 1)) / 1.1547));
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
  function heroIcon(state, h) { const hc = state.config.heroes.find((x) => x.id === h.id); return (hc && hc.icon) || "helm"; }

  function intentHtml(state, e) {
    const it = e.intent;
    if (!it) return "";
    const tgt = it.targets ? " → " + it.targets.map((id) => heroName(state, id)).join(", ") : "";
    const taunt = it.taunted ? " (вызов)" : "";
    switch (it.type) {
      case "stunned": return `<div class="intent stun">💫 оглушён</div>`;
      case "covered": return `<div class="intent covered">🚫 закрыт, ждёт</div>`;
      case "attack": return `<div class="intent atk">⚔ ${it.damage}${it.hits > 1 ? "×" + it.hits : ""}${esc(tgt)}${taunt}</div>`;
      case "curse": return `<div class="intent curse">☠ −${it.amount}${esc(tgt)}</div>`;
      case "block": return `<div class="intent def">🛡 +${it.amount}</div>`;
    }
    return "";
  }

  function renderField(state) {
    const g = geometry(state), lanes = corridors(state);
    let html = `<div class="field" style="width:${g.width}px;height:${g.height}px;--hw:${g.hw}px">`;
    for (let row = g.rows - 1; row >= 0; row--) {
      for (let col = 0; col < g.cols; col++) {
        const p = cellPos(g, col, row);
        const lane = lanes ? ` lane${BP.Hex.laneOf(col, g.cols)}` : "";
        const e = state.enemies.find((x) => x.alive && x.col === col && x.row === row);
        if (e) {
          const ed = state.config.enemies[e.type] || {};
          const covered = !BP.Cards.isExposed(state, e);
          const badges = [e.stunned ? "оглушён" : "", e.pushedThisTurn ? "толкнут" : "", covered ? "⛨ прикрыт" : ""].filter(Boolean).join(" · ");
          html += `<div class="hex enemy row${row}${lane} ${state.actingEnemy === e.uid ? "acting" : ""}" data-drop="enemy" data-tip="enemy" data-enemy="${e.uid}" data-col="${col}" data-row="${row}" style="left:${p.left}px;top:${p.top}px">
            <div class="inner"><div class="etype">${ed.melee ? "мили" : "дальн."}</div><div class="ename">${esc(e.name)}</div>
            <div class="bar"><i style="width:${(100 * e.hp) / e.maxHp}%"></i></div>
            <div class="ehp">❤ ${e.hp}/${e.maxHp}${e.block ? ` <span class="eblock">🛡${e.block}</span>` : ""}</div>${intentHtml(state, e)}<div class="badges">${badges}</div></div>
            <div class="preview"></div></div>`;
        } else {
          html += `<div class="hex row${row}${lane}" data-drop="cell" data-col="${col}" data-row="${row}" style="left:${p.left}px;top:${p.top}px">
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

  function hpBar(h) {
    return `<div class="bar hp"><i style="width:${(100 * h.hp) / h.maxHp}%"></i><span>${h.hp}/${h.maxHp}</span></div>`;
  }

  // Фишки героев под полем: каждая стоит под своим коридором
  function renderTokens(state, myPid, ui) {
    const g = geometry(state), lanes = corridors(state);
    let html = `<div class="heroes" style="width:${g.width}px">`;
    state.heroes.forEach((h, i) => {
      const owner = state.players[h.owner];
      const inc = incomingFor(state, h);
      const weak = (h.debuffs || []).map((d) => `☠ −${d.amount} урона (${d.turns} х.)`).join(" ");
      const tgt = state.actingTargets && state.actingTargets.includes(h.id) ? "targeted" : "";
      html += `<div class="hero token ${lanes ? "lane" + i : ""} ${h.owner === myPid ? "mine" : ""} ${ui.activeHero === h.id ? "active" : ""} ${h.alive ? "" : "dead"} ${tgt}" data-drop="hero" data-tip="hero" data-hero="${h.id}" style="width:${g.hw * 2 - 14}px">
        <div class="portrait">${icon(heroIcon(state, h))}</div>
        <div class="tinfo">
          <div class="hname">${esc(h.name)} ${state.phase === "players" && owner ? `<span class="readytag">${owner.ready ? "✅" : "⏳"}</span>` : ""}</div>
          ${hpBar(h)}
          <div class="stats"><span title="Блок (сгорает после хода врагов)">🛡 ${h.block}</span>${h.startBlock ? `<span title="Стартовый блок — как доп. ХП на бой">⛨ ${h.startBlock}</span>` : ""}${inc ? `<span class="incoming">⚔ ${inc}</span>` : ""}${weak ? `<span class="debuff">${weak}</span>` : ""}</div>
        </div>
      </div>`;
    });
    return html + `</div>`;
  }

  function shortText(state, c) {
    const qe = (c.effects || []).find((e) => e.type === "quest");
    if (qe && state.config.quests[qe.id]) return "📜 " + state.config.quests[qe.id].text;
    return c.text;
  }

  function cardHtml(state, hero, c, ui, readonly, ml) {
    const avail = state.pool ? state.pool.amount : hero.energy;
    const cls = ["card", readonly ? "readonly" : "", !readonly && c.cost > avail ? "unaffordable" : "", ui.selected === c.uid ? "selected" : "", c.id && /^(unity|oath_)/.test(c.id) ? "test" : ""].join(" ");
    const needsBtn = !readonly && ui.selected === c.uid && (c.target === "none" || c.target === "self");
    const ci = BP.Cards.critInfo(hero, c);
    const crit = ci ? `<div class="crit ${ci.willCrit ? "on" : ""}">${ci.willCrit ? "💥 КРИТ" : `💥 через ${ci.left}`}</div>` : "";
    return `<div class="${cls}" data-card="${c.uid}" data-hero="${hero.id}" data-drop="merge" data-tip="card" style="${ml ? `margin-left:${ml}px` : ""}">
      <div class="cost">${c.cost}</div>
      <div class="cart">${icon(c.icon)}${c.area === "shape" ? BP.Icons.shapeSvg(c.shapeSteps, 0) : ""}${crit}</div>
      <div class="cname">${esc(c.name)}</div>
      <div class="ctext">${esc(shortText(state, c))}</div>
      ${c.merged ? `<div class="cmerged">★${c.merged > 1 ? c.merged : ""}</div>` : ""}
      ${needsBtn ? `<button class="play-btn primary" data-act="play-self">▶ Сыграть</button>` : ""}
    </div>`;
  }

  // Руки всех трёх героев внизу экрана — переключаться не нужно
  function renderHands(state, myPid, ui) {
    const z = sizes(), lanes = corridors(state);
    const secW = (window.innerWidth - z.logW) / 3 - 22;
    const html = state.heroes.map((h, i) => {
      const owner = state.players[h.owner];
      const readonly = h.owner !== myPid || state.phase !== "players" || !h.alive;
      const n = h.hand.length, gap = 8;
      const over = n > 1 ? Math.min(gap, (secW - n * z.cardW) / (n - 1)) : gap;
      const cards = h.alive ? (h.hand.map((c, k) => cardHtml(state, h, c, ui, readonly, k ? over : 0)).join("") || `<span class="muted small">Рука пуста</span>`) : `<span class="muted">пал в бою</span>`;
      const maxE = state.config.rules.energy;
      const en = state.pool ? `<span class="pool">⚡ пул ${state.pool.amount}</span>` : `<span class="pips">${Array.from({ length: Math.max(maxE, h.energy) }, (_, k) => `<i class="${k < h.energy ? "on" : ""}"></i>`).join("")}</span>`;
      return `<div class="hsec ${lanes ? "lane" + i : ""} ${h.owner === myPid ? "mine" : ""} ${ui.activeHero === h.id ? "active" : ""} ${h.alive ? "" : "dead"}" data-drop="hero" data-hero="${h.id}">
        <div class="hsec-head">
          <div class="portrait sm">${icon(heroIcon(state, h))}</div>
          <div class="hs-name"><b>${esc(h.name)}</b><span class="muted small">${owner ? esc(owner.name) : "без игрока"}${h.owner !== myPid ? " · смотреть" : ""}</span></div>
          ${hpBar(h)}${en}
          <span class="pile" title="Колода / сброс">🂠 ${h.draw.length} · ♻ ${h.discard.length}</span>
        </div>
        <div class="hand">${cards}</div>
      </div>`;
    }).join("");
    return `<div class="handbar">${html}</div>`;
  }

  function renderSide(state, myPid) {
    const me = state.players[myPid];
    const iNeedReady = state.heroes.some((h) => h.owner === myPid && h.alive);
    const readyBtn = iNeedReady && state.phase === "players"
      ? `<button class="readybtn ${me && me.ready ? "" : "primary"}" data-act="ready">${me && me.ready ? "Отменить готовность" : "Готов ✔"}</button>`
      : `<div class="muted">${state.phase === "enemies" ? "Ходят враги…" : ""}</div>`;
    return `<div class="board-side">${readyBtn}${BP.Session.isHost() && state.phase === "players" && BP.Session.role !== "local" ? `<button class="small" data-act="force-end">Завершить ход за всех</button>` : ""}</div>`;
  }

  function lastEnemyLine(state) {
    const l = state.log[state.log.length - 1];
    return l && state.actingEnemy ? `${l.who} ${l.what}${l.detail ? " — " + l.detail : ""}` : "Ход врагов";
  }

  function renderTop(state) {
    const enc = state.config.encounters[state.fightIndex] || {};
    const task = state.task ? `<span class="chip task ${state.task.done ? "done" : ""}" data-tip="task">🎯 Задача пати${state.task.done ? " ✔" : ""}</span>` : "";
    const quests = state.quests.map((q, i) => `<span class="chip quest ${q.done ? "done" : ""}" data-tip="quest" data-idx="${i}">📜 ${esc(q.text)}${q.done ? " ✔" : ""}</span>`).join("");
    const pool = state.pool ? `<span class="chip pool">⚡ Общий пул: ${state.pool.amount}</span>` : "";
    const req = BP.Engine.requiredPlayers(state);
    const ready = state.phase === "players" ? `<span class="ready-list row">${req.map((pid) => { const p = state.players[pid]; return p ? `<span class="chip ${p.ready ? "ok" : ""}">${p.ready ? "✅" : "⏳"} ${esc(p.name)}</span>` : ""; }).join("")}</span>` : (state.phase === "enemies" ? `<span class="chip enemy-line">👹 ${esc(lastEnemyLine(state))}</span>` : "");
    const roomInfo = BP.Session.code ? `<span class="chip" title="Код комнаты">🔑 ${esc(BP.Session.code)}</span>` : `<span class="chip">локально</span>`;
    return `<div class="topbar">
      <span class="title">Бой ${state.fightIndex + 1}/${state.config.encounters.length}: ${esc(enc.name || "")}</span>
      <span class="chip">Ход ${state.turn}</span>${task}${quests}${pool}
      <span class="grow"></span>${ready}${roomInfo}
      <span class="chip" data-tip="targeting">Цели врагов: ${corridors(state) ? "коридоры" : "любой"}</span>
      ${BP.Session.isHost() ? `<button data-act="settings">⚙</button>` : ""}
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
      ${renderTop(state)}
      <div class="board" id="board"><div class="board-hint" id="board-hint"></div>${renderField(state)}${renderTokens(state, myPid, ui)}${renderSide(state, myPid)}</div>
      ${ui.showLog ? renderLog(state) : ""}
      ${renderHands(state, myPid, ui)}
    </div>`;
  }

  return { render, geometry, cellPos, esc, heroName, intentHtml, shortText };
})();
