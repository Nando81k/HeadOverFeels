/**
 * UI creation using lil-gui
 * Builds interface for morphs, colors, styles, animations, presets, and export
 */

import GUI from 'lil-gui';
import * as THREE from 'three';
import { ANIMATIONS, MATERIAL_PATTERNS, MESH_PREFIXES } from './assetPaths.js';
import { getState, setState, resetState } from './state.js';
import { loadAnimation, crossFadeAnimations } from './loadAnimation.js';
import { presets, generateRandomPreset } from './presets.js';

// Active animation action reference
let currentAnimationAction = null;

/**
 * Create the full UI
 * @param {THREE.Group} avatarScene - Avatar scene root
 * @param {THREE.AnimationMixer} mixer - Animation mixer
 * @param {object} morphSystem - Morph system API
 * @param {THREE.WebGLRenderer} renderer - Renderer for PNG export
 * @param {HTMLCanvasElement} canvas - Canvas element for PNG export
 * @returns {GUI} lil-gui instance
 */
export function createUI(avatarScene, mixer, morphSystem, renderer, canvas) {
  const gui = new GUI({ title: 'Avatar Creator', width: 320 });

  // Load current state
  const state = getState();

  // Create folders
  createMorphFolder(gui, morphSystem, state);
  createColorFolder(gui, avatarScene, state);
  createStyleFolder(gui, avatarScene, state);
  createAnimationFolder(gui, mixer, state);
  createPresetFolder(gui, avatarScene, mixer, morphSystem, state);
  createExportFolder(gui, renderer, canvas);

  // Apply initial state to avatar
  applyStateToAvatar(state, avatarScene, mixer, morphSystem);

  console.log('✅ UI created with 6 folders');
  return gui;
}

/**
 * Create Face (Morphs) folder
 */
function createMorphFolder(gui, morphSystem, state) {
  const folder = gui.addFolder('Face');
  const morphs = state.morphs;
  const availableMorphs = morphSystem.getAvailableMorphs();

  // Check if any mapped morphs are available
  const mappedMorphs = morphSystem.listMorphs();
  const availableCount = mappedMorphs.filter(name => {
    const value = morphSystem.getMorphByFriendlyName(name);
    return value !== null;
  }).length;

  if (availableCount === 0) {
    folder.add({ info: 'No morphs available' }, 'info').disable();
    console.warn('⚠️ No mapped morphs available in avatar');
    return;
  }

  // Add slider for each mapped morph
  mappedMorphs.forEach((friendlyName) => {
    const currentValue = morphSystem.getMorphByFriendlyName(friendlyName);
    
    if (currentValue !== null) {
      // Morph is available
      folder
        .add(morphs, friendlyName, 0, 1, 0.01)
        .name(formatLabel(friendlyName))
        .onChange((value) => {
          morphSystem.setMorphByFriendlyName(friendlyName, value);
          setState({ morphs: { [friendlyName]: value } });
        });
    } else {
      // Morph not found in avatar
      console.warn(`⚠️ Morph "${friendlyName}" not found in avatar`);
    }
  });

  // Add reset button
  folder.add(
    {
      reset: () => {
        Object.keys(morphs).forEach((key) => {
          morphs[key] = 0;
          morphSystem.setMorphByFriendlyName(key, 0);
        });
        setState({ morphs });
        gui.updateDisplay();
      }
    },
    'reset'
  ).name('Reset Face');

  folder.open();
}

/**
 * Create Colors folder
 */
