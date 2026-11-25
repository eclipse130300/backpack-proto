// Статусы героев и врагов в одном месте (wide-range, правки 25.11): значок, название и что делает — как в Slay the Spire.
// Используется фишками героев и клетками врагов (js/ui-game.js): каждый статус — отдельный значок, наведи — подсказка.
// Каждый элемент: { icon, name, text, bad } — bad: true для дебаффов (красная рамка).
window.BP = window.BP || {};

BP.Status = (function () {
  function hero(state, h) {
    const out = [], add = (icon, name, text, bad) => out.push({ icon, name, text, bad: !!bad });
    if (h.out) add("⛓", "Выведен", "Выведен из игры на этот ход: не берёт карт и не ходит.", true);
    if (h.disableNext) add("⛓", "Выведен в след. ход", "В следующий ход герой не берёт карт и не ходит.", true);
    (h.debuffs || []).forEach((d) => {
      const D = BP.Foes.DEBUFF[d.type];
      if (!D || d.turns <= 0) return;
      const left = Math.max(1, d.turns - (state.phase === "enemies" ? 1 : 0)); // хода героя, включая текущий
      add(D.icon, `${D.name}${d.amount ? " " + d.amount : ""}`, `${D.text(d)} Осталось ходов: ${left}.${d.from ? ` Наложил: ${d.from}.` : ""}`, true);
    });
    if (h.dmgBuff) add("💪", `Сила ${h.dmgBuff > 0 ? "+" : ""}${h.dmgBuff}`, `Каждая карта героя наносит на ${Math.abs(h.dmgBuff)} урона ${h.dmgBuff > 0 ? "больше" : "меньше"}.${h.strTurn ? ` Из них ${h.strTurn} — только на этот ход.` : ""}`, h.dmgBuff < 0);
    if (h.blockBuff) add("🛡️", `Стойкость +${h.blockBuff}`, `Каждая карта защиты героя даёт на ${h.blockBuff} блока больше.${h.toughTurn ? ` Из них ${h.toughTurn} — только на этот ход.` : ""}`);
    if (h.miss) add("🌫", `Завеса${h.miss > 1 ? " " + h.miss : ""}`, `Следующ${h.miss > 1 ? "ие " + h.miss + " удара" : "ий удар"} врага по герою промахнётся.`);
    if (h.critReady) add("💥", "Крит готов", "Следующий удар героя — крит.");
    if (h.barrier) add("🔰", `Барьер ${h.barrier}`, `Блокирует ${h.barrier === 1 ? "1 удар" : h.barrier + " удара"} любого врага целиком.`);
    if (h.thorns) add("🌵", `Шипы ${h.thorns}`, `Враг, ударивший героя, получает ${h.thorns} урона.`);
    if (h.keepBlock) add("🧱", "Несокрушимость", "Блок героя не сгорает в конце хода.");
    if (h.mergeStr) add("🤝", `Ярость товарищей ${h.mergeStr}`, `Каждый мердж в карту героя даёт +${h.mergeStr} Силы на бой.`);
    if (h.aoeBonus) add("🔥", `Стихии +${h.aoeBonus}`, `Все массовки героя наносят на ${h.aoeBonus} урона больше.`);
    if (h.fade && h.fade.left) add("🩸", `Угасание −${h.fade.per}`, `В начале каждого из следующих ${h.fade.left} ходов −${h.fade.per} Силы.`, true);
    if (h.bones) add("🦴", `Кости ${h.bones}`, "Копятся за убитых врагов, их тратят карты Костей.");
    if (h.blood) add("🩸", `Кровь ${h.blood}`, "Сколько ХП герой потерял в этом бою — столько карты Крови могут вылечить.");
    if (h.quiver) add("🏹", `Колчан ${h.quiver}`, "Копится картами Накопителя, его тратят «Разряд колчана» и подобные.");
    return out;
  }

  function enemy(state, e) {
    const out = [], add = (icon, name, text, bad) => out.push({ icon, name, text, bad: !!bad });
    const vs = e.vuln === true ? 1 : e.vuln || 0;
    if (e.str) add("💪", `Сила +${e.str}`, `Каждый удар врага сильнее на ${e.str} до конца боя.`, true);
    if (e.stunned) add("💫", "Оглушён", "Пропустит своё действие.");
    if (vs) add("💥", `Уязвимость +${vs * 50}%`, `Получает на ${vs * 50}% больше урона до конца хода.`);
    if (e.mark) add("🎯", "Метка", "Следующий удар по нему +50%.");
    if (e.missAll) add("🌫", "Ослеплён", "В этот ход промахивается всеми ударами.");
    if (e.weakNext) add("🥀", "Слабость", "Его следующий удар вдвое слабее.");
    if (e.deathMark) add("☠", "Метка смерти", "Умрёт в этот ход — герой получит Кости.");
    const tr = BP.Wide2 && BP.Wide2.trapAt(state, e.col, e.row);
    if (tr) add(BP.Wide2.TRAP[tr.kind].icon, BP.Wide2.TRAP[tr.kind].name, "Ловушка лучника на этой клетке.");
    if (!BP.Cards.isExposed(state, e)) add("⛨", "Прикрыт", "Его прикрывают спереди: мили-герои его не достанут.");
    return out;
  }

  // Значки статусов. who: "hero" | "enemy", id — uid врага или id героя (для подсказки)
  function chips(list, who, id) {
    const esc = BP.UIGame.esc;
    return list.map((x, i) => `<span class="st-chip ${x.bad ? "bad" : ""}" data-tip="status" data-who="${who}" data-sid="${esc(id)}" data-idx="${i}">${x.icon}${shortName(x) ? `<b>${esc(shortName(x))}</b>` : ""}</span>`).join("");
  }
  // На значке — число статуса (Сила +2 → «+2»), без числа — ничего (только иконка)
  function shortName(x) { const m = x.name.match(/[+−-]?\d+%?/); return m ? m[0] : ""; }

  function tip(state, el) {
    const h = el.dataset.who === "hero" && state.heroes.find((x) => x.id === el.dataset.sid);
    const e = el.dataset.who !== "hero" && state.enemies.find((x) => x.uid === el.dataset.sid);
    const list = h ? hero(state, h) : e ? enemy(state, e) : [];
    const x = list[Number(el.dataset.idx)];
    return x ? `<div class="tip-title">${x.icon} ${BP.UIGame.esc(x.name)}</div><div>${BP.UIGame.esc(x.text)}</div>` : null;
  }

  return { hero, enemy, chips, tip };
})();
