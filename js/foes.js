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
    hvuln: { icon: "💔", name: "Уязвимость", text: () => "Удары врагов по герою на 50% сильнее." },
    // правки 26.11
    frail: { icon: "🦴", name: "Хрупкость",  text: () => "Броня с карт героя на 25% меньше." },
    entangle: { icon: "🕸", name: "Опутан",  text: () => "Герой не может играть атаки." }
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
  // 27.11: рост урона с ходами (rules.enemyRamp): с хода from +per за ход, складывается. 0 — нет роста
  function ramp(state, ahead) {
    const r = state.config.rules.enemyRamp;
    return r && r.per ? Math.max(0, state.turn + (ahead || 0) - r.from + 1) * r.per : 0;
  }
  const rampDmg = (state, d, ahead) => Math.ceil(d * (1 + ramp(state, ahead)) - 1e-9);
  function prepare(state, e, a, it) {
    if (it.damage) it.damage = rampDmg(state, it.damage + (e.str || 0));
    if (a.type === "guard") it.ally = guardTarget(state, e).uid;
    if (a.type === "charge") {
      const n = e.actions[(e.intentIdx + 1) % e.actions.length];
      if (n && n.damage) { it.next = rampDmg(state, n.damage + (e.str || 0), 1); it.nextHits = n.hits || 1; }
    }
    if (BP.Foes2) BP.Foes2.prepare(state, e, a, it);
  }
  const needsTargets = (a) => a.type === "debuff" || (BP.Foes2 && BP.Foes2.needsTargets(a));

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
        applyDebuff(state, e, it, heroes);
        log(state, e.name, `${D.name}: ${heroes.map((h) => h.name).join(", ")}`, { detail: `${D.text({ amount: it.amount })} ${it.turns} хода` });
        return true;
      }
    }
    return BP.Foes2 ? BP.Foes2.act(state, e, it, heroes, log, fx) : false; // правки 26.11: ритуал, рост, лечение, призыв, мусор, сон
  }

  // Повесить дебафф героям (действие debuff и Споры). Ход врагов ещё идёт — поэтому turns + 1
  function applyDebuff(state, e, it, heroes) {
    const D = DEBUFF[it.status];
    if (!D) return;
    heroes.forEach((h) => {
      const old = (h.debuffs = h.debuffs || []).find((d) => d.type === it.status);
      const turns = it.turns + (state.phase === "enemies" ? 1 : 0);
      if (old) { old.turns = Math.max(old.turns, turns); old.amount = Math.max(old.amount || 0, it.amount || 0); }
      else h.debuffs.push({ type: it.status, amount: it.amount || 0, turns, from: e.name });
      BP.Engine.fxPublic(state, { k: "hero", hero: h.id, amount: 0, blocked: 0, status: D.icon + " " + D.name });
    });
  }

  // ---------- тексты для интерфейса ----------
  const tgt = (s, it) => (it.targets ? " → " + it.targets.map((id) => heroName(s, id)).join(", ") : "");
  // Короткое намерение над врагом (null — не наше действие)
  function badge(s, e, it) {
    switch (it.type) {
      case "buff": return `<div class="intent buff">📯 Сила +${it.str} всем</div>`;
      case "guard": { const t = s.enemies.find((x) => x.uid === it.ally); return `<div class="intent def">⬢+${it.armor} → ${esc(t && t !== e ? t.name : "себе")}</div>`; }
      case "charge": return `<div class="intent charge">⏳ замах → ⚔${it.next || "?"}${it.nextHits > 1 ? "×" + it.nextHits : ""}</div>`;
      case "debuff": { const D = DEBUFF[it.status] || {}; return `<div class="intent curse">${D.icon || ""}${esc(tgt(s, it))}</div>`; } // 27.11: коротко (название — в подсказке), чтобы не закрывать ХП
    }
    return BP.Foes2 ? BP.Foes2.badge(s, e, it) : null;
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
    return BP.Foes2 ? BP.Foes2.long(s, e, it) : null;
  }
  // Действие в списке «по кругу»
  function short(a) {
    switch (a.type) {
      case "buff": return `📯 Сила +${a.str} всем врагам`;
      case "guard": return `⬢ +${a.armor} брони союзнику`;
      case "charge": return "⏳ замах (следующий удар сильный)";
      case "debuff": { const D = DEBUFF[a.status] || {}; return `${D.icon || ""} ${D.name || a.status}${a.amount ? " " + a.amount : ""} на ${a.turns} хода${a.targets > 1 ? ` (${a.targets} героям)` : ""}`; }
    }
    return BP.Foes2 ? BP.Foes2.short(a) : null;
  }

  return { DEBUFF, heroDmg, has, ramp, prepare, needsTargets, act, applyDebuff, badge, long, short, guardTarget };
})();