function createColorFolder(gui, avatarScene, state) {
  const folder = gui.addFolder('Colors');
  const colors = state.colors;

  // Skin color
  folder.addColor(colors, 'skin').name('Skin').onChange((value) => {
    updateMaterialColor(avatarScene, MATERIAL_PATTERNS.skin, value);
    setState({ colors: { skin: value } });
  });

  // Hair color
  folder.addColor(colors, 'hair').name('Hair').onChange((value) => {
    updateMaterialColor(avatarScene, MATERIAL_PATTERNS.hair, value);
    setState({ colors: { hair: value } });
  });

  // Eyes color
  folder.addColor(colors, 'eyes').name('Eyes').onChange((value) => {
    updateMaterialColor(avatarScene, MATERIAL_PATTERNS.eyes, value);
    setState({ colors: { eyes: value } });
  });

  // Top color
  folder.addColor(colors, 'top').name('Top').onChange((value) => {
    updateMaterialColor(avatarScene, MATERIAL_PATTERNS.top, value);
    setState({ colors: { top: value } });
  });

  // Bottom color
  folder.addColor(colors, 'bottom').name('Bottom').onChange((value) => {
    updateMaterialColor(avatarScene, MATERIAL_PATTERNS.bottom, value);
    setState({ colors: { bottom: value } });
  });

  // Shoes color
  folder.addColor(colors, 'shoes').name('Shoes').onChange((value) => {
    updateMaterialColor(avatarScene, MATERIAL_PATTERNS.shoes, value);
    setState({ colors: { shoes: value } });
  });

  folder.open();
}

/**
 * Create Style folder
 */
function createStyleFolder(gui, avatarScene, state) {
  const folder = gui.addFolder('Style');
  const style = state.style;

  // Get available style options from scene
  const hairOptions = getAvailableStyles(avatarScene, MESH_PREFIXES.hair);
  const topOptions = getAvailableStyles(avatarScene, MESH_PREFIXES.top);
  const bottomOptions = getAvailableStyles(avatarScene, MESH_PREFIXES.bottom);
  const shoeOptions = getAvailableStyles(avatarScene, MESH_PREFIXES.shoes);

  // Hair style dropdown
  if (hairOptions.length > 0) {
    folder
      .add(style, 'hairStyle', hairOptions)
      .name('Hair Style')
      .onChange((value) => {
        setActiveStyle(avatarScene, MESH_PREFIXES.hair, value);
        setState({ style: { hairStyle: value } });
      });
  }

  // Outfit top dropdown
  if (topOptions.length > 0) {
    folder
      .add(style, 'outfitTop', topOptions)
      .name('Top')
      .onChange((value) => {
        setActiveStyle(avatarScene, MESH_PREFIXES.top, value);
        setState({ style: { outfitTop: value } });
      });
  }

  // Outfit bottom dropdown
  if (bottomOptions.length > 0) {
    folder
      .add(style, 'outfitBottom', bottomOptions)
      .name('Bottom')
      .onChange((value) => {
        setActiveStyle(avatarScene, MESH_PREFIXES.bottom, value);
        setState({ style: { outfitBottom: value } });
      });
  }

  // Shoes dropdown
  if (shoeOptions.length > 0) {
    folder
      .add(style, 'shoes', shoeOptions)
      .name('Shoes')
      .onChange((value) => {
        setActiveStyle(avatarScene, MESH_PREFIXES.shoes, value);
        setState({ style: { shoes: value } });
      });
  }

  if (hairOptions.length === 0 && topOptions.length === 0 && bottomOptions.length === 0 && shoeOptions.length === 0) {
    folder.add({ info: 'No style options available' }, 'info').disable();
    console.warn('⚠️ No style meshes found in avatar');
  }
}

/**
 * Create Animation folder
 */
function createAnimationFolder(gui, mixer, state) {
  const folder = gui.addFolder('Animation');
  const animation = state.animation;

  // Animation dropdown
  const animOptions = Object.keys(ANIMATIONS).map(key => key.toLowerCase());
  
  folder
    .add(animation, 'current', animOptions)
    .name('Animation')
    .onChange(async (value) => {
      await switchAnimation(mixer, value);
      setState({ animation: { current: value } });
    });

  // Animation speed
  folder
    .add({ speed: 1.0 }, 'speed', 0.1, 2.0, 0.1)
    .name('Speed')
    .onChange((value) => {
      if (currentAnimationAction) {
        currentAnimationAction.setEffectiveTimeScale(value);
      }
    });

  folder.add({ info: 'Animations loaded on demand' }, 'info').disable();
}

/**
 * Create Preset folder
 */
