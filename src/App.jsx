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
import { useFirestore } from './hooks/useFirestore';
import Header from './components/Header';
import DayColumn from './components/DayColumn';
import CandidatePool from './components/CandidatePool';
import Card from './components/Card';
import CardModal from './components/CardModal';
import PlanSelector from './components/PlanSelector';
import NicknameModal from './components/NicknameModal';
import AiModal from './components/AiModal';
import DayMapModal from './components/DayMapModal';
import ShareTripModal, { TRIP_URL } from './components/ShareTripModal';
import { useNickname } from './hooks/useNickname';
import { ownerEmail } from './firebase';
import { logOut, signInWithGoogle, subscribeToAuthState } from './lib/auth';

const STATE_VERSION = 7; // v7: day labels + cardOrder for pool sorting
const MOBILE_DAY_KEY = 'trip-planner-mobile-day';

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

    // --- Trip metadata (→ Firestore: trips/{tripId} document) ---
    tripMeta: {
      id: 'tokyo-may-2026',
      title: 'Tokyo May 2026',
      startDate: '2026-05-01',
      endDate: '2026-05-07',
      activePlanId: 'default',
    },

    // --- Cards (→ Firestore: trips/{tripId}/cards/{cardId}) ---
    cards: Object.fromEntries(seedCards.map((c) => [c.id, { ...c, comments: [] }])),

    // --- Card display order for candidate pool ---
    cardOrder: seedCards.map((c) => c.id),

    // --- Plans keyed by ID (→ Firestore: trips/{tripId}/plans/{planId}) ---
    plans: {
      default: {
        id: 'default',
        name: 'Default',
        dayOrder: defaultDayOrder,
        days: defaultDays,
        dayLabels: {}, // { "2026-05-01": "富士山", ... }
      },
    },

    // --- Plan display order (→ Firestore: trips/{tripId}.planOrder) ---
    planOrder: ['default'],
  };
}

// ==================== Selectors ====================

function getActivePlan(state) {
  const id = state.tripMeta.activePlanId;
  return state.plans[id] || state.plans[state.planOrder[0]];
}

function getPlanDays(plan) {
  return plan?.days || {};
}

function getPlanDayOrder(plan) {
  return plan?.dayOrder || Object.keys(getPlanDays(plan)).sort();
}

// ==================== App ====================

