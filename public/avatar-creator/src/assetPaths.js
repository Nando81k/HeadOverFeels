/**
 * Asset paths configuration
 * Centralized location for all asset file paths
 */

// Main avatar GLB with rigged skeleton and morph targets
export const AVATAR_GLTF = 'assets/base-avatar.glb';

// Animation clips (optional - app will function without these)
export const ANIMATIONS = {
  IDLE: 'assets/animations/idle.glb',
  WALK: 'assets/animations/walk.glb',
  WAVE: 'assets/animations/wave.glb',
  DANCE: 'assets/animations/dance.glb'
};

// Default morph target name mappings
// These map friendly UI names to typical blendshape names
// If your avatar uses different names, the console will log available morphs
export const MORPH_MAP = {
  smile: 'mouthSmile',
  blinkLeft: 'eyeBlinkLeft',
  blinkRight: 'eyeBlinkRight',
  browUp: 'browInnerUp',
  browDown: 'browDownLeft',
  mouthOpen: 'jawOpen',
  cheekPuff: 'cheekPuff',
  noseSneer: 'noseSneerLeft'
};

// Material name patterns for color customization
export const MATERIAL_PATTERNS = {
  skin: ['skin', 'body', 'face', 'head'],
  hair: ['hair', 'hairstyle'],
  eyes: ['eye', 'iris', 'pupil'],
  top: ['shirt', 'top', 'jacket', 'torso'],
  bottom: ['pants', 'bottom', 'legs'],
  shoes: ['shoe', 'boot', 'feet']
};

// Mesh name prefixes for style toggles
export const MESH_PREFIXES = {
  hair: ['Hair_', 'Hairstyle_', 'hair_'],
  top: ['Top_', 'Shirt_', 'Jacket_', 'Torso_'],
  bottom: ['Bottom_', 'Pants_', 'Legs_'],
  shoes: ['Shoes_', 'Boots_', 'Feet_'],
  accessory: ['Accessory_', 'Hat_', 'Glasses_', 'Jewelry_']
};
