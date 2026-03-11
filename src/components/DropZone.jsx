import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import Card from './Card';

const ZONE_CONFIG = {
  morning: { label: '☀️ 早上', color: '#fff8e1' },
  afternoon: { label: '🌤️ 下午', color: '#fff3e0' },
  evening: { label: '🌙 晚上', color: '#ede7f6' },
  flexible: { label: '🔄 彈性', color: '#e8f5e9' },
};

export default function DropZone({ zone, cardIds, cardMap, date, onEditCard, onAddComment }) {
  const containerId = `${date}::${zone}`;
  const config = ZONE_CONFIG[zone];

  const { setNodeRef, isOver } = useDroppable({ id: containerId });

  return (
    <div
      className={`drop-zone ${isOver ? 'drop-zone-over' : ''}`}
      style={{ backgroundColor: config.color }}
    >
      <div className="zone-label">{config.label}</div>
      <SortableContext
        id={containerId}
        items={cardIds}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setNodeRef} className="zone-cards">
          {cardIds.length === 0 && (
            <div className="zone-empty">拖曳卡片到這裡</div>
          )}
          {cardIds.map((id) => {
            const card = cardMap[id];
            if (!card) return null;
            return (
              <Card
                key={id}
                card={card}
                currentZone={zone}
                inPool={false}
                onEdit={onEditCard}
                onAddComment={onAddComment}
              />
            );
          })}
        </div>
      </SortableContext>
    </div>
  );
}
