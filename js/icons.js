// Простые картинки для карт и портреты героев (SVG, рисуются цветом currentColor).
// Ключ = поле icon у карты/героя в config.js. Новая иконка: добавить сюда путь в квадрате 64×64.
window.BP = window.BP || {};

BP.Icons = (function () {
  const F = 'fill="currentColor"';
  const S = 'fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  const arrow = (x1, y1, x2, y2) => {
    const a = Math.atan2(y2 - y1, x2 - x1), l = 9;
    const p1 = `${x2 - l * Math.cos(a - 0.5)},${y2 - l * Math.sin(a - 0.5)}`, p2 = `${x2 - l * Math.cos(a + 0.5)},${y2 - l * Math.sin(a + 0.5)}`;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${S}/><polygon points="${x2},${y2} ${p1} ${p2}" ${F}/>`;
  };
  const sword = `<path d="M46 8 L56 8 L56 18 L26 48 L16 38 Z" ${F}/><path d="M12 34 L30 52" ${S}/><path d="M18 46 L8 56" ${S}/>`;
  const shield = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="M32 6 L54 14 L54 30 C54 44 44 54 32 60 C20 54 10 44 10 30 L10 14 Z" ${F}/>`;
  const flame = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="M32 4 C36 16 48 22 48 38 C48 50 40 58 32 58 C24 58 16 50 16 38 C16 30 22 26 24 18 C28 24 28 28 30 30 C32 22 30 12 32 4 Z" ${F}/>`;

  const I = {
    fist: `<rect x="16" y="22" width="32" height="26" rx="6" ${F}/><path d="M24 22 V16 M32 22 V14 M40 22 V16" ${S}/><path d="M8 40 H14 M6 32 H14 M50 30 L58 24 M50 40 L58 44" ${S}/>`,
    slash: `${sword}<path d="M6 30 C18 10 40 4 58 10" ${S} stroke-dasharray="2 6"/>`,
    bash: `${shield(6, 6, 0.8)}<path d="M50 20 H60 M48 32 H62 M50 44 H60" ${S}/>`,
    shield: `${shield(0, 0, 1)}<path d="M32 16 V48 M20 28 H44" stroke="#2a0d0a" stroke-width="4"/>`,
    sweep: `<path d="M6 46 C12 16 52 16 58 46" ${S}/><polygon points="58,48 49,38 62,36" ${F}/><path d="M29 10 H35 V38 H29 Z" ${F}/><path d="M23 40 H41 M32 42 V56" ${S}/>`,
    crush: `<path d="M27 4 H37 V36 H27 Z" ${F}/><path d="M18 36 H46 M32 38 V50" ${S}/><path d="M10 58 H54 M14 52 L6 46 M50 52 L58 46" ${S}/>`,
    bolt: `<path d="M36 4 L14 36 H30 L24 60 L50 24 H34 Z" ${F}/>`,
    fire: flame(0, 0, 1),
    stun: `<path d="M32 32 m-4 0 a4 4 0 1 1 8 0 a9 9 0 1 1 -18 0 a14 14 0 1 1 28 0 a19 19 0 1 1 -38 0" ${S}/><path d="M50 8 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" ${F}/>`,
    flames: `${flame(-2, 14, 0.55)}${flame(17, 8, 0.6)}${flame(36, 14, 0.55)}<path d="M4 60 H60" ${S}/>`,
    nova: `<circle cx="32" cy="32" r="9" ${F}/>` + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const r = (a * Math.PI) / 180; return `<line x1="${32 + 15 * Math.cos(r)}" y1="${32 + 15 * Math.sin(r)}" x2="${32 + 27 * Math.cos(r)}" y2="${32 + 27 * Math.sin(r)}" ${S}/>`; }).join(""),
    arrows: arrow(8, 26, 56, 18) + arrow(8, 46, 56, 38),
    pierce: `<circle cx="28" cy="32" r="7" ${S}/><circle cx="44" cy="32" r="7" ${S}/>` + arrow(4, 32, 60, 32),
    knock: arrow(4, 32, 38, 32) + `<path d="M46 14 C54 24 54 40 46 50 M54 18 C60 26 60 38 54 46" ${S}/>`,
    rain: [10, 24, 38, 52].map((x, i) => arrow(x, 6 + (i % 2) * 8, x, 40 + (i % 2) * 8)).join("") + `<path d="M4 58 H60" ${S}/>`,
    aim: `<circle cx="32" cy="32" r="20" ${S}/><circle cx="32" cy="32" r="5" ${F}/><path d="M32 2 V16 M32 48 V62 M2 32 H16 M48 32 H62" ${S}/>`,
    cover: `${shield(14, 10, 0.75)}<path d="M6 54 C12 40 18 36 24 40" ${S}/><circle cx="12" cy="20" r="6" ${F}/>`,
    taunt: `<path d="M8 22 L30 22 L50 8 V56 L30 42 L8 42 Z" ${F}/><path d="M56 22 L62 18 M56 32 H63 M56 42 L62 46" ${S}/>`,
    purify: `<path d="M32 6 C40 20 48 28 48 40 C48 50 40 58 32 58 C24 58 16 50 16 40 C16 28 24 20 32 6 Z" ${S}/><path d="M32 30 V48 M23 39 H41" ${S}/>`,
    barrier: `<path d="M6 54 C6 24 58 24 58 54" ${S}/><path d="M16 54 C16 34 48 34 48 54" ${S} stroke-dasharray="4 5"/><path d="M2 56 H62" ${S}/>`,
    unity: `<circle cx="22" cy="24" r="12" ${S}/><circle cx="42" cy="24" r="12" ${S}/><circle cx="32" cy="42" r="12" ${S}/>`,
    oath: `<path d="M14 8 H46 C52 8 52 18 46 18 H44 V56 H16 C10 56 10 46 16 46 H18 V18" ${S}/><path d="M24 26 H38 M24 34 H38" ${S}/>`,
    // Портреты героев
    helm: `<path d="M12 56 V28 C12 12 52 12 52 28 V56 L40 56 V40 H24 V56 Z" ${F}/><path d="M18 32 H46" stroke="#2a0d0a" stroke-width="5"/><path d="M32 6 V14" ${S}/>`,
    hat: `<path d="M32 2 L44 40 H20 Z" ${F}/><path d="M6 42 H58" ${S}/><circle cx="32" cy="52" r="8" ${F}/>`,
    hood: `<path d="M32 4 C14 8 10 30 12 58 H52 C54 30 50 8 32 4 Z" ${F}/><path d="M22 36 C24 26 40 26 42 36 C40 46 24 46 22 36 Z" fill="#2a0d0a"/>`,
    enemy: `<circle cx="32" cy="26" r="16" ${F}/><path d="M16 60 C16 44 48 44 48 60" ${F}/><circle cx="26" cy="24" r="3" fill="#2a0d0a"/><circle cx="38" cy="24" r="3" fill="#2a0d0a"/>`,
  };

  function svg(name, cls) {
    const body = I[name] || I.fist;
    return `<svg class="${cls || "icon"}" viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`;
  }

  // Мини-схема фигуры массовки: шестиугольники в клетках фигуры (первая — клетка прицела)
  function shapeSvg(steps, rot) {
    const pts = (steps || [[]]).map((path) => {
      let x = 0, y = 0;
      path.forEach((s) => { const a = ((((rot || 0) + s) % 6) * 60 * Math.PI) / 180; x += Math.cos(a); y -= Math.sin(a); });
      return { x, y };
    });
    const minX = Math.min(...pts.map((p) => p.x)) - 0.6, maxX = Math.max(...pts.map((p) => p.x)) + 0.6;
    const minY = Math.min(...pts.map((p) => p.y)) - 0.6, maxY = Math.max(...pts.map((p) => p.y)) + 0.6;
    const hex = (cx, cy, first) => {
      const p = [0, 1, 2, 3, 4, 5].map((i) => { const a = ((60 * i + 30) * Math.PI) / 180; return `${(cx + 0.55 * Math.cos(a)).toFixed(3)},${(cy + 0.55 * Math.sin(a)).toFixed(3)}`; }).join(" ");
      return `<polygon points="${p}" fill="${first ? "#ff5a3c" : "#b5372f"}" stroke="#1d0b09" stroke-width="0.06"/>`;
    };
    return `<svg class="shape-mini" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}">${pts.map((p, i) => hex(p.x, p.y, i === 0)).join("")}</svg>`;
  }

  return { svg, shapeSvg, list: () => Object.keys(I) };
})();
