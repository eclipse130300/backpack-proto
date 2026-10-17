// Правила боя. Всё состояние — простой JSON (его хост рассылает игрокам).
// Хост — единственный, кто меняет состояние: applyAction / enemyStep.
window.BP = window.BP || {};

BP.Engine = (function () {
  const C = () => BP.Cards;
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---------- Создание забега ----------
  function createRun(config, players) {
    const state = {
      config: clone(config), phase: "lobby", seq: 1, turn: 0, fightIndex: 0,
      players: players || {}, heroes: [], enemies: [], log: [], fightLog: [],
      task: null, quests: [], pool: null, shared: null, turnStats: null, fightStats: null,
      actingEnemy: null, actingTargets: [], enemyQueue: [], banner: null, summary: null, fx: [], fxSeq: 0,
    };
    state.config.heroes.forEach((hc) => {
      state.heroes.push({
        id: hc.id, name: hc.name, owner: null, alive: true,
        hp: hc.hp, maxHp: hc.hp, startBlockMax: hc.startBlock || 0, startBlock: 0, block: 0,
        energy: 0, bonusEnergy: 0, debuffs: [], hand: [], draw: [], discard: [], crit: {},
        weapons: (hc.weapons || []).map((w) => (state.config.weapons[w] || {}).name || w),
        stats: null,
      });
    });
    return state;
  }

  function makeCard(state, cardId, weapon) {
    const src = state.config.cards[cardId];
    if (!src) throw new Error("Нет карты в конфиге: " + cardId);
    const card = clone(src);
    card.uid = "c" + state.seq++;
    card.id = cardId;
    card.effects = card.effects || [];
    if (weapon) { card.weapon = weapon; card.weaponName = state.config.weapons[weapon].name; }
    if (card.area === "shape") { const sh = (state.config.shapes || {})[card.shape]; card.shapeName = sh ? sh.name : card.shape; card.shapeSteps = sh ? sh.steps : [[]]; }
    card.text = C().text(card);
    const qe = card.effects.find((e) => e.type === "quest");
    const q = qe && state.config.quests[qe.id];
    if (q) card.text = `Квест ${q.scope === "turn" ? "на ход" : "на бой"}: ${q.text}. Награда: ${C().rewardText(q.reward)}`;
    return card;
  }

  // ---------- События для анимаций (цифры урона, шейк) ----------
  function fx(state, ev) {
    ev.id = ++state.fxSeq;
    state.fx.push(ev);
    if (state.fx.length > 40) state.fx.shift();
  }

  // ---------- Лог ----------
  function log(state, who, what, extra) {
    const entry = Object.assign({ fight: state.fightIndex + 1, turn: state.turn, who, what, time: new Date().toISOString().slice(11, 19) }, extra || {});
    state.log.push(entry);
    if (state.log.length > 2000) state.log.shift();
  }

  // ---------- Бой ----------
  function startFight(state, index) {
    const cfg = state.config, enc = cfg.encounters[index];
    state.fightIndex = index; state.turn = 0; state.phase = "players";
    state.enemies = enc.enemies.map((ec) => {
      const ed = cfg.enemies[ec.type];
      return { uid: "e" + state.seq++, type: ec.type, name: ed.name, hp: ed.hp, maxHp: ed.hp, block: 0,
        col: ec.col, row: ec.row, actions: clone(ed.actions), actionIndex: 0, intent: null,
        stunned: false, pushedThisTurn: false, alive: true };
    });
    state.heroes.forEach((h, i) => {
      const hc = cfg.heroes[i];
      if (!h.alive) { h.alive = true; h.hp = Math.max(1, cfg.rules.reviveHp || 10); }
      if (!cfg.rules.hpCarriesOver) h.hp = h.maxHp;
      h.startBlock = h.startBlockMax; h.block = 0; h.debuffs = []; h.bonusEnergy = 0;
      h.crit = {};
      (hc.weapons || []).forEach((w) => { if (cfg.weapons[w] && cfg.weapons[w].critEvery > 0) h.crit[w] = { every: cfg.weapons[w].critEvery, count: 0 }; });
      h.stats = { cards: 0, energy: 0, damage: 0, blockGiven: 0, merges: 0, taken: 0 };
    });
    BP.Deck.buildFight(state, makeCard); // колоды героев (и общая), особые карты — js/deck.js
    state.fightStats = { collisions: 0, turns: 0, taskDone: false, questsDone: 0, questsFailed: 0 };
    state.quests = [];
    state.task = null;
    if (cfg.tests.partyTask.enabled && enc.task) {
      const ids = Object.keys(cfg.tasks);
      const tid = enc.task === "random" ? ids[Math.floor(Math.random() * ids.length)] : enc.task;
      if (cfg.tasks[tid]) state.task = Object.assign({ id: tid, done: false }, clone(cfg.tasks[tid]));
    }
    state.summary = null;
    log(state, "—", `Бой ${index + 1}: ${enc.name}`);
    startPlayerTurn(state);
  }

  function drawCards(state, hero, n) { BP.Deck.draw(state, hero, n); }

  function aliveHeroes(state) { return state.heroes.filter((h) => h.alive); }

  function pickTargets(state, enemy, count) {
    const alive = aliveHeroes(state);
    if (!alive.length) return [];
    const idx = (h) => state.heroes.indexOf(h);
    let primary;
    if (state.config.tests.enemyTargeting === "B") {
      primary = alive[Math.floor(Math.random() * alive.length)];
    } else {
      const want = Math.min(2, Math.floor(enemy.col / (state.config.rules.cols / 3)));
      primary = alive.slice().sort((a, b) => Math.abs(idx(a) - want) - Math.abs(idx(b) - want))[0];
    }
    const rest = alive.filter((h) => h !== primary).sort((a, b) => Math.abs(idx(a) - idx(primary)) - Math.abs(idx(b) - idx(primary)));
    return [primary].concat(rest).slice(0, count).map((h) => h.id);
  }

  function isMeleeEnemy(state, e) { return !!(state.config.enemies[e.type] || {}).melee; }

  function computeIntent(state, e) {
    if (e.stunned) { e.intent = { type: "stunned" }; return; }
    const a = e.actions[e.actionIndex % e.actions.length];
    // враг-мили за чужой спиной не дотягивается до героев и ждёт
    if (a.type === "attack" && isMeleeEnemy(state, e) && !C().isExposed(state, e)) { e.intent = { type: "covered", damage: a.damage, hits: a.hits }; return; }
    const it = Object.assign({}, a);
    if (a.type === "attack" || a.type === "curse") it.targets = pickTargets(state, e, a.targets || 1);
    e.intent = it;
  }

  function startPlayerTurn(state) {
    state.turn++;
    state.fightStats.turns = state.turn;
    state.phase = "players"; state.pool = null; state.actingEnemy = null;
    state.turnStats = { played: [], damageBy: {}, kills: 0, merges: {}, mergesTotal: 0 };
    aliveHeroes(state).forEach((h) => {
      h.energy = state.config.rules.energy + h.bonusEnergy; h.bonusEnergy = 0;
      drawCards(state, h, Math.max(0, state.config.rules.handSize - h.hand.length));
    });
    state.enemies.forEach((e) => { if (e.alive) { e.pushedThisTurn = false; computeIntent(state, e); } });
    Object.values(state.players).forEach((p) => (p.ready = false));
  }

  // ---------- Урон ----------
  function hurtEnemy(state, e, amount, heroId, crit) {
    if (!e.alive || amount <= 0) return 0;
    const absorbed = Math.min(e.block, amount);
    e.block -= absorbed;
    e.hp -= amount - absorbed;
    fx(state, { k: "enemy", uid: e.uid, col: e.col, row: e.row, amount: Math.min(amount - absorbed, e.hp + amount - absorbed), blocked: absorbed, crit: !!crit });
    if (heroId) {
      const h = state.heroes.find((x) => x.id === heroId);
      if (h) h.stats.damage += amount - absorbed;
      (state.turnStats.damageBy[e.uid] = state.turnStats.damageBy[e.uid] || []).includes(heroId) || state.turnStats.damageBy[e.uid].push(heroId);
    }
    if (e.hp <= 0) {
      e.hp = 0; e.alive = false; state.turnStats.kills++;
      log(state, e.name, "погиб");
    }
    return amount;
  }

  function hurtHero(state, h, amount) {
    if (!h.alive || amount <= 0) return;
    let left = amount;
    const b = Math.min(h.block, left); h.block -= b; left -= b;
    const sb = Math.min(h.startBlock, left); h.startBlock -= sb; left -= sb;
    h.hp -= left; h.stats.taken += left;
    fx(state, { k: "hero", hero: h.id, amount: Math.min(left, h.hp + left), blocked: amount - left });
    if (h.hp <= 0) {
      h.hp = 0; h.alive = false;
      BP.Deck.discardAll(state, h, h.hand); h.hand = [];
      log(state, h.name, "пал в бою");
    }
  }

  function retarget(state, e, heroId) {
    if (!e.intent || !e.intent.targets) return false;
    if (!e.intent.targets.includes(heroId)) {
      e.intent.targets[0] = heroId;
    } else {
      e.intent.targets = [heroId].concat(e.intent.targets.filter((t) => t !== heroId));
    }
    e.intent.taunted = heroId;
    return true;
  }

  function push(state, e, dir, heroId) {
    const r = state.config.rules;
    const n = BP.Hex.neighbor(e.col, e.row, dir, r.cols, r.rows);
    e.pushedThisTurn = true;
    if (!n) {
      hurtEnemy(state, e, r.collisionDamage, heroId);
      state.fightStats.collisions++;
      return `${e.name} врезался в край поля (−${r.collisionDamage})`;
    }
    const other = C().enemyAt(state, n.col, n.row);
    if (other) {
      hurtEnemy(state, e, r.collisionDamage, heroId);
      hurtEnemy(state, other, r.collisionDamage, heroId);
      state.fightStats.collisions++;
      return `${e.name} столкнулся с ${other.name} (оба −${r.collisionDamage})`;
    }
    e.col = n.col; e.row = n.row;
    return `${e.name} отброшен ${BP.Hex.DIRS[dir].label}`;
  }

  // ---------- Розыгрыш карты ----------
  function payCost(state, hero, cost) {
    if (state.pool) {
      if (state.pool.amount < cost) return false;
      state.pool.amount -= cost;
    } else {
      if (hero.energy < cost) return false;
      hero.energy -= cost;
    }
    hero.stats.energy += cost;
    return true;
  }

  function canPay(state, hero, cost) {
    return (state.pool ? state.pool.amount : hero.energy) >= cost;
  }

  function playCard(state, hero, card, target) {
    const t = target || {};
    const err = C().checkTarget(state, hero, card, t);
    if (err) return err === "NEED_DIR" ? "Выберите направление толчка" : err;
    if (!payCost(state, hero, card.cost)) return "Не хватает энергии";

    hero.hand = hero.hand.filter((c) => c.uid !== card.uid);
    log(state, hero.name, `сыграл «${card.name}»`, { card: card.id, cost: card.cost });
    const entry = state.log[state.log.length - 1];
    const notes = [];
    const primary = card.target === "enemy" ? state.enemies.find((e) => e.uid === t.enemy) : null;
    const tHero = (card.target === "hero" || card.target === "ally") ? state.heroes.find((x) => x.id === t.hero) : card.target === "self" ? hero : null;

    // урон считаем до остальных эффектов (чтобы толчок не менял цели)
    const hits = C().computeHits(state, hero, card, t, true);
    if (hits.length) {
      const per = {};
      hits.forEach((h) => {
        const e = state.enemies.find((x) => x.uid === h.enemy);
        hurtEnemy(state, e, h.amount, hero.id, h.crit);
        per[e.name] = (per[e.name] || []).concat(h.amount + (h.crit ? "!" : ""));
      });
      notes.push(Object.entries(per).map(([n, a]) => `${n}: ${a.join("+")}`).join(", "));
    }

    card.effects.forEach((ef) => {
      switch (ef.type) {
        case "block": { const to = tHero || hero; to.block += ef.amount; hero.stats.blockGiven += ef.amount; notes.push(`${to.name} +${ef.amount} блока`); break; }
        case "blockSelf": hero.block += ef.amount; notes.push(`+${ef.amount} блока себе`); break;
        case "push": if (primary && primary.alive) notes.push(push(state, primary, t.dir, hero.id)); break;
        case "stun": if (primary && primary.alive) { primary.stunned = true; primary.intent = { type: "stunned" }; notes.push(`${primary.name} оглушён`); } break;
        case "taunt": if (primary && primary.alive && retarget(state, primary, hero.id)) notes.push(`${primary.name} теперь целит в ${hero.name}`); break;
        case "cleanse": if (tHero) { tHero.debuffs = []; notes.push(`${tHero.name} очищен`); } break;
        case "draw": drawCards(state, hero, ef.amount); break;
        case "energy": hero.energy += ef.amount; break;
        case "sharedPool": {
          if (!state.pool) {
            const sum = aliveHeroes(state).reduce((s, h) => s + h.energy, 0);
            aliveHeroes(state).forEach((h) => (h.energy = 0));
            state.pool = { amount: sum, by: hero.name };
            notes.push(`общий пул: ${sum} энергии`);
          }
          break;
        }
        case "quest": {
          const q = state.config.quests[ef.id];
          if (q && !state.quests.some((x) => x.id === ef.id && !x.done && !x.failed)) { state.quests.push(Object.assign({ id: ef.id, by: hero.name, done: false, failed: false }, clone(q))); notes.push(`квест: ${q.text}`); }
          break;
        }
      }
    });

    BP.Deck.discard(state, hero, card);
    hero.stats.cards++;
    state.turnStats.played.push({ hero: hero.id, cost: card.cost, card: card.id });
    entry.detail = notes.filter(Boolean).join("; ");
    afterChange(state, false);
    return null;
  }

  function mergeCard(state, hero, card, ally, allyCard) {
    const m = state.config.tests.merge;
    if (!m.enabled) return "Мердж выключен";
    if (ally.id === hero.id) return "Мердж — только в карту союзника";
    if (!ally.alive) return "Союзник пал";
    const cost = C().mergeCost(state, hero, card); // растущая стоимость — tests.merge.costGrowth
    if (!canPay(state, hero, cost)) return `Мердж стоит ${cost} энергии — не хватает`;
    const before = clone(allyCard);
    if (!C().mergeInto(state, card, allyCard)) return "Эти карты не совмещаются (нет общего урона/блока)";
    payCost(state, hero, cost);
    const ts = state.turnStats;
    ts.merges[hero.id] = (ts.merges[hero.id] || 0) + 1; ts.mergesTotal++;
    hero.hand = hero.hand.filter((c) => c.uid !== card.uid);
    BP.Deck.discard(state, hero, card);
    hero.stats.merges++; hero.stats.cards++;
    state.turnStats.played.push({ hero: hero.id, cost: card.cost, card: card.id, merge: true });
    log(state, hero.name, `мердж «${card.name}» → «${allyCard.name}» (${ally.name})`, { card: card.id, cost, merge: true, detail: `${before.text} ⇒ ${allyCard.text}` });
    afterChange(state, false);
    return null;
  }

  // ---------- Задачи и квесты ----------
  function condMet(state, c, endOfTurn) {
    const ts = state.turnStats;
    switch (c.type) {
      case "cardsInTurn": return ts.played.filter((p) => p.cost === c.cost).length >= c.count;
      case "killsInTurn": return ts.kills >= c.count;
      case "collisions": return state.fightStats.collisions >= c.count;
      case "sameTarget": {
        const alive = aliveHeroes(state).map((h) => h.id);
        return alive.length > 1 && Object.values(ts.damageBy).some((list) => alive.every((id) => list.includes(id)));
      }
      case "blockAll": return endOfTurn && aliveHeroes(state).every((h) => h.block >= c.amount);
    }
    return false;
  }

  function giveReward(state, r) {
    const heroes = aliveHeroes(state);
    switch (r.type) {
      case "energyNextTurn": heroes.forEach((h) => (h.bonusEnergy += r.amount)); break;
      case "blockAll": heroes.forEach((h) => (h.block += r.amount)); break;
      case "drawNow": heroes.forEach((h) => drawCards(state, h, r.amount)); break;
      case "damageAllEnemies": state.enemies.filter((e) => e.alive).forEach((e) => hurtEnemy(state, e, r.amount)); break;
    }
    return C().rewardText(r);
  }

  function checkGoals(state, endOfTurn) {
    if (state.task && !state.task.done && condMet(state, state.task.condition, endOfTurn)) {
      state.task.done = true; state.fightStats.taskDone = true;
      const r = giveReward(state, state.task.reward);
      state.banner = { id: state.seq++, text: `Задача пати выполнена: ${r}` };
      log(state, "Пати", `выполнила задачу «${state.task.text}»`, { detail: r });
    }
    state.quests.forEach((q) => {
      if (q.done || q.failed) return;
      if (condMet(state, q.condition, endOfTurn)) {
        q.done = true; state.fightStats.questsDone++;
        const r = giveReward(state, q.reward);
        state.banner = { id: state.seq++, text: `Квест выполнен: ${r}` };
        log(state, "Пати", `выполнила квест «${q.text}» (от ${q.by})`, { detail: r });
      }
    });
  }

  function afterChange(state, endOfTurn) {
    checkGoals(state, endOfTurn);
    checkFightEnd(state);
  }

  function checkFightEnd(state) {
    if (state.phase === "won" || state.phase === "lost" || state.phase === "victory") return true;
    if (!state.enemies.some((e) => e.alive)) {
      const last = state.fightIndex >= state.config.encounters.length - 1;
      state.phase = last ? "victory" : "won";
      state.enemyQueue = []; state.actingEnemy = null;
      state.summary = makeSummary(state, true);
      log(state, "Пати", `победа в бою ${state.fightIndex + 1}`, { detail: `ходов: ${state.turn}` });
      return true;
    }
    if (!aliveHeroes(state).length) {
      state.phase = "lost"; state.enemyQueue = []; state.actingEnemy = null;
      state.summary = makeSummary(state, false);
      log(state, "Пати", `поражение в бою ${state.fightIndex + 1}`);
      return true;
    }
    return false;
  }

  function makeSummary(state, win) {
    return {
      win, fight: state.fightIndex + 1, name: state.config.encounters[state.fightIndex].name,
      turns: state.turn, collisions: state.fightStats.collisions,
      task: state.task ? { text: state.task.text, done: state.task.done } : null,
      quests: { done: state.fightStats.questsDone, failed: state.fightStats.questsFailed },
      heroes: state.heroes.map((h) => Object.assign({ name: h.name, hp: h.hp, maxHp: h.maxHp }, h.stats)),
    };
  }

  // ---------- Конец хода и фаза врагов ----------
  function requiredPlayers(state) {
    const set = new Set();
    aliveHeroes(state).forEach((h) => h.owner && set.add(h.owner));
    return [...set];
  }

  function allReady(state) {
    const req = requiredPlayers(state);
    return req.length > 0 && req.every((pid) => state.players[pid] && state.players[pid].ready);
  }

  function endPlayerTurn(state) {
    aliveHeroes(state).forEach((h) => {
      const keep = h.hand.filter((c) => c.retain);
      BP.Deck.discardAll(state, h, h.hand.filter((c) => !c.retain));
      h.hand = keep;
    });
    afterChange(state, true);
    state.quests.forEach((q) => {
      if (q.scope === "turn" && !q.done && !q.failed) { q.failed = true; state.fightStats.questsFailed++; log(state, "Пати", `провалила квест «${q.text}»`); }
    });
    state.quests = state.quests.filter((q) => q.scope !== "turn");
    if (checkFightEnd(state)) return;
    state.phase = "enemies";
    state.enemyQueue = state.enemies.filter((e) => e.alive).sort((a, b) => a.col - b.col || a.row - b.row).map((e) => e.uid);
    log(state, "—", "Ход врагов");
  }

  // Один шаг фазы врагов. Возвращает true, пока шаги есть.
  function enemyStep(state) {
    if (state.phase !== "enemies") return false;
    const uid = state.enemyQueue.shift();
    if (uid) {
      const e = state.enemies.find((x) => x.uid === uid);
      state.actingEnemy = uid; state.actingTargets = [];
      if (e && e.alive) actEnemy(state, e);
      if (checkFightEnd(state)) return false;
      return true;
    }
    endEnemyPhase(state);
    return false;
  }

  function actEnemy(state, e) {
    if (e.stunned) { e.stunned = false; log(state, e.name, "оглушён — пропускает действие"); return; }
    e.block = 0;
    const it = e.intent || {};
    if (it.type === "covered" || (it.type === "attack" && isMeleeEnemy(state, e) && !C().isExposed(state, e))) {
      log(state, e.name, "закрыт своими — не дотягивается до героев");
      return; // действие не тратится: попробует в следующий ход
    }
    const targets = (it.targets || []).map((id) => state.heroes.find((h) => h.id === id)).filter((h) => h && h.alive);
    const actual = targets.length || !it.targets ? targets : pickTargets(state, e, it.targets.length).map((id) => state.heroes.find((h) => h.id === id));
    if (it.type === "attack" || it.type === "curse") state.actingTargets = actual.map((h) => h.id);
    if (it.type === "attack") {
      actual.forEach((h) => { for (let i = 0; i < (it.hits || 1); i++) hurtHero(state, h, it.damage); });
      log(state, e.name, `атакует ${actual.map((h) => h.name).join(", ")}`, { detail: `${it.damage}${it.hits > 1 ? "×" + it.hits : ""} урона` });
    } else if (it.type === "curse") {
      actual.forEach((h) => {
        const d = h.debuffs.find((x) => x.type === "weak");
        if (d) { d.amount = Math.max(d.amount, it.amount); d.turns = Math.max(d.turns, it.turns); }
        else h.debuffs.push({ type: "weak", amount: it.amount, turns: it.turns });
      });
      log(state, e.name, `проклинает ${actual.map((h) => h.name).join(", ")}`, { detail: `−${it.amount} к урону на ${it.turns} х.` });
    } else if (it.type === "block") {
      e.block += it.amount;
      log(state, e.name, `защищается (+${it.amount} блока)`);
    }
    e.actionIndex++;
  }

  function endEnemyPhase(state) {
    state.actingEnemy = null; state.actingTargets = [];
    aliveHeroes(state).forEach((h) => {
      h.block = 0;
      h.debuffs.forEach((d) => d.turns--);
      h.debuffs = h.debuffs.filter((d) => d.turns > 0);
    });
    if (!checkFightEnd(state)) startPlayerTurn(state);
  }

  // ---------- Действия игроков ----------
  // action: {a:'claim'|'release'|'assign'|'start'|'play'|'merge'|'ready'|'next'|'restart'|'forceEnd', ...}
  function applyAction(state, pid, act, isHost) {
    const hero = act.hero ? state.heroes.find((h) => h.id === act.hero) : null;
    const owns = hero && hero.owner === pid;
    switch (act.a) {
      case "claim":
        if (!hero || state.phase !== "lobby") return "Нельзя";
        if (hero.owner && hero.owner !== pid && !isHost) return "Герой занят";
        hero.owner = pid; return null;
      case "release":
        if (!hero || (!owns && !isHost)) return "Нельзя";
        hero.owner = null; return null;
      case "assign":
        if (!isHost || !hero) return "Только хост";
        hero.owner = act.player || null; return null;
      case "start":
        if (!isHost) return "Только хост";
        state.heroes.forEach((h) => { if (!h.owner || !state.players[h.owner]) h.owner = pid; });
        startFight(state, 0); return null;
      case "play": {
        if (state.phase !== "players") return "Сейчас не ход игроков";
        if (!owns) return "Это не ваш герой";
        if (!hero.alive) return "Герой пал";
        const card = hero.hand.find((c) => c.uid === act.card);
        if (!card) return "Карты нет в руке";
        return playCard(state, hero, card, act.target);
      }
      case "merge": {
        if (state.phase !== "players") return "Сейчас не ход игроков";
        if (!owns || !hero.alive) return "Это не ваш герой";
        const card = hero.hand.find((c) => c.uid === act.card);
        const ally = state.heroes.find((h) => h.id === act.ally);
        const allyCard = ally && ally.hand.find((c) => c.uid === act.allyCard);
        if (!card || !allyCard) return "Карта не найдена";
        return mergeCard(state, hero, card, ally, allyCard);
      }
      case "ready": {
        if (state.phase !== "players") return "Сейчас не ход игроков";
        if (!state.players[pid]) return "Нет игрока";
        state.players[pid].ready = act.value !== false;
        if (allReady(state)) endPlayerTurn(state);
        return null;
      }
      case "forceEnd":
        if (!isHost || state.phase !== "players") return "Только хост";
        endPlayerTurn(state); return null;
      case "next":
        if (!isHost || state.phase !== "won") return "Нельзя";
        startFight(state, state.fightIndex + 1); return null;
      case "retry":
        if (!isHost) return "Только хост";
        return "RESTART";
    }
    return "Неизвестное действие";
  }

  function playerLeft(state, pid, hostPid) {
    delete state.players[pid];
    state.heroes.forEach((h) => { if (h.owner === pid) h.owner = state.phase === "lobby" ? null : hostPid; });
    if (state.phase === "players" && allReady(state)) endPlayerTurn(state);
  }

  // Состояние для рассылки: без полного лога
  function publicState(state) {
    const s = Object.assign({}, state);
    s.log = state.log.slice(-80);
    return s;
  }

  return { createRun, startFight, applyAction, enemyStep, playerLeft, publicState, requiredPlayers, canPay, log, makeCard };
})();
