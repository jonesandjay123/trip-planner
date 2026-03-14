import { useState } from 'react';

const STORAGE_KEY = 'trip-planner-nickname';

const ADJECTIVES = [
  '冒險的', '悠閒的', '快樂的', '勇敢的', '神秘的',
  '優雅的', '活潑的', '聰明的', '可愛的', '帥氣的',
];

const ANIMALS = [
  '🐻熊', '🐧企鵝', '🦊狐狸', '🐼貓熊', '🦁獅子',
  '🐨無尾熊', '🐯老虎', '🦄獨角獸', '🐳鯨魚', '🦅老鷹',
  '🐸青蛙', '🦋蝴蝶', '🐙章魚', '🦜鸚鵡', '🐿️松鼠',
];

function generateRandomName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  return `${adj}${animal} #${num}`;
}

export function useNickname() {
  const [nickname, setNickname] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || '';
  });

  function saveNickname(name) {
    const final = name.trim() || generateRandomName();
    localStorage.setItem(STORAGE_KEY, final);
    setNickname(final);
    return final;
  }

  function clearNickname() {
    localStorage.removeItem(STORAGE_KEY);
    setNickname('');
  }

  return { nickname, saveNickname, clearNickname, generateRandomName };
}
