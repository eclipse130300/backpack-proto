// wide-range (24.11, РЕШЕНО 21.11): мердж = сложение + эффекты мерджа + статусы героев и врагов.
// Включается tests.merge.mode = "sum". Подробно — config.js (tests.merge, mergeFx, описание полей карт).
//  Мердж: свою карту (донор) кладёшь на карту в руке союзника (хозяин). Хозяин сохраняет цель, тип и фигуру.
//    Урон донора прибавляется к урону хозяина (к каждому удару; ограничение cap — «мердж даёт максимум +N»).
//    Остальные базовые эффекты донора и его ключевые слова (Exhaust, Удержание) переходят хозяину. Позиционка (толчки) — нет.
//    Атака в защиту: хозяин становится атакой с целью донора, его броня идёт своему герою. Один донор на карту.
//  Эффекты мерджа (card.mfx — список описаний из config.mergeFx): 🟩 in — у хозяина, 🟥 out — у донора, both — оба.
//    Эффекты «на карту» лежат в dst.wMods и учитываются в rebuild; «сразу» (добор, Сила…) — dst.wPending, их выполняет
//    engine.mergeCard через fire() (в расчётах ботов на копиях ничего не происходит).
//  После розыгрыша хозяин очищается (release), донор уже в сбросе владельца (или пропадает — tests.merge.unplayed "lose").
//  Статусы героя: dmgBuff (Сила на бой + на ход, strTurn), blockBuff (Стойкость, toughTurn), critReady, barrier, thorns,
//    keepBlock, mergeStr, aoeBonus, fade {per, left}, fadeSkip, exhausted[] (ушедшие до конца боя карты).
//  Статусы врага: vuln (стаки Уязвимости), mark (Метка), weakNext (Слабость), missAll (промахивается в этот ход).
window.BP = window.BP || {};

