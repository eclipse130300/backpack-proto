// Крупная карта при наведении (wide-range, правки 25.11 — «читаемость карт»).
// Навёл на карту в руке — над ней выезжает большая карта: эффект написан словами, эффект мерджа — отдельным полем,
// ключевые слова (Power, Exhaust, Рикошет…) — пояснения внизу. Клик по карте её сворачивает (дальше выбираешь цель).
// Маленькие карты в руке остаются с иконками (js/ui-cardtip.js → faceHtml).
// html(state, hero, card) используется и в наградах (js/ui-meta.js) — там та же карта крупно.
window.BP = window.BP || {};

BP.BigCard = (function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  const KIND = { attack: "Атака", block: "Защита", skill: "Умение", aoe: "Массовка", power: "Power" };
  const ATTACK = { melee: "мили — бьёт только открытых врагов", ranged: "дальняя — бьёт любого врага", aoe: "массовка — по фигуре клеток" };
  const SIDE = {
    in: { icon: "🟩", label: "Только когда в эту карту вмерджили" },
    out: { icon: "🟥", label: "Только когда эту карту отдаёшь" },
    both: { icon: "🟪", label: "Мердж (отдал или вмерджили) — бонус герою получаешь ты" }
  };

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

  // Урон сейчас с учётом Силы / Слабости героя
  function nowDamage(hero, card) {
    const d = (card.effects || []).find((e) => e.type === "damage");
    if (!d || !hero || card.dmgFromBlock || card.perHand) return null;
    const v = Math.max(0, d.amount + (hero.dmgBuff || 0) * (card.strMult || 1) - BP.Cards.weakness(hero) + (card.attack === "aoe" ? hero.aoeBonus || 0 : 0));
    return v !== d.amount ? v : null;
  }

  // Ключевые слова и пояснения (берём «длинные» объяснения из частей карты, только для слов-механик)
  function keywords(state, hero, card) {
    const out = [];
    const k = (name, text) => out.push(`<div class="bc-kw"><b>${esc(name)}</b> — ${esc(text)}</div>`);
    if (card.power) k("Power", "эффект на весь бой; после розыгрыша карта уходит до конца боя, не мерджится.");
    if (card.ex && !card.power) k("Exhaust", "после розыгрыша карта уходит до конца боя.");
    if (card.retain) k("Удержание", "не сбрасывается в конце хода.");
    if (card.innate) k("Innate", "всегда в первой руке боя.");
    if (card.ricochet) k("Рикошет", "перед ударом выбираешь направление: сосед цели в эту сторону тоже получает урон.");
    if (card.chain) k("Цепь", "после удара прыгает на соседнего врага с наименьшим ХП.");
    if (card.armorBreak) k("По броне ×2", "урон по броне врага удваивается.");
    if ((card.effects || []).some((e) => e.type === "push")) k("Толчок", "толкнутый враг меняет цель; врезался в другого врага — оба получают Уязвимость.");
    if ((card.effects || []).some((e) => e.type === "trap")) k("Ловушка", "ставится на клетку, срабатывает, когда туда бьёт лучник, толкают врага или он там появляется.");
    if (card.ignoreCover) k("Сквозь прикрытие", "мили, но бьёт и врага, которого прикрывают спереди.");
    if (card.unplayable) k("Мусор", "сыграть нельзя; если осталась в руке в конце хода — исчезает до конца боя.");
    if (card.noMerge && !card.power && !card.unplayable) k("Не мерджится", "эту карту нельзя отдать и в неё нельзя вмерджить.");
    return out.join("");
  }

  function mergeField(state, card) {
    const mfx = card.mfx || [];
    let rows = mfx.map((f) => { const S = SIDE[f.side] || SIDE.in; return `<div class="bc-mfx ${f.side}"><span>${S.icon}</span><div><small>${esc(S.label)}</small>${esc(f.text)}</div></div>`; }).join("");
    if (card.donor) rows += `<div class="bc-mfx donor"><span>★</span><div><small>Уже вмерджено: ${card.merged || 1}</small>${esc(BP.Wide.donorNames(card))}: урон и эффекты прибавлены. После розыгрыша карты распадутся.${(card.fired || []).length ? " Сработало: " + esc(BP.Wide.firedText(card)) + "." : ""}</div></div>`;
    const mergeable = BP.Wide && BP.Wide.mergeable(card);
    if (!rows) rows = `<div class="bc-mfx none">${mergeable ? "Эффекта мерджа нет. Мердж просто складывает урон и эффекты карт." : "Эту карту нельзя мерджить."}</div>`;
    return `<div class="bc-merge"><div class="bc-sec">При мердже</div>${rows}</div>`;
  }

  function ups(state, card, skip) {
    const U = (state.config.meta || {}).upgrades || {}, u = card.ups || {};
    return Object.keys(u).filter((id) => U[id] && u[id] && id !== skip).map((id) => `<div class="bc-up">${esc(U[id].icon || "")} <b>${esc(U[id].name)}</b> — ${esc(U[id].text)}${U[id].risk ? ` <span class="bc-riskt">(минус: ${esc(U[id].risk)})</span>` : ""}</div>`).join("");
  }

  // Полная крупная карта. opts.highlight — html плашки «что добавится» (награда «Улучшение карты»)
  function html(state, hero, card, opts) {
    opts = opts || {};
    const kind = card.power ? "power" : BP.Wide && BP.Wide.on(state) ? BP.Wide.kindOf(card) : BP.Cards.kind(card);
    const kc = BP.Icons.KIND_COLOR[BP.Cards.kind(card)] || "#888";
    const nd = nowDamage(hero, card);
    const ci = hero ? BP.Cards.critInfo(hero, card) : null;
    const type = `${KIND[kind] || "Карта"}${card.attack && ATTACK[card.attack] ? ": " + ATTACK[card.attack] : ""}`;
    return `<div class="bigcard k-${esc(kind)}" style="--kc:${kc}">
      <div class="bc-head"><span class="bc-cost">${card.cost}⚡</span><span class="bc-name">${esc(card.name)}</span></div>
      <div class="bc-type">${esc(type)}${hero ? ` · ${esc(hero.name)}` : ""}</div>
      <div class="bc-art">${BP.Icons.svg(card.icon || "bash")}</div>
      <div class="bc-text">${esc(body(card))}</div>
      ${nd !== null ? `<div class="bc-now">Сейчас с учётом Силы и Слабости: <b>${nd} урона</b></div>` : ""}
      ${ci && !ci.always ? `<div class="bc-now">${ci.willCrit ? "<b>💥 Эта карта критует!</b>" : `💥 Крит ×${state.config.rules.critMultiplier} через ${ci.left} уд. этим оружием`}</div>` : ""}
      ${opts.highlight || ""}
      ${ups(state, card, opts.skipUp)}
      ${mergeField(state, card)}
      ${keywords(state, hero, card) ? `<div class="bc-kws">${keywords(state, hero, card)}</div>` : ""}
    </div>`;
  }

  return { html, body };
})();
