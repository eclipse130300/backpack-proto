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
//    Карт за бой — сколько раз в среднем за бой сыграна каждая карта; в скобках — как часто карта сыграна,
//                  когда лежала в руке (≥60% — берут почти всегда, <30% — почти не берут, подозрение на слабую);
//    Ходов/бой   — средняя длина боя в ходах;
//    Смертей     — сколько раз за забег падал герой (в среднем).
//  Ниже общей таблицы — разбивка по боям: дошли (%), вайп в этом бою (%), ХП потеряно, ходы, смерти.
//  То же самое без установки Node — страница «Карты» (cards.html), кнопка «Прогнать ботов».
//  Сами боты лежат в js/sim.js (общий код для этой команды и для страницы).
// =====================================================================
"use strict";
const path = require("path");
global.window = global;
const ROOT = path.join(__dirname, "..");
["config.js", "js/hex.js", "js/cards.js", "js/gifts.js", "js/weak.js", "js/deck.js", "js/engine.js", "js/quests.js", "js/sim.js"].forEach((f) => require(path.join(ROOT, f)));
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

// ---------- отчёт ----------
const pct = (x) => (x * 100).toFixed(0) + "%";
const pad = (x, n) => String(x).padEnd(n);

function report(bot, sum) {
  console.log(`\n=== ${bot} (${sum.runs} забегов) ===`);
  console.log(`Победа ${pct(sum.winRate)} | Вайп ${pct(1 - sum.winRate)}${sum.worstFight ? ` (чаще всего в «${sum.worstFight}»)` : ""}`);
  const rl = sum.runLost ? `${pct(sum.runLost.avg)} (от ${pct(sum.runLost.p10)} до ${pct(sum.runLost.p90)})` : "—";
  console.log(`ХП/бой ${pct(sum.hpPerFight)} | ХП за забег (победы) ${rl} | Ходов/бой ${sum.turnsPerFight.toFixed(1)} | Смертей за забег ${sum.deathsPerRun.toFixed(2)}`);
  console.log(`Мерджей за бой ${(sum.mergesPerFight || 0).toFixed(1)}`);
  console.log("  " + pad("Бой", 26) + pad("дошли", 8) + pad("вайп", 8) + pad("ХП-%", 8) + pad("ходы", 7) + "смерти");
  sum.fights.forEach((p, i) => console.log("  " + pad(`${i + 1}. ${p.name}`, 26) + pad(pct(p.reach), 8) + pad(pct(p.wipe), 8) + pad(pct(p.lost), 8) + pad(p.turns.toFixed(1), 7) + p.deaths.toFixed(2)));
  const line = Object.entries(sum.cards).filter(([, c]) => c.played).sort((a, b) => b[1].perFight - a[1].perFight)
    .map(([k, c]) => `${k} ${c.perFight.toFixed(2)}${c.playRate !== null ? ` (${pct(c.playRate)})` : ""}`).join(", ");
  console.log("  Карт за бой: " + line);
}

const t0 = Date.now();
BOTS.forEach((bot) => {
  if (!BP.Sim.BOTS.includes(bot)) { console.log("Нет такого бота: " + bot + " (есть " + BP.Sim.BOTS.join(", ") + ")"); return; }
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(BP.Sim.runOnce(CFG, bot));
  report(bot, BP.Sim.summarize(CFG, runs));
});
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)} с)`);
