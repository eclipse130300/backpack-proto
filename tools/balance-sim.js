// =====================================================================
//  СИМУЛЯТОР БАЛАНСА (боты играют сотни забегов без браузера)
//
//  Как запустить (нужен Node.js, https://nodejs.org — поставить LTS):
//    1) открыть терминал в папке репозитория (где лежит config.js);
//    2) node tools/balance-sim.js            — по 300 забегов каждым ботом;
//       node tools/balance-sim.js 1000       — по 1000 забегов;
//       node tools/balance-sim.js 300 smart  — только один бот (smart | medium | sloppy);
//       добавить --seed 42, чтобы результаты повторялись от запуска к запуску.
//  300 забегов smart идут ~3–4 минуты (он перебирает все ходы), medium/sloppy — быстрее.
//  Скрипт читает тот же config.js и те же правила (js/engine.js), что и игра,
//  поэтому после правки конфига достаточно перезапустить его. Игру он не меняет.
//
//  Боты:
//    smart  — «аккуратный игрок»: перебирает каждую карту × каждую цель (и повороты фигур),
//             проигрывает ход врагов на копии состояния и выбирает лучшее: урон, убийства,
//             сколько урона по героям удалось предотвратить (блок, оглушение, вызов).
//    medium — тот же smart, но ~35% решений принимает наугад (средний игрок).
//    sloppy — «небрежный игрок»: случайные карты на случайные цели, не смотрит на намерения
//             врагов, не крутит фигуры массовых атак, блок кидает только случайно.
//
//  Что значат числа в таблице:
//    Победа      — % забегов, где пройдены все бои;
//    Вайп        — % забегов, где пала вся пати (и в каком бою это случилось чаще всего);
//    ХП/бой      — сколько % от суммарного макс. ХП пати теряется за бой (в среднем);
//    ХП за забег — сколько % суммарного макс. ХП пати не хватает в конце забега (только у победивших,
//                  у проигравших — «—»). В скобках разброс: 10% самых удачных и 10% самых тяжёлых побед;
//    Карт за бой — сколько раз в среднем за бой сыграна каждая карта (видно, что бот считает полезным);
//    Ходов/бой   — средняя длина боя в ходах;
//    Смертей     — сколько раз за забег падал герой (в среднем).
//  Ниже общей таблицы — разбивка по боям: дошли (%), вайп в этом бою (%), ХП потеряно, ходы, смерти.
// =====================================================================
"use strict";
const path = require("path");
global.window = global;
const ROOT = path.join(__dirname, "..");
["config.js", "js/hex.js", "js/cards.js", "js/deck.js", "js/engine.js"].forEach((f) => require(path.join(ROOT, f)));
const BP = global.BP, CFG = global.GAME_CONFIG;

// ---------- аргументы ----------
const argv = process.argv.slice(2);
let RUNS = 300, SEED = null;
const BOTS = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--seed") SEED = Number(argv[++i]);
  else if (/^\d+$/.test(argv[i])) RUNS = Number(argv[i]);
  else BOTS.push(argv[i]);
}
if (!BOTS.length) BOTS.push("smart", "medium", "sloppy");

