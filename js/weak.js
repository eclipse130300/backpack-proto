// Слабые удары оружия (17.10, эксперимент): колода героя добивается до rules.minDeck слабым ударом его оружия
// (weapons.*.weakCard: меч — «Слабый удар», лук — «Слабый выстрел», посох — «Искры»). Слабые удары не двигают крит оружия и не критуют (18.10).
// В общей колоде (tests.sharedDeck) лежит «слабый удар», который при доборе превращается в слабый удар вытянувшего героя.
// Эффект sparks («Искры»): N выстрелов по 1 урона, каждый с шансом 50% уходит в случайного соседа цели.
window.BP = window.BP || {};

BP.Weak = (function () {
  // Оружие героя, которое даёт слабый удар (первое с weakCard). null — нет, тогда добивка rules.fillerCard.
  function weaponOf(cfg, hc) {
    return (hc.weapons || []).find((wid) => cfg.weapons[wid] && cfg.weapons[wid].weakCard) || null;
  }

  // Что класть добивкой в колоду героя: { cardId, weapon }
  function fillerFor(cfg, hc) {
    const wid = weaponOf(cfg, hc);
    return wid ? { cardId: cfg.weapons[wid].weakCard, weapon: wid } : { cardId: cfg.rules.fillerCard };
  }

  // Карта-«заготовка» для общей колоды: подпись, что она подстроится
  function placeholder(state, card) {
    const cfg = state.config;
    const list = Object.values(cfg.weapons).filter((w) => w.weakCard && cfg.cards[w.weakCard])
      .map((w) => `${w.name.toLowerCase()} — «${cfg.cards[w.weakCard].name}»`);
    card.adaptive = true;
    card.name = "Слабый удар (любой)";
    card.text = "Станет слабым ударом героя, который её вытянет: " + list.join(", ");
    return card;
  }

  // Добор из общей колоды: заготовка превращается в слабый удар этого героя (uid тот же, бонус мерджа сохраняется)
  function adapt(state, hero, card) {
    if (!card.adaptive) return card;
    const cfg = state.config, hc = cfg.heroes.find((x) => x.id === hero.id) || {};
    const f = fillerFor(cfg, hc);
    const fresh = BP.Engine.makeCard(state, f.cardId, f.weapon);
    const dmg = (c) => (c.effects || []).find((e) => e.type === "damage");
    const base = (id) => dmg(cfg.cards[id] || {});
    if (card.giftBase && BP.Gifts && dmg(fresh)) { // дары мерджа переезжают на слабый удар героя
      fresh.giftBase = { effects: JSON.parse(JSON.stringify(fresh.effects)), attack: fresh.attack, area: fresh.area };
      fresh.gifts = card.gifts; fresh.merged = card.merged;
      BP.Gifts.rebuild(fresh);
      fresh.text = BP.Cards.text(fresh);
    } else if (card.merged && dmg(card) && dmg(fresh)) {
      const bonus = dmg(card).amount - ((base(card.id) || {}).amount || 0);
      if (bonus > 0) dmg(fresh).amount += bonus;
      fresh.merged = card.merged;
      fresh.text = BP.Cards.text(fresh);
    }
    fresh.uid = card.uid; fresh.shared = card.shared; fresh.adaptive = true;
    return fresh;
  }

  // Искры (card-mechanics-1, 21.10): count выстрелов по amount урона. Каждый с шансом stray (50%) уходит
  // в случайного врага на соседней с целью клетке, иначе — в цель. Соседей нет — в цель. hurt(enemy, amount) — нанести урон.
  function sparks(state, card, primary, hurt) {
    const ef = (card.effects || []).find((e) => e.type === "sparks");
    if (!ef || !primary) return "";
    const r = state.config.rules;
    const cells = BP.Hex.neighbors(primary.col, primary.row, r.cols, r.rows);
    const hitBy = {};
    for (let i = 0; i < (ef.count || 0); i++) {
      const cand = cells.map((c) => BP.Cards.enemyAt(state, c.col, c.row)).filter((e) => e && e.alive && e.uid !== primary.uid);
      const stray = cand.length && Math.random() < (ef.stray || 0);
      const e = stray ? cand[Math.floor(Math.random() * cand.length)] : primary.alive ? primary : null;
      if (!e) break;
      const dealt = hurt(e, ef.amount) || ef.amount; // с Силой выстрел сильнее
      hitBy[e.name] = (hitBy[e.name] || 0) + dealt;
    }
    const parts = Object.entries(hitBy).map(([n, a]) => `${n} −${a}`);
    return parts.length ? `искры: ${parts.join(", ")}` : "";
  }

  return { weaponOf, fillerFor, placeholder, adapt, sparks };
})();
