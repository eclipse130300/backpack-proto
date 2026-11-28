// Крупная карта при наведении (wide-range, правки 25.11 → 27.11 → 28.11).
// 28.11: без значков, только слова. Сверху вниз: цена и имя → тип → картинка → описание → поле «Мердж» (синяя рамка).
//   Описание: своё — белым, полученное — зелёным (сначала улучшения забега, потом эффекты мерджа), коротко: «Блокирует 1 удар».
//   Мердж — словами с мини-иконками: «Карта стоит 2+⚡ → Барьер 🔰 +1». Дефолтные правила мерджа не пишем.
// Подержал ещё секунду — сбоку подробные подсказки по каждому эффекту (js/ui-cardtip.js).
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

  // Описание: «Наносит 9 урона. Прыгает на соседа: 7 урона.» — своё белым, полученное зелёным
  function desc(state, hero, card, act) {
    if (card.junk) return "Мусор от врага. Сыграть нельзя.";
    const base = [], gain = [], dn = BP.CardFx.damageNow(state, hero, card);
    if (dn) base.push(`Наносит <span class="${dn.v > dn.base ? "dmg-up" : dn.v < dn.base ? "dmg-down" : ""}">${dn.v}</span> урона${dn.hits > 1 ? ` ${dn.hits} раза` : ""}`);
    const sum = (types) => (card.effects || []).filter((e) => types.includes(e.type)).reduce((a, e) => a + e.amount, 0);
    const toHero = card.target === "hero" || card.target === "ally";
    const b1 = sum(toHero ? ["block"] : ["block", "blockSelf", "blockHero"]), b2 = toHero ? sum(["blockSelf", "blockHero"]) : 0;
    if (b1) base.push(`Даёт ${toHero ? "цели " : ""}${b1} брони`);
    if (b2) base.push(`Себе ${b2} брони`);
    act.forEach((x) => { if (x.say) (x.gain === "base" ? base : gain).push(esc(x.say)); });
    const j = (a) => a.join(". ") + (a.length ? "." : "");
    return `${j(base)}${gain.length ? ` <span class="bc-gain">${j(gain)}</span>` : ""}`;
  }

  // Полная крупная карта. opts.highlight — html плашки «что добавится» (награда «Улучшение карты»)
  function html(state, hero, card, opts) {
    opts = opts || {};
    const kind = card.power ? "power" : BP.Wide && BP.Wide.on(state) ? BP.Wide.kindOf(card) : BP.Cards.kind(card);
    const kc = BP.Icons.KIND_COLOR[BP.Cards.kind(card)] || "#888";
    const act = BP.CardFx.active(state, hero, card), pot = BP.CardFx.potential(state, card);
    const type = `${KIND[kind] || "Карта"}${card.attack && ATTACK_SHORT[card.attack] ? " · " + ATTACK_SHORT[card.attack] : ""}`;
    const merge = pot.length ? `<div class="bc-merge"><div class="bc-sec">Мердж</div>${pot.map((x) => `<div class="bc-mfx">${x.fxSay}</div>`).join("")}</div>` : "";
    return `<div class="bigcard k-${esc(kind)}" style="--kc:${kc}">
      <div class="bc-head"><span class="bc-cost">${card.cost}⚡</span><span class="bc-name">${esc(card.name)}</span></div>
      <div class="bc-type">${esc(type)}</div>
      <div class="bc-art">${BP.Icons.svg(card.icon || "bash")}</div>
      <div class="bc-text">${desc(state, hero, card, act)}</div>
      ${opts.highlight || ""}
      ${merge}
    </div>`;
  }

  return { html, body };
})();
