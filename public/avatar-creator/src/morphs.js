/**
 * Morph target (blendshape) system
 * Handles binding and manipulating morph targets across all avatar meshes
 */

import { MORPH_MAP } from './assetPaths.js';

// Cache for morph target data
let morphCache = {
  meshes: [],               // Array of meshes with morph targets
  dictionaries: [],         // Corresponding morphTargetDictionary objects
  influences: [],           // Corresponding morphTargetInfluences arrays
  availableMorphs: new Set() // Set of all available morph target names
};

/**
 * Initialize morph system by scanning avatar for morph targets
 * @param {THREE.Group} avatarScene - Root avatar scene
 * @returns {object} API object with morph manipulation functions
 */
export function initMorphSystem(avatarScene) {
  console.log('🎭 Initializing morph system...');

  // Clear previous cache
  morphCache.meshes = [];
  morphCache.dictionaries = [];
  morphCache.influences = [];
  morphCache.availableMorphs.clear();

  // Traverse scene and collect all meshes with morph targets
  avatarScene.traverse((child) => {
    if (child.isMesh && child.morphTargetDictionary) {
      const dict = child.morphTargetDictionary;
      const influences = child.morphTargetInfluences;

      if (dict && influences && Object.keys(dict).length > 0) {
        morphCache.meshes.push(child);
        morphCache.dictionaries.push(dict);
        morphCache.influences.push(influences);

        // Collect all morph names
        Object.keys(dict).forEach(name => {
          morphCache.availableMorphs.add(name);
        });

        console.log(`  ├─ Found ${Object.keys(dict).length} morphs on: ${child.name || 'Unnamed Mesh'}`);
      }
    }
  });

  console.log(`✅ Morph system initialized: ${morphCache.meshes.length} meshes, ${morphCache.availableMorphs.size} unique morphs`);
  
  // Log all available morphs
  if (morphCache.availableMorphs.size > 0) {
    console.log(`  └─ Available morphs: ${Array.from(morphCache.availableMorphs).sort().join(', ')}`);
  } else {
    console.warn('  ⚠️ No morph targets found in avatar');
  }

  // Validate MORPH_MAP
  validateMorphMap();

  // Return API
  return {
    setMorph,
    getMorph,
    listMorphs,
    getAvailableMorphs,
    resetAllMorphs,
    setMorphByFriendlyName
  };
}

/**
 * Validate MORPH_MAP against available morphs
 */
function validateMorphMap() {
  const friendlyNames = Object.keys(MORPH_MAP);
  const missingMorphs = [];

  friendlyNames.forEach(friendlyName => {
    const morphName = MORPH_MAP[friendlyName];
    if (!morphCache.availableMorphs.has(morphName)) {
      missingMorphs.push(`${friendlyName} → ${morphName}`);
    }
  });

  if (missingMorphs.length > 0) {
    console.warn('⚠️ MORPH_MAP contains mappings not found in avatar:');
    missingMorphs.forEach(mapping => {
      console.warn(`  ├─ ${mapping}`);
    });
    console.warn('  └─ These morphs will be ignored. Update assetPaths.js MORPH_MAP to match your avatar.');
  } else {
    console.log('✅ MORPH_MAP validated: all mappings found');
  }
}

/**
 * Set morph target value by exact morph name
 * @param {string} morphName - Exact morph target name
 * @param {number} value - Value between 0 and 1
 * @returns {boolean} True if morph was found and set
 */
export function setMorph(morphName, value) {
  if (!morphCache.availableMorphs.has(morphName)) {
    console.warn(`⚠️ Morph not found: "${morphName}"`);
    return false;
  }

  // Clamp value to 0-1 range
  const clampedValue = Math.max(0, Math.min(1, value));

  let setCount = 0;

  // Update all meshes that have this morph
  for (let i = 0; i < morphCache.meshes.length; i++) {
    const dict = morphCache.dictionaries[i];
    const influences = morphCache.influences[i];

    if (morphName in dict) {
      const index = dict[morphName];
      influences[index] = clampedValue;
      setCount++;
    }
  }

  if (setCount > 0) {
    console.log(`🎭 Set morph "${morphName}" = ${clampedValue.toFixed(2)} on ${setCount} mesh(es)`);
  }

  return setCount > 0;
}

