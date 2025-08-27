import React from "react";

export default function SessionBar({
  sessions,
  currentSessionName,
  loadNamedSession,
  saveNamedSession,
  deleteNamedSession,
  exportSessionToFile,
  importSessionFromFile,
  onNewSession,
}) {
  const sortedNames = Object
    .entries(sessions)
    .sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0))
    .map(([name]) => name);

  return (
    <div className="sessionbar">
      {/* label is provided by CSS ::before on the row wrapper */}

      <select
        value={currentSessionName}
        onChange={(e) => loadNamedSession(e.target.value)}
        title="Select session"
      >
        <option value="">— choose —</option>
        {sortedNames.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>

      <button
        className="btn"
        title={currentSessionName ? `Save "${currentSessionName}"` : "Save (asks for a name)"}
        onClick={() => {
          if (currentSessionName) {
            saveNamedSession(currentSessionName);
          } else {
            const name = prompt("Session name:", "My Beat");
            if (name) saveNamedSession(name);
          }
        }}
      >
        Save
      </button>

      <button
        className="btn"
        title="Save As…"
        onClick={() => {
          const name = prompt("Save As (new session name):", currentSessionName || "My Beat");
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
        disabled={!currentSessionName}
      >
        Delete
      </button>

      <button className="btn" onClick={exportSessionToFile} title="Export session to file">
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

      <button className="btn" title="Clear current session (keeps BPM 120 and pack)" onClick={onNewSession}>
        New
      </button>
    </div>
  );
}
