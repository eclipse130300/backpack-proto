// Мердж «дар» (tests.merge.mode = "gift"), версия merge-2 (19.10): каждый дар = иконка + одно число.
// Отданная карта передаёт карте союзника:
//   1) свой родной дар (поле gift у карты, таблица config.gifts) и ВСЕ дары, которые сама получила раньше (цепочки);
//   2) атака → атака: «прибавка» +50% своего текущего урона — прямо в урон карты (у массовки — во всю родную фигуру).
// Отданная карта уходит в сброс ЧИСТОЙ (без даров и прибавки), сыгранная — усиленной. Лимита даров нет.
// Повторные дары не добавляют новую иконку, а растят число (проценты складываются, не перемножаются):
//   Мощь ×1.5 → ×2 → ×2.5 | Взрыв (массовка) 50% → 100% | Цепь 50% → 100% | Повтор 50% → 100%
//   Пробой 50% → 100% | Броня/Прикрытие 50% → 100% | Добивание ×2 → ×3 | Толчок: N толчков = N клеток | Вызов — один.
// Взрыв: дар массовки несёт ФИГУРУ своей карты. Фигуры складываются по клетке прицела (у одиночки — клетка цели).
//   Родная фигура карты бьёт полным уроном, добавленные клетки — 50% за каждый Взрыв на карте.
// Цепь: N цепей = N прыжков. Первый прыжок — N×50% урона, каждый следующий на 50% меньше (2 цепи: 100%, 50%).
//   Прыгает от цели (клетки прицела) на соседнего врага с наименьшим ХП, которого карта ещё не била.
// Пробой: враг прямо за каждой целью (в заднем ряду той же колонки) получает ещё N×50%.
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

  // Родная фигура карты: шаги от клетки прицела (у одиночной атаки — только сама клетка цели)
  const nativeSteps = (card) => (card.area === "shape" && card.shapeSteps ? card.shapeSteps : [[]]);

  // Ключ клетки фигуры = геометрический сдвиг от клетки прицела (разные пути в одну клетку совпадают)
  function stepKey(path) {
    let x = 0, y = 0;
    (path || []).forEach((s) => { const a = ((30 + s * 60) * Math.PI) / 180; x += Math.cos(a); y += Math.sin(a); });
    return Math.round(x * 10) + ":" + Math.round(y * 10);
  }

  // Подходит ли дар карте (неподходящие дары при передаче просто не ложатся)
  function applicable(giftId, dst) {
    const b = baseOf(dst), has = (t) => b.effects.some((e) => e.type === t);
    const dmg = has("damage"), blk = b.effects.some(isBlock), single = dst.target === "enemy", cell = dst.target === "cell";
    switch (giftId) {
      case "power": case "repeat": case "execute": case "pierce": return dmg;
      case "blast": case "chain": return dmg && (single || cell);
      case "push": return single || cell;
      case "taunt": return single && !has("taunt") && !count(dst, "taunt");
      case "armor": case "cover": return dmg || blk;
    }
    return false;
  }

  // Что отданная карта передаёт: родной дар (Взрыв — с фигурой карты) + все полученные
  function incoming(state, src) {
    if (!src.gift || !info(state, src.gift)) return []; // нет родного дара (слабые карты) — отдать нельзя
    const own = { id: src.gift, from: null };
    if (src.gift === "blast") own.steps = clone(nativeSteps(src));
    return [own].concat(list(src).map((g) => Object.assign({}, g)));
  }

  // Текущий урон карты за розыгрыш по одной цели: урон (с Мощью и прибавкой) × удары
  function currentDamage(card) {
    const d = (card.effects || []).find((e) => e.type === "damage");
    return d ? d.amount * (d.hits || 1) : 0;
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
      const gift = Object.assign({}, g, { from: g.from || giverId || null });
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

  const DERIVED = ["zone", "zoneSteps", "repeat", "execute", "chain", "pierce", "pushDist"];

  // Снять с карты все дары и прибавку
  function clean(card) {
    if (!card.giftBase) return;
    card.effects = clone(card.giftBase.effects); card.attack = card.giftBase.attack; card.area = card.giftBase.area;
    ["giftBase", "gifts", "bonus", "merged"].concat(DERIVED).forEach((k) => delete card[k]);
    card.text = BP.Cards.text(card);
  }

  // Копия карты без даров (для ботов: «что теряет отданная карта»)
  function stripped(card) {
    const c = clone(card);
    clean(c);
    return c;
  }

  // Пересобрать эффекты карты из исходника + всех даров
  function rebuild(card) {
    const b = card.giftBase, n = (id) => count(card, id);
    card.effects = clone(b.effects); card.attack = b.attack; card.area = b.area;
    DERIVED.forEach((k) => delete card[k]);
    const dmg = card.effects.find((e) => e.type === "damage"), blk = card.effects.find(isBlock);
    if (dmg && n("power")) dmg.amount = up(dmg.amount * (1 + 0.5 * n("power")));
    if (dmg && card.bonus) dmg.amount += card.bonus; // прибавка — прямо в урон (у массовки — во всю родную фигуру)
    if (n("repeat")) card.repeat = 0.5 * n("repeat");
    if (n("execute")) card.execute = n("execute");
    if (n("chain")) card.chain = n("chain");
    if (n("pierce")) card.pierce = 0.5 * n("pierce");
    // Взрыв: фигуры даров складываются с родной; новые клетки бьют 50% за каждый Взрыв
    if (n("blast")) {
      card.zone = 0.5 * n("blast");
      const seen = new Set(nativeSteps(card).map(stepKey)), steps = [];
      list(card).filter((g) => g.id === "blast").forEach((g) => (g.steps || [[]]).forEach((p) => {
        const k = stepKey(p);
        if (!seen.has(k)) { seen.add(k); steps.push(p); }
      }));
      card.zoneSteps = steps;
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
      // Прикрытие: каждому отдавшему — 50% за каждое его Прикрытие
      const by = {};
      list(card).filter((g) => g.id === "cover").forEach((g) => { by[g.from] = (by[g.from] || 0) + 1; });
      Object.keys(by).forEach((h) => card.effects.push({ type: "blockHero", hero: h === "null" ? null : h, amount: half(by[h]) }));
    } else if (blk && n("armor") + n("cover")) {
      blk.amount = up(blk.amount * (1 + 0.5 * (n("armor") + n("cover"))));
    }
  }

  // «Добивание»: ×(1 + N) по врагу с ≤50% ХП (по ХП до удара). Только собственный урон карты.
  function executeMult(card, e) {
    return card.execute && e.hp * 2 <= e.maxHp ? 1 + card.execute : 1;
  }

  // Доп. удары (без крита). areaHits — [{enemy, amount}] основные удары карты (до крита), amount — урон карты.
  //   Повтор — ещё удар по тем же целям (N×50% от того, что получила цель);
  //   Пробой — враг прямо за каждой целью ещё N×50% урона карты;
  //   Цепь — N прыжков от цели по соседям с наименьшим ХП, которых карта ещё не била: N×50%, (N−1)×50%, … 50%.
  function extraHits(state, hero, card, target, areaHits, amount, hits) {
    const r = state.config.rules;
    const push = (e, a) => { if (a > 0) hits.push({ enemy: e.uid, amount: a, crit: false, critReason: "" }); };
    const byUid = (uid) => state.enemies.find((e) => e.uid === uid);
    if (card.repeat) areaHits.forEach((h) => push(byUid(h.enemy), up(h.amount * card.repeat)));
    if (card.pierce) {
      const done = new Set();
      areaHits.forEach((h) => {
        const e = byUid(h.enemy), back = e && e.row + 1 < r.rows && BP.Cards.enemyAt(state, e.col, e.row + 1);
        if (back && !done.has(back.uid)) { done.add(back.uid); push(back, up(amount * card.pierce)); }
      });
    }
    if (card.chain) {
      const hit = new Set(areaHits.map((h) => h.enemy));
      const t = target || {};
      let cur = card.target === "enemy" ? (byUid(t.enemy) || null) : t.cell || null;
      for (let k = card.chain; k >= 1 && cur; k--) {
        const next = BP.Hex.neighbors(cur.col, cur.row, r.cols, r.rows)
          .map((nb) => BP.Cards.enemyAt(state, nb.col, nb.row))
          .filter((e) => e && !hit.has(e.uid))
          .sort((a, b) => a.hp - b.hp)[0];
        if (!next) break;
        hit.add(next.uid);
        push(next, up(amount * 0.5 * k));
        cur = next;
      }
    }
  }
  const hasExtra = (card) => !!(card.repeat || card.chain || card.pierce);

  // Плашки даров на карте: иконка + одно число (в порядке таблицы gifts)
  function badges(state, card) {
    const out = [], dmg = (card.effects || []).find((e) => e.type === "damage");
    const pct = (x) => Math.round(x * 100) + "%";
    Object.keys(state.config.gifts || {}).forEach((id) => {
      const n = count(card, id);
      if (!n) return;
      const g = info(state, id);
      let v = "";
      switch (id) {
        case "power": v = "×" + (1 + 0.5 * n); break;
        case "execute": v = "×" + (1 + n); break;
        case "push": v = String(card.pushDist || 1); break;
        case "taunt": v = ""; break;
        case "armor": case "cover": v = dmg ? pct(0.5 * n) : "×" + (1 + 0.5 * n); break;
        default: v = pct(0.5 * n);
      }
      out.push({ id, icon: g.icon || "★", color: g.color, value: v, name: g.name });
    });
    return out;
  }

  // Доп. текст карты (того, чего нет в effects)
  function textExtra(card) {
    const dmg = (card.effects || []).find((e) => e.type === "damage");
    const out = [];
    if (!dmg) return out;
    if (card.zone) out.push(card.zoneSteps.length ? `взрыв: ещё ${card.zoneSteps.length} кл. по ${up(dmg.amount * card.zone)}` : `взрыв ${Math.round(card.zone * 100)}% (новых клеток нет)`);
    if (card.chain) out.push(`цепь: ${Array.from({ length: card.chain }, (_, i) => up(dmg.amount * 0.5 * (card.chain - i))).join(" → ")}`);
    if (card.repeat) out.push(`повтор: ещё удар ${Math.round(card.repeat * 100)}%`);
    if (card.pierce) out.push(`пробой: врагу за целью ${up(dmg.amount * card.pierce)}`);
    if (card.execute) out.push(`добивание: ×${1 + card.execute} по врагу с ≤50% ХП`);
    return out;
  }

  // Имена даров для карты: родной (что отдаст) и полученные
  function labels(state, card) {
    const own = card.gift && info(state, card.gift);
    return {
      own: own ? own.name : "",
      ownIcon: own ? own.icon || "" : "",
      ownText: own ? own.text : "",
      got: list(card).map((g) => (info(state, g.id) || { name: g.id }).name),
      bonus: card.bonus || 0,
    };
  }

  return { isOn, canMerge, mergeInto, extraHits, hasExtra, executeMult, textExtra, labels, badges, applicable, currentDamage, stripped, stepKey, nativeSteps, rebuild };
})();
