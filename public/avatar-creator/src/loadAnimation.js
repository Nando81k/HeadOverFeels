/**
 * Animation loading and playback utilities
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Singleton loader (reuse from loadAvatar.js pattern)
let gltfLoader;
let dracoLoader;

/**
 * Initialize loaders
 */
function initLoaders() {
  if (!gltfLoader) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    dracoLoader.preload();

    gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
  }
}

/**
 * Load animation from GLB file
 * @param {string} path - Path to animation GLB
 * @returns {Promise<THREE.AnimationClip|null>} Animation clip or null if not found
 */
export async function loadAnimation(path) {
  initLoaders();

  return new Promise((resolve) => {
    console.log(`🎬 Loading animation: ${path}`);

    gltfLoader.load(
      path,
      (gltf) => {
        if (gltf.animations && gltf.animations.length > 0) {
          const clip = gltf.animations[0]; // Use first animation
          console.log(`✅ Animation loaded: "${clip.name}" (${clip.duration.toFixed(2)}s)`);
          resolve(clip);
        } else {
          console.warn(`⚠️ No animations found in: ${path}`);
          resolve(null);
        }
      },
      undefined,
      (error) => {
        console.warn(`⚠️ Failed to load animation: ${path}`, error);
        resolve(null); // Don't reject, just return null (graceful degradation)
      }
    );
  });
}

/**
 * Play animation on mixer with looping
 * @param {THREE.AnimationMixer} mixer - Animation mixer
 * @param {THREE.AnimationClip} clip - Animation clip to play
 * @param {boolean} loop - Whether to loop the animation (default: true)
 * @param {number} fadeInDuration - Fade-in duration in seconds (default: 0.3)
 * @returns {THREE.AnimationAction} The created animation action
 */
export function playAnimation(mixer, clip, loop = true, fadeInDuration = 0.3) {
  if (!mixer || !clip) {
    console.warn('⚠️ Cannot play animation: missing mixer or clip');
    return null;
  }

  const action = mixer.clipAction(clip);
  action.reset();
  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
  action.clampWhenFinished = !loop;
  
  // Fade in
  action.fadeIn(fadeInDuration);
  action.play();

  console.log(`▶️ Playing: "${clip.name}" (loop: ${loop})`);
  return action;
}

/**
 * Cross-fade between two animations
 * @param {THREE.AnimationAction} fromAction - Current animation action (or null)
 * @param {THREE.AnimationAction} toAction - Target animation action
 * @param {number} duration - Cross-fade duration in seconds (default: 0.5)
 */
export function crossFadeAnimations(fromAction, toAction, duration = 0.5) {
  if (!toAction) {
    console.warn('⚠️ Cannot cross-fade: missing target action');
    return;
  }

  // Stop and fade out previous animation
  if (fromAction && fromAction !== toAction) {
    fromAction.fadeOut(duration);
  }

  // Start and fade in new animation
  toAction.reset();
  toAction.setEffectiveTimeScale(1);
  toAction.setEffectiveWeight(1);
  toAction.fadeIn(duration);
  toAction.play();

  const fromName = fromAction ? fromAction.getClip().name : 'none';
  const toName = toAction.getClip().name;
  console.log(`🔀 Cross-fade: "${fromName}" → "${toName}" (${duration}s)`);
}

/**
 * Stop all animations on mixer
 * @param {THREE.AnimationMixer} mixer - Animation mixer
 * @param {number} fadeOutDuration - Fade-out duration in seconds (default: 0.3)
 */
export function stopAllAnimations(mixer, fadeOutDuration = 0.3) {
  if (!mixer) return;

  const actions = mixer._actions || [];
  actions.forEach((action) => {
    if (action.isRunning()) {
      action.fadeOut(fadeOutDuration);
      setTimeout(() => {
        action.stop();
      }, fadeOutDuration * 1000);
    }
  });

  console.log(`⏹️ Stopping all animations`);
}

/**
 * Get current playing animation name
 * @param {THREE.AnimationMixer} mixer - Animation mixer
 * @returns {string|null} Name of current animation or null
 */
export function getCurrentAnimation(mixer) {
  if (!mixer) return null;

  const actions = mixer._actions || [];
  for (const action of actions) {
    if (action.isRunning() && action.getEffectiveWeight() > 0.5) {
      return action.getClip().name;
    }
  }

  return null;
}

/**
 * Check if animation is playing
 * @param {THREE.AnimationMixer} mixer - Animation mixer
 * @param {string} animationName - Name of animation to check
 * @returns {boolean} True if animation is playing
 */
export function isAnimationPlaying(mixer, animationName) {
  if (!mixer) return false;

  const actions = mixer._actions || [];
  for (const action of actions) {
    if (action.getClip().name === animationName && action.isRunning()) {
      return true;
    }
  }

  return false;
}

/**
 * Set animation speed
 * @param {THREE.AnimationAction} action - Animation action
 * @param {number} speed - Speed multiplier (1.0 = normal, 0.5 = half speed, 2.0 = double speed)
 */
export function setAnimationSpeed(action, speed) {
  if (!action) return;
  action.setEffectiveTimeScale(speed);
  console.log(`⏩ Animation speed: ${speed}x`);
}

// Smoke tests
console.assert(typeof loadAnimation === 'function', 'loadAnimation should be a function');
console.assert(typeof playAnimation === 'function', 'playAnimation should be a function');
console.assert(typeof crossFadeAnimations === 'function', 'crossFadeAnimations should be a function');
