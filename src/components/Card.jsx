import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const ZONE_LABELS = {
  morning: '☀️ 早上佳',
  afternoon: '🌤️ 下午佳',
  evening: '🌙 晚上佳',
  flexible: '🔄 彈性',
};

function CardContent({ card, isDragOverlay, currentZone, compact, onToggle }) {
  const zoneMatch = currentZone && card.zone === currentZone;

  if (compact) {
    return (
      <div className={`card card-compact ${isDragOverlay ? 'card-overlay' : ''} ${zoneMatch ? 'card-zone-match' : ''}`}>
        <div className="card-compact-row">
          <span className="card-compact-title">📍 {card.title}</span>
          <span className="card-compact-duration">{card.duration}</span>
          <button
            className="card-expand-btn"
            onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
            title="展開詳情"
          >
            ▼
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`card ${isDragOverlay ? 'card-overlay' : ''} ${zoneMatch ? 'card-zone-match' : ''}`}>
      <div className="card-header-row">
        <div className="card-title">📍 {card.title}</div>
        {onToggle && (
          <button
            className="card-expand-btn"
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            title="收合"
          >
            ▲
          </button>
        )}
      </div>
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

export default function Card({ card, isDragOverlay, currentZone, inPool }) {
  const [expanded, setExpanded] = useState(false);

  // Cards in pool always show full detail; cards in day columns default to compact
  const showCompact = !inPool && !expanded && !isDragOverlay;

  const content = (
    <CardContent
      card={card}
      isDragOverlay={isDragOverlay}
      currentZone={currentZone}
      compact={showCompact}
      onToggle={inPool ? undefined : () => setExpanded((v) => !v)}
    />
  );

  if (isDragOverlay) {
    return content;
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
      {content}
    </div>
  );
}
