# ✈️ Trip Planner

多人協作的拖放式旅行規劃工具 — React + Vite + dnd-kit + Firebase

👉 **[線上版（Firebase）](https://trip-planner-ab5a9.web.app/)** ｜ [GitHub Pages 鏡像](https://jonesandjay123.github.io/trip-planner/)

> 核心協作功能已完整：桌面版多人規劃、候選池排序、每日主題標籤、留言討論、即時同步、跨裝置共享都已可用。接下來主要剩下手機體驗、分享連結、權限收斂，以及 LLM 對接。

## 🎯 用途

1. 跟朋友一起 brainstorm 東京行程 — 丟點子、拖拉排序、留言討論
2. Vibe coding 教學案例 — 展示 LLM API 串接、即時協作、Firebase 整合

## ✨ Features

### 核心
- 🎯 **拖曳排程** — 把候選卡片拖到每日時段（早上/下午/晚上/彈性）
- 📋 **多方案版本** — Clone 不同排法互相比較，不怕改壞別人的版本
- 🧹 **方案清空** — 一鍵把當前方案的排程清空，從零重新排
- 🎒 **共用候選池** — 所有方案共享同一組卡片，候選池按 active plan 動態計算
- ↔️ **候選池排序** — 候選卡可拖動重新排序，重要景點可放左邊
- 🏷️ **每日主題標籤** — 每天行程欄上方可加簡短標籤（如「🗻 富士山」「♨️ 河口湖」）
- ✏️ **編輯 Modal** — 修改卡片標題、時段、時長、地區、描述、標籤
- 💬 **卡片留言** — 在卡片上留言討論（跟卡片走，不跟方案走）
- 📝 **留言編輯 / 刪除** — Hover 留言可直接編輯或刪除
- ➕ **新增卡片** — 自由添加候選行程
- 🗑️ **刪除卡片** — 確認後刪除，同步從所有方案移除
- ◀▶ **日期換序** — 調整天數順序

### 雲端同步
- ☁️ **Firestore 即時同步** — `onSnapshot` 多分頁 / 多裝置間自動同步更新
- 🔄 **localStorage 快取** — 本地快取讓頁面秒開，背景從 Firestore 同步
- 🕒 **Debounced 寫入** — 避免拖曳過程中的中間狀態頻繁寫入 Firestore
- 🧲 **拖曳期間暫停同步** — 抓著卡片移動時不寫雲端，放手後才同步最終結果
- 🌐 **跨裝置存取** — 任何瀏覽器打開同一個網址都看到同一份資料
- 🤖 **Jarvis 遠端寫入** — AI 助手透過 Firestore REST API 直接推送卡片和調整排程

### UI/UX
- 🌙 **深色模式** — 自動偵測系統偏好 + 手動切換
- 📱 **響應式** — 手機/平板/桌面都支援
- 👤 **暱稱系統** — 首次進站詢問暱稱，留言自動署名；留空則隨機生成（如「冒險的🐻熊 #42」）
- 📋 **匯出 JSON** — 匯出當前方案到剪貼簿
- 🔄 **全域重置** — 重置所有資料回初始狀態

## 📂 專案結構

```
src/
├── App.jsx                 # 主應用（狀態管理 + 拖放邏輯）
├── App.css                 # 全域樣式（CSS 變數 + 深色模式）
├── firebase.js             # Firebase 初始化 + Firestore 連線
├── components/
│   ├── Header.jsx          # 頂部導航列
│   ├── PlanSelector.jsx    # 方案版本選擇器（clone/rename/delete/reset）
│   ├── DayColumn.jsx       # 每日行程欄（含主題標籤）
│   ├── DropZone.jsx        # 時段拖放區
│   ├── Card.jsx            # 行程卡片（壓縮/展開 + 留言）
│   ├── CardModal.jsx       # 卡片編輯 Modal
│   ├── CandidatePool.jsx   # 候選行程池
│   └── NicknameModal.jsx   # 暱稱輸入 Modal
├── hooks/
│   ├── useFirestore.js     # Firestore 即時同步 + localStorage 快取 + debounce
│   ├── useNickname.js      # 暱稱 localStorage + 隨機名字生成
│   └── useLocalStorage.js  # （舊版，保留參考）
└── data/
    └── cards.json          # 初始種子卡片（12 個東京景點）
```

## 🏗 資料結構（v7）

```js
// === 存儲的資料（Firestore + localStorage 快取）===
state = {
  _version: 7,

  // Trip 主文件 → Firestore: trips/main
  tripMeta: {
    id: "tokyo-may-2026",
    title: "Tokyo May 2026",
    startDate: "2026-05-01",
    endDate: "2026-05-07",
    activePlanId: "default",
  },

  // 共用卡片庫
  cards: {
    "asakusa": { id, title, subtitle, zone, duration, comments: [], ... },
  },

  // 候選池顯示順序
  cardOrder: ["asakusa", "shibuya-sky", "tsukiji", ...],

  // 方案（object keyed by ID）
  plans: {
    "default": {
      id: "default",
      name: "Default",
      dayOrder: ["2026-05-01", ...],
      dayLabels: { "2026-05-01": "富士山", "2026-05-02": "河口湖" },
      days: {
        "2026-05-01": { morning: [], afternoon: [], evening: [], flexible: [] }
      }
    }
  },

  planOrder: ["default"],
}

// === 計算的資料（不存儲）===
// 候選池 = cardOrder 中未被 active plan 排入的卡片
unscheduledCardIds = cardOrder.filter(id => !assignedInActivePlan(id))
```

**設計原則：**
- **Cards 共用** — 編輯卡片內容，所有方案都看到更新
- **Plans 只管排列** — 哪張卡排在哪天哪個時段
- **候選池是算出來的** — 每個 plan 各自獨立，A 方案拖卡不影響 B 方案的候選池
- **cardOrder 獨立儲存** — 控制候選池卡片顯示順序
- **dayLabels 跟 plan 走** — 每個方案可有自己的每日主題標籤
- **Comments 跟卡片走** — 不跟方案走
- **Plans 用 object 不用 array** — 方便 Firestore 單筆讀寫
- **planOrder 獨立** — 控制顯示順序，跟 plan 資料分離

## 🚀 Getting Started

```bash
npm install
npm run dev
```

### 部署

```bash
# Firebase Hosting
npm run build
firebase deploy --only hosting

# GitHub Pages（自動，push to main 觸發 GitHub Actions）
```

## 🔧 Tech Stack

| 用途 | 工具 |
|------|------|
| 框架 | [Vite](https://vitejs.dev/) + [React](https://react.dev/) |
| 拖放 | [@dnd-kit](https://dndkit.com/) |
| 後端/資料庫 | [Firebase](https://firebase.google.com/)（Firestore + Hosting） |
| 快取 | localStorage（秒開 + 離線 fallback） |
| 樣式 | Plain CSS + CSS Variables（深色/淺色模式） |
| 部署 | Firebase Hosting（主要）+ GitHub Pages（鏡像） |

## 📍 Roadmap

### ✅ Phase 1 — 靜態 MVP（完成）
- [x] 拖放排程 + 候選池
- [x] 卡片編輯 Modal + 留言
- [x] 多方案版本（clone/rename/delete/reset）
- [x] 深色模式 + 匯出 + 響應式
- [x] GitHub Pages 部署

### ✅ Phase 2 — Firebase 雲端同步（完成）
- [x] Firestore 取代 localStorage（雲端持久化）
- [x] Firebase Hosting 部署
- [x] localStorage 保留為快取層（秒開 + 離線）
- [x] 雙部署支援（Firebase Hosting + GitHub Pages）
- [x] `onSnapshot` 即時同步（多 tab / 多裝置即時看到變更）
- [x] 拖曳期間暫停同步，放手後 flush（避免中間狀態洩漏）

### ✅ Phase 2.5 — 協作體驗優化（完成）
- [x] 候選池排序（`cardOrder`）
- [x] 每日主題標籤（`dayLabels`）
- [x] 留言編輯 / 刪除
- [x] 暱稱系統（localStorage + 隨機名稱）
- [x] 卡片刪除
- [x] Jarvis REST API 寫入（已驗證可用）
- [x] 留言輸入體驗修正（Enter 後清空）

### 🔜 Phase 3 — 分享 / 權限 / 行動端優化
- [ ] 手機版拖放體驗優化
- [ ] 分享連結（`/trip/{tripId}`）
- [ ] Firestore rules 收緊（讀取開放，寫入限制）
- [ ] Read-only / editable 權限分流
- [ ] 多 trip 支援（不再只有 `trips/main`）

### 🔮 Phase 4 — AI 整合
- [x] Cloud Functions / API proxy 保護金鑰 (已部署: `https://generatetripcards-hldkl4z5ya-uc.a.run.app`)
- [ ] Gemini API 生成候選卡 (前端對接準備中)
- [ ] AI 自動排程（根據地理位置/營業時間排出最順路線）

## 💡 設計決策

| 決策 | 理由 |
|------|------|
| Vite + Firebase，不用 Next.js | 互動型工具不需要 SSR/SSG，Vite + Firebase 最省力 |
| Firestore 單文件 MVP | `trips/main` 一個 doc 搞定，之後再拆 subcollection |
| localStorage 快取 + Firestore 同步 | 秒開（本地）+ 雲端持久（Firestore），兩全其美 |
| onSnapshot + debounce + drag pause | 即時同步但不會被拖曳中間狀態污染 |
| 不做登入系統 | 小圈子協作用暱稱就夠，不增加摩擦 |
| Cards 共用、Plans 分版本 | Clone 只複製排列不複製卡片，保持資料一致性 |
| 候選池動態計算 | 避免 plan 之間互相污染，Firestore 也不用同步這個欄位 |
| STATE_VERSION 自動重置 | 改了 state 結構就 bump 版本，避免舊資料格式衝突 |

## 📝 Seed Data

內建 12 個東京景點卡片：淺草寺、秋葉原、涉谷天空、築地場外市場、TeamLab Borderless、新宿拉麵一條街、明治神宮、東京晴空塔、下北澤、上野公園、台場、Nintendo TOKYO。

## License

MIT
