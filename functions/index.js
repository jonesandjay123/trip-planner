const crypto = require("node:crypto");
const {setGlobalOptions} = require("firebase-functions/v2");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const seedCards = require("./seedCards");

setGlobalOptions({maxInstances: 10});

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const TRIP_DOC_PATH = "trips/main";
const VALID_ZONES = ["morning", "afternoon", "evening", "flexible"];
const JARVIS_SHARED_SECRET = defineSecret("JARVIS_SHARED_SECRET");

function nowIso() {
  return new Date().toISOString();
}

function tripRef() {
  return db.doc(TRIP_DOC_PATH);
}

function timingSafeEqualString(a, b) {
  const aBuf = Buffer.from(String(a || ""));
  const bBuf = Buffer.from(String(b || ""));

  if (aBuf.length !== bBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuf, bBuf);
}

function assertJarvisCaller(request) {
  const expected = JARVIS_SHARED_SECRET.value();
  const provided = request.data && typeof request.data.jarvisSecret === "string" ?
    request.data.jarvisSecret : "";

  if (!expected) {
    logger.error("JARVIS_SHARED_SECRET secret is missing");
    throw new HttpsError("failed-precondition", "Jarvis secret is not configured on the server.");
  }

  if (!provided || !timingSafeEqualString(provided, expected)) {
    throw new HttpsError("permission-denied", "Jarvis shared secret verification failed.");
  }

  const actorEmail = request.data && typeof request.data.actorEmail === "string" && request.data.actorEmail.trim() ?
    request.data.actorEmail.trim().toLowerCase() : "jarvis@local";
  const actorName = request.data && typeof request.data.actorName === "string" && request.data.actorName.trim() ?
    request.data.actorName.trim() : "Jarvis";

  return {
    uid: request.data && typeof request.data.actorUid === "string" && request.data.actorUid.trim() ?
      request.data.actorUid.trim() : "jarvis-shared-secret",
    email: actorEmail,
    displayName: actorName,
  };
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
      .map((tag) => String(tag || "").trim())
      .filter(Boolean)
      .slice(0, 8);
}

function normalizeCardInput(input, {existingId, preserveComments = true} = {}) {
  if (!input || typeof input !== "object") {
    throw new HttpsError("invalid-argument", "Card payload is required");
  }

  const title = String(input.title || "").trim();
  if (!title) {
    throw new HttpsError("invalid-argument", "Card title is required");
  }

  const zone = VALID_ZONES.includes(input.zone) ? input.zone : "flexible";
  const cardId = existingId || String(input.id || "").trim() || `jarvis_${Date.now()}`;

  const normalized = {
    id: cardId,
    title,
    subtitle: String(input.subtitle || "").trim(),
    zone,
    duration: String(input.duration || "1-2 hr").trim(),
    area: String(input.area || "").trim(),
    note: String(input.note || "").trim(),
    tags: normalizeTags(input.tags),
    source: String(input.source || "jarvis").trim() || "jarvis",
  };

  if (input.location && typeof input.location === "object") {
    const lat = Number(input.location.lat);
    const lng = Number(input.location.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      normalized.location = {
        placeName: String(input.location.placeName || "").trim(),
        address: String(input.location.address || "").trim(),
        lat,
        lng,
        source: String(input.location.source || "manual").trim() || "manual",
        confidence: String(input.location.confidence || "medium").trim() || "medium",
        updatedAt: String(input.location.updatedAt || nowIso()).trim() || nowIso(),
      };
    }
  }

  if (preserveComments) {
    normalized.comments = Array.isArray(input.comments) ? input.comments : [];
  }

  return normalized;
}

async function getTripStateOrThrow() {
  const snap = await tripRef().get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Trip document not found");
  }

  const data = snap.data();
  if (!data || typeof data !== "object") {
    throw new HttpsError("internal", "Trip document is invalid");
  }

  return data;
}

function withAuditFields(card, actor, action) {
  return {
    ...card,
    updatedAt: nowIso(),
    updatedByUid: actor.uid,
    updatedByEmail: actor.email,
    updatedByName: actor.displayName,
    updatedVia: action,
  };
}

function setNestedValue(target, path, value) {
  const segments = path.split(".");
  let cursor = target;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const key = segments[i];
    if (!cursor[key] || typeof cursor[key] !== "object") {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }
  cursor[segments[segments.length - 1]] = value;
}