BP.Wide = (function () {
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const on = (state) => !!(state && state.config.tests.merge && state.config.tests.merge.mode === "sum");
  const isBlk = (e) => e.type === "block" || e.type === "blockSelf";
  const dmgOf = (card) => (card.effects || []).find((e) => e.type === "damage");
  const POSITIONAL = ["push", "pull", "pushOut"];
  const SNAP = ["effects", "target", "attack", "area", "shape", "fixedShape", "fixed", "shapeSteps", "shapeName", "rays",
    "chain", "chainDmg", "ricochet", "ricoDmg", "cost", "retain", "ex", "alwaysCrit", "strMult", "dmgFromBlock", "critMult"];

  // ---------- карты ----------
  // Описания эффектов мерджа по id (из конфига). fromRewards — на карту ставятся только ограничения (fixed)
  function resolveFx(state, ids, onlyFixed) {
    const lib = state.config.mergeFx || {};
    return (ids || []).filter((id) => lib[id] && (!onlyFixed || lib[id].fixed)).map((id) => Object.assign({ id }, clone(lib[id])));
  }
  // Вызывается из engine.makeCard
  function initCard(state, card) {
    if (!on(state)) return;
    card.wr = true;
    if (card.power) card.noMerge = true;
    const pool = (card.mfx || []).slice();
    card.mfxPool = pool;
    card.mfx = resolveFx(state, pool, !!state.config.tests.merge.mfxFromRewards);
    if (card.ricochet === true) card.ricochet = 1;
  }
  function addFx(state, card, ids) {
    const have = new Set((card.mfx || []).map((f) => f.id));
    card.mfx = (card.mfx || []).concat(resolveFx(state, ids.filter((id) => !have.has(id))));
  }

  const mergeable = (card) => !!card && !card.noMerge && !card.power && !card.weak && !card.questCard;
  function kindOf(card) {
    const b = card.wBase || card, effs = b.effects || [];
    if (b.attack === "aoe") return "aoe";
    if (effs.some((e) => e.type === "damage")) return "attack";
    if (effs.some(isBlk) || effs.some((e) => e.type === "barrier")) return "block";
    return "skill";
  }
  function mergeBlock(state, src, dst) {
    if (!src || !dst || src.uid === dst.uid) return "та же карта";
    if (!mergeable(src)) return "эту карту нельзя отдать";
    if (src.donor) return "в эту карту уже вмерджили — отдать её нельзя";
    if (!mergeable(dst)) return "в эту карту нельзя мерджить";
    if (dst.donor) return "в карту уже вмерджили (один донор на карту)";
    if (src.owner && dst.owner && src.owner === dst.owner) return "только в карту союзника";
    return null;
  }

  function condOk(fx, other, holder) {
    const c = fx.cond || {}, oc = (other.wBase || other).cost;
    if (c.cost !== undefined && oc !== c.cost) return false;
    if (c.costMin !== undefined && oc < c.costMin) return false;
    if (c.kind) { const k = kindOf(other); if (!(k === c.kind || (c.kind === "attack" && k === "aoe"))) return false; }
    if (c.otherClass && holder && other.owner === holder.id) return false;
    if (c.hpBelow && (!holder || holder.hp > holder.maxHp * c.hpBelow)) return false;
    if (c.critReady && (!holder || !holder.critReady)) return false;
    return true;
  }
  const CARD_MODS = ["dmg", "block", "cap", "crit", "cheaper", "retain", "ricoDmg", "rico", "chainDmg", "barrier", "durFight", "blockFirst", "healPlus", "boneKill"];

  // Мердж src → dst. state.heroes нужны только для условий (ХП, «Крит готов»). Ничего, кроме dst и src, не меняет.
  function mergeInto(state, src, dst, giverId) {
    if (mergeBlock(state, src, dst)) return false;
    const giver = state.heroes.find((h) => h.id === giverId), holder = state.heroes.find((h) => h.id === dst.owner);
    if (!dst.wBase) { dst.wBase = {}; SNAP.forEach((k) => { if (dst[k] !== undefined) dst.wBase[k] = clone(dst[k]); }); }
    const d = clone(src); release0(d);
    dst.donor = d; dst.donorUid = src.uid; dst.donorOwner = giverId;
    dst.wMods = []; dst.wPending = []; dst.fired = [];
    const fire = (fx, side, h, other) => {
      dst.fired.push({ side, text: fx.text });
      const mod = {}, now = {};
      Object.keys(fx.do || {}).forEach((k) => { if (CARD_MODS.includes(k)) mod[k] = fx.do[k]; else now[k] = fx.do[k]; });
      if (Object.keys(mod).length) dst.wMods.push(mod);
      if (Object.keys(now).length) {
        const to = now.copy ? giverId : side === "in" ? (holder && holder.id) : (holder && holder.id);
        dst.wPending.push(Object.assign({ to, from: h && h.id, side, text: fx.text }, now));
      }
    };
    (dst.mfx || []).forEach((fx) => { if (fx.side !== "out" && condOk(fx, src, holder)) fire(fx, "in", holder, giver); });
    (src.mfx || []).forEach((fx) => { if (fx.side !== "in" && condOk(fx, dst, giver)) fire(fx, "out", giver, holder); });
    rebuild(dst);
    dst.merged = 1;
    dst.text = BP.Cards.text(dst);
    return true;
  }

  // Пересобрать хозяина: исходник + донор + эффекты мерджа «на карту»
  function rebuild(dst) {
    const b = dst.wBase, d = dst.donor;
    if (!b) return;
    SNAP.forEach((k) => { if (b[k] !== undefined) dst[k] = clone(b[k]); else delete dst[k]; });
    if (!d) return;
    const mods = {};
    (dst.wMods || []).forEach((m) => Object.keys(m).forEach((k) => {
      if (typeof m[k] === "number") mods[k] = k === "cap" ? Math.min(mods[k] === undefined ? 99 : mods[k], m[k]) : (mods[k] || 0) + m[k];
      else mods[k] = m[k];
    }));
    const db = d.wBase || d, dd = (db.effects || []).find((e) => e.type === "damage");
    let hd = dmgOf(dst);
    const wasHeroTarget = dst.target === "hero" || dst.target === "ally";
    if (dd) {
      const add = dd.amount * (dd.hits || 1);
      if (hd) hd.amount += mods.cap !== undefined ? Math.min(add, mods.cap) : add;
      else { // атака в защиту/навык: хозяин бьёт цель донора, своя броня — своему герою
        ["target", "attack", "area", "shape", "fixedShape", "fixed", "shapeSteps", "shapeName", "rays"].forEach((k) => { if (db[k] !== undefined) dst[k] = clone(db[k]); else delete dst[k]; });
        dst.effects.forEach((e) => { if (e.type === "block") e.type = "blockSelf"; });
        dst.effects.unshift(clone(dd));
        hd = dmgOf(dst);
        ["strMult", "critMult", "dmgFromBlock", "chain", "chainDmg", "ricochet", "ricoDmg"].forEach((k) => { if (db[k] !== undefined && dst[k] === undefined) dst[k] = db[k]; });
      }
    }
    (db.effects || []).forEach((e) => {
      if (e.type === "damage" || POSITIONAL.includes(e.type)) return;
      const ee = clone(e);
      if (e.type === "block") ee.type = dst.target === "hero" || dst.target === "ally" || dst.target === "self" ? "block" : "blockSelf";
      const same = dst.effects.find((x) => x.type === ee.type && x.dur === ee.dur && !!x.party === !!ee.party && x.amount !== undefined);
      if (same && ee.amount !== undefined) same.amount += ee.amount; else dst.effects.push(ee);
    });
    if (db.ex) dst.ex = true;
    if (db.retain) dst.retain = true;
    if (db.chain) { dst.chain = (dst.chain || 0) + db.chain; if (!dst.chainDmg && db.chainDmg) dst.chainDmg = db.chainDmg; }
    if (db.ricochet && dst.ricochet !== undefined && b.ricochet) dst.ricochet += db.ricochet; else if (db.ricochet && !dst.ricochet) { dst.ricochet = db.ricochet; if (db.ricoDmg) dst.ricoDmg = db.ricoDmg; }
    // эффекты мерджа на карту
    if (mods.dmg && hd) hd.amount += mods.dmg;
    if (mods.block) { const bl = dst.effects.find(isBlk); if (bl) bl.amount += mods.block; else dst.effects.push({ type: dst.target === "self" ? "block" : "blockSelf", amount: mods.block }); }
    if (mods.cheaper) dst.cost = Math.max(0, dst.cost - mods.cheaper);
    if (mods.retain) dst.retain = true;
    if (mods.crit) dst.alwaysCrit = true;
    if (mods.ricoDmg) dst.ricoBonus = mods.ricoDmg;
    if (mods.rico && dst.ricochet) dst.ricochet += mods.rico;
    if (mods.chainDmg) dst.chainBonus = mods.chainDmg;
    if (mods.barrier) { const br = dst.effects.find((e) => e.type === "barrier"); if (br) br.amount += mods.barrier; }
    if (mods.durFight) dst.effects.forEach((e) => { if ((e.type === "str" || e.type === "tough") && e.dur === "turn") e.dur = "fight"; });
    if (mods.blockFirst) dst.blockFirst = true;
    if (mods.healPlus) dst.healPlus = mods.healPlus;
    if (mods.boneKill) dst.boneKill = mods.boneKill;
    void wasHeroTarget;
  }

  // Убрать мердж с карты (вернуть исходник)
  function release0(card) {
    if (!card.wBase) return card;
    SNAP.forEach((k) => { if (card.wBase[k] !== undefined) card[k] = clone(card.wBase[k]); else delete card[k]; });
    ["wBase", "donor", "donorUid", "donorOwner", "wMods", "wPending", "fired", "merged", "ricoBonus", "chainBonus", "blockFirst", "donorCard", "healPlus", "boneKill"].forEach((k) => delete card[k]);
    card.text = BP.Cards.text(card);
    return card;
  }

  // ---------- в бою (вызывает engine.js) ----------
  // Мердж случился: выполнить эффекты «сразу», «Ярость товарищей». lose — отданную карту держим внутри (пропадёт, если не сыграли)
  function afterMerge(state, hero, card, ally, allyCard) {
    const notes = [];
    (allyCard.wPending || []).forEach((p) => {
      const to = state.heroes.find((h) => h.id === p.to) || ally;
      if (p.draw) { BP.Deck.draw(state, to, p.draw); notes.push(`${to.name} +${p.draw} карт`); }
      if (p.str) { addStr(to, p.str, p.dur); notes.push(`${to.name} +${p.str} Силы ${p.dur === "fight" ? "на бой" : "на ход"}`); }
      if (p.tough) { addTough(to, p.tough, p.dur); notes.push(`${to.name} +${p.tough} Стойкости ${p.dur === "fight" ? "на бой" : "на ход"}`); }
      if (p.sharpen) { Object.values(to.crit || {}).forEach((c) => { c.every = Math.max(1, c.every - p.sharpen); c.count = Math.min(c.count, c.every - 1); }); notes.push(`${to.name}: крит на ${p.sharpen} удар раньше до конца боя`); }
      if (p.fadeHold) { to.fadeSkip = true; notes.push(`${to.name}: Угасание в этот ход не тикает`); }
      if (p.critMove && hero.critReady) { hero.critReady = false; ally.critReady = true; notes.push(`«Крит готов» → ${ally.name}`); }
      if (p.copy) {
        const cp = release0(clone(card)); cp.uid = "c" + state.seq++; cp.ex = true; cp.exhaust = true; cp.copyOf = card.name; cp.owner = hero.id;
        hero.hand.push(cp); notes.push(`копия «${card.name}» в руку ${hero.name}`);
      }
    });
    allyCard.wPending = [];
    if (ally.mergeStr) { addStr(ally, ally.mergeStr, "fight"); notes.push(`Ярость товарищей: ${ally.name} +${ally.mergeStr} Силы`); }
    if (state.config.tests.merge.unplayed === "lose") allyCard.donorCard = card; // отданная — внутри, в сброс после розыгрыша
    else BP.Deck.discard(state, hero, release0(card));
    return notes;
  }

  // Сыграна или сброшена смердженная карта: донор — в сброс владельца (или пропадает), хозяин — чистый
  function release(state, card, played) {
    if (card.donorCard) {
      const owner = state.heroes.find((h) => h.id === card.donorOwner);
      if (played && owner) BP.Deck.discard(state, owner, release0(card.donorCard));
      else if (owner) { owner.exhausted = (owner.exhausted || []).concat(release0(card.donorCard)); }
    }
    return release0(card);
  }

  // После розыгрыша: Power и Exhaust уходят до конца боя (true), иначе карта идёт в сброс как обычно (false)
  function exhaustPlayed(state, hero, card) {
    if (!on(state) || !(card.power || card.ex)) return false;
    if (!card.copyOf) hero.exhausted = (hero.exhausted || []).concat(card);
    return true;
  }

  function addStr(h, n, dur) { h.dmgBuff = (h.dmgBuff || 0) + n; if (dur !== "fight") h.strTurn = (h.strTurn || 0) + n; }
  function addTough(h, n, dur) { h.blockBuff = (h.blockBuff || 0) + n; if (dur !== "fight") h.toughTurn = (h.toughTurn || 0) + n; }

  // Эффекты карт wide-range. Возвращает заметку или null (эффект не наш)
  function applyEffect(state, hero, card, ef, tHero, primary, t, hits) {
    const to = tHero || hero, alive = state.heroes.filter((h) => h.alive);
    const who = ef.party ? alive : [to];
    switch (ef.type) {
      case "block": case "blockSelf": return card._bf ? "" : null; // броня уже дана до удара (blockFirst)
      case "str": who.forEach((h) => addStr(h, ef.amount, ef.dur)); return `${ef.party ? "всем" : to.name} +${ef.amount} Силы ${ef.dur === "fight" ? "на бой" : "на ход"}`;
      case "tough": who.forEach((h) => addTough(h, ef.amount, ef.dur)); return `${ef.party ? "всем" : to.name} +${ef.amount} Стойкости ${ef.dur === "fight" ? "на бой" : "на ход"}`;
      case "critReady": hero.critReady = true; return `${hero.name}: следующий удар — крит`;
      case "mark": if (primary && primary.alive) { primary.mark = true; return `${primary.name}: Метка (следующий удар +50%)`; } return "";
      case "missEnemy": if (primary && primary.alive) { primary.missAll = true; return `${primary.name} промахивается всеми ударами в этот ход`; } return "";
      case "barrier": to.barrier = (to.barrier || 0) + ef.amount; return `${to.name}: Барьер ${to.barrier}`;
      case "thorns": hero.thorns = (hero.thorns || 0) + ef.amount; return `${hero.name}: Шипы ${hero.thorns}`;
      case "keepBlock": hero.keepBlock = true; return `${hero.name}: броня больше не сгорает`;
      case "mergeStr": hero.mergeStr = (hero.mergeStr || 0) + ef.amount; return `${hero.name}: каждый мердж в его карту +${hero.mergeStr} Силы`;
      case "aoeBonus": hero.aoeBonus = (hero.aoeBonus || 0) + ef.amount; return `${hero.name}: массовки +${hero.aoeBonus} урона`;
      case "critShift": Object.values(hero.crit || {}).forEach((c) => { c.every = Math.max(1, c.every - ef.amount); c.count = Math.min(c.count, c.every - 1); }); return `${hero.name}: крит на ${ef.amount} удар раньше до конца боя`;
      case "fade": addStr(hero, ef.now, "fight"); hero.fade = { per: ef.per, left: ef.turns }; return `${hero.name} +${ef.now} Силы, затем ${ef.turns} хода по −${ef.per}`;
      case "pushOut": {
        if (!t || !t.cell) return "";
        const r = state.config.rules, out = [];
        for (let d = 0; d < 6; d++) {
          const n = BP.Hex.neighbor(t.cell.col, t.cell.row, d, r.cols, r.rows), e = n && BP.Cards.enemyAt(state, n.col, n.row);
          if (e && e.alive) out.push(BP.Engine.pushN(state, e, d, hero.id, 1));
        }
        return out.join("; ");
      }
    }
    return BP.Wide2 ? BP.Wide2.applyEffect(state, hero, card, ef, tHero, primary, t, hits) : null; // этап 2 (js/wide2.js)
  }

  // Броня до удара (эффект мерджа «Защита → её броня даётся до удара»)
  function blockFirst(state, hero, card, tHero, notes) {
    if (!card.blockFirst) return;
    card._bf = true;
    card.effects.forEach((e) => { if (isBlk(e)) { const to = e.type === "block" && tHero ? tHero : hero, a = BP.Mech.blockOf(hero, e.amount); to.block += a; notes.push(`${to.name} +${a} брони до удара`); } });
  }

  // Начало хода игроков: Угасание
  function turnStart(state, h) {
    if (h.fade && h.fade.left > 0) {
      if (h.fadeSkip) { h.fadeSkip = false; return `${h.name}: Угасание пропущено`; }
      h.dmgBuff = (h.dmgBuff || 0) - h.fade.per; h.fade.left--;
      return `${h.name}: Угасание −${h.fade.per} Силы (осталось ${h.fade.left})`;
    }
    return "";
  }
  // Конец хода игроков: Сила и Стойкость «на ход» сгорают
  function turnEnd(state, h) {
    if (h.strTurn) { h.dmgBuff -= h.strTurn; h.strTurn = 0; }
    if (h.toughTurn) { h.blockBuff -= h.toughTurn; h.toughTurn = 0; }
    h.fadeSkip = false;
  }
  // Начало боя: сброс статусов
  function fightStart(state, h) {
    if (BP.Wide2) BP.Wide2.fightStart(state, h);
    state.traps = []; state.costDown = 0;
    Object.assign(h, { strTurn: 0, toughTurn: 0, critReady: false, barrier: 0, thorns: 0, keepBlock: false, mergeStr: 0, aoeBonus: 0, fade: null, fadeSkip: false, exhausted: [] });
    if (state.config.tests.startBlock && state.config.tests.startBlock.enabled === false) { h.startBlock = 0; }
  }

  // Лимит руки пати (rules.partyHand): можно ли сейчас взять карту
  function handRoom(state) {
    const lim = state.config.rules.partyHand;
    if (!on(state) || !lim) return true;
    return state.heroes.reduce((s, h) => s + (h.hand || []).length, 0) < lim;
  }

  // ---------- текст ----------
  function effText(card, e) {
    const d = e.dur === "fight" ? "на бой" : "на ход";
    switch (e.type) {
      case "str": return `${e.party ? "всем героям " : ""}+${e.amount} Силы ${d}`;
      case "tough": return `${e.party ? "всем героям " : ""}+${e.amount} Стойкости ${d}`;
      case "critReady": return "следующий удар героя — крит";
      case "mark": return "Метка на цель: следующий удар по ней +50%";
      case "missEnemy": return "враг-цель промахивается всеми ударами в этот ход";
      case "barrier": return `Барьер ${e.amount}: блокирует ${e.amount === 1 ? "1 удар" : e.amount + " удара"} любого врага`;
      case "thorns": return `Шипы ${e.amount}: враг, ударивший героя, получает ${e.amount} урона`;
      case "keepBlock": return "броня героя больше не сгорает в конце хода";
      case "mergeStr": return `каждый раз, когда в карту героя вмерджили, +${e.amount} Силы на бой`;
      case "aoeBonus": return `все массовки героя +${e.amount} урона`;
      case "critShift": return `счётчик крита героя −${e.amount} до конца боя`;
      case "fade": return `сразу +${e.now} Силы, в начале каждого из следующих ${e.turns} ходов −${e.per} Силы`;
      case "pushOut": return "растолкать врагов вокруг клетки от неё";
      case "push": return e.far ? "толкнуть назад до столкновения" : null;
    }
    return BP.Wide2 ? BP.Wide2.effText(card, e) : null;
  }
  function textExtra(card) {
    const out = [];
    if (card.dmgFromBlock) out.push("урон = текущая броня героя");
    if (card.strMult > 1) out.push(`Сила действует ×${card.strMult}`);
    if (card.critMult) out.push(`крит ×${card.critMult}`);
    if (card.perHand) out.push("урон × число карт в руке");
    if (card.perBone) out.push(`+${card.perBone} урона за каждую Кость`);
    if (card.chain) out.push(`цепь: ${card.chain === 1 ? "прыжок" : card.chain + " прыжка"} по ${(card.chainDmg || (dmgOf(card) || {}).amount || 0) + (card.chainBonus || 0)} на соседа с наименьшим ХП`);
    if (card.ricochet) out.push(`рикошет${card.ricochet > 1 ? " ×" + card.ricochet : ""}: сосед цели по выбранному направлению ${(card.ricoDmg || (dmgOf(card) || {}).amount || 0) + (card.ricoBonus || 0)}`);
    if (card.donor) out.push(`вмерджена «${card.donor.name}»`);
    const kw = [];
    if (card.power) kw.push("Power"); if (card.ex) kw.push("Exhaust"); if (card.innate) kw.push("Innate"); if (card.retain) kw.push("Удержание");
    if (kw.length) out.push(kw.join(", "));
    (card.mfx || []).forEach((f) => { if (f && f.text) out.push(`${SIDE[f.side] || ""} ${f.text}`); }); // эффекты мерджа (видно на странице «Карты»)
    return out;
  }
  const SIDE = { in: "🟩", out: "🟥", both: "🟩🟥" };
  const SIDE_LONG = { in: "срабатывает, когда в эту карту вмерджили", out: "срабатывает, когда эту карту отдают союзнику", both: "срабатывает и когда в неё вмерджили, и когда её отдают" };

  // Подсказки карты (js/ui-cardtip.js)
  function tipParts(state, hero, c, add) {
    if (!on(state)) return;
    (c.effects || []).forEach((e) => {
      const t = effText(c, e);
      const ic = Object.assign({}, BP.Wide2 ? BP.Wide2.ICON : {}, { str: "💪", tough: "🛡️", critReady: "💥", mark: "🎯", missEnemy: "🌫", barrier: "🔰", thorns: "🌵", keepBlock: "🧱", mergeStr: "🤝", aoeBonus: "🔥", critShift: "🗡", fade: "🩸", pushOut: "💨" })[e.type];
      if (ic && t) add({ icon: ic, value: e.amount ? "+" + e.amount : e.now ? "+" + e.now : "", face: true, short: t, long: t.charAt(0).toUpperCase() + t.slice(1) + "." });
    });
    if (c.dmgFromBlock) add({ icon: "🧱", face: true, short: "урон = броня", long: "Урон карты = текущая броня героя (плюс урон карты, если он есть)." });
    if (c.strMult > 1) add({ icon: "💪", value: "×" + c.strMult, face: true, short: `Сила ×${c.strMult}`, long: `Сила героя действует на эту карту ${c.strMult} раза.` });
    if (c.critMult) add({ icon: "💥", value: "×" + c.critMult, face: true, short: `крит ×${c.critMult}`, long: `Крит этой картой ×${c.critMult} вместо ×2.` });
    if (c.perHand) add({ icon: "🂠", value: "×", face: true, short: "урон × карт в руке", long: "Урон карты умножается на число карт в руке героя (без неё самой)." });
    if (c.perBone) add({ icon: "🦴", value: "+" + c.perBone, face: true, short: `+${c.perBone} за Кость`, long: `+${c.perBone} урона за каждую Кость героя.` });
    if (c.chain) add({ icon: "🌩", value: (c.chainDmg || (dmgOf(c) || {}).amount || 0) + (c.chainBonus || 0), face: true, short: "цепь", long: "После удара прыгает на соседнего врага с наименьшим ХП." });
    if (c.power) add({ icon: "◆", face: true, short: "Power", long: "Эффект на весь бой. После розыгрыша карта уходит до конца боя. Не мерджится." });
    if (c.ex && !c.power) add({ icon: "🔥", face: true, short: "Exhaust", long: "После розыгрыша карта уходит до конца боя." });
    if (c.retain) add({ icon: "📌", face: true, short: "Удержание", long: "Не сбрасывается в конце хода." });
    if (c.innate) add({ icon: "☝", face: true, short: "Innate", long: "Всегда в первой руке боя." });
    if (c.noMerge && !c.power) add({ icon: "⛔", face: true, short: "не мерджится", long: "Эту карту нельзя отдать и в неё нельзя вмерджить." });
    (c.mfx || []).forEach((fx) => add({ icon: SIDE[fx.side] || "🟩", face: true, cls: "mfx-" + fx.side, short: fx.text, long: `Эффект мерджа (${SIDE[fx.side]} ${SIDE_LONG[fx.side]}): ${fx.text}.` }));
    if (c.donor) add({ icon: "★", short: `вмерджена «${c.donor.name}»`, long: `В карту вмерджили «${c.donor.name}»: её урон и эффекты уже прибавлены. После розыгрыша карты распадутся.${(c.fired || []).length ? " Сработало: " + c.fired.map((f) => f.text).join("; ") + "." : ""}` });
  }

  // Эффекты мерджа, которые можно предложить карте наградой: её пул + общий пул (с весами по стоимости)
  function rewardFx(state, card) {
    const lib = state.config.mergeFx || {}, have = new Set((card.mfx || []).map((f) => f.id)), out = [];
    (card.mfxPool || []).forEach((id) => { if (lib[id] && !have.has(id) && !lib[id].fixed) out.push({ id, w: 3 }); });
    Object.entries(lib).forEach(([id, fx]) => {
      if (!fx.pool || have.has(id) || out.some((o) => o.id === id)) return;
      const w = (fx.w || [1, 1, 1, 1])[Math.min(3, card.cost || 0)];
      if (w > 0) out.push({ id, w });
    });
    return mergeable(card) ? out : [];
  }

  return { on, initCard, addFx, mergeable, mergeBlock, mergeInto, rebuild, release, release0, afterMerge, exhaustPlayed, applyEffect, blockFirst,
    turnStart, turnEnd, fightStart, handRoom, effText, textExtra, tipParts, rewardFx, kindOf, addStr, SIDE };
})();
