// Подкрепления врагов (merge-3, 20.10, эксперимент — tests.reinforcements).
// У боя есть резерв (encounters.*.reserve — типы врагов по порядку). Каждые every ходов выходят perWave врагов:
// сначала на свободные клетки заднего ряда, потом переднего (случайно среди свободных). Нет места — ждут.
// За ход до выхода клетки помечены (state.reinf.marks), над полем счётчик. Поле пустое, а резерв нет — волна выходит сразу.
// Бой выигран, когда пусто и на поле, и в резерве (engine.checkFightEnd спрашивает pending).
window.BP = window.BP || {};

BP.Reinforce = (function () {
  const opts = (state) => state.config.tests.reinforcements || {};
  const isOn = (state) => !!opts(state).enabled;

  function setup(state, enc) {
    const o = opts(state);
    state.reinf = isOn(state) && enc.reserve && enc.reserve.length
      ? { left: enc.reserve.slice(), next: 1 + (o.every || 2), marks: [] } : null;
  }

  const pending = (state) => !!(state.reinf && state.reinf.left.length);

  function freeCells(state) {
    const r = state.config.rules, out = [];
    for (let row = r.rows - 1; row >= 0; row--) {
      const rowCells = [];
      for (let col = 0; col < r.cols; col++) if (!BP.Cards.enemyAt(state, col, row)) rowCells.push({ col, row });
      for (let i = rowCells.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rowCells[i], rowCells[j]] = [rowCells[j], rowCells[i]]; }
      out.push(...rowCells); // задний ряд первым
    }
    return out;
  }

  // Пометить клетки следующей волны
  function plan(state) {
    const rf = state.reinf, n = Math.min(opts(state).perWave || 2, rf.left.length);
    rf.marks = freeCells(state).slice(0, n).map((c, i) => ({ col: c.col, row: c.row, type: rf.left[i] }));
  }

  // Выпустить волну. make(type, col, row) создаёт врага (engine). Возвращает новых врагов.
  function spawn(state, make) {
    const rf = state.reinf, n = Math.min(opts(state).perWave || 2, rf.left.length), out = [];
    const marks = rf.marks.filter((m) => !BP.Cards.enemyAt(state, m.col, m.row));
    const free = freeCells(state).filter((c) => !marks.some((m) => m.col === c.col && m.row === c.row));
    const cells = marks.concat(free);
    for (let i = 0; i < n && cells[i]; i++) out.push(make(rf.left.shift(), cells[i].col, cells[i].row));
    rf.marks = [];
    return out;
  }

  // Начало хода игроков (state.turn уже увеличен): выход волны и разметка следующей
  function onTurnStart(state, make) {
    const rf = state.reinf;
    if (!rf || !rf.left.length) return [];
    let out = [];
    if (state.turn >= rf.next) { out = spawn(state, make); rf.next = state.turn + (opts(state).every || 2); }
    if (rf.left.length && state.turn === rf.next - 1) plan(state);
    return out;
  }

  // Поле очистили раньше — волна выходит сразу, отсчёт до следующей начинается заново
  function spawnNow(state, make) {
    const rf = state.reinf;
    const out = spawn(state, make);
    rf.next = state.turn + (opts(state).every || 2);
    if (rf.left.length && state.turn === rf.next - 1) plan(state);
    return out;
  }

  // card-mechanics-1: врага толкнули/притянули на помеченную клетку — метка переезжает на ближайшую свободную
  // (поиск в ширину по соседям: сначала соседние клетки, потом через одну и т. д.). Свободной нет — метка пропадает.
  function fixMarks(state) {
    const rf = state.reinf;
    if (!rf || !rf.marks || !rf.marks.length) return;
    const r = state.config.rules;
    const taken = (c, self) => !!BP.Cards.enemyAt(state, c.col, c.row) || rf.marks.some((m) => m !== self && m.col === c.col && m.row === c.row);
    rf.marks.forEach((m) => {
      if (!BP.Cards.enemyAt(state, m.col, m.row)) return;
      const seen = new Set([m.col + ":" + m.row]), queue = [{ col: m.col, row: m.row }];
      let found = null;
      while (queue.length && !found) {
        const cur = queue.shift();
        for (const n of BP.Hex.neighbors(cur.col, cur.row, r.cols, r.rows)) {
          const k = n.col + ":" + n.row;
          if (seen.has(k)) continue;
          seen.add(k);
          if (!taken(n, m)) { found = n; break; }
          queue.push(n);
        }
      }
      if (found) { m.col = found.col; m.row = found.row; } else m.gone = true;
    });
    rf.marks = rf.marks.filter((m) => !m.gone);
  }

  // Для счётчика над полем: сколько в резерве и через сколько ходов выход
  function info(state) {
    const rf = state.reinf;
    if (!rf || !rf.left.length) return null;
    return { left: rf.left.length, inTurns: Math.max(1, rf.next - state.turn), marks: rf.marks };
  }

  return { isOn, setup, pending, onTurnStart, spawnNow, info, fixMarks };
})();