function buildMergeObject(entries) {
  const result = {};
  for (const [path, value] of entries) {
    setNestedValue(result, path, value);
  }
  return result;
}

function clonePlanObject(plan, nextId, nextName) {
  return {
    id: nextId,
    name: nextName,
    dayOrder: Array.isArray(plan.dayOrder) ? [...plan.dayOrder] : [],
    days: JSON.parse(JSON.stringify(plan.days || {})),
    dayLabels: {...(plan.dayLabels || {})},
  };
}

function sanitizeTripState(trip) {
  const plans = trip && typeof trip.plans === "object" && trip.plans ? trip.plans : {};
  const existingPlanIds = new Set(Object.keys(plans));
  const hasPlanOrder = Array.isArray(trip.planOrder) && trip.planOrder.length > 0;
  const planOrderSource = hasPlanOrder ? trip.planOrder : Object.keys(plans);
  const planOrder = [...new Set(planOrderSource)].filter((id) => existingPlanIds.has(id));
  const validPlanIds = new Set(planOrder);
  const fallbackActive = planOrder[0] || null;
  const activePlanId = validPlanIds.has(trip.tripMeta?.activePlanId) ? trip.tripMeta.activePlanId : fallbackActive;

  const cleanedPlans = {};
  for (const [planId, plan] of Object.entries(plans)) {
    if (!validPlanIds.has(planId)) continue;
    const nextDays = {};
    for (const [date, zones] of Object.entries(plan.days || {})) {
      const nextZones = {};
      for (const [zone, ids] of Object.entries(zones || {})) {
        nextZones[zone] = Array.isArray(ids) ? ids.filter((id) => trip.cards && trip.cards[id]) : [];
      }
      nextDays[date] = nextZones;
    }
    cleanedPlans[planId] = {
      ...plan,
      dayOrder: Array.isArray(plan.dayOrder) ? plan.dayOrder.filter((date) => nextDays[date]) : Object.keys(nextDays).sort(),
      days: nextDays,
      dayLabels: Object.fromEntries(Object.entries(plan.dayLabels || {}).filter(([date]) => nextDays[date])),
    };
  }

  return {
    ...trip,
    plans: cleanedPlans,
    planOrder,
    tripMeta: {
      ...(trip.tripMeta || {}),
      activePlanId,
    },
  };
}

function removeCardFromPlan(plan, cardId) {
  const nextDays = {};
  for (const [date, zones] of Object.entries(plan.days || {})) {
    const nextZones = {};
    for (const [zone, ids] of Object.entries(zones || {})) {
      nextZones[zone] = Array.isArray(ids) ? ids.filter((id) => id !== cardId) : [];
    }
    nextDays[date] = nextZones;
  }
  return {
    ...plan,
    days: nextDays,
  };
}

async function appendActivityLog(entry) {
  await tripRef().set({
    activityLog: FieldValue.arrayUnion({
      ...entry,
      loggedAt: nowIso(),
    }),
  }, {merge: true});
}

