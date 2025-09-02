// src/session/useSessions.js
import { useEffect, useState, useCallback } from "react";
import { SESSIONS_KEY, CURRENT_SESSION_KEY } from "../constants/session";

/**
 * Manages:
 *  - User sessions in localStorage (save/load/delete/export/import)
 *  - Read-only presets bundled under src/presets (no network)
 *
 * Expects:
 *  - buildSession(): object   -> current app state snapshot
 *  - applySession(obj): void  -> apply a saved/preset snapshot to the app
 */
export default function useSessions({ buildSession, applySession, autoLoadLast = true } = {}) {
  // User sessions (persistent)
  const [sessions, setSessions] = useState({});
  const [currentSessionName, setCurrentSessionName] = useState("");

  // Read-only presets (bundled)
  const [presets, setPresets] = useState({});
  const [currentPresetName, setCurrentPresetName] = useState("");

  // ---- Load sessions dict (+ optionally auto-load last user session) ----
  useEffect(() => {
    let dict = {};
    try { dict = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "{}"); } catch {}
    setSessions(dict);

    if (autoLoadLast) {
      const last = localStorage.getItem(CURRENT_SESSION_KEY);
      if (last && dict[last] && typeof applySession === "function") {
        Promise.resolve().then(() => applySession(dict[last]));
      }
      if (last && dict[last]) setCurrentSessionName(last);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Load presets via Vite glob (no network) ----
  useEffect(() => {
    // NOTE: this path is RELATIVE to THIS FILE (src/session/useSessions.js):
    // ../presets/*.json  ->  src/presets/*.json
    const modules = import.meta.glob("../presets/*.json", {
      eager: true,
      import: "default", // get the parsed JSON directly
    });
    const map = {};
    for (const [path, jsonObj] of Object.entries(modules)) {
      const file = path.split("/").pop() || "";
      const name = file.replace(/\.json$/i, ""); // Disco1.json -> Disco1
      map[name] = jsonObj;
    }
    setPresets(map);
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

    setCurrentPresetName("");
    setCurrentSessionName(trimmed);
    try { localStorage.setItem(CURRENT_SESSION_KEY, trimmed); } catch {}
    if (typeof applySession === "function") applySession(sessions[trimmed]);
  }, [sessions, applySession]);

  // ---- Presets API (read-only) ----
  const loadPreset = useCallback((name) => {
    const trimmed = (name || "").trim();
    if (!trimmed || !presets[trimmed]) return;

    setCurrentSessionName("");
    setCurrentPresetName(trimmed);
    try { localStorage.removeItem(CURRENT_SESSION_KEY); } catch {}
    if (typeof applySession === "function") applySession(presets[trimmed]);
  }, [presets, applySession]);

  // ---- Export / Import ----
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
