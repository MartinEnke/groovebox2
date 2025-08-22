import React from "react";

export default function SumBusPanel({
  limiterOn, setLimiterOn,
  sumComp, setSumComp,
  sumGainDb, setSumGainDb,
  sumMeterDb,
}) {
  const meterPct = Math.max(0, Math.min(1, (sumMeterDb + 60) / 60)); // -60..0 dBFS → 0..1

  return (
    <div
      style={{
        marginTop: 4,
        padding: 12,
        borderRadius: 10,
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(255,255,255,.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", opacity: 0.9 }}>
          Sum Bus
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: 0.9 }}>
          <input
            type="checkbox"
            checked={limiterOn}
            onChange={(e) => setLimiterOn(e.target.checked)}
          />
          Limiter
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 0.8fr", gap: 16, marginTop: 12 }}>
        {/* Peak Meter */}
        <div>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Peak Meter</div>
          <div style={{ height: 12, background: "rgba(255,255,255,.08)", borderRadius: 6, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${meterPct * 100}%`,
                background: sumMeterDb > -1 ? "#b91c1c" : sumMeterDb > -6 ? "#d97706" : "#10b981",
                transition: "width 50ms linear",
              }}
            />
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
            {Number.isFinite(sumMeterDb) ? `${sumMeterDb.toFixed(1)} dBFS` : "—"}
          </div>
        </div>

        {/* Compressor */}
        <div>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Compressor</div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ display: "grid", gridTemplateColumns: "58px 1fr", alignItems: "center", gap: 8 }}>
              <span style={{ opacity: 0.75 }}>Thresh</span>
              <input
                type="range"
                min={-60}
                max={0}
                step={1}
                value={sumComp.threshold}
                onChange={(e) => setSumComp((s) => ({ ...s, threshold: parseFloat(e.target.value) }))}
              />
            </label>

            <label style={{ display: "grid", gridTemplateColumns: "58px 1fr", alignItems: "center", gap: 8 }}>
              <span style={{ opacity: 0.75 }}>Ratio</span>
              <input
                type="range"
                min={1}
                max={20}
                step={0.1}
                value={sumComp.ratio}
                onChange={(e) => setSumComp((s) => ({ ...s, ratio: parseFloat(e.target.value) }))}
              />
            </label>
          </div>
        </div>

        {/* Makeup gain */}
        <div>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Makeup</div>
          <input
            type="range"
            min={-24}
            max={12}
            step={0.1}
            value={sumGainDb}
            onChange={(e) => setSumGainDb(parseFloat(e.target.value))}
          />
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
            {sumGainDb >= 0 ? `+${sumGainDb.toFixed(1)} dB` : `${sumGainDb.toFixed(1)} dB`}
          </div>
        </div>
      </div>
    </div>
  );
}
