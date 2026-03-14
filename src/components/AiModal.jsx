import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const generateCards = httpsCallable(functions, 'generateTripCards');

const COUNT_OPTIONS = [1, 2, 3, 5, 8];

export default function AiModal({ onClose, onCardsGenerated }) {
  const [prompt, setPrompt] = useState('');
  const [count, setCount] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate(e) {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError('');

    try {
      const fullPrompt = `生成 ${count} 個關於「${prompt.trim()}」的行程小卡`;
      const result = await generateCards({ prompt: fullPrompt });
      const { cards } = result.data;

      if (cards && cards.length > 0) {
        onCardsGenerated(cards);
        onClose();
      } else {
        setError('AI 沒有生成任何卡片，請換個描述試試');
      }
    } catch (err) {
      console.error('AI generation failed:', err);
      setError(err.message || '生成失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [
    '東京必吃美食景點',
    '適合雨天的室內行程',
    '東京近郊一日遊（箱根/鎌倉/日光）',
    '適合晚上逛的景點',
    '東京購物聖地',
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="ai-modal" onClick={(e) => e.stopPropagation()}>
        <h2>🤖 AI 推薦行程</h2>
        <p className="ai-modal-desc">
          告訴 AI 你想要什麼樣的行程，它會幫你生成候選卡片
        </p>

        <form onSubmit={handleGenerate}>
          <div className="ai-count-row">
            <span className="ai-count-label">生成</span>
            <div className="ai-count-options">
              {COUNT_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`ai-count-btn ${count === n ? 'active' : ''}`}
                  onClick={() => setCount(n)}
                  disabled={loading}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="ai-count-label">個：</span>
          </div>
          <textarea
            className="ai-prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：東京有名的二郎系拉麵"
            rows={2}
            disabled={loading}
            autoFocus
          />

          <div className="ai-suggestions">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                className="ai-suggestion-chip"
                onClick={() => setPrompt(s)}
                disabled={loading}
              >
                {s}
              </button>
            ))}
          </div>

          {error && <div className="ai-error">❌ {error}</div>}

          <div className="ai-modal-actions">
            <button
              type="button"
              className="btn ai-btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn ai-btn-generate"
              disabled={loading || !prompt.trim()}
            >
              {loading ? '⏳ 生成中...' : '✨ 生成卡片'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
