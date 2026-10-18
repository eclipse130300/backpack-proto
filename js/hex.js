// Геометрия хекс-поля врагов 6×2 (вид сверху).
// РЕШЕНО (17.10): хексы смотрят на героев ровной стороной («flat-top»). Две клетки колонки стоят строго
// друг за другом: row 0 — передний ряд (ближе к героям, внизу экрана), row 1 — задний (прямо за ним).
// Соседние колонки сдвинуты на полхекса: колонки 0, 2, 4 (1, 3, 5 при счёте с единицы) ближе к героям, 1, 3, 5 — дальше.
// Единица длины — ширина хекса (от угла до угла). Шаг колонок 0.75, высота хекса ROW_H.
window.BP = window.BP || {};

BP.Hex = (function () {
  const ROW_H = 0.866; // высота ряда в "ширинах хекса"

  // 6 сторон хекса (угол в градусах, 90 = назад, к заднему ряду; 270 = вперёд, к героям). Чистых «влево/вправо» нет.
  const DIRS = [
    { id: 0, angle: 30, label: "↗", name: "назад-вправо" },
    { id: 1, angle: 90, label: "↑", name: "назад" },
    { id: 2, angle: 150, label: "↖", name: "назад-влево" },
    { id: 3, angle: 210, label: "↙", name: "вперёд-влево" },
    { id: 4, angle: 270, label: "↓", name: "вперёд" },
    { id: 5, angle: 330, label: "↘", name: "вперёд-вправо" },
  ];

  const colX = (col) => col * 0.75;
  function center(col, row) {
    return { x: colX(col), y: row * ROW_H + (Math.abs(col) % 2 === 1 ? ROW_H / 2 : 0) };
  }

  // Позиция героя i (0..2) под полем: каждый герой "стоит" под двумя колонками (своим коридором).
  function heroPos(i, cols) {
    const per = cols / 3;
    return { x: (colX(i * per) + colX(i * per + per - 1)) / 2, y: -1.4 };
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
    return cellAt(p.x + ROW_H * Math.cos(a), p.y + ROW_H * Math.sin(a), cols, rows);
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
  // Клетки за краем поля отбрасываются. Путь считается геометрически: промежуточные шаги могут выходить за край.
  function shapeCells(col, row, steps, rot, cols, rows) {
    const out = [];
    (steps || [[]]).forEach((path) => {
      let p = center(col, row);
      for (const s of path) {
        const a = (DIRS[(((rot || 0) + s) % 6 + 6) % 6].angle * Math.PI) / 180;
        p = { x: p.x + ROW_H * Math.cos(a), y: p.y + ROW_H * Math.sin(a) };
      }
      const c = cellAt(p.x, p.y, cols, rows);
      if (c && !out.some((o) => o.col === c.col && o.row === c.row)) out.push(c);
    });
    return out;
  }

  // Клетки фигуры за краем поля (для подсказки: хексы с красным ✕). Координаты «виртуальные»: col < 0, row ≥ rows и т.д.
  function virtualAt(x, y) {
    const col = Math.round(x / 0.75);
    const row = Math.round((y - (Math.abs(col) % 2 === 1 ? ROW_H / 2 : 0)) / ROW_H);
    return { col, row };
  }
  function shapeCellsOff(col, row, steps, rot, cols, rows) {
    const out = [];
    (steps || [[]]).forEach((path) => {
      let p = center(col, row);
      for (const s of path) {
        const a = (DIRS[(((rot || 0) + s) % 6 + 6) % 6].angle * Math.PI) / 180;
        p = { x: p.x + ROW_H * Math.cos(a), y: p.y + ROW_H * Math.sin(a) };
      }
      const v = virtualAt(p.x, p.y);
      if (v.col >= 0 && v.col < cols && v.row >= 0 && v.row < rows) return;
      if (!out.some((o) => o.col === v.col && o.row === v.row)) out.push(v);
    });
    return out;
  }

  // Клетка «впереди» (ближе к героям): для заднего ряда — передняя клетка той же колонки.
  function frontCells(col, row) {
    return row === 0 ? [] : [{ col, row: row - 1 }];
  }

  // Коридор (0..2) для колонки: по cols/3 колонки на героя
  function laneOf(col, cols) { return Math.min(2, Math.floor(col / (cols / 3))); }

  return { DIRS, colX, center, heroPos, neighbor, neighbors, dirFromPoint, shapeCells, shapeCellsOff, frontCells, laneOf, ROW_H };
})();
