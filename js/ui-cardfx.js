// Эффекты карты иконками (правки 27.11 — «меньше букв, всё миниатюрами»).
// Под названием карты две рамки:
//   зелёная — активные эффекты карты (Цепь, Экзост, Метка, сработавшие эффекты мерджа…);
//   синяя — эффекты мерджа, которые сработают, если карту смерджить. Сработал — значок переезжает в зелёную.
//   Карту нельзя мерджить или эффекта мерджа нет — синей рамки нет.
// Урон и броня значками НЕ показываются — они в числах в углу карты (доп. урон красным, js/icons.js statsHtml).
// Каждый значок: { icon, val, word, long, cond } — icon+val на карте, word — короткое слово на крупной карте,
// long — подробно (боковые подсказки через 1 с, js/ui-cardtip.js), cond — условие эффекта мерджа (маленький значок слева).
window.BP = window.BP || {};

BP.CardFx = (function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const dmgOf = (c) => (c.effects || []).find((e) => e.type === "damage");

  // ---------- урон / броня сейчас ----------
  // Урон с Силой, Слабостью, Стихиями и Чародейством героя. base — урон карты из конфига (для подсветки).
  function damageNow(state, hero, c) {
    const d = dmgOf(c);
    if (!d) return null;
    let v = d.amount;
    if (hero && !c.dmgFromBlock && !c.perHand) v = Math.max(0, v + (hero.dmgBuff || 0) * (c.strMult || 1) - BP.Cards.weakness(hero) + (c.attack === "aoe" ? hero.aoeBonus || 0 : 0) + (c.arcane ? hero.arcane || 0 : 0));
    const cd = state && state.config.cards[c.id], bd = cd && (cd.effects || []).find((e) => e.type === "damage");
    return { v, hits: d.hits || 1, base: bd ? bd.amount : d.amount };
  }

  // ---------- эффекты мерджа ----------
  function mfxIcon(fx) {
    const d = fx.do || {}, n = (k) => d[k];
    if (d.flat !== undefined) return `max+${d.flat}⚔`;
    if (n("dmg")) return `+${d.dmg}⚔`;
    if (n("block")) return `+${d.block}🛡`;
    if (n("draw")) return `+${d.draw}🂠`;
    if (n("cheaper")) return `−${d.cheaper}⚡`;
    if (n("energy")) return `+${d.energy}⚡`;
    if (n("str")) return `+${d.str}💪`;
    if (n("tough")) return `+${d.tough}🧱`;
    if (n("ricoDmg")) return `+${d.ricoDmg}↯`;
    if (n("rico")) return `+${d.rico}↯`;
    if (n("chainDmg")) return `+${d.chainDmg}🌩`;
    if (n("barrier")) return `+${d.barrier}🔰`;
    if (n("healPlus")) return `+${d.healPlus}❤`;
    if (d.retain) return "📌";
    if (d.copy) return "⧉";
    if (d.crit) return "💥";
    if (d.durFight) return "⏳";
    if (d.blockFirst) return "🛡⇡";
    if (d.fadeHold) return "🩸⏸";
    if (d.sharpen) return "🗡";
    if (d.critMove) return "💥⇄";
    if (d.boneKill) return "🦴";
    return "✦";
  }
  function condIcon(fx) {
    const c = fx.cond || {};
    if (c.kind) return { attack: "⚔", block: "🛡", aoe: "✳" }[c.kind] || "";
    if (c.cost !== undefined) return `${c.cost}⚡`;
    if (c.costMin !== undefined) return `${c.costMin}+⚡`;
    if (c.otherClass) return "👥";
    if (c.hpBelow) return "❤½";
    if (c.critReady) return "💥";
    return "";
  }
  const SIDE_LONG = { in: "Срабатывает, только когда в эту карту вмерджили.", out: "Срабатывает, только когда отдаёшь эту карту.", both: "Срабатывает и когда отдаёшь карту, и когда в неё вмерджили. Бонус герою получает владелец этой карты." };
  const mfxText = (t) => String(t || "").replace(/^Мердж:\s*/, "");
  function mfxItem(fx) {
    return { icon: mfxIcon(fx), cond: condIcon(fx), word: mfxText(fx.text), long: `Эффект мерджа: ${mfxText(fx.text)}. ${fx.fixed ? "Ограничение — у этой карты всегда." : SIDE_LONG[fx.side] || ""}` };
  }

  // ---------- активные эффекты ----------
  const AREA = {
    row: ["↔", "Весь ряд", "Бьёт всех врагов в ряду, в который целишься."],
    adjacent: ["✳", "Клетка и соседи", "Бьёт клетку и все соседние."],
    all: ["☄", "Все враги", "Бьёт всех врагов на поле."],
    level: ["↔", "Линия поперёк", "Бьёт всю линию поперёк поля."],
    rays: ["✳", "До края поля", "От клетки прицела до края поля."]
  };
  function active(state, hero, c) {
    const out = [], add = (icon, val, word, long) => out.push({ icon, val: val === undefined ? "" : val, word, long });
    const d = dmgOf(c);
    if (c.area === "shape") { const n = ((c.shapeSteps || (state.config.shapes[c.fixedShape] || {}).steps) || []).length || 3; add("✳", n, `${n} клетки`, `Массовка: бьёт фигуру из ${n} клеток (схема на картинке карты).`); }
    else if (AREA[c.area]) add(AREA[c.area][0], "", AREA[c.area][1], AREA[c.area][2]);
    if (d && d.hits > 1) add("✖", d.hits, `${d.hits} удара`, `Бьёт ${d.hits} раза по ${d.amount}.`);
    if (c.chain) { const v = (c.chainDmg || (d || {}).amount || 0) + (c.chainBonus || 0); add("🌩", v, `Цепь ${v}`, `Цепь: после удара прыгает на соседнего врага с наименьшим ХП и бьёт его на ${v}${c.chain > 1 ? ` (прыжков: ${c.chain})` : ""}.`); }
    if (c.ricochet) { const v = (c.ricoDmg || (d || {}).amount || 0) + (c.ricoBonus || 0); add("↯", v, `Рикошет ${v}`, `Рикошет: перед ударом выбираешь направление — сосед цели в ту сторону получает ${v}${c.ricochet > 1 ? ` (рикошетов: ${c.ricochet})` : ""}.`); }
    if (c.alwaysCrit) add("💥", "!", "Крит", "Эта атака критует (урон ×2).");
    if (c.strMult > 1) add("💪", "×" + c.strMult, `Сила ×${c.strMult}`, `Сила героя действует на эту карту ${c.strMult} раза.`);
    if (c.critMult) add("💥", "×" + c.critMult, `Крит ×${c.critMult}`, `Крит этой картой ×${c.critMult} вместо ×2.`);
    if (c.dmgFromBlock) add("🧱", "", "Урон = броня", "Урон карты = текущая броня героя.");
    if (c.perHand) add("🂠", "×", "× карт в руке", "Урон умножается на число карт в руке героя.");
    if (c.perBone) add("🦴", "+" + c.perBone, `+${c.perBone} за Кость`, `+${c.perBone} урона за каждую Кость героя.`);
    if (c.ignoreCover) add("👻", "", "Сквозь прикрытие", "Мили, но бьёт и врага, которого прикрывают спереди.");
    if (c.armorBreak) add("⬢", "×2", "По броне ×2", "Урон по броне врага удваивается.");
    (c.effects || []).forEach((e) => {
      const n = e.amount, dur = e.dur === "fight" ? "на бой" : "на ход", who = e.party ? "всем героям " : "";
      switch (e.type) {
        case "push": add("⇧", "", e.far ? "Толчок до упора" : "Толчок", e.far ? "Толкает врага назад до столкновения. Врезался в другого врага — оба получают Уязвимость." : "Толкает врага на 1 клетку (сторону выбираешь). Толкнутый враг меняет цель; врезался в другого — оба получают Уязвимость."); break;
        case "pull": add("⇩", "", "Притяжение", "Притягивает врага вперёд."); break;
        case "pushOut": add("💨", "", "Растолкать", "Расталкивает врагов вокруг клетки от неё."); break;
        case "stun": add("💫", "", "Оглушение", "Враг пропустит своё следующее действие."); break;
        case "draw": add("🂠", "+" + n, `Добор ${n}`, `Возьми ${n} карт${n === 1 ? "у" : "ы"}.`); break;
        case "energy": add("⚡", "+" + n, `+${n}⚡`, `+${n} энергии.`); break;
        case "blockParty": add("🛡", n, `Всем +${n}🛡`, `Всем героям ${n} брони.`); break;
        case "mark": add("🎯", "", "Метка", "Метка: следующий удар по этому врагу +50%."); break;
        case "missEnemy": add("🌫", "", "Ослепление", "Враг промахивается своей атакой в этот ход."); break;
        case "barrier": add("🔰", n, `Барьер ${n}`, `Барьер: блокирует ${n === 1 ? "1 удар" : n + " удара"} любого врага целиком.`); break;
        case "str": add("💪", "+" + n, `Сила +${n}`, `${who ? "Всем героям: " : ""}+${n} Силы ${dur} — каждая атака бьёт на ${n} сильнее.`); break;
        case "tough": add("🧱", "+" + n, `Стойкость +${n}`, `${who ? "Всем героям: " : ""}+${n} Стойкости ${dur} — каждая карта брони даёт на ${n} больше.`); break;
        case "critReady": add("💥", "", "Крит готов", "Следующий удар героя — крит."); break;
        case "arcane": add("✨", "+" + n, "Чародейство", `Каждая следующая Магическая стрела в этот ход бьёт на +${n}. Складывается, сгорает в конце хода.`); break;
        case "thorns": add("🌵", n, `Шипы ${n}`, `Шипы: враг, ударивший героя, получает ${n} урона.`); break;
        case "keepBlock": add("🧱", "∞", "Несокрушимость", "Броня героя больше не сгорает в конце хода."); break;
        case "mergeStr": add("🤝", "+" + n, "Ярость товарищей", `Каждый мердж в карту героя: +${n} Силы на бой.`); break;
        case "aoeBonus": add("🔥", "+" + n, `Стихии +${n}`, `Все массовки героя +${n} урона.`); break;
        case "critShift": add("🗡", "−" + n, "Заточка", `Крит героя на ${n} удар раньше до конца боя.`); break;
        case "fade": add("🩸", "+" + e.now, "Угасание", `Сразу +${e.now} Силы, потом ${e.turns} хода по −${e.per}.`); break;
        default: {
          if (["damage", "block", "blockSelf", "blockHero"].includes(e.type)) break;
          const t = (BP.Wide2 && BP.Wide2.effText(c, e)) || (BP.Wide && BP.Wide.effText(c, e));
          const ic = BP.Wide2 && BP.Wide2.ICON[e.type];
          if (t && ic) add(ic, n || "", t.split(/[:—(]/)[0].trim(), t.charAt(0).toUpperCase() + t.slice(1) + ".");
        }
      }
    });
    if (c.power) add("◆", "", "Power", "Power: эффект на весь бой; после розыгрыша карта уходит до конца боя.");
    if (c.ex && !c.power) add("⌛", "", "Экзост", "Экзост: после розыгрыша карта уходит до конца боя.");
    if (c.retain) add("📌", "", "Удержание", "Удержание: не сбрасывается в конце хода.");
    if (c.innate) add("☝", "", "Первая в руке", "Всегда приходит в первую руку боя.");
    if (c.unplayable) add("🚫", "", "Мусор", "Сыграть нельзя; в конце хода исчезает до конца боя.");
    // улучшения забега (кроме тех, что уже в числах: урон, стоимость)
    const U = (state.config.meta || {}).upgrades || {}, ups = c.ups || {};
    Object.keys(ups).forEach((id) => {
      const u = U[id];
      if (!u || !ups[id] || ["up", "cheaper", "retain", "innate", "fury", "mfx", "gift"].includes(id)) return;
      add(u.icon, "", u.name, `${u.name}: ${u.text}${u.risk ? `, ${u.risk}` : ""}.`);
    });
    if (c.evolvedFrom && c.special) add("✦", "", c.special, c.special);
    // сработавшие эффекты мерджа (свои и союзника) — уже активны
    const lib = state.config.mergeFx || {}, seen = {};
    (c.fired || []).forEach((f) => {
      const fx = (f.id && lib[f.id]) || (c.mfx || []).find((x) => x.text === f.text);
      const key = f.id || f.text;
      if (seen[key]) { seen[key].n++; return; }
      const it = fx ? mfxItem(fx) : { icon: "✦", word: f.text, long: f.text };
      it.n = 1; it.merge = true; seen[key] = it; out.push(it);
    });
    out.forEach((it) => { if (it.n > 1) { it.val = (it.val || "") + "×" + it.n; it.word += ` ×${it.n}`; } });
    return out;
  }

  // Эффекты мерджа, которые ещё могут сработать (синяя рамка). Нельзя мерджить — пусто.
  function potential(state, c) {
    if (!(BP.Wide && BP.Wide.on(state) && BP.Wide.mergeable(c))) return [];
    const fired = new Set((c.fired || []).map((f) => f.id || f.text));
    return (c.mfx || []).filter((fx) => !fired.has(fx.id) && !fired.has(fx.text) && !(fx.fixed && c.donor)).map(mfxItem);
  }

  // ---------- html ----------
  function chip(it) {
    return `<span class="fxchip${it.merge ? " m" : ""}">${it.cond ? `<i>${esc(it.cond)}→</i>` : ""}${esc(it.icon)}${it.val !== undefined && it.val !== "" ? `<b>${esc(it.val)}</b>` : ""}</span>`;
  }
  // Две рамки (миниатюра и крупная карта — одна разметка, размер задаёт CSS)
  function frames(state, hero, c) {
    const a = active(state, hero, c), p = potential(state, c);
    return (a.length ? `<div class="fxrow act">${a.map(chip).join("")}</div>` : "") + (p.length ? `<div class="fxrow pot">${p.map(chip).join("")}</div>` : "");
  }
  // Все значки с подробностями (боковые подсказки)
  function details(state, hero, c) {
    return active(state, hero, c).map((x) => Object.assign({ kind: "act" }, x)).concat(potential(state, c).map((x) => Object.assign({ kind: "pot" }, x)));
  }

  return { damageNow, active, potential, frames, details, mfxItem };
})();
