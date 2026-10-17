// Колоды: сборка на бой, добор, сброс. Два режима:
//  - обычный: у каждого героя своя колода (оружие + щит + его доп. карты + слабые удары его оружия до minDeck);
//  - общая колода (tests.sharedDeck): у героя только карты оружия и щита, остальное — в state.shared
//    (слабые удары там подстраиваются под героя, который их вытянул).
// У каждой карты: owner = id героя (карта героя) или shared = true (общая).
window.BP = window.BP || {};

BP.Deck = (function () {
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const isShared = (state) => !!(state.config.tests.sharedDeck && state.config.tests.sharedDeck.enabled);

  function weaponCards(cfg, hc) {
    const list = [];
    (hc.weapons || []).forEach((wid) => {
      const w = cfg.weapons[wid];
      if (w) Object.entries(w.cards).forEach(([cid, n]) => { for (let i = 0; i < n; i++) list.push({ cardId: cid, weapon: wid }); });
    });
    return list;
  }

  function extraCards(hc) {
    const list = [];
    Object.entries(hc.cards || {}).forEach(([cid, n]) => { for (let i = 0; i < n; i++) list.push({ cardId: cid }); });
    return list;
  }

  // Собрать колоды всех героев (и общую) в начале боя.
  // Добивка до минимума — слабые удары оружия героя (js/weak.js); в общей колоде — «слабый удар», который подстроится.
  function buildFight(state, makeCard) {
    const cfg = state.config, shared = isShared(state);
    const pool = [];
    state.heroes.forEach((h, i) => {
      const hc = cfg.heroes[i];
      let own = weaponCards(cfg, hc);
      if (shared) pool.push(...extraCards(hc));
      else {
        own = own.concat(extraCards(hc));
        const f = BP.Weak.fillerFor(cfg, hc);
        while (own.length < cfg.rules.minDeck) own.push(f);
      }
      h.draw = own.map((d) => Object.assign(makeCard(state, d.cardId, d.weapon), { owner: h.id }));
      h.hand = []; h.discard = [];
    });
    if (shared) {
      const cards = pool.map((d) => makeCard(state, d.cardId));
      while (cards.length < (cfg.tests.sharedDeck.minDeck || 0)) cards.push(BP.Weak.placeholder(state, makeCard(state, cfg.rules.fillerCard)));
      state.shared = { draw: shuffle(cards.map((c) => Object.assign(c, { shared: true }))), discard: [] };
    } else state.shared = null;
    state.heroes.forEach((h) => shuffle(h.draw));
  }

  // Добор n карт. В общем режиме каждая карта тянется случайно из «своя колода + общая» (шанс по количеству).
  // Когда обе стопки пусты — в них замешиваются их сбросы.
  function draw(state, hero, n) {
    const sh = state.shared;
    for (let i = 0; i < n; i++) {
      if (!sh) {
        if (!hero.draw.length) { hero.draw = shuffle(hero.discard); hero.discard = []; }
        if (!hero.draw.length) return;
        hero.hand.push(hero.draw.pop());
        continue;
      }
      if (!hero.draw.length && !sh.draw.length) {
        hero.draw = shuffle(hero.discard); hero.discard = [];
        sh.draw = shuffle(sh.discard); sh.discard = [];
      }
      const total = hero.draw.length + sh.draw.length;
      if (!total) return;
      const fromOwn = Math.random() * total < hero.draw.length;
      hero.hand.push(fromOwn ? hero.draw.pop() : BP.Weak.adapt(state, hero, sh.draw.pop()));
    }
  }

  // Карта уходит в сброс: общая — в общий, своя — в сброс героя. Одноразовая (квестовая) — пропадает.
  function discard(state, hero, card) {
    if (card.exhaust) return;
    if (card.shared && state.shared) state.shared.discard.push(card);
    else hero.discard.push(card);
  }

  function discardAll(state, hero, cards) { cards.forEach((c) => discard(state, hero, c)); }

  return { buildFight, draw, discard, discardAll, isShared };
})();
