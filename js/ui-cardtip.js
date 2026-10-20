// Карта иконками и «умные» подсказки карты (merge-3, 20.10).
// На лице карты нет описания — только числа и иконки (parts с face: true).
// Подсказка 1-го уровня: навёл на карту и держишь 0.5 с — над картой столбик «иконка + коротко» (все parts).
// Подсказка 2-го уровня: держишь мышь на строке 1 с — сбоку объяснение этой строки.
// Каталог «Карты» и подсказки врагов/героев этим не пользуются (там всё по-старому, js/ui-fx.js).
window.BP = window.BP || {};

BP.CardTip = (function () {
  const DELAY1 = 500, DELAY2 = 1000, GRACE = 220;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const st = () => BP.Session.state;

  // ---------- что изображено на карте ----------
  // part: {icon, value, short, long, face, cls}. face — показывать иконкой на лице карты. cls "evo" — фиолетовая строка.
  const ATTACK_LONG = {
    melee: "Мили: бьёт только открытых врагов — тех, перед кем никто не стоит.",
    ranged: "Дальний: бьёт любого врага.",
    aoe: "Массовка: бьёт все клетки фигуры (схема в углу карты). Клетки за краем поля никого не бьют.",
  };
  const ATTACK_SHORT = { melee: "мили", ranged: "дальний", aoe: "массовка" };

  function parts(state, hero, c) {
    const out = [], add = (p) => out.push(p);
    const base = c.giftBase ? c.giftBase.effects : c.effects || [];
    const giftIds = new Set((c.gifts || []).map((g) => g.id));
    const dmg = (c.effects || []).find((e) => e.type === "damage");
    add({ icon: "⚡", value: c.cost, short: "стоимость", long: `Сыграть карту стоит ${c.cost} энергии.` });
    if (dmg) {
      const hits = dmg.hits > 1 ? `×${dmg.hits}` : "";
      add({ icon: "⚔️", value: dmg.amount + hits, short: "урон · " + (ATTACK_SHORT[c.attack] || ""),
        long: `${dmg.amount} урона${dmg.hits > 1 ? `, ${dmg.hits} удара` : ""}${c.bonus ? ` (из них +${c.bonus} от мерджа)` : ""}. ${ATTACK_LONG[c.attack] || ""}` });
    }
    // блок из самой карты (блок от даров показан плашкой дара)
    base.forEach((e) => {
      if (e.type === "block") add({ icon: "🛡️", value: (c.effects.find((x) => x.type === "block") || e).amount, short: c.target === "hero" ? "блок цели" : "блок себе", long: "Блок поглощает урон до конца хода врагов." });
      if (e.type === "blockSelf") add({ icon: "🛡️", value: e.amount, short: "блок себе", long: "Блок поглощает урон до конца хода врагов." });
    });
    // зона
    const AREA = {
      line: { icon: "➶", short: "насквозь", long: "Бьёт цель и врага за ней. За целью край поля — рикошет в соседнюю колонку." },
      row: { icon: "↔", short: "весь ряд", long: "Бьёт весь ряд, в который целишься." },
      all: { icon: "☄", short: "все враги", long: "Бьёт всех врагов на поле." },
      withCover: { icon: "⛨", short: "и прикрывающий", long: "Бьёт цель и врага, который её прикрывает." },
      adjacent: { icon: "✳", short: "клетка и соседи", long: "Бьёт клетку и все соседние." },
      // card-mechanics-1: динамические массовки — от клетки прицела до края поля
      rays: { icon: (c.rays || []).map((d) => BP.Mech.DIR_ARROW[d]).join(""), short: "до края поля", long: "Динамическая массовка: от клетки прицела до края поля по направлениям " + (c.rays || []).map((d) => BP.Mech.DIR_ARROW[d]).join(" ") + ". Чем дальше от края целишься, тем больше клеток." },
      level: { icon: "↔", short: "вся линия поперёк", long: "Бьёт всю линию поперёк поля — 3 клетки на той же высоте, что и прицел. Таких линий 4: передние клетки колонок 1-3-5, передние 2-4-6, задние 1-3-5, задние 2-4-6." },
    };
    if (AREA[c.area]) add(Object.assign({ face: true, cls: c.evolved ? "evo" : "" }, AREA[c.area]));
    // эффекты карты (толчок/вызов от даров показаны плашкой дара)
    base.forEach((e) => {
      switch (e.type) {
        case "push": if (!giftIds.has("push")) add({ icon: "⇧", face: true, short: "толчок", long: "Толкнуть врага на 1 клетку, сторону выбираешь сам. Врезался в край или врага — урон обоим. Толкнутый враг меняет цель." }); break;
        case "pull": add({ icon: "⇩", face: true, cls: c.evolved ? "evo" : "", short: "притяжение", long: "Притягивает врага из заднего ряда вперёд. Впереди кто-то есть — меняются местами." }); break;
        case "stun": add({ icon: "💫", face: true, cls: c.evolved ? "evo" : "", short: c.target === "cell" ? "оглушение всех задетых" : "оглушение", long: "Враг пропустит своё следующее действие." }); break;
        case "buffDamage": add({ icon: "⚔️", value: "+" + e.amount, face: true, short: "Сила до конца боя", long: `Цель до конца боя наносит +${e.amount} урона каждой картой (каждым выстрелом Искр тоже). Складывается. Нельзя отдать в мердж.` }); break;
        case "buffBlock": add({ icon: "🛡️", value: "+" + e.amount, face: true, short: "Стойкость до конца боя", long: `Каждая карта блока цели до конца боя даёт +${e.amount} блока. Складывается. Нельзя отдать в мердж.` }); break;
        case "miss": add({ icon: "🌫", face: true, short: "промах врага", long: "Следующая атака врага по цели промахнётся (одна атака). Можно сыграть на себя или союзника." }); break;
        case "pick": add({ icon: "🔮", value: "1/" + (e.count || 3), face: true, short: "выбрать карту", long: `Открываются ${e.count || 3} случайные карты из колод всех героев — берёшь одну, она уходит в руку своему владельцу.` }); break;
        case "tutor": add({ icon: "🔍", face: true, short: "найти карту", long: "Открываются все карты колод всех героев — берёшь любую, она уходит в руку своему владельцу." }); break;
        case "taunt": if (!giftIds.has("taunt")) add({ icon: "📣", face: true, short: "вызов", long: "Враг атакует тебя." }); break;
        case "cleanse": add({ icon: "✚", face: true, short: "очищение", long: "Снимает проклятия с героя." }); break;
        case "sparks": add({ icon: "✨", value: `${e.count}×${e.amount}`, face: true, short: "искры", long: `${e.count} выстрела по ${e.amount} урона. Каждый с шансом ${Math.round((e.stray || 0) * 100)}% уходит в случайного врага рядом с целью.` }); break;
        case "draw": add({ icon: "🂠", value: "+" + e.amount, face: true, short: "добор", long: `Взять ${e.amount} карты.` }); break;
        case "energy": add({ icon: "⚡", value: "+" + e.amount, face: true, short: c.target === "ally" ? "энергия союзнику" : c.target === "hero" ? "энергия себе или союзнику" : "энергия", long: `+${e.amount} энергии ${c.target === "ally" ? "союзнику" : c.target === "hero" ? "себе или союзнику (на фишку героя)" : "себе"}.` }); break;
        case "sharedPool": add({ icon: "∑", face: true, short: "общий пул", long: "Остаток энергии всех героев складывается, любой тратит из пула до конца хода." }); break;
        case "blockParty": add({ icon: "🛡️", value: e.amount, face: true, short: "блок всем", long: `Всем героям ${e.amount} блока.` }); break;
        case "damageAllEnemies": add({ icon: "☄", value: e.amount, face: true, short: "урон всем", long: `Всем врагам ${e.amount} урона.` }); break;
        case "blockPartyPct": add({ icon: "🛡️", value: Math.round(e.pct * 100) + "%", face: true, cls: c.evolved ? "evo" : "", short: "блок всем", long: `Всем героям блок = ${Math.round(e.pct * 100)}% урона карты.` }); break;
      }
    });
    // свойства (эволюции, Рывок)
    const ev = c.evolved ? "evo" : "";
    if (c.ignoreCover && c.area !== "withCover") add({ icon: "🎯", face: true, cls: ev, short: "бьёт закрытого", long: "Мили, но бьёт и врага, которого прикрывают спереди." });
    if (c.mult) add({ icon: "✖", value: c.mult, face: true, cls: ev, short: `урон ×${c.mult}`, long: `Урон карты ×${c.mult}.` });
    if (c.finisher) add({ icon: "☠", face: true, cls: ev, short: "добить", long: "Враг с ≤50% ХП погибает, иначе урон ×2." });
    if (c.ignoreBlock) add({ icon: "⊘", face: true, cls: ev, short: "сквозь блок и броню", long: "Блок и броня врага не поглощают урон." });
    if (c.armorBreak) add({ icon: "⬢", value: "×2", face: true, short: "по броне ×2", long: "Урон по броне врага удваивается: броня сносится вдвое быстрее, остаток идёт в ХП." });
    if (c.alwaysCrit) add({ icon: "💥", value: "!", face: true, cls: ev, short: "всегда крит", long: `Всегда крит ×${state.config.rules.critMultiplier}. Счётчик крита оружия не двигает.` });
    if (c.ricochet && !giftIds.has("pierce")) add({ icon: "↯", value: "100%", face: true, short: "рикошет", long: "Перед ударом выбираешь направление атаки: сосед цели в эту сторону получает 100% урона. Толчок карты (если есть) — туда же." });
    if (c.returnOnKill) add({ icon: "↩", face: true, cls: ev, short: "вернётся в руку", long: "Убил цель — карта возвращается в руку." });
    // полученные дары (в порядке первого мерджа)
    if (BP.Gifts.isOn(state)) BP.Gifts.badges(state, c).forEach((b) => {
      const g = state.config.gifts[b.id] || {};
      add({ icon: b.icon, value: b.value, color: b.color, face: true, short: g.name, long: `Получено мерджем — ${g.name}: ${g.text}.` });
    });
    // крит
    const ci = BP.Cards.critInfo(hero, c);
    if (ci && !ci.always) add({ icon: "💥", value: ci.willCrit ? "!" : ci.left, short: ci.willCrit ? "крит!" : `крит через ${ci.left}`, long: `Каждый ${ci.every}-й удар этим оружием — крит ×${state.config.rules.critMultiplier}. Слабые удары не считаются.` });
    // родной дар
    if (BP.Gifts.isOn(state) && c.gift && state.config.gifts[c.gift]) {
      const g = state.config.gifts[c.gift];
      add({ icon: "🎁" + g.icon, short: "дар союзнику: " + g.name, long: `Дар союзнику — ${g.name}: ${g.text}. Атака в атаку ещё +50% урона. Твоя карта уйдёт в сброс.` });
    }
    if (c.merged && !c.evolved) add({ icon: "★", value: c.merged > 1 ? c.merged : "", short: "усилена мерджем", long: "Карта получила дары союзников — усиление до конца боя." });
    // эволюция
    if (BP.Evolve.evolvable(state, c)) {
      const to = state.config.cards[c.evolve];
      add({ icon: "✦", short: "→ " + to.name, cls: "evo", long: `${to.name}: ${to.special || ""}.` });
    }
    if (c.evolvedFrom) {
      add({ icon: "✦", short: `из ${c.evolvedFrom[0]} + ${c.evolvedFrom[1]}`, long: "Эволюция живёт до конца боя и не сгорает в конце хода — лежит в руке, пока её не сыграешь." });
      if (c.special) add({ icon: "✦", short: c.special, cls: "evo", long: c.special.charAt(0).toUpperCase() + c.special.slice(1) + "." });
    }
    if (c.questCard) add({ icon: "?", short: "квестовая", long: "Одноразовая: после розыгрыша пропадает, в конце хода не сгорает." });
    if (c.weak) add({ icon: "·", short: "слабый удар", long: "Добивка колоды. Нельзя отдать в мердж, не двигает крит." });
    return out;
  }

  // Иконки на лице карты
  function faceHtml(state, hero, c) {
    const ps = parts(state, hero, c).filter((p) => p.face);
    if (!ps.length) return "";
    return `<div class="cbadges">${ps.map((p) => `<span class="cbadge${p.cls ? " " + p.cls : ""}"${p.color ? ` style="--bc:${p.color}"` : ""}>${esc(p.icon)}${p.value !== undefined && p.value !== "" ? `<b>${esc(p.value)}</b>` : ""}</span>`).join("")}</div>`;
  }

  // ---------- подсказки ----------
  let box = null, side = null, cur = null, t1 = null, t2 = null, hideT = null, rowKey = null, mx = -1, my = -1;

  function ensure() {
    if (box) return;
    box = document.createElement("div"); box.className = "ctip"; document.body.appendChild(box);
    side = document.createElement("div"); side.className = "ctip2"; document.body.appendChild(side);
    box.addEventListener("pointerover", (e) => {
      const row = e.target.closest(".ctip-row");
      const k = row ? row.dataset.i : null;
      if (k === rowKey) return;
      rowKey = k; clearTimeout(t2); side.style.display = "none";
      box.querySelectorAll(".ctip-row.on").forEach((r) => r.classList.remove("on"));
      if (row) { row.classList.add("on"); t2 = setTimeout(() => showSide(row), DELAY2); }
    });
  }

  function findCard() {
    if (!cur) return null;
    return document.querySelector(`.hand .card[data-card="${cur.uid}"][data-hero="${cur.hero}"]`);
  }

  function rowsHtml(state) {
    const h = state.heroes.find((x) => x.id === cur.hero), c = h && h.hand.find((x) => x.uid === cur.uid);
    if (!c) return null;
    cur.parts = parts(state, h, c);
    return `<div class="ctip-title">${esc(c.name)}</div>` + cur.parts.map((p, i) => `<div class="ctip-row${p.cls ? " " + p.cls : ""}" data-i="${i}"><span class="ci">${esc(p.icon)}${p.value !== undefined && p.value !== "" ? `<b>${esc(p.value)}</b>` : ""}</span><span>${esc(p.short)}</span></div>`).join("");
  }

  function place() {
    const el = findCard();
    if (!el) return;
    const r = el.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
    const x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8));
    const y = Math.max(8, r.top - h - 4);
    box.style.left = x + "px"; box.style.top = y + "px";
  }

  function show() {
    const s = st();
    if (!s || !cur) return;
    const html = rowsHtml(s);
    if (!html) return hide();
    box.innerHTML = html; box.style.display = "block"; rowKey = null;
    place();
  }

  function showSide(row) {
    const p = cur && cur.parts && cur.parts[+row.dataset.i];
    if (!p || !p.long) return;
    side.className = "ctip2" + (p.cls ? " " + p.cls : "");
    side.innerHTML = `<div class="ctip-title">${esc(p.icon)} ${esc(p.short)}</div><div>${esc(p.long)}</div>`;
    side.style.display = "block";
    const br = box.getBoundingClientRect(), rr = row.getBoundingClientRect(), w = side.offsetWidth, h = side.offsetHeight;
    const x = br.right + 6 + w < innerWidth ? br.right + 6 : br.left - w - 6;
    side.style.left = Math.max(8, x) + "px"; side.style.top = Math.max(8, Math.min(rr.top - 6, innerHeight - h - 8)) + "px";
  }

  function hide() {
    clearTimeout(t1); clearTimeout(t2); clearTimeout(hideT);
    cur = null; rowKey = null;
    if (box) { box.style.display = "none"; side.style.display = "none"; }
  }

  function onMove(e) {
    mx = e.clientX; my = e.clientY;
    const s = st();
    if (!s || s.phase === "lobby" || (BP.Drag && BP.Drag.isDragging())) { hide(); return; }
    const overTip = e.target.closest && (e.target.closest(".ctip") || e.target.closest(".ctip2"));
    const cardEl = e.target.closest && e.target.closest(".hand .card[data-card]");
    if (overTip && cur) { clearTimeout(hideT); hideT = null; return; }
    if (cardEl) {
      clearTimeout(hideT); hideT = null;
      if (cur && cur.uid === cardEl.dataset.card) return;
      hide();
      cur = { uid: cardEl.dataset.card, hero: cardEl.dataset.hero };
      t1 = setTimeout(show, DELAY1);
      return;
    }
    if (cur && !hideT) hideT = setTimeout(hide, GRACE); // ушёл с карты — короткая пауза, чтобы успеть перейти на подсказку
  }

  // Состояние обновилось (рендер): пересобрать строки, если подсказка открыта
  function refresh() {
    if (!cur || !box || box.style.display === "none") return;
    const s = st(), html = s && rowsHtml(s);
    if (!html) return hide();
    if (box.innerHTML !== html && !rowKey) box.innerHTML = html;
    place();
  }

  function init() {
    ensure();
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerdown", (e) => { if (!e.target.closest(".ctip, .ctip2")) hide(); });
    window.addEventListener("blur", hide);
  }

  return { init, refresh, parts, faceHtml, hide };
})();
