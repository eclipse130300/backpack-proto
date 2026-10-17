// Сеть. Два транспорта с одинаковым интерфейсом:
//  - "peer" — PeerJS (WebRTC P2P через бесплатный публичный сервер PeerJS), для игры с друзьями;
//  - "bc"   — BroadcastChannel (несколько вкладок в одном браузере), для отладки (?net=bc).
// Интерфейс: host(code, onConn, onReady, onError) / join(code, onConn, onError)
// conn: { id, send(obj), onData(fn), onClose(fn), close() }
window.BP = window.BP || {};

BP.Net = (function () {
  // У каждой версии (ветки) свои комнаты: игроки с разных ссылок не попадут в одну игру
  const PREFIX = "bprpg-room-" + (window.BP_BRANCH ? window.BP_BRANCH + "-" : "");

  function randomCode() {
    const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 5; i++) s += abc[Math.floor(Math.random() * abc.length)];
    return s;
  }

  // ---------- PeerJS ----------
  function wrapPeerConn(dc) {
    const dataFns = [], closeFns = [];
    dc.on("data", (d) => dataFns.forEach((f) => f(d)));
    dc.on("close", () => closeFns.forEach((f) => f()));
    dc.on("error", () => closeFns.forEach((f) => f()));
    return {
      id: dc.peer,
      send: (o) => { try { dc.send(o); } catch (e) { console.warn(e); } },
      onData: (f) => dataFns.push(f),
      onClose: (f) => closeFns.push(f),
      close: () => dc.close(),
    };
  }

  const peerTransport = {
    host(code, onConn, onReady, onError) {
      if (!window.Peer) return onError("Не загрузилась библиотека PeerJS (нет интернета?)");
      const peer = new window.Peer(PREFIX + code);
      peer.on("open", () => onReady(code));
      peer.on("connection", (dc) => dc.on("open", () => onConn(wrapPeerConn(dc))));
      peer.on("error", (e) => onError(e.type === "unavailable-id" ? "Такая комната уже есть" : "Ошибка сети: " + e.type));
      peer.on("disconnected", () => { try { peer.reconnect(); } catch (e) { /* ignore */ } });
      return peer;
    },
    join(code, onConn, onError) {
      if (!window.Peer) return onError("Не загрузилась библиотека PeerJS (нет интернета?)");
      const peer = new window.Peer();
      peer.on("open", () => {
        const dc = peer.connect(PREFIX + code, { reliable: true });
        dc.on("open", () => onConn(wrapPeerConn(dc)));
        setTimeout(() => { if (!dc.open) onError("Не удалось подключиться к комнате " + code); }, 12000);
      });
      peer.on("error", (e) => onError(e.type === "peer-unavailable" ? "Комната " + code + " не найдена" : "Ошибка сети: " + e.type));
      return peer;
    },
  };

  // ---------- BroadcastChannel (вкладки одного браузера) ----------
  const bcTransport = {
    host(code, onConn, onReady) {
      const ch = new BroadcastChannel(PREFIX + code);
      const conns = {};
      ch.onmessage = (ev) => {
        const m = ev.data;
        if (m.to !== "host") return;
        if (m.kind === "hello" && !conns[m.from]) {
          const dataFns = [], closeFns = [];
          conns[m.from] = { dataFns, closeFns };
          onConn({
            id: m.from,
            send: (o) => ch.postMessage({ to: m.from, kind: "data", data: o }),
            onData: (f) => dataFns.push(f),
            onClose: (f) => closeFns.push(f),
            close: () => {},
          });
          ch.postMessage({ to: m.from, kind: "welcome" });
        } else if (m.kind === "data" && conns[m.from]) conns[m.from].dataFns.forEach((f) => f(m.data));
        else if (m.kind === "bye" && conns[m.from]) { conns[m.from].closeFns.forEach((f) => f()); delete conns[m.from]; }
      };
      setTimeout(() => onReady(code), 50);
      return ch;
    },
    join(code, onConn, onError) {
      const ch = new BroadcastChannel(PREFIX + code);
      const me = "bc" + Math.random().toString(36).slice(2, 8);
      const dataFns = [];
      let opened = false;
      ch.onmessage = (ev) => {
        const m = ev.data;
        if (m.to !== me) return;
        if (m.kind === "welcome" && !opened) {
          opened = true;
          onConn({
            id: me,
            send: (o) => ch.postMessage({ to: "host", from: me, kind: "data", data: o }),
            onData: (f) => dataFns.push(f),
            onClose: () => {},
            close: () => ch.postMessage({ to: "host", from: me, kind: "bye" }),
          });
        } else if (m.kind === "data") dataFns.forEach((f) => f(m.data));
      };
      window.addEventListener("beforeunload", () => ch.postMessage({ to: "host", from: me, kind: "bye" }));
      ch.postMessage({ to: "host", from: me, kind: "hello" });
      setTimeout(() => { if (!opened) onError("Комната " + code + " не найдена (вкладка хоста открыта?)"); }, 3000);
      return ch;
    },
  };

  function transport() {
    const p = new URLSearchParams(location.search).get("net");
    return p === "bc" ? bcTransport : peerTransport;
  }

  return { randomCode, transport };
})();
