// ===== Sample packs =====
// Map each instrument id to a file in that pack.
export const SAMPLE_PACKS = {
    one: {
      label: "DR7",
      files: {
        kick: "/packs/DR7/BD.wav",
        snare: "/packs/DR7/SD.wav",
        clap: "/packs/DR7/CLAP.wav",
        tom1: "/packs/DR7/TOM1.wav",
        tom2: "/packs/DR7/TOM2.wav",
        rim: "/packs/DR7/RIM.wav",
        tam: "/packs/DR7/TAM.wav",
        hihat: "/packs/DR7/HH.wav",
        openhihat: "/packs/DR7/OHH.wav",
        ride: "/packs/DR7/RIDE.wav",
      },
    },
    two: {
      label: "Tech1",
      files: {
        kick: "/packs/Tech1/BD.wav",
        snare: "/packs/Tech1/SD.wav",
        clap: "/packs/Tech1/CLAP.wav",
        tom1: "/packs/Tech1/TOM1.wav",
        tom2: "/packs/Tech1/TOM2.wav",
        rim: "/packs/Tech1/RIM.wav",
        tam: "/packs/Tech1/TAM.wav",
        hihat: "/packs/Tech1/HH.wav",
        openhihat: "/packs/Tech1/OHH.wav",
        ride: "/packs/Tech1/RIDE.wav",
      },
    },
    three: {
      label: "TR-909",
      files: {
        kick: "/packs/909/BD.wav",
        snare: "/packs/909/SD.wav",
        clap: "/packs/909/CLAP.wav",
        tom1: "/packs/909/TOM1.wav",
        tom2: "/packs/909/TOM2.wav",
        rim: "/packs/909/RIM.wav",
        tam: "/packs/909/TAM.wav",
        hihat: "/packs/909/HH.wav",
        openhihat: "/packs/909/OHH.wav",
        ride: "/packs/909/RIDE.wav",
      },
    },
  };
  export const PACK_IDS = Object.keys(SAMPLE_PACKS);
  