/**
 * Get current morph target value by exact morph name
 * @param {string} morphName - Exact morph target name
 * @returns {number|null} Current value (0-1) or null if not found
 */
export function getMorph(morphName) {
  if (!morphCache.availableMorphs.has(morphName)) {
    return null;
  }

  // Return value from first mesh that has this morph
  for (let i = 0; i < morphCache.meshes.length; i++) {
    const dict = morphCache.dictionaries[i];
    const influences = morphCache.influences[i];

    if (morphName in dict) {
      const index = dict[morphName];
      return influences[index];
    }
  }

  return null;
}

/**
 * Set morph by friendly name (uses MORPH_MAP)
 * @param {string} friendlyName - Friendly name from MORPH_MAP (e.g., 'smile')
 * @param {number} value - Value between 0 and 1
 * @returns {boolean} True if morph was found and set
 */
export function setMorphByFriendlyName(friendlyName, value) {
  const morphName = MORPH_MAP[friendlyName];
  
  if (!morphName) {
    console.warn(`⚠️ Friendly name not in MORPH_MAP: "${friendlyName}"`);
    return false;
  }

  return setMorph(morphName, value);
}

/**
 * Get morph by friendly name (uses MORPH_MAP)
 * @param {string} friendlyName - Friendly name from MORPH_MAP (e.g., 'smile')
 * @returns {number|null} Current value (0-1) or null if not found
 */
export function getMorphByFriendlyName(friendlyName) {
  const morphName = MORPH_MAP[friendlyName];
  
  if (!morphName) {
    return null;
  }

  return getMorph(morphName);
}

/**
 * List all mapped morphs (friendly names)
 * @returns {string[]} Array of friendly morph names from MORPH_MAP
 */
export function listMorphs() {
  return Object.keys(MORPH_MAP);
}

/**
 * Get all available morph target names in avatar
 * @returns {string[]} Array of exact morph target names
 */
export function getAvailableMorphs() {
  return Array.from(morphCache.availableMorphs).sort();
}

/**
 * Reset all morphs to 0
 */
export function resetAllMorphs() {
  const allMorphs = getAvailableMorphs();
  
  allMorphs.forEach(morphName => {
    setMorph(morphName, 0);
  });

  console.log(`🔄 Reset ${allMorphs.length} morphs to 0`);
}

/**
 * Apply multiple morphs at once
 * @param {object} morphValues - Object with morphName: value pairs
 * @example applyMorphs({ 'mouthSmile': 0.5, 'eyeBlinkLeft': 1.0 })
 */
export function applyMorphs(morphValues) {
  Object.entries(morphValues).forEach(([morphName, value]) => {
    setMorph(morphName, value);
  });
}

/**
 * Apply morphs from friendly names (uses MORPH_MAP)
 * @param {object} friendlyValues - Object with friendlyName: value pairs
 * @example applyFriendlyMorphs({ smile: 0.5, blinkLeft: 1.0 })
 */
export function applyFriendlyMorphs(friendlyValues) {
  Object.entries(friendlyValues).forEach(([friendlyName, value]) => {
    setMorphByFriendlyName(friendlyName, value);
  });
}

/**
 * Get current state of all mapped morphs
 * @returns {object} Object with friendlyName: value pairs
 */
export function getCurrentMorphState() {
  const state = {};
  
  Object.keys(MORPH_MAP).forEach(friendlyName => {
    const value = getMorphByFriendlyName(friendlyName);
    if (value !== null) {
      state[friendlyName] = value;
    }
  });

  return state;
}

// Smoke tests
console.assert(typeof initMorphSystem === 'function', 'initMorphSystem should be a function');
console.assert(typeof setMorph === 'function', 'setMorph should be a function');
console.assert(typeof getMorph === 'function', 'getMorph should be a function');
console.assert(typeof applyMorphs === 'function', 'applyMorphs should be a function');
