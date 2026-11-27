// =====================================================================
//  НАПРЯЖЕНИЕ БОЯ (27.11): сколько урона враги замахиваются нанести за ход и сколько блока игроки
//  ставят / могли бы поставить. Ищет слабости «ровный урон без спайков» и «блок всегда перекрывает урон».
//    node tools/tension-sim.js 6 medium --seed 1
//  Таблица по номеру хода в бою: намерения врагов (сумма урона по героям), макс. удар по одному герою,
//  блок пати перед ходом врагов, «блок в руке» (сколько блока пати могла бы поставить, играя только защиту),
//  получено урона. Ниже — доля ходов-спайков (намерения ≥ 1.5 × среднего по бою) и доля защитных карт в колодах.
// =====================================================================
"use strict";
const path = require("path");
global.window = global;
const ROOT = path.join(__dirname, "..");
["config.js", "js/hex.js", "js/cards.js", "js/gifts.js", "js/evolve.js", "js/reinforce.js", "js/foes.js", "js/foes2.js", "js/offer.js", "js/weak.js", "js/deck.js", "js/mech.js", "js/wide.js", "js/wide2.js", "js/engine.js", "js/meta.js", "js/mforge.js", "js/runmap.js", "js/sim.js"].forEach((f) => require(path.join(ROOT, f)));
const BP = global.BP, CFG = global.GAME_CONFIG;
if (process.env.BP_SET) {
  const merge = (o, p) => Object.keys(p).forEach((k) => { if (p[k] && typeof p[k] === "object" && !Array.isArray(p[k]) && o[k]) merge(o[k], p[k]); else o[k] = p[k]; });
  merge(CFG, JSON.parse(process.env.BP_SET));
}
const argv = process.argv.slice(2);
let RUNS = 6, BOT = "medium", SEED = null;
for (let i = 0; i < argv.length; i++) { if (argv[i] === "--seed") SEED = Number(argv[++i]); else if (/^\d+$/.test(argv[i])) RUNS = Number(argv[i]); else BOT = argv[i]; }
if (SEED !== null) { let a = SEED >>> 0; Math.random = function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const blockOfCard = (c) => (c.effects || []).reduce((a, e) => a + (["block", "blockSelf", "blockParty"].includes(e.type) ? (e.amount || 0) * (e.type === "blockParty" ? 3 : 1) : 0), 0);
function handBlock(h) { // жадно: самые выгодные по блоку/энергии карты, пока хватает энергии
  const cs = h.hand.filter((c) => blockOfCard(c) > 0 && !c.unplayable).sort((a, b) => blockOfCard(b) / Math.max(1, b.cost) - blockOfCard(a) / Math.max(1, a.cost));
  let en = h.energy, sum = 0;
  cs.forEach((c) => { if ((c.cost || 0) <= en) { en -= c.cost || 0; sum += blockOfCard(c); } });
  return sum;
}
function intentDmg(s) {
  let total = 0, maxOne = 0; const per = {};
  s.enemies.forEach((e) => {
    const it = e.alive && e.intent; if (!it || it.type !== "attack") return;
    const d = (it.damage || 0) * (it.hits || 1);
    (it.targets || []).forEach((t) => { per[t] = (per[t] || 0) + d; total += d; });
  });
  Object.values(per).forEach((v) => (maxOne = Math.max(maxOne, v)));
  return { total, maxOne };
}

const rows = {}; const fightsLog = [];
const row = (t) => (rows[t] = rows[t] || { n: 0, intent: 0, maxOne: 0, block: 0, handBlock: 0, taken: 0, over: 0 });
let curTurn = null, curFight = null;
const origApply = BP.Engine.applyAction, origStep = BP.Engine.enemyStep;
BP.Engine.applyAction = function (s, pid, a) {
  if (s.phase === "players") {
    const key = s.fightIndex + ":" + s.turn;
    if (!curTurn || curTurn.key !== key) {
      if (!curFight || curFight.idx !== s.fightIndex + ":" + (s.enc && s.enc.name)) { curFight = { idx: s.fightIndex + ":" + (s.enc && s.enc.name), kind: s.enc && s.enc.kind, turns: [] }; fightsLog.push(curFight); }
      const al = s.heroes.filter((h) => h.alive);
      curTurn = { key, turn: s.turn, hb: al.reduce((x, h) => x + handBlock(h), 0), hp0: s.heroes.reduce((x, h) => x + (h.alive ? h.hp : 0), 0), done: false };
    }
  }
  return origApply.apply(this, arguments);
};
BP.Engine.enemyStep = function (s) {
  if (s.phase === "enemies" && curTurn && !curTurn.done) {
    curTurn.done = true;
    const it = intentDmg(s), r = row(Math.min(curTurn.turn, 9));
    const blk = s.heroes.reduce((x, h) => x + (h.alive ? h.block + (h.startBlock || 0) : 0), 0);
    r.n++; r.intent += it.total; r.maxOne += it.maxOne; r.block += blk; r.handBlock += curTurn.hb;
    if (curTurn.hb >= it.total) r.over++;
    curTurn.intent = it.total; curFight.turns.push(curTurn);
  }
  const res = origStep.apply(this, arguments);
  if (curTurn && curTurn.done && s.phase !== "enemies" && curTurn.hp1 === undefined) {
    curTurn.hp1 = s.heroes.reduce((x, h) => x + (h.alive ? h.hp : 0), 0);
    row(Math.min(curTurn.turn, 9)).taken += Math.max(0, curTurn.hp0 - curTurn.hp1);
  }
  return res;
};

const decks = [];
for (let i = 0; i < RUNS; i++) {
  const r = BP.Sim.runOnce(CFG, BOT);
  decks.push(r);
}
const f1 = (x) => x.toFixed(1);
console.log(`\n=== Напряжение (${BOT}, ${RUNS} забегов) ===`);
console.log("ход  N     намерения  макс.по1  блок пати  блок в руке  получено  руки≥урона");
Object.keys(rows).sort((a, b) => a - b).forEach((t) => {
  const r = rows[t];
  console.log(`${String(t == 9 ? "9+" : t).padEnd(5)}${String(r.n).padEnd(6)}${f1(r.intent / r.n).padEnd(11)}${f1(r.maxOne / r.n).padEnd(10)}${f1(r.block / r.n).padEnd(11)}${f1(r.handBlock / r.n).padEnd(13)}${f1(r.taken / r.n).padEnd(10)}${Math.round(100 * r.over / r.n)}%`);
});
let spikes = 0, turnsAll = 0, peaks = [];
fightsLog.forEach((f) => {
  const ts = f.turns.filter((t) => t.intent !== undefined); if (!ts.length) return;
  const avg = ts.reduce((a, t) => a + t.intent, 0) / ts.length;
  ts.forEach((t) => { turnsAll++; if (avg > 0 && t.intent >= 1.5 * avg) spikes++; });
  peaks.push(Math.max(...ts.map((t) => t.intent)) / Math.max(1, avg));
});
console.log(`Ходов-спайков (≥1.5× среднего по бою): ${Math.round(100 * spikes / Math.max(1, turnsAll))}% | пик / среднее по бою: ${f1(peaks.reduce((a, b) => a + b, 0) / Math.max(1, peaks.length))}`);
console.log(`Побед: ${decks.filter((d) => d.win).length}/${RUNS}`);