exports.generateTripCards = onCall(
    {
      secrets: ["GEMINI_API_KEY"],
    },
    async (request) => {
      const {prompt} = request.data;

      if (!prompt) {
        throw new HttpsError("invalid-argument", "Missing prompt");
      }

      const apiKey = process.env.GEMINI_API_KEY;
      const baseUrl = "https://generativelanguage.googleapis.com";
      const endpoint = "/v1/models/gemini-2.5-flash:generateContent";

      try {
        const response = await fetch(
            `${baseUrl}${endpoint}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
              },
              body: JSON.stringify({
                contents: [
                  {
                    role: "user",
                    parts: [
                      {
                        text: `You are a travel planning assistant.

Generate travel candidate cards based on this request:
"${prompt}"

Return STRICT JSON in this format, no markdown, no explanation, only JSON:
{
  "cards": [
    {
      "title": "景點名稱",
      "subtitle": "一句話描述",
      "zone": "morning/afternoon/evening/flexible",
      "duration": "預估時間 (如 2-3hr)",
      "area": "所在區域",
      "note": "實用建議",
      "tags": ["標籤1", "標籤2"],
      "location": {
        "placeName": "Google Maps / OSM 上可查到的正式地點名稱",
        "address": "完整或接近完整地址",
        "lat": 35.714765,
        "lng": 139.796655,
        "confidence": "high/medium/low"
      }
    }
  ]
}

Rules:
- zone must be one of: morning, afternoon, evening, flexible
- Generate 5 cards unless the user specifies a different number
- Content should be specific and practical for trip planning
- Include location for each card whenever the card represents a physical place, station, shop, restaurant, district, or representative area
- location.lat and location.lng must be numeric decimal coordinates, not strings
- Use confidence high only for a specific well-known POI/shop/station; use medium for a district/representative point; use low if uncertain
- If a request is conceptual and no reasonable physical representative point exists, omit location
- Use Traditional Chinese for all text`,
                      },
                    ],
                  },
                ],
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 2048,
                },
              }),
            },
        );

        const data = await response.json();

        let text = null;
        if (
          data &&
          data.candidates &&
          data.candidates[0] &&
          data.candidates[0].content &&
          data.candidates[0].content.parts &&
          data.candidates[0].content.parts[0] &&
          data.candidates[0].content.parts[0].text
        ) {
          text = data.candidates[0].content.parts[0].text;
        }

        if (!text) {
          logger.error("Invalid Gemini response", data);
          throw new HttpsError("internal", "Invalid Gemini response");
        }

        let cleanText = text.trim();
        if (cleanText.startsWith("```")) {
          cleanText = cleanText
              .replace(/^```(?:json)?\s*/, "")
              .replace(/```\s*$/, "");
        }

        let parsed;
        try {
          parsed = JSON.parse(cleanText);
        } catch (err) {
          logger.error("Failed to parse JSON", cleanText);
          throw new HttpsError("internal", "Failed to parse AI response");
        }

        if (!parsed.cards || !Array.isArray(parsed.cards)) {
          throw new HttpsError("internal", "Invalid cards format");
        }

        const cards = parsed.cards.map((card) => {
          const nextCard = {
            id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            title: card.title || "未命名景點",
            subtitle: card.subtitle || "",
            zone: VALID_ZONES.includes(card.zone) ? card.zone : "flexible",
            duration: card.duration || "1-2hr",
            area: card.area || "",
            note: card.note || "",
            tags: Array.isArray(card.tags) ? card.tags.slice(0, 5) : [],
            comments: [],
            source: "gemini",
          };

          if (card.location && typeof card.location === "object") {
            const lat = Number(card.location.lat);
            const lng = Number(card.location.lng);
            if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
              nextCard.location = {
                placeName: String(card.location.placeName || card.title || "").trim(),
                address: String(card.location.address || "").trim(),
                lat,
                lng,
                source: "ai",
                confidence: String(card.location.confidence || "medium").trim() || "medium",
                updatedAt: nowIso(),
              };
            }
          }

          return nextCard;
        });

        return {cards};
      } catch (err) {
        if (err instanceof HttpsError) throw err;
        logger.error("Error calling Gemini:", err);
        throw new HttpsError("internal", "Failed to generate cards");
      }
    },
);

exports.jarvisAddCandidateCard = onCall({secrets: [JARVIS_SHARED_SECRET]}, async (request) => {
  const actor = assertJarvisCaller(request);
  const nextCard = normalizeCardInput(request.data?.card);

  await db.runTransaction(async (tx) => {
    const ref = tripRef();
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Trip document not found");
    }

    const trip = snap.data();
    const cards = trip.cards || {};
    const cardOrder = Array.isArray(trip.cardOrder) ? trip.cardOrder : [];
    const auditedCard = withAuditFields({...nextCard, comments: []}, actor, "jarvisAddCandidateCard");

    tx.set(ref, {
      cards: {
        ...cards,
        [auditedCard.id]: auditedCard,
      },
      cardOrder: cardOrder.includes(auditedCard.id) ? cardOrder : [auditedCard.id, ...cardOrder],
    }, {merge: true});
  });

  await appendActivityLog({action: "add-card", cardId: nextCard.id, actorEmail: actor.email});
  return {ok: true, cardId: nextCard.id};
});

exports.jarvisUpdateCandidateCard = onCall({secrets: [JARVIS_SHARED_SECRET]}, async (request) => {
  const actor = assertJarvisCaller(request);
  const cardId = String(request.data?.cardId || "").trim();
  const patch = request.data?.patch;

  if (!cardId) {
    throw new HttpsError("invalid-argument", "cardId is required");
  }

  const trip = await getTripStateOrThrow();
  const existing = trip.cards?.[cardId];
  if (!existing) {
    throw new HttpsError("not-found", "Card not found");
  }

  const mergedCard = normalizeCardInput(
      {
        ...existing,
        ...patch,
        id: cardId,
        comments: existing.comments || [],
      },
      {existingId: cardId, preserveComments: true},
  );

  const auditedCard = withAuditFields(mergedCard, actor, "jarvisUpdateCandidateCard");

  await tripRef().set({
    cards: {
      ...trip.cards,
      [cardId]: auditedCard,
    },
  }, {merge: true});

  await appendActivityLog({action: "update-card", cardId, actorEmail: actor.email});
  return {ok: true, cardId};
});

