import React, { useState } from "react";
import "./SystemControls.css";

function SystemControls({
  soilMoisture,
  pumpStatus,
  systemMode,
  minThreshold,
  maxThreshold,
  dripOnTime,
  dripOffTime,
  setMinThreshold,
  setMaxThreshold,
  setDripOnTime,
  setDripOffTime,
  updateValue,
}) {
  const [errors, setErrors] = useState({});

  // Validation helpers
  const validateThreshold = (min, max) => {
    const newErrors = {};
    
    if (min < 0 || min > 100) {
      newErrors.min = "Giá trị phải trong khoảng 0-100%";
    }
    if (max < 0 || max > 100) {
      newErrors.max = "Giá trị phải trong khoảng 0-100%";
    }
    if (min >= max) {
      newErrors.range = "Ngưỡng Min phải nhỏ hơn Max!";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateDripTime = (on, off) => {
    const newErrors = {};
    
    if (on < 1 || on > 300) {
      newErrors.dripOn = "Thời gian bơm: 1-300 giây";
    }
    if (off < 1 || off > 3600) {
      newErrors.dripOff = "Thời gian nghỉ: 1-3600 giây";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handlers with validation
  const handleSaveMin = () => {
    if (validateThreshold(minThreshold, maxThreshold)) {
      updateValue("system/threshold/min", minThreshold);
      setErrors({});
    }
  };

  const handleSaveMax = () => {
    if (validateThreshold(minThreshold, maxThreshold)) {
      updateValue("system/threshold/max", maxThreshold);
      setErrors({});
    }
  };

  const handleSaveDripOn = () => {
    if (validateDripTime(dripOnTime, dripOffTime)) {
      updateValue("system/drip/on", dripOnTime);
      setErrors({});
    }
  };

  const handleSaveDripOff = () => {
    if (validateDripTime(dripOnTime, dripOffTime)) {
      updateValue("system/drip/off", dripOffTime);
      setErrors({});
    }
  };

  return (
    <section className="system-controls-grid">
      
      {/* CARD 1: MODE SELECTION */}
      <div className="control-card full-width-card">
        <div className="control-card__header">
          <h3 className="control-card__title">
            Chế độ hoạt động ({systemMode === 0 ? "Thủ công" : systemMode === 1 ? "Tự động" : "Nhỏ giọt"})
          </h3>
        </div>
        <div className="control-card__body mode-selector-body">
          <div className="mode-buttons">
            <button 
              className={`btn mode-btn ${systemMode === 0 ? 'mode-btn--active' : ''}`}
              onClick={() => updateValue("system/mode", 0)}
            >
              ✋ Thủ công
            </button>
            <button 
              className={`btn mode-btn ${systemMode === 1 ? 'mode-btn--active' : ''}`}
              onClick={() => updateValue("system/mode", 1)}
            >
              🌱 Auto (Độ ẩm)
            </button>
            <button 
              className={`btn mode-btn ${systemMode === 2 ? 'mode-btn--active' : ''}`}
              onClick={() => updateValue("system/mode", 2)}
            >
              💧 Auto (Nhỏ giọt)
            </button>
          </div>
        </div>
      </div>

      {/* CARD 2: AUTO SENSOR SETTINGS */}
      {systemMode === 1 && (
        <div className="control-card">
          <div className="control-card__header">
            <h3 className="control-card__title">Cấu hình Tự động</h3>
            <p className="control-card__subtitle">Độ ẩm hiện tại: <strong>{soilMoisture}%</strong></p>
          </div>
          <div className="control-card__body">
            {errors.range && (
              <div className="error-message">{errors.range}</div>
            )}
            
            <label className="control-card__field">
              <span>Bắt đầu bơm khi &lt; (Min)</span>
              <div className="control-card__actions">
                <input
                  type="number"
                  className={`control-input ${errors.min ? 'input-error' : ''}`}
                  value={minThreshold}
                  min="0"
                  max="100"
                  onChange={(e) => setMinThreshold(Number(e.target.value))}
                />
                <button className="btn btn--secondary" onClick={handleSaveMin}>
                  Lưu
                </button>
              </div>
              {errors.min && <span className="field-error">{errors.min}</span>}
            </label>
            
            <label className="control-card__field">
              <span>Dừng bơm khi &gt; (Max)</span>
              <div className="control-card__actions">
                <input
                  type="number"
                  className={`control-input ${errors.max ? 'input-error' : ''}`}
                  value={maxThreshold}
                  min="0"
                  max="100"
                  onChange={(e) => setMaxThreshold(Number(e.target.value))}
                />
                <button className="btn btn--secondary" onClick={handleSaveMax}>
                  Lưu
                </button>
              </div>
              {errors.max && <span className="field-error">{errors.max}</span>}
            </label>
          </div>
        </div>
      )}

      {/* CARD 3: DRIP MODE SETTINGS */}
      {systemMode === 2 && (
        <div className="control-card">
          <div className="control-card__header">
            <h3 className="control-card__title">Cấu hình Nhỏ giọt</h3>
            <p className="control-card__subtitle">Chu kỳ: Bơm X giây &rarr; Nghỉ Y giây</p>
          </div>
          <div className="control-card__body">
            <label className="control-card__field">
              <span>Thời gian Bơm (giây)</span>
              <div className="control-card__actions">
                <input
                  type="number"
                  className={`control-input ${errors.dripOn ? 'input-error' : ''}`}
                  value={dripOnTime}
                  min="1"
                  max="300"
                  onChange={(e) => setDripOnTime(Number(e.target.value))}
                />
                <button className="btn btn--secondary" onClick={handleSaveDripOn}>
                  Lưu
                </button>
              </div>
              {errors.dripOn && <span className="field-error">{errors.dripOn}</span>}
            </label>
            
            <label className="control-card__field">
              <span>Thời gian Nghỉ (giây)</span>
              <div className="control-card__actions">
                <input
                  type="number"
                  className={`control-input ${errors.dripOff ? 'input-error' : ''}`}
                  value={dripOffTime}
                  min="1"
                  max="3600"
                  onChange={(e) => setDripOffTime(Number(e.target.value))}
                />
                <button className="btn btn--secondary" onClick={handleSaveDripOff}>
                  Lưu
                </button>
              </div>
              {errors.dripOff && <span className="field-error">{errors.dripOff}</span>}
            </label>
            
            <label className="control-card__field">
              <span>Ngưỡng ngắt an toàn (Max %)</span>
              <div className="control-card__actions">
                <input
                  type="number"
                  className="control-input"
                  value={maxThreshold}
                  min="0"
                  max="100"
                  onChange={(e) => setMaxThreshold(Number(e.target.value))}
                />
                <button className="btn btn--secondary" onClick={handleSaveMax}>
                  Lưu
                </button>
              </div>
            </label>
            <p className="control-card__note">⚠️ Nếu độ ẩm &gt; {maxThreshold}%, hệ thống sẽ tự ngắt để chống lụt.</p>
          </div>
        </div>
      )}

      {/* CARD 4: PUMP MANUAL CONTROL */}
      <div className="control-card">
        <div className="control-card__header">
          <h3 className="control-card__title">Trạng thái Bơm</h3>
          <p className="control-card__subtitle">
            <strong className={pumpStatus ? 'text--on' : 'text--off'}>
              {pumpStatus ? "ĐANG CHẠY" : "ĐANG TẮT"}
            </strong>
          </p>
        </div>
        <div className="control-card__body">
          <div className="control-card__actions">
            <button
              className="btn btn--success"
              onClick={() => updateValue("system/pumpStatus", 1)}
              disabled={systemMode !== 0}
            >
              Bật Bơm
            </button>
            <button
              className="btn btn--danger"
              onClick={() => updateValue("system/pumpStatus", 0)}
              disabled={systemMode !== 0}
            >
              Tắt Bơm
            </button>
          </div>
          {systemMode !== 0 && (
            <p className="control-card__note">
              Chuyển sang chế độ "Thủ công" để điều khiển nút này.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default SystemControls;