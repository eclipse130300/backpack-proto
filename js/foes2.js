// Пассивки и особые действия врагов в духе Slay the Spire (wide-range, правки 26.11). Числа — config.enemies.*.passive / actions.
// Пассивки (e.pass, копия passive с числами под множители забега):
//   curl N   — Панцирь (как вошь в StS): первый удар по врагу за бой даёт ему N блока (e.curled — уже сработал)
//   thorns N — Шипы: герой, ударивший врага картой, получает N урона
//   split id — Деление (как слизни): на ≤50% ХП враг исчезает, вместо него два врага id с его текущим ХП
//   spores {status, turns} — Споры (как грибы): умирая, вешает статус всем героям
//   sleep N, metal M — Сон (как Лагавулин): спит до N своих ходов, пока спит — +M брони в конце хода;
//                      урон по ХП будит (в этот ход он только просыпается, потом бьёт по циклу)
//   enrage N — Злость (как Гоблин-главарь): герой сыграл НЕ атаку — враг +N Силы
//   stagger  — одинаковые враги начинают с разных действий
// Действия (выполняет js/foes.js → act): ritual (Ритуал: +str Силы в конце каждого своего хода, с этого хода),
//   grow (Сила себе), heal (лечит союзника), summon (призыв), junk (мусорные карты в колоду героя).
// Хуки engine.js: init (makeEnemy), onHurt / onDeath (hurtEnemy), afterAct (actEnemy), onCardPlayed (playCard), intent (computeIntent).
window.BP = window.BP || {};