exports.jarvisDeleteCandidateCard = onCall({secrets: [JARVIS_SHARED_SECRET]}, async (request) => {
  const actor = assertJarvisCaller(request);
  const cardId = String(request.data?.cardId || "").trim();

  if (!cardId) {
    throw new HttpsError("invalid-argument", "cardId is required");
  }

  await db.runTransaction(async (tx) => {
    const ref = tripRef();
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Trip document not found");
    }

    const trip = snap.data();
    if (!trip.cards || !trip.cards[cardId]) {
      throw new HttpsError("not-found", "Card not found");
    }

    const nextCards = {...trip.cards};
    delete nextCards[cardId];

    const nextPlans = {};
    for (const [planId, plan] of Object.entries(trip.plans || {})) {
      const nextDays = {};
      for (const [date, zones] of Object.entries(plan.days || {})) {
        const nextZones = {};
        for (const [zone, ids] of Object.entries(zones || {})) {
          nextZones[zone] = Array.isArray(ids) ? ids.filter((id) => id !== cardId) : [];
        }
        nextDays[date] = nextZones;
      }
      nextPlans[planId] = {...plan, days: nextDays};
    }

    const nextCardOrder = Array.isArray(trip.cardOrder) ? trip.cardOrder.filter((id) => id !== cardId) : [];

    tx.set(ref, {
      cards: nextCards,
      plans: nextPlans,
      cardOrder: nextCardOrder,
    }, {merge: true});
  });

  await appendActivityLog({action: "delete-card", cardId, actorEmail: actor.email});
  return {ok: true, cardId};
});

exports.jarvisAppendCommentToCard = onCall({secrets: [JARVIS_SHARED_SECRET]}, async (request) => {
  const actor = assertJarvisCaller(request);
  const cardId = String(request.data?.cardId || "").trim();
  const text = String(request.data?.text || "").trim();

  if (!cardId || !text) {
    throw new HttpsError("invalid-argument", "cardId and text are required");
  }

  const trip = await getTripStateOrThrow();
  const existing = trip.cards?.[cardId];
  if (!existing) {
    throw new HttpsError("not-found", "Card not found");
  }

  const comment = {
    text,
    timestamp: nowIso(),
    author: actor.displayName,
    authorEmail: actor.email,
    authorUid: actor.uid,
    source: "jarvis-function",
  };

  const updatedCard = withAuditFields({
    ...existing,
    comments: [...(existing.comments || []), comment],
  }, actor, "jarvisAppendCommentToCard");

  await tripRef().set({
    cards: {
      ...trip.cards,
      [cardId]: updatedCard,
    },
  }, {merge: true});

  await appendActivityLog({action: "append-comment", cardId, actorEmail: actor.email});
  return {ok: true, cardId, comment};
});

exports.jarvisMoveCardToSlot = onCall({secrets: [JARVIS_SHARED_SECRET]}, async (request) => {
  const actor = assertJarvisCaller(request);
  const cardId = String(request.data?.cardId || "").trim();
  const planId = String(request.data?.planId || "default").trim() || "default";
  const date = String(request.data?.date || "").trim();
  const zone = String(request.data?.zone || "").trim();
  const indexInput = request.data?.index;

  if (!cardId || !date || !VALID_ZONES.includes(zone)) {
    throw new HttpsError("invalid-argument", "cardId, date, and valid zone are required");
  }

  await db.runTransaction(async (tx) => {
    const ref = tripRef();
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "Trip document not found");

    const trip = snap.data();
    if (!trip.cards?.[cardId]) throw new HttpsError("not-found", "Card not found");
    const plan = trip.plans?.[planId];
    if (!plan) throw new HttpsError("not-found", "Plan not found");
    if (!plan.days?.[date]) throw new HttpsError("not-found", "Date not found in plan");

    const cleanedPlan = removeCardFromPlan(plan, cardId);
    const nextZones = {...(cleanedPlan.days[date] || {})};
    const targetItems = Array.isArray(nextZones[zone]) ? [...nextZones[zone]] : [];
    const rawIndex = Number.isInteger(indexInput) ? indexInput : targetItems.length;
    const boundedIndex = Math.max(0, Math.min(rawIndex, targetItems.length));
    targetItems.splice(boundedIndex, 0, cardId);
    nextZones[zone] = targetItems;

    tx.set(ref, buildMergeObject([
      [`plans.${planId}`, {
        ...cleanedPlan,
        days: {
          ...cleanedPlan.days,
          [date]: nextZones,
        },
      }],
      [`cards.${cardId}`, withAuditFields(trip.cards[cardId], actor, "jarvisMoveCardToSlot")],
    ]), {merge: true});
  });

  await appendActivityLog({action: "move-card", cardId, planId, date, zone, actorEmail: actor.email});
  return {ok: true, cardId, planId, date, zone};
});

