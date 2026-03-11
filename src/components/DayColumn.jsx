import React from 'react';
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

export default function DayColumn({ date, zones, cardMap, onSwap, isFirst, isLast, onEditCard, onAddComment }) {
  return (
    <div className="day-column">
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
      <div className="day-zones">
        {ZONES.map((zone) => (
          <DropZone
            key={zone}
            zone={zone}
            date={date}
            cardIds={zones[zone] || []}
            cardMap={cardMap}
            onEditCard={onEditCard}
            onAddComment={onAddComment}
          />
        ))}
      </div>
    </div>
  );
}
