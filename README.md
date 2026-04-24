# ✈️ Trip Planner

多人協作的拖放式旅行規劃工具 — React + Vite + dnd-kit + Firebase + Gemini AI

👉 [GitHub Pages 鏡像（靜態版）](https://jonesandjay123.github.io/trip-planner/)

> 從靜態 MVP 到 Firebase 即時協作到 AI 生成候選卡，兩天內完成。核心協作功能已完整，AI 行程推薦已上線。

## 🎯 用途

1. 跟朋友一起 brainstorm 旅行行程 — 丟點子、拖拉排序、留言討論
2. AI 一鍵生成候選景點，擴充靈感
3. Vibe coding 教學案例 — 展示 LLM API 串接、即時協作、Firebase 整合

## ✨ Features

### 核心
- 🎯 **拖曳排程** — 把候選卡片拖到每日時段（早上/下午/晚上/彈性）
- 📋 **多方案版本** — Clone 不同排法互相比較，不怕改壞別人的版本
- ✏️ **方案管理** — 可 clone、改名、清空目前方案排程、刪除 active 方案；只剩一個方案時禁止刪除
- 🎒 **共用候選池** — 所有方案共享同一組卡片，候選池按 active plan 動態計算
- ↔️ **候選池排序** — 候選卡可拖動重新排序，重要景點可放左邊
- 🏷️ **每日主題標籤** — 每天行程欄上方可加簡短標籤（如「🗻 富士山」「♨️ 河口湖」）
- ✏️ **編輯 Modal** — 修改卡片標題、時段、時長、地區、描述、標籤
- 💬 **卡片留言** — 在卡片上留言討論（跟卡片走，不跟方案走）
- 📝 **留言編輯 / 刪除** — Hover 留言可直接編輯或刪除
- ➕ **新增卡片** — 自由添加候選行程
- 🗑️ **刪除卡片** — 確認後刪除，同步從所有方案移除
- ◀▶ **日期換序** — 調整天數順序

### AI 整合
- 🤖 **AI 推薦行程** — 輸入主題（如「東京二郎系拉麵」），Gemini 自動生成候選卡片
- 🔢 **可選生成數量** — 1 / 2 / 3 / 5 / 8 張，預設 2 張
- 💡 **預設建議** — 一鍵選擇常見主題快速生成
- 🔒 **Cloud Function proxy** — API key 安全存放在 server side，不暴露前端

### 雲端同步
- ☁️ **Firestore 即時同步** — `onSnapshot` 多分頁 / 多裝置間自動同步更新
- 🔄 **localStorage 快取** — 本地快取讓頁面秒開，背景從 Firestore 同步
- 🕒 **Debounced 寫入** — 避免拖曳過程中的中間狀態頻繁寫入 Firestore
- 🧲 **拖曳期間暫停同步** — 抓著卡片移動時不寫雲端，放手後才同步最終結果
- 🌐 **跨裝置存取** — 任何瀏覽器打開同一個網址都看到同一份資料
- 🔐 **Google Auth 基礎骨架** — Header 右上角顯示登入狀態、登入後可編輯、未登入僅可查看
- 🤖 **Jarvis 遠端寫入** — 已新增受控 callable functions：候選卡 / 留言、高風險排程操作（排入時段、clone/delete/reset plan、改 day label、改 trip 名稱）、Firestore 手動備份 / 檢查 / 還原

### UI/UX
- 🌙 **深色模式** — 自動偵測系統偏好 + 手動切換
- 📱 **手機旅途中模式** — 手機版採單日 paging、dot indicator、底部工具列、候選卡 slide-up panel 與快速加入時段
- 👤 **暱稱系統** — 首次進站詢問暱稱，留言自動署名；留空則隨機生成（如「冒險的🐻熊 #42」）
- 📋 **匯出 JSON** — 匯出當前方案到剪貼簿
- 🛡️ **移除全域重置入口** — 避免誤觸覆蓋整份 Firestore trip document

## 📱 Mobile UX 模式（2026-04）

手機版不再只是桌面版縮小，而是改成「人在旅途中快速決策」的 interaction model：

- **Desktop mental model:** 看全局、多欄並排、拖曳調整。
- **Mobile mental model:** 一次看一天、快速切日期、快速加入候選卡。

目前手機版（`@media (max-width: 480px)`）包含：

1. **Day Paging**：只顯示目前選中的一天，透過前一天 / 後一天與 dot indicator 切換。
2. **Last viewed day**：使用 `localStorage` key `trip-planner-mobile-day` 記住上次停在哪一天，不硬算真實日期。
3. **Compact Header**：上方橘色區塊壓縮成核心資訊 + `⋯` menu，低頻操作收合。
4. **Candidate Panel**：底部 `🎒 候選` 打開 slide-up panel；候選卡可用 `早/午/晚/彈` 快速加入目前日期。
5. **Drag handle**：手機上卡片只從 `☰` handle 開始拖曳，避免整張卡攔截正常 scroll。

### Destructive action policy

全域 reset 曾造成 `trips/main` 被覆蓋回初始狀態，因此前端不再暴露「重置所有資料」入口。

目前 UI 只提供：

- 清空目前 active plan 的排程，但不刪卡片或其他方案。
- 刪除目前 active plan。
- 只剩一個 plan 時不能刪除。
- 清空 / 刪除前都需要 confirm。

如未來需要 reset / restore，應走 Jarvis-only callable functions 或 `jarvis-firebase-ops`，並先建立 Firestore backup document（`trips/backup_*`）。

## 📂 專案結構

```
src/
├── App.jsx                 # 主應用（狀態管理 + 拖放邏輯）
├── App.css                 # 全域樣式（CSS 變數 + 深色模式）
├── firebase.js             # Firebase 初始化 + Firestore 連線
├── components/
│   ├── Header.jsx          # 頂部導航列
│   ├── PlanSelector.jsx    # 方案版本選擇器（switch/clone/rename/clear active plan）
│   ├── DayColumn.jsx       # 每日行程欄（含主題標籤）
│   ├── DropZone.jsx        # 時段拖放區
│   ├── Card.jsx            # 行程卡片（壓縮/展開 + 留言）
│   ├── CardModal.jsx       # 卡片編輯 Modal
│   ├── CandidatePool.jsx   # 候選行程池
│   ├── NicknameModal.jsx   # 暱稱輸入 Modal
│   └── AiModal.jsx         # AI 推薦行程 Modal
├── hooks/
│   ├── useFirestore.js     # Firestore 即時同步 + localStorage 快取 + debounce
│   ├── useNickname.js      # 暱稱 localStorage + 隨機名字生成
│   └── useLocalStorage.js  # （舊版，保留參考）
└── data/
    └── cards.json          # 初始種子卡片（12 個東京景點）

functions/
└── index.js                # Cloud Functions: Gemini proxy + Jarvis controlled card/plan mutations + backup/restore
```

## 🏗 資料結構（v7）

```js
state = {
  _version: 7,

  tripMeta: {
    id: "tokyo-may-2026",
    title: "Tokyo May 2026",
    startDate: "2026-05-01",
    endDate: "2026-05-07",
    activePlanId: "default",
  },

  cards: {
    "asakusa": { id, title, subtitle, zone, duration, area, note, tags, comments: [], source: "seed" },
    "ai_xxx": { ..., source: "gemini" },  // AI 生成的卡片
  },

  cardOrder: ["asakusa", "shibuya-sky", ...],

  plans: {
    "default": {
      id: "default",
      name: "Default",
      dayOrder: ["2026-05-01", ...],
      dayLabels: { "2026-05-01": "富士山" },
      days: { "2026-05-01": { morning: [], afternoon: [], evening: [], flexible: [] } }
    }
  },

  planOrder: ["default"],
}

// 候選池 = cardOrder 中未被 active plan 排入的卡片（動態計算）
```

**設計原則：**
- **Cards 共用** — 編輯卡片內容，所有方案都看到更新
- **Plans 只管排列** — 哪張卡排在哪天哪個時段
- **候選池是算出來的** — 每個 plan 各自獨立，A 方案拖卡不影響 B 方案的候選池
- **cardOrder 獨立儲存** — 控制候選池卡片顯示順序
- **dayLabels 跟 plan 走** — 每個方案可有自己的每日主題標籤
- **Comments 跟卡片走** — 不跟方案走
- **AI 卡片標記 source: "gemini"** — 區分手動新增和 AI 生成

## 🚀 Getting Started

```bash
npm install
npm run dev
```

### 部署

```bash
# Firebase Hosting
npm install
npm run build
firebase deploy --only hosting
```

> 注意：`firebase deploy --only hosting` 不會自動重新 build；每次部署前都要先跑 `npm run build`。

如果同時要部署 Firestore rules：

```bash
firebase deploy --only hosting,firestore:rules
```

如果本機尚未登入 Firebase CLI：

```bash
firebase login
```

### 本地設定

```bash
cp .env.example .env.local
```

`.env.local` 至少包含：

```bash
VITE_FIREBASE_API_KEY=你的_firebase_web_api_key
VITE_OWNER_EMAIL=jonesandjay123@gmail.com
```

## 🔧 Tech Stack

| 用途 | 工具 |
|------|------|
| 框架 | [Vite](https://vitejs.dev/) + [React](https://react.dev/) |
| 拖放 | [@dnd-kit](https://dndkit.com/) |
| 後端/資料庫 | [Firebase](https://firebase.google.com/)（Firestore + Hosting + Cloud Functions） |
| AI | [Gemini API](https://ai.google.dev/)（透過 Cloud Function proxy） |
| 快取 | localStorage（秒開 + 離線 fallback） |
| 樣式 | Plain CSS + CSS Variables（深色/淺色模式） |
| 部署 | Firebase Hosting（主要）+ GitHub Pages（鏡像） |

## 📍 Roadmap

### ✅ Phase 1 — 靜態 MVP（完成）
- [x] 拖放排程 + 候選池
- [x] 卡片編輯 Modal + 留言
- [x] 多方案版本（clone / rename / clear active plan / active plan delete）
- [x] 深色模式 + 匯出 + 響應式
- [x] GitHub Pages 部署

### ✅ Phase 2 — Firebase 雲端同步（完成）
- [x] Firestore 取代 localStorage（雲端持久化）
- [x] Firebase Hosting 部署
- [x] localStorage 保留為快取層（秒開 + 離線）
- [x] `onSnapshot` 即時同步 + debounce + drag pause
- [x] Jarvis 受控 callable functions 寫入（已驗證可用）

### ✅ Phase 2.5 — 協作體驗優化（完成）
- [x] 候選池排序（`cardOrder`）
- [x] 每日主題標籤（`dayLabels`）
- [x] 留言編輯 / 刪除
- [x] 暱稱系統（localStorage + 隨機名稱）
- [x] 卡片刪除
- [x] 手機版 UI 優化（單日 paging + dots + compact header + 候選卡 panel）

### ✅ Phase 3 — AI 整合（完成）
- [x] Cloud Function proxy（保護 Gemini API key）
- [x] AI 推薦行程 Modal（prompt + 數量選擇 + 建議 chips）
- [x] 生成結果自動加入候選池

### ✅ Phase 3.5 — 平台基礎對齊（進行中）
- [x] 補 Google Auth 基礎骨架
- [x] Header 右上角登入狀態區塊
- [x] Firebase Hosting 作為主要部署入口
- [x] Hosting 設定已對齊 repo，可直接 deploy
- [x] Firestore rules 初步收緊為「登入才可寫」
- [x] 前端改成未登入 view-only、已登入可編輯
- [x] Jarvis 第一批受控 callable CRUD（候選卡 / 留言）
- [x] Jarvis 第二批排程 callable mutations（移動卡片 / clone-delete-reset plan / rename）
- [x] Jarvis-only Firestore backup callables（create / inspect / restore `trips/backup_*`）

### 🔜 Phase 4 — 地圖 + 進階功能
- [ ] 🗺️ **地圖整合** — 卡片標記經緯度，在地圖上顯示景點位置
- [ ] 📍 **每日路線視覺化** — 按日期在地圖上畫出當天的行程路線
- [ ] 🧭 **AI 排程建議** — 根據地理位置 + 營業時間自動排出最順路線
- [ ] 🔗 分享連結（`/trip/{tripId}` 支援多趟旅行）
- [ ] 🔒 Firestore rules 進一步收緊 + 權限分流
- [ ] 🌍 多 trip 支援（多 date range、多 owner/member、多帳號使用）

## 🔮 Future Expansion：多旅程 / 多帳號 / 多 date range

目前 app 仍是 Tokyo May 2026 的單 trip MVP：

- 前端初始值寫死 `2026-05-01` → `2026-05-07`。
- Firestore 主資料集中在 `trips/main`。
- plan/card/day 都在同一份 document 內，適合 demo 與單一旅程，但不適合長期多旅程、多帳號使用。

旅程結束後若要產品化，建議演進方向：

### Phase A — Trip registry

新增 trip registry，讓使用者可選不同旅程：

```text
users/{uid}/tripMemberships/{tripId}
trips/{tripId}
```

`trips/{tripId}` 保存：

```js
{
  title,
  ownerUid,
  memberUids,
  startDate,
  endDate,
  activePlanId,
  createdAt,
  updatedAt
}
```

前端路由改成：

```text
/trips/:tripId
```

或先用 query/string selector 過渡。

### Phase B — 拆分單一大 document

目前 `trips/main` 會隨 cards/plans 變大；Firestore 單 document 有大小與寫入熱點限制。建議拆成：

```text
trips/{tripId}
trips/{tripId}/cards/{cardId}
trips/{tripId}/plans/{planId}
trips/{tripId}/plans/{planId}/days/{date}
trips/{tripId}/activityLog/{logId}
```

好處：

- 支援任意 date range。
- 避免每次小改都覆蓋整份 trip。
- 比較容易做 rollback / audit / per-plan diff。
- 多人同時操作衝突較小。

### Phase C — 權限與角色

未來多帳號使用時，建議至少有：

- `owner`：管理旅程、成員、刪除 plan。
- `editor`：新增卡片、移動行程、留言。
- `viewer`：唯讀。

Firestore rules 應以 `tripMemberships` 或 `trips/{tripId}.memberUids` 判斷，而不是只用單一 `VITE_OWNER_EMAIL`。

### Phase D — Jarvis ops 對接

`jarvis-firebase-ops` 未來也要從「固定 trip-planner/main」改成 project + trip scoped：

```bash
node scripts/inspect-trip.mjs --trip tokyo-may-2026
node scripts/add-candidate-card.mjs --trip tokyo-may-2026 ...
node scripts/backup-trip.mjs --trip tokyo-may-2026 --label before-large-change
```

在正式拆資料前，至少應先補：

- `backup-trip`：任何大改前先建立 Firestore `trips/backup_*` 備份。
- `restore-trip-backup`：可明確恢復，而不是靠 session log 重建。
- `delete-active-plan`：與前端語意一致，只刪 active plan 且保護最後一個 plan。

## 💡 設計決策

| 決策 | 理由 |
|------|------|
| Vite + Firebase，不用 Next.js | 互動型工具不需要 SSR/SSG，Vite + Firebase 最省力 |
| Firestore 單文件 MVP | `trips/main` 一個 doc 搞定，之後再拆 subcollection |
| localStorage 快取 + Firestore 同步 | 秒開（本地）+ 雲端持久（Firestore），兩全其美 |
| onSnapshot + debounce + drag pause | 即時同步但不會被拖曳中間狀態污染 |
| Cloud Function proxy for Gemini | API key 不暴露前端，server side 驗證 + normalize |
| AI 只生成候選卡，不自動排程 | 保留使用者拖拉排程的核心樂趣 |
| Google Auth + 暱稱並存 | Auth 決定寫入權限；暱稱保留給留言與輕量協作身份 |
| Cards 共用、Plans 分版本 | Clone 只複製排列不複製卡片，保持資料一致性 |
| 候選池動態計算 | 避免 plan 之間互相污染，Firestore 也不用同步這個欄位 |

## 📝 Seed Data

內建 12 個東京景點卡片：淺草寺、秋葉原、涉谷天空、築地場外市場、TeamLab Borderless、新宿拉麵一條街、明治神宮、東京晴空塔、下北澤、上野公園、台場、Nintendo TOKYO。

## License

MIT
