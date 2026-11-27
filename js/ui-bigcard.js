// Крупная карта при наведении (wide-range, правки 25.11; правки 27.11 — минимум букв).
// Навёл на карту в руке — над ней выезжает большая карта: те же две рамки значков, что на миниатюре (js/ui-cardfx.js),
// короткий текст («9 урона. Цепь 7. Экзост.») и поле «Мердж», если у карты есть эффект мерджа.
// Подержал ещё секунду — сбоку подробные подсказки по каждому значку (js/ui-cardtip.js).
// html(state, hero, card) используется и в наградах (js/ui-meta.js) — там та же карта крупно.
window.BP = window.BP || {};

BP.BigCard = (function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  const KIND = { attack: "Атака", block: "Защита", skill: "Умение", aoe: "Массовка", power: "Power" };
  const ATTACK = { melee: "мили — бьёт только открытых врагов", ranged: "дальняя — бьёт любого врага", aoe: "массовка — по фигуре клеток" };
  const ATTACK_SHORT = { melee: "мили", ranged: "дальняя", aoe: "массовка" };
  // Основной текст словами: «Наносит 5 урона, даёт себе 5 блока» (без эффектов мерджа и ключевых слов — они отдельно)
  function body(card) {
    if (card.junk) return "Мусорная карта от врага. Сыграть нельзя.";
    const plain = Object.assign({}, card, { mfx: [], power: false, ex: false, innate: false, retain: false, donor: null });
    let t = BP.Cards.text(plain);
    t = t.replace(/^(\d+) урона/, "Наносит $1 урона")
      .replace(/(^|, )себе (\d+) блока/g, "$1даёт себе $2 блока")
      .replace(/(^|, )(\d+) блока цели/g, "$1даёт цели $2 блока")
      .replace(/(^|, )(\d+) блока/g, "$1даёт $2 блока")
      .replace(/(^|, )толкнуть/g, "$1толкает").replace(/(^|, )оглушить/g, "$1оглушает").replace(/(^|, )притянуть/g, "$1притягивает")
      .replace(/(^|, )взять (\d+)/g, "$1берёт $2").replace(/(^|, )Потерять (\d+) ХП/g, "$1теряет $2 ХП").replace(/(^|, )потерять (\d+) ХП/g, "$1теряет $2 ХП");
    t = cap(t);
    return t ? t + (/[.!?]$/.test(t) ? "" : ".") : "";
  }

  // Короткий текст: «9 урона. Цепь 7. Экзост.» — урон «как сейчас» (доп. урон красным), дальше слова значков
  function shortText(state, hero, card, act) {
    if (card.junk) return "Мусор от врага. Сыграть нельзя.";
    const out = [], dn = BP.CardFx.damageNow(state, hero, card);
    if (dn) out.push(`<span class="${dn.v > dn.base ? "dmg-up" : dn.v < dn.base ? "dmg-down" : ""}">${dn.v}${dn.hits > 1 ? "×" + dn.hits : ""}</span> урона`);
    const blk = (card.effects || []).filter((e) => e.type === "block" || e.type === "blockSelf" || e.type === "blockHero").reduce((a, e) => a + e.amount, 0);
    if (blk) out.push(`+${blk} брони${card.target === "hero" ? " герою" : ""}`);
    act.filter((x) => !x.merge && !/^\d+ удара$/.test(x.word)).forEach((x) => out.push(esc(x.word)));
    return out.length ? out.join(". ") + "." : "";
  }

  // Полная крупная карта. opts.highlight — html плашки «что добавится» (награда «Улучшение карты»)
  // 27.11: минимум букв — рамки значков, короткий текст, одно поле «Мердж» (только если эффект мерджа есть).
  //   Подробности (что такое Цепь, Экзост…) — боковые подсказки через 1 с (js/ui-cardtip.js).
  function html(state, hero, card, opts) {
    opts = opts || {};
    const kind = card.power ? "power" : BP.Wide && BP.Wide.on(state) ? BP.Wide.kindOf(card) : BP.Cards.kind(card);
    const kc = BP.Icons.KIND_COLOR[BP.Cards.kind(card)] || "#888";
    const act = BP.CardFx.active(state, hero, card), pot = BP.CardFx.potential(state, card);
    const type = `${KIND[kind] || "Карта"}${card.attack && ATTACK_SHORT[card.attack] ? " · " + ATTACK_SHORT[card.attack] : ""}`;
    const merge = pot.length ? `<div class="bc-merge"><div class="bc-sec">Мердж</div>${pot.map((x) => `<div class="bc-mfx">${x.cond ? `<i>${esc(x.cond)}→</i>` : ""}<span class="bc-mi">${esc(x.icon)}</span>${esc(x.word)}</div>`).join("")}</div>` : "";
    return `<div class="bigcard k-${esc(kind)}" style="--kc:${kc}">
      <div class="bc-head"><span class="bc-cost">${card.cost}⚡</span><span class="bc-name">${esc(card.name)}</span></div>
      <div class="bc-frames">${BP.CardFx.frames(state, hero, card)}</div>
      <div class="bc-type">${esc(type)}</div>
      <div class="bc-art">${BP.Icons.svg(card.icon || "bash")}</div>
      <div class="bc-text">${shortText(state, hero, card, act)}</div>
      ${opts.highlight || ""}
      ${merge}
    </div>`;
  }

  return { html, body };
})();
