// Выбор квеста перед боем (фаза questPick): 3 варианта стоят на месте рук героев (руки ещё не набраны),
// поле врагов видно целиком — отмеченные 🎯 враги подписаны номером квеста.
// Каждый игрок с героями голосует. Итог: один лидер — он мигает; ничья — рулетка по лидерам, потом мигает выбранный.
window.BP = window.BP || {};

BP.UIQuest = (function () {
  const esc = (s) => BP.UIGame.esc(s);
  let anim = null; // { res, t0, steps: [{at, idx}], timer }

  function rewardHtml(s, cid) {
    const c = s.config.cards[cid] || {};
    const card = { ...c, id: cid, effects: c.effects || [] };
    return `<div class="qreward"><span class="muted small">Награда — одноразовая карта:</span>
      <div><b>${esc(c.name || cid)}</b> <span class="tip-cost">${c.cost || 0}⚡</span></div>
      <div class="small">${esc(BP.Cards.text(card))}</div></div>`;
  }

  function renderBar(s, myPid) {
    const qp = s.questPick;
    if (!qp) return `<div class="handbar"></div>`;
    const req = BP.Engine.requiredPlayers(s);
    const canVote = req.includes(myPid) && !qp.result;
    const opts = qp.options.map((q, i) => {
      const voters = Object.entries(qp.votes).filter(([, v]) => v === i).map(([pid]) => (s.players[pid] || {}).name || pid);
      const mine = qp.votes[myPid] === i;
      const mark = q.mark ? `<div class="small">🎯 цель: <b>${esc(q.markName)}</b> (на поле — «🎯${i + 1}»)</div>` : "";
      return `<div class="qopt ${mine ? "mine" : ""}" data-qidx="${i}">
        <div class="qnum">${i + 1}</div>
        <div class="qtext">${esc(q.text)}</div>${mark}
        ${rewardHtml(s, q.reward)}
        <div class="qvotes">${voters.map((n) => `<span class="chip ok">✔ ${esc(n)}</span>`).join("") || `<span class="muted small">голосов нет</span>`}</div>
        ${canVote ? `<button class="${mine ? "" : "primary"}" data-act="quest-vote" data-idx="${i}">${mine ? "Ваш голос ✔" : "Голосовать"}</button>` : ""}
      </div>`;
    }).join("");
    const left = req.filter((p) => qp.votes[p] === undefined).map((p) => (s.players[p] || {}).name || p);
    const status = qp.result
      ? (qp.result.tied.length > 1 ? "Ничья — тянем жребий…" : "Квест выбран!")
      : `Выберите квест на бой. Ждём голос: ${left.map(esc).join(", ") || "—"}. Посмотреть карты — кнопка «🂠 Колода» сверху.`;
    return `<div class="handbar qpick"><div class="qpick-head">${status}</div>${opts}</div>`;
  }

  // Шаги рулетки: интервалы растут, последний шаг — победитель. Порядок псевдослучайный от id итога (одинаков у всех).
  function makeSteps(res) {
    if (res.tied.length < 2) return [{ at: 0, idx: res.winner }];
    let seed = res.id * 9301 + 49297;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const steps = [];
    let t = 0, dt = 80, prev = -1;
    const end = res.ms - 1100;
    while (t < end) {
      let idx;
      do { idx = res.tied[Math.floor(rnd() * res.tied.length)]; } while (idx === prev && res.tied.length > 1);
      steps.push({ at: t, idx }); prev = idx;
      t += dt; dt = Math.min(360, dt * 1.16);
    }
    if (steps[steps.length - 1].idx !== res.winner) steps.push({ at: t, idx: res.winner });
    return steps;
  }

  function tick() {
    if (!anim) return;
    const els = document.querySelectorAll(".qopt[data-qidx]");
    const dt = Date.now() - anim.t0;
    const last = anim.steps[anim.steps.length - 1];
    let cur = anim.steps[0].idx;
    anim.steps.forEach((st) => { if (st.at <= dt) cur = st.idx; });
    const done = dt >= last.at;
    els.forEach((el) => {
      const i = +el.dataset.qidx;
      el.classList.toggle("roll", !done && i === cur);
      el.classList.toggle("win", done && i === anim.res.winner);
      el.classList.toggle("lose", done && i !== anim.res.winner);
    });
  }

  // После каждого рендера: запустить/продолжить анимацию выбора
  function afterRender(s) {
    const res = s && s.phase === "questPick" && s.questPick ? s.questPick.result : null;
    if (!res) { if (anim) { clearInterval(anim.timer); anim = null; } return; }
    if (!anim || anim.res.id !== res.id || anim.res.winner !== res.winner) {
      if (anim) clearInterval(anim.timer);
      anim = { res, t0: Date.now(), steps: makeSteps(res), timer: setInterval(tick, 40) };
    }
    tick();
  }

  return { renderBar, afterRender };
})();
