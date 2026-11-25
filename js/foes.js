// Враги в духе Slay the Spire (wide-range, правки 25.11). Числа и списки действий — config.enemies.
// В бою 1–2 «хитрых» врага (role: "special"), остальные простые: бьют и защищаются.
// Новые действия врага:
//   buff {str}       — Сила всем живым врагам: +str к каждому их удару до конца боя (e.str)
//   guard {armor}    — самому побитому союзнику (или себе, если один) +armor брони
//   charge           — замах: ничего не делает, следующее действие идёт по плану (в намерении видно, насколько сильным)
//   debuff {status, amount, turns, targets} — статус герою (h.debuffs) на turns его ходов:
//       weak  — Слабость: каждая карта героя наносит на amount урона меньше (Cards.weakness)
//       hvuln — Уязвимость: удары врагов по герою на 50% сильнее (heroDmg)
// Счётчик d.turns уменьшается в конце фазы врагов (engine.endEnemyPhase), поэтому хранится turns + 1.
window.BP = window.BP || {};

BP.Foes = (function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const DEBUFF = {
    weak:  { icon: "🥀", name: "Слабость",   text: (d) => `Каждая карта героя наносит на ${d.amount} урона меньше.` },
    hvuln: { icon: "💔", name: "Уязвимость", text: () => "Удары врагов по герою на 50% сильнее." }
  };
  const VULN = 1.5;
  const alive = (s) => s.enemies.filter((e) => e.alive);
  const heroName = (s, id) => (s.heroes.find((h) => h.id === id) || {}).name || "?";

  const has = (h, type) => (h.debuffs || []).some((d) => d.type === type && d.turns > 0);
  // Урон врага по герою с учётом Уязвимости
  function heroDmg(h, dmg) { return has(h, "hvuln") ? Math.ceil(dmg * VULN) : dmg; }

  // Кого прикрыть бронёй: самый побитый союзник (по доле ХП + брони), себя — если больше некого
  function guardTarget(state, e) {
    const share = (x) => (x.hp + x.armor) / Math.max(1, x.maxHp + (x.maxArmor || 0));
    const others = alive(state).filter((x) => x !== e).sort((a, b) => share(a) - share(b));
    return others[0] || e;
  }

  // Подготовка намерения (engine.computeIntent): Сила врага к урону, цель защиты, сила удара после замаха
  function prepare(state, e, a, it) {
    if (it.damage) it.damage += e.str || 0;
    if (a.type === "guard") it.ally = guardTarget(state, e).uid;
    if (a.type === "charge") {
      const n = e.actions[(e.intentIdx + 1) % e.actions.length];
      if (n && n.damage) { it.next = n.damage + (e.str || 0); it.nextHits = n.hits || 1; }
    }
  }
  const needsTargets = (a) => a.type === "debuff";

  // Выполнить действие. true — действие наше (обработано здесь)
  function act(state, e, it, heroes, log, fx) {
    switch (it.type) {
      case "buff": {
        alive(state).forEach((x) => (x.str = (x.str || 0) + it.str));
        fx(state, { k: "foe", uid: e.uid, text: `Сила +${it.str} всем` });
        log(state, e.name, `воодушевляет врагов: Сила +${it.str} всем до конца боя`);
        return true;
      }
      case "guard": {
        let t = state.enemies.find((x) => x.uid === it.ally && x.alive);
        if (!t) t = guardTarget(state, e);
        t.armor += it.armor; t.maxArmor = Math.max(t.maxArmor || 0, t.armor);
        fx(state, { k: "foe", uid: t.uid, text: `⬢ +${it.armor}` });
        log(state, e.name, t === e ? `закрывается щитом: +${it.armor} брони` : `прикрывает ${t.name}: +${it.armor} брони`);
        return true;
      }
      case "charge": {
        log(state, e.name, `замахивается — следующий удар: ${it.next || "?"}`);
        return true;
      }
      case "debuff": {
        const D = DEBUFF[it.status];
        if (!D) return true;
        heroes.forEach((h) => {
          const old = (h.debuffs = h.debuffs || []).find((d) => d.type === it.status);
          if (old) { old.turns = Math.max(old.turns, it.turns + 1); old.amount = Math.max(old.amount || 0, it.amount || 0); }
          else h.debuffs.push({ type: it.status, amount: it.amount || 0, turns: it.turns + 1, from: e.name });
          fx(state, { k: "hero", hero: h.id, amount: 0, blocked: 0, status: D.icon + " " + D.name });
        });
        log(state, e.name, `${D.name}: ${heroes.map((h) => h.name).join(", ")}`, { detail: `${D.text({ amount: it.amount })} ${it.turns} хода` });
        return true;
      }
    }
    return false;
  }

  // ---------- тексты для интерфейса ----------
  const tgt = (s, it) => (it.targets ? " → " + it.targets.map((id) => heroName(s, id)).join(", ") : "");
  // Короткое намерение над врагом (null — не наше действие)
  function badge(s, e, it) {
    switch (it.type) {
      case "buff": return `<div class="intent buff">📯 Сила +${it.str} всем</div>`;
      case "guard": { const t = s.enemies.find((x) => x.uid === it.ally); return `<div class="intent def">⬢+${it.armor} → ${esc(t && t !== e ? t.name : "себе")}</div>`; }
      case "charge": return `<div class="intent charge">⏳ замах → ⚔${it.next || "?"}${it.nextHits > 1 ? "×" + it.nextHits : ""}</div>`;
      case "debuff": { const D = DEBUFF[it.status] || {}; return `<div class="intent curse">${D.icon || ""} ${esc(D.name || it.status)}${esc(tgt(s, it))}</div>`; }
    }
    return null;
  }
  // Длинное описание намерения в подсказке врага
  function long(s, e, it) {
    const names = (it.targets || []).map((id) => heroName(s, id)).join(", ");
    switch (it.type) {
      case "buff": return `Воодушевляет: все враги получают Силу +${it.str} — каждый их удар сильнее на ${it.str} до конца боя.`;
      case "guard": { const t = s.enemies.find((x) => x.uid === it.ally); return `Прикрывает ${esc(t && t !== e ? t.name : "себя")}: +${it.armor} брони (броня не сгорает).`; }
      case "charge": return `Замахивается: в этот ход не бьёт, а в следующий ударит на <b>${it.next || "?"}</b>${it.nextHits > 1 ? " × " + it.nextHits : ""}. Убей, оглуши или запасись блоком.`;
      case "debuff": { const D = DEBUFF[it.status] || { text: () => "" }; return `Накладывает <b>${D.name}</b> на <b>${esc(names)}</b> на ${it.turns} хода: ${D.text({ amount: it.amount })}`; }
    }
    return null;
  }
  // Действие в списке «по кругу»
  function short(a) {
    switch (a.type) {
      case "buff": return `📯 Сила +${a.str} всем врагам`;
      case "guard": return `⬢ +${a.armor} брони союзнику`;
      case "charge": return "⏳ замах (следующий удар сильный)";
      case "debuff": { const D = DEBUFF[a.status] || {}; return `${D.icon || ""} ${D.name || a.status}${a.amount ? " " + a.amount : ""} на ${a.turns} хода`; }
    }
    return null;
  }

  return { DEBUFF, heroDmg, has, prepare, needsTargets, act, badge, long, short, guardTarget };
})();
