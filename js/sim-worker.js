// Фоновый поток симулятора для страницы «Карты»: считает забеги, пока страница остаётся отзывчивой.
// Получает {cfg, bot, runs}, присылает {type:"progress", done} после каждого забега и {type:"done", summary} в конце.
self.window = self;
importScripts("hex.js", "cards.js", "gifts.js", "evolve.js", "reinforce.js", "weak.js", "deck.js", "mech.js", "engine.js", "quests.js", "sim.js");

self.onmessage = (ev) => {
  const { cfg, bot, runs } = ev.data;
  const out = [];
  for (let i = 0; i < runs; i++) {
    out.push(BP.Sim.runOnce(cfg, bot));
    self.postMessage({ type: "progress", done: i + 1 });
  }
  self.postMessage({ type: "done", summary: BP.Sim.summarize(cfg, out) });
};
