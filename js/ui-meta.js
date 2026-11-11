// Экраны забега вне боя (ветка beta-meta, 11.11): карта похода, награда, костёр, кузница, победа + окно «Улучшения».
// Карта идёт слева направо (этаж 1 → босс): так она влезает в горизонтальный экран.
window.BP = window.BP || {};

BP.UIMeta = (function () {
  const esc = (s) => BP.UIGame.esc(s);
  const PHASES = ["map", "reward", "camp", "forge", "victory"];
  const RAR = { common: "обычная", uncommon: "средняя", rare: "редкая" };
  let anim = null; // рулетка выбора пути

  const heroIdx = (s, id) => s.heroes.findIndex((h) => h.id === id);
  const portrait = (s, h) => `<div class="portrait sm hc${heroIdx(s, h.id)}">${BP.Icons.svg((s.config.heroes[heroIdx(s, h.id)] || {}).icon || "helm")}</div>`;
  const pname = (s, pid) => (s.players[pid] || {}).name || "?";

  // ---------- Верхняя панель ----------
  function top(s) {
    const F = s.config.meta.map.floors + 1;
    const title = { map: "Карта похода — куда идём?", reward: s.reward && s.reward.kind === "treasure" ? "💎 Сокровище" : "Награда за бой", camp: "🔥 Костёр", forge: "⚒ Кузница", victory: "👑 Забег пройден!" }[s.phase];
    return `<div class="topbar"><span class="title">${title}</span><span class="chip">Этаж ${s.run.floor}/${F}</span><span class="chip">Боёв: ${s.run.fights}</span>
      <span class="grow"></span>${readyChips(s)}${BP.Session.code ? `<span class="chip">🔑 ${esc(BP.Session.code)}</span>` : `<span class="chip">локально</span>`}
      ${BP.Session.isHost() ? `<button data-act="settings">⚙</button>` : ""}
      <button data-act="deck-view">🂠 Колода</button><button data-act="upgrades-view">⬆ Улучшения</button><button data-act="toggle-log">📜 Лог</button></div>`;
  }

  function readyChips(s) {
    if (!["reward", "camp", "forge"].includes(s.phase)) return "";
    return `<span class="ready-list row">${BP.Engine.metaPlayers(s).map((pid) => { const p = s.players[pid]; return p ? `<span class="chip ${p.ready ? "ok" : ""}">${p.ready ? "✅" : "⏳"} ${esc(p.name)}</span>` : ""; }).join("")}</span>`;
  }

  // ---------- Пати внизу ----------
  function party(s, me) {
    const heroes = s.heroes.map((h) => {
      const pm = h.perm || {}, buffs = [pm.dmg ? `💪+${pm.dmg}` : "", pm.block ? `🛡+${pm.block}` : ""].filter(Boolean).join(" ");
      return `<div class="mparty-hero ${h.owner === me ? "mine" : ""}">${portrait(s, h)}<div><b>${esc(h.name)}</b> <span class="muted small">${esc(pname(s, h.owner))}</span>
        <div class="hpbar"><i style="width:${(100 * h.hp) / h.maxHp}%"></i><span>❤ ${h.hp}/${h.maxHp}</span></div>
        <div class="muted small">🂠 ${(s.run.decks[h.id] || []).length} карт · ⛨ ${h.startBlockMax}${buffs ? " · " + buffs : ""}</div></div></div>`;
    }).join("");
    const relics = Object.keys(s.run.relics).map((id) => { const u = s.config.meta.upgrades[id]; return u ? `<span class="chip">${u.icon} ${esc(u.name)}</span>` : ""; }).join("");
    return `<div class="mparty">${heroes}${relics ? `<div class="mrelics">${relics}</div>` : ""}</div>`;
  }

  // ---------- Карта ----------
  function renderMap(s, me) {
    const map = s.run.map, v = s.run.vote || { votes: {} }, opts = BP.RunMap.options(s);
    const canVote = BP.Engine.metaPlayers(s).includes(me) && !v.result;
    const W = Math.min(window.innerWidth - 80, 1700), H = Math.min(window.innerHeight - 300, 520);
    const nf = map.floors.length, lanes = s.config.meta.map.width;
    const pos = (n) => ({ x: 50 + ((W - 100) * (n.f - 1)) / (nf - 1), y: H / 2 + (n.type === "boss" ? 0 : (n.x - (lanes - 1) / 2) * Math.min(150, (H - 90) / (lanes - 1 || 1))) });
    const all = BP.RunMap.nodes(map);
    const visited = new Set(s.run.visited);
    let lines = "";
    all.forEach((n) => n.next.forEach((id) => {
      const m = all.find((x) => x.id === id), a = pos(n), b = pos(m);
      const walked = visited.has(n.id) && visited.has(m.id);
      lines += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${walked ? "walked" : ""}"/>`;
    }));
    if (!s.run.node) map.floors[0].forEach((n) => { const b = pos(n); lines += `<line x1="0" y1="${H / 2}" x2="${b.x}" y2="${b.y}" class="start"/>`; });
    const nodes = all.map((n) => {
      const p = pos(n), reach = opts.includes(n.id), cur = s.run.node === n.id;
      const voters = Object.entries(v.votes).filter(([, id]) => id === n.id).map(([pid]) => pname(s, pid));
      const mine = v.votes[me] === n.id;
      const cls = ["mnode", "t-" + n.type, reach ? "reach" : "", cur ? "cur" : "", visited.has(n.id) && !cur ? "done" : "", mine ? "mine" : "", reach && canVote ? "clickable" : ""].join(" ");
      return `<div class="${cls}" data-node="${n.id}" ${reach && canVote ? `data-act="map-vote"` : ""} style="left:${p.x}px;top:${p.y}px" title="${esc(BP.RunMap.label(n.type))}">
        <div class="mico">${BP.RunMap.ICON[n.type] || "?"}</div>
        ${reach || cur || n.type === "boss" ? `<div class="mlabel">${esc(BP.RunMap.label(n.type))}</div>` : ""}
        ${voters.length ? `<div class="mvotes">${voters.map((x) => `<span class="chip ok">✔ ${esc(x)}</span>`).join("")}</div>` : ""}</div>`;
    }).join("");
    const left = BP.Engine.metaPlayers(s).filter((p) => v.votes[p] === undefined).map((p) => pname(s, p));
    const status = v.result ? (v.result.tied.length > 1 ? "Ничья — тянем жребий…" : "Путь выбран!")
      : `Нажмите на светящийся узел, чтобы проголосовать. Ждём голос: ${left.map(esc).join(", ") || "—"}. Ничья — решает жребий.`;
    const legend = ["w2", "w3", "elite", "camp", "forge", "treasure", "boss"].map((t) => `<span>${BP.RunMap.ICON[t]} ${esc(BP.RunMap.label(t))}</span>`).join("");
    return `<div class="mscreen"><div class="mstatus">${status}</div>
      <div class="mapbox" style="width:${W}px;height:${H}px"><svg width="${W}" height="${H}">${lines}</svg>${nodes}</div>
      <div class="mlegend">${legend}</div>${party(s, me)}</div>`;
  }

  // ---------- Награда ----------
  function optionHtml(s, h, o, i, mine) {
    const pv = o.preview ? BP.UIDeck.miniCard({ c: o.preview, n: 1 }) : "";
    return `<div class="ropt r-${o.rarity}"><div class="rhead"><b>${esc(BP.Meta.offerTitle(s, o))}</b><span class="rrar">${RAR[o.rarity] || ""}</span></div>
      <div class="small">${esc(BP.Meta.offerText(s, o))}</div>${pv}
      ${o.preview && o.preview.before ? `<div class="muted small">было: ${esc(o.preview.before)}</div>` : ""}
      ${mine ? `<button class="primary" data-act="reward-pick" data-hero="${h.id}" data-idx="${i}">Взять</button>` : ""}</div>`;
  }

  function renderReward(s, me) {
    const rw = s.reward;
    const cols = s.heroes.map((h) => {
      const pk = rw.picks[h.id], mine = h.owner === me;
      let body;
      if (pk) body = `<div class="rdone">✔ ${esc(pk.text)}</div>`;
      else if (!mine) body = `<div class="muted rwait">${esc(pname(s, h.owner))} выбирает…</div>`; // выбор не виден, пока не сделан
      else body = (rw.offers[h.id] || []).map((o, i) => optionHtml(s, h, o, i, true)).join("") + `<button data-act="reward-pick" data-hero="${h.id}" data-idx="-1">Пропустить</button>`;
      return `<div class="rcol lane${heroIdx(s, h.id)}"><div class="rcol-head">${portrait(s, h)}<b>${esc(h.name)}</b><span class="muted small">❤ ${h.hp}/${h.maxHp} · 🂠 ${(s.run.decks[h.id] || []).length}</span></div>${body}</div>`;
    }).join("");
    const sm = s.summary && s.summary.win ? `<div class="muted">«${esc(s.summary.name)}» пройден за ${s.summary.turns} ход${s.summary.turns === 1 ? "" : s.summary.turns < 5 ? "а" : "ов"}.</div>` : "";
    return `<div class="mscreen">${sm}<div class="mstatus">Каждый герой берёт одно из трёх: слот 1 — карта, остальные — улучшения. Можно пропустить. Посмотреть колоды — «🂠 Колода» сверху.</div>
      <div class="rcols">${cols}</div>${readyBar(s, me)}${party(s, me)}</div>`;
  }

  function readyBar(s, me) {
    if (!BP.Engine.metaPlayers(s).includes(me)) return `<div class="mready muted">Вы наблюдаете</div>`;
    const p = s.players[me] || {}, left = s.heroes.filter((h) => h.owner === me && !BP.Engine.metaDone(s, h));
    return `<div class="mready">${left.length ? `<span class="muted">Сначала выбор за: ${left.map((h) => esc(h.name)).join(", ")}</span>` : ""}
      <button class="${p.ready ? "" : "primary"}" data-act="meta-ready" ${left.length ? "disabled" : ""}>${p.ready ? "Отменить готовность" : "Готово ✔"}</button></div>`;
  }

  // ---------- Костёр ----------
  function renderCamp(s, me) {
    const list = (s.campResult || []).map((o) => { const h = s.heroes.find((x) => x.id === o.hero); return `<div class="campline">${portrait(s, h)} <b>${esc(h.name)}</b> +${o.healed} ХП → ❤ ${h.hp}/${h.maxHp}</div>`; }).join("");
    return `<div class="mscreen"><div class="campfire">🔥</div><div class="mstatus">Пати отдыхает у костра: каждый герой лечит ${Math.round((s.config.meta.campHeal || 0.3) * 100)}% макс. ХП.</div>
      <div class="camplist">${list}</div>${readyBar(s, me)}${party(s, me)}</div>`;
  }

  // ---------- Кузница ----------
  function renderForge(s, me) {
    const m = s.config.meta;
    const cols = s.heroes.map((h) => {
      const done = s.forge.done[h.id], mine = h.owner === me, deck = h.runCards || [];
      let body;
      if (done) body = `<div class="rdone">✔ ${esc(done)}</div>`;
      else if (!mine) body = `<div class="muted rwait">${esc(pname(s, h.owner))} в кузнице…</div>`;
      else {
        const canRemove = deck.length > (m.minDeck || 0);
        body = `<div class="fcards">${deck.map((c) => `<div class="fcard">${BP.UIDeck.miniCard({ c, n: 1 })}<div class="fbtns">
          ${BP.Meta.canForgeUp(s, h, c) ? `<button class="small primary" data-act="forge" data-hero="${h.id}" data-card="${c.spec}" data-op="up" title="${esc(BP.Meta.offerText(s, { type: "up", up: "up" }))}">⬆ Усилить</button>` : ""}
          ${canRemove ? `<button class="small" data-act="forge" data-hero="${h.id}" data-card="${c.spec}" data-op="remove">✕ Удалить</button>` : ""}</div></div>`).join("")}</div>
          ${canRemove ? "" : `<div class="muted small">Удалять нельзя: в колоде ${deck.length} карт (минимум ${m.minDeck + 1}).</div>`}
          <button data-act="forge" data-hero="${h.id}" data-op="skip">Пропустить</button>`;
      }
      return `<div class="rcol lane${heroIdx(s, h.id)}"><div class="rcol-head">${portrait(s, h)}<b>${esc(h.name)}</b><span class="muted small">🂠 ${deck.length}</span></div>${body}</div>`;
    }).join("");
    const how = m.upgradeMode === "flat" ? `+${m.upFlat} урона или блока` : `+${Math.round(m.upPercent * 100)}% урона или блока`;
    return `<div class="mscreen"><div class="mstatus">Каждый герой может одно: усилить одну карту (${how}) или удалить одну карту из колоды.</div>
      <div class="rcols">${cols}</div>${readyBar(s, me)}${party(s, me)}</div>`;
  }

  // ---------- Победа ----------
  function renderVictory(s, me) {
    return `<div class="mscreen"><div class="campfire">👑</div><div class="mstatus">Падший жрец повержен! Боёв за забег: ${s.run.fights}.</div>
      <div class="row" style="justify-content:center">${BP.Session.isHost() ? `<button class="primary" data-act="retry">Новый забег</button>` : `<span class="muted">Ждём хоста…</span>`}
      <button data-act="log-csv">Скачать лог (CSV)</button></div>${party(s, me)}</div>`;
  }

  function render(s, me, ui) {
    const body = { map: renderMap, reward: renderReward, camp: renderCamp, forge: renderForge, victory: renderVictory }[s.phase](s, me);
    return `<div class="game meta ${ui.showLog ? "with-log" : ""}">${top(s)}<div class="mbody">${body}</div>${ui.showLog ? BP.UIGame.renderLog(s) : ""}</div>`;
  }

  // ---------- Окно «Улучшения» ----------
  function upgradesModal(s, tab) {
    const U = s.config.meta.upgrades;
    let body;
    if (tab === "all") {
      body = ["common", "uncommon", "rare"].map((t) => `<div class="utier r-${t}"><h3>${RAR[t][0].toUpperCase() + RAR[t].slice(1)}</h3>${Object.entries(U).filter(([, u]) => u.tier === t).map(([, u]) =>
        `<div class="uline"><span class="uico">${u.icon}</span><b>${esc(u.name)}</b> <span class="muted small">${u.on === "hero" ? "герою" : u.on === "party" ? "всей пати" : "карте"}${u.treasureOnly ? ", только сокровище" : ""}</span><div class="small">${esc(u.text)}</div></div>`).join("")}</div>`).join("")
        + `<div class="muted small" style="grid-column:1/-1">Слот 1 награды — всегда карта: новая из пула героя (обычная / средняя / редкая) или копия карты из колоды. Редкие — после элиты и в сокровище.</div>`;
    } else {
      body = s.heroes.map((h) => {
        const pm = h.perm || {}, cards = (h.runCards || []).filter((c) => c.upgraded);
        const hero = [pm.maxHp ? `❤ +${pm.maxHp} макс. ХП` : "", pm.startBlock ? `⛨ +${pm.startBlock} стартового блока` : "", pm.dmg ? `💪 +${pm.dmg} к урону атак` : "", pm.block ? `🛡 +${pm.block} к блоку` : ""].filter(Boolean);
        const lines = cards.map((c) => `<div class="uline"><b>${esc(c.name)}</b>: ${esc(upsText(s, c.ups))}</div>`).join("");
        return `<div class="utier"><h3>${esc(h.name)}</h3>${hero.length ? `<div>${hero.join(" · ")}</div>` : ""}${lines || (hero.length ? "" : `<div class="muted">пока ничего</div>`)}</div>`;
      }).join("") + (Object.keys(s.run.relics).length ? `<div class="utier"><h3>Вся пати</h3>${Object.keys(s.run.relics).map((id) => `<div>${U[id].icon} ${esc(U[id].name)}: ${esc(U[id].text)}</div>`).join("")}</div>` : "");
    }
    return `<div class="modal-back deck-back"><div class="modal deckview upgrades">
      <div class="row"><h2 class="grow">⬆ Улучшения</h2>
        <button class="${tab !== "all" ? "primary" : ""}" data-act="upgrades-view">Наши</button><button class="${tab === "all" ? "primary" : ""}" data-act="upgrades-all">Все возможные</button>
        <button data-act="modal-close">Закрыть (Esc)</button></div>
      <div class="ucols">${body}</div></div></div>`;
  }

  function upsText(s, ups) {
    const U = s.config.meta.upgrades, out = [];
    Object.entries(ups || {}).forEach(([id, v]) => {
      const u = U[id];
      if (!u) return;
      if (id === "gift") out.push(`${u.icon} дары: ${v.map((g) => (s.config.gifts[g] || {}).name || g).join(", ")}`);
      else if (id === "awaken") out.push(`${u.icon} ${u.name} → ${(s.config.cards[v] || {}).name || v}`);
      else out.push(`${u.icon} ${u.name}${v > 1 ? " ×" + v : ""}`);
    });
    return out.join(", ");
  }

  // ---------- Рулетка выбора пути ----------
  function makeSteps(res) {
    if (res.tied.length < 2) return [{ at: 0, id: res.winner }];
    let seed = res.id * 9301 + 49297;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const steps = [];
    let t = 0, dt = 80, prev = null;
    while (t < res.ms - 1000) {
      let id;
      do { id = res.tied[Math.floor(rnd() * res.tied.length)]; } while (id === prev);
      steps.push({ at: t, id }); prev = id; t += dt; dt = Math.min(360, dt * 1.16);
    }
    if (steps[steps.length - 1].id !== res.winner) steps.push({ at: t, id: res.winner });
    return steps;
  }
  function tick() {
    if (!anim) return;
    const dt = Date.now() - anim.t0, last = anim.steps[anim.steps.length - 1];
    let cur = anim.steps[0].id;
    anim.steps.forEach((st) => { if (st.at <= dt) cur = st.id; });
    const done = dt >= last.at;
    document.querySelectorAll(".mnode.reach").forEach((el) => {
      el.classList.toggle("roll", !done && el.dataset.node === cur);
      el.classList.toggle("win", done && el.dataset.node === anim.res.winner);
    });
  }
  function afterRender(s) {
    const res = s && s.phase === "map" && s.run && s.run.vote ? s.run.vote.result : null;
    if (!res) { if (anim) { clearInterval(anim.timer); anim = null; } return; }
    if (!anim || anim.res.id !== res.id) { if (anim) clearInterval(anim.timer); anim = { res, t0: Date.now(), steps: makeSteps(res), timer: setInterval(tick, 40) }; }
    tick();
  }

  return { PHASES, render, upgradesModal, upsText, afterRender };
})();
