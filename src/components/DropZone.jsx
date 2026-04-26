import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import Card from './Card';

const ZONE_CONFIG = {
  morning: { label: '☀️ 早上', colorVar: 'var(--zone-morning)' },
  afternoon: { label: '🌤️ 下午', colorVar: 'var(--zone-afternoon)' },
  evening: { label: '🌙 晚上', colorVar: 'var(--zone-evening)' },
  flexible: { label: '🔄 彈性', colorVar: 'var(--zone-flexible)' },
};

export default function DropZone({ zone, cardIds, cardMap, date, canEdit = false, onEditCard, onDeleteCard, onUnassignCard, onOpenMap, onAddComment, onEditComment, onDeleteComment }) {
  const containerId = `${date}::${zone}`;
  const config = ZONE_CONFIG[zone];

  const { setNodeRef, isOver } = useDroppable({ id: containerId });

  return (
    <div
      className={`drop-zone ${isOver ? 'drop-zone-over' : ''}`}
      style={{ backgroundColor: config.colorVar }}
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
                canEdit={canEdit}
                onEdit={onEditCard}
                onDelete={onDeleteCard}
                onUnassign={onUnassignCard}
                onOpenMap={onOpenMap}
                onAddComment={onAddComment}
                onEditComment={onEditComment}
                onDeleteComment={onDeleteComment}
              />
            );
          })}
        </div>
      </SortableContext>
    </div>
  );
}
