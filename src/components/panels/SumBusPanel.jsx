import React from "react";
import FoldSection from "../ui/FoldSection";

export default function SumBusPanel({
  show, onToggle,
  limiterOn, setLimiterOn,
  sumComp, setSumComp,
  sumGainDb, setSumGainDb,
  sumMeterDb,
  lowCutOn, setLowCutOn,
  highCutOn, setHighCutOn,
}) {
  // Peak meter 0..100%
  const meterPct = Math.max(0, Math.min(1, (sumMeterDb + 60) / 60));
  const meterClass = sumMeterDb > -1 ? "hot" : sumMeterDb > -6 ? "warn" : "ok";

  return (
    <FoldSection title="Sum Bus" show={show} onToggle={onToggle}>
      <div className="sbus-card">
        <div className="sbus-header">
          <div className="sbus-title">Sum Bus</div>

          <button
            type="button"
            className={`toggle-chip ${limiterOn ? "on" : ""}`}
            aria-pressed={limiterOn}
            onClick={() => setLimiterOn(v => !v)}
            title="Brickwall limiter on master"
          >
            Limiter
          </button>
        </div>

        <div className="sbus-grid">
          {/* Peak meter */}
          <div className="sbus-block">
            <div className="fx-sublabel">PEAK</div>
            <div className="sbus-meter" aria-label="Peak meter">
              <div
                className={`sbus-meter__bar ${meterClass}`}
                style={{ width: `${meterPct * 100}%` }}
              />
            </div>
            <div className="sbus-lcd">
              {Number.isFinite(sumMeterDb) ? `${sumMeterDb.toFixed(1)} dBFS` : "—"}
            </div>
          </div>

          {/* Compressor */}
          <div className="sbus-block">
            <div className="fx-sublabel">COMP</div>

            <label className="sbus-row">
              <span>THRESH</span>
              <input
                className="slider slider-fx"
                type="range" min={-60} max={0} step={1}
                value={sumComp.threshold}
                onChange={(e)=> setSumComp(s => ({ ...s, threshold: parseFloat(e.target.value) }))}
                title="Compressor threshold (dB)"
              />
            </label>

            <label className="sbus-row">
              <span>RATIO</span>
              <input
                className="slider slider-fx"
                type="range" min={1} max={20} step={0.1}
                value={sumComp.ratio}
                onChange={(e)=> setSumComp(s => ({ ...s, ratio: parseFloat(e.target.value) }))}
                title="Compressor ratio"
              />
            </label>
          </div>

          {/* Makeup + Cuts */}
          <div className="sbus-head">
  <span className="fx-sublabel">MAKEUP</span>
  <span className="sbus-readout">
    {sumGainDb >= 0 ? `+${sumGainDb.toFixed(1)} dB` : `${sumGainDb.toFixed(1)} dB`}
  </span>
</div>

<input
  className="slider slider-fx"
  type="range" min={-24} max={12} step={0.1}
  value={sumGainDb}
  onChange={(e)=>setSumGainDb(parseFloat(e.target.value))}
  title="Makeup gain (dB)"
/>

            <div className="sbus-toggles">
              <button
                type="button"
                className={`revlen-btn ${lowCutOn ? "on" : ""}`}
                aria-pressed={lowCutOn}
                onClick={() => setLowCutOn(v => !v)}
                title="Low Cut 230 Hz (Q≈1.0)"
              >
                Low Cut 230Hz
              </button>
              <button
                type="button"
                className={`revlen-btn ${highCutOn ? "on" : ""}`}
                aria-pressed={highCutOn}
                onClick={() => setHighCutOn(v => !v)}
                title="High Cut 3 kHz (Q≈1.0)"
              >
                High Cut 3k
              </button>
            </div>

            
          </div>
        </div>
     
    </FoldSection>
  );
}
