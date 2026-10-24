// Эволюция карт (merge-3, 20.10, эксперимент — tests.evolution).
// Эволюционная карта — у неё есть поле evolve (id карты-эволюции в config.cards). Это все карты за 2+ энергии, у них золотая рамка.
// Условие: две эволюционные карты РАЗНЫХ героев, обе уже мерджнутые (★). Тогда обе светятся фиолетовым.
// Перетащил одну на другую — карта, НА КОТОРУЮ тащили, превращается в свою эволюцию:
//   урон = урон обеих карт без даров (×удары) — merge-4: единственный способ поднять урон карты; дары обеих и родной дар отданной переходят (неподходящие не ложатся);
//   стоимость = стоимость карты, которая эволюционировала; оружие (крит) — её же.
// Эволюция живёт до конца боя (переживает сброс, как бонус мерджа). Отданная карта уходит в сброс чистой.
// card-mechanics-1 (21.10): эволюция остаётся в руке между ходами, пока её не сыграют (можно копить под комбо).
// Рецептов нет: направление (какую карту на какую тащить) и есть выбор игрока.
window.BP = window.BP || {};

BP.Evolve = (function () {
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const isOn = (state) => !!(state.config.tests.evolution && state.config.tests.evolution.enabled);

  // Карта может эволюционировать (золотая рамка)
  const evolvable = (state, card) => isOn(state) && !!card.evolve && !!state.config.cards[card.evolve];
  // Готова: эволюционная и уже мерджнутая
  const primed = (state, card) => evolvable(state, card) && !!card.merged;

  function can(state, src, dst) {
    return !!src && !!dst && src.uid !== dst.uid && primed(state, src) && primed(state, dst);
  }

  // Светится ли карта героя: у другого живого героя в руке есть готовая карта
  function ready(state, hero, card) {
    if (!primed(state, card)) return false;
    return state.heroes.some((h) => h.id !== hero.id && h.alive && h.hand.some((d) => primed(state, d)));
  }

  // Урон карты без даров (с ударами)
  function baseDamage(card) {
    const effs = card.giftBase ? card.giftBase.effects : card.effects || [];
    const d = effs.find((e) => e.type === "damage");
    return d ? d.amount * (d.hits || 1) : 0;
  }

  // Превратить dst в эволюцию (меняет dst на месте, src чистит)
  function apply(state, src, dst, giverId) {
    if (!can(state, src, dst)) return false;
    const cfg = state.config, id = dst.evolve;
    const ev = clone(cfg.cards[id]);
    ev.id = id; ev.uid = dst.uid; ev.cost = dst.cost;
    ["owner", "shared", "weapon", "weaponName"].forEach((k) => { if (dst[k] !== undefined) ev[k] = dst[k]; });
    if (ev.area === "shape") {
      const fs = cfg.tests.fixedShapes;
      if (fs && fs.enabled && ev.fixedShape) { ev.shape = ev.fixedShape; ev.fixed = true; }
      const sh = (cfg.shapes || {})[ev.shape]; ev.shapeName = sh ? sh.name : ev.shape; ev.shapeSteps = sh ? sh.steps : [[]];
    }
    const dmg = (ev.effects || []).find((e) => e.type === "damage");
    if (dmg) dmg.amount = Math.max(1, Math.ceil((baseDamage(dst) + baseDamage(src)) / (dmg.hits || 1)));
    ev.evolvedFrom = [dst.name, src.name];
    ev.retain = true; // card-mechanics-1: эволюция не сгорает в конце хода — лежит в руке, пока её не сыграют
    // дары: полученные целевой картой + всё, что передаёт отданная (её родной дар и её полученные)
    const gifts = (dst.gifts || []).concat(BP.Gifts.incoming(state, src).map((g) => Object.assign({}, g, { from: g.from || giverId || null })));
    ev.giftBase = { effects: clone(ev.effects), attack: ev.attack, area: ev.area };
    ev.gifts = [];
    gifts.forEach((g) => { if (BP.Gifts.applicable(g.id, { target: ev.target, giftBase: ev.giftBase, gifts: ev.gifts })) ev.gifts.push(g); });
    BP.Gifts.rebuild(ev);
    ev.merged = ev.gifts.length || 1;
    ev.text = BP.Cards.text(ev);
    Object.keys(dst).forEach((k) => delete dst[k]);
    Object.assign(dst, ev);
    BP.Gifts.clean(src);
    return true;
  }

  // Доп. текст эволюции
  function textExtra(card) {
    const out = [];
    if (card.ignoreCover) out.push("бьёт и закрытого врага");
    if (card.mult) out.push(`урон ×${card.mult}`);
    if (card.finisher) out.push("враг с ≤50% ХП погибает, иначе урон ×2");
    if (card.ignoreBlock) out.push("сквозь блок и броню");
    if (card.returnOnKill) out.push("убил цель — карта вернётся в руку");
    return out;
  }

  return { isOn, evolvable, primed, can, ready, apply, textExtra };
})();
