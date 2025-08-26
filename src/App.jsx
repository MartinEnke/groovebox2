import React from "react";
import GrooveBox from "./GrooveBox.jsx";

export default function App() {
  console.log("APP_MINIMAL_MARKER");
  return (
    <div style={{ minHeight: "100vh", background: "#111", color: "white", padding: 16 }}>
      
      <GrooveBox />
    </div>
  );
}