export default function App() {
  const [state, setState, resetState, loading, setDragging] = useFirestore(createInitialState());
  const { nickname, saveNickname, generateRandomName } = useNickname();
  const [pendingRandomName] = useState(() => generateRandomName());
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
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [mapModalDay, setMapModalDay] = useState(null);
  const [mapModalCardId, setMapModalCardId] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [candidatePanelOpen, setCandidatePanelOpen] = useState(false);
  const [mobileDay, setMobileDay] = useState(() => localStorage.getItem(MOBILE_DAY_KEY) || '');
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isOwner = Boolean(user?.email && user.email.toLowerCase() === ownerEmail.toLowerCase());
  const canEdit = Boolean(user);

  async function handleLogin() {
    const result = await signInWithGoogle();
    if (result?.user) {
      setUser(result.user);
      setAuthLoading(false);
    }
  }

  const cardMap = state.cards || {};
  const activePlan = useMemo(() => getActivePlan(state), [state]);
  const activeDays = useMemo(() => getPlanDays(activePlan), [activePlan]);
  const activeDayOrder = useMemo(() => getPlanDayOrder(activePlan), [activePlan]);
  const currentMobileDay = activeDayOrder.includes(mobileDay) ? mobileDay : activeDayOrder[0];
  const currentMobileDayIndex = Math.max(0, activeDayOrder.indexOf(currentMobileDay));

  useEffect(() => {
    if (!activeDayOrder.length) return;
    if (!activeDayOrder.includes(mobileDay)) {
      setMobileDay(activeDayOrder[0]);
    }
  }, [activeDayOrder, mobileDay]);

  useEffect(() => {
    if (currentMobileDay) {
      localStorage.setItem(MOBILE_DAY_KEY, currentMobileDay);
    }
  }, [currentMobileDay]);

  // Unscheduled = all cards − cards assigned in active plan, sorted by cardOrder
  const unscheduledCardIds = useMemo(() => {
    const assigned = new Set();
    Object.values(activeDays).forEach((zones) => {
      Object.values(zones).forEach((cards) => {
        cards.forEach((id) => assigned.add(id));
      });
    });
    const allCardIds = Object.keys(cardMap);
    const order = state.cardOrder || [];
    // Cards in cardOrder first (in order), then any new cards not yet in cardOrder
    const ordered = order.filter((id) => allCardIds.includes(id) && !assigned.has(id));
    const rest = allCardIds.filter((id) => !assigned.has(id) && !order.includes(id));
    return [...ordered, ...rest];
  }, [cardMap, activeDays, state.cardOrder]);

  // ==================== Plan operations ====================

  function handleSwitchPlan(planId) {
    setState((prev) => ({
      ...prev,
      tripMeta: { ...prev.tripMeta, activePlanId: planId },
    }));
  }

  function handleMobileDayStep(direction) {
    if (!activeDayOrder.length) return;
    const nextIndex = Math.min(activeDayOrder.length - 1, Math.max(0, currentMobileDayIndex + direction));
    setMobileDay(activeDayOrder[nextIndex]);
  }

  function handleAddCandidateToMobileDay(cardId, zone) {
    if (!requireEditable()) return;
    if (!currentMobileDay) return;
    updateActivePlan((plan) => {
      const currentDay = plan.days[currentMobileDay] || { morning: [], afternoon: [], evening: [], flexible: [] };
      if ((currentDay[zone] || []).includes(cardId)) return plan;
      return {
        ...plan,
        days: {
          ...plan.days,
          [currentMobileDay]: {
            ...currentDay,
            [zone]: [...(currentDay[zone] || []), cardId],
          },
        },
      };
    });
    setCandidatePanelOpen(false);
  }

  function requireEditable() {
    if (canEdit) return true;
    window.alert('請先用 Google 帳號登入後再編輯行程。');
    return false;
  }

  function handleClonePlan() {
    if (!requireEditable()) return;
    setState((prev) => {
      const source = getActivePlan(prev);
      const newId = `plan_${Date.now()}`;
      const cloned = {
        id: newId,
        name: `${source.name} (副本)`,
        dayOrder: [...source.dayOrder],
        days: JSON.parse(JSON.stringify(source.days)),
        dayLabels: { ...(source.dayLabels || {}) },
      };
      return {
        ...prev,
        plans: { ...prev.plans, [newId]: cloned },
        planOrder: [...prev.planOrder, newId],
        tripMeta: { ...prev.tripMeta, activePlanId: newId },
      };
    });
  }

  function handleRenamePlan(planId, newName) {
    if (!requireEditable()) return;
    if (!planId) return;
    const currentName = state.plans?.[planId]?.name || '';
    const nextName = newName ?? window.prompt('新的方案名稱', currentName);
    if (!nextName?.trim()) return;
    setState((prev) => ({
      ...prev,
      plans: {
        ...prev.plans,
        [planId]: { ...prev.plans[planId], name: nextName.trim() },
      },
    }));
  }

  function handleDeletePlan(planId) {
    if (!requireEditable()) return;
    if (!planId) return;
    const planName = state.plans?.[planId]?.name || planId;
    if ((state.planOrder || []).length <= 1) {
      window.alert('只剩一個方案，不能刪除。');
      return;
    }
    if (!window.confirm(`確定要刪除目前方案「${planName}」嗎？這不會刪除其他方案或候選卡。`)) return;
    setState((prev) => {
      if (prev.planOrder.length <= 1) return prev;
      const newPlanOrder = prev.planOrder.filter((id) => id !== planId);
      const { [planId]: removed, ...remainingPlans } = prev.plans;
      const newActive = prev.tripMeta.activePlanId === planId ? newPlanOrder[0] : prev.tripMeta.activePlanId;
      return {
        ...prev,
        plans: remainingPlans,
        planOrder: newPlanOrder,
        tripMeta: { ...prev.tripMeta, activePlanId: newActive },
      };
    });
  }

  function handleResetPlan() {
    if (!requireEditable()) return;
    if (!window.confirm('確定要清空當前方案的所有排程嗎？卡片會回到候選區。')) return;
    setState((prev) => {
      const plan = getActivePlan(prev);
      if (!plan) return prev;
      const emptyDays = generateDays(prev.tripMeta.startDate, prev.tripMeta.endDate);
      // No need to update unscheduledCardIds — it's computed from cards − assignments
      return {
        ...prev,
        plans: {
          ...prev.plans,
          [plan.id]: {
            ...plan,
            days: emptyDays,
            dayOrder: Object.keys(emptyDays).sort(),
            dayLabels: {},
          },
        },
      };
    });
  }

  // Helper: update active plan's data
  function updateActivePlan(updater) {
    setState((prev) => {
      const plan = getActivePlan(prev);
      const updated = updater(plan);
      return {
        ...prev,
        plans: { ...prev.plans, [plan.id]: updated },
      };
    });
  }

  // ==================== Drag & Drop ====================

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const cardLocations = useMemo(() => {
    const loc = {};
    unscheduledCardIds.forEach((id, idx) => {
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
  }, [unscheduledCardIds, activeDays]);

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
      if (containerId === 'unscheduled') return unscheduledCardIds;
      if (containerId && containerId.includes('::')) {
        const [date, zone] = containerId.split('::');
        return activeDays[date]?.[zone] || [];
      }
      return [];
    },
    [unscheduledCardIds, activeDays]
  );

  function handleDragStart(event) {
    if (!canEdit) return;
    setActiveId(event.active.id);
    setDragging(true);
  }

  function handleDragOver(event) {
    if (!canEdit) return;
    const { active, over } = event;
    if (!over) return;

    const activeContainer = findContainer(active.id);
    let overContainer = findContainer(over.id);
    if (!overContainer) overContainer = over.id;
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setState((prev) => {
      const plan = getActivePlan(prev);
      const activeItems = [...getItemsFromPlan(prev, plan, activeContainer)];
      const overItems = [...getItemsFromPlan(prev, plan, overContainer)];

      const activeIndex = activeItems.indexOf(active.id);
      const overIndex = overItems.indexOf(over.id);

      let newIndex;
      if (over.id === overContainer) {
        newIndex = overItems.length;
      } else {
        newIndex = overIndex >= 0 ? overIndex : overItems.length;
      }

      activeItems.splice(activeIndex, 1);
      overItems.splice(newIndex, 0, active.id);

      let next = setItemsInPlan(prev, plan, activeContainer, activeItems);
      const updatedPlan = next.plans[plan.id];
      next = setItemsInPlan(next, updatedPlan, overContainer, overItems);
      return next;
    });
  }

  function handleDragEnd(event) {
    if (!canEdit) {
      setActiveId(null);
      setDragging(false);
      return;
    }
    const { active, over } = event;
    setActiveId(null);
    setDragging(false);
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
        if (activeContainer === 'unscheduled') {
          // Reorder within candidate pool — update cardOrder
          const reordered = arrayMove(items, oldIndex, newIndex);
          setState((prev) => {
            // Rebuild full cardOrder: reordered unscheduled + assigned cards keep their positions
            const assigned = new Set();
            const plan = getActivePlan(prev);
            Object.values(plan.days).forEach((zones) => {
              Object.values(zones).forEach((cards) => {
                cards.forEach((id) => assigned.add(id));
              });
            });
            // Keep assigned cards in their original order, splice in reordered unscheduled
            const newOrder = [...reordered, ...(prev.cardOrder || []).filter((id) => assigned.has(id))];
            // Add any cards not in order yet
            Object.keys(prev.cards).forEach((id) => {
              if (!newOrder.includes(id)) newOrder.push(id);
            });
            return { ...prev, cardOrder: newOrder };
          });
          return;
        }
        const reordered = arrayMove(items, oldIndex, newIndex);
        const [date, zone] = activeContainer.split('::');
        updateActivePlan((plan) => ({
          ...plan,
          days: {
            ...plan.days,
            [date]: { ...plan.days[date], [zone]: reordered },
          },
        }));
      }
    }
  }

  // ==================== Card / Modal / Comment ====================

  function openEditModal(card) {
    if (!requireEditable()) return;
    setModalCard(card);
    setIsNewCard(false);
    setModalOpen(true);
  }

  function openNewCardModal() {
    if (!requireEditable()) return;
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
    if (!requireEditable()) return;
    setState((prev) => {
      const now = new Date().toISOString();
      const cardToSave = {
        ...updatedCard,
        updatedAt: now,
      };
      const newState = {
        ...prev,
        cards: { ...prev.cards, [cardToSave.id]: cardToSave },
      };
      // New cards go to the front of cardOrder (most visible position)
      if (isNew) {
        newState.cardOrder = [cardToSave.id, ...(prev.cardOrder || [])];
      }
      return newState;
    });
    closeModal();
  }

  function handleAddComment(cardId, text) {
    if (!requireEditable()) return;
    if (!text.trim()) return;
    const comment = {
      text: text.trim(),
      timestamp: new Date().toISOString(),
      author: nickname,
    };
    setState((prev) => ({
      ...prev,
      cards: {
        ...prev.cards,
        [cardId]: {
          ...prev.cards[cardId],
          comments: [...(prev.cards[cardId]?.comments || []), comment],
          updatedAt: new Date().toISOString(),
        },
      },
    }));
  }

  function handleEditComment(cardId, commentIdx, newText) {
    if (!requireEditable()) return;
    setState((prev) => {
      const card = prev.cards[cardId];
      if (!card) return prev;
      const newComments = [...(card.comments || [])];
      newComments[commentIdx] = { ...newComments[commentIdx], text: newText };
      return {
        ...prev,
        cards: { ...prev.cards, [cardId]: { ...card, comments: newComments, updatedAt: new Date().toISOString() } },
      };
    });
  }

  function handleAiCardsGenerated(aiCards) {
    if (!requireEditable()) return;
    setState((prev) => {
      const newCards = { ...prev.cards };
      const newOrder = [...(prev.cardOrder || [])];
      // Prepend AI cards (newest first)
      for (const card of aiCards.reverse()) {
        newCards[card.id] = {
          ...card,
          updatedAt: card.updatedAt || new Date().toISOString(),
        };
        newOrder.unshift(card.id);
      }
      return { ...prev, cards: newCards, cardOrder: newOrder };
    });
  }

  function handleDeleteCard(cardId) {
    if (!requireEditable()) return;
    setState((prev) => {
      const { [cardId]: removed, ...remainingCards } = prev.cards;
      // Remove from cardOrder
      const newCardOrder = (prev.cardOrder || []).filter((id) => id !== cardId);
      // Remove from all plans' days
      const newPlans = {};
      for (const [planId, plan] of Object.entries(prev.plans)) {
        const newDays = {};
        for (const [date, zones] of Object.entries(plan.days)) {
          const newZones = {};
          for (const [zone, cards] of Object.entries(zones)) {
            newZones[zone] = cards.filter((id) => id !== cardId);
          }
          newDays[date] = newZones;
        }
        newPlans[planId] = { ...plan, days: newDays };
      }
      return { ...prev, cards: remainingCards, cardOrder: newCardOrder, plans: newPlans };
    });
  }

  function handleDeleteComment(cardId, commentIdx) {
    if (!requireEditable()) return;
    setState((prev) => {
      const card = prev.cards[cardId];
      if (!card) return prev;
      const newComments = (card.comments || []).filter((_, i) => i !== commentIdx);
      return {
        ...prev,
        cards: { ...prev.cards, [cardId]: { ...card, comments: newComments, updatedAt: new Date().toISOString() } },
      };
    });
  }

  function handleUnassignCard(cardId) {
    if (!requireEditable()) return;
    updateActivePlan((plan) => {
      const newDays = {};
      for (const [date, zones] of Object.entries(plan.days || {})) {
        const nextZones = {};
        for (const [zone, ids] of Object.entries(zones || {})) {
          nextZones[zone] = Array.isArray(ids) ? ids.filter((id) => id !== cardId) : [];
        }
        newDays[date] = nextZones;
      }
      return { ...plan, days: newDays };
    });
  }

  function openCardMap(card) {
    setMapModalCardId(card.id);
  }

  // ==================== Trip-level actions ====================

  function handleTripNameChange(name) {
    if (!requireEditable()) return;
    setState((prev) => ({
      ...prev,
      tripMeta: { ...prev.tripMeta, title: name },
    }));
  }

  function handleExport() {
    const exportData = {
      tripMeta: state.tripMeta,
      activePlan: activePlan?.name || 'Default',
      dayOrder: activeDayOrder,
      days: activeDays,
      cards: cardMap,
      unscheduledCardIds,
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

  async function handleShareTrip() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: state.tripMeta.title || 'Tokyo Trip 2026',
          text: 'Open the Tokyo Trip Planner',
          url: TRIP_URL,
        });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }

    setShareModalOpen(true);
  }

  function handleDayLabelChange(date, label) {
    if (!requireEditable()) return;
    updateActivePlan((plan) => ({
      ...plan,
      dayLabels: { ...(plan.dayLabels || {}), [date]: label },
    }));
  }

  function handleSwapDay(date, direction) {
    if (!requireEditable()) return;
    updateActivePlan((plan) => {
      const order = getPlanDayOrder(plan);
      const idx = order.indexOf(date);
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= order.length) return plan;
      const newOrder = [...order];
      [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
      return { ...plan, dayOrder: newOrder };
    });
  }

  // ==================== Render ====================

  const activeCard = activeId ? cardMap[activeId] : null;

  // Convert plans object to array for PlanSelector
  const plansArray = useMemo(
    () => (state.planOrder || []).map((id) => state.plans[id]).filter(Boolean),
    [state.plans, state.planOrder]
  );

  if (!nickname) {
    return (
      <NicknameModal
        randomName={pendingRandomName}
        onConfirm={(name) => saveNickname(name)}
      />
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px' }}>
        ⏳ 載入中...
      </div>
    );
  }

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
          tripName={state.tripMeta.title}
          startDate={state.tripMeta.startDate}
          endDate={state.tripMeta.endDate}
          onTripNameChange={handleTripNameChange}
          onExport={handleExport}
          onShareTrip={handleShareTrip}
          onDeleteActivePlan={() => handleDeletePlan(state.tripMeta.activePlanId)}
          canDeletePlan={canEdit && (state.planOrder || []).length > 1}
          canEdit={canEdit}
          activePlanName={activePlan?.name || ''}
          darkMode={darkMode}
          onToggleDark={() => setDarkMode((v) => !v)}
          authLoading={authLoading}
          user={user}
          isOwner={isOwner}
          onLogin={() => handleLogin().catch((error) => console.error('❌ Google sign-in failed:', error))}
          onLogout={() => logOut().catch((error) => console.error('❌ Logout failed:', error))}
          planSelector={
            <PlanSelector
              plans={plansArray}
              activePlanId={state.tripMeta.activePlanId}
              canEdit={canEdit}
              onSwitch={handleSwitchPlan}
              onClone={handleClonePlan}
              onRename={handleRenamePlan}
              onClearPlan={handleResetPlan}
            />
          }
        />

        <div className="mobile-day-pager">
          <button
            className="mobile-day-nav-btn"
            onClick={() => handleMobileDayStep(-1)}
            disabled={currentMobileDayIndex <= 0}
          >
            ← 前一天
          </button>
          <div className="mobile-day-current">
            <div className="mobile-day-current-date">{formatMobileDate(currentMobileDay)}</div>
            <div className="mobile-day-current-label">{(activePlan?.dayLabels || {})[currentMobileDay] || '今日行程'}</div>
          </div>
          <button
            className="mobile-day-nav-btn"
            onClick={() => handleMobileDayStep(1)}
            disabled={currentMobileDayIndex >= activeDayOrder.length - 1}
          >
            後一天 →
          </button>
        </div>

        <div className="mobile-day-dots">
          {activeDayOrder.map((date, idx) => (
            <button
              key={date}
              className={`mobile-day-dot ${date === currentMobileDay ? 'active' : ''}`}
              onClick={() => setMobileDay(date)}
              aria-label={`切換到第 ${idx + 1} 天`}
            />
          ))}
        </div>

        <div className="days-container">
          {activeDayOrder.map((date, idx) => (
            <DayColumn
              key={date}
              date={date}
              zones={activeDays[date]}
              label={(activePlan?.dayLabels || {})[date] || ''}
              cardMap={cardMap}
              canEdit={canEdit}
              onSwap={handleSwapDay}
              isFirst={idx === 0}
              isLast={idx === activeDayOrder.length - 1}
              onEditCard={openEditModal}
              onDeleteCard={handleDeleteCard}
              onUnassignCard={handleUnassignCard}
              onOpenCardMap={openCardMap}
              onAddComment={handleAddComment}
              onEditComment={handleEditComment}
              onDeleteComment={handleDeleteComment}
              isMobileSelected={date === currentMobileDay}
              onLabelChange={handleDayLabelChange}
              onOpenMap={setMapModalDay}
            />
          ))}
        </div>

        <CandidatePool
          cardIds={unscheduledCardIds}
          cardMap={cardMap}
          panelOpen={candidatePanelOpen}
          currentDayLabel={formatMobileDate(currentMobileDay)}
          canEdit={canEdit}
          onClosePanel={() => setCandidatePanelOpen(false)}
          onAddToZone={handleAddCandidateToMobileDay}
          onAddNew={openNewCardModal}
          onAiGenerate={() => setAiModalOpen(true)}
          onEdit={openEditModal}
          onDeleteCard={handleDeleteCard}
          onOpenMap={openCardMap}
          onAddComment={handleAddComment}
          onEditComment={handleEditComment}
          onDeleteComment={handleDeleteComment}
        />

        <div className="mobile-bottom-bar">
          <button onClick={() => setCandidatePanelOpen(false)}>📅 行程</button>
          <button onClick={() => setCandidatePanelOpen(true)}>🎒 候選 {unscheduledCardIds.length}</button>
          {canEdit ? (
            <>
              <button onClick={openNewCardModal}>＋新增</button>
              <button onClick={() => setAiModalOpen(true)}>🤖 AI</button>
            </>
          ) : (
            <button onClick={() => handleLogin().catch((error) => console.error('❌ Google sign-in failed:', error))}>🔐 登入編輯</button>
          )}
        </div>
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

      {mapModalDay && (
        <DayMapModal
          date={mapModalDay}
          label={(activePlan?.dayLabels || {})[mapModalDay] || ''}
          zones={activeDays[mapModalDay]}
          cardMap={cardMap}
          onClose={() => setMapModalDay(null)}
        />
      )}

      {mapModalCardId && cardMap[mapModalCardId] && (
        <DayMapModal
          zones={{ flexible: [mapModalCardId] }}
          cardMap={cardMap}
          titleOverride={`🗺️ ${cardMap[mapModalCardId].title}`}
          subtitleOverride="單一景點地圖預覽"
          onClose={() => setMapModalCardId(null)}
        />
      )}

      {shareModalOpen && (
        <ShareTripModal onClose={() => setShareModalOpen(false)} />
      )}

      {aiModalOpen && (
        <AiModal
          onClose={() => setAiModalOpen(false)}
          onCardsGenerated={handleAiCardsGenerated}
        />
      )}
    </DndContext>
  );
}

