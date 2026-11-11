// Сессия: локальная игра, хост или клиент. Хост держит настоящее состояние и рассылает его.
window.BP = window.BP || {};

BP.Session = (function () {
  const OVERRIDE_KEY = "bprpg-config-override";
  const S = {
    role: null, myPid: null, state: null, code: null, conns: {}, nextPid: 1,
    looping: false, listeners: [], errorFn: null, transportObj: null,
    rids: {},            // хост: ключ переподключения клиента → его pid (чтобы вернуть ему героев)
    rid: null, name: "", reconnecting: false, retryTimer: null, // клиент
  };
  const infoFn = { f: null };
  const info = (m) => infoFn.f && infoFn.f(m);

  // Ключ переподключения: свой у каждой вкладки, переживает обрыв сети и перезагрузку страницы
  function myRid() {
    let r = null;
    try { r = sessionStorage.getItem("bprpg-rejoin-id"); } catch (e) { /* ignore */ }
    if (!r) { r = "r" + Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem("bprpg-rejoin-id", r); } catch (e) { /* ignore */ } }
    return r;
  }

  const emit = () => S.listeners.forEach((f) => f());
  const err = (m) => S.errorFn && S.errorFn(m);

  // ---------- Конфиг ----------
  function getOverride() {
    try {
      const raw = localStorage.getItem(OVERRIDE_KEY);
      const o = raw ? JSON.parse(raw) : null;
      // Настройки от старой версии config.js не применяем: в них нет новых полей (иконки, щиты, тесты)
      if (o && (!o.config || o.config.version !== window.GAME_CONFIG.version)) { clearOverride(); return null; }
      return o;
    } catch (e) { return null; }
  }
  function activeConfig() {
    const o = getOverride();
    return o ? o.config : window.GAME_CONFIG;
  }
  function saveOverride(cfg) {
    try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), config: cfg })); } catch (e) { /* ignore */ }
  }
  function clearOverride() { try { localStorage.removeItem(OVERRIDE_KEY); } catch (e) { /* ignore */ } }

  // ---------- Хост / локально ----------
  function initHostState(name) {
    S.myPid = "host";
    S.state = BP.Engine.createRun(activeConfig(), { host: { name: name || "Хост", ready: false, host: true } });
  }

  function startLocal(name) {
    S.role = "local";
    initHostState(name);
    S.state.heroes.forEach((h) => (h.owner = "host"));
    emit();
  }

  function startHost(name, onReady) {
    S.role = "host";
    initHostState(name);
    const code = BP.Net.randomCode();
    S.code = code;
    S.transportObj = BP.Net.transport().host(code, onConn, () => { onReady && onReady(code); emit(); }, (m) => err(m));
  }

  function onConn(conn) {
    let pid = null;
    conn.onData((m) => {
      if (m.t === "hello" && !pid) {
        const back = m.rid && S.rids[m.rid];
        if (back) {
          // Переподключение: тот же игрок получает обратно свой pid и своих героев
          pid = back;
          const old = S.conns[pid];
          S.conns[pid] = conn;
          if (old && old !== conn) { try { old.close(); } catch (e) { /* ignore */ } }
          BP.Engine.playerBack(S.state, pid, (m.name || "Игрок").slice(0, 20));
          BP.Engine.log(S.state, S.state.players[pid].name, "переподключился");
        } else {
          pid = "p" + S.nextPid++;
          if (m.rid) S.rids[m.rid] = pid;
          S.conns[pid] = conn;
          S.state.players[pid] = { name: (m.name || "Игрок").slice(0, 20), ready: false };
          BP.Engine.log(S.state, S.state.players[pid].name, "подключился");
        }
        conn.send({ t: "welcome", pid, code: S.code });
        broadcast();
      } else if (m.t === "ping") {
        conn.send({ t: "pong" });
      } else if (m.t === "action" && pid && S.conns[pid] === conn) {
        hostApply(pid, m.action);
      }
    });
    conn.onClose(() => {
      // Старое соединение, которое уже заменено переподключением, ничего не трогает
      if (!pid || S.conns[pid] !== conn) return;
      delete S.conns[pid];
      const name = S.state.players[pid] ? S.state.players[pid].name : pid;
      BP.Engine.playerLeft(S.state, pid, "host");
      BP.Engine.log(S.state, name, S.state.phase === "lobby" ? "отключился" : "отключился (его герои временно у хоста, вернутся при переподключении)");
      broadcast();
      maybeRunEnemies();
    });
  }

  function hostApply(pid, action) {
    const res = BP.Engine.applyAction(S.state, pid, action, pid === "host");
    if (res === "RESTART") { restart(); return; }
    if (res) {
      if (pid === S.myPid) err(res);
      else if (S.conns[pid]) S.conns[pid].send({ t: "error", msg: res });
    }
    broadcast();
    maybeRunEnemies();
  }

  function maybeRunEnemies() {
    if (S.looping || !S.state || S.state.phase !== "enemies") return;
    S.looping = true;
    const delay = () => Math.max(0, S.state.config.rules.enemyStepDelayMs || 0);
    const tick = () => {
      const more = BP.Engine.enemyStep(S.state);
      broadcast();
      if (more) setTimeout(tick, delay());
      else S.looping = false;
    };
    setTimeout(tick, delay());
  }

  function broadcast() {
    if (S.role === "host") {
      const pub = BP.Engine.publicState(S.state);
      Object.values(S.conns).forEach((c) => c.send({ t: "state", state: pub }));
    }
    emit();
    maybeGoOnMap();
  }

  // beta-meta: путь на карте выбран — ждём, пока у всех доиграет анимация выбора (рулетка при ничьей), и входим в узел
  function maybeGoOnMap() {
    const s = S.state, v = s && s.run && s.run.vote;
    if (S.role === "client" || !s || s.phase !== "map" || !v || !v.result) return;
    const res = v.result;
    if (S.mapTimer === res) return;
    S.mapTimer = res;
    setTimeout(() => {
      if (S.state === s && s.phase === "map" && s.run.vote && s.run.vote.result === res) hostApply(S.myPid, { a: "mapGo" });
    }, res.ms);
  }

  // Начать заново (с тем же составом игроков и героев) — после смены конфига или поражения
  function restart(cfg) {
    const old = S.state;
    const ns = BP.Engine.createRun(cfg || activeConfig(), old.players);
    ns.heroes.forEach((h) => {
      const oh = old.heroes.find((x) => x.id === h.id);
      if (oh) { h.owner = oh.owner; if (oh.away) h.away = oh.away; }
      if (S.role === "local") h.owner = "host";
    });
    ns.log = old.log.concat([]);
    S.state = ns;
    BP.Engine.log(ns, "—", "Новый забег");
    if (old.phase !== "lobby") {
      if (ns.run) { BP.Meta.refreshView(ns); BP.RunMap.openVote(ns); } else BP.Engine.startFight(ns, 0);
    }
    broadcast();
  }

  function applyConfig(cfg) {
    saveOverride(cfg);
    restart(cfg);
  }

  // ---------- Клиент ----------
  function join(code, name, onFail) {
    S.role = "client";
    S.code = code.toUpperCase().trim();
    S.name = name;
    S.rid = myRid();
    connectClient(onFail);
  }

  function connectClient(onFail) {
    clearTimeout(S.retryTimer);
    let done = false; // этот заход уже обработан (успех или провал)
    const failed = (m) => {
      if (done) return; done = true;
      if (S.state) scheduleRetry(); // уже были в игре — не сдаёмся, пробуем снова
      else { err(m); onFail && onFail(m); }
    };
    const tr = BP.Net.transport();
    try { if (S.transportObj && S.transportObj.destroy) S.transportObj.destroy(); } catch (e) { /* ignore */ }
    S.transportObj = tr.join(S.code, (conn) => {
      done = true;
      S.conns.host = conn;
      conn.send({ t: "hello", name: S.name, rid: S.rid });
      S.lastSeen = Date.now();
      conn.onData((m) => {
        if (S.conns.host !== conn) return;
        S.lastSeen = Date.now();
        if (m.t === "welcome") {
          S.myPid = m.pid;
          if (S.reconnecting) { S.reconnecting = false; info("Связь восстановлена"); }
        }
        else if (m.t === "state") { S.state = m.state; emit(); }
        else if (m.t === "error") err(m.msg);
      });
      conn.onClose(() => lostHost(conn));
    }, failed);
  }

  function lostHost(conn) {
    if (S.conns.host !== conn) return;
    delete S.conns.host;
    if (!S.reconnecting) err("Связь с хостом потеряна — переподключаюсь…");
    scheduleRetry();
  }

  // Пульс: WebRTC может долго не замечать пропавшую сеть. Клиент пингует хоста;
  // 10 с тишины — считаем связь потерянной и переподключаемся сами.
  setInterval(() => {
    const c = S.conns.host;
    if (S.role !== "client" || !c) return;
    if (Date.now() - (S.lastSeen || 0) > 10000) { try { c.close(); } catch (e) { /* ignore */ } lostHost(c); return; }
    c.send({ t: "ping" });
  }, 3000);

  function scheduleRetry() {
    S.reconnecting = true;
    emit();
    clearTimeout(S.retryTimer);
    S.retryTimer = setTimeout(() => { if (!S.conns.host) connectClient(); }, 3000);
  }

  // Только для проверки: оборвать связь клиента (как пропавший интернет)
  function debugDrop() { const c = S.conns.host; if (c) c.close(); }

  // ---------- Общий вход для действий ----------
  function dispatch(action) {
    if (S.role === "client") {
      if (S.conns.host) S.conns.host.send({ t: "action", action });
      else err("Нет связи с хостом — переподключаюсь…");
    }
    else hostApply(S.myPid, action);
  }

  window.addEventListener("beforeunload", (e) => {
    if (S.role === "host" && S.state && S.state.phase !== "lobby") { e.preventDefault(); e.returnValue = ""; }
  });

  return {
    get role() { return S.role; }, get myPid() { return S.myPid; }, get state() { return S.state; }, get code() { return S.code; },
    get reconnecting() { return S.reconnecting; },
    isHost: () => S.role === "host" || S.role === "local",
    onChange: (f) => S.listeners.push(f), onError: (f) => (S.errorFn = f), onInfo: (f) => (infoFn.f = f), debugDrop,
    startLocal, startHost, join, dispatch, applyConfig, restart, activeConfig, getOverride, clearOverride, fullLog: () => (S.state ? S.state.log : []),
  };
})();
