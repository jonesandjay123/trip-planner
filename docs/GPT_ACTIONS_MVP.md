# GPT Actions MVP：ChatGPT 語音/文字控制 Trip Planner

> 日期：2026-04-25  
> 明天目標：先做 ChatGPT Custom GPT Actions → Firebase HTTPS gateway → Firestore。暫時不要先做 Google Home / Gemini Home。

## 為什麼這條更有機會

Google Home / Gemini Home 的路線比較像把 `trip-planner` 包裝成 smart-home device / scene / routine，雖然是官方路，但產品語意不自然，也不適合複雜旅行排程編輯。

ChatGPT Custom GPT Actions 則更貼近真正需求：

```text
Jones 在 ChatGPT app 文字或語音輸入
  ↓
Custom GPT 理解自然語言
  ↓
GPT Action 呼叫我們的 Firebase HTTPS endpoint
  ↓
Gateway 驗證 API key、限制 action 白名單、寫 audit log
  ↓
既有 trip-planner Firestore mutation / inspect logic
  ↓
Firestore trips/main 更新
  ↓
Trip Planner UI 透過 onSnapshot 即時變動
```

這代表 `trip-planner` 不只是人類點 UI 的工具，而是有一層 **agent-operable interface**：AI agent 可以安全讀取、理解、修改、建議。

## 明天 MVP 成功標準

### 成功標準 1：讀取

Jones 在 Custom GPT 裡問：

> 幫我看 5/2 下午有什麼？

流程：

```text
Custom GPT → gptTripPlannerAction.inspectDay → Firestore → GPT 回答整理後結果
```

### 成功標準 2：新增候選卡

Jones 說：

> 幫我加一張候選卡：中野百老匯，備註適合買玩具、模型、電子零件。

流程：

```text
Custom GPT → gptTripPlannerAction.addCandidateCard → Firestore → trip-planner UI 即時出現
```

只要這兩個成功，就代表方向成立。

## 新增 endpoint 設計

### Endpoint

```text
POST /gptTripPlannerAction
```

這應該是 Firebase HTTPS Function，不是 `onCall` callable。原因是 Custom GPT Actions 需要標準 HTTP endpoint + OpenAPI schema。

### Authentication

第一版用 API key。

```http
Authorization: Bearer <GPT_ACTIONS_API_KEY>
```

Implementation notes：

- 用 Firebase Functions Secret：`GPT_ACTIONS_API_KEY`。
- server side 做 timing-safe compare。
- 不要重用 `JARVIS_SHARED_SECRET`。
- 不要把 key commit 到 repo。
- 未來正式多用戶再考慮 OAuth。

## 第一版 action 白名單

### Read-only

- `inspectTrip`
- `inspectDay`
- `inspectCard`

### 低風險 mutation

- `addCandidateCard`
- `appendCommentToCard`
- `moveCardToSlot`
- `renameDayLabel`
- `createBackup`

## 第一版禁止 action

明確不要開：

- `resetPlan`
- `restoreTripBackup`
- `restoreSeedCards`
- `deleteCandidateCard`
- `deletePlan`
- `repairTripState`
- bulk import / overwrite
- 任何 full-document overwrite

這些未來若要開，必須加：

1. explicit confirmation flow
2. automatic backup
3. 更完整 audit log
4. 可能要只讓 Jarvis 而不是 GPT 執行

## Request schema 草案

```ts
type GptTripPlannerActionRequest =
  | { action: "inspectTrip" }
  | { action: "inspectDay"; planId?: string; date: string; zone?: Zone }
  | { action: "inspectCard"; cardId: string }
  | { action: "addCandidateCard"; card: CandidateCardInput }
  | { action: "appendCommentToCard"; cardId: string; text: string }
  | { action: "moveCardToSlot"; cardId: string; planId?: string; date: string; zone: Zone; index?: number }
  | { action: "renameDayLabel"; planId?: string; date: string; label: string }
  | { action: "createBackup"; label: string; reason?: string }

type Zone = "morning" | "afternoon" | "evening" | "flexible"
```

## Response schema 草案

成功：

