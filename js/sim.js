// Боты-игроки и подсчёт статистики. Общий код для браузерного симулятора (cards.html)
// и для консольного tools/balance-sim.js. Боты играют по тем же правилам (js/engine.js), что и люди.
//   smart  — «аккуратный игрок»: перебирает каждую карту × цель (и повороты фигур), проигрывает ход
//            врагов на копии состояния и выбирает лучшее;
//   medium — тот же smart, но ~35% решений наугад;
//   sloppy — случайные карты на случайные цели.
window.BP = window.BP || {};

BP.Sim = (function () {
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ---------- служебное ----------
  // Копия состояния: config общий (во время боя он не меняется), лог не копируем.
  function cloneState(s) {
    const { config, log, fightLog, fx, ...rest } = s;
    const c = JSON.parse(JSON.stringify(rest));
    c.config = config; c.log = []; c.fightLog = []; c.fx = [];
    return c;
  }
  const act = (s, a) => BP.Engine.applyAction(s, "host", a, true);
  const energyOf = (s, h) => (s.pool ? s.pool.amount : h.energy);

  // Угроза врага = средний урон по героям за ход (для бонуса за убийство)
  function threat(s, e) {
    const acts = s.config.enemies[e.type].actions;
    let sum = 0;
    acts.forEach((a) => {
      if (a.type === "attack") sum += a.damage * (a.hits || 1) * (a.targets || 1);
      if (a.type === "curse") sum += a.amount * 2 * (a.targets || 1);
    });
    return sum / acts.length;
  }

  // Все допустимые цели карты. smart: все повороты, дубли фигур (одинаковый набор врагов) убираются.
  function targetsFor(s, hero, card, allRots) {
    const C = BP.Cards, r = s.config.rules;
    switch (card.target) {
      case "none": case "self": return [{}];
      case "hero": case "ally":
        return s.heroes.filter((h) => h.alive && (card.target === "hero" || h.id !== hero.id)).map((h) => ({ hero: h.id }));
      case "enemy": {
        const out = [];
        s.enemies.filter((e) => e.alive).forEach((e) => {
          if (card.attack === "melee" && !C.isExposed(s, e)) return;
          if (C.has(card, "push")) for (let d = 0; d < 6; d++) out.push({ enemy: e.uid, dir: d });
          else out.push({ enemy: e.uid });
        });
        return out;
      }
      case "cell": {
        const out = [], seen = new Set();
        for (let row = 0; row < r.rows; row++) for (let col = 0; col < r.cols; col++) {
          const rots = allRots && C.rotatable(card) ? [0, 1, 2, 3, 4, 5] : [0];
          rots.forEach((rot) => {
            const t = { cell: { col, row }, rot };
            const key = C.areaEnemies(s, hero, card, t).map((e) => e.uid).sort().join(",");
            if (!key || seen.has(key)) return;
            seen.add(key); out.push(t);
          });
        }
        return out;
      }
    }
    return [];
  }

  function playable(s, h) {
    return h.alive ? h.hand.filter((c) => BP.Engine.canPay(s, h, c.cost)) : [];
  }

  // ---------- оценка позиции для smart ----------
  const W = { dmg: 1, killBase: 4, killThreat: 1.0, hp: 1.4, startBlock: 0.6, death: 25, weakNow: 2, weakNext: 1.5, win: 40, wastedBlock: 0.05 };

  // Проигрываем конец хода и ход врагов на копии и считаем «насколько хорошо»
  function evaluate(s) {
    const c = cloneState(s);
    let v = 0;
    c.heroes.forEach((h) => { if (h.alive) v -= BP.Cards.weakness(h) * W.weakNow * Math.min(2, playable(c, h).length); });
    const blockBefore = c.heroes.reduce((a, h) => a + (h.alive ? h.block : 0), 0);
    act(c, { a: "forceEnd" });
    let guard = 0;
    while (c.phase === "enemies" && c.enemyQueue.length && guard++ < 50) BP.Engine.enemyStep(c);
    if (c.phase === "won" || c.phase === "victory") v += W.win;
    c.enemies.forEach((e) => { if (e.alive) v -= e.hp * W.dmg + W.killBase + W.killThreat * threat(c, e); });
    let blockLeft = 0;
    c.heroes.forEach((h, i) => {
      const h0 = s.heroes[i];
      if (!h0.alive) return;
      v -= (h0.hp - h.hp) * W.hp + (h0.startBlock - h.startBlock) * W.startBlock;
      if (!h.alive) v -= W.death;
      else { v -= BP.Cards.weakness(h) * W.weakNext; blockLeft += h.block; }
    });
    v -= Math.min(blockLeft, blockBefore + 99) * W.wastedBlock;
    return v;
  }

  function tryPlay(s, hero, card, target) {
    const c = cloneState(s);
    const err = act(c, { a: "play", hero: hero.id, card: card.uid, target });
    return err ? null : c;
  }

  // Лучшее подмножество карт героя по энергии (перебор, рука маленькая)
  function bestSubset(items, cap) {
    let best = { val: 0, set: [] };
    const n = items.length;
    for (let m = 1; m < 1 << n; m++) {
      let cost = 0, val = 0;
      const set = [];
      for (let i = 0; i < n; i++) if (m & (1 << i)) { cost += items[i].cost; val += items[i].score; set.push(items[i]); }
      if (cost <= cap && val > best.val) best = { val, set };
    }
    return best;
  }

  function smartStep(s) {
    const base = evaluate(s);
    let pick = null;
    for (const h of s.heroes) {
      const items = [];
      playable(s, h).forEach((card) => {
        if (BP.Cards.has(card, "sharedPool")) return;
        let best = null;
        targetsFor(s, h, card, true).forEach((t) => {
          const after = tryPlay(s, h, card, t);
          if (!after) return;
          const sc = evaluate(after) - base;
          if (!best || sc > best.score) best = { hero: h, card, target: t, score: sc, cost: card.cost };
        });
        if (best && best.score > 0.01) items.push(best);
      });
      const sub = bestSubset(items, energyOf(s, h));
      sub.set.forEach((it) => { if (!pick || it.score > pick.score) pick = it; });
    }
    if (pick) { act(s, { a: "play", hero: pick.hero.id, card: pick.card.uid, target: pick.target }); return true; }
    // в конце хода: «Единение», если у кого-то осталась энергия, а у другого — неоплатные карты
    if (!s.pool) {
      const holder = s.heroes.find((h) => h.alive && h.hand.some((c) => BP.Cards.has(c, "sharedPool")));
      const left = s.heroes.reduce((a, h) => a + (h.alive ? h.energy : 0), 0);
      const want = s.heroes.some((h) => h.alive && h.hand.some((c) => c.cost > h.energy && c.cost <= left && !BP.Cards.has(c, "sharedPool")));
      if (holder && want) {
        const card = holder.hand.find((c) => BP.Cards.has(c, "sharedPool"));
        act(s, { a: "play", hero: holder.id, card: card.uid, target: {} });
        return true;
      }
    }
    return false;
  }

  function randomStep(s, allRots) {
    const opts = [];
    s.heroes.forEach((h) => playable(s, h).forEach((card) => opts.push({ h, card })));
    if (!opts.length) return false;
    const o = rand(opts);
    let t;
    if (o.card.target === "cell") {
      // небрежный игрок всё-таки целится во врага, но фигуру не крутит
      const e = rand(s.enemies.filter((x) => x.alive));
      t = { cell: { col: e.col, row: e.row }, rot: allRots ? Math.floor(Math.random() * 6) : 0 };
    } else {
      const ts = targetsFor(s, o.h, o.card, false);
      if (!ts.length) { o.h.hand = o.h.hand.filter((c) => c !== o.card).concat([o.card]); return opts.length > 1; }
      t = rand(ts);
    }
    const err = act(s, { a: "play", hero: o.h.id, card: o.card.uid, target: t });
    if (err) return opts.length > 1 && !playable(s, o.h).every((c) => c === o.card);
    return true;
  }

  const BOT_TURN = {
    smart: (s) => { for (let g = 0; g < 30 && s.phase === "players" && smartStep(s); g++); },
    medium: (s) => {
      for (let g = 0; g < 30 && s.phase === "players"; g++) {
        const ok = Math.random() < 0.35 ? randomStep(s, false) : smartStep(s);
        if (!ok) break;
      }
    },
    sloppy: (s) => {
      for (let g = 0; g < 30 && s.phase === "players"; g++) {
        if (!randomStep(s, false)) break;
      }
    },
  };


  // ---------- один забег ----------
  // Кроме итогов боёв считает по картам: seen — сколько раз карта лежала в руке в начале хода,
  // played — сколько раз сыграна, merged — сколько раз отдана в мердж.
  function runOnce(cfg, bot) {
    const s = BP.Engine.createRun(cfg, { host: { name: "bot" } });
    s.heroes.forEach((h) => (h.owner = "host"));
    act(s, { a: "start" });
    const maxTotal = s.heroes.reduce((a, h) => a + h.maxHp, 0);
    const fights = [], cards = {};
    const cc = (id) => (cards[id] = cards[id] || { seen: 0, played: 0, merged: 0 });
    let cur = { hpStart: s.heroes.reduce((a, h) => a + h.hp, 0) };
    const turnFn = BOT_TURN[bot];
    for (let guard = 0; guard < 400; guard++) {
      if (s.phase === "questPick") { // квест перед боем: бот выбирает случайно
        act(s, { a: "questVote", idx: Math.floor(Math.random() * s.questPick.options.length) });
        act(s, { a: "questStart" });
        continue;
      }
      if (s.phase === "players") {
        if (s.turn > 30) { s.phase = "lost"; continue; }
        s.heroes.forEach((h) => { if (h.alive) h.hand.forEach((c) => cc(c.id).seen++); });
        turnFn(s);
        if (s.phase === "players") {
          s.players.host.ready = false;
          act(s, { a: "ready" });
          while (BP.Engine.enemyStep(s)) {}
        }
        s.log.forEach((l) => { if (l.card) { if (l.merge) cc(l.card).merged++; else cc(l.card).played++; } });
        s.log = []; s.fx = [];
        continue;
      }
      const end = () => {
        const hpEnd = s.heroes.reduce((a, h) => a + (h.alive ? h.hp : 0), 0);
        cur.lost = (cur.hpStart - hpEnd) / maxTotal;
        cur.turns = s.turn;
        cur.deaths = s.heroes.filter((h) => !h.alive).length;
        fights.push(cur);
      };
      if (s.phase === "won") {
        end();
        act(s, { a: "next" });
        cur = { hpStart: s.heroes.reduce((a, h) => a + h.hp, 0) };
        continue;
      }
      end();
      break;
    }
    const win = s.phase === "victory";
    const finalHp = s.heroes.reduce((a, h) => a + (h.alive ? h.hp : 0), 0);
    return { win, fights, cards, runLost: win ? 1 - finalHp / maxTotal : null };
  }

  // ---------- сводка по многим забегам ----------
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

  function summarize(cfg, runs) {
    const nF = cfg.encounters.length;
    const wins = runs.filter((r) => r.win).length;
    const allF = [].concat(...runs.map((r) => r.fights));
    const per = [];
    for (let i = 0; i < nF; i++) {
      const fs = runs.filter((r) => r.fights[i]).map((r) => r.fights[i]);
      const wipes = runs.filter((r) => !r.win && r.fights.length === i + 1).length;
      per.push({ name: cfg.encounters[i].name, reach: fs.length / runs.length, wipe: wipes / runs.length,
        lost: avg(fs.map((f) => f.lost)), turns: avg(fs.map((f) => f.turns)), deaths: avg(fs.map((f) => f.deaths)) });
    }
    const worst = per.slice().sort((a, b) => b.wipe - a.wipe)[0];
    const wl = runs.filter((r) => r.win).map((r) => r.runLost).sort((a, b) => a - b);
    // По картам: perFight — сыграна за бой в среднем; playRate — доля «лежала в руке → сыграна» (главная метка)
    const cards = {};
    runs.forEach((r) => Object.entries(r.cards).forEach(([id, c]) => {
      const t = (cards[id] = cards[id] || { seen: 0, played: 0, merged: 0 });
      t.seen += c.seen; t.played += c.played; t.merged += c.merged;
    }));
    Object.values(cards).forEach((c) => {
      c.perFight = allF.length ? c.played / allF.length : 0;
      c.playRate = c.seen ? Math.min(1, c.played / c.seen) : null;
      c.mergeRate = c.seen ? Math.min(1, c.merged / c.seen) : null;
    });
    return {
      runs: runs.length, winRate: runs.length ? wins / runs.length : 0,
      worstFight: worst && worst.wipe > 0 ? worst.name : null,
      hpPerFight: avg(allF.map((f) => f.lost)),
      runLost: wl.length ? { avg: avg(wl), p10: wl[Math.floor(wl.length * 0.1)], p90: wl[Math.floor(wl.length * 0.9)] } : null,
      turnsPerFight: avg(allF.map((f) => f.turns)),
      deathsPerRun: avg(runs.map((r) => r.fights.reduce((a, f) => a + f.deaths, 0))),
      fights: per, cards,
    };
  }

  // Метка карты по доле «была в руке → сыграна»: почти всегда / норм / почти не берут
  function verdict(c) {
    if (!c || c.playRate === null) return null;
    if (c.playRate >= 0.6) return "good";
    if (c.playRate >= 0.3) return "ok";
    return "bad";
  }

  return { BOTS: Object.keys(BOT_TURN), runOnce, summarize, verdict };
})();
