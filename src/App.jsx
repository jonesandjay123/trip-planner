import React, { useMemo, useCallback, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import seedCards from './data/cards.json';
import { useLocalStorage } from './hooks/useLocalStorage';
import Header from './components/Header';
import DayColumn from './components/DayColumn';
import CandidatePool from './components/CandidatePool';
import Card from './components/Card';

const ZONES = ['morning', 'afternoon', 'evening', 'flexible'];

function generateDays(startDate, endDate) {
  const days = {};
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split('T')[0];
    days[key] = { morning: [], afternoon: [], evening: [], flexible: [] };
  }
  return days;
}

function createInitialState() {
  return {
    tripName: 'Tokyo May 2026',
    startDate: '2026-05-01',
    endDate: '2026-05-06',
    days: generateDays('2026-05-01', '2026-05-06'),
    unscheduled: seedCards.map((c) => c.id),
  };
}

const cardMap = Object.fromEntries(seedCards.map((c) => [c.id, c]));

export default function App() {
  const [state, setState, resetState] = useLocalStorage(createInitialState());
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  // Build a lookup: cardId -> { containerId }
  const cardLocations = useMemo(() => {
    const loc = {};
    state.unscheduled.forEach((id, idx) => {
      loc[id] = { containerId: 'unscheduled', index: idx };
    });
    Object.entries(state.days).forEach(([date, zones]) => {
      Object.entries(zones).forEach(([zone, cards]) => {
        cards.forEach((id, idx) => {
          loc[id] = { containerId: `${date}::${zone}`, index: idx };
        });
      });
    });
    return loc;
  }, [state]);

  const findContainer = useCallback(
    (id) => {
      // Check if id IS a container
      if (id === 'unscheduled') return id;
      if (typeof id === 'string' && id.includes('::')) return id;
      // Otherwise look up in cardLocations
      return cardLocations[id]?.containerId || null;
    },
    [cardLocations]
  );

  const getContainerItems = useCallback(
    (containerId) => {
      if (containerId === 'unscheduled') return state.unscheduled;
      if (containerId && containerId.includes('::')) {
        const [date, zone] = containerId.split('::');
        return state.days[date]?.[zone] || [];
      }
      return [];
    },
    [state]
  );

  const setContainerItems = useCallback(
    (containerId, items) => {
      setState((prev) => {
        if (containerId === 'unscheduled') {
          return { ...prev, unscheduled: items };
        }
        const [date, zone] = containerId.split('::');
        return {
          ...prev,
          days: {
            ...prev.days,
            [date]: {
              ...prev.days[date],
              [zone]: items,
            },
          },
        };
      });
    },
    [setState]
  );

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  function handleDragOver(event) {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(active.id);
    let overContainer = findContainer(over.id);

    // If over.id is a container itself (empty zone), use it directly
    if (!overContainer) {
      overContainer = over.id;
    }

    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setState((prev) => {
      const activeItems = [...getContainerItemsFromState(prev, activeContainer)];
      const overItems = [...getContainerItemsFromState(prev, overContainer)];

      const activeIndex = activeItems.indexOf(active.id);
      const overIndex = overItems.indexOf(over.id);

      let newIndex;
      if (over.id === overContainer || overContainer === over.id) {
        // Dropped on the container itself (empty zone)
        newIndex = overItems.length;
      } else {
        newIndex = overIndex >= 0 ? overIndex : overItems.length;
      }

      activeItems.splice(activeIndex, 1);
      overItems.splice(newIndex, 0, active.id);

      return setContainerItemsInState(
        setContainerItemsInState(prev, activeContainer, activeItems),
        overContainer,
        overItems
      );
    });
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeContainer = findContainer(active.id);
    let overContainer = findContainer(over.id);
    if (!overContainer) overContainer = over.id;

    if (!activeContainer || !overContainer) return;

    if (activeContainer === overContainer) {
      // Reorder within same container
      const items = getContainerItems(activeContainer);
      const oldIndex = items.indexOf(active.id);
      const newIndex = items.indexOf(over.id);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setContainerItems(activeContainer, arrayMove(items, oldIndex, newIndex));
      }
    }
  }

  function handleTripNameChange(name) {
    setState((prev) => ({ ...prev, tripName: name }));
  }

  function handleExport() {
    const json = JSON.stringify(state, null, 2);
    try {
      navigator.clipboard.writeText(json);
      alert('已複製到剪貼簿！');
    } catch {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'trip-plan.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function handleReset() {
    if (window.confirm('確定要重置所有排程嗎？所有卡片會回到候選區。')) {
      resetState(createInitialState());
    }
  }

  const activeCard = activeId ? cardMap[activeId] : null;
  const dayEntries = Object.entries(state.days).sort(([a], [b]) => a.localeCompare(b));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="app">
        <Header
          tripName={state.tripName}
          startDate={state.startDate}
          endDate={state.endDate}
          onTripNameChange={handleTripNameChange}
          onExport={handleExport}
          onReset={handleReset}
        />

        <div className="days-container">
          {dayEntries.map(([date, zones]) => (
            <DayColumn
              key={date}
              date={date}
              zones={zones}
              cardMap={cardMap}
            />
          ))}
        </div>

        <CandidatePool cardIds={state.unscheduled} cardMap={cardMap} />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard ? <Card card={activeCard} isDragOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

// Pure helper functions for immutable state updates
function getContainerItemsFromState(state, containerId) {
  if (containerId === 'unscheduled') return state.unscheduled;
  const [date, zone] = containerId.split('::');
  return state.days[date]?.[zone] || [];
}

function setContainerItemsInState(state, containerId, items) {
  if (containerId === 'unscheduled') {
    return { ...state, unscheduled: items };
  }
  const [date, zone] = containerId.split('::');
  return {
    ...state,
    days: {
      ...state.days,
      [date]: {
        ...state.days[date],
        [zone]: items,
      },
    },
  };
}