```json
{
  "ok": true,
  "action": "inspectDay",
  "summary": "5/2 下午目前有 3 張卡：中野百老匯、秋葉原電器街、鳥貴族。",
  "data": {},
  "warnings": [],
  "auditId": "gpt_action_20260425_..."
}
```

失敗：

```json
{
  "ok": false,
  "action": "moveCardToSlot",
  "errorCode": "CARD_NOT_FOUND",
  "message": "找不到 cardId: nakano-broadway。請先 inspect 或 addCandidateCard。",
  "auditId": "gpt_action_20260425_..."
}
```

## OpenAPI schema

草案放在：

```text
openapi/gpt-trip-planner-actions.yaml
```

明天實作 endpoint 後，要把 `servers.url` 改成實際 deployed Firebase Function URL。

## Audit log

每次 action 都要寫 log。建議新 collection：

```text
tripPlannerActionLogs/{logId}
```

欄位：

```json
{
  "source": "custom-gpt-action",
  "action": "inspectDay",
  "request": {},
  "result": { "ok": true, "summary": "..." },
  "actor": "chatgpt-custom-gpt",
  "riskLevel": "read",
  "createdAt": "2026-04-25T...Z"
}
```

不要把完整 logs 塞進 `trips/main`，避免主 document 膨脹。

## GPT instructions 草稿

```text
You are Jones's Trip Planner assistant for the Tokyo May 2026 trip.
Use the Trip Planner Action when you need to inspect or safely update the trip.
Prefer read-only inspection before mutation when the user request is ambiguous.
Allowed actions: inspectTrip, inspectDay, inspectCard, addCandidateCard, appendCommentToCard, moveCardToSlot, renameDayLabel, createBackup.
Never call reset, restore, delete, repair, or bulk overwrite actions.
For destructive requests, explain that this GPT is not allowed to do that and ask Jones to use Jarvis.
When adding physical places, include location fields only if confident. If not confident, add the card without coordinates and say coordinates should be filled later.
After every mutation, summarize exactly what changed and suggest checking the live trip-planner UI.
```

## 本地 / deployed 測試 curl 草案

```bash
curl -X POST "$GPT_TRIP_PLANNER_ACTION_URL" \
  -H "Authorization: Bearer $GPT_ACTIONS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "inspectDay",
    "planId": "plan_1777054282117",
    "date": "2026-05-02",
    "zone": "afternoon"
  }'
```

新增候選卡：

```bash
curl -X POST "$GPT_TRIP_PLANNER_ACTION_URL" \
  -H "Authorization: Bearer $GPT_ACTIONS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "addCandidateCard",
    "card": {
      "title": "中野百老匯",
      "subtitle": "Nakano Broadway",
      "area": "Nakano",
      "zone": "afternoon",
      "duration": "2-3 hr",
      "note": "適合買玩具、模型、電子零件",
      "tags": ["購物", "動漫", "模型"]
    }
  }'
```

## 明天實作順序

1. 先不要碰 Google Home。
2. 在 `functions/index.js` 新增 `gptTripPlannerAction` HTTPS endpoint。
3. 設定 `GPT_ACTIONS_API_KEY` secret。
4. 實作 API key auth。
5. 實作白名單 dispatch。
6. 先只接 `inspectTrip` / `inspectDay`。
7. deploy functions。
8. 用 curl 測 deployed endpoint。
9. 把 `openapi/gpt-trip-planner-actions.yaml` 匯入 Custom GPT Actions。
10. 在 ChatGPT 裡測：「幫我看 5/2 下午有什麼」。
11. 成功後再接 `addCandidateCard`。
12. 最後再接 `appendCommentToCard` / `moveCardToSlot` / `renameDayLabel` / `createBackup`。

## 產品方向註記

這不是單純加一個 API，而是在把 `trip-planner` 從 UI-first tool 推向 AI-native tool：

- 人類可以拖曳、看地圖、視覺決策。
- AI 可以 inspect、整理、建議、低風險修改。
- Firestore 是共同 source of truth。
- Trip Planner UI 是 human-facing surface。
- GPT Actions / Jarvis / 未來 agents 是 agent-facing surface。

這條比 Google Home 更符合 Jones 的 AI agent 系統方向。
