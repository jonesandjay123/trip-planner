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

export default function DayColumn({ date, zones, cardMap }) {
  return (
    <div className="day-column">
      <div className="day-header">{formatDayHeader(date)}</div>
      <div className="day-zones">
        {ZONES.map((zone) => (
          <DropZone
            key={zone}
            zone={zone}
            date={date}
            cardIds={zones[zone] || []}
            cardMap={cardMap}
          />
        ))}
      </div>
    </div>
  );
}
