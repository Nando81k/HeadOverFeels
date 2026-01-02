'use client';

import { useGLTF } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';

interface AvatarModelProps {
  configuration: {
    hair?: string;
    top?: string;
    bottom?: string;
    shoes?: string;
    accessory?: string;
    headwear?: string;
    outerwear?: string;
  };
  skinTone: string;
  bodyType: string;
  gender?: 'male' | 'female';
  faceFeatures?: {
    eyeShape?: string;
    noseShape?: string;
    mouthShape?: string;
    eyebrowShape?: string;
  };
}

export default function AvatarModel({
  configuration,
  skinTone,
  gender = 'male',
  faceFeatures = {},
}: AvatarModelProps) {
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group ref={groupRef} castShadow receiveShadow>
      {/* Base body with gender-specific proportions */}
      <BaseBody skinTone={skinTone} gender={gender} faceFeatures={faceFeatures} />

      {/* Equipped items */}
      {configuration.hair && <AvatarItemModel modelUrl={configuration.hair} />}
      {configuration.top && <AvatarItemModel modelUrl={configuration.top} />}
      {configuration.bottom && <AvatarItemModel modelUrl={configuration.bottom} />}
      {configuration.shoes && <AvatarItemModel modelUrl={configuration.shoes} />}
      {configuration.accessory && <AvatarItemModel modelUrl={configuration.accessory} />}
      {configuration.headwear && <AvatarItemModel modelUrl={configuration.headwear} />}
      {configuration.outerwear && <AvatarItemModel modelUrl={configuration.outerwear} />}
    </group>
  );
}

