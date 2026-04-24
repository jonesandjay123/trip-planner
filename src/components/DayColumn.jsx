import React, { useState } from 'react';
import DropZone from './DropZone';

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
const ZONES = ['morning', 'afternoon', 'evening', 'flexible'];

function formatDayHeader(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dow = DAY_NAMES[d.getDay()];
  return `${m}/${day} (${dow})`;
}

export default function DayColumn({ date, zones, label, cardMap, onSwap, isFirst, isLast, isMobileSelected, onEditCard, onDeleteCard, onAddComment, onEditComment, onDeleteComment, onLabelChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label || '');

  function handleDoubleClick() {
    setDraft(label || '');
    setEditing(true);
  }

  function handleBlur() {
    setEditing(false);
    if (onLabelChange) onLabelChange(date, draft.trim());
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      setDraft(label || '');
      setEditing(false);
    }
  }

  return (
    <div className={`day-column ${isMobileSelected ? 'mobile-day-active' : ''}`}>
      <div className="day-header">
        <button
          className="swap-btn"
          onClick={() => onSwap(date, -1)}
          disabled={isFirst}
          title="往左移"
        >
          ◀
        </button>
        <span className="day-date">{formatDayHeader(date)}</span>
        <button
          className="swap-btn"
          onClick={() => onSwap(date, 1)}
          disabled={isLast}
          title="往右移"
        >
          ▶
        </button>
      </div>

      <div className="day-label" onDoubleClick={handleDoubleClick}>
        {editing ? (
          <input
            className="day-label-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            placeholder="主題標籤..."
            maxLength={20}
          />
        ) : (
          <span className="day-label-text" title="雙擊編輯主題標籤">
            {label || '📌 點擊加標籤'}
          </span>
        )}
      </div>

      <div className="day-zones">
        {ZONES.map((zone) => (
          <DropZone
            key={zone}
            zone={zone}
            date={date}
            cardIds={zones[zone] || []}
            cardMap={cardMap}
            onEditCard={onEditCard}
            onDeleteCard={onDeleteCard}
            onAddComment={onAddComment}
            onEditComment={onEditComment}
            onDeleteComment={onDeleteComment}
          />
        ))}
      </div>
    </div>
  );
}
