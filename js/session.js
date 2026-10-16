// Сессия: локальная игра, хост или клиент. Хост держит настоящее состояние и рассылает его.
window.BP = window.BP || {};

BP.Session = (function () {
  const OVERRIDE_KEY = "bprpg-config-override";
  const S = {
    role: null, myPid: null, state: null, code: null, conns: {}, nextPid: 1,
    looping: false, listeners: [], errorFn: null, transportObj: null,
  };

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
        pid = "p" + S.nextPid++;
        S.conns[pid] = conn;
        S.state.players[pid] = { name: (m.name || "Игрок").slice(0, 20), ready: false };
        conn.send({ t: "welcome", pid, code: S.code });
        BP.Engine.log(S.state, S.state.players[pid].name, "подключился");
        broadcast();
      } else if (m.t === "action" && pid) {
        hostApply(pid, m.action);
      }
    });
    conn.onClose(() => {
      if (!pid || !S.conns[pid]) return;
      delete S.conns[pid];
      const name = S.state.players[pid] ? S.state.players[pid].name : pid;
      BP.Engine.playerLeft(S.state, pid, "host");
      BP.Engine.log(S.state, name, "отключился (его герои переданы хосту)");
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
  }

  // Начать заново (с тем же составом игроков и героев) — после смены конфига или поражения
  function restart(cfg) {
    const old = S.state;
    const ns = BP.Engine.createRun(cfg || activeConfig(), old.players);
    ns.heroes.forEach((h) => {
      const oh = old.heroes.find((x) => x.id === h.id);
      if (oh) h.owner = oh.owner;
      if (S.role === "local") h.owner = "host";
    });
    ns.log = old.log.concat([]);
    S.state = ns;
    BP.Engine.log(ns, "—", "Новый забег");
    if (old.phase !== "lobby") BP.Engine.startFight(ns, 0);
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
    S.transportObj = BP.Net.transport().join(S.code, (conn) => {
      S.conns.host = conn;
      conn.send({ t: "hello", name });
      conn.onData((m) => {
        if (m.t === "welcome") { S.myPid = m.pid; }
        else if (m.t === "state") { S.state = m.state; emit(); }
        else if (m.t === "error") err(m.msg);
      });
      conn.onClose(() => err("Связь с хостом потеряна"));
    }, (m) => { err(m); onFail && onFail(m); });
  }

  // ---------- Общий вход для действий ----------
  function dispatch(action) {
    if (S.role === "client") { if (S.conns.host) S.conns.host.send({ t: "action", action }); }
    else hostApply(S.myPid, action);
  }

  window.addEventListener("beforeunload", (e) => {
    if (S.role === "host" && S.state && S.state.phase !== "lobby") { e.preventDefault(); e.returnValue = ""; }
  });

  return {
    get role() { return S.role; }, get myPid() { return S.myPid; }, get state() { return S.state; }, get code() { return S.code; },
    isHost: () => S.role === "host" || S.role === "local",
    onChange: (f) => S.listeners.push(f), onError: (f) => (S.errorFn = f),
    startLocal, startHost, join, dispatch, applyConfig, restart, activeConfig, getOverride, clearOverride, fullLog: () => (S.state ? S.state.log : []),
  };
})();