// Base body component with customizable skin tone and gender-specific proportions
function BaseBody({ 
  skinTone, 
  gender = 'male',
  faceFeatures = {}
}: { 
  skinTone: string;
  gender?: 'male' | 'female';
  faceFeatures?: {
    eyeShape?: string;
    noseShape?: string;
    mouthShape?: string;
    eyebrowShape?: string;
  };
}) {
  // Gender-specific proportions
  const isMale = gender === 'male';
  
  // Body proportions
  const headSize = 0.22;
  const shoulderWidth = isMale ? 0.55 : 0.48;
  const torsoWidth = isMale ? 0.5 : 0.42;
  const hipWidth = isMale ? 0.45 : 0.52;
  const legGap = isMale ? 0.14 : 0.12;
  const bodyHeight = isMale ? 1.0 : 0.95;
  
  // Adjustable heights
  const headY = 1.65 * bodyHeight;
  const neckY = (1.65 - headSize) * bodyHeight;
  const shoulderY = 1.45 * bodyHeight;
  const torsoTopY = 1.25 * bodyHeight;
  const torsoBottomY = 0.75 * bodyHeight;
  const hipY = 0.65 * bodyHeight;
  const thighTop = 0.35 * bodyHeight;
  const kneeY = 0.05 * bodyHeight;
  const ankleY = -0.25 * bodyHeight;
  
  return (
    <group>
      {/* HEAD with facial features */}
      <group position={[0, headY, 0]}>
        {/* Head base - smoother, more organic oval shape */}
        <mesh castShadow receiveShadow scale={[1, 1.15, 0.95]}>
          <sphereGeometry args={[headSize, 32, 32]} />
          <meshStandardMaterial 
            color={skinTone} 
            roughness={0.65} 
            metalness={0.0}
          />
        </mesh>
        
        {/* Facial Features */}
        <FacialFeatures skinTone={skinTone} features={faceFeatures} headSize={headSize} />
      </group>

      {/* NECK - smoother transition */}
      <mesh position={[0, neckY, 0]} castShadow receiveShadow>
        <capsuleGeometry args={[0.085, 0.08, 12, 16]} />
        <meshStandardMaterial color={skinTone} roughness={0.65} />
      </mesh>

      {/* SHOULDERS - rounded deltoids */}
      <group position={[0, shoulderY, 0]}>
        {/* Left Shoulder */}
        <mesh position={[-shoulderWidth * 0.45, 0, 0]} castShadow receiveShadow scale={[1.1, 0.9, 0.9]}>
          <sphereGeometry args={[0.14, 24, 24]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Right Shoulder */}
        <mesh position={[shoulderWidth * 0.45, 0, 0]} castShadow receiveShadow scale={[1.1, 0.9, 0.9]}>
          <sphereGeometry args={[0.14, 24, 24]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
      </group>

      {/* UPPER TORSO - rounded chest/back */}
      <mesh position={[0, torsoTopY, 0]} castShadow receiveShadow scale={[1, 1, 0.85]}>
        <capsuleGeometry args={[torsoWidth * 0.42, 0.35, 16, 32]} />
        <meshStandardMaterial color={skinTone} roughness={0.65} />
      </mesh>

      {/* LOWER TORSO - smooth abdomen */}
      <mesh position={[0, torsoBottomY, 0]} castShadow receiveShadow scale={[1, 1, 0.8]}>
        <capsuleGeometry args={[hipWidth * 0.36, 0.25, 16, 32]} />
        <meshStandardMaterial color={skinTone} roughness={0.65} />
      </mesh>

      {/* HIPS - rounded pelvis */}
      <mesh position={[0, hipY, 0]} castShadow receiveShadow scale={[1, 0.85, 1]}>
        <sphereGeometry args={[hipWidth * 0.52, 24, 24]} />
        <meshStandardMaterial color={skinTone} roughness={0.65} />
      </mesh>

      {/* ARMS - smooth, tapered limbs */}
      <group>
        {/* Left Upper Arm with elbow joint */}
        <mesh position={[-shoulderWidth * 0.5, shoulderY - 0.25, 0]} castShadow receiveShadow rotation={[0, 0, 0.15]}>
          <capsuleGeometry args={[0.075, 0.35, 12, 20]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Left Elbow */}
        <mesh position={[-shoulderWidth * 0.52, shoulderY - 0.48, 0]} castShadow receiveShadow>
          <sphereGeometry args={[0.08, 20, 20]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Right Upper Arm with elbow joint */}
        <mesh position={[shoulderWidth * 0.5, shoulderY - 0.25, 0]} castShadow receiveShadow rotation={[0, 0, -0.15]}>
          <capsuleGeometry args={[0.075, 0.35, 12, 20]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Right Elbow */}
        <mesh position={[shoulderWidth * 0.52, shoulderY - 0.48, 0]} castShadow receiveShadow>
          <sphereGeometry args={[0.08, 20, 20]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Left Forearm */}
        <mesh position={[-shoulderWidth * 0.55, shoulderY - 0.68, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[0.065, 0.32, 12, 20]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Right Forearm */}
        <mesh position={[shoulderWidth * 0.55, shoulderY - 0.68, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[0.065, 0.32, 12, 20]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Left Wrist */}
        <mesh position={[-shoulderWidth * 0.55, shoulderY - 0.85, 0]} castShadow receiveShadow>
          <sphereGeometry args={[0.07, 20, 20]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Right Wrist */}
        <mesh position={[shoulderWidth * 0.55, shoulderY - 0.85, 0]} castShadow receiveShadow>
          <sphereGeometry args={[0.07, 20, 20]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Left Hand - more organic shape */}
        <mesh position={[-shoulderWidth * 0.55, shoulderY - 0.95, 0.02]} castShadow receiveShadow scale={[1, 1.2, 0.6]}>
          <sphereGeometry args={[0.09, 20, 20]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Right Hand - more organic shape */}
        <mesh position={[shoulderWidth * 0.55, shoulderY - 0.95, 0.02]} castShadow receiveShadow scale={[1, 1.2, 0.6]}>
          <sphereGeometry args={[0.09, 20, 20]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
      </group>

      {/* LEGS - smooth, natural shape */}
      <group>
        {/* Left Thigh */}
        <mesh position={[-legGap, thighTop, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[0.105, 0.48, 14, 24]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Left Knee */}
        <mesh position={[-legGap, thighTop - 0.28, 0]} castShadow receiveShadow scale={[1, 1.1, 1]}>
          <sphereGeometry args={[0.11, 20, 20]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Right Thigh */}
        <mesh position={[legGap, thighTop, 0]} castShadow receiveShadow>
          <capsuleGeometry args={[0.105, 0.48, 14, 24]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Right Knee */}
        <mesh position={[legGap, thighTop - 0.28, 0]} castShadow receiveShadow scale={[1, 1.1, 1]}>
          <sphereGeometry args={[0.11, 20, 20]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Left Shin - tapered for calf muscle */}
        <mesh position={[-legGap, kneeY + 0.03, 0]} castShadow receiveShadow scale={[1, 1, 0.95]}>
          <capsuleGeometry args={[0.085, 0.42, 14, 24]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Right Shin - tapered for calf muscle */}
        <mesh position={[legGap, kneeY + 0.03, 0]} castShadow receiveShadow scale={[1, 1, 0.95]}>
          <capsuleGeometry args={[0.085, 0.42, 14, 24]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Left Ankle */}
        <mesh position={[-legGap, ankleY + 0.08, 0]} castShadow receiveShadow>
          <sphereGeometry args={[0.088, 20, 20]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Right Ankle */}
        <mesh position={[legGap, ankleY + 0.08, 0]} castShadow receiveShadow>
          <sphereGeometry args={[0.088, 20, 20]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Left Foot - rounded, more natural */}
        <mesh position={[-legGap, ankleY, 0.08]} castShadow receiveShadow scale={[0.9, 0.7, 1.4]} rotation={[0.1, 0, 0]}>
          <sphereGeometry args={[0.12, 20, 20]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
        
        {/* Right Foot - rounded, more natural */}
        <mesh position={[legGap, ankleY, 0.08]} castShadow receiveShadow scale={[0.9, 0.7, 1.4]} rotation={[0.1, 0, 0]}>
          <sphereGeometry args={[0.12, 20, 20]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>
      </group>

      {/* Ground shadow plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]} receiveShadow>
        <circleGeometry args={[2, 32]} />
        <meshStandardMaterial 
          color="#1a1a1a" 
          transparent 
          opacity={0.1}
          roughness={1}
        />
      </mesh>
    </group>
  );
}

// Facial Features Component
function FacialFeatures({ 
  skinTone, 
  features = {},
  headSize 
}: { 
  skinTone: string;
  features?: {
    eyeShape?: string;
    noseShape?: string;
    mouthShape?: string;
    eyebrowShape?: string;
  };
  headSize: number;
}) {
  const darkerSkin = new THREE.Color(skinTone).multiplyScalar(0.7).getHexString();
  
  // Feature variations (to be implemented)
  const eyeShape = features.eyeShape || 'round';
  const noseShape = features.noseShape || 'medium';
  const mouthShape = features.mouthShape || 'smile';
  const eyebrowShape = features.eyebrowShape || 'normal';
  
  // Eye size variations
  const eyeSize = eyeShape === 'wide' ? 0.05 : eyeShape === 'almond' ? 0.04 : 0.04;
  
  // Nose height variations
  const noseHeight = noseShape === 'large' ? 0.10 : noseShape === 'small' ? 0.06 : 0.08;
  
  // Eyebrow thickness
  const eyebrowThickness = eyebrowShape === 'thick' ? 0.025 : eyebrowShape === 'thin' ? 0.010 : 0.015;
  
  return (
    <group>
      {/* EYES - more realistic with iris detail */}
      <group position={[0, 0.03, headSize * 0.85]}>
        {/* Left Eye Socket depth */}
        <mesh position={[-0.08, 0, -0.01]} castShadow>
          <sphereGeometry args={[0.045, 20, 20]} />
          <meshStandardMaterial color={`#${darkerSkin}`} roughness={0.75} />
        </mesh>
        
        {/* Left Eye White */}
        <mesh position={[-0.08, 0, 0]} castShadow>
          <sphereGeometry args={[eyeSize, 20, 20]} />
          <meshStandardMaterial color="#ffffff" roughness={0.2} />
        </mesh>
        
        {/* Left Iris (colored ring) */}
        <mesh position={[-0.08, 0, eyeSize * 0.70]} castShadow>
          <sphereGeometry args={[eyeSize * 0.75, 20, 20]} />
          <meshStandardMaterial color="#4A5F7F" roughness={0.3} />
        </mesh>
        
        {/* Left Pupil */}
        <mesh position={[-0.08, 0, eyeSize * 0.80]} castShadow>
          <sphereGeometry args={[eyeSize * 0.45, 20, 20]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.1} />
        </mesh>
        
        {/* Right Eye Socket depth */}
        <mesh position={[0.08, 0, -0.01]} castShadow>
          <sphereGeometry args={[0.045, 20, 20]} />
          <meshStandardMaterial color={`#${darkerSkin}`} roughness={0.75} />
        </mesh>
        
        {/* Right Eye White */}
        <mesh position={[0.08, 0, 0]} castShadow>
          <sphereGeometry args={[eyeSize, 20, 20]} />
          <meshStandardMaterial color="#ffffff" roughness={0.2} />
        </mesh>
        
        {/* Right Iris (colored ring) */}
        <mesh position={[0.08, 0, eyeSize * 0.70]} castShadow>
          <sphereGeometry args={[eyeSize * 0.75, 20, 20]} />
          <meshStandardMaterial color="#4A5F7F" roughness={0.3} />
        </mesh>
        
        {/* Right Pupil */}
        <mesh position={[0.08, 0, eyeSize * 0.80]} castShadow>
          <sphereGeometry args={[eyeSize * 0.45, 20, 20]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.1} />
        </mesh>
      </group>

      {/* EYEBROWS - more natural shape */}
      <group position={[0, 0.09, headSize * 0.78]}>
        {/* Left Eyebrow - curved */}
        <mesh position={[-0.08, 0, 0]} castShadow rotation={[0, 0, -0.1]}>
          <capsuleGeometry args={[eyebrowThickness * 0.8, 0.07, 8, 12]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.85} />
        </mesh>
        
        {/* Right Eyebrow - curved */}
        <mesh position={[0.08, 0, 0]} castShadow rotation={[0, 0, 0.1]}>
          <capsuleGeometry args={[eyebrowThickness * 0.8, 0.07, 8, 12]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.85} />
        </mesh>
      </group>

      {/* NOSE - more natural bridge and tip */}
      <group position={[0, -0.02, headSize * 0.88]}>
        {/* Nose bridge */}
        <mesh position={[0, 0.03, 0]} castShadow scale={[0.6, 1, 0.6]}>
          <capsuleGeometry args={[0.025, noseHeight * 0.5, 8, 12]} />
          <meshStandardMaterial color={`#${darkerSkin}`} roughness={0.7} />
        </mesh>
        
        {/* Nose tip - rounded */}
        <mesh position={[0, -0.02, 0.02]} castShadow scale={[1.2, 0.9, 1]}>
          <sphereGeometry args={[0.038, 16, 16]} />
          <meshStandardMaterial color={skinTone} roughness={0.7} />
        </mesh>
        
        {/* Left nostril */}
        <mesh position={[-0.022, -0.03, 0.015]} scale={[0.8, 1, 1]}>
          <sphereGeometry args={[0.012, 12, 12]} />
          <meshStandardMaterial color={`#${darkerSkin}`} roughness={0.8} />
        </mesh>
        
        {/* Right nostril */}
        <mesh position={[0.022, -0.03, 0.015]} scale={[0.8, 1, 1]}>
          <sphereGeometry args={[0.012, 12, 12]} />
          <meshStandardMaterial color={`#${darkerSkin}`} roughness={0.8} />
        </mesh>
      </group>

      {/* MOUTH - more organic lips */}
      <group position={[0, -0.08, headSize * 0.86]}>
        {mouthShape === 'smile' && (
          <>
            {/* Upper lip */}
            <mesh position={[0, 0.008, 0]} scale={[1.4, 0.5, 0.8]} rotation={[0.2, 0, 0]}>
              <capsuleGeometry args={[0.04, 0.06, 8, 16]} />
              <meshStandardMaterial color="#9b5555" roughness={0.5} />
            </mesh>
            {/* Lower lip - fuller */}
            <mesh position={[0, -0.008, 0.005]} scale={[1.5, 0.6, 0.9]} rotation={[-0.2, 0, 0]}>
              <capsuleGeometry args={[0.045, 0.055, 8, 16]} />
              <meshStandardMaterial color="#a85f5f" roughness={0.4} />
            </mesh>
          </>
        )}
        {mouthShape === 'neutral' && (
          <>
            {/* Upper lip */}
            <mesh position={[0, 0.006, 0]} scale={[1.2, 0.45, 0.7]}>
              <capsuleGeometry args={[0.035, 0.05, 8, 16]} />
              <meshStandardMaterial color="#9b5555" roughness={0.5} />
            </mesh>
            {/* Lower lip */}
            <mesh position={[0, -0.006, 0.004]} scale={[1.25, 0.5, 0.75]}>
              <capsuleGeometry args={[0.038, 0.048, 8, 16]} />
              <meshStandardMaterial color="#a85f5f" roughness={0.4} />
            </mesh>
          </>
        )}
        {mouthShape === 'full' && (
          <>
            {/* Upper lip - fuller */}
            <mesh position={[0, 0.01, 0]} scale={[1.6, 0.6, 0.85]} rotation={[0.25, 0, 0]}>
              <capsuleGeometry args={[0.045, 0.07, 8, 16]} />
              <meshStandardMaterial color="#9b5555" roughness={0.5} />
            </mesh>
            {/* Lower lip - very full */}
            <mesh position={[0, -0.01, 0.006]} scale={[1.65, 0.7, 1]} rotation={[-0.25, 0, 0]}>
              <capsuleGeometry args={[0.050, 0.065, 8, 16]} />
              <meshStandardMaterial color="#a85f5f" roughness={0.4} />
            </mesh>
          </>
        )}
      </group>

      {/* EARS - More organic with inner detail */}
      <group>
        {/* Left Ear outer */}
        <mesh position={[-headSize * 0.95, 0, 0]} rotation={[0, -Math.PI / 6, -0.3]} castShadow scale={[0.9, 1.1, 0.6]}>
          <sphereGeometry args={[0.065, 20, 20]} />
          <meshStandardMaterial color={skinTone} roughness={0.7} />
        </mesh>
        
        {/* Left Ear inner detail */}
        <mesh position={[-headSize * 0.88, 0, 0]} rotation={[0, -Math.PI / 4, -0.2]} scale={[0.5, 0.7, 0.5]}>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshStandardMaterial color={skinTone} roughness={0.8} />
        </mesh>
        
        {/* Right Ear outer */}
        <mesh position={[headSize * 0.95, 0, 0]} rotation={[0, Math.PI / 6, 0.3]} castShadow scale={[0.9, 1.1, 0.6]}>
          <sphereGeometry args={[0.065, 20, 20]} />
          <meshStandardMaterial color={skinTone} roughness={0.7} />
        </mesh>
        
        {/* Right Ear inner detail */}
        <mesh position={[headSize * 0.88, 0, 0]} rotation={[0, Math.PI / 4, 0.2]} scale={[0.5, 0.7, 0.5]}>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshStandardMaterial color={skinTone} roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

// Component to load and render individual avatar items
function AvatarItemModel({ modelUrl }: { modelUrl: string }) {
  // Load the GLTF model - hooks must be called at top level
  let scene;
  try {
    const gltf = useGLTF(modelUrl);
    scene = gltf.scene;
  } catch (error) {
    console.error('Error loading avatar item model:', modelUrl, error);
    return null;
  }

  if (!scene) {
    console.warn('Avatar item scene not loaded:', modelUrl);
    return null;
  }

  // Clone the scene to allow multiple instances
  const clonedScene = scene.clone();

  // Ensure all meshes in the model cast and receive shadows
  clonedScene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      
      // Enhance materials for better rendering
      const mesh = child as THREE.Mesh;
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => {
            if (mat instanceof THREE.MeshStandardMaterial) {
              mat.envMapIntensity = 1;
              mat.needsUpdate = true;
            }
          });
        } else if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.envMapIntensity = 1;
          mesh.material.needsUpdate = true;
        }
      }
    }
  });

  return <primitive object={clonedScene} />;
}

// Preload common models
useGLTF.preload('/models/avatar/base-avatar.glb');
