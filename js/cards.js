// Карты: текст, проверка цели, расчёт урона (с превью), применение эффектов, мердж.
window.BP = window.BP || {};

BP.Cards = (function () {
  const TARGET_LABEL = { enemy: "враг", cell: "клетка", self: "себя", hero: "себя или союзника", ally: "союзник", none: "" };
  const ATTACK_LABEL = { melee: "Мили", ranged: "Дальний", aoe: "Массовая" };
  const AREA_LABEL = { adjacent: "по клетке и всем соседям", row: "по всему ряду", line: "насквозь (цель и враг за ней)" };
  // card.shapeName кладёт engine.makeCard из config.shapes
  function areaLabel(card) {
    if (card.area === "shape") return card.shapeName ? "по фигуре: " + card.shapeName : "";
    return AREA_LABEL[card.area] || "";
  }

  // Человекочитаемый текст карты из её эффектов — чтобы правки конфига сразу меняли описание.
  function text(card) {
    const parts = [];
    (card.effects || []).forEach((e) => {
      switch (e.type) {
        case "damage": parts.push(`${e.amount} урона${e.hits > 1 ? ` ×${e.hits}` : ""}${areaLabel(card) ? " " + areaLabel(card) : ""}`); break;
        case "block": parts.push(`${e.amount} блока${card.target === "hero" || card.target === "ally" ? " цели" : ""}`); break;
        case "blockSelf": parts.push(`себе ${e.amount} блока`); break;
        case "push": parts.push("толкнуть (выбор стороны)"); break;
        case "stun": parts.push("оглушить (пропустит действие)"); break;
        case "taunt": parts.push("враг атакует тебя"); break;
        case "cleanse": parts.push("снять проклятия"); break;
        case "draw": parts.push(`взять ${e.amount} карт`); break;
        case "energy": parts.push(`+${e.amount} энергии`); break;
        case "sharedPool": parts.push("общий пул энергии пати до конца хода"); break;
        case "quest": parts.push("квест для пати"); break;
      }
    });
    let t = parts.join(", ");
    t = t.charAt(0).toUpperCase() + t.slice(1);
    if (card.note) t += (t ? ". " : "") + card.note;
    return t;
  }

  function tags(card) {
    const out = [];
    if (card.attack) out.push(ATTACK_LABEL[card.attack]);
    if (card.target && TARGET_LABEL[card.target] && card.target !== "enemy" && card.target !== "cell") out.push("→ " + TARGET_LABEL[card.target]);
    if (card.weapon) out.push(card.weaponName);
    if (card.merged) out.push(`усилена ×${card.merged}`);
    return out;
  }

  function rewardText(r) {
    switch (r.type) {
      case "energyNextTurn": return `всем +${r.amount} энергии в след. ход`;
      case "blockAll": return `всем +${r.amount} блока`;
      case "drawNow": return `всем +${r.amount} карт`;
      case "damageAllEnemies": return `всем врагам ${r.amount} урона`;
    }
    return "";
  }

  const has = (card, type) => (card.effects || []).some((e) => e.type === type);

  // ---------- Цели ----------
  function enemyAt(state, col, row) {
    return state.enemies.find((e) => e.alive && e.col === col && e.row === row) || null;
  }

  // РЕШЕНО: мили бьют только открытых. Враг закрыт, если перед ним (ближе к героям) стоит другой враг.
  function isExposed(state, e) {
    const r = state.config.rules;
    const front = BP.Hex.frontCells(e.col, e.row, r.cols, r.rows).map((c) => !!enemyAt(state, c.col, c.row));
    if (!front.length) return true;
    return r.cover === "all" ? !front.every(Boolean) : !front.some(Boolean);
  }

  // Можно ли сыграть карту с этой целью. target: {enemy, cell:{col,row}, hero, dir}
  function checkTarget(state, hero, card, target) {
    const t = target || {};
    switch (card.target) {
      case "none": case "self": return null;
      case "hero": case "ally": {
        const h = state.heroes.find((x) => x.id === t.hero);
        if (!h || !h.alive) return "Нужна цель-герой";
        if (card.target === "ally" && h.id === hero.id) return "Только на союзника";
        return null;
      }
      case "enemy": {
        const e = state.enemies.find((x) => x.uid === t.enemy && x.alive);
        if (!e) return "Нужна цель-враг";
        if (card.attack === "melee" && !isExposed(state, e)) return "Мили бьёт только открытых врагов: этого прикрывают спереди";
        if (has(card, "push") && (t.dir === undefined || t.dir === null)) return "NEED_DIR";
        return null;
      }
      case "cell": {
        const r = state.config.rules;
        if (!t.cell || t.cell.col < 0 || t.cell.col >= r.cols || t.cell.row < 0 || t.cell.row >= r.rows) return "Нужна клетка поля";
        return null;
      }
    }
    return "Неизвестный тип цели";
  }

  function primaryCell(state, card, target) {
    if (card.target === "enemy") {
      const e = state.enemies.find((x) => x.uid === target.enemy);
      return e ? { col: e.col, row: e.row } : null;
    }
    if (card.target === "cell") return target.cell;
    return null;
  }

  // Все клетки, которые задевает карта (по зоне). target.rot — поворот фигуры (ПКМ).
  function areaCells(state, hero, card, target) {
    const c = primaryCell(state, card, target || {});
    if (!c) return [];
    const r = state.config.rules;
    let cells = [c];
    if (card.area === "shape") {
      const sh = (state.config.shapes || {})[card.shape];
      cells = BP.Hex.shapeCells(c.col, c.row, sh ? sh.steps : [[]], (target && target.rot) || 0, r.cols, r.rows);
    }
    if (card.area === "adjacent") cells = cells.concat(BP.Hex.neighbors(c.col, c.row, r.cols, r.rows));
    if (card.area === "row") { cells = []; for (let i = 0; i < r.cols; i++) cells.push({ col: i, row: c.row }); }
    if (card.area === "line") {
      const hi = state.heroes.indexOf(hero);
      const dir = BP.Hex.dirFromPoint(BP.Hex.heroPos(hi, r.cols), c.col, c.row);
      const n = BP.Hex.neighbor(c.col, c.row, dir, r.cols, r.rows);
      if (n) cells.push(n);
    }
    return cells;
  }

  // Все враги, которых задевает карта (по зоне)
  function areaEnemies(state, hero, card, target) {
    const out = [];
    areaCells(state, hero, card, target).forEach((cc) => { const e = enemyAt(state, cc.col, cc.row); if (e && !out.includes(e)) out.push(e); });
    return out;
  }

  function weakness(hero) {
    return (hero.debuffs || []).reduce((s, d) => s + (d.type === "weak" ? d.amount : 0), 0);
  }

  // Расчёт ударов. Не меняет состояние, кроме счётчика крита, если commit = true.
  function computeHits(state, hero, card, target, commit) {
    const dmgEff = (card.effects || []).find((e) => e.type === "damage");
    if (!dmgEff) return [];
    const rules = state.config.rules;
    const enemies = areaEnemies(state, hero, card, target);
    const crit = card.weapon ? hero.crit[card.weapon] : null;
    let counter = crit ? crit.count : 0;
    const hits = [];
    for (let i = 0; i < (dmgEff.hits || 1); i++) {
      let weaponCrit = false;
      if (crit) { counter++; if (counter >= crit.every) { weaponCrit = true; counter = 0; } }
      enemies.forEach((e) => {
        const cond = rules.conditionalCrit && (e.stunned || e.pushedThisTurn);
        const mult = weaponCrit || cond ? rules.critMultiplier : 1;
        const base = Math.max(0, dmgEff.amount - weakness(hero));
        hits.push({ enemy: e.uid, amount: base * mult, crit: mult > 1, critReason: weaponCrit ? "оружие" : cond ? "условный" : "" });
      });
    }
    if (commit && crit) crit.count = counter;
    return hits;
  }

  // Сколько ударов этим оружием до крита (1 = следующий удар критует) и критует ли эта карта
  function critInfo(hero, card) {
    const dmg = (card.effects || []).find((e) => e.type === "damage");
    const c = card.weapon && hero.crit ? hero.crit[card.weapon] : null;
    if (!dmg || !c) return null;
    const left = c.every - c.count;
    return { left, every: c.every, willCrit: left <= (dmg.hits || 1) };
  }

  const rotatable = (card) => card.area === "shape";

  // Превью для UI: суммарный урон по каждому врагу
  function preview(state, hero, card, target) {
    if (checkTarget(state, hero, card, target) && checkTarget(state, hero, card, target) !== "NEED_DIR") return null;
    const sum = {};
    computeHits(state, hero, card, target, false).forEach((h) => {
      sum[h.enemy] = sum[h.enemy] || { amount: 0, crit: false };
      sum[h.enemy].amount += h.amount;
      sum[h.enemy].crit = sum[h.enemy].crit || h.crit;
    });
    return sum;
  }

  // ---------- Мердж ----------
  function canMerge(state, src, dst) {
    const m = state.config.tests.merge;
    const types = (c) => c.effects.map((e) => (e.type === "blockSelf" ? "block" : e.type));
    const d = types(dst);
    if (m.mode === "flat") return d.includes("damage") || d.includes("block");
    const s = types(src);
    return (s.includes("damage") && d.includes("damage")) || (s.includes("block") && d.includes("block"));
  }

  function mergeInto(state, src, dst) {
    const m = state.config.tests.merge;
    let changed = false;
    const srcDmg = src.effects.find((e) => e.type === "damage");
    const srcBlk = src.effects.find((e) => e.type === "block" || e.type === "blockSelf");
    dst.effects.forEach((e) => {
      if (e.type === "damage") {
        const add = m.mode === "flat" ? m.flatBonus : srcDmg ? srcDmg.amount * (srcDmg.hits || 1) : 0;
        if (add) { e.amount += add; changed = true; }
      }
      if (e.type === "block" || e.type === "blockSelf") {
        const add = m.mode === "flat" ? m.flatBonus : srcBlk ? srcBlk.amount : 0;
        if (add) { e.amount += add; changed = true; }
      }
    });
    if (changed) {
      dst.merged = (dst.merged || 0) + 1;
      dst.text = text(dst);
    }
    return changed;
  }

  return { text, rewardText, tags, has, checkTarget, areaCells, areaEnemies, computeHits, preview, mergeInto, canMerge, enemyAt, weakness, isExposed, critInfo, rotatable, areaLabel };
})();
