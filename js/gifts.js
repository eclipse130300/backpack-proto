// Мердж «дар» (tests.merge.mode = "gift", 18.10).
// Отданная карта передаёт карте союзника ОДНО свойство — свой родной дар (поле gift у карты, таблица config.gifts).
// Дары, которые карта сама получила, дальше не передаются: они остаются на ней (уходят с ней в сброс и вернутся).
// На карте максимум tests.merge.maxGifts даров (2). Числа простые: 50%, ×1.5, ×2. Дробное округляем вверх.
// «Мощь», «Взрыв», «Повтор», «Броня», «Прикрытие» складываются по 50% (две Мощи = ×2). Остальные дары — только один раз.
window.BP = window.BP || {};

BP.Gifts = (function () {
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const up = (x) => Math.ceil(x - 1e-9);
  const STACK = { power: 1, blast: 1, repeat: 1, armor: 1, cover: 1, push: 1 }; // push: до 2 толчков на карте (свой + дар) = толчок на 2 клетки
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
    const dmg = has("damage"), blk = b.effects.some(isBlock), single = dst.target === "enemy", cell = dst.target === "cell";
    if (!STACK[giftId] && count(dst, giftId)) return false;
    switch (giftId) {
      case "power": case "blast": case "repeat": return dmg;
      case "pierce": return dmg && (single || cell);
      case "execute": return dmg;
      case "chain": return dmg && (single || cell);
      case "push": return (single || cell) && pushTotal(dst) < 2;
      case "taunt": return single && !has("taunt");
      case "sparks": return dmg && single && !has("sparks");
      case "armor": case "cover": return dmg || blk;
    }
    return false;
  }

  // Сколько толчков на карте: свой (в исходнике) + дары «Толчок». 2 = толчок на 2 клетки.
  function pushTotal(card) {
    return (baseOf(card).effects.some((e) => e.type === "push") ? 1 : 0) + count(card, "push");
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
    card.execute = n("execute") > 0; card.chain = n("chain") ? 0.5 : 0; card.focus = 0; card.pushDist = 0;
    const dmg = card.effects.find((e) => e.type === "damage"), blk = card.effects.find(isBlock);
    if (dmg && n("power")) dmg.amount = up(dmg.amount * (1 + 0.5 * n("power")));
    // Пробой: одиночной атаке — «насквозь» (враг за целью 100%); массовке и карте, что уже бьёт насквозь, — +50% в клетку прицела
    if (n("pierce")) { if (card.target === "enemy" && !b.area) card.area = "line"; else card.focus = 0.5; }
    // Толчок: карта без толчка начинает толкать; второй толчок (свой + дар или два дара) — толчок на 2 клетки.
    // У массовки толкается враг в клетке прицела, ДО удара массовки.
    if (n("push")) {
      if (!card.effects.some((e) => e.type === "push")) card.effects.push({ type: "push" });
      if (pushTotal(card) >= 2) card.pushDist = 2;
    }
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

  // «Добивание»: урон ×2 по врагу, у которого ≤50% ХП (по ХП до удара). Применяется к основным ударам карты.
  function executeMult(card, e) {
    return card.execute && e.hp * 2 <= e.maxHp ? 2 : 1;
  }

  // Доп. удары «Взрыв» (соседние клетки зоны, 50%), «Повтор» (ещё удар по тем же целям, 50%),
  // «Цепь» (молния перескакивает на одного соседа цели — с меньшим ХП — 50%). Без крита.
  function extraHits(state, hero, card, target, enemies, amount, hits) {
    const r = state.config.rules;
    const cells = BP.Cards.areaCells(state, hero, card, target);
    const inArea = (c) => cells.some((x) => x.col === c.col && x.row === c.row);
    if (card.focus) { // Пробой в массовку / в «насквозь»: враг в клетке прицела получает ещё 50%
      const t = target || {};
      const f = card.target === "enemy" ? state.enemies.find((e) => e.uid === t.enemy && e.alive) : t.cell && BP.Cards.enemyAt(state, t.cell.col, t.cell.row);
      if (f) hits.push({ enemy: f.uid, amount: up(amount * card.focus), crit: false, critReason: "" });
    }
    if (card.chain && enemies.length) { // Цепь: на одного ближайшего врага вне зоны (с меньшим ХП)
      const hit = new Set(enemies.map((e) => e.uid)), cand = [];
      cells.forEach((c) => BP.Hex.neighbors(c.col, c.row, r.cols, r.rows).forEach((nb) => {
        const e = !inArea(nb) && BP.Cards.enemyAt(state, nb.col, nb.row);
        if (e && !hit.has(e.uid) && !cand.includes(e)) cand.push(e);
      }));
      const nb = cand.sort((a, b) => a.hp - b.hp)[0];
      if (nb) hits.push({ enemy: nb.uid, amount: up(amount * card.chain), crit: false, critReason: "" });
    }
    if (card.repeat) enemies.forEach((e) => hits.push({ enemy: e.uid, amount: up(amount * card.repeat), crit: false, critReason: "" }));
    if (!card.blast) return;
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
    if (dmg && card.chain) out.push(`цепь: ближайшему врагу вне зоны ${up(dmg.amount * card.chain)}`);
    if (dmg && card.focus) out.push(`пробой: ещё ${up(dmg.amount * card.focus)} в клетку прицела`);
    if (dmg && card.execute) out.push(`добивание: ×2 по врагу с ≤50% ХП`);
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

  return { isOn, canMerge, mergeInto, extraHits, executeMult, textExtra, labels, applicable };
})();