// Повторяемый случайный генератор (подменяет Math.random и в движке тоже)
if (SEED !== null) {
  let a = SEED >>> 0;
  Math.random = function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
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
  // квест-карты бесплатны и без штрафа за провал — играем сразу
  for (const h of s.heroes) {
    if (!h.alive) continue;
    const q = h.hand.find((c) => BP.Cards.has(c, "quest") && BP.Engine.canPay(s, h, c.cost));
    if (q) { act(s, { a: "play", hero: h.id, card: q.uid, target: {} }); return true; }
  }
  const base = evaluate(s);
  let pick = null;
  for (const h of s.heroes) {
    const items = [];
    playable(s, h).forEach((card) => {
      if (BP.Cards.has(card, "sharedPool") || BP.Cards.has(card, "quest")) return;
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
function runOnce(bot) {
  const s = BP.Engine.createRun(CFG, { host: { name: "bot" } });
  s.heroes.forEach((h) => (h.owner = "host"));
  act(s, { a: "start" });
  const maxTotal = s.heroes.reduce((a, h) => a + h.maxHp, 0);
  const fights = [], usage = {};
  let cur = { hpStart: s.heroes.reduce((a, h) => a + h.hp, 0) };
  const turnFn = BOT_TURN[bot];
  for (let guard = 0; guard < 400; guard++) {
    if (s.phase === "players") {
      if (s.turn > 30) { s.phase = "lost"; continue; }
      turnFn(s);
      if (s.phase === "players") {
        s.players.host.ready = false;
        act(s, { a: "ready" });
        while (BP.Engine.enemyStep(s)) {}
      }
      s.log.forEach((l) => { if (l.card && !l.merge) usage[l.card] = (usage[l.card] || 0) + 1; });
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
  return { win, fights, usage, runLost: win ? 1 - finalHp / maxTotal : null };
}

// ---------- отчёт ----------
const pct = (x) => (x * 100).toFixed(0) + "%";
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pad = (x, n) => String(x).padEnd(n);

function report(bot, runs) {
  const nF = CFG.encounters.length;
  const wins = runs.filter((r) => r.win).length;
  const allF = [].concat(...runs.map((r) => r.fights));
  const deathsRun = avg(runs.map((r) => r.fights.reduce((a, f) => a + f.deaths, 0)));
  const per = [];
  for (let i = 0; i < nF; i++) {
    const fs = runs.filter((r) => r.fights[i]).map((r) => r.fights[i]);
    const wipes = runs.filter((r) => !r.win && r.fights.length === i + 1).length;
    per.push({ name: CFG.encounters[i].name, reach: fs.length / runs.length, wipe: wipes / runs.length,
      lost: avg(fs.map((f) => f.lost)), turns: avg(fs.map((f) => f.turns)), deaths: avg(fs.map((f) => f.deaths)) });
  }
  const worst = per.slice().sort((a, b) => b.wipe - a.wipe)[0];
  console.log(`\n=== ${bot} (${runs.length} забегов) ===`);
  console.log(`Победа ${pct(wins / runs.length)} | Вайп ${pct(1 - wins / runs.length)}${worst && worst.wipe > 0 ? ` (чаще всего в «${worst.name}»)` : ""}`);
  const wl = runs.filter((r) => r.win).map((r) => r.runLost).sort((a, b) => a - b);
  const runLostTxt = wl.length ? `${pct(avg(wl))} (от ${pct(wl[Math.floor(wl.length * 0.1)])} до ${pct(wl[Math.floor(wl.length * 0.9)])})` : "—";
  console.log(`ХП/бой ${pct(avg(allF.map((f) => f.lost)))} | ХП за забег (победы) ${runLostTxt} | Ходов/бой ${avg(allF.map((f) => f.turns)).toFixed(1)} | Смертей за забег ${deathsRun.toFixed(2)}`);
  console.log("  " + pad("Бой", 26) + pad("дошли", 8) + pad("вайп", 8) + pad("ХП-%", 8) + pad("ходы", 7) + "смерти");
  per.forEach((p, i) => console.log("  " + pad(`${i + 1}. ${p.name}`, 26) + pad(pct(p.reach), 8) + pad(pct(p.wipe), 8) + pad(pct(p.lost), 8) + pad(p.turns.toFixed(1), 7) + p.deaths.toFixed(2)));
  // Сколько раз карта сыграна за бой (в среднем): видно, какие карты бот считает полезными
  const use = {};
  runs.forEach((r) => Object.entries(r.usage).forEach(([k, n]) => (use[k] = (use[k] || 0) + n)));
  const line = Object.entries(use).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${(n / allF.length).toFixed(2)}`).join(", ");
  console.log("  Карт за бой: " + line);
}

const t0 = Date.now();
BOTS.forEach((bot) => {
  if (!BOT_TURN[bot]) { console.log("Нет такого бота: " + bot + " (есть smart, medium, sloppy)"); return; }
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(runOnce(bot));
  report(bot, runs);
});
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)} с)`);
