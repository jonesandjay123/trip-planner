import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import Card from './Card';

export default function CandidatePool({ cardIds, cardMap, onAddNew }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unscheduled' });

  return (
    <div className={`candidate-pool ${isOver ? 'candidate-pool-over' : ''}`}>
      <div className="pool-header">
        <span className="pool-icon">🎒</span>
        <span className="pool-title">候選行程</span>
        <span className="pool-count">{cardIds.length} 個行程</span>
        <button className="btn btn-add-card" onClick={onAddNew}>
          ➕ 新增行程
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
            return <Card key={id} card={card} inPool />;
          })}
        </div>
      </SortableContext>
    </div>
  );
}
