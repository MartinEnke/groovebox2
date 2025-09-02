// src/session/useSessions.js
import { useEffect, useState, useCallback } from "react";
import { SESSIONS_KEY, CURRENT_SESSION_KEY } from "../constants/session";

/**
 * Manages:
 *  - User sessions in localStorage (save/load/delete/export/import)
 *  - Read-only presets loaded from /public/presets (Option B)
 *
 * Expects:
 *  - buildSession(): object   -> current app state snapshot
 *  - applySession(obj): void  -> apply a saved/preset snapshot to the app
 */
export default function useSessions({ buildSession, applySession, autoLoadLast = true } = {}) {
  // User sessions (persistent)
  const [sessions, setSessions] = useState({}); // { [name]: sessionObjWithUpdatedAt }
  const [currentSessionName, setCurrentSessionName] = useState("");

  // Read-only presets (bundled, not persisted)
  const [presets, setPresets] = useState({});   // { [name]: presetSnapshot }
  const [currentPresetName, setCurrentPresetName] = useState("");

  // Load sessions dict (+ optionally auto-load last user session)
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

  // Load presets from /public/presets
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // index.json = [{ "name": "DR-11 Starter", "file": "dr11_starter.json" }, ...]
        const list = await fetch("/presets/index.json").then(r => (r.ok ? r.json() : []));
        const map = {};
        for (const { name, file } of list) {
          try {
            const data = await fetch(`/presets/${file}`).then(r => r.json());
            // data should be the same shape as buildSession() returns
            map[name] = data;
          } catch {}
        }
        if (alive) setPresets(map);
      } catch (e) {
        // No presets shipped; that's fine.
        console.warn("No presets found:", e);
      }
    })();
    return () => { alive = false; };
  }, []);

  const persistSessions = useCallback((next) => {
    setSessions(next);
    try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(next)); } catch {}
  }, []);

  // ---- User sessions API ----
  const saveNamedSession = useCallback((name) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    if (typeof buildSession !== "function") return;
    const payload = { ...buildSession(), updatedAt: Date.now() };

    const next = { ...sessions, [trimmed]: payload };
    persistSessions(next);

    setCurrentPresetName(""); // leaving preset mode
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

    setCurrentPresetName(""); // leaving preset mode
    setCurrentSessionName(trimmed);
    try { localStorage.setItem(CURRENT_SESSION_KEY, trimmed); } catch {}
    if (typeof applySession === "function") applySession(sessions[trimmed]);
  }, [sessions, applySession]);

  // ---- Presets API (read-only) ----
  const loadPreset = useCallback((name) => {
    const trimmed = (name || "").trim();
    if (!trimmed || !presets[trimmed]) return;

    setCurrentSessionName(""); // no user session selected
    setCurrentPresetName(trimmed);
    try { localStorage.removeItem(CURRENT_SESSION_KEY); } catch {}
    if (typeof applySession === "function") applySession(presets[trimmed]);
  }, [presets, applySession]);

  // ---- Export / Import (always export the live UI state) ----
  const exportSessionToFile = useCallback(() => {
    if (typeof buildSession !== "function") return;
    const data = buildSession();
    const name =
      currentSessionName ||
      currentPresetName ||
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
  }, [buildSession, currentSessionName, currentPresetName]);

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

  const isPresetActive = !!currentPresetName;

  return {
    // data
    sessions,
    presets,

    // selection
    currentSessionName,
    currentPresetName,
    isPresetActive,

    // actions
    saveNamedSession,
    loadNamedSession,
    loadPreset,
    deleteNamedSession,

    exportSessionToFile,
    importSessionFromFile,
  };
}