BP.Foes2 = (function () {
  const E = () => BP.Engine;
  const alive = (s) => s.enemies.filter((e) => e.alive);

  // Новый враг: пассивки с поправкой на множители забега (броня — как ХП, шипы — как урон)
  function init(state, e, ed) {
    const p = ed.passive;
    if (!p) return;
    const k = (state.enc && state.enc.hpMult) || 1, dk = (state.enc && state.enc.dmgMult) || 1;
    e.pass = JSON.parse(JSON.stringify(p));
    if (p.curl) e.pass.curl = Math.max(1, Math.round(p.curl * k));
    if (p.metal) e.pass.metal = Math.max(1, Math.round(p.metal * k));
    if (p.thorns) e.pass.thorns = Math.max(1, Math.round(p.thorns * dk));
    if (p.sleep) e.asleep = p.sleep;
    if (p.stagger) { // одинаковые враги — по очереди с разных действий
      const st = state.stagCount || (state.stagCount = {}), n = st[e.type] || 0;
      st[e.type] = n + 1; e.actionIndex = n % e.actions.length;
    }
  }

  // Намерение спящего врага. true — намерение уже выставлено
  function intent(state, e) {
    if (e.asleep > 0 || e.waking) { e.intent = { type: "sleep", left: e.asleep, waking: !!e.waking }; return true; }
    return false;
  }

  // Ближайшие к клетке свободные клетки (по расстоянию центров)
  function freeNear(state, col, row) {
    const r = state.config.rules, c0 = BP.Hex.center(col, row), out = [];
    for (let rr = 0; rr < r.rows; rr++) for (let cc = 0; cc < r.cols; cc++) {
      if (BP.Cards.enemyAt(state, cc, rr)) continue;
      const c = BP.Hex.center(cc, rr);
      out.push({ col: cc, row: rr, d: Math.hypot(c.x - c0.x, c.y - c0.y) + Math.random() * 0.01 });
    }
    return out.sort((a, b) => a.d - b.d);
  }

  // Урон по врагу прошёл (hurtEnemy, до проверки смерти). toHp — сколько ушло в ХП
  function onHurt(state, e, amount, toHp, heroId) {
    const p = e.pass;
    if (!p) return;
    if (p.curl && !e.curled && amount > 0 && e.hp > 0) {
      e.curled = true; e.block += p.curl;
      E().log(state, e.name, `сворачивается в панцирь: +${p.curl} блока`);
    }
    if (p.thorns && heroId && amount > 0 && !state.thornsLock) {
      const h = state.heroes.find((x) => x.id === heroId);
      if (h && h.alive) { state.thornsLock = true; E().hurtHero(state, h, p.thorns); state.thornsLock = false; E().log(state, e.name, `шипы: ${h.name} −${p.thorns}`); }
    }
    if ((e.asleep > 0) && toHp > 0 && e.hp > 0) {
      e.asleep = 0; e.waking = true;
      if (e.intent) e.intent = { type: "sleep", left: 0, waking: true };
      E().log(state, e.name, "просыпается от удара!");
    }
    if (p.split && e.hp > 0 && e.hp * 2 <= e.maxHp && !e.didSplit) split(state, e);
  }

  // Деление: враг пропадает (без «убийства»), рядом встают два врага p.split с его текущим ХП
  function split(state, e) {
    e.didSplit = true;
    const hp = e.hp, cells = [{ col: e.col, row: e.row }];
    e.alive = false; e.hp = 0;
    freeNear(state, e.col, e.row).forEach((c) => { if (cells.length < 2 && !(c.col === e.col && c.row === e.row)) cells.push(c); });
    const kids = cells.slice(0, 2).map((c) => {
      const k = E().makeEnemy(state, e.pass.split, c.col, c.row);
      k.hp = hp; k.maxHp = hp;
      return k;
    });
    E().arrive(state, kids, true);
    E().log(state, e.name, `делится на двух: ${kids.map((k) => `${k.name} (${k.hp} ХП)`).join(", ")}`);
  }

  // Враг погиб
  function onDeath(state, e) {
    const p = e.pass;
    if (!p || !p.spores) return;
    const D = BP.Foes.DEBUFF[p.spores.status];
    const heroes = state.heroes.filter((h) => h.alive);
    BP.Foes.applyDebuff(state, e, { status: p.spores.status, turns: p.spores.turns, amount: p.spores.amount }, heroes);
    E().log(state, e.name, `умирая, выпускает споры: ${D ? D.name : p.spores.status} всем героям`);
  }

  // Конец своего действия: Ритуал, Сон и Металл
  function afterAct(state, e) {
    if (!e.alive) return;
    if (e.ritual && e.ritualReady) { e.str = (e.str || 0) + e.ritual; E().log(state, e.name, `Ритуал: Сила +${e.ritual} (всего ${e.str})`); }
    if (e.ritual) e.ritualReady = true;
    const p = e.pass;
    if (p && p.metal && e.asleep > 0) { e.armor += p.metal; e.maxArmor = Math.max(e.maxArmor || 0, e.armor); }
  }

  // Герой сыграл карту: Злость
  function onCardPlayed(state, hero, card) {
    const isAtk = (card.effects || []).some((x) => x.type === "damage");
    if (isAtk) return;
    alive(state).forEach((e) => {
      if (e.pass && e.pass.enrage) {
        e.str = (e.str || 0) + e.pass.enrage;
        if (e.intent && e.intent.damage) e.intent.damage += e.pass.enrage; // намерение растёт сразу
        if (e.intent && e.intent.next) e.intent.next += e.pass.enrage;
        E().log(state, e.name, `злится: Сила +${e.pass.enrage} (${hero.name} сыграл «${card.name}»)`);
      }
    });
  }

  // ---------- особые действия (вызывает js/foes.js) ----------
  function healTarget(state, e) {
    const share = (x) => x.hp / Math.max(1, x.maxHp);
    const hurt = alive(state).filter((x) => x.hp < x.maxHp).sort((a, b) => share(a) - share(b));
    return hurt.find((x) => x !== e) || hurt[0] || e;
  }

  function act(state, e, it, heroes, log, fx) {
    switch (it.type) {
      case "ritual": e.ritual = (e.ritual || 0) + it.str; e.ritualReady = false; fx(state, { k: "foe", uid: e.uid, text: `Ритуал +${it.str}` }); log(state, e.name, `начинает ритуал: в конце каждого своего хода +${it.str} Силы`); return true;
      case "grow": e.str = (e.str || 0) + it.str; fx(state, { k: "foe", uid: e.uid, text: `Сила +${it.str}` }); log(state, e.name, `растёт: Сила +${it.str} (всего ${e.str})`); return true;
      case "heal": {
        let t = state.enemies.find((x) => x.uid === it.ally && x.alive);
        if (!t) t = healTarget(state, e);
        const before = t.hp; t.hp = Math.min(t.maxHp, t.hp + it.amount);
        fx(state, { k: "foe", uid: t.uid, text: `❤ +${t.hp - before}` });
        log(state, e.name, `лечит ${t === e ? "себя" : t.name}: +${t.hp - before} ХП`);
        return true;
      }
      case "summon": {
        const cells = freeNear(state, e.col, e.row).slice(0, it.n || 1);
        const list = cells.map((c) => E().makeEnemy(state, it.enemy, c.col, c.row));
        list.forEach((k) => (k.skip = true)); // в этот ход не бьют
        E().arrive(state, list, true);
        log(state, e.name, list.length ? `призывает: ${list.map((k) => k.name).join(", ")}` : "пытается призвать, но места нет");
        return true;
      }
      case "junk": {
        const cd = state.config.cards[it.card];
        heroes.forEach((h) => {
          for (let i = 0; i < (it.n || 1); i++) {
            const c = Object.assign(E().makeCard(state, it.card), { owner: h.id });
            h.draw.splice(Math.floor(Math.random() * (h.draw.length + 1)), 0, c);
          }
          fx(state, { k: "hero", hero: h.id, amount: 0, blocked: 0, status: `🌀 +${it.n || 1} «${cd ? cd.name : it.card}»` });
        });
        log(state, e.name, `замешивает ${it.n || 1} × «${cd ? cd.name : it.card}» в колоду: ${heroes.map((h) => h.name).join(", ")}`, { detail: "Мусорная карта: сыграть нельзя, в конце хода исчезает из руки." });
        return true;
      }
      case "sleep": {
        if (e.waking) { e.waking = false; log(state, e.name, "просыпается"); }
        else { e.asleep = Math.max(0, (e.asleep || 0) - 1); log(state, e.name, e.asleep ? `спит (ещё ${e.asleep})` : "просыпается"); }
        return true;
      }
    }
    return false;
  }

  function prepare(state, e, a, it) {
    if (a.type === "heal") it.ally = healTarget(state, e).uid;
  }
  const needsTargets = (a) => a.type === "junk";

  // ---------- тексты ----------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function badge(s, e, it) {
    switch (it.type) {
      case "ritual": return `<div class="intent buff">🕯 Ритуал +${it.str}</div>`;
      case "grow": return `<div class="intent buff">💪 Сила +${it.str}</div>`;
      case "heal": { const t = s.enemies.find((x) => x.uid === it.ally); return `<div class="intent def">❤ +${it.amount} → ${esc(t && t !== e ? t.name : "себе")}</div>`; }
      case "summon": return `<div class="intent buff">✋ призыв ×${it.n || 1}</div>`;
      case "junk": return `<div class="intent curse">🌀 мусор ×${it.n || 1}</div>`;
      case "sleep": return `<div class="intent charge">💤 ${it.waking ? "просыпается" : "спит"}</div>`;
    }
    return null;
  }
  function long(s, e, it) {
    switch (it.type) {
      case "ritual": return `Начинает ритуал: в конце каждого своего хода получает +${it.str} Силы. Чем дольше живёт, тем сильнее бьёт.`;
      case "grow": return `Растёт: +${it.str} Силы себе до конца боя.`;
      case "heal": { const t = s.enemies.find((x) => x.uid === it.ally); return `Лечит ${esc(t && t !== e ? t.name : "себя")} на ${it.amount} ХП.`; }
      case "summon": { const ed = s.config.enemies[it.enemy] || {}; return `Призывает ${it.n || 1} × «${esc(ed.name || it.enemy)}» на свободные клетки.`; }
      case "junk": { const cd = s.config.cards[it.card] || {}; return `Замешивает ${it.n || 1} × «${esc(cd.name || it.card)}» в колоду героя. Эту карту нельзя сыграть, в конце хода она исчезает из руки.`; }
      case "sleep": return it.waking ? "Проснулся от удара: в этот ход только поднимается, со следующего бьёт." : `Спит${it.left ? ` (ещё до ${it.left} ходов)` : ""}: копит броню. Удар по ХП его будит.`;
    }
    return null;
  }
  function short(a) {
    switch (a.type) {
      case "ritual": return `🕯 Ритуал: +${a.str} Силы каждый ход${a.once ? " (один раз)" : ""}`;
      case "grow": return `💪 Сила +${a.str} себе`;
      case "heal": return `❤ лечит союзника на ${a.amount}`;
      case "summon": return `✋ призывает ${a.n || 1}`;
      case "junk": return `🌀 ${a.n || 1} мусорные карты в колоду`;
    }
    return null;
  }

  // Статусы-пассивки врага (js/status.js)
  function statuses(state, e, add) {
    const p = e.pass || {};
    if (e.asleep > 0) add("💤", `Сон ${e.asleep}`, `Спит ещё до ${e.asleep} своих ходов и каждый ход получает +${p.metal || 0} брони. Урон по ХП его будит.`);
    if (e.ritual) add("🕯", `Ритуал +${e.ritual}`, `В конце каждого своего хода получает +${e.ritual} Силы.`, true);
    if (p.curl && !e.curled) add("🐚", `Панцирь ${p.curl}`, `Первый удар по нему за бой даст ему ${p.curl} блока.`);
    if (p.thorns) add("🌵", `Шипы ${p.thorns}`, `Герой, ударивший его картой, получает ${p.thorns} урона.`, true);
    if (p.split && !e.didSplit) { const k = state.config.enemies[p.split] || {}; add("🫧", "Деление", `На половине ХП делится на двух «${k.name || p.split}» с его текущим ХП.`); }
    if (p.spores) { const D = BP.Foes.DEBUFF[p.spores.status] || {}; add("🍄", "Споры", `Умирая, вешает всем героям «${D.name || p.spores.status}» на ${p.spores.turns} хода.`, true); }
    if (p.enrage) add("😡", `Злость ${p.enrage}`, `Каждый раз, когда герой играет НЕ атаку, получает +${p.enrage} Силы.`, true);
  }

  return { init, intent, onHurt, onDeath, afterAct, onCardPlayed, act, prepare, needsTargets, badge, long, short, statuses };
})();