exports.jarvisClonePlan = onCall({secrets: [JARVIS_SHARED_SECRET]}, async (request) => {
  const actor = assertJarvisCaller(request);
  const sourcePlanId = String(request.data?.sourcePlanId || "default").trim() || "default";
  const name = String(request.data?.name || "").trim();

  const trip = await getTripStateOrThrow();
  const sourcePlan = trip.plans?.[sourcePlanId];
  if (!sourcePlan) throw new HttpsError("not-found", "Source plan not found");

  const nextId = `plan_${Date.now()}`;
  const nextName = name || `${sourcePlan.name || "Plan"} (副本)`;
  const cloned = clonePlanObject(sourcePlan, nextId, nextName);

  await tripRef().set({
    plans: {
      ...trip.plans,
      [nextId]: cloned,
    },
    planOrder: [...(trip.planOrder || []), nextId],
    tripMeta: {
      ...(trip.tripMeta || {}),
      activePlanId: nextId,
      updatedAt: nowIso(),
      updatedByEmail: actor.email,
    },
  }, {merge: true});

  await appendActivityLog({action: "clone-plan", sourcePlanId, newPlanId: nextId, actorEmail: actor.email});
  return {ok: true, planId: nextId, name: nextName};
});

exports.jarvisDeletePlan = onCall({secrets: [JARVIS_SHARED_SECRET]}, async (request) => {
  const actor = assertJarvisCaller(request);
  const planId = String(request.data?.planId || "").trim();

  if (!planId) {
    throw new HttpsError("invalid-argument", "planId is required");
  }

  const trip = await getTripStateOrThrow();
  const plans = trip.plans && typeof trip.plans === "object" ? trip.plans : {};
  const planOrder = Array.isArray(trip.planOrder) ? trip.planOrder : Object.keys(plans);
  if (planOrder.length <= 1) {
    throw new HttpsError("failed-precondition", "Cannot delete the only remaining plan");
  }
  if (!plans[planId]) {
    throw new HttpsError("not-found", "Plan not found");
  }

  const nextPlans = {...plans};
  delete nextPlans[planId];
  const remainingOrder = planOrder.filter((id) => id !== planId && nextPlans[id]);
  const nextActive = trip.tripMeta?.activePlanId === planId ? remainingOrder[0] : (remainingOrder.includes(trip.tripMeta?.activePlanId) ? trip.tripMeta.activePlanId : remainingOrder[0]);

  await tripRef().set({
    plans: nextPlans,
    planOrder: remainingOrder,
    tripMeta: {
      ...(trip.tripMeta || {}),
      activePlanId: nextActive,
      updatedAt: nowIso(),
      updatedByEmail: actor.email,
      updatedByUid: actor.uid,
    },
  }, {merge: false});

  await appendActivityLog({action: "delete-plan", planId, actorEmail: actor.email});
  return {ok: true, planId, activePlanId: nextActive};
});

exports.jarvisResetPlan = onCall({secrets: [JARVIS_SHARED_SECRET]}, async (request) => {
  const actor = assertJarvisCaller(request);
  const planId = String(request.data?.planId || "default").trim() || "default";

  const trip = await getTripStateOrThrow();
  const plan = trip.plans?.[planId];
  if (!plan) throw new HttpsError("not-found", "Plan not found");

  const emptyDays = {};
  for (const date of Object.keys(plan.days || {})) {
    emptyDays[date] = {
      morning: [],
      afternoon: [],
      evening: [],
      flexible: [],
    };
  }

  await tripRef().set(buildMergeObject([
    [`plans.${planId}`, {
      ...plan,
      days: emptyDays,
      dayLabels: {},
      dayOrder: Array.isArray(plan.dayOrder) ? [...plan.dayOrder] : Object.keys(emptyDays).sort(),
    }],
  ]), {merge: true});

  await appendActivityLog({action: "reset-plan", planId, actorEmail: actor.email});
  return {ok: true, planId};
});

