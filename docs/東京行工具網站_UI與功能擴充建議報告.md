# 東京行工具網站 UI 與功能擴充建議報告

測試日期：2026-04-26  
部署網址：https://trip-planner-ab5a9.web.app/  
測試方式：先閱讀 repo source code，再用隔離的 Chrome headless browser 透過 DevTools protocol 操作部署站。測試過程未登入 Google 帳號，因此沒有刻意改動雲端資料。

## 一、目前產品定位

這個工具已經不是單純的行程備忘錄，而是「多人協作的東京行排程工作台」。目前核心能力很完整：

- 候選行程池與每日早上 / 下午 / 晚上 / 彈性時段排程。
- 多方案切換、複製、改名、清空、刪除。
- 卡片留言與協作討論。
- Google Auth 後才能編輯，未登入是 Viewer。
- Firebase Firestore 即時同步與 localStorage 快取。
- AI 推薦候選卡。
- Leaflet + OpenStreetMap 地圖預覽。
- 手機版有單日 paging、底部工具列、候選卡 slide-up panel 與快速加入時段。

整體方向是對的：桌機適合出發前規劃，手機適合旅途中快速查今天要去哪、把候選點加入今天。

## 二、瀏覽器實測結果

### 1. Hosting 與載入

Firebase Hosting 回應正常，HTTP 200。實測時部署內容最後修改時間為 `2026-04-25 02:37:32 GMT`。

首次進站會出現暱稱 modal，內容正常，例如：

- 顯示「歡迎！你的暱稱是？」
- 留空會自動產生隨機暱稱。
- 點「開始規劃」後進入主畫面。

### 2. 桌機版主畫面

進入後看到：

- Trip title：`Tokyo Trip 2026`
- 日期：`5/1 (五) → 5/7 (四)`
- Auth 狀態：`Viewer / 登入`
- 方案：`Default`、`Jarvis Suggest`、`Testing Board`
- 7 個 day column 都可見。
- 候選池顯示 10 個候選行程。

桌機版資訊密度高，適合一次比較 7 天行程。卡片 compact 狀態可讀性不錯，地圖按鈕也容易找到。

### 3. 未登入編輯保護

我點了「新增」後，系統沒有打開新增 modal，而是出現 alert：

`請先用 Google 帳號登入後再編輯行程。`

這代表前端的 `requireEditable()` gate 生效，基本防呆正常。Firestore rules 也限制 `request.auth != null` 才能寫入，方向正確。

### 4. 地圖 modal

我從候選卡點單卡地圖預覽，modal 正常開啟：

- title 顯示單一景點名稱。
- subtitle 顯示「單一景點地圖預覽」。
- Leaflet map 有渲染。
- 右側清單顯示該景點。
- 有 `Google Maps` 與 `複製標題` 操作。

這個功能對旅途中很實用，已經有成為「今天要去哪」核心入口的潛力。

### 5. 手機 viewport

我切到 `390 x 844` mobile viewport 後看到：

- mobile day pager 顯示為 grid。
- 畫面只顯示一天，實測可見 day 是 `5/1 (五)`。
- 底部工具列顯示為 grid。
- 候選 panel 初始被 translate 到畫面下方，點底部「候選」後可滑出。
- 候選 panel 開啟後顯示「加入到：5/1 (五)」。
- 每張候選卡都有快速加入按鈕：`☀️ 早`、`🌤️ 午`、`🌙 晚`、`🔄 彈`。

手機模式的產品思路成立：使用者不需要在手機上硬拖曳，可以直接把候選點加入今天的時段。

## 三、發現的問題與風險

### 1. 方案切換是全域狀態，可能影響所有人

目前 active plan 存在 `tripMeta.activePlanId`，而 `handleSwitchPlan()` 會直接 `setState()` 更新整份 trip state。這代表登入使用者只是「切換自己正在看的方案」，也可能把所有人的 active plan 改掉。

相關位置：

- `src/App.jsx` 的 `handleSwitchPlan()`
- `src/hooks/useFirestore.js` 的整份 state 寫回 Firestore 流程

建議：把 active plan 改成本機偏好，例如 `localStorage`，或做成 per-user preference，不要存在全域 trip document。多方案是共同資料，但「我現在正在看哪個方案」通常是個人視角。

### 2. Viewer 模式仍顯示許多編輯入口

未登入時點新增、刪方案、clone、清空等會被 alert 擋下，但 UI 仍像可操作。這會造成使用者誤解，也讓手機版選單看起來有危險操作。

建議：

- 未登入時把編輯按鈕 disabled，並顯示登入 CTA。
- 或將編輯入口收進「登入後可編輯」區塊。
- 地圖、匯出、方案瀏覽保留可用。

### 3. CSS 有未定義變數

`App.css` 中多處使用 `--bg-primary`、`--bg-secondary`、`--bg-tertiary`、`--border`，但目前 `:root` 與 dark theme 沒有定義這些變數。瀏覽器會讓相關 CSS property 失效。

建議：補齊這些 design tokens，或把引用改成現有的 `--card-bg`、`--input-bg`、`--column-border` 等。這會讓 modal、nickname、AI modal、fade overlay 在 light/dark mode 更穩。

