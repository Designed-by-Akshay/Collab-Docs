// src/utils/nameGenerator.js
const adjectives = [
    'Happy', 'Clever', 'Swift', 'Bright', 'Gentle', 'Witty', 'Brave', 'Calm',
    'Eager', 'Fancy', 'Quick', 'Jolly', 'Lucky', 'Noble', 'Proud', 'Wise'
  ];
  
  const animals = [
    'Panda', 'Fox', 'Owl', 'Tiger', 'Eagle', 'Dolphin', 'Lion', 'Bear',
    'Wolf', 'Hawk', 'Deer', 'Duck', 'Koala', 'Lynx', 'Seal', 'Otter'
  ];
  
  export const generateFunName = () => {
    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    return `${adjective}${animal}${Math.floor(Math.random() * 1000)}`;
  };