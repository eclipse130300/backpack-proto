// Мердж-кузня (ветка beta-meta, 11.11): узел карты сразу за элитой. Мердж работает как в бою — карта одного героя
// отдаётся на карту другого: та получает дар (и все дары отданной), две готовые эволюционные карты — эволюция.
// Но результат НАВСЕГДА (до конца забега): в колоду владельца второй карты кладётся новая карта.
// meta.mforgeDestroy: true — обе исходные карты уничтожаются; false — остаются (колода +1).
// «Готова к эволюции» в кузне = у карты уже есть постоянный дар (её мерджили в кузне раньше) — как ★ в бою.
// Каждый герой отдаёт не больше одной карты за посещение (или пропускает).
window.BP = window.BP || {};

BP.MForge = (function () {
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const M = (state) => state.config.meta;

  // Копия готовой карты для расчёта: постоянные дары считаются «мерджем» (для эволюции)
  function primed(card) {
    const c = clone(card);
    if ((c.permGifts || []).length) c.merged = c.permGifts.length;
    return c;
  }

  function cardsOf(state, hid, uid) {
    const h = state.heroes.find((x) => x.id === hid);
    return h && (h.runCards || []).find((c) => c.spec === uid);
  }

  // Что получится: { card — готовая новая карта, spec — её описание для колоды, evo — эволюция ли } или null
  function result(state, giverId, uidA, allyId, uidB) {
    if (!giverId || giverId === allyId) return null;
    const A = cardsOf(state, giverId, uidA), B = cardsOf(state, allyId, uidB);
    const sb = BP.Meta.specOf(state, allyId, uidB);
    if (!A || !B || !sb) return null;
    const ca = primed(A), cb = primed(B);
    if (!BP.Cards.canMerge(state, ca, cb)) return null;
    if (!BP.Cards.mergeInto(state, ca, cb, giverId)) return null;
    const gifts = (cb.gifts || []).map((g) => g.id);
    let spec;
    if (cb.evolvedFrom) {
      const d = ((cb.giftBase || cb).effects || []).find((e) => e.type === "damage");
      spec = { uid: null, id: cb.id, weapon: sb.weapon, ups: gifts.length ? { gift: gifts } : {},
        evo: { dmg: d ? d.amount : 0, cost: cb.cost, from: cb.evolvedFrom } };
    } else {
      spec = clone(sb);
      spec.ups.gift = gifts;
    }
    return { card: cb, spec, evo: !!cb.evolvedFrom };
  }

  function apply(state, giver, uidA, ally, uidB) {
    const mf = state.mforge;
    if (!mf) return "Не мердж-кузня";
    if (mf.done[giver.id]) return "Этот герой уже отдал карту";
    if (!ally || ally.id === giver.id) return "Мердж — только на карту другого героя";
    const r = result(state, giver.id, uidA, ally.id, uidB);
    if (!r) return "Эти карты не мерджатся (нет подходящего дара)";
    const destroy = M(state).mforgeDestroy !== false;
    const dg = state.run.decks[giver.id];
    if (destroy && dg.length <= (M(state).minDeck || 0)) return `У героя ${giver.name} в колоде должно остаться не меньше ${M(state).minDeck} карт`;
    const A = cardsOf(state, giver.id, uidA), B = cardsOf(state, ally.id, uidB);
    r.spec.uid = "d" + state.seq++;
    if (destroy) {
      state.run.decks[giver.id] = dg.filter((s) => s.uid !== uidA);
      state.run.decks[ally.id] = state.run.decks[ally.id].filter((s) => s.uid !== uidB);
    }
    state.run.decks[ally.id].push(r.spec);
    mf.done[giver.id] = `«${A.name}» → «${B.name}» = «${r.card.name}»${r.evo ? " (эволюция!)" : ""}`;
    BP.Engine.log(state, giver.name, `мердж-кузня: ${mf.done[giver.id]}`, { detail: destroy ? "исходные карты уничтожены" : "исходные карты остались" });
    BP.Meta.refreshView(state);
    return null;
  }

  function skip(state, hero) {
    const mf = state.mforge;
    if (!mf) return "Не мердж-кузня";
    if (mf.done[hero.id]) return "Уже сделано";
    mf.done[hero.id] = "пропустил";
    return null;
  }

  // Сборка карты-эволюции из описания (spec.evo): урон, стоимость, откуда; в руке не сгорает (как в бою)
  function buildEvo(card, evo) {
    const d = (card.effects || []).find((e) => e.type === "damage");
    if (d && evo.dmg) d.amount = evo.dmg;
    if (evo.cost !== undefined) card.cost = evo.cost;
    card.evolvedFrom = evo.from;
    card.retain = true;
    return card;
  }

  // Для ботов: случайный допустимый мердж героя hid (или null)
  function randomMerge(state, hid) {
    const h = state.heroes.find((x) => x.id === hid), others = state.heroes.filter((x) => x.id !== hid);
    const pairs = [];
    (h.runCards || []).forEach((a) => others.forEach((o) => (o.runCards || []).forEach((b) => pairs.push([a.spec, o.id, b.spec]))));
    for (let i = pairs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pairs[i], pairs[j]] = [pairs[j], pairs[i]]; }
    for (const p of pairs.slice(0, 60)) if (result(state, hid, p[0], p[1], p[2])) return p;
    return null;
  }

  return { result, apply, skip, buildEvo, randomMerge };
})();