exports.jarvisRenameDayLabel = onCall({secrets: [JARVIS_SHARED_SECRET]}, async (request) => {
  const actor = assertJarvisCaller(request);
  const planId = String(request.data?.planId || "default").trim() || "default";
  const date = String(request.data?.date || "").trim();
  const label = String(request.data?.label || "").trim();

  if (!date) {
    throw new HttpsError("invalid-argument", "date is required");
  }

  const trip = await getTripStateOrThrow();
  const plan = trip.plans?.[planId];
  if (!plan) throw new HttpsError("not-found", "Plan not found");
  if (!plan.days?.[date]) throw new HttpsError("not-found", "Date not found in plan");

  await tripRef().set(buildMergeObject([
    [`plans.${planId}.dayLabels.${date}`, label],
  ]), {merge: true});

  await appendActivityLog({action: "rename-day-label", planId, date, label, actorEmail: actor.email});
  return {ok: true, planId, date, label};
});

exports.jarvisRenameTrip = onCall({secrets: [JARVIS_SHARED_SECRET]}, async (request) => {
  const actor = assertJarvisCaller(request);
  const title = String(request.data?.title || "").trim();

  if (!title) {
    throw new HttpsError("invalid-argument", "title is required");
  }

  await tripRef().set({
    tripMeta: {
      title,
      updatedAt: nowIso(),
      updatedByEmail: actor.email,
      updatedByUid: actor.uid,
    },
  }, {merge: true});

  await appendActivityLog({action: "rename-trip", title, actorEmail: actor.email});
  return {ok: true, title};
});


function slugifyBackupLabel(value) {
  return String(value || "manual")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "manual";
}

function timestampBackupId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function countScheduledCards(plan) {
  return Object.values(plan?.days || {}).reduce((sum, zones) => {
    return sum + Object.values(zones || {}).reduce((inner, ids) => inner + (Array.isArray(ids) ? ids.length : 0), 0);
  }, 0);
}

function summarizeTripForBackup(trip) {
  const plans = trip.plans && typeof trip.plans === "object" ? trip.plans : {};
  const planOrder = Array.isArray(trip.planOrder) && trip.planOrder.length ? trip.planOrder : Object.keys(plans);
  return {
    title: trip.tripMeta?.title || "",
    activePlanId: trip.tripMeta?.activePlanId || planOrder[0] || null,
    cardCount: Object.keys(trip.cards || {}).length,
    planCount: planOrder.filter((planId) => plans[planId]).length,
    rawPlanCount: Object.keys(plans).length,
    plans: planOrder.filter((planId) => plans[planId]).map((planId) => ({
      id: planId,
      name: plans[planId]?.name || planId,
      scheduledCardCount: countScheduledCards(plans[planId]),
    })),
    orphanPlanIds: Object.keys(plans).filter((planId) => !planOrder.includes(planId)),
  };
}

function buildTripBackupDoc(trip, actor, {label, reason, mode} = {}) {
  const safeLabel = slugifyBackupLabel(label || reason || mode || "manual");
  const backupId = `backup_${timestampBackupId()}_${safeLabel}`;
  return {
    backupId,
    schemaVersion: 1,
    backupKind: "jarvis-trip-planner-backup",
    sourcePath: TRIP_DOC_PATH,
    createdAt: nowIso(),
    createdAtMs: Date.now(),
    createdByUid: actor.uid,
    createdByEmail: actor.email,
    createdByName: actor.displayName,
    mode: mode || "manual",
    label: String(label || ""),
    reason: String(reason || ""),
    summary: summarizeTripForBackup(trip),
    trip,
  };
}

async function createTripBackup(actor, options = {}) {
  const trip = await getTripStateOrThrow();
  const backup = buildTripBackupDoc(trip, actor, options);
  await db.collection("trips").doc(backup.backupId).set(backup);
  return backup;
}


