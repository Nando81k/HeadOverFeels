'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows } from '@react-three/drei';
import { Suspense } from 'react';
import AnimeAvatar from './AnimeAvatar';

interface AvatarCanvasProps {
  configuration?: Record<string, unknown>; // Full wizard config
  skinTone?: string;
  bodyType?: string;
  gender?: 'male' | 'female';
  faceFeatures?: Record<string, unknown>; // Full wizard config  
  interactive?: boolean;
  className?: string;
}

// Loading placeholder component
function LoadingAvatar() {
  return (
    <mesh position={[0, 1, 0]}>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial color="#cccccc" wireframe />
    </mesh>
  );
}

export default function AvatarCanvas({
  configuration = {},
  skinTone = '#FFE0BD',
  gender = 'male',
  faceFeatures = {},
  interactive = true,
  className = 'w-full h-full',
}: AvatarCanvasProps) {
  // Merge faceFeatures and configuration into single config object
  const fullConfig = {
    ...configuration,
    ...(typeof faceFeatures === 'string' ? JSON.parse(faceFeatures) : faceFeatures),
  };
  
  return (
    <div className={className}>
      <Canvas 
        shadows 
        dpr={[1, 2]}
        camera={{ position: [0, 1.2, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Camera setup for better framing */}
        <PerspectiveCamera makeDefault position={[0, 1.2, 3]} fov={50} />
        
        {/* Professional lighting setup */}
        <ambientLight intensity={0.4} />
        
        {/* Main key light */}
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
          shadow-camera-near={0.1}
          shadow-camera-far={50}
          shadow-bias={-0.0001}
        />
        
        {/* Fill light */}
        <directionalLight
          position={[-3, 4, -5]}
          intensity={0.4}
        />
        
        {/* Rim light for depth */}
        <pointLight 
          position={[0, 3, -3]} 
          intensity={0.5} 
          color="#ffffff"
        />
        
        {/* Subtle colored accent lights */}
        <pointLight 
          position={[3, 1, 2]} 
          intensity={0.3} 
          color="#4a90e2"
        />
        <pointLight 
          position={[-3, 1, 2]} 
          intensity={0.3} 
          color="#e24a90"
        />
        
        {/* Environment for realistic reflections */}
        <Environment preset="city" />
        
        {/* Anime Avatar with loading fallback */}
        <Suspense fallback={<LoadingAvatar />}>
          <AnimeAvatar
            skinTone={skinTone}
            gender={gender}
            config={fullConfig}
          />
        </Suspense>
        
        {/* Realistic contact shadows */}
        <ContactShadows
          position={[0, -0.4, 0]}
          opacity={0.4}
          scale={2}
          blur={2}
          far={4}
        />
        
        {/* Interactive controls */}
        {interactive && (
          <OrbitControls
            enableZoom={true}
            enablePan={false}
            minDistance={2}
            maxDistance={5}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.2}
            target={[0, 0.8, 0]}
            autoRotate={false}
            autoRotateSpeed={0.5}
            enableDamping={true}
            dampingFactor={0.05}
            rotateSpeed={0.8}
          />
        )}
      </Canvas>
    </div>
  );
}
