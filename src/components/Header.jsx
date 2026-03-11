import React, { useState } from 'react';

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dow = DAY_NAMES[d.getDay()];
  return `${m}/${day} (${dow})`;
}

export default function Header({ tripName, startDate, endDate, onTripNameChange, onExport, onReset }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tripName);

  function handleDoubleClick() {
    setDraft(tripName);
    setEditing(true);
  }

  function handleBlur() {
    setEditing(false);
    if (draft.trim()) {
      onTripNameChange(draft.trim());
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      setDraft(tripName);
      setEditing(false);
    }
  }

  return (
    <header className="header">
      <div className="header-left">
        <span className="header-icon">✈️</span>
        {editing ? (
          <input
            className="trip-name-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <h1 className="trip-name" onDoubleClick={handleDoubleClick} title="雙擊編輯">
            {tripName}
          </h1>
        )}
        <span className="date-range">
          {formatDate(startDate)} → {formatDate(endDate)}
        </span>
      </div>
      <div className="header-actions">
        <button className="btn btn-export" onClick={onExport}>
          📋 匯出
        </button>
        <button className="btn btn-reset" onClick={onReset}>
          🔄 重置
        </button>
      </div>
    </header>
  );
}
