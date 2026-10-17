// Квест боя (tests.fightQuest, 17.10 — заменил карты-квесты «Клятва»).
// В начале боя: случайное условие из config.questConditions и случайная награда из config.questRewards.
// Над полем врагов висит «?»: серый — не выполнен, золотой — выполнен. Условие — на весь бой, с прогрессом.
// Герой, который закрыл условие, сразу получает в руку квестовую карту: одноразовую (exhaust — после розыгрыша
// пропадает) и не сгорающую в конце хода (retain).
window.BP = window.BP || {};

BP.Quests = (function () {
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function rewardAllowed(cfg, cid) {
    const c = cfg.cards[cid];
    if (!c) return false;
    if ((c.effects || []).some((e) => e.type === "sharedPool")) return !!(cfg.tests.sharedPool && cfg.tests.sharedPool.enabled);
    return true;
  }

  function setup(state) {
    const cfg = state.config, t = cfg.tests.fightQuest;
    state.quest = null;
    if (!t || !t.enabled) return;
    const conds = Object.keys(cfg.questConditions || {});
    const rewards = (cfg.questRewards || []).filter((cid) => rewardAllowed(cfg, cid));
    if (!conds.length || !rewards.length) return;
    const id = rand(conds), qc = cfg.questConditions[id], reward = rand(rewards);
    const q = { id, text: qc.text, condition: JSON.parse(JSON.stringify(qc.condition)), reward, done: false, by: null, mark: null };
    if (q.condition.type === "killMarked") {
      const alive = state.enemies.filter((e) => e.alive);
      const m = alive.length ? rand(alive) : null;
      if (m) { q.mark = m.uid; q.markName = m.name; }
    }
    state.quest = q;
  }

  // Прогресс: { cur, need } — для тултипа и проверки
  function progress(state) {
    const q = state.quest, c = q && q.condition;
    if (!c) return null;
    const fs = state.fightStats || {}, ts = state.turnStats || { damageBy: {} };
    switch (c.type) {
      case "killMarked": { const e = state.enemies.find((x) => x.uid === q.mark); return { cur: e && !e.alive ? 1 : 0, need: 1 }; }
      case "aoeHits": return { cur: fs.aoeBest || 0, need: c.count };
      case "collisions": return { cur: fs.collisions || 0, need: c.count };
      case "focusTurn": return { cur: Math.max(0, ...Object.values(ts.damageBy || {}).map((l) => l.length)), need: c.count };
      case "crits": return { cur: fs.crits || 0, need: c.count };
    }
    return null;
  }

  function progressText(state) {
    const q = state.quest, p = progress(state);
    if (!q || !p) return "";
    if (q.done) return `✔ выполнен — карту получил ${q.by}`;
    const c = q.condition;
    switch (c.type) {
      case "killMarked": return `цель: ${q.markName || "враг"} (отмечен 🎯) — ${p.cur ? "убит" : "жив"}`;
      case "aoeHits": return `лучшая массовка за бой: ${Math.min(p.cur, p.need)} из ${p.need} врагов`;
      case "collisions": return `${Math.min(p.cur, p.need)} из ${p.need} столкновений`;
      case "focusTurn": return `в этот ход одного врага ударили ${Math.min(p.cur, p.need)} из ${p.need} героев`;
      case "crits": return `${Math.min(p.cur, p.need)} из ${p.need} критов`;
    }
    return "";
  }

  // После розыгрыша карты: счётчики боя и проверка квеста. Возвращает заметку для лога.
  function afterPlay(state, hero, card, hits) {
    const fs = state.fightStats;
    fs.crits = (fs.crits || 0) + hits.filter((h) => h.crit).length;
    if (card.attack === "aoe") fs.aoeBest = Math.max(fs.aoeBest || 0, new Set(hits.map((h) => h.enemy)).size);
    const q = state.quest;
    if (!q || q.done || !hero.alive) return "";
    const p = progress(state);
    if (!p || p.cur < p.need) return "";
    q.done = true; q.by = hero.name;
    const rc = BP.Engine.makeCard(state, q.reward);
    Object.assign(rc, { owner: hero.id, exhaust: true, retain: true, questCard: true });
    hero.hand.push(rc);
    state.banner = { id: state.seq++, text: `Квест выполнен! ${hero.name} получает «${rc.name}»` };
    BP.Engine.log(state, "Пати", `выполнила квест «${q.text}»`, { detail: `${hero.name} получает «${rc.name}»` });
    return "";
  }

  return { setup, progress, progressText, afterPlay };
})();