### 4. 協作寫入仍偏「整份文件覆蓋」

`useFirestore` 目前會把整份 state 寫回 `trips/main`。雖然有 debounce、drag pause、`mergeRemoteProtectedFields()`，但多人同時編輯時仍有覆蓋風險，尤其是 plans、dayLabels、cardOrder、comments 這類不同人可能同時動的欄位。

建議逐步改成更窄的 mutation：

- 卡片內容：只 patch `cards.{cardId}`。
- 排程拖曳：只 patch active plan 的 specific day/zone。
- 留言：可用 array operation 或獨立 comments subcollection。
- plan metadata：只 patch plan 自己。

短期不用大重構也可以先加版本 / updatedAt conflict prompt，至少在覆蓋前提醒。

### 5. 新增卡片座標輸入成本偏高

現在新增 / 編輯卡片要手動填 latitude / longitude。這對旅遊工具來說太工程化，尤其手機上使用者很難輸入座標。

建議：

- 地點名稱 / 地址輸入後提供「查座標」。
- 可用 Google Maps URL paste parser，貼上分享連結自動解析名稱或座標。
- AI 生成卡已有 location，可加「驗證座標」或「用 Google Maps 開啟確認」。

### 6. 手機版缺少「今天 / 明天」語意

手機版目前記住上次停在哪一天，這很好。但旅行中打開時，使用者更常問「今天是哪一天的行程」。

建議：

- 若目前日期落在 trip start/end 之間，預設跳到當天。
- pager 顯示 `Day 1 / Day 2` 與日期並列。
- 可加「今天」快速鍵，不取代 last viewed day，但提供一鍵回到今天。

### 7. 卡片資訊沒有交通成本與預約狀態

旅遊排程最容易出錯的地方不是景點本身，而是景點之間的移動、營業時間、訂票和必買時段。現在卡片有 duration、area、note，但缺少旅途中真正會用的狀態。

建議擴充 card schema：

- `reservationStatus`: 未確認 / 已預約 / 已付款 / 需現場排隊。
- `openHoursNote`: 營業時間備註。
- `transitNote`: 從上一站移動時間、路線。
- `priority`: 必去 / 可去 / 備案。
- `cost`: 預估費用。
- `ticketUrl` 或 `bookingUrl`。

## 四、UI 擴充建議

### P0：先修一致性與誤操作

1. 未登入時 disabled 編輯按鈕，避免 Viewer 看起來可以刪方案或新增。
2. active plan 改成本機 / per-user 狀態，避免方案切換干擾其他協作者。
3. 補齊 CSS tokens，避免 light/dark mode 有樣式失效。
4. Header 中 destructive action 文字要更明確，例如「刪除目前方案」比「刪方案」更安全。

### P1：強化旅行中模式

1. 手機 day pager 加「今天」與 `Day N`。
2. 每天頂部加當日摘要：景點數、已定位數、預估總時長。
3. 每個 day column 加「當日地圖」固定入口，手機上可更醒目。
4. 手機候選 panel 加搜尋 / tag filter，候選多時會很需要。

### P2：讓地圖變成核心功能

1. Day map 加路線順序與移動時間估算。
2. 地圖清單支援拖曳排序或上下移動。
3. 「尚未定位」卡片旁直接提供補座標 / Google Maps 搜尋。
4. 匯出 Google Maps search list 或分享連結。

### P3：讓協作更像產品

1. 增加 activity log UI：誰新增、誰移動、誰留言。
2. 卡片留言加作者顏色與時間排序。
3. 方案 comparison view：兩個方案並排比較差異。
4. 加「鎖定方案」或「標記為最終版」，避免出發前被誤改。

### P4：AI 功能產品化

1. AI 生成後不要直接塞入候選池，可以先進 preview list，讓使用者勾選要加入的卡。
2. AI prompt 加上下文：目前已排景點、日期、偏好區域、不要重複。
3. 生成結果加 confidence / source badge。
4. 增加「幫我排一天」功能：輸入候選卡集合，AI 產出建議順序與理由，但最後仍由使用者確認。

## 五、建議的下一步實作順序

1. 修 `activePlanId` 全域同步問題，先把方案切換改成本機狀態。
2. 補 `canEdit` 到 UI 層，讓未登入按鈕 disabled 或隱藏。
3. 補 CSS tokens，順手檢查 light/dark mode modal。
4. 手機版加入搜尋候選卡與「今天」快捷。
5. 新增 card schema：預約狀態、優先級、費用、交通備註。
6. 地圖 modal 增加「尚未定位快速補資料」。
7. 把 Firestore writes 拆成更窄的 patch mutation。

## 六、總結

這個 repo 的產品骨架已經很接近可實際出遊使用。最值得優先處理的不是新增更多花俏功能，而是把「協作狀態」和「個人視角」分清楚，並降低 Viewer 誤操作感。接著把手機旅途中模式、地圖、預約 / 交通狀態補起來，這個工具會從規劃看板變成真正的旅行當日控制台。
