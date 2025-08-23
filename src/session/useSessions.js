// src/session/useSessions.js
import { useEffect, useState, useCallback } from "react";
import { SESSIONS_KEY, CURRENT_SESSION_KEY } from "../constants/session";

/**
 * Manages the sessions dictionary (named sessions), current selection,
 * and file import/export. Persists via localStorage.
 *
 * Expects:
 *  - buildSession(): object   -> current app state snapshot
 *  - applySession(obj): void  -> apply a saved snapshot to the app
 */
export default function useSessions({ buildSession, applySession, autoLoadLast = true } = {}) {
  const [sessions, setSessions] = useState({});     // { [name]: sessionObj }
  const [currentSessionName, setCurrentSessionName] = useState("");

  // Load sessions dict (+ optionally auto-load last)
  useEffect(() => {
    let dict = {};
    try { dict = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "{}"); } catch {}
    setSessions(dict);

    if (autoLoadLast) {
      const last = localStorage.getItem(CURRENT_SESSION_KEY);
      if (last && dict[last] && typeof applySession === "function") {
        // Defer to allow audio engine to mount
        queueMicrotask(() => applySession(dict[last]));
      }
      if (last && dict[last]) setCurrentSessionName(last);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistSessions = useCallback((next) => {
    setSessions(next);
    try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const saveNamedSession = useCallback((name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    if (typeof buildSession !== "function") return;
    const payload = { ...buildSession(), updatedAt: Date.now() };

    const next = { ...sessions, [trimmed]: payload };
    persistSessions(next);

    setCurrentSessionName(trimmed);
    try { localStorage.setItem(CURRENT_SESSION_KEY, trimmed); } catch {}
  }, [buildSession, persistSessions, sessions]);

  const deleteNamedSession = useCallback((name) => {
    const trimmed = (name || "").trim();
    if (!trimmed || !sessions[trimmed]) return;

    const { [trimmed]: _omit, ...rest } = sessions;
    persistSessions(rest);

    if (currentSessionName === trimmed) {
      setCurrentSessionName("");
      try { localStorage.removeItem(CURRENT_SESSION_KEY); } catch {}
    }
  }, [sessions, persistSessions, currentSessionName]);

  const loadNamedSession = useCallback((name) => {
    const trimmed = (name || "").trim();
    if (!trimmed || !sessions[trimmed]) return;

    setCurrentSessionName(trimmed);
    try { localStorage.setItem(CURRENT_SESSION_KEY, trimmed); } catch {}
    if (typeof applySession === "function") applySession(sessions[trimmed]);
  }, [sessions, applySession]);

  const exportSessionToFile = useCallback(() => {
    if (typeof buildSession !== "function") return;
    const data = buildSession();
    const name =
      currentSessionName ||
      `session-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [buildSession, currentSessionName]);

  const importSessionFromFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result || ""));
        if (typeof applySession === "function") applySession(obj);
        const suggested = (file.name || "Imported").replace(/\.json$/i, "");
        const name = prompt("Save imported session as:", suggested);
        if (name) saveNamedSession(name);
      } catch (e) {
        console.error(e);
        alert("Invalid session file.");
      }
    };
    reader.readAsText(file);
  }, [applySession, saveNamedSession]);

  return {
    sessions,
    currentSessionName,

    saveNamedSession,
    loadNamedSession,
    deleteNamedSession,

    exportSessionToFile,
    importSessionFromFile,
  };
}
