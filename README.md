# ✈️ Trip Planner

多人協作的拖放式旅行規劃工具 — React + Vite + dnd-kit

👉 **[線上版](https://jonesandjay123.github.io/trip-planner/)**

## 🎯 用途

1. 跟朋友一起 brainstorm 東京行程 — 丟點子、拖拉排序、留言討論
2. Vibe coding 教學案例 — 展示 LLM API 串接、即時協作、Firebase 整合

## ✨ Features

### 核心
- 🎯 **拖曳排程** — 把候選卡片拖到每日時段（早上/下午/晚上/彈性）
- 📋 **多方案版本** — Clone 不同排法互相比較，不怕改壞別人的版本
- 🧹 **方案清空** — 一鍵把當前方案的排程清空，從零重新排
- 🎒 **共用候選池** — 所有方案共享同一組卡片，只有排列方式不同
- ✏️ **編輯 Modal** — 修改卡片標題、時段、時長、地區、描述、標籤
- 💬 **卡片留言** — 在卡片上留言討論（跟卡片走，不跟方案走）
- ➕ **新增卡片** — 自由添加候選行程
- ◀▶ **日期換序** — 調整天數順序

### UI/UX
- 🌙 **深色模式** — 自動偵測系統偏好 + 手動切換
- 📱 **響應式** — 手機/平板/桌面都支援
- 📋 **匯出 JSON** — 匯出當前方案到剪貼簿
- 🔄 **全域重置** — 重置所有資料回初始狀態

## 📂 專案結構

```
src/
├── App.jsx                 # 主應用（狀態管理 + 拖放邏輯）
├── App.css                 # 全域樣式（CSS 變數 + 深色模式）
├── components/
│   ├── Header.jsx          # 頂部導航列
│   ├── PlanSelector.jsx    # 方案版本選擇器（clone/rename/delete/reset）
│   ├── DayColumn.jsx       # 每日行程欄
│   ├── DropZone.jsx        # 時段拖放區
│   ├── Card.jsx            # 行程卡片（壓縮/展開）
│   ├── CardModal.jsx       # 卡片編輯 Modal
│   └── CandidatePool.jsx   # 候選行程池
├── hooks/
│   └── useLocalStorage.js  # localStorage 持久化 + 版本控制
└── data/
    └── cards.json          # 初始種子卡片（12 個東京景點）
```

## 🏗 資料結構

```js
state = {
  _version: 4,                    // 版本號（自動重置 localStorage）
  tripName: "Tokyo May 2026",
  startDate: "2026-05-01",
  endDate: "2026-05-07",
  cards: {                        // 共用卡片庫
    "asakusa": { id, title, subtitle, zone, duration, ... },
    ...
  },
  unscheduled: ["asakusa", ...],  // 候選池（共用）
  plans: [                        // 多套方案
    {
      id: "default",
      name: "Default",
      dayOrder: ["2026-05-01", ...],
      days: {
        "2026-05-01": { morning: [], afternoon: [], evening: [], flexible: [] },
        ...
      }
    }
  ],
  activePlanId: "default"
}
```

**設計原則：**
- Cards 共用 — 編輯卡片內容，所有方案都看到更新
- Plans 只管排列 — 哪張卡排在哪天哪個時段
- Comments 跟卡片走 — 不跟方案走
- 候選池共用 — 是「所有想法」，方案只是「怎麼排」

## 🚀 Getting Started

```bash
npm install
npm run dev
```

## 🔧 Tech Stack

| 用途 | 工具 |
|------|------|
| 框架 | [Vite](https://vitejs.dev/) + [React](https://react.dev/) |
| 拖放 | [@dnd-kit](https://dndkit.com/) |
| 持久化 | localStorage（v1）→ Firebase Firestore（planned） |
| 樣式 | Plain CSS + CSS Variables（深色/淺色模式） |
| 部署 | GitHub Pages → Firebase Hosting（planned） |

## 📍 Roadmap

### ✅ Phase 1 — 靜態 MVP（完成）
- [x] 拖放排程 + 候選池
- [x] 卡片編輯 Modal + 留言
- [x] 多方案版本（clone/rename/delete/reset）
- [x] 深色模式 + 匯出 + 響應式
- [x] GitHub Pages 部署

### 🔜 Phase 2 — Firebase 即時協作
- [ ] Firestore 取代 localStorage（多人共用同一份 trip）
- [ ] Firebase Hosting 部署
- [ ] 分享連結（`/trip/{tripId}`）
- [ ] 簡單密碼保護（不做登入系統）

### 🔮 Phase 3 — LLM 整合
- [ ] Gemini API 生成候選行程卡
- [ ] Firebase Cloud Functions 當 LLM proxy（保護 API key）
- [ ] Jarvis 直接透過 Firestore API 推送卡片 / 調整排程
- [ ] AI 自動推薦行程排法

## 💡 設計決策

| 決策 | 理由 |
|------|------|
| 不用 Next.js | 互動型工具不需要 SSR/SSG，Vite + Firebase 最省力 |
| localStorage → Firestore | 多人共用需要雲端資料層，localStorage 只能單機 |
| 不做登入系統 | 小圈子協作用密碼就夠，不增加摩擦 |
| Cards 共用、Plans 分版本 | Clone 只複製排列不複製卡片，保持資料一致性 |
| STATE_VERSION 自動重置 | 改了 state 結構就 bump 版本，避免舊資料格式衝突 |

## 📝 Seed Data

內建 12 個東京景點卡片：淺草寺、秋葉原、涉谷天空、築地場外市場、TeamLab Borderless、新宿拉麵一條街、明治神宮、東京鐵塔、上野公園、原宿竹下通、台場、池袋 Sunshine City。

## License

MIT
