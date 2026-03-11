import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const ZONE_LABELS = {
  morning: '☀️ 早上佳',
  afternoon: '🌤️ 下午佳',
  evening: '🌙 晚上佳',
  flexible: '🔄 彈性',
};

function formatCommentDate(timestamp) {
  const d = new Date(timestamp);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${h}:${m}`;
}

function CardContent({ card, isDragOverlay, currentZone, compact, onToggle, onEdit, onAddComment }) {
  const [commentText, setCommentText] = useState('');
  const zoneMatch = currentZone && card.zone === currentZone;
  const comments = card.comments || [];

  if (compact) {
    return (
      <div className={`card card-compact ${isDragOverlay ? 'card-overlay' : ''} ${zoneMatch ? 'card-zone-match' : ''}`}>
        <div className="card-compact-row">
          <span className="card-compact-title">📍 {card.title}</span>
          <span className="card-compact-duration">{card.duration}</span>
          {comments.length > 0 && (
            <span className="card-compact-comments" title={`${comments.length} 則留言`}>
              💬{comments.length}
            </span>
          )}
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

  function handleSubmitComment(e) {
    e.stopPropagation();
    if (commentText.trim() && onAddComment) {
      onAddComment(card.id, commentText);
      setCommentText('');
    }
  }

  return (
    <div className={`card ${isDragOverlay ? 'card-overlay' : ''} ${zoneMatch ? 'card-zone-match' : ''}`}>
      <div className="card-header-row">
        <div className="card-title">📍 {card.title}</div>
        <div className="card-header-actions">
          {onEdit && (
            <button
              className="card-edit-btn"
              onClick={(e) => { e.stopPropagation(); onEdit(card); }}
              title="編輯"
            >
              ✏️
            </button>
          )}
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
      </div>
      <div className="card-subtitle">{card.subtitle}</div>
      <div className="card-meta">
        {ZONE_LABELS[card.zone]} · {card.duration}
      </div>
      <div className="card-area">📍 {card.area}</div>
      {card.note && <div className="card-note">💡 {card.note}</div>}
      <div className="card-tags">
        🏷️ {(card.tags || []).join(' · ')}
      </div>

      {/* Comments section */}
      {comments.length > 0 && (
        <div className="card-comments">
          {comments.map((c, i) => (
            <div key={i} className="card-comment">
              💬 {c.author} ({formatCommentDate(c.timestamp)}): {c.text}
            </div>
          ))}
        </div>
      )}

      {/* Quick comment input - only in day columns (not pool, not overlay) */}
      {onAddComment && (
        <div className="card-comment-input" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitComment(e); }}
            placeholder="快速留言..."
            onPointerDown={(e) => e.stopPropagation()}
          />
          <button
            onClick={handleSubmitComment}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={!commentText.trim()}
          >
            ➤
          </button>
        </div>
      )}
    </div>
  );
}

export default function Card({ card, isDragOverlay, currentZone, inPool, onEdit, onAddComment }) {
  const [expanded, setExpanded] = useState(false);

  const showCompact = !inPool && !expanded && !isDragOverlay;

  const content = (
    <CardContent
      card={card}
      isDragOverlay={isDragOverlay}
      currentZone={currentZone}
      compact={showCompact}
      onToggle={inPool ? undefined : () => setExpanded((v) => !v)}
      onEdit={!isDragOverlay && (inPool || expanded) ? onEdit : undefined}
      onAddComment={!isDragOverlay && (inPool || expanded) ? onAddComment : undefined}
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
