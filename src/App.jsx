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

import PlanSelector from './components/PlanSelector';

const ZONES = ['morning', 'afternoon', 'evening', 'flexible'];
const STATE_VERSION = 4; // bump to force localStorage reset (added plans)

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
  const defaultDays = generateDays('2026-05-01', '2026-05-07');
  const defaultDayOrder = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07'];
  return {
    _version: STATE_VERSION,
    tripName: 'Tokyo May 2026',
    startDate: '2026-05-01',
    endDate: '2026-05-07',
    cards: Object.fromEntries(seedCards.map((c) => [c.id, { ...c, comments: [] }])),
    unscheduled: seedCards.map((c) => c.id),
    plans: [
      {
        id: 'default',
        name: 'Default',
        dayOrder: defaultDayOrder,
        days: defaultDays,
      },
    ],
    activePlanId: 'default',
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
  const [modalCard, setModalCard] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isNewCard, setIsNewCard] = useState(false);

  const cardMap = state.cards || {};

  // --- Plan helpers ---
  const activePlan = useMemo(() => {
    const plans = state.plans || [];
    return plans.find((p) => p.id === state.activePlanId) || plans[0];
  }, [state.plans, state.activePlanId]);

  // Get days and dayOrder from active plan
  const activeDays = activePlan?.days || {};
  const activeDayOrder = activePlan?.dayOrder || Object.keys(activeDays).sort();

  function handleSwitchPlan(planId) {
    setState((prev) => ({ ...prev, activePlanId: planId }));
  }

  function handleClonePlan() {
    setState((prev) => {
      const source = prev.plans.find((p) => p.id === prev.activePlanId) || prev.plans[0];
      const newId = `plan_${Date.now()}`;
      const cloned = {
        id: newId,
        name: `${source.name} (副本)`,
        dayOrder: [...source.dayOrder],
        days: JSON.parse(JSON.stringify(source.days)),
      };
      return {
        ...prev,
        plans: [...prev.plans, cloned],
        activePlanId: newId,
      };
    });
  }

  function handleRenamePlan(planId, newName) {
    if (!newName.trim()) return;
    setState((prev) => ({
      ...prev,
      plans: prev.plans.map((p) => (p.id === planId ? { ...p, name: newName.trim() } : p)),
    }));
  }

  function handleDeletePlan(planId) {
    setState((prev) => {
      if (prev.plans.length <= 1) return prev; // 至少保留一個
      const filtered = prev.plans.filter((p) => p.id !== planId);
      const newActive = prev.activePlanId === planId ? filtered[0].id : prev.activePlanId;
      return { ...prev, plans: filtered, activePlanId: newActive };
    });
  }

  function handleResetPlan() {
    if (!window.confirm('確定要清空當前方案的所有排程嗎？卡片會回到候選區。')) return;
    setState((prev) => {
      const plan = prev.plans.find((p) => p.id === prev.activePlanId);
      if (!plan) return prev;
      // Collect all card IDs currently assigned in this plan's days
      const assignedIds = [];
      Object.values(plan.days).forEach((zones) => {
        Object.values(zones).forEach((cards) => {
          assignedIds.push(...cards);
        });
      });
      // Reset days to empty and put cards back to unscheduled
      const emptyDays = generateDays(prev.startDate, prev.endDate);
      return {
        ...prev,
        unscheduled: [...prev.unscheduled, ...assignedIds],
        plans: prev.plans.map((p) =>
          p.id === prev.activePlanId
            ? { ...p, days: emptyDays, dayOrder: Object.keys(emptyDays).sort() }
            : p
        ),
      };
    });
  }

  // Helper: update active plan's data
  function updateActivePlan(updater) {
    setState((prev) => ({
      ...prev,
      plans: prev.plans.map((p) => (p.id === prev.activePlanId ? updater(p) : p)),
    }));
  }

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
    Object.entries(activeDays).forEach(([date, zones]) => {
      Object.entries(zones).forEach(([zone, cards]) => {
        cards.forEach((id, idx) => {
          loc[id] = { containerId: `${date}::${zone}`, index: idx };
        });
      });
    });
    return loc;
  }, [state.unscheduled, activeDays]);

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
        return activeDays[date]?.[zone] || [];
      }
      return [];
    },
    [state.unscheduled, activeDays]
  );

  const setContainerItems = useCallback(
    (containerId, items) => {
      if (containerId === 'unscheduled') {
        setState((prev) => ({ ...prev, unscheduled: items }));
      } else {
        const [date, zone] = containerId.split('::');
        updateActivePlan((plan) => ({
          ...plan,
          days: {
            ...plan.days,
            [date]: {
              ...plan.days[date],
              [zone]: items,
            },
          },
        }));
      }
    },
    [setState, updateActivePlan]
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
      const activePlanIdx = prev.plans.findIndex((p) => p.id === prev.activePlanId);
      const plan = prev.plans[activePlanIdx];

      const activeItems = [...getContainerItemsFromPlan(prev, plan, activeContainer)];
      const overItems = [...getContainerItemsFromPlan(prev, plan, overContainer)];

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

      let next = setContainerItemsInPlanState(prev, plan, activeContainer, activeItems);
      // Re-read updated plan for second set
      const updatedPlan = next.plans.find((p) => p.id === prev.activePlanId);
      next = setContainerItemsInPlanState(next, updatedPlan, overContainer, overItems);
      return next;
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
      const items = [...getContainerItems(activeContainer)];
      const oldIndex = items.indexOf(active.id);
      const newIndex = items.indexOf(over.id);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(items, oldIndex, newIndex);
        if (activeContainer === 'unscheduled') {
          setState((prev) => ({ ...prev, unscheduled: reordered }));
        } else {
          const [date, zone] = activeContainer.split('::');
          updateActivePlan((plan) => ({
            ...plan,
            days: {
              ...plan.days,
              [date]: {
                ...plan.days[date],
                [zone]: reordered,
              },
            },
          }));
        }
      }
    }
  }

  function handleTripNameChange(name) {
    setState((prev) => ({ ...prev, tripName: name }));
  }

  function handleExport() {
    // Export only active plan + cards for readability
    const exportData = {
      tripName: state.tripName,
      plan: activePlan?.name || 'Default',
      dayOrder: activeDayOrder,
      days: activeDays,
      cards: cardMap,
      unscheduled: state.unscheduled,
    };
    const json = JSON.stringify(exportData, null, 2);
    try {
      navigator.clipboard.writeText(json);
      alert(`已複製「${activePlan?.name}」方案到剪貼簿！`);
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
    updateActivePlan((plan) => {
      const order = plan.dayOrder || Object.keys(plan.days).sort();
      const idx = order.indexOf(date);
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= order.length) return plan;
      const newOrder = [...order];
      [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
      return { ...plan, dayOrder: newOrder };
    });
  }

  const activeCard = activeId ? cardMap[activeId] : null;

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
          planSelector={
            <PlanSelector
              plans={state.plans || []}
              activePlanId={state.activePlanId}
              onSwitch={handleSwitchPlan}
              onClone={handleClonePlan}
              onRename={handleRenamePlan}
              onDelete={handleDeletePlan}
              onResetPlan={handleResetPlan}
            />
          }
        />

        <div className="days-container">
          {activeDayOrder.map((date, idx) => (
            <DayColumn
              key={date}
              date={date}
              zones={activeDays[date]}
              cardMap={cardMap}
              onSwap={handleSwapDay}
              isFirst={idx === 0}
              isLast={idx === activeDayOrder.length - 1}
              onEditCard={openEditModal}
              onAddComment={handleAddComment}
            />
          ))}
        </div>

        <CandidatePool
          cardIds={state.unscheduled}
          cardMap={cardMap}
          onAddNew={openNewCardModal}
          onEdit={openEditModal}
          onAddComment={handleAddComment}
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

// Pure helper functions for immutable state updates (plan-aware)
function getContainerItemsFromPlan(state, plan, containerId) {
  if (containerId === 'unscheduled') return state.unscheduled;
  const [date, zone] = containerId.split('::');
  return plan.days[date]?.[zone] || [];
}

function setContainerItemsInPlanState(state, plan, containerId, items) {
  if (containerId === 'unscheduled') {
    return { ...state, unscheduled: items };
  }
  const [date, zone] = containerId.split('::');
  const updatedPlan = {
    ...plan,
    days: {
      ...plan.days,
      [date]: {
        ...plan.days[date],
        [zone]: items,
      },
    },
  };
  return {
    ...state,
    plans: state.plans.map((p) => (p.id === plan.id ? updatedPlan : p)),
  };
}