function createPresetFolder(gui, avatarScene, mixer, morphSystem, state) {
  const folder = gui.addFolder('Presets');

  // Preset dropdown
  const presetNames = presets.map(p => p.name);
  const presetControl = { preset: state.selectedPreset || 'Default' };

  folder
    .add(presetControl, 'preset', presetNames)
    .name('Select Preset')
    .onChange((value) => {
      const preset = presets.find(p => p.name === value);
      if (preset) {
        applyPreset(preset, avatarScene, mixer, morphSystem);
        setState({ selectedPreset: value });
        gui.updateDisplay();
      }
    });

  // Apply button
  folder.add(
    {
      apply: () => {
        const preset = presets.find(p => p.name === presetControl.preset);
        if (preset) {
          applyPreset(preset, avatarScene, mixer, morphSystem);
          gui.updateDisplay();
        }
      }
    },
    'apply'
  ).name('Apply Preset');

  // Randomize button
  folder.add(
    {
      randomize: () => {
        const randomPreset = generateRandomPreset();
        applyPreset(randomPreset, avatarScene, mixer, morphSystem);
        setState({ selectedPreset: 'Random' });
        gui.updateDisplay();
      }
    },
    'randomize'
  ).name('Randomize');

  // Reset to default
  folder.add(
    {
      reset: () => {
        resetState();
        const defaultPreset = presets[0];
        applyPreset(defaultPreset, avatarScene, mixer, morphSystem);
        setState({ selectedPreset: 'Default' });
        gui.updateDisplay();
      }
    },
    'reset'
  ).name('Reset to Default');
}

/**
 * Create Export folder
 */
function createExportFolder(gui, renderer, canvas) {
  const folder = gui.addFolder('Export');

  // PNG export
  folder.add(
    {
      savePNG: () => {
        exportPNG(renderer, canvas);
      }
    },
    'savePNG'
  ).name('Save as PNG');

  folder.add({ info: 'Downloads current view' }, 'info').disable();
}

/**
 * Update material colors by pattern matching
 */
function updateMaterialColor(avatarScene, patterns, color) {
  const hexColor = new THREE.Color(color);
  let updatedCount = 0;

  avatarScene.traverse((child) => {
    if (child.isMesh && child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];

      materials.forEach((mat) => {
        const matName = mat.name.toLowerCase();
        
        // Check if material name matches any pattern
        const matches = patterns.some(pattern => matName.includes(pattern.toLowerCase()));

        if (matches) {
          mat.color.set(hexColor);
          updatedCount++;
        }
      });
    }
  });

  if (updatedCount > 0) {
    console.log(`🎨 Updated ${updatedCount} material(s) with color ${color}`);
  }
}

/**
 * Get available style options from scene
 */
function getAvailableStyles(avatarScene, prefixes) {
  const styles = new Set(['default']);

  avatarScene.traverse((child) => {
    if (child.isMesh) {
      const meshName = child.name.toLowerCase();

      // Check if mesh name matches any prefix
      prefixes.forEach((prefix) => {
        if (meshName.startsWith(prefix.toLowerCase())) {
          // Extract style name after prefix
          const styleName = meshName.substring(prefix.length).split('_')[0];
          if (styleName) {
            styles.add(styleName);
          }
        }
      });
    }
  });

  return Array.from(styles).sort();
}

/**
 * Set active style by hiding/showing meshes
 */
function setActiveStyle(avatarScene, prefixes, styleName) {
  let changedCount = 0;

  avatarScene.traverse((child) => {
    if (child.isMesh) {
      const meshName = child.name.toLowerCase();

      // Check if mesh matches any prefix
      const matchesPrefix = prefixes.some(prefix => meshName.startsWith(prefix.toLowerCase()));

      if (matchesPrefix) {
        // Show only if matches style name or is default
        const matchesStyle = meshName.includes(styleName.toLowerCase()) || styleName === 'default';
        child.visible = matchesStyle;
        changedCount++;
      }
    }
  });

  console.log(`👕 Set style "${styleName}": ${changedCount} mesh(es) affected`);
}

/**
 * Switch animation with cross-fade
 */
