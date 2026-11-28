// Мета забега (ветка beta-meta, 11.11): колода забега героя, улучшения карт и героя, награды, кузница, костёр.
// Колода забега — список «описаний» карт: { uid, id, weapon, ups: {...} }. В начале каждого боя из них заново
// собираются карты (engine.makeCard + apply), поэтому мердж и эволюция живут только до конца боя, а улучшения — весь забег.
// Улучшения (config.meta.upgrades):
//   на карту: up (урон/блок +50% или +3), gift (постоянный дар), draw, inspire, feed, guardup (вместо armorbreak, 26.11), fury, cheaper, retain, innate,
//             sharp, freemerge, killenergy, echo, awaken, ignorecover, generous;
//   герою:    maxhp, startblock, strength, fortitude (h.perm; 26.11 — +2, но −8 макс. ХП);  пати: partymerge (state.run.relics).
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
    const c = state.config.cards[cardId], r = (M(state).cardRarity || {})[cardId] || c.rarity; // wide-range: cards.*.rarity
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
    if (u.echo) { card.echo = true; card.echoCost = 3; } // правки 26.11: «Кровавое эхо» — возврат стоит 3 ХП
    if (u.fury) { (card.effects || []).forEach((e) => { if (e.type === "damage") e.amount *= 2; }); card.ex = true; } // «Вспышка»: урон ×2, но Exhaust
    if (u.guardup) card.upBlock = 3 * u.guardup; // «Щиток»
    if (u.awaken && state.config.cards[u.awaken]) card.evolve = u.awaken;
    if (u.ignorecover) card.ignoreCover = true;
    if (u.generous) card.generous = true;
    if (u.capup) card.capUp = u.capup; // 28.11: «Размах» — кап мерджа (число, не счётчик)
    if (u.extra) card.extraDmg = (card.extraDmg || 0) + 2 * u.extra; // 28.11: «Доп. урон»
    if (u.cleanse) card.upCleanse = true;
    if (u.drawfree) card.drawFree = true;
    if (u.mfx && u.mfx.length && BP.Wide) BP.Wide.addFx(state, card, u.mfx); // wide-range: эффекты мерджа из наград
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

  // Кап мерджа карты (плашка mergeFx с do.flat): число или null
  function capFlat(c) { const f = (c.mfx || []).find((x) => x.do && x.do.flat !== undefined); return f ? Math.max(f.do.flat, c.capUp || 0) : null; }
  const capValue = (state, kind) => (M(state).capByKind || {})[kind] || 4;

  // Подходит ли улучшение id готовой карте c (spec — её описание)
  function fits(state, id, c, spec) {
    const m = M(state), u = spec.ups || {};
    if (!m.multiUpgrade && Object.keys(u).length) return false;
    switch (id) {
      case "up": return hasDB(c);
      case "gift": return !(BP.Wide && BP.Wide.on(state)) && giftOptions(state, c).length > 0; // wide-range: даров нет
      case "draw": case "inspire": case "killenergy": case "echo": return !u[id] && (id === "inspire" || id === "killenergy" ? hasDmg(c) : true);
      case "feed": case "freemerge": case "generous": return !u[id] && !!c.gift;
      case "armorbreak": return hasDmg(c) && !c.armorBreak;
      case "fury": return hasDmg(c) && !u.fury && !c.power && !c.ex; // правки 26.11
      case "guardup": return !u.guardup && !c.power;
      case "cheaper": return c.cost > 0;
      case "retain": return !c.retain;
      case "innate": { // wide-range: не больше meta.innateMax Innate-карт в колоде героя
        const h = state.heroes.find((x) => x.id === c.owner), n = h ? (h.runCards || []).filter((x) => x.innate).length : 0;
        return !c.innate && n < (m.innateMax || 99);
      }
      case "sharp": return hasDmg(c) && !!c.weapon && !c.alwaysCrit && (state.config.weapons[c.weapon] || {}).critEvery > (c.sharpPerm || 0) + 1;
      case "awaken": return !c.evolve && hasDmg(c) && evolutions(state, c).length > 0;
      case "ignorecover": return c.attack === "melee" && !c.ignoreCover && hasDmg(c);
      case "capup": return !u.capup && capFlat(c) !== null && capFlat(c) < 4; // есть плашка «максимум +N» меньше +4
      case "extra": return hasDmg(c) && !c.power;
      case "cleanse": return !u.cleanse && !hasDmg(c) && !c.power && !c.unplayable;
      case "drawfree": return !u.drawfree && c.cost > 0 && !c.innate;
      case "mfx": return !!BP.Wide && BP.Wide.rewardFx(state, c).length > 0;
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
  // Псевдорандом «ведром» (wide-range, 24.11): в ведре каждый вариант лежит w раз; вытянутое из ведра уходит.
  // Пока ведро полное — шансы как по весам; когда частое уже вытянуто, остаток тянется без процентов, поэтому
  // редкое гарантированно выпадет за один цикл ведра. Ведро пустое (или в нём нет подходящего) — наполняется заново.
  function bag(state, key, items) {
    if (!items.length) return null;
    const bags = state.run.bags || (state.run.bags = {}), ok = new Set(items.map((x) => x.id));
    let b = (bags[key] || []).filter((id) => ok.has(id));
    if (!b.length) { b = []; items.forEach((x) => { for (let i = 0; i < Math.max(1, Math.round(x.w)); i++) b.push(x.id); }); }
    const k = Math.floor(Math.random() * b.length), id = b[k];
    b.splice(k, 1);
    bags[key] = (bags[key] || []).filter((x) => !ok.has(x)).concat(b);
    return id;
  }

  // Случайный эффект мерджа по весам [{id, w}]
  function weighted(list) {
    const sum = list.reduce((a, x) => a + x.w, 0);
    let r = Math.random() * sum;
    for (const x of list) { r -= x.w; if (r < 0) return x.id; }
    return list.length ? list[list.length - 1].id : null;
  }

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
    // правки 26.11: хорошая защита в наградах — если в колоде меньше 2 небазовых карт с бронёй, часто предлагаем защиту
    const cards = state.config.cards, no = new Set(m.noReward || []);
    const isDef = (id) => (cards[id].effects || []).some((e) => /^block/.test(e.type) || e.type === "barrier");
    const defs = deck.filter((sp) => !no.has(sp.id) && cards[sp.id] && isDef(sp.id)).length;
    // 27.11: защиты и так много — подкидываем реже (было: меньше 2 — в половине случаев)
    if (defs < 1 && Math.random() < 0.3) { const d = list.filter(isDef); if (d.length) list = d; else { const d2 = all.filter((c) => isDef(c) && rarityOf(state, c) !== "rare"); if (d2.length) list = d2; } }
    // в первых боях — чаще карты с эффектами мерджа (мердж нужен с начала забега)
    else if (state.run.fights < 4 && Math.random() < 0.6) { const mf = list.filter((id) => (cards[id].mfx || []).length); if (mf.length) list = mf; }
    const cid = rand(list);
    return { type: "card", card: cid, rarity: rarityOf(state, cid) };
  }

  // Улучшение заданной редкости для героя hid. used — уже предложенные id (без повторов в одной награде)
  function upOffer(state, hid, tier, used, kind) {
    const m = M(state), h = state.heroes.find((x) => x.id === hid);
    // улучшения герою — не больше одного в награде и реже карточных (иначе вытесняют интересные улучшения карт)
    const heroUsed = [...used].some((id) => (m.upgrades[id] || {}).on === "hero");
    const ids0 = shuffle(Object.keys(m.upgrades).filter((id) => {
      const u = m.upgrades[id];
      if ((u.tier !== tier && !(u.tiers || []).includes(tier)) || used.has(id)) return false; // 28.11: tiers — улучшение в нескольких редкостях
      if (id === "startblock" && !((state.config.tests || {}).startBlock || {}).enabled) return false; // правки 25.11: без стартовой брони — бесполезно
      if (u.on === "hero" && (heroUsed || Math.random() < 0.5)) return false;
      if (u.treasureOnly) return kind === "treasure" && !state.run.relics[id];
      if (u.eliteOnly) return (kind === "elite" || kind === "treasure") && !state.run.relics[id];
      return true;
    }));
    // wide-range: вид улучшения тянется из «ведра» (псевдорандом): редкое (w меньше) гарантированно выпадет за цикл ведра
    const okIds = ids0.filter((id) => { const u = m.upgrades[id]; return u.on !== "card" || h.runCards.some((c) => fits(state, id, c, specOf(state, hid, c.spec))); });
    const first = okIds.length ? bag(state, "up:" + hid + ":" + tier, okIds.map((id) => ({ id, w: m.upgrades[id].w || 2 }))) : null;
    const ids = first ? [first].concat(ids0.filter((id) => id !== first)) : ids0;
    for (const id of ids) {
      const u = m.upgrades[id];
      if (u.on === "hero" || u.on === "party") { used.add(id); return { type: "up", up: id, rarity: tier }; }
      const fitting = shuffle(h.runCards.slice()).filter((c) => fits(state, id, c, specOf(state, hid, c.spec)) && (id !== "capup" || capFlat(c) < capValue(state, kind)));
      // Innate — чаще на Power (их хочется иметь с начала боя)
      const cand = id === "innate" && Math.random() < 0.7 ? fitting.find((c) => c.power) || fitting[0] : fitting[0];
      if (!cand) continue;
      const o = { type: "up", up: id, spec: cand.spec, rarity: tier };
      if (id === "gift") o.gift = rand(giftOptions(state, cand));
      if (id === "awaken") o.evo = rand(evolutions(state, cand));
      if (id === "capup") o.cap = capValue(state, kind);
      if (id === "mfx") o.mfx = bag(state, "mfx:" + cand.id, BP.Wide.rewardFx(state, cand));
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
      // правки 25.11: три варианта — новая карта / ОДНО улучшение (карты или героя) / пропустить (rw.ups — сколько улучшений)
      let tiers = (kind === "fight" ? ["common", "common"].map((t) => (Math.random() < (rw.uncommonChance || 0) ? "uncommon" : t)) : ["rare", "uncommon"]).slice(0, rw.ups || 1);
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
    else if (o.up === "mfx") ups.mfx = (ups.mfx || []).concat(o.mfx);
    else if (o.up === "awaken") ups.awaken = o.evo;
    else if (o.up === "capup") ups.capup = Math.max(ups.capup || 0, o.cap || 4);
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
      // правки 26.11 (риск / награда): +2 навсегда, но −8 макс. ХП
      if (o.up === "strength" || o.up === "fortitude") { hero.maxHp = Math.max(10, hero.maxHp - 8); p.maxHp -= 8; hero.hp = Math.min(hero.hp, hero.maxHp); }
      if (o.up === "strength") p.dmg += 2;
      if (o.up === "fortitude") p.block += 2;
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
    if (o.up === "mfx") { const f = (state.config.mergeFx || {})[o.mfx] || {}; return `${BP.CardFx ? BP.CardFx.mfxItem(f).icon : "✦"} Эффект мерджа`; }
    return `${u.icon} ${u.name}${o.up === "gift" ? ": " + ((state.config.gifts[o.gift] || {}).name || o.gift) : ""}`;
  }
  function offerText(state, o) {
    if (o.type === "card") return "карта добавится в колоду";
    if (o.type === "dupe") return "ещё одна такая же карта (со всеми её улучшениями)";
    const u = M(state).upgrades[o.up];
    if (o.up === "up") return M(state).upgradeMode === "flat" ? `+${M(state).upFlat} урона или брони` : `+${Math.round(M(state).upPercent * 100)}% урона или брони`;
    if (o.up === "gift") return `постоянный дар «${(state.config.gifts[o.gift] || {}).name}»: ${(state.config.gifts[o.gift] || {}).text}`;
    if (o.up === "capup") return `мердж в эту карту даёт до +${o.cap || 4} урона`;
    if (o.up === "awaken") return `эволюционирует в «${(state.config.cards[o.evo] || {}).name}»`;
    if (o.up === "mfx") { const f = (state.config.mergeFx || {})[o.mfx] || {}; return `Мердж: ${String(f.text || o.mfx).replace(/^Мердж:\s*/, "")}`; }
    return u.text + (u.risk ? `, ${u.risk}` : ""); // 27.11: коротко — «урон карты ×2, Экзост»
  }

  return { isOn, createRun, build, apply, refreshView, makeReward, pick, forge, canForgeUp, camp, offerTitle, offerText, specOf, pool, rarityOf, TIERS };
})();
