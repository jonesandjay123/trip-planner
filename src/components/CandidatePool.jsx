import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import Card from './Card';

export default function CandidatePool({ cardIds, cardMap, panelOpen, currentDayLabel, onClosePanel, onAddToZone, onAddNew, onAiGenerate, onEdit, onDeleteCard, onAddComment, onEditComment, onDeleteComment }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unscheduled' });

  return (
    <div className={`candidate-pool ${isOver ? 'candidate-pool-over' : ''} ${panelOpen ? 'candidate-pool-open' : ''}`}>
      <div className="pool-header">
        <span className="pool-icon">🎒</span>
        <span className="pool-title">候選行程</span>
        <span className="pool-count">{cardIds.length} 個行程</span>
        {currentDayLabel && <span className="pool-current-day">加入到：{currentDayLabel}</span>}
        <button className="btn btn-add-card" onClick={onAddNew}>
          ➕ 新增
        </button>
        <button className="btn btn-ai-generate" onClick={onAiGenerate}>
          🤖 AI 推薦
        </button>
        <button className="btn btn-close-pool" onClick={onClosePanel}>
          ✕ 關閉
        </button>
      </div>
      <SortableContext
        id="unscheduled"
        items={cardIds}
        strategy={horizontalListSortingStrategy}
      >
        <div ref={setNodeRef} className="pool-cards">
          {cardIds.length === 0 && (
            <div className="pool-empty">所有行程都已排入行程！拖曳回這裡可取消排程。</div>
          )}
          {cardIds.map((id) => {
            const card = cardMap[id];
            if (!card) return null;
            return (
              <div key={id} className="pool-card-item">
                <Card card={card} inPool onEdit={onEdit} onDelete={onDeleteCard} onAddComment={onAddComment} onEditComment={onEditComment} onDeleteComment={onDeleteComment} />
                {onAddToZone && (
                  <div className="mobile-quick-add-row">
                    <button onClick={() => onAddToZone(id, 'morning')}>☀️ 早</button>
                    <button onClick={() => onAddToZone(id, 'afternoon')}>🌤️ 午</button>
                    <button onClick={() => onAddToZone(id, 'evening')}>🌙 晚</button>
                    <button onClick={() => onAddToZone(id, 'flexible')}>🔄 彈</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SortableContext>
    </div>
  );
}
