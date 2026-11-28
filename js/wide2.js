// wide-range, этап 2 (24.11): ловушки, Кровь, Кости, Накопитель, общие карты (Залп, Жертва), выбор карты из руки.
//  Ловушки (state.traps = [{col, row, kind, amount, by}]): ставятся на любую клетку; срабатывают, когда лучник бьёт по клетке
//    картой с уроном (картой лука, массовкой тоже), когда врага туда толкнули или он там появился; Детонация — все сразу.
//    snare (Капкан) — враг на клетке оглушён | wire (Растяжка) — amount урона по клетке и 6 соседним | smoke — враги там промахиваются в этот ход.
//  Кровь (h.blood) — ХП, потерянное в этом бою: потолок лечения. Пакт крови (h.pact): потерял ХП — +Сила на ход.
//  Кости (h.bones): Костяное копьё, Метка смерти (e.deathMark), Некромантия (h.necro — кости и за убийства союзников).
//  Накопитель: Колчан (h.quiver) — в конце хода каждая несыгранная смердженная карта в руке → +Сила на бой; Терпение (h.retainAll).
//  Общие: Приказ полководца (state.costDown — все карты пати дешевле до конца хода), Подготовка (возьми N, сбрось 1),
//    Отдать всё (энергия союзнику), Подношение (сожги карту — союзник берёт N). Выбор карты из руки — state.choice kind discard/burn.
window.BP = window.BP || {};

