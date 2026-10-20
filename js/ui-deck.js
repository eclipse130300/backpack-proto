// Окно «Колода» / «Сброс» (кнопки сверху, есть всегда, в том числе на выборе квеста).
// Обычный режим: колонка на каждого героя — его колода (или сброс).
// Общая колода (tests.sharedDeck): колонки героев (их карты оружия и щита) + колонка «Общая».
// Колода показывается без порядка: одинаковые карты сгруппированы (×N), порядок добора не раскрывается.
window.BP = window.BP || {};

BP.UIDeck = (function () {
  const esc = (s) => BP.UIGame.esc(s);

  function groups(cards) {
    const map = new Map();
    cards.forEach((c) => {
      const key = [c.name, c.cost, c.text, c.merged || 0, c.questCard ? 1 : 0].join("|");
      if (!map.has(key)) map.set(key, { c, n: 0 });
      map.get(key).n++;
    });
    return [...map.values()].sort((a, b) => a.c.cost - b.c.cost || a.c.name.localeCompare(b.c.name));
  }

  function miniCard(g) {
    const c = g.c, kind = BP.Cards.kind(c), kc = BP.Icons.KIND_COLOR[kind];
    return `<div class="dcard" style="--kc:${kc}">
      <div class="dcost">${c.cost}</div><div class="dart">${BP.Icons.svg(c.icon)}</div>
      <div class="dbody"><div class="dname">${esc(c.name)}${c.merged ? ` <span class="gold">★${c.merged > 1 ? c.merged : ""}</span>` : ""}${c.weaponName ? ` <span class="muted small">· ${esc(c.weaponName)}</span>` : ""}</div>
      <div class="dtext">${esc(c.text)}</div></div>
      ${g.n > 1 ? `<div class="dcount">×${g.n}</div>` : ""}
    </div>`;
  }

  function column(title, head, cards, extra, cls) {
    const list = groups(cards).map(miniCard).join("") || `<div class="muted small">пусто</div>`;
    return `<div class="dcol ${cls || ""}"><div class="dhead">${head}<div><b>${esc(title)}</b><div class="muted small">${cards.length} карт${extra ? " · " + extra : ""}</div></div></div>${list}</div>`;
  }

  function render(s, which) {
    const pile = which === "discard" ? "discard" : "draw";
    const shared = !!s.shared;
    const portrait = (h, i) => `<div class="portrait sm hc${i}">${BP.Icons.svg((s.config.heroes[i] || {}).icon || "helm")}</div>`;
    const cols = s.heroes.map((h, i) => column(h.name, portrait(h, i), h[pile] || [],
      (pile === "draw" && h.hand.length ? `в руке ${h.hand.length}` : "") + (shared ? (pile === "draw" && h.hand.length ? ", " : "") + "оружие и щит" : ""), "lane" + i));
    if (shared) cols.push(column("Общая", `<div class="portrait sm shared-ico">🂠</div>`, s.shared[pile] || [], "кооп-карты и слабые удары", "shared"));
    const mode = shared
      ? "Режим общей колоды: у каждого героя свои карты оружия и щита, всё остальное — в общей колоде (добор случайно из своей и общей)."
      : "У каждого героя своя колода: карты оружия и щита, его кооп-карты и слабые удары его оружия до минимума.";
    return `<div class="modal-back deck-back"><div class="modal deckview">
      <div class="row"><h2 class="grow">${pile === "draw" ? "🂠 Колода" : "♻ Сброс"}</h2>
        <button class="${pile === "draw" ? "primary" : ""}" data-act="deck-view">🂠 Колода</button>
        <button class="${pile === "discard" ? "primary" : ""}" data-act="discard-view">♻ Сброс</button>
        <button data-act="modal-close">Закрыть (Esc)</button></div>
      <div class="muted small">${mode}${pile === "draw" ? " Порядок добора скрыт — одинаковые карты сгруппированы." : ""}</div>
      <div class="dcols" id="deck-scroll" style="grid-template-columns:repeat(${cols.length}, 1fr)">${cols.join("")}</div>
    </div></div>`;
  }

  // Выбор карты (Прозрение / Поиск): выбирает игрок героя, сыгравшего карту, остальные ждут
  function renderChoice(s, me) {
    const ch = s.choice, who = s.heroes.find((h) => h.id === ch.hero) || {};
    const mine = who.owner === me;
    const cards = ch.options.map((o) => {
      const h = s.heroes.find((x) => x.id === o.owner), c = h && h.draw.find((x) => x.uid === o.uid);
      return c ? { c, h } : null;
    }).filter(Boolean).sort((a, b) => a.h.name.localeCompare(b.h.name) || b.c.cost - a.c.cost);
    const list = cards.map(({ c, h }) => `<div class="choice-item${mine ? "" : " off"}" ${mine ? `data-act="choose" data-card="${c.uid}"` : ""}>${miniCard({ c, n: 1 })}<div class="muted small">→ ${esc(h.name)}</div></div>`).join("");
    return `<div class="modal-back"><div class="modal deckview choice">
      <h2>${ch.kind === "pick" ? "Прозрение: возьми 1 из 3" : "Поиск: возьми любую карту из колод"}</h2>
      <div class="muted small">${mine ? "Карта уйдёт в руку своему владельцу." : `Выбирает ${esc(who.name)}…`}</div>
      <div class="choice-grid">${list || '<div class="muted">пусто</div>'}</div>
    </div></div>`;
  }

  return { render, renderChoice };
})();
