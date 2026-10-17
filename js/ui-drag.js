// Перетаскивание карт: на врага, клетку, героя, карту союзника (мердж). Клик — выбрать, потом клик по цели.
window.BP = window.BP || {};

BP.Drag = (function () {
  let drag = null; // {uid, heroId, sx, sy, started, ghost, svg}
  let hoverEl = null;

  const ui = () => BP.UI.ui;
  const st = () => BP.Session.state;

  function currentCard() {
    const s = st(), u = ui();
    const uid = drag ? drag.uid : u.selected;
    const heroId = drag ? drag.heroId : u.activeHero;
    const hero = s && s.heroes.find((h) => h.id === heroId);
    const card = hero && hero.hand.find((c) => c.uid === uid);
    return card ? { hero, card } : null;
  }

  function targetFrom(el, card) {
    const kind = el.dataset.drop;
    if (kind === "enemy" && card.target === "enemy") return { enemy: el.dataset.enemy };
    if ((kind === "enemy" || kind === "cell") && card.target === "cell") return { cell: { col: +el.dataset.col, row: +el.dataset.row }, rot: ui().aoeRot || 0 };
    if (kind === "hero") return { hero: el.dataset.hero };
    return {};
  }

  const avail = (s, hero) => (s.pool ? s.pool.amount : hero.energy);

  function isValid(el, hero, card) {
    const s = st(), kind = el.dataset.drop;
    if (kind === "merge") {
      if (!s.config.tests.merge.enabled || el.dataset.hero === hero.id) return false;
      const ally = s.heroes.find((h) => h.id === el.dataset.hero);
      const dst = ally && ally.hand.find((c) => c.uid === el.dataset.card);
      return !!dst && BP.Cards.canMerge(s, card, dst) && BP.Cards.mergeCost(s, hero, card) <= avail(s, hero);
    }
    if (card.cost > avail(s, hero)) return false;
    switch (card.target) {
      case "enemy": {
        if (kind !== "enemy") return false;
        const e = BP.Cards.checkTarget(s, hero, card, { enemy: el.dataset.enemy });
        return !e || e === "NEED_DIR";
      }
      case "cell": return kind === "enemy" || kind === "cell";
      case "hero": case "ally": {
        if (kind !== "hero") return false;
        return !BP.Cards.checkTarget(s, hero, card, { hero: el.dataset.hero });
      }
      case "self": return kind === "field" || kind === "enemy" || kind === "cell" || (kind === "hero" && el.dataset.hero === hero.id);
      case "none": return kind !== "merge";
    }
    return false;
  }

  // Ближайшая цель под курсором; невалидная мини-карта союзника «пропускает» к панели героя
  function dropTargetAt(node) {
    let el = node && node.closest && node.closest("[data-drop]");
    const cc = currentCard();
    if (el && el.dataset.drop === "merge" && cc && !isValid(el, cc.hero, cc.card)) el = el.parentElement.closest("[data-drop]");
    return el || null;
  }

  // Панель подсказок в нижнем левом углу поля: всегда видна в ход игроков, текст — по ситуации
  function hint(cc) {
    const box = document.getElementById("board-hint");
    if (!box) return;
    const s = st(), c = cc && cc.card, parts = [];
    if (ui().dirPick) {
      parts.push("Выбери стрелкой, куда толкнуть врага");
      parts.push("Край поля или другой враг — столкновение");
      parts.push("Esc — отмена");
    } else if (c) {
      if (c.attack === "melee") parts.push("Мили: только открытые враги (никто не стоит перед ними)");
      if (BP.Cards.rotatable(c)) parts.push("🖱 Правая кнопка — повернуть фигуру");
      else if (c.area === "shape") parts.push(`Фигура «${c.shapeName}» не крутится`);
      if (c.area === "shape" || c.area === "adjacent") parts.push("Клетки с ✕ за краем поля никого не бьют");
      if (c.target === "hero" || c.target === "ally") parts.push("Цель — герой (фишка на поле или его рука внизу)");
      if (c.target === "none" || c.target === "self") parts.push("Отпусти на поле — карта сыграется");
      if (s.config.tests.merge.enabled) parts.push("На карту союзника — мердж (цена в фиолетовом ромбе)");
      parts.push(drag ? "Отпусти мимо цели — отмена" : "Esc — отмена");
    } else if (s && s.phase === "players") {
      parts.push("Перетащи карту на цель или кликни карту, потом цель");
      parts.push("Наведи на врага — его план и цели");
      if (s.quest) parts.push("«?» над полем — квест боя");
    }
    box.innerHTML = parts.length ? `<b>Подсказки</b>${parts.map((p) => `<div>${BP.UIGame.esc(p)}</div>`).join("")}` : "";
    box.style.display = parts.length ? "block" : "none";
  }

  // Пока своя карта поднята — стоимость карт союзников приглушена (энергия союзников не отвлекает)
  function dimAllyCosts(cc) {
    document.querySelectorAll(".hsec").forEach((sec) => sec.classList.toggle("dim-costs", !!cc && sec.dataset.hero !== cc.hero.id));
  }

  function refresh() {
    document.querySelectorAll("[data-drop]").forEach((el) => el.classList.remove("valid", "hover"));
    document.querySelectorAll(".hex").forEach((h) => h.classList.remove("aoe"));
    document.querySelectorAll(".hex .preview").forEach((p) => { p.textContent = ""; p.classList.remove("crit"); });
    document.querySelectorAll(".card .mcost").forEach((b) => b.remove());
    document.querySelectorAll(".hex-ghost").forEach((g) => g.remove());
    const cc = currentCard();
    hint(cc);
    dimAllyCosts(cc);
    if (!cc) return;
    mergeBadges(cc);
    document.querySelectorAll("[data-drop]").forEach((el) => {
      if (el.dataset.drop !== "field" && isValid(el, cc.hero, cc.card)) el.classList.add("valid");
    });
    if (hoverEl && document.body.contains(hoverEl)) {
      hoverEl.classList.add("hover");
      if (isValid(hoverEl, cc.hero, cc.card)) showPreview(cc, hoverEl);
    }
  }

  // Фиолетовый ромб со стоимостью мерджа на картах союзников, в которые можно смерджить взятую карту
  function mergeBadges(cc) {
    const s = st(), m = s.config.tests.merge;
    if (!m.enabled || !m.payCost) return;
    const cost = BP.Cards.mergeCost(s, cc.hero, cc.card), ok = cost <= avail(s, cc.hero);
    document.querySelectorAll('.card[data-drop="merge"]').forEach((el) => {
      if (el.dataset.hero === cc.hero.id) return;
      const ally = s.heroes.find((h) => h.id === el.dataset.hero);
      const dst = ally && ally.alive && ally.hand.find((c) => c.uid === el.dataset.card);
      if (!dst || !BP.Cards.canMerge(s, cc.card, dst)) return;
      const b = document.createElement("div");
      b.className = "mcost" + (ok ? "" : " no");
      b.title = ok ? `Мердж стоит ${cost} энергии` : `Мердж стоит ${cost} энергии — не хватает`;
      b.innerHTML = `<span>${cost}</span>`;
      el.appendChild(b);
    });
  }

  function showPreview(cc, el) {
    if (!(el.dataset.drop === "enemy" || el.dataset.drop === "cell")) return;
    const target = targetFrom(el, cc.card);
    // массовки и «насквозь»: красным все задетые клетки
    if (cc.card.area && cc.card.area !== "single") {
      BP.Cards.areaCells(st(), cc.hero, cc.card, target).forEach((c) => {
        const h = document.querySelector(`.hex[data-col="${c.col}"][data-row="${c.row}"]`);
        if (h) h.classList.add("aoe");
      });
      ghostCells(cc, target);
    }
    const pv = BP.Cards.preview(st(), cc.hero, cc.card, target);
    if (!pv) return;
    Object.entries(pv).forEach(([uid, v]) => {
      const p = document.querySelector(`.hex[data-enemy="${uid}"] .preview`);
      if (p) { p.textContent = `−${v.amount}${v.crit ? "!" : ""}`; p.classList.toggle("crit", v.crit); }
    });
  }

  // Клетки фигуры за краем поля — призрачные хексы с красным ✕, чтобы было видно всю фигуру
  function ghostCells(cc, target) {
    const s = st(), field = document.querySelector(".field");
    if (!field) return;
    const g = BP.UIGame.geometry(s);
    BP.Cards.areaOffCells(s, cc.card, target).forEach((c) => {
      const p = BP.UIGame.cellPos(g, c.col, c.row);
      const d = document.createElement("div");
      d.className = "hex-ghost" + (c.row >= g.rows ? " beyond-back" : "");
      d.style.left = p.left + "px"; d.style.top = p.top + "px";
      d.innerHTML = `<span>✕</span>`;
      field.appendChild(d);
    });
  }

  // Применить карту к элементу-цели
  function drop(el, hero, card) {
    if (!el || !isValid(el, hero, card)) { if (el && el.dataset.drop !== "field") BP.UI.toast("Сюда эту карту нельзя", "bad"); return; }
    const kind = el.dataset.drop;
    ui().selected = null;
    if (kind === "merge") {
      BP.Session.dispatch({ a: "merge", hero: hero.id, card: card.uid, ally: el.dataset.hero, allyCard: el.dataset.card });
      return;
    }
    const target = targetFrom(el, card);
    if (BP.Cards.has(card, "push") && card.target === "enemy") {
      ui().dirPick = { hero: hero.id, card: card.uid, enemy: target.enemy };
      BP.UI.render();
      return;
    }
    BP.Session.dispatch({ a: "play", hero: hero.id, card: card.uid, target });
  }

  function arrow(x, y) {
    if (!drag.svg) {
      drag.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      drag.svg.setAttribute("class", "arrow");
      drag.svg.innerHTML = `<defs><marker id="ah" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#d4a94f"/></marker></defs><line stroke="#d4a94f" stroke-width="5" stroke-dasharray="12 8" marker-end="url(#ah)"/>`;
      document.body.appendChild(drag.svg);
    }
    const heroEl = document.querySelector(`.hero.token[data-hero="${drag.heroId}"]`);
    if (!heroEl) return;
    const r = heroEl.getBoundingClientRect();
    const line = drag.svg.querySelector("line");
    line.setAttribute("x1", r.left + r.width / 2); line.setAttribute("y1", r.top + 10);
    line.setAttribute("x2", x); line.setAttribute("y2", y);
  }

  function cleanup() {
    if (drag) { if (drag.ghost) drag.ghost.remove(); if (drag.svg) drag.svg.remove(); }
    drag = null; hoverEl = null;
    refresh();
  }

  function onDown(ev) {
    const cardEl = ev.target.closest(".card");
    if (!cardEl || ev.target.closest("button") || cardEl.classList.contains("readonly")) return;
    // серую карту (не хватает на розыгрыш) можно взять, если хватает на мердж
    if (cardEl.classList.contains("unaffordable") && !cardEl.classList.contains("can-merge")) return;
    drag = { uid: cardEl.dataset.card, heroId: cardEl.dataset.hero, sx: ev.clientX, sy: ev.clientY, started: false, el: cardEl };
  }

  function onMove(ev) {
    if (!drag) return;
    if (!drag.started) {
      if (Math.hypot(ev.clientX - drag.sx, ev.clientY - drag.sy) < 8) return;
      drag.started = true;
      ui().selected = null; ui().dirPick = null;
      drag.ghost = drag.el.cloneNode(true);
      drag.ghost.classList.add("ghost");
      document.body.appendChild(drag.ghost);
      refresh();
    }
    drag.ghost.style.left = ev.clientX + "px"; drag.ghost.style.top = ev.clientY + "px";
    drag.ghost.style.display = "none";
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    drag.ghost.style.display = "";
    const el = dropTargetAt(under);
    if (el !== hoverEl) { hoverEl = el; refresh(); }
    arrow(ev.clientX, ev.clientY);
  }

  function onUp(ev) {
    if (!drag) return;
    const d = drag;
    if (!d.started) {
      drag = null;
      // выбрана карта, клик по карте другого героя — мердж
      if (ui().selected && d.heroId !== ui().activeHero) {
        const cc = currentCard();
        if (cc && isValid(d.el, cc.hero, cc.card)) { drop(d.el, cc.hero, cc.card); BP.UI.render(); return; }
      }
      ui().selected = ui().selected === d.uid ? null : d.uid;
      ui().activeHero = d.heroId;
      BP.UI.render();
      return;
    }
    const target = hoverEl;
    const cc = currentCard();
    cleanup();
    if (cc && target) drop(target, cc.hero, cc.card);
  }

  // Режим выбора: карта выбрана кликом, теперь клик по цели
  function onClick(ev) {
    if (drag) return;
    const u = ui();
    if (!u.selected) return;
    if (ev.target.closest("button")) return;
    const cc = currentCard();
    const cardEl = ev.target.closest(".card");
    if (cardEl) {
      // клик по чужой (только для просмотра) карте при выбранной своей — мердж
      if (cc && cardEl.dataset.hero !== cc.hero.id && (cardEl.classList.contains("readonly") || cardEl.classList.contains("unaffordable")) && isValid(cardEl, cc.hero, cc.card)) { ev.stopPropagation(); drop(cardEl, cc.hero, cc.card); BP.UI.render(); }
      return;
    }
    const el = dropTargetAt(ev.target);
    if (!cc) { u.selected = null; return; }
    if (!el) return;
    ev.stopPropagation();
    drop(el, cc.hero, cc.card);
    if (!u.dirPick) BP.UI.render();
  }

  function onHover(ev) {
    if (drag || !ui().selected) return;
    const el = dropTargetAt(ev.target);
    if (el !== hoverEl) { hoverEl = el; refresh(); }
  }

  function init() {
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointermove", (e) => { onMove(e); onHover(e); });
    document.addEventListener("pointerup", onUp);
    document.addEventListener("click", onClick, true);
    // Правая кнопка — повернуть фигуру массовки (по часовой стрелке)
    document.addEventListener("contextmenu", (e) => {
      const s = st();
      if (!s || s.phase === "lobby" || e.target.closest("input, textarea")) return;
      e.preventDefault();
      const cc = currentCard();
      if (cc && BP.Cards.rotatable(cc.card)) { ui().aoeRot = ((ui().aoeRot || 0) + 5) % 6; refresh(); if (BP.FX) BP.FX.refreshTip(); }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { cleanup(); ui().selected = null; ui().dirPick = null; BP.UI.render(); }
    });
  }

  return { init, refresh, isDragging: () => !!(drag && drag.started) };
})();
