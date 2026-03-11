import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import Card from './Card';

export default function CandidatePool({ cardIds, cardMap }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unscheduled' });

  return (
    <div className={`candidate-pool ${isOver ? 'candidate-pool-over' : ''}`}>
      <div className="pool-header">
        <span className="pool-icon">🎒</span>
        <span className="pool-title">候選景點</span>
        <span className="pool-count">{cardIds.length} 個景點</span>
      </div>
      <SortableContext
        id="unscheduled"
        items={cardIds}
        strategy={horizontalListSortingStrategy}
      >
        <div ref={setNodeRef} className="pool-cards">
          {cardIds.length === 0 && (
            <div className="pool-empty">所有景點都已排入行程！拖曳回這裡可取消排程。</div>
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
