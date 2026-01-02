/**
 * State management module
 * Handles in-memory state and localStorage persistence
 */

// Default state structure
const defaultState = {
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
  },
  animation: {
    current: 'idle'
  },
  selectedPreset: 'default'
};

// Current state (in-memory)
let currentState = JSON.parse(JSON.stringify(defaultState));

// Storage key
const STORAGE_KEY = 'avatar-creator-state';

/**
 * Get the current state
 * @returns {object} Current state object
 */
export function getState() {
  return currentState;
}

/**
 * Update state with partial changes
 * @param {object} patch - Partial state update
 */
export function setState(patch) {
  currentState = mergeDeep(currentState, patch);
  console.log('[State] Updated:', patch);
}

/**
 * Reset state to defaults
 */
export function resetState() {
  currentState = JSON.parse(JSON.stringify(defaultState));
  console.log('[State] Reset to defaults');
}

/**
 * Load state from localStorage
 * @returns {boolean} True if state was loaded successfully
 */
export function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      currentState = mergeDeep(defaultState, parsed);
      console.log('[State] Loaded from localStorage:', currentState);
      return true;
    }
  } catch (error) {
    console.warn('[State] Failed to load from localStorage:', error);
  }
  return false;
}

/**
 * Save current state to localStorage
 */
export function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
    console.log('[State] Saved to localStorage');
  } catch (error) {
    console.warn('[State] Failed to save to localStorage:', error);
  }
}

/**
 * Deep merge two objects
 * @param {object} target - Target object
 * @param {object} source - Source object
 * @returns {object} Merged object
 */
function mergeDeep(target, source) {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = mergeDeep(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

/**
 * Check if value is a plain object
 * @param {*} item - Value to check
 * @returns {boolean}
 */
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Get a specific state value by path
 * @param {string} path - Dot-separated path (e.g., 'colors.skin')
 * @returns {*} Value at path or undefined
 */
export function getStateValue(path) {
  return path.split('.').reduce((obj, key) => obj?.[key], currentState);
}

/**
 * Set a specific state value by path
 * @param {string} path - Dot-separated path
 * @param {*} value - Value to set
 */
export function setStateValue(path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((obj, key) => {
    if (!obj[key]) obj[key] = {};
    return obj[key];
  }, currentState);
  
  target[lastKey] = value;
  console.log(`[State] Set ${path} =`, value);
}

// Auto-save state changes to localStorage
// Debounced to avoid excessive writes
let saveTimeout;
const originalSetState = setState;
export { originalSetState as setStateImmediate };

/**
 * Enhanced setState with auto-save
 */
export function setStateWithAutoSave(patch) {
  setState(patch);
  
  // Debounce save
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveToStorage();
  }, 500);
}

// Smoke test
console.assert(typeof getState === 'function', 'getState should be a function');
console.assert(typeof setState === 'function', 'setState should be a function');
console.assert(typeof loadFromStorage === 'function', 'loadFromStorage should be a function');
console.assert(typeof saveToStorage === 'function', 'saveToStorage should be a function');
