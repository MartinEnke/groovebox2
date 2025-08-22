// ===== Instruments (2 x 5) =====
// NOTE: label-only; actual audio comes from the selected pack
export const INSTRUMENTS = [
    { id: "kick", label: "BD" },
    { id: "snare", label: "SD" },
    { id: "clap", label: "CLAP" },
    { id: "tom1", label: "TOM1" },
    { id: "tom2", label: "TOM2" },
    { id: "rim", label: "RIM" },
    { id: "tam", label: "TAM" },
    { id: "hihat", label: "HH" },
    { id: "openhihat", label: "OHH" },
    { id: "ride", label: "RIDE" },
  ];
  
  // Hi-hat choke map: when a key plays, these targets get choked
  export const CHOKE_GROUPS = {
    hihat: ["openhihat"], // closed HH cuts open HH
    // add more if you like: e.g. "rim": ["clap"]
  };
  