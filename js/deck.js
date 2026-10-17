// Колоды: сборка на бой, добор, сброс. Два режима:
//  - обычный: у каждого героя своя колода (оружие + щит + его доп. карты + слабые удары до minDeck);
//  - общая колода (tests.sharedDeck): у героя только карты оружия и щита, остальное — в state.shared.
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

  // Особые карты на бой: perFight разных карт из пула (только с включённым тестом), без копий
  function specialCards(cfg) {
    const sc = cfg.tests.specialCards || {};
    const allowed = (cid) => {
      const c = cfg.cards[cid];
      if (!c) return false;
      const types = (c.effects || []).map((e) => e.type);
      if (types.includes("sharedPool")) return !!(cfg.tests.sharedPool && cfg.tests.sharedPool.enabled);
      return true;
    };
    const pool = shuffle([...new Set((sc.pool || []).filter(allowed))]);
    return pool.slice(0, Math.max(0, sc.perFight || 0));
  }

  // Собрать колоды всех героев (и общую) в начале боя
  function buildFight(state, makeCard) {
    const cfg = state.config, shared = isShared(state);
    const fill = (list, min) => { while (list.length < min) list.push({ cardId: cfg.rules.fillerCard }); return list; };
    const specials = specialCards(cfg);
    const pool = [];
    state.heroes.forEach((h, i) => {
      const hc = cfg.heroes[i];
      let own = weaponCards(cfg, hc);
      if (shared) pool.push(...extraCards(hc));
      else own = fill(own.concat(extraCards(hc)), cfg.rules.minDeck);
      h.draw = own.map((d) => Object.assign(makeCard(state, d.cardId, d.weapon), { owner: h.id }));
      h.hand = []; h.discard = [];
    });
    if (shared) {
      specials.forEach((cid) => pool.push({ cardId: cid }));
      fill(pool, cfg.tests.sharedDeck.minDeck || 0);
      state.shared = { draw: shuffle(pool.map((d) => Object.assign(makeCard(state, d.cardId), { shared: true }))), discard: [] };
    } else {
      state.shared = null;
      specials.forEach((cid) => {
        const h = state.heroes[Math.floor(Math.random() * state.heroes.length)];
        h.draw.push(Object.assign(makeCard(state, cid), { owner: h.id }));
      });
    }
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
      hero.hand.push(fromOwn ? hero.draw.pop() : sh.draw.pop());
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