async function switchAnimation(mixer, animName) {
  const animPath = ANIMATIONS[animName.toUpperCase()];
  
  if (!animPath) {
    console.warn(`⚠️ Animation not found: ${animName}`);
    return;
  }

  try {
    const clip = await loadAnimation(animPath);
    
    if (clip) {
      const newAction = mixer.clipAction(clip);
      newAction.setLoop(THREE.LoopRepeat);
      
      crossFadeAnimations(currentAnimationAction, newAction, 0.5);
      currentAnimationAction = newAction;
    }
  } catch (error) {
    console.error(`❌ Failed to switch animation: ${error.message}`);
  }
}

/**
 * Apply preset to avatar
 */
function applyPreset(preset, avatarScene, mixer, morphSystem) {
  console.log(`📋 Applying preset: ${preset.name}`);

  // Apply morphs
  if (preset.morphs) {
    morphSystem.applyFriendlyMorphs(preset.morphs);
  }

  // Apply colors
  if (preset.colors) {
    Object.entries(preset.colors).forEach(([key, value]) => {
      const patterns = MATERIAL_PATTERNS[key];
      if (patterns) {
        updateMaterialColor(avatarScene, patterns, value);
      }
    });
  }

  // Apply styles
  if (preset.style) {
    if (preset.style.hairStyle) {
      setActiveStyle(avatarScene, MESH_PREFIXES.hair, preset.style.hairStyle);
    }
    if (preset.style.outfitTop) {
      setActiveStyle(avatarScene, MESH_PREFIXES.top, preset.style.outfitTop);
    }
    if (preset.style.outfitBottom) {
      setActiveStyle(avatarScene, MESH_PREFIXES.bottom, preset.style.outfitBottom);
    }
    if (preset.style.shoes) {
      setActiveStyle(avatarScene, MESH_PREFIXES.shoes, preset.style.shoes);
    }
  }

  // Update state
  setState({
    morphs: preset.morphs || {},
    colors: preset.colors || {},
    style: preset.style || {},
    selectedPreset: preset.name
  });

  console.log(`✅ Preset "${preset.name}" applied`);
}

/**
 * Apply current state to avatar (called on init)
 */
function applyStateToAvatar(state, avatarScene, mixer, morphSystem) {
  // Apply morphs
  if (state.morphs) {
    morphSystem.applyFriendlyMorphs(state.morphs);
  }

  // Apply colors
  if (state.colors) {
    Object.entries(state.colors).forEach(([key, value]) => {
      const patterns = MATERIAL_PATTERNS[key];
      if (patterns) {
        updateMaterialColor(avatarScene, patterns, value);
      }
    });
  }

  // Apply styles
  if (state.style) {
    if (state.style.hairStyle) {
      setActiveStyle(avatarScene, MESH_PREFIXES.hair, state.style.hairStyle);
    }
    if (state.style.outfitTop) {
      setActiveStyle(avatarScene, MESH_PREFIXES.top, state.style.outfitTop);
    }
    if (state.style.outfitBottom) {
      setActiveStyle(avatarScene, MESH_PREFIXES.bottom, state.style.outfitBottom);
    }
    if (state.style.shoes) {
      setActiveStyle(avatarScene, MESH_PREFIXES.shoes, state.style.shoes);
    }
  }

  // Apply animation
  if (state.animation && state.animation.current) {
    switchAnimation(mixer, state.animation.current);
  }

  console.log('✅ State applied to avatar');
}

/**
 * Export PNG snapshot
 */
function exportPNG(renderer, canvas) {
  try {
    // Render current frame
    renderer.render(renderer.info.render.scene, renderer.info.render.camera);

    // Convert canvas to data URL
    const dataURL = canvas.toDataURL('image/png');

    // Create download link
    const link = document.createElement('a');
    link.download = `avatar-${Date.now()}.png`;
    link.href = dataURL;
    link.click();

    console.log('📸 PNG exported successfully');
  } catch (error) {
    console.error('❌ Failed to export PNG:', error);
  }
}

/**
 * Format label for UI (capitalize words)
 */
function formatLabel(text) {
  return text
    .replace(/([A-Z])/g, ' $1') // Add space before capitals
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .trim();
}

// Smoke tests
console.assert(typeof createUI === 'function', 'createUI should be a function');
console.assert(typeof updateMaterialColor === 'function', 'updateMaterialColor should be a function');
console.assert(typeof applyPreset === 'function', 'applyPreset should be a function');
