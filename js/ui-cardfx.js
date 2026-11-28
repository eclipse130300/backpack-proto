// Эффекты карты (правки 27.11 → 28.11).
// Миниатюра: под названием две рамки значков —
//   зелёная — активные эффекты карты (Цепь, Экзост, Метка, сработавшие эффекты мерджа…);
//   синяя — эффекты мерджа, которые сработают, если карту смерджить. Есть условие — красный «!» и только то, что даёт
//   (условие словами — на крупной карте). Карту нельзя мерджить или эффекта мерджа нет — синей рамки нет.
// Крупная карта (js/ui-bigcard.js) значков не показывает — только слова: say (коротко, что делает) и fxSay (эффект мерджа
//   словами с мини-иконками: «Карта стоит 2+⚡ → Барьер 🔰 +1»). gain у эффекта: base (белым) / up (улучшение забега) /
//   merge (пришло мерджем) — up и merge на крупной карте зелёным, в таком порядке.
// Урон и броня значками НЕ показываются — они в числах в углу карты (доп. урон красным, js/icons.js statsHtml).
// Каждый значок: { icon, val, word, say, long, cond, gain } — long — подробно (боковые подсказки через 1 с, js/ui-cardtip.js).
// Дефолтные правила мерджа (срабатывает и когда отдаёшь, и когда вмерджили; бонус герою — владельцу карты) нигде не пишем.
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
    if (hero && !c.dmgFromBlock && !c.perHand) v = Math.max(0, v + (c.extraDmg || 0) + (hero.dmgBuff || 0) * (c.strMult || 1) - BP.Cards.weakness(hero) + (c.attack === "aoe" ? hero.aoeBonus || 0 : 0) + (c.arcane ? hero.arcane || 0 : 0));
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
  const SIDE_LONG = { in: "Только когда в эту карту вмерджили.", out: "Только когда отдаёшь эту карту." }; // both — дефолт, не пишем
  const mfxText = (t) => String(t || "").replace(/^Мердж:\s*/, "");
  const capOf = (fx, card) => Math.max(fx.do.flat, (card && card.capUp) || 0); // «Размах» поднимает кап
  // Есть ли у эффекта условие (миниатюра — красный «!»): cond, или срабатывает только в одну сторону
  const hasCond = (fx) => !fx.fixed && !!(fx.cond && Object.keys(fx.cond).length) || (!fx.fixed && (fx.side === "in" || fx.side === "out"));
  const glyph = (s) => String(s).replace(/max|[+−\-\d]/g, "");
  // Эффект мерджа словами с мини-иконками (крупная карта): «Карта стоит 2+⚡ → Барьер 🔰 +1»
  function fxSay(fx, card) {
    const d = fx.do || {}, mi = (g) => (g ? `<span class="mi">${esc(g)}</span>` : "");
    if (d.flat !== undefined) return `Мердж в карту: максимум ${mi("⚔")} +${capOf(fx, card)} урона`;
    const t = mfxText(fx.text), i = t.indexOf("→");
    let left = i >= 0 ? t.slice(0, i).trim() : "", right = (i >= 0 ? t.slice(i + 1) : t).trim();
    const cg = condIcon(fx), rg = glyph(mfxIcon(fx));
    left = esc(left);
    if (cg && /⚡$/.test(cg)) left = left.replace(/(\d\+?)(?!.*\d)/, "$1" + mi("⚡")); // «Карта стоит 2+⚡»
    else if (cg) left += " " + mi(cg);
    right = esc(right.charAt(0).toUpperCase() + right.slice(1));
    if (rg) { const m = right.match(/^(.*?)([+−\-]?\d.*)$/); right = m && m[1].trim() ? `${m[1].trim()} ${mi(rg)} ${m[2]}` : `${right} ${mi(rg)}`; }
    return left ? `${left} → ${right}` : right;
  }
  function mfxItem(fx, card) {
    const fl = (fx.do || {}).flat !== undefined, word = fl ? `максимум +${capOf(fx, card)} урона` : mfxText(fx.text);
    const res = fl ? word : (word.split("→")[1] || word).trim();
    return { icon: fl ? `max+${capOf(fx, card)}⚔` : mfxIcon(fx), cond: hasCond(fx) ? "!" : "", word, say: res.charAt(0).toUpperCase() + res.slice(1),
      fxSay: fxSay(fx, card), long: fl ? `Мердж в эту карту даёт не больше +${capOf(fx, card)} урона.` : `Эффект мерджа: ${word}.${SIDE_LONG[fx.side] ? " " + SIDE_LONG[fx.side] : ""}` };
  }

  // ---------- активные эффекты ----------
  const AREA = {
    row: ["↔", "Весь ряд", "Бьёт весь ряд", "Бьёт всех врагов в ряду, в который целишься."],
    adjacent: ["✳", "Клетка и соседи", "Бьёт клетку и соседей", "Бьёт клетку и все соседние."],
    all: ["☄", "Все враги", "Бьёт всех врагов", "Бьёт всех врагов на поле."],
    level: ["↔", "Линия поперёк", "Бьёт линию поперёк поля", "Бьёт всю линию поперёк поля."],
    rays: ["✳", "До края поля", "Бьёт до края поля", "От клетки прицела до края поля."]
  };
  const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);
  // Эффекты одной карты (без улучшений и сработавших эффектов мерджа — их добавляет active)
  function own(state, hero, c) {
    const out = [], add = (icon, val, word, long, say) => out.push({ icon, val: val === undefined ? "" : val, word, long, say: say === undefined ? word : say });
    const d = dmgOf(c);
    if (c.area === "shape") { const n = ((c.shapeSteps || (state.config.shapes[c.fixedShape] || {}).steps) || []).length || 3; add("✳", n, `${n} клетки`, `Массовка: бьёт фигуру из ${n} клеток (схема на картинке карты).`, `Бьёт фигуру из ${n} клеток`); }
    else if (AREA[c.area]) add(AREA[c.area][0], "", AREA[c.area][1], AREA[c.area][3], AREA[c.area][2]);
    if (d && d.hits > 1) add("✖", d.hits, `${d.hits} удара`, `Бьёт ${d.hits} раза по ${d.amount}.`, "");
    if (c.extraDmg) add("➕", c.extraDmg, `Доп. урон ${c.extraDmg}`, `Доп. урон: +${c.extraDmg} к каждому удару (массовка — каждой цели). В мердже переходит целиком, ограничение «максимум +N» на него не действует.`, `+${c.extraDmg} урона каждым ударом`);
    if (c.chain) { const v = (c.chainDmg || (d || {}).amount || 0) + (c.chainBonus || 0); add("🌩", v, `Цепь ${v}`, `Цепь: после удара прыгает на соседнего врага с наименьшим ХП и бьёт его на ${v}${c.chain > 1 ? ` (прыжков: ${c.chain})` : ""}.`, `Прыгает на соседа: ${v} урона${c.chain > 1 ? ` (×${c.chain})` : ""}`); }
    if (c.ricochet) { const v = (c.ricoDmg || (d || {}).amount || 0) + (c.ricoBonus || 0); add("↯", v, `Рикошет ${v}`, `Рикошет: перед ударом выбираешь направление — сосед цели в ту сторону получает ${v}${c.ricochet > 1 ? ` (рикошетов: ${c.ricochet})` : ""}.`, `Рикошет в соседа: ${v} урона${c.ricochet > 1 ? ` (×${c.ricochet})` : ""}`); }
    if (c.alwaysCrit) add("💥", "!", "Крит", "Эта атака критует (урон ×2).", "Всегда крит");
    if (c.strMult > 1) add("💪", "×" + c.strMult, `Сила ×${c.strMult}`, `Сила героя действует на эту карту ${c.strMult} раза.`, `Сила действует ×${c.strMult}`);
    if (c.critMult) add("💥", "×" + c.critMult, `Крит ×${c.critMult}`, `Крит этой картой ×${c.critMult} вместо ×2.`);
    if (c.dmgFromBlock) add("🧱", "", "Урон = броня", "Урон карты = текущая броня героя.", "Урон = твоя броня");
    if (c.perHand) add("🂠", "×", "× карт в руке", "Урон умножается на число карт в руке героя.", "Урон × карт в руке");
    if (c.perBone) add("🦴", "+" + c.perBone, `+${c.perBone} за Кость`, `+${c.perBone} урона за каждую Кость героя.`, `+${c.perBone} урона за Кость`);
    if (c.ignoreCover) add("👻", "", "Сквозь прикрытие", "Мили, но бьёт и врага, которого прикрывают спереди.", "Бьёт и закрытых");
    if (c.armorBreak) add("⬢", "×2", "По броне ×2", "Урон по броне врага удваивается.");
    (c.effects || []).forEach((e) => {
      const n = e.amount, dur = e.dur === "fight" ? "на бой" : "на ход", who = e.party ? "всем героям " : "";
      switch (e.type) {
        case "push": add("⇧", "", e.far ? "Толчок до упора" : "Толчок", e.far ? "Толкает врага назад до столкновения. Врезался в другого врага — оба получают Уязвимость." : "Толкает врага на 1 клетку (сторону выбираешь). Толкнутый враг меняет цель; врезался в другого — оба получают Уязвимость.", e.far ? "Толкает до упора" : "Толкает на 1 клетку"); break;
        case "pull": add("⇩", "", "Притяжение", "Притягивает врага вперёд.", "Притягивает врага"); break;
        case "pushOut": add("💨", "", "Растолкать", "Расталкивает врагов вокруг клетки от неё.", "Расталкивает соседей"); break;
        case "stun": add("💫", "", "Оглушение", "Враг пропустит своё следующее действие.", "Оглушает"); break;
        case "draw": add("🂠", "+" + n, `Добор ${n}`, `Возьми ${n} карт${n === 1 ? "у" : "ы"}.`, `Возьми ${n} ${plural(n, "карту", "карты", "карт")}`); break;
        case "energy": add("⚡", "+" + n, `+${n}⚡`, `+${n} энергии.`, `+${n} энергии`); break;
        case "blockParty": add("🛡", n, `Всем +${n}🛡`, `Всем героям ${n} брони.`, `Всем +${n} брони`); break;
        case "mark": add("🎯", "", "Метка", "Метка: следующий удар по этому врагу +50%.", "Следующий удар по цели +50%"); break;
        case "missEnemy": add("🌫", "", "Ослепление", "Враг промахивается своей атакой в этот ход.", "Враг промахнётся в этот ход"); break;
        case "barrier": add("🔰", n, `Барьер ${n}`, `Барьер: блокирует ${n === 1 ? "1 удар" : n + " удара"} любого врага целиком.`, `Блокирует ${n} ${plural(n, "удар", "удара", "ударов")}`); break;
        case "str": add("💪", "+" + n, `Сила +${n}`, `${who ? "Всем героям: " : ""}+${n} Силы ${dur} — каждая атака бьёт на ${n} сильнее.`, `${who ? "Всем " : ""}+${n} Силы ${dur}`); break;
        case "tough": add("🧱", "+" + n, `Стойкость +${n}`, `${who ? "Всем героям: " : ""}+${n} Стойкости ${dur} — каждая карта брони даёт на ${n} больше.`, `${who ? "Всем " : ""}+${n} Стойкости ${dur}`); break;
        case "critReady": add("💥", "", "Крит готов", "Следующий удар героя — крит.", "Следующий удар — крит"); break;
        case "arcane": add("✨", "+" + n, "Чародейство", `Каждая следующая Магическая стрела в этот ход бьёт на +${n}. Складывается, сгорает в конце хода.`, `Следующие Магические стрелы +${n}`); break;
        case "thorns": add("🌵", n, `Шипы ${n}`, `Шипы: враг, ударивший героя, получает ${n} урона.`, `Бьющий тебя получает ${n}`); break;
        case "keepBlock": add("🧱", "∞", "Несокрушимость", "Броня героя больше не сгорает в конце хода.", "Броня не сгорает"); break;
        case "mergeStr": add("🤝", "+" + n, "Ярость товарищей", `Каждый мердж в карту героя: +${n} Силы на бой.`, `Мердж в твою карту: +${n} Силы`); break;
        case "aoeBonus": add("🔥", "+" + n, `Стихии +${n}`, `Все массовки героя +${n} урона.`, `Массовки +${n} урона`); break;
        case "critShift": add("🗡", "−" + n, "Заточка", `Крит героя на ${n} удар раньше до конца боя.`, `Крит на ${n} раньше`); break;
        case "fade": add("🩸", "+" + e.now, "Угасание", `Сразу +${e.now} Силы, потом ${e.turns} хода по −${e.per}.`, `+${e.now} Силы, потом слабеет`); break;
        default: {
          if (["damage", "block", "blockSelf", "blockHero"].includes(e.type)) break;
          const t = (BP.Wide2 && BP.Wide2.effText(c, e)) || (BP.Wide && BP.Wide.effText(c, e));
          const ic = BP.Wide2 && BP.Wide2.ICON[e.type];
          if (t && ic) add(ic, n || "", t.split(/[:—(]/)[0].trim(), t.charAt(0).toUpperCase() + t.slice(1) + ".", t.charAt(0).toUpperCase() + t.slice(1));
        }
      }
    });
    if (c.power) add("◆", "", "Power", "Power: эффект на весь бой; после розыгрыша карта уходит до конца боя.");
    if (c.ex && !c.power) add("⌛", "", "Экзост", "Экзост: после розыгрыша карта уходит до конца боя.");
    if (c.retain) add("📌", "", "Удержание", "Удержание: не сбрасывается в конце хода.");
    if (c.innate) add("☝", "", "Первая в руке", "Всегда приходит в первую руку боя.");
    if (c.unplayable) add("🚫", "", "Мусор", "Сыграть нельзя; в конце хода исчезает до конца боя.", "Сыграть нельзя");
    if (c.evolvedFrom && c.special) add("✦", "", c.special, c.special);
    return out;
  }
  const keyOf = (it) => it.icon + "|" + String(it.word).replace(/[\d×+−-]+/g, "#");
  // Чистая карта из конфига (для деления на «своё» и «полученное»)
  const pristineCache = {};
  function pristine(state, c) {
    const k = c.id + "|" + (c.weapon || "");
    if (!pristineCache[k] || pristineCache[k].cfg !== state.config) {
      const cd = state.config.cards[c.id];
      const card = BP.Engine && BP.Engine.makeCard ? BP.Engine.makeCard(state, c.id, c.weapon) : cd ? JSON.parse(JSON.stringify(cd)) : null;
      pristineCache[k] = { cfg: state.config, card };
    }
    return pristineCache[k].card;
  }
  function active(state, hero, c) {
    const out = [];
    // своё — белым; то, чего нет у чистой карты: было до мерджа → улучшение, иначе — пришло мерджем
    const base = pristine(state, c), baseKeys = new Set(base ? own(state, hero, base).map(keyOf) : []);
    let preKeys = null;
    if (c.wBase) { // карта до мерджа: поля SNAP из wBase (нет в wBase — не было)
      const pre = Object.assign({}, c, { chainBonus: 0, ricoBonus: 0 });
      ((BP.Wide && BP.Wide.SNAP) || Object.keys(c.wBase)).forEach((k) => { if (c.wBase[k] !== undefined) pre[k] = c.wBase[k]; else delete pre[k]; });
      preKeys = new Set(own(state, hero, pre).map(keyOf));
    }
    const U0 = c.ups || {};
    own(state, hero, c).filter((it) => !(U0.fury && it.icon === "⌛")).forEach((it) => { // «Вспышка» сама пишет «Экзост»
      const k = keyOf(it); it.gain = baseKeys.has(k) ? "base" : preKeys && !preKeys.has(k) ? "merge" : c.upgraded ? "up" : "merge"; out.push(it); });
    // улучшения забега (кроме тех, что уже видны: Удержание, Первая в руке, Доп. урон…)
    const U = (state.config.meta || {}).upgrades || {}, ups = c.ups || {}, addUp = (icon, word, long, say) => out.push({ icon, val: "", word, long, say: say || word, gain: "up" });
    Object.keys(ups).forEach((id) => {
      const u = U[id];
      if (!u || !ups[id] || ["retain", "innate", "mfx", "gift", "extra", "ignorecover"].includes(id)) return;
      const txt = id === "up" ? (state.config.meta.upgradeMode === "flat" ? `+${state.config.meta.upFlat || 3} урона или брони` : `+${Math.round((state.config.meta.upPercent || 0.5) * 100 * ups.up)}% урона или брони`)
        : id === "cheaper" ? `дешевле на ${ups.cheaper}⚡` : id === "capup" ? `мердж в карту даёт до +${ups.capup} урона` : u.text;
      addUp(u.icon, u.name, `${u.name}: ${txt}${u.risk ? `, ${u.risk}` : ""}.`, txt.charAt(0).toUpperCase() + txt.slice(1) + (u.risk ? `, ${u.risk}` : ""));
    });
    if (c.freeNow) addUp("🎴", "0⚡ в этот ход", "Ловкость рук: пришла добором — в этот ход стоит 0⚡.", "В этот ход стоит 0⚡");
    // сработавшие эффекты мерджа (свои и союзника) — уже активны
    const lib = state.config.mergeFx || {}, seen = {};
    (c.fired || []).forEach((f) => {
      const fx = (f.id && lib[f.id]) || (c.mfx || []).find((x) => x.text === f.text);
      const key = f.id || f.text;
      if (seen[key]) { seen[key].n++; return; }
      const it = fx ? mfxItem(fx, c) : { icon: "✦", word: f.text, say: f.text, long: f.text };
      it.cond = ""; it.n = 1; it.merge = true; it.gain = "merge"; seen[key] = it; out.push(it);
    });
    out.forEach((it) => { if (it.n > 1) { it.val = (it.val || "") + "×" + it.n; it.word += ` ×${it.n}`; it.say += ` ×${it.n}`; } });
    // порядок: своё → улучшения → мердж
    const rank = { base: 0, up: 1, merge: 2 };
    return out.map((it, i) => [it, i]).sort((a, b) => rank[a[0].gain] - rank[b[0].gain] || a[1] - b[1]).map((x) => x[0]);
  }

  // Эффекты мерджа, которые ещё могут сработать (синяя рамка). Нельзя мерджить — пусто.
  function potential(state, c) {
    if (!(BP.Wide && BP.Wide.on(state) && BP.Wide.mergeable(c))) return [];
    const fired = new Set((c.fired || []).map((f) => f.id || f.text));
    return (c.mfx || []).filter((fx) => !fired.has(fx.id) && !fired.has(fx.text) && !(fx.fixed && c.donor)).map((fx) => mfxItem(fx, c));
  }

  // ---------- html ----------
  function chip(it) {
    return `<span class="fxchip${it.merge ? " m" : ""}">${it.cond ? `<i class="cnd">!</i>` : ""}${esc(it.icon)}${it.val !== undefined && it.val !== "" ? `<b>${esc(it.val)}</b>` : ""}</span>`;
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

  return { damageNow, active, potential, frames, details, mfxItem, fxSay };
})();
