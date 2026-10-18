// Мердж «дар» (tests.merge.mode = "gift", 18.10).
// Отданная карта передаёт карте союзника:
//   1) свой родной дар (поле gift у карты, таблица config.gifts) и ВСЕ дары, которые сама получила раньше (цепочки);
//   2) атака → атака: +50% своего текущего урона (уже с Мощью и прибавками) — «прибавка». Одиночке — прямо в базовый
//      урон (в каждый удар), массовке — только в клетку прицела. Мощь умножает собственный урон карты, прибавка идёт сверху.
// Отданная карта уходит в сброс ЧИСТОЙ (без даров и прибавки), сыгранная — усиленной. Лимита даров нет.
// Повторы: Мощь/Взрыв/Повтор/Броня/Прикрытие — +50% за каждый (проценты складываются, не перемножаются);
// Толчок: N толчков = N клеток; Цепь: каждая — отдельный прыжок 50% на другого врага;
// Пробой: первый в одиночку — «насквозь», каждый следующий и каждый в массовку — +50% в клетку прицела;
// Добивание: +100% за каждое (×2, ×3…) по врагу с ≤50% ХП; Вызов — только один (второй не отдать).
// Слабые карты дара не имеют — отдать их нельзя. Дробное округляем вверх.
window.BP = window.BP || {};

