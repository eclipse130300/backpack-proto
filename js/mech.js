// Механики версии card-mechanics-1 (21.10, эксперимент). Сюда вынесено новое, чтобы не раздувать engine.js:
//  - броня врагов: стартовая (часть ХП) и от действий «атака + броня»; не сгорает в конце хода.
//    Порядок урона: блок → броня → ХП. Карта с armorBreak бьёт по броне ×2. ignoreBlock — мимо блока и брони.
//  - столкновение: толкнули врага в другого врага — оба получают +50% урона до конца хода (rules.collisionBonus).
//  - динамические массовки: rays (лучи по направлениям от клетки прицела до края поля), level (вся линия поперёк).
//  - поддержка: Сила (+1 урона всем картам героя до конца боя), Стойкость (+1 к блоку от его карт), Дымовая завеса (промах).
//  - выбор карты: Прозрение (1 из 3 случайных из колод всех героев) → владельцу в руку;
//    Поиск (24.10) — на героя: 1 из 3 случайных из колоды и сброса этого героя (рука не участвует) → ему в руку, с мердж-бонусами.
//  - враги: раненый (≤50% ХП) выбирает действие с бронёй; Жрец выводит героя из игры на 1 ход (disable).
window.BP = window.BP || {};

BP.Mech = (function () {
  const up = (x) => Math.ceil(x - 1e-9);

  // ---------- броня врагов ----------
  // Сколько урона поглощают блок и броня и сколько уходит в ХП. Меняет врага.
  function absorb(e, amount, noBlock, armorBreak) {
    let left = amount, blocked = 0, armorHit = 0;
    if (!noBlock) {
      const b = Math.min(e.block || 0, left); e.block -= b; left -= b; blocked += b;
      if (left > 0 && e.armor > 0) {
        if (armorBreak) { // по броне ×2: каждая единица урона снимает 2 брони
          const take = Math.min(e.armor, left * 2), used = up(take / 2);
          e.armor -= take; left -= used; armorHit = take;
        } else {
          const take = Math.min(e.armor, left);
          e.armor -= take; left -= take; armorHit = take;
        }
      }
    }
    return { toHp: left, blocked, armorHit };
  }

  // ---------- динамические зоны ----------
  // Лучи от клетки (без самой клетки) по направлениям dirs до края поля
  function rayCells(state, c, dirs) {
    const r = state.config.rules, out = [];
    (dirs || []).forEach((d) => {
      let cur = c;
      for (let i = 0; i < 12; i++) {
        const n = BP.Hex.neighbor(cur.col, cur.row, d, r.cols, r.rows);
        if (!n) break;
        if (!out.some((o) => o.col === n.col && o.row === n.row)) out.push(n);
        cur = n;
      }
    });
    return out;
  }

  // Линия поперёк: все клетки на той же высоте, что и клетка прицела (поле делится на 4 такие линии по 3 клетки)
  function levelCells(state, c) {
    const r = state.config.rules, y = BP.Hex.center(c.col, c.row).y, out = [];
    for (let col = 0; col < r.cols; col++) for (let row = 0; row < r.rows; row++) {
      if (Math.abs(BP.Hex.center(col, row).y - y) < 0.05) out.push({ col, row });
    }
    return out;
  }

  // Родные клетки динамической массовки (или null, если карта не такая)
  function dynCells(state, card, c) {
    if (card.area === "rays") return [c].concat(rayCells(state, c, card.rays));
    if (card.area === "level") return levelCells(state, c);
    return null;
  }

  // Клетки, которые дар «Зона» добавляет от динамических массовок
  function zoneDynCells(state, card, c) {
    let out = [];
    if (card.zoneRays && card.zoneRays.length) out = out.concat(rayCells(state, c, card.zoneRays));
    if (card.zoneLevel) out = out.concat(levelCells(state, c));
    return out;
  }

  // Подпись зоны для текста/подсказок
  const DIR_ARROW = ["↗", "↑", "↖", "↙", "↓", "↘"];
  function dynLabel(card) {
    if (card.area === "rays") return "от клетки до края поля: " + card.rays.map((d) => DIR_ARROW[d]).join(" ");
    if (card.area === "level") return "вся линия поперёк (3 клетки на одной высоте)";
    return "";
  }

  // ---------- рикошет ----------
  // Сила рикошета: 100% за первый (родной или дар), каждый следующий +50%
  function rico(card) {
    const total = (card.ricochet ? 1 : 0) + (card.pierce || 0);
    return total ? 1 + 0.5 * (total - 1) : 0;
  }

  // Нужно ли выбирать направление атаки
  function needsDir(state, card, target) {
    const t = target || {};
    if (t.dir !== undefined && t.dir !== null) return false;
    if (rico(card) && card.effects.some((e) => e.type === "damage")) return true;
    if (BP.Cards.has(card, "push")) {
      if (card.target === "enemy") return true;
      if (card.target === "cell" && t.cell && BP.Cards.enemyAt(state, t.cell.col, t.cell.row)) return true;
    }
    return false;
  }

  // ---------- выбор карты (Прозрение / Поиск) ----------
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // Создать выбор. kind: "pick" — count случайных из колод всех героев;
  // "tutor" (Поиск) — count случайных из колоды и сброса героя-цели. Возвращает заметку для лога.
  function startChoice(state, hero, kind, count, target) {
    const opts = [];
    if (kind === "tutor") {
      const t = target || hero;
      t.draw.concat(t.discard).forEach((c) => opts.push({ uid: c.uid, owner: t.id }));
    } else state.heroes.forEach((h) => { if (h.alive) h.draw.forEach((c) => opts.push({ uid: c.uid, owner: h.id })); });
    const list = shuffle(opts).slice(0, count || 3);
    if (!list.length) return kind === "tutor" ? "в колоде и сбросе пусто — выбирать нечего" : "в колодах пусто — выбирать нечего";
    state.choice = { hero: hero.id, kind, options: list, target: kind === "tutor" ? (target || hero).id : null };
    return kind === "pick" ? `выбирает 1 из ${list.length}` : `ищет карту для ${(target || hero).name}: 1 из ${list.length}`;
  }

  // Карта варианта выбора: в колоде или в сбросе владельца
  function findOption(state, o) {
    const h = state.heroes.find((x) => x.id === o.owner);
    if (!h) return null;
    const c = h.draw.find((x) => x.uid === o.uid) || h.discard.find((x) => x.uid === o.uid);
    return c ? { h, c } : null;
  }

  // Взять выбранную карту из колоды владельца в его руку
  function choose(state, uid) {
    const ch = state.choice;
    if (!ch) return "Нет выбора";
    const o = ch.options.find((x) => x.uid === uid);
    if (!o) return "Этой карты нет среди вариантов";
    const f = findOption(state, o), owner = f && f.h, card = f && f.c;
    state.choice = null;
    if (!card || !owner.alive) return null;
    const from = owner.discard.some((c) => c.uid === uid) ? "из сброса" : "из колоды";
    owner.draw = owner.draw.filter((c) => c.uid !== uid);
    owner.discard = owner.discard.filter((c) => c.uid !== uid);
    owner.hand.push(card); // со всеми мердж-бонусами
    BP.Engine.log(state, (state.heroes.find((h) => h.id === ch.hero) || {}).name || "—", `взял «${card.name}» ${from} → ${owner.name}`);
    return null;
  }

  // Карта для бота / авто-выбора в конце хода: самая дорогая (а из равных — с большим уроном)
  function autoPick(state) {
    const ch = state.choice;
    if (!ch) return null;
    let best = null, bv = -1;
    ch.options.forEach((o) => {
      const f = findOption(state, o), c = f && f.c;
      if (!c) return;
      const d = (c.effects || []).find((e) => e.type === "damage");
      const v = c.cost * 100 + (d ? d.amount : 0) - (c.weak ? 500 : 0);
      if (v > bv) { bv = v; best = o.uid; }
    });
    return best;
  }

  // ---------- эффекты поддержки ----------
  // Применить эффект карты, который знает только этот файл. Возвращает заметку или null (эффект не наш).
  function applyEffect(state, hero, card, ef, tHero, primary, hits) {
    const to = tHero || hero;
    switch (ef.type) {
      case "buffDamage": to.dmgBuff = (to.dmgBuff || 0) + ef.amount; return `${to.name}: +${to.dmgBuff} урона каждой картой до конца боя`;
      case "buffBlock": to.blockBuff = (to.blockBuff || 0) + ef.amount; return `${to.name}: +${to.blockBuff} блока каждой картой до конца боя`;
      case "miss": to.miss = (to.miss || 0) + (ef.amount || 1); return `${to.name}: следующая атака врага промахнётся`;
      case "pick": return startChoice(state, hero, "pick", ef.count || 3);
      case "tutor": return startChoice(state, hero, "tutor", ef.count || 3, tHero);
      case "stun": { // одиночка — цель, массовка — все задетые враги
        const list = primary ? [primary] : [...new Set((hits || []).map((h) => h.enemy))].map((uid) => state.enemies.find((e) => e.uid === uid));
        const out = [];
        list.forEach((e) => { if (e && e.alive) { e.stunned = true; e.intent = { type: "stunned" }; out.push(e.name); } });
        return out.length ? `${out.join(", ")} оглушен${out.length > 1 ? "ы" : ""}` : "";
      }
    }
    return null;
  }

  // Блок от карт героя с учётом Стойкости
  const blockOf = (hero, amount) => amount + (hero.blockBuff || 0);

  // ---------- враги ----------
  const armorAct = (a) => a.type === "block" || (a.type === "attack" && a.armor > 0);
  // Какое действие враг выберет сейчас: по кругу; раненый (≤50% ХП) — действие с бронёй (но не два раза подряд)
  function pickAction(state, e) {
    const n = e.actions.length, idx = e.actionIndex % n;
    if (e.hp * 2 <= e.maxHp && !armorAct(e.actions[idx])) {
      const ai = e.actions.findIndex(armorAct);
      if (ai >= 0 && e.lastAct !== ai) return ai;
    }
    return idx;
  }

  // Начало хода игроков: выведенный Жрецом герой пропускает ход (без добора и энергии)
  function heroTurnStart(h) {
    h.out = !!h.disableNext; h.disableNext = false;
    return h.out;
  }

  // Подсказки ботам: прибавка к оценке карт, которые не видны в одном ходе (энергия, добор, бафы, промах)
  function botBonus(s, hero, card, target) {
    let v = 0;
    const tgt = target && target.hero ? s.heroes.find((h) => h.id === target.hero) : hero;
    (card.effects || []).forEach((e) => {
      switch (e.type) {
        case "energy": { const need = tgt.hand.some((c) => c.cost > (tgt.energy || 0) && c.cost <= (tgt.energy || 0) + e.amount); v += need ? 5 * e.amount : 1; break; }
        case "draw": v += 3 * e.amount; break;
        case "pick": case "tutor": v += 4; break;
        case "buffDamage": v += 6; break;
        case "buffBlock": v += 3; break;
        case "miss": {
          let big = 0;
          s.enemies.forEach((en) => { if (en.alive && en.intent && en.intent.type === "attack" && (en.intent.targets || []).includes(tgt.id)) big = Math.max(big, en.intent.damage * (en.intent.hits || 1)); });
          v += big * 1.2 - (tgt.miss ? 6 : 0);
          break;
        }
      }
    });
    return v;
  }

  return { findOption, absorb, rayCells, levelCells, dynCells, zoneDynCells, dynLabel, rico, needsDir, startChoice, choose, autoPick, applyEffect, blockOf, pickAction, armorAct, heroTurnStart, botBonus, DIR_ARROW };
})();
