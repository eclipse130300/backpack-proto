// Мета забега (ветка beta-meta, 11.11): колода забега героя, улучшения карт и героя, награды, кузница, костёр.
// Колода забега — список «описаний» карт: { uid, id, weapon, ups: {...} }. В начале каждого боя из них заново
// собираются карты (engine.makeCard + apply), поэтому мердж и эволюция живут только до конца боя, а улучшения — весь забег.
// Улучшения (config.meta.upgrades):
//   на карту: up (урон/блок +50% или +3), gift (постоянный дар), draw, inspire, feed, armorbreak, cheaper, retain, innate,
//             sharp, freemerge, killenergy, echo, awaken, ignorecover, generous;
//   герою:    maxhp, startblock, strength, fortitude (h.perm);  пати: partymerge (state.run.relics).
// Где срабатывают: engine.playCard (draw, inspire, killenergy, echo), engine.mergeCard (feed), cards.mergeCost (freemerge,
//   partymerge), cards.computeHits (inspire, sharp), gifts.incoming (generous), deck.buildFight (innate), engine.startFight (герой).
window.BP = window.BP || {};

BP.Meta = (function () {
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const up = (x) => Math.ceil(x - 1e-9);
  const M = (state) => state.config.meta;
  const isOn = (state) => !!(state.config.meta && state.run);
  const TIERS = ["common", "uncommon", "rare"];

  // ---------- Карты героя ----------
  function heroCfg(state, hid) { return state.config.heroes.find((h) => h.id === hid); }

  function weaponOf(cfg, hc, cardId) {
    return (hc.weapons || []).find((w) => cfg.weapons[w] && cfg.weapons[w].cards[cardId]) || null;
  }

  function newSpec(state, hid, cardId) {
    const cfg = state.config;
    return { uid: "d" + state.seq++, id: cardId, weapon: weaponOf(cfg, heroCfg(state, hid), cardId), ups: {} };
  }

  // Пул новых карт героя: карты оружия + доп. карты героя + meta.extraPool (без повторов)
  function pool(state, hid) {
    const cfg = state.config, hc = heroCfg(state, hid), set = new Set();
    (hc.weapons || []).forEach((w) => Object.keys((cfg.weapons[w] || {}).cards || {}).forEach((c) => set.add(c)));
    Object.keys(hc.cards || {}).forEach((c) => set.add(c));
    ((M(state).extraPool || {})[hid] || []).forEach((c) => set.add(c));
    const no = new Set(M(state).noReward || []); // базовые карты стартовой колоды — не награда
    return [...set].filter((c) => cfg.cards[c] && !cfg.cards[c].weak && !no.has(c));
  }

  function rarityOf(state, cardId) {
    const c = state.config.cards[cardId], r = (M(state).cardRarity || {})[cardId];
    if (r) return r;
    if (c.evolve || c.cost >= 3) return "rare";
    if (c.cost >= 2) return "uncommon";
    return "common";
  }

  // ---------- Забег ----------
  function createRun(state) {
    const m = M(state);
    state.run = { decks: {}, relics: {}, map: null, node: null, visited: [], vote: null, floor: 0, fights: 0 };
    state.heroes.forEach((h) => {
      h.perm = { maxHp: 0, startBlock: 0, dmg: 0, block: 0 };
      const start = (m.start || {})[h.id] || {};
      const deck = [];
      Object.entries(start).forEach(([cid, n]) => { for (let i = 0; i < n; i++) deck.push(newSpec(state, h.id, cid)); });
      state.run.decks[h.id] = deck;
    });
    refreshView(state);
  }

  // Применить улучшения к только что собранной карте
  function apply(state, card, ups) {
    const m = M(state), u = ups || {};
    const plus = (v, n) => (m.upgradeMode === "flat" ? v + (m.upFlat || 3) * n : up(v * (1 + (m.upPercent || 0.5) * n)));
    if (u.up) {
      const bump = (effs) => (effs || []).forEach((e) => {
        if (e.type === "damage" || e.type === "block" || e.type === "blockSelf") e.amount = plus(e.amount, u.up);
      });
      bump(card.effects); if (card.alt) bump(card.alt.effects);
    }
    if (u.cheaper) card.cost = Math.max(0, card.cost - u.cheaper);
    if (u.draw) card.upDraw = u.draw;
    if (u.inspire) card.upInspire = u.inspire;
    if (u.feed) card.upFeed = u.feed;
    if (u.armorbreak) card.armorBreak = true;
    if (u.retain) card.retain = true;
    if (u.innate) card.innate = true;
    if (u.sharp) card.sharpPerm = u.sharp;
    if (u.freemerge) card.freeMerge = true;
    if (u.killenergy) card.upKillEnergy = u.killenergy;
    if (u.echo) card.echo = true;
    if (u.awaken && state.config.cards[u.awaken]) card.evolve = u.awaken;
    if (u.ignorecover) card.ignoreCover = true;
    if (u.generous) card.generous = true;
    card.ups = clone(u);
    card.upgraded = Object.keys(u).length > 0;
    card.text = BP.Cards.text(card);
    if (u.gift && u.gift.length) BP.Gifts.addPerm(card, u.gift); // пересобирает текст сам
    return card;
  }

  function build(state, hero, spec, makeCard) {
    const card = makeCard(state, spec.id, spec.weapon);
    card.spec = spec.uid;
    if (spec.evo) BP.MForge.buildEvo(card, spec.evo); // эволюция из мердж-кузни
    return apply(state, card, spec.ups);
  }

  // Готовые карты колоды забега — для окна «Колода» вне боя и экранов наград (считает хост)
  function refreshView(state) {
    const mk = BP.Engine && BP.Engine.makeCard;
    if (!mk) return;
    state.heroes.forEach((h) => {
      h.runCards = (state.run.decks[h.id] || []).map((sp) => Object.assign(build(state, h, sp, mk), { owner: h.id }));
    });
  }

  // ---------- Что можно улучшить ----------
  const hasDB = (c) => (c.effects || []).concat(c.alt ? c.alt.effects : []).some((e) => ["damage", "block", "blockSelf"].includes(e.type));
  const hasDmg = (c) => (c.effects || []).some((e) => e.type === "damage");

  // Подходит ли улучшение id готовой карте c (spec — её описание)
  function fits(state, id, c, spec) {
    const m = M(state), u = spec.ups || {};
    if (!m.multiUpgrade && Object.keys(u).length) return false;
    switch (id) {
      case "up": return hasDB(c);
      case "gift": return giftOptions(state, c).length > 0;
      case "draw": case "inspire": case "killenergy": case "echo": return !u[id] && (id === "inspire" || id === "killenergy" ? hasDmg(c) : true);
      case "feed": case "freemerge": case "generous": return !u[id] && !!c.gift;
      case "armorbreak": return hasDmg(c) && !c.armorBreak;
      case "cheaper": return c.cost > 0;
      case "retain": return !c.retain;
      case "innate": return !c.innate;
      case "sharp": return hasDmg(c) && !!c.weapon && !c.alwaysCrit && (state.config.weapons[c.weapon] || {}).critEvery > (c.sharpPerm || 0) + 1;
      case "awaken": return !c.evolve && hasDmg(c) && evolutions(state, c).length > 0;
      case "ignorecover": return c.attack === "melee" && !c.ignoreCover && hasDmg(c);
    }
    return false;
  }

  // Дары, которые можно положить карте навсегда (без повторов уже имеющихся постоянных)
  function giftOptions(state, c) {
    const have = new Set((c.ups && c.ups.gift) || []);
    return Object.keys(state.config.gifts || {}).filter((g) => !have.has(g) && g !== "taunt" && BP.Gifts.applicable(g, c));
  }

  // Эволюции оружия карты (для «Пробуждения»)
  function evolutions(state, c) {
    const cfg = state.config, w = c.weapon && cfg.weapons[c.weapon];
    if (!w) return [];
    return [...new Set(Object.keys(w.cards).map((id) => (cfg.cards[id] || {}).evolve).filter((e) => e && cfg.cards[e]))];
  }

  // ---------- Награды ----------
  function rollTier(weights) {
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < 3; i++) { r -= weights[i]; if (r < 0) return TIERS[i]; }
    return "common";
  }

  function cardOffer(state, hid, kind) {
    const m = M(state), rw = m.rewards[kind] || m.rewards.fight, deck = state.run.decks[hid];
    const early = state.run.fights < (m.dupeFrom || 1); // награды за первые 3 боя — без дублей
    if (deck.length && !early && Math.random() < (rw.dupe || 0)) {
      const sp = rand(deck);
      return { type: "dupe", spec: sp.uid, rarity: "common" };
    }
    const all = pool(state, hid);
    let tier = rollTier(rw.card || [70, 25, 5]), list = [];
    for (let i = TIERS.indexOf(tier); i >= 0 && !list.length; i--) list = all.filter((c) => rarityOf(state, c) === TIERS[i]);
    if (list.length < 2) list = list.concat(all.filter((c) => rarityOf(state, c) === "uncommon")); // бедный пул (маг) — не крутить одну карту
    if (!list.length) list = all;
    const cid = rand(list);
    return { type: "card", card: cid, rarity: rarityOf(state, cid) };
  }

  // Улучшение заданной редкости для героя hid. used — уже предложенные id (без повторов в одной награде)
  function upOffer(state, hid, tier, used, kind) {
    const m = M(state), h = state.heroes.find((x) => x.id === hid);
    // улучшения герою — не больше одного в награде и реже карточных (иначе вытесняют интересные улучшения карт)
    const heroUsed = [...used].some((id) => (m.upgrades[id] || {}).on === "hero");
    const ids = shuffle(Object.keys(m.upgrades).filter((id) => {
      const u = m.upgrades[id];
      if (u.tier !== tier || used.has(id)) return false;
      if (u.on === "hero" && (heroUsed || Math.random() < 0.5)) return false;
      if (u.treasureOnly) return kind === "treasure" && !state.run.relics[id];
      if (u.eliteOnly) return (kind === "elite" || kind === "treasure") && !state.run.relics[id];
      return true;
    }));
    for (const id of ids) {
      const u = m.upgrades[id];
      if (u.on === "hero" || u.on === "party") { used.add(id); return { type: "up", up: id, rarity: tier }; }
      const cand = shuffle(h.runCards.slice()).find((c) => fits(state, id, c, specOf(state, hid, c.spec)));
      if (!cand) continue;
      const o = { type: "up", up: id, spec: cand.spec, rarity: tier };
      if (id === "gift") o.gift = rand(giftOptions(state, cand));
      if (id === "awaken") o.evo = rand(evolutions(state, cand));
      used.add(id);
      return o;
    }
    return tier === "common" ? null : upOffer(state, hid, TIERS[TIERS.indexOf(tier) - 1], used, kind);
  }

  // Награда для всех героев. kind: fight | elite | treasure
  function makeReward(state, kind) {
    refreshView(state);
    const m = M(state), rw = m.rewards[kind] || m.rewards.fight, offers = {};
    // «На всю пати» — только в сокровище и только одному случайному герою
    const relicHero = kind === "treasure" || kind === "elite" ? rand(state.heroes).id : null;
    state.heroes.forEach((h) => {
      const used = new Set(), list = [cardOffer(state, h.id, kind)];
      let tiers = kind === "fight" ? ["common", "common"].map((t) => (Math.random() < (rw.uncommonChance || 0) ? "uncommon" : t)) : ["uncommon", "rare"];
      if (h.id !== relicHero) used.add("partymerge");
      tiers.forEach((t) => { const o = upOffer(state, h.id, t, used, kind); if (o) list.push(o); });
      list.forEach((o) => (o.preview = preview(state, h, o)));
      offers[h.id] = list;
    });
    state.reward = { id: state.seq++, kind, offers, picks: {} };
  }

  function specOf(state, hid, uid) { return (state.run.decks[hid] || []).find((s) => s.uid === uid); }

  // Как будет выглядеть карта после выбора (для экрана наград): готовая карта JSON
  function preview(state, hero, o) {
    const mk = BP.Engine.makeCard;
    if (o.type === "card") return Object.assign(apply(state, mk(state, o.card, weaponOf(state.config, heroCfg(state, hero.id), o.card)), {}), { owner: hero.id });
    const sp = o.spec && specOf(state, hero.id, o.spec);
    if (!sp) return null;
    if (o.type === "dupe") return Object.assign(build(state, hero, sp, mk), { owner: hero.id });
    const after = clone(sp);
    addUp(after.ups, o);
    return Object.assign(build(state, hero, after, mk), { owner: hero.id, before: build(state, hero, sp, mk).text });
  }

  function addUp(ups, o) {
    if (o.up === "gift") ups.gift = (ups.gift || []).concat(o.gift);
    else if (o.up === "awaken") ups.awaken = o.evo;
    else ups[o.up] = (ups[o.up] || 0) + 1;
  }

  // Выдать выбранное
  function grant(state, hero, o) {
    const deck = state.run.decks[hero.id];
    if (o.type === "card") { deck.push(newSpec(state, hero.id, o.card)); return `новая карта «${state.config.cards[o.card].name}»`; }
    if (o.type === "dupe") { const sp = specOf(state, hero.id, o.spec); if (!sp) return ""; const cp = clone(sp); cp.uid = "d" + state.seq++; deck.push(cp); return `копия «${state.config.cards[sp.id].name}»`; }
    const u = M(state).upgrades[o.up];
    if (u.on === "hero") {
      const p = hero.perm;
      if (o.up === "maxhp") { p.maxHp += 8; hero.maxHp += 8; hero.hp += 8; }
      if (o.up === "startblock") { p.startBlock += 2; hero.startBlockMax += 2; }
      if (o.up === "strength") p.dmg += 1;
      if (o.up === "fortitude") p.block += 1;
      return `${u.name}`;
    }
    if (u.on === "party") { state.run.relics[o.up] = true; return `${u.name} (всей пати)`; }
    const sp = specOf(state, hero.id, o.spec);
    if (!sp) return "";
    addUp(sp.ups, o);
    return `${u.name} → «${state.config.cards[sp.id].name}»`;
  }

  // Выбор награды героем: idx = номер варианта или -1 (пропуск)
  function pick(state, hero, idx) {
    const rw = state.reward;
    if (!rw) return "Нет награды";
    if (rw.picks[hero.id] !== undefined) return "Уже выбрано";
    const list = rw.offers[hero.id] || [];
    if (idx !== -1 && !list[idx]) return "Нет такого варианта";
    rw.picks[hero.id] = { idx, text: idx === -1 ? "пропустил" : grant(state, hero, list[idx]) };
    BP.Engine.log(state, hero.name, `награда: ${rw.picks[hero.id].text}`);
    refreshView(state);
    return null;
  }

  // ---------- Кузница: усилить одну карту или удалить одну (или пропустить) ----------
  function forge(state, hero, uid, op) {
    const fg = state.forge, deck = state.run.decks[hero.id];
    if (!fg) return "Не кузница";
    if (fg.done[hero.id]) return "Уже сделано";
    if (op === "skip") { fg.done[hero.id] = "пропустил"; return null; }
    const sp = specOf(state, hero.id, uid), c = sp && hero.runCards.find((x) => x.spec === uid);
    if (!sp || !c) return "Нет такой карты";
    if (op === "remove") {
      if (deck.length <= (M(state).minDeck || 0)) return `В колоде должно остаться не меньше ${M(state).minDeck} карт`;
      state.run.decks[hero.id] = deck.filter((s) => s !== sp);
      fg.done[hero.id] = `удалил «${c.name}»`;
    } else if (op === "up") {
      if (!fits(state, "up", c, sp)) return "Эту карту нельзя усилить";
      sp.ups.up = (sp.ups.up || 0) + 1;
      fg.done[hero.id] = `усилил «${c.name}»`;
    } else return "Неизвестно";
    BP.Engine.log(state, hero.name, `кузница: ${fg.done[hero.id]}`);
    refreshView(state);
    return null;
  }

  // Можно ли усилить карту в кузнице (для UI)
  const canForgeUp = (state, hero, c) => { const sp = specOf(state, hero.id, c.spec); return !!sp && fits(state, "up", c, sp); };

  // ---------- Костёр ----------
  function camp(state) {
    const k = M(state).campHeal || 0.3, out = [];
    state.heroes.forEach((h) => {
      const heal = up(h.maxHp * k);
      if (!h.alive) { h.alive = true; h.hp = 0; }
      const before = h.hp;
      h.hp = Math.min(h.maxHp, h.hp + heal);
      out.push({ hero: h.id, healed: h.hp - before });
    });
    state.campResult = out;
    BP.Engine.log(state, "Пати", "отдохнула у костра", { detail: out.map((o) => `${state.heroes.find((h) => h.id === o.hero).name} +${o.healed} ХП`).join(", ") });
  }

  // Подписи для UI
  function offerTitle(state, o) {
    if (o.type === "card") return "Новая карта";
    if (o.type === "dupe") return "Копия карты";
    const u = M(state).upgrades[o.up];
    return `${u.icon} ${u.name}${o.up === "gift" ? ": " + ((state.config.gifts[o.gift] || {}).name || o.gift) : ""}`;
  }
  function offerText(state, o) {
    if (o.type === "card") return "карта добавится в колоду";
    if (o.type === "dupe") return "ещё одна такая же карта (со всеми её улучшениями)";
    const u = M(state).upgrades[o.up];
    if (o.up === "up") return M(state).upgradeMode === "flat" ? `+${M(state).upFlat} урона или блока карте` : `+${Math.round(M(state).upPercent * 100)}% урона или блока карте`;
    if (o.up === "gift") return `постоянный дар «${(state.config.gifts[o.gift] || {}).name}»: ${(state.config.gifts[o.gift] || {}).text}`;
    if (o.up === "awaken") return `эволюционирует в «${(state.config.cards[o.evo] || {}).name}»`;
    return u.text;
  }

  return { isOn, createRun, build, apply, refreshView, makeReward, pick, forge, canForgeUp, camp, offerTitle, offerText, specOf, pool, rarityOf, TIERS };
})();