// ==================== Pure helpers ====================

function getItemsFromPlan(state, plan, containerId) {
  if (containerId === 'unscheduled') {
    // Compute unscheduled on the fly for drag operations
    const assigned = new Set();
    Object.values(plan.days).forEach((zones) => {
      Object.values(zones).forEach((cards) => {
        cards.forEach((id) => assigned.add(id));
      });
    });
    return Object.keys(state.cards || {}).filter((id) => !assigned.has(id));
  }
  const [date, zone] = containerId.split('::');
  return plan.days[date]?.[zone] || [];
}

function setItemsInPlan(state, plan, containerId, items) {
  if (containerId === 'unscheduled') {
    // Unscheduled is computed — dragging FROM pool means removing from unscheduled,
    // which happens automatically when the card is added to a plan zone.
    // No state change needed for the unscheduled side.
    return state;
  }
  const [date, zone] = containerId.split('::');
  const updatedPlan = {
    ...plan,
    days: {
      ...plan.days,
      [date]: { ...plan.days[date], [zone]: items },
    },
  };
  return {
    ...state,
    plans: { ...state.plans, [plan.id]: updatedPlan },
  };
}

function formatMobileDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
  return `${d.getMonth() + 1}/${d.getDate()} (${dayNames[d.getDay()]})`;
}