BP.Gifts = (function () {
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const up = (x) => Math.ceil(x - 1e-9);
  const isBlock = (e) => e.type === "block" || e.type === "blockSelf";

  const isOn = (state) => state.config.tests.merge.mode === "gift";
  const list = (card) => card.gifts || [];
  const count = (card, id) => list(card).filter((g) => g.id === id).length;
  const info = (state, id) => (state.config.gifts || {})[id] || null;

  // Исходный вид карты (до даров)
  function baseOf(card) {
    return card.giftBase || { effects: card.effects || [], attack: card.attack, area: card.area };
  }
  const hasDmg = (card) => baseOf(card).effects.some((e) => e.type === "damage");

  // Подходит ли дар карте (неподходящие дары при передаче просто не ложатся)
  function applicable(giftId, dst) {
    const b = baseOf(dst), has = (t) => b.effects.some((e) => e.type === t);
    const dmg = has("damage"), blk = b.effects.some(isBlock), single = dst.target === "enemy", cell = dst.target === "cell";
    switch (giftId) {
      case "power": case "blast": case "repeat": case "execute": return dmg;
      case "pierce": case "chain": return dmg && (single || cell);
      case "push": return single || cell;
      case "taunt": return single && !has("taunt") && !count(dst, "taunt");
      case "armor": case "cover": return dmg || blk;
    }
    return false;
  }

  // Что отданная карта передаёт: родной дар + все полученные
  function incoming(state, src) {
    if (!src.gift || !info(state, src.gift)) return []; // нет родного дара (слабые карты) — отдать нельзя
    return [{ id: src.gift, from: null }].concat(list(src).map((g) => ({ id: g.id, from: g.from })));
  }

  // Текущий урон карты за розыгрыш по основной цели: урон (с Мощью и прибавкой) × удары; у массовки — плюс прибавка в центр
  function currentDamage(card) {
    const d = (card.effects || []).find((e) => e.type === "damage");
    return d ? d.amount * (d.hits || 1) + (card.target === "cell" ? card.bonus || 0 : 0) : 0;
  }

  function canMerge(state, src, dst) {
    const inc = incoming(state, src);
    if (!inc.length) return false;
    if (hasDmg(src) && hasDmg(dst)) return true; // атака → атака: прибавка урона идёт всегда
    let taunts = 0;
    return inc.some((g) => g.id === "taunt" ? !taunts++ && applicable(g.id, dst) : applicable(g.id, dst));
  }

  function mergeInto(state, src, dst, giverId) {
    if (!canMerge(state, src, dst)) return false;
    if (!dst.giftBase) dst.giftBase = { effects: clone(dst.effects), attack: dst.attack, area: dst.area };
    const add = [];
    incoming(state, src).forEach((g) => {
      const gift = { id: g.id, from: g.from || giverId || null };
      if (applicable(g.id, { target: dst.target, giftBase: dst.giftBase, gifts: list(dst).concat(add) })) add.push(gift);
    });
    if (hasDmg(src) && hasDmg(dst)) dst.bonus = (dst.bonus || 0) + up(currentDamage(src) * 0.5);
    dst.gifts = list(dst).concat(add);
    rebuild(dst);
    dst.merged = dst.gifts.length || 1;
    dst.text = BP.Cards.text(dst);
    clean(src); // отданная карта уходит в сброс чистой
    return true;
  }

  // Снять с карты все дары и прибавку
  function clean(card) {
    if (!card.giftBase) return;
    card.effects = clone(card.giftBase.effects); card.attack = card.giftBase.attack; card.area = card.giftBase.area;
    ["giftBase", "gifts", "bonus", "merged", "blast", "repeat", "execute", "chain", "focus", "pushDist"].forEach((k) => delete card[k]);
    card.text = BP.Cards.text(card);
  }

  // Пересобрать эффекты карты из исходника + всех даров
  function rebuild(card) {
    const b = card.giftBase, n = (id) => count(card, id);
    card.effects = clone(b.effects); card.attack = b.attack; card.area = b.area;
    card.blast = 0.5 * n("blast"); card.repeat = 0.5 * n("repeat");
    card.execute = n("execute"); card.chain = n("chain"); card.focus = 0; card.pushDist = 0;
    const dmg = card.effects.find((e) => e.type === "damage"), blk = card.effects.find(isBlock);
    if (dmg && n("power")) dmg.amount = up(dmg.amount * (1 + 0.5 * n("power")));
    if (dmg && card.bonus && card.target !== "cell") dmg.amount += card.bonus; // прибавка — прямо в базовый урон (не массовкам)
    // Пробой: одиночке без зоны первый даёт «насквозь» (враг за целью 100%), остальные — +50% в клетку прицела
    const p = n("pierce");
    if (p) {
      if (card.target === "enemy" && !b.area) { card.area = "line"; card.focus = 0.5 * (p - 1); }
      else card.focus = 0.5 * p;
    }
    // Толчок: N толчков (свой + дары) = толчок на N клеток. У массовки — враг в клетке прицела, ДО удара.
    if (n("push")) {
      const total = (b.effects.some((e) => e.type === "push") ? 1 : 0) + n("push");
      if (!card.effects.some((e) => e.type === "push")) card.effects.push({ type: "push" });
      if (total > 1) card.pushDist = total;
    }
    if (n("taunt") && !card.effects.some((e) => e.type === "taunt")) card.effects.push({ type: "taunt" });
    if (dmg) {
      const half = (k) => up(dmg.amount * 0.5 * k);
      if (n("armor")) card.effects.push({ type: "blockSelf", amount: half(n("armor")) });
      list(card).filter((g) => g.id === "cover").forEach((g) => card.effects.push({ type: "blockHero", hero: g.from, amount: half(1) }));
    } else if (blk && n("armor") + n("cover")) {
      blk.amount = up(blk.amount * (1 + 0.5 * (n("armor") + n("cover"))));
    }
  }

  // «Добивание»: +100% за каждое по врагу с ≤50% ХП (по ХП до удара). Только собственный урон карты.
  function executeMult(card, e) {
    return card.execute && e.hp * 2 <= e.maxHp ? 1 + card.execute : 1;
  }

  // Доп. удары (без крита): прибавка и Пробой — в основную цель / клетку прицела; Цепь — по 50% на N разных врагов
  // вне зоны (с меньшим ХП); Повтор — ещё удар по тем же целям; Взрыв — соседним с зоной клеткам.
  function extraHits(state, hero, card, target, enemies, amount, hits) {
    const r = state.config.rules, t = target || {};
    const cells = BP.Cards.areaCells(state, hero, card, target);
    const inArea = (c) => cells.some((x) => x.col === c.col && x.row === c.row);
    const push = (e, a) => { if (a > 0) hits.push({ enemy: e.uid, amount: a, crit: false, critReason: "" }); };
    const f = card.target === "enemy" ? state.enemies.find((e) => e.uid === t.enemy && e.alive) : t.cell && BP.Cards.enemyAt(state, t.cell.col, t.cell.row);
    if (f) push(f, (card.target === "cell" ? card.bonus || 0 : 0) + (card.focus ? up(amount * card.focus) : 0));
    if (card.chain && enemies.length) {
      const hit = new Set(enemies.map((e) => e.uid)), cand = [];
      cells.forEach((c) => BP.Hex.neighbors(c.col, c.row, r.cols, r.rows).forEach((nb) => {
        const e = !inArea(nb) && BP.Cards.enemyAt(state, nb.col, nb.row);
        if (e && !hit.has(e.uid) && !cand.includes(e)) cand.push(e);
      }));
      cand.sort((a, b) => a.hp - b.hp).slice(0, card.chain).forEach((e) => push(e, up(amount * 0.5)));
    }
    if (card.repeat) enemies.forEach((e) => push(e, up(amount * card.repeat)));
    if (!card.blast) return;
    const done = new Set(enemies.map((e) => e.uid));
    cells.forEach((c) => BP.Hex.neighbors(c.col, c.row, r.cols, r.rows).forEach((nb) => {
      if (inArea(nb)) return;
      const e = BP.Cards.enemyAt(state, nb.col, nb.row);
      if (!e || done.has(e.uid)) return;
      done.add(e.uid);
      push(e, up(amount * card.blast));
    }));
  }
  const hasExtra = (card) => !!(card.blast || card.repeat || card.chain || card.focus || (card.bonus && card.target === "cell"));

  // Доп. текст карты (того, чего нет в effects)
  function textExtra(card) {
    const dmg = (card.effects || []).find((e) => e.type === "damage");
    const out = [];
    if (!dmg) return out;
    if (card.focus && card.target !== "cell") out.push(`пробой: ещё ${up(dmg.amount * card.focus)} основной цели`); // у массовки — в centerDamage
    if (card.blast) out.push(`взрыв: соседним клеткам ${up(dmg.amount * card.blast)}`);
    if (card.repeat) out.push(`повтор: ещё удар ${up(dmg.amount * card.repeat)}`);
    if (card.chain) out.push(`цепь: ${card.chain > 1 ? card.chain + " врагам" : "ближайшему врагу"} вне зоны по ${up(dmg.amount * 0.5)}`);
    if (card.execute) out.push(`добивание: ×${1 + card.execute} по врагу с ≤50% ХП`);
    return out;
  }

  // Имена даров для карты: родной (что отдаст) и полученные
  function labels(state, card) {
    const own = card.gift && info(state, card.gift);
    return {
      own: own ? own.name : "",
      ownText: own ? own.text : "",
      got: list(card).map((g) => (info(state, g.id) || { name: g.id }).name),
      bonus: card.bonus || 0,
    };
  }

  // Массовка с прибавкой/пробоем: сколько получает клетка прицела (для понятного текста «18 в клетку прицела, 9 по соседним»)
  function centerDamage(card) {
    const d = (card.effects || []).find((e) => e.type === "damage");
    if (!d || card.target !== "cell" || !(card.bonus || card.focus)) return 0;
    return d.amount + (card.bonus || 0) + (card.focus ? up(d.amount * card.focus) : 0);
  }

  return { centerDamage, isOn, canMerge, mergeInto, extraHits, hasExtra, executeMult, textExtra, labels, applicable, currentDamage };
})();
