// src/components/SessionBar.jsx
import React, { useEffect, useRef, useMemo } from "react";
import useTapGesture from "../../hooks/useTapGesture";

const PERSIST_TRIED_KEY = "gb-persist-tried";

export default function SessionBar({
  sessions = {},
  currentSessionName = "",
  loadNamedSession = () => {},
  saveNamedSession = () => {},
  deleteNamedSession = () => {},

  presets = {},
  currentPresetName = "",
  loadPreset = () => {},
  isPresetActive = false,

  exportSessionToFile = () => {},
  importSessionFromFile = () => {},
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

  // For buttons (ok to block text selection)
  const touchInputStyle = {
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
    WebkitUserSelect: "none",
  };

  /**
   * SPECIAL: for <select> on iOS — ensure SINGLE TAP opens the picker.
   * - Stop parent tap guards at capture phase.
   * - On first touchend, focus() + click() to open immediately.
   * - preventDefault() to avoid the synthetic follow-up click.
   * - Mark as data-tap-exempt so any pointer-based guards skip it.
   */
  const selectTouchProps = useMemo(
    () => ({
      "data-tap-exempt": "",
      style: {
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        userSelect: "auto",
        WebkitUserSelect: "auto",
        pointerEvents: "auto",
      },
      onPointerDownCapture: (e) => e.stopPropagation(),
      onMouseDownCapture:  (e) => e.stopPropagation(),
      onTouchStartCapture: (e) => e.stopPropagation(),
      onTouchEndCapture: (e) => {
        e.stopPropagation();
        const el = e.currentTarget; // <select>
        if (el && !el.disabled) {
          try { el.focus(); } catch {}
          try { el.click(); } catch {}
        }
        // prevent ghost click that can require a second tap
        e.preventDefault();
      },
      onClickCapture: (e) => e.stopPropagation(),
    }),
    []
  );

  const fileRef = useRef(null);
  const importTap = useTapGesture(() => fileRef.current?.click(), { pan: "y", slop: 10 });
  const saveTap   = useTapGesture(onClickSave, { pan: "y", slop: 10 });
  const saveAsTap = useTapGesture(() => {
    const name = prompt(
      "Save As (new session name):",
      currentSessionName || currentPresetName || "My Beat"
    );
    if (!name) return;
    if (sessions[name] && !confirm(`"${name}" exists. Overwrite?`)) return;
    saveNamedSession(name);
  }, { pan: "y", slop: 10 });
  const deleteTap = useTapGesture(() => {
    if (!currentSessionName) return;
    if (confirm(`Delete session "${currentSessionName}"?`)) {
      deleteNamedSession(currentSessionName);
    }
  }, { pan: "y", slop: 10 });
  const exportTap = useTapGesture(() => exportSessionToFile(), { pan: "y", slop: 10 });
  const newTap    = useTapGesture(() => onNewSession(),        { pan: "y", slop: 10 });

  return (
    <div className="sessionbar-neo">
      <div className="session-row session-row--top">
        <span className="bar-label">Session</span>
        <select
          className="session-select"
          value={selectValue}
          onChange={(e) => handleChange(e.target.value)}
          title="Select session or preset"
          {...selectTouchProps}
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
        <button type="button" className="btn" style={touchInputStyle} {...saveTap}>
          {saveButtonLabel}
        </button>

        <button type="button" className="btn" title="Save As…" style={touchInputStyle} {...saveAsTap}>
          Save As
        </button>

        <button
          type="button"
          className="btn"
          title="Delete selected session"
          style={touchInputStyle}
          {...deleteTap}
          disabled={!currentSessionName || isPresetActive}
        >
          Delete
        </button>

        <button
          type="button"
          className="btn"
          title="Export current state to file"
          style={touchInputStyle}
          {...exportTap}
        >
          Export
        </button>

        {/* Hidden file input */}
        <input
          ref={fileRef}
          id="gb-import"
          type="file"
          accept="application/json"
          onChange={(e) => importSessionFromFile(e.target.files?.[0])}
          className="visually-hidden-file"
          style={{ display: "none" }}
        />

        {/* Import trigger */}
        <button type="button" className="btn import-btn" title="Import session from file" style={touchInputStyle} {...importTap}>
          Import
        </button>

        <button type="button" className="btn" title="Clear current session" style={touchInputStyle} {...newTap}>
          New
        </button>
      </div>
    </div>
  );
}
