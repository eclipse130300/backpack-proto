// Квест боя (tests.fightQuest, 17.10 — заменил карты-квесты «Клятва»).
// Перед боем (фаза questPick): 3 разных случайных условия из config.questConditions, у каждого своя случайная
// награда из config.questRewards. Игроки голосуют (у кого есть живые герои). Больше голосов — этот квест;
// ничья — случайный из лидеров (в UI рулетка). Хост после анимации шлёт questStart — бой начинается.
// Над полем врагов висит «?»: серый — не выполнен, золотой — выполнен. Условие — на весь бой, с прогрессом.
// Герой, который закрыл условие, сразу получает в руку квестовую карту: одноразовую (exhaust) и не сгорающую (retain).
window.BP = window.BP || {};

BP.Quests = (function () {
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const CHOICES = 3;
  // Сколько хост ждёт перед стартом боя после выбора (столько же длится анимация в UI)
  const PICK_MS = { single: 1300, tie: 3400 };

  function rewardAllowed(cfg, cid) {
    const c = cfg.cards[cid];
    if (!c) return false;
    if ((c.effects || []).some((e) => e.type === "sharedPool")) return !!(cfg.tests.sharedPool && cfg.tests.sharedPool.enabled);
    return true;
  }

  function makeQuest(state, id, reward) {
    const qc = state.config.questConditions[id];
    const q = { id, text: qc.text, condition: JSON.parse(JSON.stringify(qc.condition)), reward, done: false, by: null, mark: null };
    if (q.condition.type === "killMarked") {
      const alive = state.enemies.filter((e) => e.alive);
      const m = alive.length ? rand(alive) : null;
      if (m) { q.mark = m.uid; q.markName = m.name; }
    }
    return q;
  }

  // Начало боя: предложить 3 квеста. false — квестов нет (тест выключен), бой начинается сразу.
  function offer(state) {
    const cfg = state.config, t = cfg.tests.fightQuest;
    state.quest = null; state.questPick = null;
    if (!t || !t.enabled) return false;
    const conds = shuffle(Object.keys(cfg.questConditions || {})).slice(0, CHOICES);
    const rewards = shuffle((cfg.questRewards || []).filter((cid) => rewardAllowed(cfg, cid)));
    if (!conds.length || !rewards.length) return false;
    const options = conds.map((id, i) => makeQuest(state, id, rewards[i % rewards.length]));
    state.questPick = { options, votes: {}, result: null };
    return true;
  }

  // Голос игрока (можно передумать, пока не проголосовали все). Когда голосов хватает — итог.
  function vote(state, pid, idx) {
    const qp = state.questPick;
    if (!qp || qp.result) return "Квест уже выбран";
    if (!(idx >= 0 && idx < qp.options.length)) return "Нет такого квеста";
    qp.votes[pid] = idx;
    const req = BP.Engine.requiredPlayers(state);
    if (req.every((p) => qp.votes[p] !== undefined)) resolve(state);
    return null;
  }

  function resolve(state) {
    const qp = state.questPick, count = qp.options.map(() => 0);
    Object.values(qp.votes).forEach((i) => count[i]++);
    const max = Math.max(...count);
    const tied = count.map((c, i) => (c === max ? i : -1)).filter((i) => i >= 0);
    const winner = rand(tied);
    qp.result = { id: state.seq++, winner, tied, ms: tied.length > 1 ? PICK_MS.tie : PICK_MS.single };
    const q = qp.options[winner];
    BP.Engine.log(state, "Пати", `выбрала квест «${q.text}»${tied.length > 1 ? " (ничья — решил жребий)" : ""}`);
  }

  // После анимации: выбранный квест становится квестом боя
  function start(state) {
    const qp = state.questPick;
    if (!qp || !qp.result) return false;
    state.quest = qp.options[qp.result.winner];
    state.questPick = null;
    return true;
  }

  // Прогресс: { cur, need } — для тултипа и проверки
  function progress(state, quest) {
    const q = quest || state.quest, c = q && q.condition;
    if (!c) return null;
    const fs = state.fightStats || {}, ts = state.turnStats || { damageBy: {} };
    const n = (v) => ({ cur: v || 0, need: c.count || 1 });
    switch (c.type) {
      case "killMarked": { const e = state.enemies.find((x) => x.uid === q.mark); return { cur: e && !e.alive ? 1 : 0, need: 1 }; }
      case "aoeHits": return n(fs.aoeBest);
      case "collisions": return n(fs.collisions);
      case "focusTurn": return n(Math.max(0, ...Object.values(ts.damageBy || {}).map((l) => l.length)));
      case "crits": return n(fs.crits);
      case "stuns": return n(fs.stuns);
      case "killsTurn": return n(ts.kills);
      case "backKills": return n(fs.backKills);
      case "pushes": return n(fs.pushes);
      case "cleanEnemyTurn": return n(fs.cleanTurns);
      case "mergeKills": return n(fs.mergeKills);
      case "weakKills": return n(fs.weakKills);
    }
    return null;
  }

  function progressText(state) {
    const q = state.quest, p = progress(state);
    if (!q || !p) return "";
    if (q.done) return `✔ выполнен — карту получил ${q.by}`;
    const x = `${Math.min(p.cur, p.need)} из ${p.need}`;
    switch (q.condition.type) {
      case "killMarked": return `цель: ${q.markName || "враг"} (отмечен 🎯) — ${p.cur ? "убит" : "жив"}`;
      case "aoeHits": return `лучшая массовка за бой: ${x} врагов`;
      case "collisions": return `${x} столкновений`;
      case "focusTurn": return `в этот ход одного врага ударили ${x} героев`;
      case "crits": return `${x} критов`;
      case "stuns": return `${x} оглушений`;
      case "killsTurn": return `в этот ход убито ${x}`;
      case "backKills": return `${x} прикрытых задних врагов убито`;
      case "pushes": return `${x} толчков`;
      case "cleanEnemyTurn": return "проверяется после каждого хода врагов";
      case "mergeKills": return `${x} убийств картой с ★`;
      case "weakKills": return `${x} убийств слабым ударом`;
    }
    return "";
  }

  // Выдать награду герою, закрывшему условие
  function complete(state, hero) {
    const q = state.quest;
    q.done = true; q.by = hero.name;
    const rc = BP.Engine.makeCard(state, q.reward);
    Object.assign(rc, { owner: hero.id, exhaust: true, retain: true, questCard: true });
    hero.hand.push(rc);
    state.banner = { id: state.seq++, text: `Квест выполнен! ${hero.name} получает «${rc.name}»` };
    BP.Engine.log(state, "Пати", `выполнила квест «${q.text}»`, { detail: `${hero.name} получает «${rc.name}»` });
  }

  function check(state, hero) {
    const q = state.quest;
    if (!q || q.done || !hero || !hero.alive) return;
    const p = progress(state);
    if (p && p.cur >= p.need) complete(state, hero);
  }

  // После розыгрыша карты: счётчики боя и проверка квеста. Возвращает заметку для лога.
  function afterPlay(state, hero, card, hits, target) {
    const fs = state.fightStats, t = target || {};
    fs.crits = (fs.crits || 0) + hits.filter((h) => h.crit).length;
    if (card.attack === "aoe") fs.aoeBest = Math.max(fs.aoeBest || 0, new Set(hits.map((h) => h.enemy)).size);
    const has = (type) => (card.effects || []).some((e) => e.type === type);
    const tgt = t.enemy ? state.enemies.find((e) => e.uid === t.enemy) : null;
    if (has("stun") && tgt && tgt.alive && tgt.stunned) fs.stuns = (fs.stuns || 0) + 1;
    if (has("push") && tgt && tgt.alive) fs.pushes = (fs.pushes || 0) + 1;
    const killed = (state.playKills || []).map((uid) => state.enemies.find((e) => e.uid === uid)).filter(Boolean);
    if (killed.length) {
      // задний закрыт, если прямо перед ним стоит живой враг
      const back = killed.filter((e) => e.row > 0 && BP.Hex.frontCells(e.col, e.row).some((c) => BP.Cards.enemyAt(state, c.col, c.row)));
      fs.backKills = (fs.backKills || 0) + back.length;
      if (card.merged) fs.mergeKills = (fs.mergeKills || 0) + killed.length;
      if (card.weak || card.adaptive) fs.weakKills = (fs.weakKills || 0) + killed.length;
    }
    check(state, hero);
    return "";
  }

  // После хода врагов: «никто не потерял ХП» — награду получает случайный живой герой
  function afterEnemies(state) {
    const q = state.quest, fs = state.fightStats;
    const taken = state.heroes.reduce((a, h) => a + (h.stats ? h.stats.taken : 0), 0);
    const clean = taken === (fs.takenSnap || 0) && state.heroes.every((h) => h.alive);
    fs.takenSnap = taken;
    if (clean) fs.cleanTurns = (fs.cleanTurns || 0) + 1;
    if (!q || q.done || q.condition.type !== "cleanEnemyTurn") return;
    const alive = state.heroes.filter((h) => h.alive);
    if (alive.length) check(state, rand(alive));
  }

  return { offer, vote, start, progress, progressText, afterPlay, afterEnemies, PICK_MS };
})();
