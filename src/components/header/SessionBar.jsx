// src/components/SessionBar.jsx
import React, { useEffect } from "react";

const PERSIST_TRIED_KEY = "gb-persist-tried";

export default function SessionBar({
  // user sessions
  sessions = {},
  currentSessionName = "",
  loadNamedSession = () => {},
  saveNamedSession = () => {},
  deleteNamedSession = () => {},

  // presets (read-only)
  presets = {},                 // <— default
  currentPresetName = "",       // <— default
  loadPreset = () => {},        // <— default
  isPresetActive = false,       // <— default

  // file ops
  exportSessionToFile = () => {},
  importSessionFromFile = () => {},

  // misc
  onNewSession = () => {},
}) {
  const sortedUserNames = Object
    .entries(sessions || {})
    .sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0))
    .map(([name]) => name);

  const presetNames = Object.keys(presets || {}).sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    let done = false;
    (async () => {
      if (done) return;
      if (!("storage" in navigator) || !("persist" in navigator.storage)) return;
      try {
        if (localStorage.getItem(PERSIST_TRIED_KEY)) return;
        const already = (await navigator.storage.persisted?.()) === true;
        if (!already) await navigator.storage.persist();
        localStorage.setItem(PERSIST_TRIED_KEY, "1");
      } catch (e) {
        console.debug("Storage persist request failed:", e);
      }
    })();
    return () => { done = true; };
  }, []);

  const selectValue =
    currentPresetName
      ? `preset:${currentPresetName}`
      : currentSessionName
      ? `user:${currentSessionName}`
      : "";

  const handleChange = (val) => {
    if (!val) return;
    if (val.startsWith("preset:")) loadPreset(val.slice(7));
    else if (val.startsWith("user:")) loadNamedSession(val.slice(5));
  };

  const saveButtonLabel = isPresetActive || !currentSessionName ? "Save As" : "Save";
  const onClickSave = () => {
    if (isPresetActive || !currentSessionName) {
      const name = prompt("Session name:", currentSessionName || currentPresetName || "My Beat");
      if (name) saveNamedSession(name);
    } else {
      saveNamedSession(currentSessionName);
    }
  };

  return (
    <div className="sessionbar-neo">
      <div className="session-row session-row--top">
        <span className="bar-label">Session</span>
        <select
          className="session-select"
          value={selectValue}
          onChange={(e) => handleChange(e.target.value)}
          title="Select session or preset"
        >
          <option value="">— choose —</option>

          {presetNames.length > 0 && (
            <optgroup label="Presets">
              {presetNames.map((name) => (
                <option key={`preset:${name}`} value={`preset:${name}`}>
                  {name} (preset)
                </option>
              ))}
            </optgroup>
          )}

          {sortedUserNames.length > 0 && (
            <optgroup label="My Sessions">
              {sortedUserNames.map((name) => (
                <option key={`user:${name}`} value={`user:${name}`}>
                  {name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <div className="session-row session-row--buttons">
        <button className="btn" onClick={onClickSave}>
          {saveButtonLabel}
        </button>

        <button
          className="btn"
          title="Save As…"
          onClick={() => {
            const name = prompt(
              "Save As (new session name):",
              currentSessionName || currentPresetName || "My Beat"
            );
            if (!name) return;
            if (sessions[name] && !confirm(`"${name}" exists. Overwrite?`)) return;
            saveNamedSession(name);
          }}
        >
          Save As
        </button>

        <button
          className="btn"
          title="Delete selected session"
          onClick={() => {
            if (!currentSessionName) return;
            if (confirm(`Delete session "${currentSessionName}"?`)) {
              deleteNamedSession(currentSessionName);
            }
          }}
          disabled={!currentSessionName || isPresetActive}
        >
          Delete
        </button>

        <button className="btn" onClick={exportSessionToFile} title="Export current state to file">
          Export
        </button>

        <label className="btn" title="Import session from file" style={{ cursor: "pointer" }}>
          Import
          <input
            type="file"
            accept="application/json"
            onChange={(e) => importSessionFromFile(e.target.files?.[0])}
            style={{ display: "none" }}
          />
        </label>

        <button className="btn" title="Clear current session" onClick={onNewSession}>
          New
        </button>
      </div>
    </div>
  );
}
