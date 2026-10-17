// Эффекты поверх игры: большие цифры урона, тряска, стрелки «кто кого бьёт», тултипы.
// Живут в отдельных слоях вне #app, поэтому не пропадают при перерисовке.
window.BP = window.BP || {};

BP.FX = (function () {
  const esc = (s) => BP.UIGame.esc(s);
  let layer = null, svg = null, tip = null;
  let lastFx = -1, shakes = {}, mx = -1, my = -1, tipKey = null;
  let arrowPts = [];      // точки стрелок намерений — тултип старается их не закрывать
  let flash = null;       // {ids, t0} — герои, которых бьёт враг под курсором (мерцают ~2 с)
  const st = () => BP.Session.state;

  function ensure() {
    if (layer) return;
    layer = document.createElement("div"); layer.className = "fx-layer"; document.body.appendChild(layer);
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("class", "intent-arrows"); document.body.appendChild(svg);
    tip = document.createElement("div"); tip.className = "tip"; document.body.appendChild(tip);
  }

  // ---------- Цифры урона и тряска ----------
  function enemyRect(s, ev) {
    const el = document.querySelector(`.hex[data-enemy="${ev.uid}"]`);
    if (el) return el.getBoundingClientRect();
    const field = document.querySelector(".field");
    if (!field) return null;
    const g = BP.UIGame.geometry(s), p = BP.UIGame.cellPos(g, ev.col, ev.row), f = field.getBoundingClientRect();
    return { left: f.left + p.left, top: f.top + p.top, width: g.hw, height: g.hh };
  }

  function spawnNumber(s, ev) {
    const r = ev.k === "enemy" ? enemyRect(s, ev) : (document.querySelector(`.hero.token[data-hero="${ev.hero}"]`) || { getBoundingClientRect: () => null }).getBoundingClientRect();
    if (!r) return;
    const d = document.createElement("div");
    const main = ev.amount > 0 ? `−${ev.amount}` : ev.blocked > 0 ? "блок" : "0";
    d.className = `dmg-num ${ev.k} ${ev.crit ? "crit" : ""} ${ev.amount > 0 ? "" : "blocked-only"}`;
    d.innerHTML = `${ev.crit ? '<span class="critword">КРИТ!</span>' : ""}<span class="n">${main}</span>${ev.blocked > 0 ? `<span class="b">🛡${ev.blocked}</span>` : ""}`;
    d.style.left = r.left + r.width / 2 + (Math.random() * 30 - 15) + "px";
    d.style.top = r.top + (ev.k === "enemy" ? r.height * 0.35 : -18) + "px";
    layer.appendChild(d);
    setTimeout(() => d.remove(), 1500);
  }

  function processFx(s) {
    if (lastFx < 0 || s.fxSeq < lastFx) lastFx = s.fxSeq || 0; // первый показ / новый забег — не проигрываем старое
    const now = Date.now();
    (s.fx || []).forEach((ev) => {
      if (ev.id <= lastFx) return;
      spawnNumber(s, ev);
      shakes[ev.k === "enemy" ? "e:" + ev.uid : "h:" + ev.hero] = now;
    });
    lastFx = Math.max(lastFx, s.fxSeq || 0);
  }

  function applyShakes() {
    const now = Date.now();
    Object.entries(shakes).forEach(([k, t0]) => {
      const dt = now - t0;
      if (dt > 450) { delete shakes[k]; return; }
      const sel = k[0] === "e" ? `.hex[data-enemy="${k.slice(2)}"]` : `.hero.token[data-hero="${k.slice(2)}"], .hsec[data-hero="${k.slice(2)}"] .hsec-head`;
      document.querySelectorAll(sel).forEach((el) => { el.classList.add("shake"); el.style.animationDelay = -dt + "ms"; });
    });
  }

  // ---------- Стрелки намерений ----------
  function center(el, edge) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: edge === "top" ? r.top + 4 : edge === "bottom" ? r.bottom - r.height * 0.18 : r.top + r.height / 2 };
  }

  function drawArrows(pairs) {
    if (!svg) return;
    const defs = `<defs><marker id="ia-r" markerWidth="8" markerHeight="8" refX="5" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#ff4a3a"/></marker>
      <marker id="ia-p" markerWidth="8" markerHeight="8" refX="5" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#c08af0"/></marker></defs>`;
    arrowPts = [];
    svg.innerHTML = defs + pairs.map((p) => {
      const a = center(p.from, "bottom"), b = center(p.to, "top");
      const cx = (a.x + b.x) / 2, cy = Math.min(a.y, b.y) + (b.y - a.y) * 0.35 - 30;
      for (let t = 0; t <= 1.001; t += 0.05) arrowPts.push({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * cx + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cy + t * t * b.y });
      const col = p.curse ? "#c08af0" : "#ff4a3a";
      return `<path d="M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}" fill="none" stroke="#000a" stroke-width="9"/>
        <path d="M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}" fill="none" stroke="${col}" stroke-width="5" stroke-dasharray="${p.strong ? "0" : "10 7"}" marker-end="url(#${p.curse ? "ia-p" : "ia-r"})"/>`;
    }).join("");
  }

  function arrowPairs(s, hoverEl) {
    const pairs = [];
    const add = (e, heroId, strong) => {
      const from = document.querySelector(`.hex[data-enemy="${e.uid}"]`), to = document.querySelector(`.hero.token[data-hero="${heroId}"]`);
      if (from && to && !pairs.some((p) => p.from === from && p.to === to)) pairs.push({ from, to, strong, curse: e.intent && e.intent.type === "curse" });
    };
    if (s.phase === "enemies" && s.actingEnemy) {
      const e = s.enemies.find((x) => x.uid === s.actingEnemy);
      if (e) (s.actingTargets || []).forEach((id) => add(e, id, true));
    }
    if (hoverEl && !BP.Drag.isDragging()) {
      const kind = hoverEl.dataset.tip;
      if (kind === "enemy") {
        const e = s.enemies.find((x) => x.uid === hoverEl.dataset.enemy);
        if (e && e.intent && e.intent.targets) e.intent.targets.forEach((id) => add(e, id, false));
      } else if (kind === "hero") {
        s.enemies.forEach((e) => { if (e.alive && e.intent && (e.intent.targets || []).includes(hoverEl.dataset.hero)) add(e, hoverEl.dataset.hero, false); });
      }
    }
    return pairs;
  }

  // ---------- Тултипы ----------
  function intentLong(s, e) {
    const it = e.intent || {};
    const names = (it.targets || []).map((id) => BP.UIGame.heroName(s, id)).join(", ");
    switch (it.type) {
      case "stunned": return "Оглушён — пропустит действие.";
      case "covered": return `Хочет ударить (⚔ ${it.damage}${it.hits > 1 ? "×" + it.hits : ""}), но закрыт своими — мили не дотягивается до героев. Ждёт, пока впереди освободится место.`;
      case "attack": return `Атакует <b>${esc(names)}</b>: ${it.damage} урона${it.hits > 1 ? " × " + it.hits : ""}${it.taunted ? " (вызов)" : ""}.`;
      case "curse": return `Проклинает <b>${esc(names)}</b>: −${it.amount} к урону на ${it.turns} х.`;
      case "block": return `Защищается: +${it.amount} блока.`;
    }
    return "—";
  }

  function actionShort(a) {
    switch (a.type) {
      case "attack": return `⚔ ${a.damage}${a.hits > 1 ? "×" + a.hits : ""}${a.targets > 1 ? ` по ${a.targets} героям` : ""}`;
      case "curse": return `☠ проклятие −${a.amount} (${a.turns} х.)${a.targets > 1 ? ` на ${a.targets}` : ""}`;
      case "block": return `🛡 +${a.amount} блока`;
    }
    return a.type;
  }

  function tipHtml(s, el) {
    const kind = el.dataset.tip;
    if (kind === "card") {
      const h = s.heroes.find((x) => x.id === el.dataset.hero), c = h && h.hand.find((x) => x.uid === el.dataset.card);
      if (!c) return null;
      const ci = BP.Cards.critInfo(h, c);
      const rot = (BP.UI.ui.aoeRot || 0);
      return `<div class="tip-title">${esc(c.name)} <span class="tip-cost">${c.cost}⚡</span></div>
        <div class="tip-tags">${esc(BP.Cards.tags(c).join(" · "))}</div>
        <div>${esc(c.text)}</div>
        ${c.attack === "melee" ? `<div class="tip-note">Мили: бьёт только открытых врагов — тех, кого никто не прикрывает спереди.</div>` : ""}
        ${c.area === "shape" ? `<div class="tip-note row">${BP.Icons.shapeSvg(c.shapeSteps, c.fixed ? 0 : rot)}<span>Фигура «${esc(c.shapeName)}». ${c.fixed ? "Не крутится: клетка прицела — передняя клетка фигуры." : "<b>Правая кнопка мыши</b> — повернуть по часовой."} Задетые клетки подсвечиваются красным, клетки за краем поля — ✕.</span></div>` : ""}
        ${c.questCard ? `<div class="tip-note good">Квестовая карта: одноразовая (после розыгрыша пропадает), в конце хода не сгорает.</div>` : ""}
        ${c.area === "adjacent" ? `<div class="tip-note">Бьёт клетку и все соседние (до 7 клеток).</div>` : ""}
        ${ci ? `<div class="tip-note ${ci.willCrit ? "good" : ""}">Крит ×${s.config.rules.critMultiplier} каждый ${ci.every}-й удар оружием «${esc(c.weaponName)}». ${ci.willCrit ? "<b>Эта карта критует!</b>" : `До крита: ${ci.left} уд.`}</div>` : ""}
        ${c.merged ? `<div class="tip-note">★ Усилена мерджем ×${c.merged}</div>` : ""}`;
    }
    if (kind === "enemy") {
      const e = s.enemies.find((x) => x.uid === el.dataset.enemy);
      if (!e) return null;
      const ed = s.config.enemies[e.type] || {};
      const exposed = BP.Cards.isExposed(s, e);
      const cur = e.actionIndex % e.actions.length;
      const list = e.actions.map((a, i) => `<li class="${i === cur ? "cur" : ""}">${actionShort(a)}${i === cur ? " ← сейчас" : i === (cur + 1) % e.actions.length ? " ← потом" : ""}</li>`).join("");
      return `<div class="tip-title">${esc(e.name)} <span class="muted">${ed.melee ? "мили" : "дальний бой"}</span></div>
        <div>❤ ${e.hp}/${e.maxHp}${e.block ? ` · 🛡 ${e.block}` : ""}${e.stunned ? " · оглушён" : ""}${e.pushedThisTurn ? " · толкнут (по нему крит)" : ""}</div>
        <div class="tip-note ${exposed ? "" : "bad"}">${exposed ? "Открыт: мили-герои могут его бить." : "Прикрыт спереди: мили-герои его не достанут. Нужны дальние атаки, массовки или толчок."}</div>
        <div class="tip-sec">Сейчас</div><div>${intentLong(s, e)}</div>
        <div class="tip-sec">Действия по кругу</div><ol class="tip-actions">${list}</ol>`;
    }
    if (kind === "hero") {
      const h = s.heroes.find((x) => x.id === el.dataset.hero);
      if (!h) return null;
      const inc = s.enemies.filter((e) => e.alive && e.intent && e.intent.type === "attack" && (e.intent.targets || []).includes(h.id));
      const crit = Object.entries(h.crit || {}).map(([w, c]) => `${esc((s.config.weapons[w] || {}).name || w)}: крит через ${c.every - c.count}`).join(", ");
      return `<div class="tip-title">${esc(h.name)}</div>
        <div>❤ ${h.hp}/${h.maxHp} · 🛡 блок ${h.block} · ⛨ стартовый блок ${h.startBlock}</div>
        ${crit ? `<div class="muted">${crit}</div>` : ""}
        ${(h.debuffs || []).map((d) => `<div class="tip-note bad">☠ Проклятие: −${d.amount} к урону, ещё ${d.turns} х.</div>`).join("")}
        <div class="tip-sec">Его будут бить</div>${inc.length ? inc.map((e) => `<div>⚔ ${esc(e.name)}: ${e.intent.damage}${e.intent.hits > 1 ? "×" + e.intent.hits : ""}</div>`).join("") : '<div class="muted">никто</div>'}`;
    }
    if (kind === "fquest" && s.quest) {
      const q = s.quest, rc = s.config.cards[q.reward] || {};
      const rtext = BP.Cards.text(Object.assign({ effects: [] }, rc));
      return `<div class="tip-title">${q.done ? "✔ Квест выполнен" : "? Квест боя"}</div><div>${esc(q.text)}</div>
        <div class="tip-sec">Прогресс (за весь бой)</div><div>${esc(BP.Quests.progressText(s))}</div>
        <div class="tip-sec">Награда — карта</div><div class="good"><b>${esc(rc.name || q.reward)}</b> <span class="tip-cost">${rc.cost || 0}⚡</span> — ${esc(rtext)}</div>
        <div class="tip-note">Карту сразу получает в руку герой, который закрыл условие. Одноразовая, в конце хода не сгорает.</div>`;
    }
    if (kind === "targeting") {
      return s.config.tests.enemyTargeting === "A"
        ? `<div class="tip-title">Коридоры</div><div>Каждый герой стоит под своими двумя колонками (они подкрашены его цветом). Враг бьёт героя своего коридора; если тот пал — ближайшего.</div>`
        : `<div class="tip-title">Любой герой</div><div>Каждый враг выбирает цель случайно среди живых героев.</div>`;
    }
    return null;
  }

  // Тултип карты в руке — всегда над блоком руки героя (не закрывает ни саму карту, ни соседние).
  // Остальные тултипы — рядом с курсором, там, где они меньше всего закрывают стрелки намерений.
  function placeTip(el) {
    if (!tip || tip.style.display === "none") return;
    const w = tip.offsetWidth, h = tip.offsetHeight, W = window.innerWidth, H = window.innerHeight;
    const clamp = (x, y) => ({ x: Math.max(8, Math.min(x, W - w - 8)), y: Math.max(8, Math.min(y, H - h - 8)) });
    const sec = el && el.dataset.tip === "card" ? el.closest(".hsec") : null;
    if (sec) {
      const r = el.getBoundingClientRect(), sr = sec.getBoundingClientRect();
      const p = clamp(r.left + r.width / 2 - w / 2, Math.min(sr.top, r.top) - h - 10); // карта при наведении приподнимается
      tip.style.left = p.x + "px"; tip.style.top = p.y + "px";
      return;
    }
    const cands = [[mx + 18, my + 18], [mx - w - 18, my + 18], [mx + 18, my - h - 14], [mx - w - 18, my - h - 14], [mx + 24, my - h / 2], [mx - w - 24, my - h / 2]].map(([x, y]) => clamp(x, y));
    let best = cands[0], bestScore = Infinity;
    cands.forEach((c, i) => {
      const covers = arrowPts.filter((p) => p.x > c.x - 6 && p.x < c.x + w + 6 && p.y > c.y - 6 && p.y < c.y + h + 6).length;
      const underCursor = mx >= c.x && mx <= c.x + w && my >= c.y && my <= c.y + h ? 1 : 0;
      const score = covers * 10 + underCursor * 50 + i * 0.1;
      if (score < bestScore) { bestScore = score; best = c; }
    });
    tip.style.left = best.x + "px"; tip.style.top = best.y + "px";
  }

  // Герои под ударом врага под курсором мерцают и вздрагивают ~2 с (кроме стрелок)
  function applyFlash() {
    document.querySelectorAll(".flash-target").forEach((el) => el.classList.remove("flash-target"));
    if (!flash) return;
    const dt = Date.now() - flash.t0;
    if (dt > 2000) { flash = null; return; }
    flash.ids.forEach((id) => document.querySelectorAll(`.hero.token[data-hero="${id}"], .hsec[data-hero="${id}"] .hsec-head`).forEach((el) => {
      el.classList.add("flash-target"); el.style.animationDelay = -dt + "ms";
    }));
  }

  function hoverElement() {
    if (mx < 0) return null;
    const node = document.elementFromPoint(mx, my);
    return node && node.closest ? node.closest("[data-tip]") : null;
  }

  function updateHover(force) {
    const s = st();
    ensure();
    if (!s || s.phase === "lobby") { tip.style.display = "none"; svg.innerHTML = ""; return; }
    const el = BP.Drag.isDragging() || document.querySelector(".modal-back") ? null : hoverElement();
    const key = el ? el.dataset.tip + ":" + (el.dataset.enemy || el.dataset.card || el.dataset.hero || el.dataset.idx || "") : null;
    if (key !== tipKey) {
      const e = el && el.dataset.tip === "enemy" ? s.enemies.find((x) => x.uid === el.dataset.enemy) : null;
      const ids = e && e.alive && e.intent && e.intent.targets ? e.intent.targets.slice() : [];
      flash = ids.length ? { ids, t0: Date.now() } : null;
      applyFlash();
    }
    if (force || key !== tipKey) {
      tipKey = key;
      const html = el ? tipHtml(s, el) : null;
      if (html) { tip.innerHTML = html; tip.style.display = "block"; } else tip.style.display = "none";
    }
    drawArrows(arrowPairs(s, el));
    placeTip(el);
  }

  function afterRender(s) {
    ensure();
    if (!s || s.phase === "lobby") { lastFx = -1; updateHover(true); return; }
    processFx(s);
    applyShakes();
    applyFlash();
    updateHover(true);
  }

  function init() {
    ensure();
    document.addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; updateHover(false); });
    window.addEventListener("blur", () => { if (tip) tip.style.display = "none"; });
  }

  return { init, afterRender, refreshTip: () => updateHover(true) };
})();
