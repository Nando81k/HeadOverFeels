/**
 * Main entry point - Three.js scene setup and app bootstrap
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import GUI from 'lil-gui';

import { AVATAR_GLTF } from './assetPaths.js';
import { loadAvatar } from './loadAvatar.js';
import { initMorphSystem } from './morphs.js';
import { createUI } from './ui.js';
import { loadFromStorage } from './state.js';

// Global references
let scene, camera, renderer, controls;
let avatarScene, mixer, morphSystem, gui;
let clock = new THREE.Clock();

// DOM elements
const canvas = document.getElementById('avatar-canvas');
const loadingOverlay = document.getElementById('loading-overlay');
const missingAssetOverlay = document.getElementById('missing-asset-overlay');

/**
 * Initialize Three.js scene, camera, renderer, lights
 */
function initThreeJS() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.Fog(0x1a1a2e, 8, 15);

  // Camera
  camera = new THREE.PerspectiveCamera(
    40, // FOV
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, 1.5, 3.5);
  camera.lookAt(0, 1, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 1.5;
  controls.maxDistance = 8;
  controls.maxPolarAngle = Math.PI / 1.5; // Limit looking down
  controls.update();

  // Environment (IBL using RoomEnvironment PMREM)
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const roomEnvironment = new RoomEnvironment();
  const envTexture = pmremGenerator.fromScene(roomEnvironment).texture;
  scene.environment = envTexture;
  roomEnvironment.dispose();
  pmremGenerator.dispose();

  // Lights
  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  hemisphereLight.position.set(0, 10, 0);
  scene.add(hemisphereLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(3, 6, 4);
  directionalLight.castShadow = true;
  directionalLight.shadow.camera.top = 3;
  directionalLight.shadow.camera.bottom = -3;
  directionalLight.shadow.camera.left = -3;
  directionalLight.shadow.camera.right = 3;
  directionalLight.shadow.camera.near = 0.1;
  directionalLight.shadow.camera.far = 20;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.bias = -0.001;
  scene.add(directionalLight);

  // Ground
  const groundGeometry = new THREE.CircleGeometry(6, 64);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x16213e,
    roughness: 0.8,
    metalness: 0.2
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Handle window resize
  window.addEventListener('resize', onWindowResize, false);

  console.log('✅ Three.js scene initialized');
}

/**
 * Window resize handler
 */
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Animation loop
 */
function animate() {
  requestAnimationFrame(animate);

  const deltaTime = clock.getDelta();

  // Update animation mixer
  if (mixer) {
    mixer.update(deltaTime);
  }

  // Update controls
  controls.update();

  // Render scene
  renderer.render(scene, camera);
}

/**
 * Show loading overlay
 */
function showLoading() {
  loadingOverlay.style.display = 'flex';
  missingAssetOverlay.style.display = 'none';
}

/**
 * Hide loading overlay
 */
function hideLoading() {
  loadingOverlay.style.display = 'none';
}

/**
 * Show missing asset overlay
 * @param {string} assetPath - Path to the missing asset
 */
function showMissingAsset(assetPath) {
  loadingOverlay.style.display = 'none';
  missingAssetOverlay.style.display = 'flex';
  
  // Update the message with specific asset path
  const messageEl = missingAssetOverlay.querySelector('p');
  if (messageEl) {
    messageEl.innerHTML = `
      Missing asset: <code>${assetPath}</code><br><br>
      To use this avatar creator:
      <ol>
        <li>Export a rigged GLB avatar with morph targets from your 3D software</li>
        <li>Name it <code>base-avatar.glb</code></li>
        <li>Place it in <code>public/avatar-creator/assets/</code></li>
        <li>Optionally add animation GLBs in <code>assets/animations/</code></li>
        <li>Refresh this page</li>
      </ol>
    `;
  }
}

/**
 * Initialize the avatar creator
 */
async function init() {
  console.log('🚀 Initializing Avatar Creator...');

  // Load state from localStorage
  loadFromStorage();

  // Initialize Three.js
  initThreeJS();

  // Show loading
  showLoading();

  try {
    // Load avatar
    console.log(`📦 Loading avatar from: ${AVATAR_GLTF}`);
    const avatarData = await loadAvatar(AVATAR_GLTF);
    
    avatarScene = avatarData.scene;
    mixer = avatarData.mixer;

    // Add avatar to scene
    scene.add(avatarScene);

    // Enable shadow casting on avatar
    avatarScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    console.log('✅ Avatar loaded successfully');

    // Initialize morph system
    morphSystem = initMorphSystem(avatarScene);
    console.log('✅ Morph system initialized');

    // Create UI
    gui = createUI(avatarScene, mixer, morphSystem, renderer, canvas);
    console.log('✅ UI created');

    // Hide loading
    hideLoading();

    console.log('🎉 Avatar Creator ready!');

  } catch (error) {
    console.error('❌ Failed to load avatar:', error);
    showMissingAsset(AVATAR_GLTF);
    
    // Still start animation loop for background
    animate();
    return;
  }

  // Start animation loop
  animate();
}

// Smoke tests
console.assert(typeof THREE !== 'undefined', 'THREE should be defined');
console.assert(typeof OrbitControls !== 'undefined', 'OrbitControls should be defined');
console.assert(typeof GLTFLoader !== 'undefined', 'GLTFLoader should be defined');
console.assert(typeof GUI !== 'undefined', 'GUI should be defined');
console.log('✅ All imports validated');

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Developer TODO:
// 1. Replace assets/base-avatar.glb with your rigged avatar
// 2. Add animation files to assets/animations/ (idle.glb, walk.glb, etc.)
// 3. Adjust MORPH_MAP in assetPaths.js to match your avatar's blendshape names
// 4. Customize presets in presets.js to match your avatar's style options
// 5. Test export PNG functionality with your avatar
