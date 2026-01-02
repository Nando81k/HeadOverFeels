/**
 * Avatar loading utilities - GLB loading with AnimationMixer
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Singleton loader instances (reuse across multiple loads)
let gltfLoader;
let dracoLoader;

/**
 * Initialize loaders (called once)
 */
function initLoaders() {
  if (!gltfLoader) {
    // DRACO loader for compressed geometries
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    dracoLoader.preload();

    // GLTF loader
    gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
    
    console.log('✅ GLTF/DRACO loaders initialized');
  }
}

/**
 * Load avatar GLB file
 * @param {string} path - Path to GLB file
 * @returns {Promise<{scene: THREE.Group, mixer: THREE.AnimationMixer, animations: THREE.AnimationClip[], clips: Map}>}
 */
export async function loadAvatar(path) {
  initLoaders();

  return new Promise((resolve, reject) => {
    console.log(`📂 Loading GLB: ${path}`);

    gltfLoader.load(
      path,
      (gltf) => {
        const avatarScene = gltf.scene;
        const animations = gltf.animations || [];

        // Create animation mixer
        const mixer = new THREE.AnimationMixer(avatarScene);

        // Store clips in a Map for easy access
        const clips = new Map();
        animations.forEach((clip) => {
          const name = clip.name.toLowerCase();
          clips.set(name, clip);
          console.log(`  ├─ Animation found: "${clip.name}" (${clip.duration.toFixed(2)}s)`);
        });

        // Log success info
        console.log(`✅ Avatar loaded successfully`);
        console.log(`  ├─ Meshes: ${countMeshes(avatarScene)}`);
        console.log(`  ├─ Materials: ${countMaterials(avatarScene)}`);
        console.log(`  ├─ Animations: ${animations.length}`);
        console.log(`  └─ Has skeleton: ${hasSkeleton(avatarScene) ? 'Yes' : 'No'}`);

        // Log morph target info
        const morphInfo = getMorphTargetInfo(avatarScene);
        if (morphInfo.totalMorphs > 0) {
          console.log(`  ├─ Morph targets found: ${morphInfo.totalMorphs} across ${morphInfo.meshesWithMorphs} meshes`);
          console.log(`  └─ Available morphs: ${morphInfo.morphNames.join(', ')}`);
        } else {
          console.warn('  ⚠️ No morph targets found in avatar');
        }

        resolve({
          scene: avatarScene,
          mixer,
          animations,
          clips
        });
      },
      (progress) => {
        const percent = (progress.loaded / progress.total) * 100;
        console.log(`  Loading: ${percent.toFixed(0)}%`);
      },
      (error) => {
        console.error(`❌ Failed to load avatar:`, error);
        
        // Provide helpful error messages
        if (error.message.includes('404')) {
          reject(new Error(`Asset not found: ${path}\n\nPlease add your avatar GLB file to this location.`));
        } else if (error.message.includes('parse')) {
          reject(new Error(`Failed to parse GLB file: ${path}\n\nEnsure the file is a valid GLTF 2.0 binary format.`));
        } else {
          reject(new Error(`Failed to load avatar: ${error.message}`));
        }
      }
    );
  });
}

/**
 * Count meshes in scene
 * @param {THREE.Object3D} obj - Root object
 * @returns {number} Mesh count
 */
function countMeshes(obj) {
  let count = 0;
  obj.traverse((child) => {
    if (child.isMesh) count++;
  });
  return count;
}

/**
 * Count unique materials in scene
 * @param {THREE.Object3D} obj - Root object
 * @returns {number} Material count
 */
function countMaterials(obj) {
  const materials = new Set();
  obj.traverse((child) => {
    if (child.isMesh && child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(mat => materials.add(mat.uuid));
      } else {
        materials.add(child.material.uuid);
      }
    }
  });
  return materials.size;
}

/**
 * Check if scene has a skeleton
 * @param {THREE.Object3D} obj - Root object
 * @returns {boolean} True if skeleton found
 */
function hasSkeleton(obj) {
  let found = false;
  obj.traverse((child) => {
    if (child.isSkinnedMesh) found = true;
  });
  return found;
}

/**
 * Get morph target information from scene
 * @param {THREE.Object3D} obj - Root object
 * @returns {{totalMorphs: number, meshesWithMorphs: number, morphNames: string[]}}
 */
function getMorphTargetInfo(obj) {
  const morphNamesSet = new Set();
  let meshesWithMorphs = 0;
  let totalMorphs = 0;

  obj.traverse((child) => {
    if (child.isMesh && child.morphTargetDictionary) {
      const morphDict = child.morphTargetDictionary;
      const morphCount = Object.keys(morphDict).length;
      
      if (morphCount > 0) {
        meshesWithMorphs++;
        totalMorphs += morphCount;
        
        // Collect unique morph names
        Object.keys(morphDict).forEach(name => {
          morphNamesSet.add(name);
        });
      }
    }
  });

  return {
    totalMorphs,
    meshesWithMorphs,
    morphNames: Array.from(morphNamesSet).sort()
  };
}

/**
 * Dispose of loaded avatar resources
 * @param {THREE.Group} avatarScene - Avatar scene to dispose
 */
export function disposeAvatar(avatarScene) {
  if (!avatarScene) return;

  avatarScene.traverse((child) => {
    if (child.isMesh) {
      // Dispose geometry
      if (child.geometry) {
        child.geometry.dispose();
      }

      // Dispose materials
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => disposeMaterial(mat));
        } else {
          disposeMaterial(child.material);
        }
      }
    }
  });

  console.log('🗑️ Avatar resources disposed');
}

/**
 * Dispose of a single material and its textures
 * @param {THREE.Material} material - Material to dispose
 */
function disposeMaterial(material) {
  if (!material) return;

  // Dispose textures
  const textureProps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'];
  textureProps.forEach(prop => {
    if (material[prop]) {
      material[prop].dispose();
    }
  });

  // Dispose material
  material.dispose();
}

// Smoke tests
console.assert(typeof loadAvatar === 'function', 'loadAvatar should be a function');
console.assert(typeof disposeAvatar === 'function', 'disposeAvatar should be a function');
