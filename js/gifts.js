// merge-4 (24.10, эксперимент, вариант D): мердж НЕ передаёт урон — только дары, в полную силу.
//   Урон карты растёт только эволюцией (сумма базового урона двух карт). Прибавки +50% больше нет.
// Повторные одинаковые дары растут по шкале 1 → 3 → 5 (esc(n) = 2n − 1, итоговая сила, не сумма):
//   Мощь ×2 → ×3 → ×4 (исключение) | Добивание ×2 → ×4 → ×6 | Цепь 1 → 3 → 5 прыжков по 100%
//   Повтор +1 → +3 → +5 ударов по 100% | Рикошет 100% → 300% → 500% | Броня/Прикрытие блок = 100% → 300% → 500% урона
//   (у карты блока — блок ×2 → ×4 → ×6) | Толчок 1 → 3 → 5 клеток | Вызов — один | Зона: добавленные клетки всегда 100%,
//   каждая следующая Зона только добавляет свою фигуру.
// Отданная карта передаёт свой родной дар и все полученные (цепочки) и уходит в сброс ЧИСТОЙ.
// Зона несёт ФИГУРУ своей карты (у динамической массовки — лучи/линию). Цепь прыгает от цели на соседа с наименьшим ХП,
//   которого карта ещё не била. Рикошет (id pierce): перед ударом выбираешь направление, сосед цели туда получает урон.
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
  // Эскалация одинаковых даров: 1 → 1, 2 → 3, 3 → 5 (итоговая сила в «сотнях процентов»)
  const esc = (n) => (n > 0 ? 2 * n - 1 : 0);
  const powerMult = (n) => (n > 0 ? 1 + n : 1); // Мощь: ×2, ×3, ×4

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
    if (src.gift === "blast") {
      own.steps = clone(nativeSteps(src));
      if (src.area === "rays") { own.steps = [[]]; own.rays = clone(src.rays); } // динамическая массовка (js/mech.js)
      if (src.area === "level") { own.steps = [[]]; own.level = true; }
    }
    return [own].concat(list(src).map((g) => Object.assign({}, g)));
  }

  // Текущий урон карты за розыгрыш по одной цели: урон (с Мощью) × удары
  function currentDamage(card) {
    const d = (card.effects || []).find((e) => e.type === "damage");
    return d ? d.amount * (d.hits || 1) : 0;
  }

  function canMerge(state, src, dst) {
    const inc = incoming(state, src);
    if (!inc.length) return false;
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
    dst.gifts = list(dst).concat(add);
    rebuild(dst);
    dst.merged = dst.gifts.length || 1;
    dst.text = BP.Cards.text(dst);
    clean(src); // отданная карта уходит в сброс чистой
    return true;
  }

  const DERIVED = ["zone", "zoneSteps", "zoneRays", "zoneLevel", "repeat", "execute", "chain", "pierce", "pushDist"];

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
    delete card.bonus; // merge-4: прибавки урона от мерджа нет
    if (dmg && n("power")) dmg.amount = up(dmg.amount * powerMult(n("power")));
    if (n("repeat")) card.repeat = esc(n("repeat")); // число доп. ударов по 100%
    if (n("execute")) card.execute = esc(n("execute")); // урон ×(1 + esc)
    if (n("chain")) card.chain = esc(n("chain")); // прыжков по 100%
    if (n("pierce")) card.pierce = n("pierce"); // Рикошет: число даров (сила — BP.Mech.rico)
    // Зона: фигуры даров складываются с родной; новые клетки всегда бьют 100%
    if (n("blast")) {
      card.zone = 1;
      const seen = new Set(nativeSteps(card).map(stepKey)), steps = [];
      list(card).filter((g) => g.id === "blast").forEach((g) => (g.steps || [[]]).forEach((p) => {
        const k = stepKey(p);
        if (!seen.has(k)) { seen.add(k); steps.push(p); }
      }));
      card.zoneSteps = steps;
      const rays = [];
      list(card).filter((g) => g.id === "blast").forEach((g) => (g.rays || []).forEach((d) => { if (!rays.includes(d)) rays.push(d); }));
      if (rays.length) card.zoneRays = rays;
      if (list(card).some((g) => g.id === "blast" && g.level)) card.zoneLevel = true;
    }
    // Толчок: свой + дары = N толчков → esc(N) клеток (1, 3, 5). У массовки — враг в клетке прицела, ДО удара.
    if (n("push")) {
      const total = esc((b.effects.some((e) => e.type === "push") ? 1 : 0) + n("push"));
      if (!card.effects.some((e) => e.type === "push")) card.effects.push({ type: "push" });
      if (total > 1) card.pushDist = total;
    }
    if (n("taunt") && !card.effects.some((e) => e.type === "taunt")) card.effects.push({ type: "taunt" });
    if (dmg) {
      const half = (k) => up(dmg.amount * esc(k));
      if (n("armor")) card.effects.push({ type: "blockSelf", amount: half(n("armor")) });
      // Прикрытие: каждому отдавшему — 100% / 300% / 500% по числу его Прикрытий
      const by = {};
      list(card).filter((g) => g.id === "cover").forEach((g) => { by[g.from] = (by[g.from] || 0) + 1; });
      Object.keys(by).forEach((h) => card.effects.push({ type: "blockHero", hero: h === "null" ? null : h, amount: half(by[h]) }));
    } else if (blk && n("armor") + n("cover")) {
      blk.amount = up(blk.amount * (1 + esc(n("armor") + n("cover"))));
    }
  }

  // «Добивание»: ×(1 + esc(N)) = ×2, ×4, ×6 по врагу с ≤50% ХП (по ХП до удара). Только собственный урон карты.
  function executeMult(card, e) {
    return card.execute && e.hp * 2 <= e.maxHp ? 1 + card.execute : 1;
  }

  // Доп. удары (без крита). areaHits — [{enemy, amount}] основные удары карты (до крита), amount — урон карты.
  //   Повтор — card.repeat доп. ударов по тем же целям, каждый 100% того, что получила цель;
  //   Рикошет — сосед каждой цели по направлению атаки, сила BP.Mech.rico;
  //   Цепь — card.chain прыжков от цели по соседям с наименьшим ХП, которых карта ещё не била, каждый 100%.
  function extraHits(state, hero, card, target, areaHits, amount, hits) {
    const r = state.config.rules;
    let src = "";
    const push = (e, a) => { if (a > 0) hits.push({ enemy: e.uid, amount: a, crit: false, critReason: "", src, step: stepOf(card, src) }); };
    const byUid = (uid) => state.enemies.find((e) => e.uid === uid);
    src = "repeat";
    if (card.repeat) for (let k = 0; k < card.repeat; k++) areaHits.forEach((h) => { const e = byUid(h.enemy); if (e) push(e, h.amount); });
    src = "pierce";
    const rico = BP.Mech.rico(card), dir = target && target.dir;
    if (rico && dir !== undefined && dir !== null) { // Рикошет: сосед каждой цели в выбранном направлении
      const done = new Set(areaHits.map((h) => h.enemy));
      areaHits.forEach((h) => {
        const e = byUid(h.enemy), n = e && BP.Hex.neighbor(e.col, e.row, dir, r.cols, r.rows);
        const nb = n && BP.Cards.enemyAt(state, n.col, n.row);
        if (nb && !done.has(nb.uid)) { done.add(nb.uid); push(nb, up(amount * rico)); }
      });
    }
    src = "chain";
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
        push(next, amount);
        cur = next;
      }
    }
  }
  // Порядок дара на карте: 1, 2, 3… по первому мерджу (повторный дар не сдвигает); 0 — сама карта
  function order(card) {
    const out = [];
    list(card).forEach((g) => { if (!out.includes(g.id)) out.push(g.id); });
    return out;
  }
  function stepOf(card, id) {
    const k = order(card).indexOf(id);
    return k < 0 ? 0 : k + 1;
  }

  const hasExtra = (card) => !!(card.repeat || card.chain || card.pierce || card.ricochet);

  // Плашки даров на карте: иконка + одно число (в порядке первого мерджа — в том же порядке идёт урон)
  function badges(state, card) {
    const out = [], dmg = (card.effects || []).find((e) => e.type === "damage");
    const pct = (x) => Math.round(x * 100) + "%";
    order(card).forEach((id) => { // в порядке первого мерджа
      const n = count(card, id);
      if (!n || !info(state, id)) return;
      const g = info(state, id);
      let v = "";
      switch (id) {
        case "power": v = "×" + powerMult(n); break;
        case "execute": v = "×" + (1 + esc(n)); break;
        case "push": v = String(card.pushDist || 1); break;
        case "taunt": v = ""; break;
        case "armor": case "cover": v = dmg ? pct(esc(n)) : "×" + (1 + esc(n)); break;
        case "pierce": v = pct(BP.Mech.rico(card)); break;
        case "chain": v = "×" + esc(n); break; // прыжков
        case "repeat": v = "+" + esc(n); break; // доп. ударов
        default: v = "100%"; // Зона
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
    if (card.zone) out.push(`зона: добавленные клетки по ${up(dmg.amount * card.zone)}${card.zoneRays || card.zoneLevel ? " (линии до края поля)" : ""}`);
    const pl = (n, a, b, c) => (n === 1 ? a : n < 5 ? b : c);
    if (card.chain) out.push(`цепь: ${card.chain} ${pl(card.chain, "прыжок", "прыжка", "прыжков")} по ${dmg.amount}`);
    if (card.repeat) out.push(`повтор: ещё ${card.repeat === 1 ? "удар" : card.repeat + " " + pl(card.repeat, "", "удара", "ударов")} по 100%`);
    if (card.pierce) out.push(`рикошет: соседу цели по направлению атаки ${up(dmg.amount * BP.Mech.rico(card))}`);
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
      bonus: 0,
    };
  }

  return { esc, powerMult, isOn, canMerge, mergeInto, extraHits, hasExtra, executeMult, textExtra, labels, badges, applicable, currentDamage, stripped, stepKey, nativeSteps, rebuild, stepOf, incoming, clean };
})();
