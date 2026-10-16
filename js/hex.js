// Геометрия хекс-поля врагов 6×2 (вид сверху).
// row 0 — передний ряд (ближе к героям, внизу экрана), row 1 — задний (сверху, сдвинут на полхекса вправо).
window.BP = window.BP || {};

BP.Hex = (function () {
  const ROW_H = 0.866; // высота ряда в "ширинах хекса"

  // Направления толчка: 6 сторон, угол в градусах (0 = вправо, 90 = вверх, к заднему ряду)
  const DIRS = [
    { id: 0, angle: 0, label: "→", name: "вправо" },
    { id: 1, angle: 60, label: "↗", name: "вверх-вправо" },
    { id: 2, angle: 120, label: "↖", name: "вверх-влево" },
    { id: 3, angle: 180, label: "←", name: "влево" },
    { id: 4, angle: 240, label: "↙", name: "вниз-влево" },
    { id: 5, angle: 300, label: "↘", name: "вниз-вправо" },
  ];

  function center(col, row) {
    return { x: col + (row === 1 ? 0.5 : 0), y: row * ROW_H };
  }

  // Позиция героя i (0..2) под полем: каждый герой "стоит" под двумя колонками.
  function heroPos(i, cols) {
    const per = cols / 3;
    return { x: i * per + (per - 1) / 2, y: -1.4 };
  }

  function cellAt(x, y, cols, rows) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p = center(c, r);
        if (Math.abs(p.x - x) < 0.2 && Math.abs(p.y - y) < 0.2) return { col: c, row: r };
      }
    }
    return null;
  }

  // Соседняя клетка в направлении dir (0..5) или null, если там край поля.
  function neighbor(col, row, dir, cols, rows) {
    const p = center(col, row);
    const a = (DIRS[dir].angle * Math.PI) / 180;
    return cellAt(p.x + Math.cos(a), p.y + Math.sin(a), cols, rows);
  }

  function neighbors(col, row, cols, rows) {
    const out = [];
    for (let d = 0; d < 6; d++) {
      const n = neighbor(col, row, d, cols, rows);
      if (n) out.push(n);
    }
    return out;
  }

  // Направление (0..5), ближайшее к вектору от точки from к клетке (col,row).
  function dirFromPoint(from, col, row) {
    const p = center(col, row);
    const ang = (Math.atan2(p.y - from.y, p.x - from.x) * 180) / Math.PI;
    let best = 0, bestDiff = 999;
    DIRS.forEach((d) => {
      let diff = Math.abs(((ang - d.angle + 540) % 360) - 180);
      if (diff < bestDiff) { bestDiff = diff; best = d.id; }
    });
    return best;
  }

  // Клетки фигуры массовки. steps — пути от клетки прицела (см. shapes в config.js), rot — поворот 0..5.
  // Клетки за краем поля отбрасываются.
  function shapeCells(col, row, steps, rot, cols, rows) {
    const out = [];
    (steps || [[]]).forEach((path) => {
      let c = { col, row };
      for (const s of path) {
        c = c && neighbor(c.col, c.row, (((rot || 0) + s) % 6 + 6) % 6, cols, rows);
      }
      if (c && !out.some((o) => o.col === c.col && o.row === c.row)) out.push(c);
    });
    return out;
  }

  // Клетки «впереди» (ближе к героям): для заднего ряда — две клетки переднего ряда, между которыми он стоит.
  function frontCells(col, row, cols, rows) {
    if (row === 0) return [];
    return [4, 5].map((d) => neighbor(col, row, d, cols, rows)).filter(Boolean);
  }

  // Коридор (0..2) для колонки: по cols/3 колонки на героя
  function laneOf(col, cols) { return Math.min(2, Math.floor(col / (cols / 3))); }

  return { DIRS, center, heroPos, neighbor, neighbors, dirFromPoint, shapeCells, frontCells, laneOf, ROW_H };
})();
