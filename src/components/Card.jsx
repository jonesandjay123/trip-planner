import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const ZONE_LABELS = {
  morning: '☀️ 早上佳',
  afternoon: '🌤️ 下午佳',
  evening: '🌙 晚上佳',
  flexible: '🔄 彈性',
};

function CardContent({ card, isDragOverlay, currentZone }) {
  const zoneMatch = currentZone && card.zone === currentZone;

  return (
    <div className={`card ${isDragOverlay ? 'card-overlay' : ''} ${zoneMatch ? 'card-zone-match' : ''}`}>
      <div className="card-title">📍 {card.title}</div>
      <div className="card-subtitle">{card.subtitle}</div>
      <div className="card-meta">
        {ZONE_LABELS[card.zone]} · {card.duration}
      </div>
      <div className="card-area">📍 {card.area}</div>
      {card.note && <div className="card-note">💡 {card.note}</div>}
      <div className="card-tags">
        🏷️ {card.tags.join(' · ')}
      </div>
    </div>
  );
}

export default function Card({ card, isDragOverlay, currentZone }) {
  if (isDragOverlay) {
    return <CardContent card={card} isDragOverlay currentZone={currentZone} />;
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardContent card={card} currentZone={currentZone} />
    </div>
  );
}
