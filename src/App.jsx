import React, { useMemo, useCallback, useState, useEffect } from 'react';
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
import CardModal from './components/CardModal';

const ZONES = ['morning', 'afternoon', 'evening', 'flexible'];
const STATE_VERSION = 3; // bump to force localStorage reset

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
    _version: STATE_VERSION,
    tripName: 'Tokyo May 2026',
    startDate: '2026-05-01',
    endDate: '2026-05-07',
    dayOrder: ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07'],
    days: generateDays('2026-05-01', '2026-05-07'),
    unscheduled: seedCards.map((c) => c.id),
    cards: Object.fromEntries(seedCards.map((c) => [c.id, { ...c, comments: [] }])),
  };
}

export default function App() {
  const [state, setState, resetState] = useLocalStorage(createInitialState());
  const [activeId, setActiveId] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('trip-planner-dark');
    if (saved !== null) return saved === 'true';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('trip-planner-dark', darkMode);
  }, [darkMode]);
  const [modalCard, setModalCard] = useState(null); // card object or null
  const [modalOpen, setModalOpen] = useState(false);
  const [isNewCard, setIsNewCard] = useState(false);

  const cardMap = state.cards || {};

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
      if (id === 'unscheduled') return id;
      if (typeof id === 'string' && id.includes('::')) return id;
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

  // --- Modal handlers ---
  function openEditModal(card) {
    setModalCard(card);
    setIsNewCard(false);
    setModalOpen(true);
  }

  function openNewCardModal() {
    setModalCard(null);
    setIsNewCard(true);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setModalCard(null);
    setIsNewCard(false);
  }

  function handleModalSave(updatedCard, isNew) {
    setState((prev) => {
      const newCards = { ...prev.cards, [updatedCard.id]: updatedCard };
      if (isNew) {
        return {
          ...prev,
          cards: newCards,
          unscheduled: [...prev.unscheduled, updatedCard.id],
        };
      }
      return { ...prev, cards: newCards };
    });
    closeModal();
  }

  // --- Comment handler ---
  function handleAddComment(cardId, text) {
    if (!text.trim()) return;
    const comment = {
      text: text.trim(),
      timestamp: new Date().toISOString(),
      author: 'Jones',
    };
    setState((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [cardId]: {
          ...prev.cards[cardId],
          comments: [...(prev.cards[cardId]?.comments || []), comment],
        },
      },
    }));
  }

  // --- Drag handlers ---
  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  function handleDragOver(event) {
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(active.id);
    let overContainer = findContainer(over.id);

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

  function handleSwapDay(date, direction) {
    setState((prev) => {
      const order = prev.dayOrder || Object.keys(prev.days).sort();
      const idx = order.indexOf(date);
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= order.length) return prev;
      const newOrder = [...order];
      [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
      return { ...prev, dayOrder: newOrder };
    });
  }

  const activeCard = activeId ? cardMap[activeId] : null;
  const dayOrder = state.dayOrder || Object.keys(state.days).sort();

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
          darkMode={darkMode}
          onToggleDark={() => setDarkMode((v) => !v)}
        />

        <div className="days-container">
          {dayOrder.map((date, idx) => (
            <DayColumn
              key={date}
              date={date}
              zones={state.days[date]}
              cardMap={cardMap}
              onSwap={handleSwapDay}
              isFirst={idx === 0}
              isLast={idx === dayOrder.length - 1}
              onEditCard={openEditModal}
              onAddComment={handleAddComment}
            />
          ))}
        </div>

        <CandidatePool
          cardIds={state.unscheduled}
          cardMap={cardMap}
          onAddNew={openNewCardModal}
        />
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCard ? <Card card={activeCard} isDragOverlay /> : null}
      </DragOverlay>

      {modalOpen && (
        <CardModal
          card={modalCard}
          onSave={handleModalSave}
          onClose={closeModal}
        />
      )}
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
