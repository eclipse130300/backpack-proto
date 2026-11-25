// «Обдуманный мердж» (wide-range, правки 25.11, тест против квотербека) — tests.merge.deliberate.
// Карты героев ДРУГИХ игроков скрыты: видно только число рубашек. Игрок выкладывает свою карту для мерджа
// (клик по карте → «Выложить для мерджа»): она выдвигается вперёд крупно и видна всем, любой союзник может в неё вмерджить.
// У героя выложена максимум одна карта; повторное нажатие убирает её. Карта уходит со стола, когда её сыграли,
// в неё вмерджили (донор у карты один) или закончился ход. Один игрок за всех героев видит всё (скрываются только чужие руки).
// Состояние: state.offers = { heroId: uid карты }. Действие: {a: "offer", hero, card} (card пустой — убрать).
window.BP = window.BP || {};

BP.Offer = (function () {
  const on = (state) => !!(state && state.config.tests.merge && state.config.tests.merge.deliberate);

  // Выложенная карта героя (или null). Ссылка устаревает сама: карты нет в руке или в неё уже вмерджили
  function offered(state, h) {
    const uid = on(state) && state.offers && state.offers[h.id];
    const c = uid && h.hand.find((x) => x.uid === uid);
    return c && !c.donor ? c : null;
  }

  // Скрыта ли рука героя h от игрока myPid
  function hidden(state, h, myPid) {
    return on(state) && !!h.owner && h.owner !== myPid && (state.phase === "players" || state.phase === "enemies");
  }

  // Выложить / убрать карту. Ошибка — текст, иначе null
  function toggle(state, hero, uid) {
    if (!on(state)) return "Обдуманный мердж выключен";
    state.offers = state.offers || {};
    if (!uid || state.offers[hero.id] === uid) { delete state.offers[hero.id]; return null; }
    const c = hero.hand.find((x) => x.uid === uid);
    if (!c) return "Карты нет в руке";
    const ok = BP.Wide && BP.Wide.on(state) ? BP.Wide.mergeable(c) && !c.donor : BP.Gifts.mergeable(c);
    if (!ok) return "В эту карту нельзя вмерджить";
    state.offers[hero.id] = uid;
    BP.Engine.log(state, hero.name, `выкладывает для мерджа «${c.name}»`);
    return null;
  }

  // Можно ли игроку pid мерджить в карту allyCard героя ally
  function mergeBlock(state, pid, ally, allyCard) {
    if (!on(state) || ally.owner === pid) return null;
    const c = offered(state, ally);
    return c && c.uid === allyCard.uid ? null : "Карта союзника не выложена для мерджа — попроси его выложить карту";
  }

  function clear(state) { state.offers = {}; }

  return { on, offered, hidden, toggle, mergeBlock, clear };
})();
