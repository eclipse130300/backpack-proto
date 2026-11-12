// Карта похода (ветка beta-meta, 11.11) — простая, как в Slay the Spire, генерируется каждый забег (config.meta.map).
// Этажи снизу вверх, на этаже width узлов (дорожки). Из узла можно пойти на тот же или соседний узел следующего этажа.
// Узлы: w2 / w3 (бой на 2 / 3 волны), elite (4 волны, награда лучше), camp (костёр), forge (кузница), treasure (сокровище), boss.
// Голосование: каждый игрок с героями голосует за доступный узел; больше голосов — туда; ничья — жребий (в UI рулетка).
// Хост после анимации шлёт mapGo — пати входит в узел. Бои собираются из волн (config.meta.waves) — js/reinforce.js.
window.BP = window.BP || {};

BP.RunMap = (function () {
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const PICK_MS = { single: 1100, tie: 3000 };

  function pickWeighted(w) {
    const ent = Object.entries(w), sum = ent.reduce((a, [, v]) => a + v, 0);
    let r = Math.random() * sum;
    for (const [k, v] of ent) { r -= v; if (r < 0) return k; }
    return ent[0][0];
  }

  // ---------- Генерация ----------
  function generate(cfg) {
    const mc = cfg.meta.map, F = mc.floors, W = mc.width, floors = [];
    for (let f = 1; f <= F; f++) {
      const row = [];
      for (let x = 0; x < W; x++) {
        let type;
        if (f <= 2) type = "w2";
        else if (f === F) type = "camp";
        else if (f === mc.campFloor) type = x === Math.floor(W / 2) ? "w3" : "camp";
        else {
          const w = Object.assign({}, mc.weights);
          if (f < mc.eliteFrom) delete w.elite;
          type = pickWeighted(w);
        }
        row.push({ id: `n${f}_${x}`, f, x, type, next: [] });
      }
      floors.push(row);
    }
    // кузницы — на случайные обычные узлы этажей 3..F−1 (не на соседних этажах одной дорожки)
    const spots = shuffle([].concat(...floors.filter((r) => r[0].f >= 3 && r[0].f < F && r[0].f !== mc.campFloor)).filter((n) => n.type !== "elite"));
    let placed = 0;
    for (const n of spots) {
      if (placed >= (mc.forges || 0)) break;
      if (floors.some((r) => r.some((m) => m.type === "forge" && Math.abs(m.f - n.f) <= 1))) continue;
      n.type = "forge"; placed++;
    }
    // связи: из x — на x−1 / x / x+1 следующего этажа; у каждого узла хотя бы один выход и вход
    for (let i = 0; i < floors.length - 1; i++) {
      const cur = floors[i], nxt = floors[i + 1];
      cur.forEach((n) => {
        const opts = [n.x - 1, n.x, n.x + 1].filter((x) => x >= 0 && x < W);
        n.next = opts.filter((x) => x === n.x || Math.random() < 0.45).map((x) => nxt[x].id);
      });
      nxt.forEach((m) => { if (!cur.some((n) => n.next.includes(m.id))) { const src = cur.find((n) => n.x === m.x) || cur[0]; src.next.push(m.id); } });
    }
    placeMforges(floors, mc);
    const boss = { id: "boss", f: F + 1, x: Math.floor(W / 2), type: "boss", next: [] };
    floors[floors.length - 1].forEach((n) => (n.next = ["boss"]));
    floors.push([boss]);
    return { floors };
  }

  // Мердж-кузни (11.11): узел сразу за элитой (тот же x, следующий этаж), входы — только из элиты.
  // Элит меньше mforges — недостающие ставятся на обычные бои этажей eliteFrom..F−2.
  function placeMforges(floors, mc) {
    const F = mc.floors, ok = (n) => n.f >= mc.eliteFrom && n.f <= F - 2;
    const all = [].concat(...floors);
    let elites = all.filter((n) => n.type === "elite" && ok(n));
    const free = shuffle(all.filter((n) => ok(n) && (n.type === "w2" || n.type === "w3")));
    while (elites.length < (mc.mforges || 0) && free.length) { const n = free.pop(); n.type = "elite"; elites.push(n); }
    let placed = 0;
    for (const e of shuffle(elites)) {
      if (placed >= (mc.mforges || 0)) break;
      const nxt = floors[e.f], t = nxt[e.x];
      if (t.type === "mforge" || t.type === "elite") continue;
      t.type = "mforge"; placed++;
      if (!e.next.includes(t.id)) e.next.push(t.id);
      floors[e.f - 1].forEach((n) => {
        if (n.type === "elite") return;
        n.next = n.next.filter((id) => id !== t.id);
        if (!n.next.length) { const alt = nxt.filter((m) => m.type !== "mforge" && Math.abs(m.x - n.x) <= 1); n.next.push((alt[0] || nxt.find((m) => m.type !== "mforge") || t).id); }
      });
    }
    // у каждого узла следующего этажа должен остаться вход
    for (let i = 0; i < floors.length - 1; i++) floors[i + 1].forEach((m) => {
      if (!floors[i].some((n) => n.next.includes(m.id))) { const src = floors[i].find((n) => n.x === m.x && (m.type !== "mforge" || n.type === "elite")); if (src) src.next.push(m.id); }
    });
  }

  const nodes = (map) => [].concat(...map.floors);
  const node = (state, id) => nodes(state.run.map).find((n) => n.id === id);

  // Куда можно пойти сейчас
  function options(state) {
    const run = state.run;
    if (!run.node) return run.map.floors[0].map((n) => n.id);
    const cur = node(state, run.node);
    return cur ? cur.next.slice() : [];
  }

  // ---------- Голосование ----------
  function openVote(state) {
    state.phase = "map";
    state.run.vote = { votes: {}, result: null };
    Object.values(state.players).forEach((p) => (p.ready = false));
  }

  function vote(state, pid, id) {
    const v = state.run.vote;
    if (!v || v.result) return "Путь уже выбран";
    if (!options(state).includes(id)) return "Туда не пройти";
    v.votes[pid] = id;
    const req = BP.Engine.metaPlayers(state);
    if (req.every((p) => v.votes[p] !== undefined)) resolve(state);
    return null;
  }

  function resolve(state) {
    const v = state.run.vote, count = {};
    Object.values(v.votes).forEach((id) => (count[id] = (count[id] || 0) + 1));
    const max = Math.max(...Object.values(count));
    const tied = Object.keys(count).filter((id) => count[id] === max);
    const winner = rand(tied);
    v.result = { id: state.seq++, winner, tied, ms: tied.length > 1 ? PICK_MS.tie : PICK_MS.single };
    BP.Engine.log(state, "Пати", `идёт: ${label(node(state, winner).type)}${tied.length > 1 ? " (ничья — решил жребий)" : ""}`);
  }

  // ---------- Вход в узел ----------
  function go(state) {
    const v = state.run.vote;
    if (!v || !v.result) return "Путь ещё не выбран";
    const n = node(state, v.result.winner);
    state.run.node = n.id; state.run.visited.push(n.id); state.run.floor = n.f; state.run.vote = null;
    Object.values(state.players).forEach((p) => (p.ready = false));
    state.reward = null; state.forge = null; state.mforge = null; state.campResult = null;
    if (["w2", "w3", "elite", "boss"].includes(n.type)) { BP.Engine.startFight(state, makeEncounter(state, n)); return null; }
    if (n.type === "camp") { state.phase = "camp"; BP.Meta.camp(state); return null; }
    if (n.type === "forge") { state.phase = "forge"; state.forge = { done: {} }; BP.Meta.refreshView(state); return null; }
    if (n.type === "mforge") { state.phase = "mforge"; state.mforge = { done: {} }; BP.Meta.refreshView(state); return null; }
    if (n.type === "treasure") { state.phase = "reward"; BP.Meta.makeReward(state, "treasure"); return null; }
    return "Неизвестный узел";
  }

  // ---------- Бой из волн ----------
  // Мили — в передний ряд, дальники — назад (за мили, если можно). Босс и Громила — по центру.
  function place(state, types) {
    const r = state.config.rules, en = state.config.enemies, out = [], taken = new Set();
    const free = (c, rw) => !taken.has(c + ":" + rw);
    const sorted = types.slice().sort((a, b) => (en[b].hp || 0) - (en[a].hp || 0));
    sorted.forEach((t) => {
      const melee = !!en[t].melee;
      let cell = null;
      const center = [2, 3, 1, 4, 0, 5];
      const cols = t === "priest" || t === "brute" ? center : shuffle([0, 1, 2, 3, 4, 5]);
      if (melee) { const c = cols.find((c) => free(c, 0)); if (c !== undefined) cell = { col: c, row: 0 }; }
      else {
        const behind = cols.find((c) => free(c, 1) && taken.has(c + ":0"));
        const c = behind !== undefined ? behind : cols.find((c) => free(c, 1));
        if (c !== undefined) cell = { col: c, row: 1 };
      }
      if (!cell) { for (let rw = 0; rw < r.rows && !cell; rw++) { const c = cols.find((c) => free(c, rw)); if (c !== undefined) cell = { col: c, row: rw }; } }
      if (!cell) return;
      taken.add(cell.col + ":" + cell.row);
      out.push({ type: t, col: cell.col, row: cell.row });
    });
    return out;
  }

  // merge-7: вид обычного боя (config.meta.flavors) — смешанный / «толстые» / «рой», по весам
  function pickFlavor(m, type) {
    const fl = m.flavors || {}, ids = Object.keys(fl).filter((k) => (fl[k].on || []).includes(type));
    if (!ids.length) return null;
    let x = Math.random() * ids.reduce((a, k) => a + fl[k].weight, 0);
    for (const k of ids) { x -= fl[k].weight; if (x < 0) return Object.assign({ id: k }, fl[k]); }
    return Object.assign({ id: ids[0] }, fl[ids[0]]);
  }

  function makeEncounter(state, n) {
    const m = state.config.meta, fc = m.fights[n.type], wv = m.waves, fl = pickFlavor(m, n.type);
    const first = rand(wv[(fl && fl.first) || fc.first || "first"]);
    const rest = [];
    for (let i = 1; i < fc.waves; i++) rest.push(rand(wv[(fl && fl.next) || "next"]));
    return { kind: n.type, name: fc.name + (fl && fl.name ? " · " + fl.name : ""), flavor: fl ? fl.id : null, floor: n.f, enemies: place(state, first), waves: rest,
      hpMult: (m.enemyHp || 1) * ((fl && fl.hp) || 1) * (1 + (m.hpPerFloor || 0) * Math.max(0, n.f - 1)),
      dmgMult: (m.enemyDmg || 1) * ((fl && fl.dmg) || 1) * (1 + (m.dmgPerFloor || 0) * Math.max(0, n.f - 1)) };
  }

  // После победы: босс — конец забега, иначе награда
  function afterWin(state) {
    const n = node(state, state.run.node);
    state.run.fights++;
    if (!n || n.type === "boss") return "victory";
    BP.Meta.makeReward(state, n.type === "elite" ? "elite" : "fight");
    return "reward";
  }

  const LABEL = { w2: "Стычка · 2 волны", w3: "Бой · 3 волны", elite: "Элита · 4 волны", camp: "Костёр", forge: "Кузница", mforge: "Мердж-кузня", treasure: "Сокровище", boss: "Босс" };
  const ICON = { w2: "⚔", w3: "⚔⚔", elite: "💀", camp: "🔥", forge: "⚒", mforge: "✦", treasure: "💎", boss: "👑" };
  const label = (t) => LABEL[t] || t;

  return { generate, options, openVote, vote, go, node, nodes, afterWin, makeEncounter, label, ICON, PICK_MS };
})();