BP.Wide2 = (function () {
  const TRAP = { snare: { icon: "🪤", name: "Капкан", text: "враг на клетке оглушён" },
    wire: { icon: "🧨", name: "Растяжка", text: "урон по клетке и 6 соседним" },
    smoke: { icon: "🌫", name: "Дымовая ловушка", text: "враги на клетке и 6 соседних промахиваются в этот ход" } };
  const ZONE = [[], [0], [1], [2], [3], [4], [5]]; // правки 26.11: клетка + все 6 соседей (до 7 клеток на поле 6×3)
  const E = () => BP.Engine;
  const hero = (state, id) => state.heroes.find((h) => h.id === id);

  // ---------- ловушки ----------
  function trapAt(state, col, row) { return (state.traps || []).find((t) => t.col === col && t.row === row) || null; }
  function trigger(state, tr, heroId) {
    state.traps = (state.traps || []).filter((t) => t !== tr);
    const r = state.config.rules, e = BP.Cards.enemyAt(state, tr.col, tr.row), by = heroId || tr.by;
    const zone = BP.Hex.shapeCells(tr.col, tr.row, ZONE, 0, r.cols, r.rows).map((c) => BP.Cards.enemyAt(state, c.col, c.row)).filter(Boolean);
    let note = `${TRAP[tr.kind].icon} ${TRAP[tr.kind].name} сработала`;
    if (tr.kind === "snare" && e) { e.stunned = true; e.intent = { type: "stunned" }; note += `: ${e.name} оглушён`; }
    if (tr.kind === "wire") { zone.forEach((x) => E().hurtEnemy(state, x, tr.amount || 12, by)); note += zone.length ? `: ${zone.map((x) => x.name).join(", ")} −${tr.amount || 12}` : " впустую"; }
    if (tr.kind === "smoke") { zone.forEach((x) => (x.missAll = true)); note += zone.length ? `: ${zone.map((x) => x.name).join(", ")} промахиваются` : " впустую"; }
    E().log(state, (hero(state, by) || {}).name || "Ловушка", note);
    return note;
  }
  // Враг встал на клетку (толчок, подкрепление)
  function onMove(state, e) { const tr = e.alive && trapAt(state, e.col, e.row); if (tr) trigger(state, tr); }
  // Лучник ударил картой с уроном: ловушки на задетых клетках срабатывают
  function afterHits(state, h, card, t, hits) {
    if (!(state.traps || []).length || card.weapon !== "bow" || !hits.length) return;
    let cells = [];
    if (card.target === "cell") cells = BP.Cards.areaCells(state, h, card, t);
    hits.forEach((x) => { const e = state.enemies.find((y) => y.uid === x.enemy); if (e) cells.push({ col: e.col, row: e.row }); });
    cells.forEach((c) => { const tr = trapAt(state, c.col, c.row); if (tr) trigger(state, tr, h.id); });
  }

  // ---------- кровь ----------
  function lostHp(state, h, n) {
    if (n <= 0) return;
    h.blood = (h.blood || 0) + n;
    if (h.pact) BP.Wide.addStr(h, h.pact, "turn");
  }
  function heal(h, n) {
    const a = Math.max(0, Math.min(n, h.blood || 0, h.maxHp - h.hp));
    h.hp += a; h.blood -= a;
    return a;
  }

  // ---------- кости ----------
  function onKill(state, e, heroId) {
    if (e.deathMark) { const m = hero(state, e.deathMark.by); if (m) { m.bones = (m.bones || 0) + e.deathMark.n; E().log(state, m.name, `Метка смерти: +${e.deathMark.n} Кости`); } }
    state.heroes.forEach((h) => { if (h.necro && h.alive && h.id !== heroId) h.bones = (h.bones || 0) + h.necro; });
  }

  // ---------- выбор карты из руки ----------
  function startHandChoice(state, h, kind, ally, n) {
    const opts = h.hand.map((c) => ({ uid: c.uid, owner: h.id }));
    if (!opts.length) return kind === "burn" ? "в руке нечего сжечь" : "";
    state.choice = { hero: h.id, kind, options: opts, target: ally ? ally.id : null, n: n || 0 };
    return kind === "burn" ? `сжигает карту для ${ally.name}` : "сбрасывает 1 карту";
  }
  function chooseHand(state, uid) {
    const ch = state.choice, h = hero(state, ch.hero), c = h && h.hand.find((x) => x.uid === uid);
    if (!c) return "Этой карты нет в руке";
    state.choice = null;
    h.hand = h.hand.filter((x) => x !== c);
    const rc = BP.Wide.release(state, c, false);
    if (ch.kind === "burn") {
      h.exhausted = (h.exhausted || []).concat(rc);
      const a = hero(state, ch.target);
      if (a && a.alive) BP.Deck.draw(state, a, ch.n || 2);
      E().log(state, h.name, `сжёг «${c.name}» → ${a ? a.name : "—"} берёт ${ch.n || 2}`);
    } else { BP.Deck.discard(state, h, rc); E().log(state, h.name, `сбросил «${c.name}»`); }
    return null;
  }
  // Для ботов и авто-выбора: самая дешёвая и слабая карта
  function autoHand(state) {
    const ch = state.choice, h = hero(state, ch.hero);
    if (!h || !h.hand.length) return null;
    const v = (c) => c.cost * 10 + ((c.effects || []).find((e) => e.type === "damage") || { amount: 0 }).amount + (c.donor ? 50 : 0);
    return h.hand.slice().sort((a, b) => v(a) - v(b))[0].uid;
  }

  // ---------- «Приказ полководца» ----------
  function costDown(state, c) { if (state.costDown && c.cost > 0 && !c.tmpDown) { const d = Math.min(c.cost, state.costDown); c.cost -= d; c.tmpDown = d; } }
  function partyTurnEnd(state) {
    state.costDown = 0; // 28.11: tmpDown ставит и «Ловкость рук» — возвращаем стоимость всегда
    state.heroes.forEach((h) => [h.hand, h.draw, h.discard, h.exhausted || []].forEach((pile) => pile.forEach((c) => { if (c.tmpDown) { c.cost += c.tmpDown; delete c.tmpDown; } delete c.freeNow; })));
  }

  // ---------- эффекты карт ----------
  function applyEffect(state, h, card, ef, tHero, primary, t, hits) {
    const dealt = (hits || []).reduce((s, x) => s + x.amount, 0);
    switch (ef.type) {
      case "trap": {
        if (!t || !t.cell) return "";
        state.traps = (state.traps || []).filter((x) => !(x.col === t.cell.col && x.row === t.cell.row));
        state.traps.push({ col: t.cell.col, row: t.cell.row, kind: ef.trap, amount: ef.amount, by: h.id });
        const e = BP.Cards.enemyAt(state, t.cell.col, t.cell.row);
        return `${TRAP[ef.trap].icon} ${TRAP[ef.trap].name} на клетке${e ? ` под ${e.name}` : ""}`;
      }
      case "detonate": { const all = (state.traps || []).slice(); return all.length ? all.map((tr) => trigger(state, tr, h.id)).join("; ") : "ловушек нет"; }
      case "loseHp": { const n = Math.min(ef.amount, h.hp - 1); h.hp -= n; lostHp(state, h, n); return `${h.name} −${n} ХП`; }
      case "lifesteal": { const a = heal(h, dealt + (card.healPlus || 0)); return `${h.name} +${a} ХП (Кровь ${h.blood || 0})`; }
      case "bloodPact": h.pact = (h.pact || 0) + ef.amount; return `${h.name}: потеря ХП → +${h.pact} Силы на ход`;
      case "boneOnKill": { const k = (state.playKills || []).length; if (!k) return ""; const n = k * (ef.amount + (card.boneKill || 0)); h.bones = (h.bones || 0) + n; return `+${n} Кости (${h.bones})`; }
      case "deathMark": if (primary && primary.alive) { primary.deathMark = { by: h.id, n: ef.amount }; return `${primary.name}: Метка смерти`; } return "";
      case "boneBlock": { const a = BP.Mech.blockOf(h, ef.base + ef.per * (h.bones || 0)); h.block += a; return `${h.name} +${a} брони (Кости ${h.bones || 0})`; }
      case "spendBones": { const n = h.bones || 0; h.bones = 0; return n ? `потрачено Костей: ${n}` : ""; }
      case "necro": h.necro = (h.necro || 0) + ef.amount; return `${h.name}: убийства союзников дают Кости`;
      case "quiver": h.quiver = (h.quiver || 0) + ef.amount; return `${h.name}: несыгранные смердженные карты в конце хода дают Силу`;
      case "retainHand": h.retainAll = true; return `${h.name}: рука не сбрасывается в этот ход`;
      case "costDownTurn": state.costDown = (state.costDown || 0) + ef.amount; state.heroes.forEach((x) => x.hand.forEach((c) => costDown(state, c))); return `до конца хода все карты пати −${ef.amount} к стоимости`;
      case "drawDiscard": BP.Deck.draw(state, h, ef.draw); return startHandChoice(state, h, "discard");
      case "giveEnergy": {
        const a = tHero && tHero.id !== h.id ? tHero : null;
        if (!a) return "";
        BP.Deck.discardAll(state, h, h.hand.map((c) => BP.Wide.release(state, c, false))); h.hand = [];
        const n = h.energy; a.energy += n; h.energy = 0;
        return `${h.name} сбросил руку, ${a.name} +${n} энергии`;
      }
      case "burnGive": return tHero && tHero.id !== h.id ? startHandChoice(state, h, "burn", tHero, ef.amount) : "";
    }
    return null;
  }

  // Конец хода игроков (до сброса руки): Колчан накопителя
  function turnEndHero(state, h) {
    if (!h.quiver) return;
    const n = h.hand.filter((c) => c.donor).length;
    if (n) { BP.Wide.addStr(h, n * h.quiver, "fight"); E().log(state, h.name, `Колчан: +${n * h.quiver} Силы на бой`); }
  }
  function fightStart(state, h) { Object.assign(h, { blood: 0, pact: 0, bones: 0, necro: 0, quiver: 0, retainAll: false }); }

  // Текст эффектов этапа 2
  function effText(card, e) {
    switch (e.type) {
      case "trap": return `ловушка на клетку — ${TRAP[e.trap].name}: ${e.trap === "wire" ? `${e.amount || 12} урона по клетке и 6 соседним` : TRAP[e.trap].text}`;
      case "detonate": return "сработать все ловушки на поле";
      case "loseHp": return `потерять ${e.amount} ХП`;
      case "lifesteal": return "вернуть ХП = нанесённому урону (не больше Крови)";
      case "bloodPact": return `каждая потеря ХП — +${e.amount} Силы на ход`;
      case "boneOnKill": return `убил — +${e.amount} Кость`;
      case "deathMark": return `если цель умрёт в этот ход — +${e.amount} Кости`;
      case "boneBlock": return `${e.base} брони + ${e.per} за каждую Кость`;
      case "spendBones": return "Кости тратятся";
      case "necro": return "враги, убитые союзниками, тоже дают Кость";
      case "quiver": return "в конце хода каждая несыгранная смердженная карта в руке — +1 Силы на бой";
      case "retainHand": return "карты в руке не сбрасываются в этот ход";
      case "costDownTurn": return `до конца хода все карты всей пати стоят на ${e.amount} меньше`;
      case "drawDiscard": return `возьми ${e.draw} карты, сбрось ${e.discard}`;
      case "giveEnergy": return "сбрось свою руку, вся твоя энергия — союзнику";
      case "burnGive": return `сожги карту из руки — союзник берёт ${e.amount}`;
    }
    return null;
  }
  const ICON = { trap: "🪤", detonate: "💥", loseHp: "🩸", lifesteal: "❤", bloodPact: "🩸", boneOnKill: "🦴", deathMark: "☠", boneBlock: "🦴", spendBones: "🦴", necro: "💀", quiver: "🏹", retainHand: "📌", costDownTurn: "⚡", drawDiscard: "🂠", giveEnergy: "⚡", burnGive: "🔥" };

  return { TRAP, trapAt, trigger, onMove, afterHits, lostHp, heal, onKill, startHandChoice, chooseHand, autoHand, costDown, partyTurnEnd, applyEffect, turnEndHero, fightStart, effText, ICON };
})();
