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
    // Хексы ровной стороной к героям: ширина hw (угол–угол), высота hh = hw·0.866, шаг колонок 0.75·hw,
    // нечётные колонки (1, 3, 5) сдвинуты на полхекса назад (вверх).
    const wUnits = 0.75 * (r.cols - 1) + 1, hUnits = 0.866 * (r.rows + 0.5);
    const hw = Math.max(80, Math.min(230, availW / wUnits, availH / hUnits));
    const hh = hw * 0.866;
    return { hw, hh, width: hw * wUnits, height: hh * (r.rows + 0.5), cols: r.cols, rows: r.rows };
  }

  function cellPos(g, col, row) {
    // row 1 (задний) сверху, row 0 (передний) снизу; нечётные колонки выше на полхекса
    const top = (g.rows - 1 - row) * g.hh + (Math.abs(col) % 2 === 1 ? 0 : g.hh / 2);
    const left = col * 0.75 * g.hw;
    return { left, top };
  }

  function heroName(state, id) { const h = state.heroes.find((x) => x.id === id); return h ? h.name : "?"; }
  function heroIcon(state, h) { const hc = state.config.heroes.find((x) => x.id === h.id); return (hc && hc.icon) || "helm"; }
  // Цвет героя = цвет его коридора (lane0..2) — им же подсвечены его карты в режиме общей колоды
  const heroIdx = (state, id) => state.heroes.findIndex((x) => x.id === id);
  function portrait(state, h, sm) {
    return `<div class="portrait hc${heroIdx(state, h.id)} ${sm ? "sm" : ""}">${icon(heroIcon(state, h))}</div>`;
  }
  // Значки оружия и щита героя
  function weaponsHtml(state, h) {
    const hc = state.config.heroes[heroIdx(state, h.id)] || {};
    return `<span class="wicons">${(hc.weapons || []).map((wid) => { const w = state.config.weapons[wid] || {}; return `<span class="wicon ${w.kind || ""}" title="${esc((w.kind === "shield" ? "Щит: " : "Оружие: ") + (w.name || wid))}">${icon(w.icon || "w_sword")}</span>`; }).join("")}</span>`;
  }

  function intentHtml(state, e) {
    const it = e.intent;
    if (!it) return "";
    const tgt = it.targets ? " → " + it.targets.map((id) => heroName(state, id)).join(", ") : "";
    const taunt = it.taunted ? " (вызов)" : "";
    switch (it.type) {
      case "stunned": return `<div class="intent stun">💫 оглушён</div>`;
      case "covered": return `<div class="intent covered">🚫 закрыт, ждёт</div>`;
      case "attack": return `<div class="intent atk">⚔ ${it.damage}${it.hits > 1 ? "×" + it.hits : ""}${it.armor ? ` ⬢+${it.armor}` : ""}${esc(tgt)}${taunt}</div>`;
      case "disable": return `<div class="intent curse">⛓ выведет${esc(tgt)}</div>`;
      case "arriving": return `<div class="intent covered">👀 осматривается</div>`;
      case "block": return `<div class="intent def">🛡 +${it.amount}</div>`;
    }
    return "";
  }

  function renderField(state) {
    const g = geometry(state), lanes = corridors(state), rf = BP.Reinforce.info(state);
    let html = `<div class="field" style="width:${g.width}px;height:${g.height}px;--hw:${g.hw}px">`;
    for (let row = g.rows - 1; row >= 0; row--) {
      for (let col = 0; col < g.cols; col++) {
        const p = cellPos(g, col, row);
        const lane = lanes ? ` lane${BP.Hex.laneOf(col, g.cols)}` : "";
        const e = state.enemies.find((x) => x.alive && x.col === col && x.row === row);
        if (e) {
          const ed = state.config.enemies[e.type] || {};
          const covered = !BP.Cards.isExposed(state, e);
          const marked = state.quest && !state.quest.done && state.quest.mark === e.uid;
          // на выборе квеста: какие варианты отмечают этого врага
          const pickMarks = state.questPick ? state.questPick.options.map((q, i) => (q.mark === e.uid ? "🎯" + (i + 1) : "")).filter(Boolean).join(" ") : "";
          const badges = [marked ? "🎯 квест" : "", pickMarks, e.stunned ? "оглушён" : "", e.vuln ? "💥 +50%" : "", covered ? "⛨ прикрыт" : ""].filter(Boolean).join(" · ");
          html += `<div class="hex enemy row${row}${lane} ${state.actingEnemy === e.uid ? "acting" : ""}" data-drop="enemy" data-tip="enemy" data-enemy="${e.uid}" data-col="${col}" data-row="${row}" style="left:${p.left}px;top:${p.top}px">
            <div class="inner"><div class="etype">${ed.melee ? "мили" : "дальн."}</div><div class="ename">${esc(e.name)}</div>
            <div class="bar"><i style="width:${(100 * e.hp) / e.maxHp}%"></i></div>
            <div class="ehp">❤ ${e.hp}/${e.maxHp}${e.armor ? ` <span class="earmor" title="Броня: не сгорает, сначала урон идёт в неё">⬢${e.armor}</span>` : ""}${e.block ? ` <span class="eblock">🛡${e.block}</span>` : ""}</div>${intentHtml(state, e)}<div class="badges">${badges}</div></div>
            <div class="preview"></div></div>`;
        } else {
          // подкрепление (js/reinforce.js): клетка, куда выйдет враг в начале следующего хода
          const mk = rf && rf.marks.find((m) => m.col === col && m.row === row);
          const label = mk ? `<span class="incoming-mark">⚠ ${esc((state.config.enemies[mk.type] || {}).name || mk.type)}</span>` : `<span class="rowlabel">${row === 0 ? "передний" : "задний"}</span>`;
          html += `<div class="hex row${row}${lane}${mk ? " incoming" : ""}" data-drop="cell" data-col="${col}" data-row="${row}" style="left:${p.left}px;top:${p.top}px">
            <div class="inner">${label}</div><div class="preview"></div></div>`;
        }
      }
    }
    // Квест боя: «?» над полем. Серый — не выполнен, золотой — выполнен (как в WoW).
    if (rf) html += `<div class="reinf" title="Подкрепление врагов: столько ещё в резерве; выходят на помеченные ⚠ клетки">👹 Подкрепление: ${rf.left} · ${rf.inTurns === 1 ? "в начале след. хода" : `через ${rf.inTurns} хода`}</div>`;
    if (state.quest) html += `<div class="fquest ${state.quest.done ? "done" : ""}" data-tip="fquest" style="left:${g.width / 2}px">?</div>`;
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
      // card-mechanics-1: выведен Жрецом, промах (Дымовая завеса), бафы Силы и Стойкости
      const weak = [h.out ? "⛓ выведен" : "", h.disableNext ? "⛓ след. ход" : "", h.miss ? `🌫${h.miss > 1 ? h.miss : ""} промах` : "", h.dmgBuff ? `⚔+${h.dmgBuff}` : "", h.blockBuff ? `🛡+${h.blockBuff}` : ""].filter(Boolean).join(" ");
      const tgt = state.actingTargets && state.actingTargets.includes(h.id) ? "targeted" : "";
      html += `<div class="hero token ${lanes ? "lane" + i : ""} ${h.owner === myPid ? "mine" : ""} ${ui.activeHero === h.id ? "active" : ""} ${h.alive ? "" : "dead"} ${tgt}" data-drop="hero" data-tip="hero" data-hero="${h.id}" style="width:${g.width / 3 - 14}px">
        ${portrait(state, h)}
        <div class="tinfo">
          <div class="hname">${esc(h.name)} ${weaponsHtml(state, h)} ${state.phase === "players" && owner ? `<span class="readytag">${owner.ready ? "✅" : "⏳"}</span>` : ""}</div>
          ${hpBar(h)}
          <div class="stats"><span title="Блок (сгорает после хода врагов)">🛡 ${h.block}</span>${h.startBlock ? `<span title="Стартовый блок — как доп. ХП на бой">⛨ ${h.startBlock}</span>` : ""}${inc ? `<span class="incoming">⚔ ${inc}</span>` : ""}${weak ? `<span class="debuff">${weak}</span>` : ""}</div>
        </div>
      </div>`;
    });
    return html + `</div>`;
  }

  function shortText(state, c) {
    return c.text;
  }

  // Мини-схема фигуры: родные клетки красные, добавленные Взрывом — жёлтые
  function shapeMini(c) {
    const zone = c.zoneSteps && c.zoneSteps.length ? c.zoneSteps : null;
    if (c.area !== "shape" && !zone) return "";
    return BP.Icons.shapeSvg(c.area === "shape" ? c.shapeSteps : [[]], 0, zone);
  }


  function cardHtml(state, hero, c, ui, readonly, ml) {
    const avail = state.pool ? state.pool.amount : hero.energy;
    const kind = BP.Cards.kind(c), kc = BP.Icons.KIND_COLOR[kind];
    // Режим общей колоды: полоса сверху — чья карта (цвет героя) или «общая»
    let owner = "";
    if (state.shared) {
      const oi = c.shared ? -1 : heroIdx(state, c.owner || hero.id);
      owner = c.shared ? `<div class="cowner shared">общая</div>` : `<div class="cowner hc${oi}">${esc((state.heroes[oi] || hero).name)}</div>`;
    }
    const mergeOk = !readonly && state.config.tests.merge.enabled && BP.Cards.mergeCost(state, hero, c) <= avail;
    const cls = ["card", "k-" + kind, state.shared ? (c.shared ? "is-shared" : "is-own") : "", readonly ? "readonly" : "", !readonly && c.cost > avail ? "unaffordable" : "", mergeOk ? "can-merge" : "", ui.selected === c.uid ? "selected" : "", c.id && /^unity/.test(c.id) ? "test" : "", c.questCard ? "quest-card" : "",
      // эволюция (js/evolve.js): золотая рамка — эволюционная, фиолетовое свечение — можно эволюционировать сейчас
      BP.Evolve.evolvable(state, c) ? "evo" : "", hero.alive && BP.Evolve.ready(state, hero, c) ? "evo-ready" : "", c.evolvedFrom ? "evolved" : ""].join(" ");
    const needsBtn = !readonly && ui.selected === c.uid && (c.target === "none" || c.target === "self");
    const ci = BP.Cards.critInfo(hero, c);
    const crit = ci ? `<div class="crit ${ci.willCrit ? "on" : ""}">${ci.willCrit ? "💥 КРИТ" : `💥 через ${ci.left}`}</div>` : "";
    const gc = BP.Gifts.isOn(state) && c.gift && (state.config.gifts[c.gift] || {}).color; // фон карты — цвет её дара
    return `<div class="${cls}${gc ? " gifted" : ""}" data-card="${c.uid}" data-hero="${hero.id}" data-drop="merge" data-tip="card" style="--kc:${kc};${gc ? `--gc:${gc};` : ""}${ml ? `margin-left:${ml}px` : ""}">
      ${BP.Icons.costHtml(c)}${BP.Icons.statsHtml(c)}${owner}${c.questCard ? `<div class="qbadge" title="Квестовая: одноразовая, не сгорает в конце хода">?</div>` : ""}
      <div class="cart" title="${esc(BP.Icons.KIND_LABEL[kind])}">${icon(c.icon)}${shapeMini(c)}${crit}</div>
      <div class="cname">${esc(c.name)}</div>
      ${BP.CardTip.faceHtml(state, hero, c)}
      ${c.merged ? `<div class="cmerged">★${c.merged > 1 ? c.merged : ""}</div>` : ""}
      ${BP.Gifts.isOn(state) && c.gift ? `<div class="cgift">🎁${esc(BP.Gifts.labels(state, c).ownIcon)}</div>` : ""}
      ${needsBtn ? `<button class="play-btn primary" data-act="play-self">▶ Сыграть</button>` : ""}
    </div>`;
  }

  // Руки всех трёх героев внизу экрана — переключаться не нужно
  function renderHands(state, myPid, ui) {
    if (state.phase === "questPick") return BP.UIQuest.renderBar(state, myPid); // руки ещё не набраны — на их месте выбор квеста
    const z = sizes(), lanes = corridors(state);
    const secW = (window.innerWidth - z.logW) / 3 - 22;
    const html = state.heroes.map((h, i) => {
      const owner = state.players[h.owner];
      const readonly = h.owner !== myPid || state.phase !== "players" || !h.alive;
      // Рука рассчитана на drawPerTurn карт. Больше — карты накладываются (как в Hearthstone), ширина не растёт.
      const n = h.hand.length, gap = 8, hs = state.config.rules.drawPerTurn || 4;
      const handW = Math.min(secW, Math.max(hs, 1) * z.cardW + (hs - 1) * gap);
      const over = n > 1 ? Math.min(gap, (handW - n * z.cardW) / (n - 1)) : gap;
      const cards = h.alive ? (h.hand.map((c, k) => cardHtml(state, h, c, ui, readonly, k ? over : 0)).join("") || `<span class="muted small">Рука пуста</span>`) : `<span class="muted">пал в бою</span>`;
      const maxE = state.config.rules.energy;
      const en = state.pool ? `<span class="pool">⚡ пул ${state.pool.amount}</span>` : `<span class="pips">${Array.from({ length: Math.max(maxE, h.energy) }, (_, k) => `<i class="${k < h.energy ? "on" : ""}"></i>`).join("")}</span>`;
      return `<div class="hsec ${lanes ? "lane" + i : ""} ${h.owner === myPid ? "mine" : ""} ${ui.activeHero === h.id ? "active" : ""} ${h.alive ? "" : "dead"}" data-drop="hero" data-hero="${h.id}">
        <div class="hsec-head">
          ${portrait(state, h, true)}
          <div class="hs-name"><b>${esc(h.name)} ${weaponsHtml(state, h)}</b><span class="muted small">${owner ? esc(owner.name) : "без игрока"}${h.owner !== myPid ? " · смотреть" : ""}</span></div>
          ${hpBar(h)}${en}
          <span class="pile" title="${state.shared ? "Своя колода (оружие и щит) / свой сброс" : "Колода / сброс"}">🂠 ${h.draw.length} · ♻ ${h.discard.length}</span>
        </div>
        <div class="hand ${over < 0 ? "overlap" : ""}">${cards}</div>
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
    const pool = state.pool ? `<span class="chip pool">⚡ Общий пул: ${state.pool.amount}</span>` : "";
    const shared = state.shared ? `<span class="chip shared" title="Общая колода / общий сброс">🂠 Общая колода ${state.shared.draw.length} · ♻ ${state.shared.discard.length}</span>` : "";
    const req = BP.Engine.requiredPlayers(state);
    const ready = state.phase === "players" ? `<span class="ready-list row">${req.map((pid) => { const p = state.players[pid]; return p ? `<span class="chip ${p.ready ? "ok" : ""}">${p.ready ? "✅" : "⏳"} ${esc(p.name)}</span>` : ""; }).join("")}</span>` : (state.phase === "enemies" ? `<span class="chip enemy-line">👹 ${esc(lastEnemyLine(state))}</span>` : "");
    const roomInfo = BP.Session.code ? `<span class="chip" title="Код комнаты">🔑 ${esc(BP.Session.code)}</span>` : `<span class="chip">локально</span>`;
    return `<div class="topbar">
      <span class="title">Бой ${state.fightIndex + 1}/${state.config.encounters.length}: ${esc(enc.name || "")}</span>
      <span class="chip">Ход ${state.turn}</span>${pool}${shared}
      <span class="grow"></span>${ready}${roomInfo}
      <span class="chip" data-tip="targeting">Цели врагов: ${corridors(state) ? "коридоры" : "любой"}</span>
      ${BP.Session.isHost() ? `<button data-act="settings">⚙</button>` : ""}
      <button data-act="deck-view" title="Что лежит в колодах (порядок скрыт)">🂠 Колода</button>
      <button data-act="discard-view" title="Что лежит в сбросах">♻ Сброс</button>
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
