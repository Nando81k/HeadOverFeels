/**
 * Preset configurations for quick avatar customization
 */

// Default preset
export const defaultPreset = {
  name: 'Default',
  morphs: {
    smile: 0,
    blinkLeft: 0,
    blinkRight: 0,
    browUp: 0,
    browDown: 0,
    mouthOpen: 0,
    cheekPuff: 0,
    noseSneer: 0
  },
  colors: {
    skin: '#ffdbac',
    hair: '#3d2817',
    eyes: '#4a90e2',
    top: '#667eea',
    bottom: '#2c3e50',
    shoes: '#34495e'
  },
  style: {
    hairStyle: 'default',
    outfitTop: 'default',
    outfitBottom: 'default',
    shoes: 'default',
    accessories: []
  }
};

// Preset 1: Streetwear
export const streetwearPreset = {
  name: 'Streetwear',
  morphs: {
    smile: 0.3,
    blinkLeft: 0,
    blinkRight: 0,
    browUp: 0.15,
    browDown: 0,
    mouthOpen: 0.1,
    cheekPuff: 0,
    noseSneer: 0
  },
  colors: {
    skin: '#e0ac69',
    hair: '#1a1a1a',
    eyes: '#2ecc71',
    top: '#e74c3c',
    bottom: '#34495e',
    shoes: '#ecf0f1'
  },
  style: {
    hairStyle: 'short',
    outfitTop: 'hoodie',
    outfitBottom: 'jeans',
    shoes: 'sneakers',
    accessories: ['cap', 'chain']
  }
};

// Preset 2: Casual
export const casualPreset = {
  name: 'Casual',
  morphs: {
    smile: 0.5,
    blinkLeft: 0,
    blinkRight: 0,
    browUp: 0.2,
    browDown: 0,
    mouthOpen: 0.15,
    cheekPuff: 0.1,
    noseSneer: 0
  },
  colors: {
    skin: '#ffdbac',
    hair: '#a0826d',
    eyes: '#8e44ad',
    top: '#3498db',
    bottom: '#95a5a6',
    shoes: '#7f8c8d'
  },
  style: {
    hairStyle: 'medium',
    outfitTop: 'tshirt',
    outfitBottom: 'shorts',
    shoes: 'sandals',
    accessories: ['sunglasses']
  }
};

// Preset 3: Formal
export const formalPreset = {
  name: 'Formal',
  morphs: {
    smile: 0.2,
    blinkLeft: 0,
    blinkRight: 0,
    browUp: 0,
    browDown: 0,
    mouthOpen: 0,
    cheekPuff: 0,
    noseSneer: 0
  },
  colors: {
    skin: '#f5cba7',
    hair: '#6f4e37',
    eyes: '#34495e',
    top: '#2c3e50',
    bottom: '#1a1a1a',
    shoes: '#000000'
  },
  style: {
    hairStyle: 'slick',
    outfitTop: 'suit',
    outfitBottom: 'slacks',
    shoes: 'dress',
    accessories: ['tie', 'watch']
  }
};

// Preset 4: Athletic
export const athleticPreset = {
  name: 'Athletic',
  morphs: {
    smile: 0.4,
    blinkLeft: 0,
    blinkRight: 0,
    browUp: 0.1,
    browDown: 0,
    mouthOpen: 0.2,
    cheekPuff: 0,
    noseSneer: 0
  },
  colors: {
    skin: '#d5a078',
    hair: '#5c3317',
    eyes: '#3498db',
    top: '#e67e22',
    bottom: '#1a1a1a',
    shoes: '#c0392b'
  },
  style: {
    hairStyle: 'sporty',
    outfitTop: 'jersey',
    outfitBottom: 'athletic',
    shoes: 'running',
    accessories: ['headband', 'wristband']
  }
};

// All presets array
export const presets = [
  defaultPreset,
  streetwearPreset,
  casualPreset,
  formalPreset,
  athleticPreset
];

/**
 * Get preset by name
 * @param {string} name - Preset name
 * @returns {object|null} Preset object or null if not found
 */
export function getPresetByName(name) {
  return presets.find(p => p.name.toLowerCase() === name.toLowerCase()) || null;
}

/**
 * Generate a random preset within safe value ranges
 * @returns {object} Randomized preset
 */
export function generateRandomPreset() {
  return {
    name: 'Random',
    morphs: {
      smile: Math.random() * 0.6,
      blinkLeft: Math.random() * 0.3,
      blinkRight: Math.random() * 0.3,
      browUp: Math.random() * 0.4,
      browDown: Math.random() * 0.3,
      mouthOpen: Math.random() * 0.3,
      cheekPuff: Math.random() * 0.4,
      noseSneer: Math.random() * 0.2
    },
    colors: {
      skin: randomSkinColor(),
      hair: randomHairColor(),
      eyes: randomEyeColor(),
      top: randomColor(),
      bottom: randomColor(),
      shoes: randomColor()
    },
    style: {
      hairStyle: randomChoice(['default', 'short', 'medium', 'long', 'sporty']),
      outfitTop: randomChoice(['default', 'tshirt', 'hoodie', 'jacket', 'suit']),
      outfitBottom: randomChoice(['default', 'jeans', 'shorts', 'slacks', 'athletic']),
      shoes: randomChoice(['default', 'sneakers', 'sandals', 'dress', 'running']),
      accessories: randomAccessories()
    }
  };
}

// Helper: Random choice from array
function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Helper: Random skin color (realistic tones)
function randomSkinColor() {
  const skinTones = [
    '#ffdbac', '#f5cba7', '#e0ac69', '#d5a078',
    '#c68642', '#8d5524', '#6f4e37', '#5c4033'
  ];
  return randomChoice(skinTones);
}

// Helper: Random hair color
function randomHairColor() {
  const hairColors = [
    '#1a1a1a', '#3d2817', '#6f4e37', '#a0826d',
    '#d4a574', '#e6c690', '#c0392b', '#9b59b6'
  ];
  return randomChoice(hairColors);
}

// Helper: Random eye color
function randomEyeColor() {
  const eyeColors = [
    '#4a90e2', '#2ecc71', '#8e44ad', '#e67e22',
    '#34495e', '#1abc9c', '#3498db', '#27ae60'
  ];
  return randomChoice(eyeColors);
}

// Helper: Random generic color
function randomColor() {
  const colors = [
    '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
    '#9b59b6', '#1abc9c', '#34495e', '#e67e22',
    '#95a5a6', '#d35400', '#c0392b', '#2980b9'
  ];
  return randomChoice(colors);
}

// Helper: Random accessories (0-2 items)
function randomAccessories() {
  const available = ['hat', 'glasses', 'sunglasses', 'cap', 'chain', 'watch', 'headband'];
  const count = Math.floor(Math.random() * 3); // 0-2 accessories
  const selected = [];
  
  for (let i = 0; i < count; i++) {
    const item = randomChoice(available);
    if (!selected.includes(item)) {
      selected.push(item);
    }
  }
  
  return selected;
}

// Smoke tests
console.assert(Array.isArray(presets), 'presets should be an array');
console.assert(presets.length >= 4, 'should have at least 4 presets');
console.assert(defaultPreset.name === 'Default', 'defaultPreset should have name "Default"');
console.assert(typeof generateRandomPreset === 'function', 'generateRandomPreset should be a function');
