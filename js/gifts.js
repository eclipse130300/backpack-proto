// Мердж «дар» (tests.merge.mode = "gift", 18.10).
// Отданная карта передаёт карте союзника ОДНО свойство — свой родной дар (поле gift у карты, таблица config.gifts).
// Дары, которые карта сама получила, дальше не передаются: они остаются на ней (уходят с ней в сброс и вернутся).
// На карте максимум tests.merge.maxGifts даров (2). Числа простые: 50%, ×1.5, ×2. Дробное округляем вверх.
// «Мощь», «Взрыв», «Повтор», «Броня», «Прикрытие» складываются по 50% (две Мощи = ×2). Остальные дары — только один раз.
window.BP = window.BP || {};

BP.Gifts = (function () {
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const up = (x) => Math.ceil(x - 1e-9);
  const STACK = { power: 1, blast: 1, repeat: 1, armor: 1, cover: 1 };
  const isBlock = (e) => e.type === "block" || e.type === "blockSelf";

  const isOn = (state) => state.config.tests.merge.mode === "gift";
  const list = (card) => card.gifts || [];
  const count = (card, id) => list(card).filter((g) => g.id === id).length;
  const info = (state, id) => (state.config.gifts || {})[id] || null;

  // Исходный вид карты (до даров) — по нему решаем, полезен ли дар
  function baseOf(card) {
    return card.giftBase || { effects: card.effects || [], attack: card.attack, area: card.area };
  }

  // Полезен ли дар этой карте. Бесполезные мерджи не подсвечиваются (разряд в фаербол и т.п.).
  function applicable(giftId, dst) {
    const b = baseOf(dst), has = (t) => b.effects.some((e) => e.type === t);
    const dmg = has("damage"), blk = b.effects.some(isBlock), single = dst.target === "enemy";
    if (!STACK[giftId] && count(dst, giftId)) return false;
    switch (giftId) {
      case "power": case "blast": case "repeat": return dmg;
      case "pierce": return dmg && single && !b.area;
      case "range": return dmg && b.attack === "melee";
      case "push": return single && !has("push");
      case "taunt": return single && !has("taunt");
      case "sparks": return dmg && single && !has("sparks");
      case "armor": case "cover": return dmg || blk;
    }
    return false;
  }

  function canMerge(state, src, dst) {
    if (!src.gift || !info(state, src.gift)) return false;
    if (list(dst).length >= (state.config.tests.merge.maxGifts || 2)) return false;
    return applicable(src.gift, dst);
  }

  function mergeInto(state, src, dst, giverId) {
    if (!canMerge(state, src, dst)) return false;
    if (!dst.giftBase) dst.giftBase = { effects: clone(dst.effects), attack: dst.attack, area: dst.area };
    dst.gifts = list(dst).concat([{ id: src.gift, from: giverId || null }]);
    rebuild(dst);
    dst.merged = dst.gifts.length;
    dst.text = BP.Cards.text(dst);
    return true;
  }

  // Пересобрать эффекты карты из исходника + всех даров
  function rebuild(card) {
    const b = card.giftBase, n = (id) => count(card, id);
    card.effects = clone(b.effects); card.attack = b.attack; card.area = b.area;
    card.blast = 0.5 * n("blast"); card.repeat = 0.5 * n("repeat");
    const dmg = card.effects.find((e) => e.type === "damage"), blk = card.effects.find(isBlock);
    if (dmg && n("power")) dmg.amount = up(dmg.amount * (1 + 0.5 * n("power")));
    if (n("pierce")) card.area = "line";
    if (n("range")) card.attack = "ranged";
    if (n("push")) card.effects.push({ type: "push" });
    if (n("taunt")) card.effects.push({ type: "taunt" });
    if (n("sparks")) card.effects.push({ type: "sparks", count: 2, amount: 1 });
    if (dmg) {
      const half = (k) => up(dmg.amount * 0.5 * k);
      if (n("armor")) card.effects.push({ type: "blockSelf", amount: half(n("armor")) });
      list(card).filter((g) => g.id === "cover").forEach((g) => card.effects.push({ type: "blockHero", hero: g.from, amount: half(1) }));
    } else if (blk && n("armor") + n("cover")) {
      blk.amount = up(blk.amount * (1 + 0.5 * (n("armor") + n("cover"))));
    }
  }

  // Доп. удары «Взрыв» (соседние клетки зоны, 50%) и «Повтор» (ещё удар по тем же целям, 50%). Без крита.
  function extraHits(state, hero, card, target, enemies, amount, hits) {
    if (card.repeat) enemies.forEach((e) => hits.push({ enemy: e.uid, amount: up(amount * card.repeat), crit: false, critReason: "" }));
    if (!card.blast) return;
    const r = state.config.rules, cells = BP.Cards.areaCells(state, hero, card, target);
    const inArea = (c) => cells.some((x) => x.col === c.col && x.row === c.row);
    const done = new Set(enemies.map((e) => e.uid));
    cells.forEach((c) => BP.Hex.neighbors(c.col, c.row, r.cols, r.rows).forEach((nb) => {
      if (inArea(nb)) return;
      const e = BP.Cards.enemyAt(state, nb.col, nb.row);
      if (!e || done.has(e.uid)) return;
      done.add(e.uid);
      hits.push({ enemy: e.uid, amount: up(amount * card.blast), crit: false, critReason: "" });
    }));
  }

  // Доп. текст карты: взрыв/повтор (их нет в effects) и список полученных даров
  function textExtra(card) {
    const dmg = (card.effects || []).find((e) => e.type === "damage");
    const out = [];
    if (dmg && card.blast) out.push(`взрыв: соседним клеткам ${up(dmg.amount * card.blast)}`);
    if (dmg && card.repeat) out.push(`повтор: ещё удар ${up(dmg.amount * card.repeat)}`);
    return out;
  }

  // Имена даров для карты: родной (что отдаст) и полученные
  function labels(state, card) {
    const own = card.gift && info(state, card.gift);
    return {
      own: own ? own.name : "",
      ownText: own ? own.text : "",
      got: list(card).map((g) => (info(state, g.id) || { name: g.id }).name),
    };
  }

  return { isOn, canMerge, mergeInto, extraHits, textExtra, labels, applicable };
})();