exports.jarvisCreateTripBackup = onCall({secrets: [JARVIS_SHARED_SECRET]}, async (request) => {
  const actor = assertJarvisCaller(request);
  const label = String(request.data?.label || "manual").trim();
  const reason = String(request.data?.reason || "").trim();
  const backup = await createTripBackup(actor, {label, reason, mode: "manual"});
  await appendActivityLog({action: "create-trip-backup", backupId: backup.backupId, actorEmail: actor.email});
  return {
    ok: true,
    backupId: backup.backupId,
    path: `trips/${backup.backupId}`,
    createdAt: backup.createdAt,
    label: backup.label,
    reason: backup.reason,
    summary: backup.summary,
  };
});

exports.jarvisInspectTripBackup = onCall({secrets: [JARVIS_SHARED_SECRET]}, async (request) => {
  assertJarvisCaller(request);
  const backupId = String(request.data?.backupId || "").trim();
  if (!backupId) throw new HttpsError("invalid-argument", "backupId is required");
  const snap = await db.collection("trips").doc(backupId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Backup not found");
  const backup = snap.data() || {};
  if (backup.backupKind !== "jarvis-trip-planner-backup") {
    throw new HttpsError("failed-precondition", "Document is not a Jarvis trip backup");
  }
  return {
    ok: true,
    backupId: snap.id,
    path: `trips/${snap.id}`,
    createdAt: backup.createdAt || "",
    mode: backup.mode || "",
    label: backup.label || "",
    reason: backup.reason || "",
    summary: backup.summary || {},
    tripMeta: backup.trip?.tripMeta || {},
    planOrder: backup.trip?.planOrder || Object.keys(backup.trip?.plans || {}),
  };
});

exports.jarvisRestoreTripBackup = onCall({secrets: [JARVIS_SHARED_SECRET]}, async (request) => {
  const actor = assertJarvisCaller(request);
  const backupId = String(request.data?.backupId || "").trim();
  if (!backupId) throw new HttpsError("invalid-argument", "backupId is required");

  const snap = await db.collection("trips").doc(backupId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Backup not found");
  const backup = snap.data() || {};
  if (backup.backupKind !== "jarvis-trip-planner-backup" || !backup.trip) {
    throw new HttpsError("failed-precondition", "Document is not a restorable Jarvis trip backup");
  }

  const safetyBackup = await createTripBackup(actor, {
    label: `auto-before-restore-${backupId}`,
    reason: `Automatic safety backup before restoring ${backupId}`,
    mode: "auto-before-restore",
  });

  const restoredTrip = {
    ...backup.trip,
    tripMeta: {
      ...(backup.trip.tripMeta || {}),
      updatedAt: nowIso(),
      updatedByEmail: actor.email,
      updatedByUid: actor.uid,
      updatedByName: actor.displayName,
      restoredFromBackupId: backupId,
      restoredAt: nowIso(),
    },
  };

  await tripRef().set(restoredTrip, {merge: false});
  await appendActivityLog({
    action: "restore-trip-backup",
    backupId,
    safetyBackupId: safetyBackup.backupId,
    actorEmail: actor.email,
  });

  const finalTrip = await getTripStateOrThrow();
  return {
    ok: true,
    restoredFromBackupId: backupId,
    safetyBackupId: safetyBackup.backupId,
    safetyBackupPath: `trips/${safetyBackup.backupId}`,
    summary: summarizeTripForBackup(finalTrip),
  };
});

exports.jarvisInspectTrip = onCall({secrets: [JARVIS_SHARED_SECRET]}, async (request) => {
  assertJarvisCaller(request);
  const trip = await getTripStateOrThrow();
  const planOrder = Array.isArray(trip.planOrder) ? trip.planOrder : [];
  const activePlanId = trip.tripMeta?.activePlanId || planOrder[0] || null;
  const plans = planOrder.map((planId) => {
    const plan = trip.plans?.[planId] || {};
    return {
      id: planId,
      name: plan.name || planId,
      isActive: planId === activePlanId,
      dayOrder: Array.isArray(plan.dayOrder) ? plan.dayOrder : [],
      dayLabels: plan.dayLabels || {},
      scheduledCardCount: Object.values(plan.days || {}).reduce((sum, zones) => {
        return sum + Object.values(zones || {}).reduce((inner, ids) => inner + (Array.isArray(ids) ? ids.length : 0), 0);
      }, 0),
    };
  });

  const allPlanIds = Object.keys(trip.plans || {});
  const orphanPlanIds = allPlanIds.filter((planId) => !planOrder.includes(planId));

  return {
    ok: true,
    tripMeta: trip.tripMeta || {},
    activePlanId,
    planCount: plans.length,
    rawPlanCount: allPlanIds.length,
    orphanPlanIds,
    cardCount: Object.keys(trip.cards || {}).length,
    plans,
  };
});

exports.jarvisInspectDay = onCall({secrets: [JARVIS_SHARED_SECRET]}, async (request) => {
  assertJarvisCaller(request);
  const planId = String(request.data?.planId || "default").trim() || "default";
  const date = String(request.data?.date || "").trim();
  if (!date) {
    throw new HttpsError("invalid-argument", "date is required");
  }

  const trip = await getTripStateOrThrow();
  const plan = trip.plans?.[planId];
  if (!plan) throw new HttpsError("not-found", "Plan not found");
  const day = plan.days?.[date];
  if (!day) throw new HttpsError("not-found", "Day not found");

  const zoneDetails = {};
  for (const zone of VALID_ZONES) {
    const ids = Array.isArray(day[zone]) ? day[zone] : [];
    zoneDetails[zone] = ids.map((id) => {
      const card = trip.cards?.[id] || {id, title: id};
      return {
        id,
        title: card.title || id,
        subtitle: card.subtitle || "",
        area: card.area || "",
        duration: card.duration || "",
      };
    });
  }

  return {
    ok: true,
    planId,
    date,
    label: plan.dayLabels?.[date] || "",
    zones: zoneDetails,
  };
});

exports.jarvisInspectCard = onCall({secrets: [JARVIS_SHARED_SECRET]}, async (request) => {
  assertJarvisCaller(request);
  const cardId = String(request.data?.cardId || "").trim();
  if (!cardId) {
    throw new HttpsError("invalid-argument", "cardId is required");
  }

  const trip = sanitizeTripState(await getTripStateOrThrow());
  const card = trip.cards?.[cardId];
  if (!card) throw new HttpsError("not-found", "Card not found");

  const placements = [];
  for (const [planId, plan] of Object.entries(trip.plans || {})) {
    for (const [date, zones] of Object.entries(plan.days || {})) {
      for (const [zone, ids] of Object.entries(zones || {})) {
        if (Array.isArray(ids) && ids.includes(cardId)) {
          placements.push({planId, planName: plan.name || planId, date, zone});
        }
      }
    }
  }

  return {
    ok: true,
    card,
    placements,
  };
});

exports.jarvisRepairTripState = onCall({secrets: [JARVIS_SHARED_SECRET]}, async (request) => {
  const actor = assertJarvisCaller(request);
  const currentTrip = await getTripStateOrThrow();
  const repairedTrip = sanitizeTripState(currentTrip);

  await tripRef().set({
    ...currentTrip,
    ...repairedTrip,
    tripMeta: {
      ...(currentTrip.tripMeta || {}),
      ...(repairedTrip.tripMeta || {}),
      updatedAt: nowIso(),
      updatedByEmail: actor.email,
      updatedByUid: actor.uid,
    },
  }, {merge: false});

  await appendActivityLog({action: "repair-trip-state", actorEmail: actor.email});
  return {
    ok: true,
    activePlanId: repairedTrip.tripMeta?.activePlanId || null,
    planOrder: repairedTrip.planOrder,
    removedPlanIds: Object.keys(currentTrip.plans || {}).filter((planId) => !Object.keys(repairedTrip.plans || {}).includes(planId)),
  };
});

exports.jarvisRestoreSeedCards = onCall({secrets: [JARVIS_SHARED_SECRET]}, async (request) => {
  const actor = assertJarvisCaller(request);
  const trip = await getTripStateOrThrow();
  const restoredCards = Object.fromEntries(seedCards.map((card) => [card.id, {...card, comments: []}]));
  const restoredOrder = seedCards.map((card) => card.id);

  await tripRef().set({
    ...trip,
    cards: restoredCards,
    cardOrder: restoredOrder,
    tripMeta: {
      ...(trip.tripMeta || {}),
      updatedAt: nowIso(),
      updatedByEmail: actor.email,
      updatedByUid: actor.uid,
    },
  }, {merge: false});

  await appendActivityLog({action: "restore-seed-cards", actorEmail: actor.email, restoredCount: restoredOrder.length});
  return {
    ok: true,
    restoredCount: restoredOrder.length,
  };
});
