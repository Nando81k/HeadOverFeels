'use client';

interface AnimeAvatarProps {
  skinTone: string;
  gender: 'male' | 'female';
  config: {
    // Face
    faceShape?: string;
    eyeStyle?: string;
    eyeColor?: string;
    eyebrowStyle?: string;
    noseStyle?: string;
    mouthStyle?: string;
    lipColor?: string;
    
    // Hair
    hairStyle?: string;
    hairColor?: string;
    
    // Facial Hair
    facialHair?: string;
    facialHairColor?: string;
    
    // Accessories
    glasses?: string;
    earrings?: string;
    
    // Age
    age?: string;
  };
}

// Anime proportions: larger head, bigger eyes, smaller features
function AnimeHead({ skinTone, config, gender }: { skinTone: string; config: AnimeAvatarProps['config']; gender: 'male' | 'female' }) {
  // Anime proportions - larger head (0.35 vs 0.22)
  const headSize = config.age === 'child' ? 0.40 : 
                   config.age === 'teen' ? 0.37 :
                   config.age === 'elder' ? 0.33 : 0.35;
  
  // Face shape affects head geometry
  const faceWidth = config.faceShape === 'round' ? 1.1 :
                    config.faceShape === 'square' ? 1.05 :
                    config.faceShape === 'heart' ? 1.0 :
                    config.faceShape === 'diamond' ? 0.95 :
                    config.faceShape === 'triangle' ? 0.90 : 1.0; // oval default
  
  const faceHeight = config.faceShape === 'round' ? 0.95 :
                     config.faceShape === 'square' ? 1.0 :
                     config.faceShape === 'heart' ? 1.05 :
                     config.faceShape === 'oval' ? 1.1 : 1.0;

  return (
    <group position={[0, 1.3, 0]}>
      {/* HEAD - Anime style with face shape */}
      <mesh castShadow scale={[faceWidth, faceHeight, 0.95]}>
        <sphereGeometry args={[headSize, 64, 64]} />
        <meshToonMaterial color={skinTone} />
      </mesh>
      
      {/* ANIME EYES - Much larger and more expressive */}
      <AnimeEyes config={config} headSize={headSize} />
      
      {/* EYEBROWS */}
      <AnimeEyebrows config={config} headSize={headSize} />
      
      {/* NOSE - Smaller anime style */}
      <AnimeNose config={config} skinTone={skinTone} headSize={headSize} />
      
      {/* MOUTH - Anime style */}
      <AnimeMouth config={config} headSize={headSize} />
      
      {/* EARS */}
      <group>
        {/* Left Ear */}
        <mesh position={[-headSize * 0.95, 0, 0]} rotation={[0, -Math.PI / 6, -0.3]} castShadow scale={[0.7, 0.9, 0.5]}>
          <sphereGeometry args={[0.08, 20, 20]} />
          <meshToonMaterial color={skinTone} />
        </mesh>
        
        {/* Right Ear */}
        <mesh position={[headSize * 0.95, 0, 0]} rotation={[0, Math.PI / 6, 0.3]} castShadow scale={[0.7, 0.9, 0.5]}>
          <sphereGeometry args={[0.08, 20, 20]} />
          <meshToonMaterial color={skinTone} />
        </mesh>
      </group>
      
      {/* HAIR */}
      <AnimeHair config={config} gender={gender} headSize={headSize} />
      
      {/* FACIAL HAIR */}
      {gender === 'male' && config.facialHair && config.facialHair !== 'none' && (
        <FacialHair style={config.facialHair} color={config.facialHairColor || config.hairColor || '#3d2817'} headSize={headSize} />
      )}
      
      {/* ACCESSORIES */}
      {config.glasses && config.glasses !== 'none' && (
        <Glasses style={config.glasses} headSize={headSize} />
      )}
      
      {config.earrings && config.earrings !== 'none' && (
        <Earrings style={config.earrings} headSize={headSize} />
      )}
    </group>
  );
}

// Anime eyes - large and expressive
function AnimeEyes({ config, headSize }: { config: AnimeAvatarProps['config']; headSize: number }) {
  const eyeColor = config.eyeColor || 'brown';
  const eyeStyle = config.eyeStyle || 'almond';
  
  const eyeColors: Record<string, string> = {
    brown: '#4A3728',
    hazel: '#8B7355',
    green: '#2E8B57',
    blue: '#4169E1',
    gray: '#708090',
    amber: '#FFBF00',
    violet: '#8B00FF',
  };
  
  const irisColor = eyeColors[eyeColor] || eyeColors.brown;
  
  // Eye size based on style - anime eyes are BIG
  const eyeSize = eyeStyle === 'large' ? 0.045 :
                  eyeStyle === 'small' ? 0.030 : 0.038;
  
  const eyeSpacing = eyeStyle === 'wide' ? 0.12 :
                     eyeStyle === 'close' ? 0.08 : 0.10;
  
  const eyeHeight = eyeStyle === 'upturned' ? 0.08 :
                    eyeStyle === 'downturned' ? 0.04 : 0.06;
  
  const eyeScale = eyeStyle === 'round' ? [1, 1, 1] :
                   eyeStyle === 'almond' ? [0.9, 1.1, 1] :
                   eyeStyle === 'wide' ? [1.2, 0.9, 1] : [1, 1, 1];

  return (
    <>
      {/* LEFT EYE */}
      <group position={[-eyeSpacing, eyeHeight, headSize * 0.75]}>
        {/* White of eye - larger */}
        <mesh castShadow scale={eyeScale as [number, number, number]}>
          <sphereGeometry args={[eyeSize, 32, 32]} />
          <meshToonMaterial color="#ffffff" />
        </mesh>
        
        {/* Iris - colorful and large */}
        <mesh position={[0, 0, eyeSize * 0.6]} scale={eyeScale as [number, number, number]}>
          <sphereGeometry args={[eyeSize * 0.65, 24, 24]} />
          <meshToonMaterial color={irisColor} />
        </mesh>
        
        {/* Pupil - for depth */}
        <mesh position={[0, 0, eyeSize * 0.9]} scale={eyeScale as [number, number, number]}>
          <sphereGeometry args={[eyeSize * 0.35, 16, 16]} />
          <meshToonMaterial color="#000000" />
        </mesh>
        
        {/* Highlight - anime sparkle */}
        <mesh position={[eyeSize * 0.3, eyeSize * 0.3, eyeSize * 1.1]} scale={eyeScale as [number, number, number]}>
          <sphereGeometry args={[eyeSize * 0.15, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
      
      {/* RIGHT EYE */}
      <group position={[eyeSpacing, eyeHeight, headSize * 0.75]}>
        <mesh castShadow scale={eyeScale as [number, number, number]}>
          <sphereGeometry args={[eyeSize, 32, 32]} />
          <meshToonMaterial color="#ffffff" />
        </mesh>
        
        <mesh position={[0, 0, eyeSize * 0.6]} scale={eyeScale as [number, number, number]}>
          <sphereGeometry args={[eyeSize * 0.65, 24, 24]} />
          <meshToonMaterial color={irisColor} />
        </mesh>
        
        <mesh position={[0, 0, eyeSize * 0.9]} scale={eyeScale as [number, number, number]}>
          <sphereGeometry args={[eyeSize * 0.35, 16, 16]} />
          <meshToonMaterial color="#000000" />
        </mesh>
        
        <mesh position={[eyeSize * 0.3, eyeSize * 0.3, eyeSize * 1.1]} scale={eyeScale as [number, number, number]}>
          <sphereGeometry args={[eyeSize * 0.15, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
    </>
  );
}

// Anime eyebrows
function AnimeEyebrows({ config, headSize }: { config: AnimeAvatarProps['config']; headSize: number }) {
  const style = config.eyebrowStyle || 'normal';
  
  const thickness = style === 'thin' ? 0.008 :
                    style === 'thick' || style === 'bushy' ? 0.015 : 0.011;
  
  const arch = style === 'arched' ? 0.15 :
               style === 'straight' ? 0 :
               style === 'angled' ? 0.2 : 0.1;
  
  const browColor = config.hairColor ? 
    (config.hairColor === '#1a1a1a' ? '#1a1a1a' : // black
     config.hairColor === '#3d2817' ? '#3d2817' : // dark brown
     '#4A3728') : '#4A3728'; // default brown

  return (
    <>
      {/* Left Eyebrow */}
      <mesh position={[-0.10, 0.12, headSize * 0.75]} rotation={[0, 0, arch]} castShadow>
        <capsuleGeometry args={[thickness, 0.08, 8, 16]} />
        <meshToonMaterial color={browColor} />
      </mesh>
      
      {/* Right Eyebrow */}
      <mesh position={[0.10, 0.12, headSize * 0.75]} rotation={[0, 0, -arch]} castShadow>
        <capsuleGeometry args={[thickness, 0.08, 8, 16]} />
        <meshToonMaterial color={browColor} />
      </mesh>
    </>
  );
}

// Anime nose - very small and simple
function AnimeNose({ config, skinTone, headSize }: { config: AnimeAvatarProps['config']; skinTone: string; headSize: number }) {
  const style = config.noseStyle || 'medium';
  
  const noseSize = style === 'small' || style === 'button' ? 0.015 :
                   style === 'large' || style === 'roman' ? 0.025 : 0.020;
  
  // Anime noses are just subtle highlights/shadows in many styles
  return (
    <mesh position={[0, 0.02, headSize * 0.80]} castShadow rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[noseSize * 0.8, noseSize, 0.04, 16]} />
      <meshToonMaterial color={skinTone} />
    </mesh>
  );
}

// Anime mouth
function AnimeMouth({ config, headSize }: { config: AnimeAvatarProps['config']; headSize: number }) {
  const style = config.mouthStyle || 'smile';
  const lipColor = config.lipColor || 'natural';
  
  const lipColors: Record<string, string> = {
    natural: '#ff6b9d',
    nude: '#d4a59a',
    pink: '#ff69b4',
    red: '#dc143c',
    berry: '#8b008b',
    coral: '#ff7f50',
  };
  
  const color = lipColors[lipColor] || lipColors.natural;
  
  const mouthWidth = style === 'wide' ? 0.10 :
                     style === 'small' ? 0.05 : 0.07;
  
  const mouthHeight = style === 'full' || style === 'pouty' ? 0.012 :
                      style === 'thin' ? 0.006 : 0.009;
  
  const mouthCurve = style === 'smile' ? 0.15 : 0;

  return (
    <mesh position={[0, -0.08, headSize * 0.78]} rotation={[0, 0, mouthCurve]} castShadow>
      <capsuleGeometry args={[mouthHeight, mouthWidth, 12, 16]} />
      <meshToonMaterial color={color} />
    </mesh>
  );
}

// Anime hair styles
function AnimeHair({ config, gender, headSize }: { config: AnimeAvatarProps['config']; gender: 'male' | 'female'; headSize: number }) {
  const style = config.hairStyle || (gender === 'male' ? 'short' : 'medium');
  const hairColor = config.hairColor || '#6f4e37'; // brown default
  
  const hairColors: Record<string, string> = {
    black: '#1a1a1a',
    darkBrown: '#3d2817',
    brown: '#6f4e37',
    lightBrown: '#a0826d',
    blonde: '#f4e7c3',
    platinumBlonde: '#e8dcc0',
    red: '#b55239',
    auburn: '#a52a2a',
    strawberryBlonde: '#ff9966',
    gray: '#808080',
    white: '#f5f5f5',
    blue: '#4169e1',
    pink: '#ff69b4',
    purple: '#800080',
    green: '#228b22',
  };
  
  const color = hairColors[hairColor] || hairColor;
  
  // Render based on style
  if (style === 'bald') return null;
  
  return (
    <group>
      {/* Male hair styles */}
      {gender === 'male' && (
        <>
          {style === 'buzzcut' && <BuzzCut color={color} headSize={headSize} />}
          {style === 'short' && <ShortHair color={color} headSize={headSize} />}
          {style === 'spiky' && <SpikyHair color={color} headSize={headSize} />}
          {style === 'medium' && <MediumHair color={color} headSize={headSize} />}
          {style === 'long' && <LongHair color={color} headSize={headSize} gender="male" />}
          {style === 'curly' && <CurlyHair color={color} headSize={headSize} />}
          {style === 'wavy' && <WavyHair color={color} headSize={headSize} />}
          {style === 'fade' && <FadeHair color={color} headSize={headSize} />}
          {style === 'undercut' && <UndercutHair color={color} headSize={headSize} />}
          {style === 'pompadour' && <PompadourHair color={color} headSize={headSize} />}
          {style === 'quiff' && <QuiffHair color={color} headSize={headSize} />}
        </>
      )}
      
      {/* Female hair styles */}
      {gender === 'female' && (
        <>
          {style === 'pixie' && <PixieCut color={color} headSize={headSize} />}
          {style === 'bob' && <BobHair color={color} headSize={headSize} />}
          {style === 'lob' && <LobHair color={color} headSize={headSize} />}
          {style === 'medium' && <MediumHairFemale color={color} headSize={headSize} />}
          {style === 'long' && <LongHair color={color} headSize={headSize} gender="female" />}
          {style === 'straight' && <StraightHair color={color} headSize={headSize} />}
          {style === 'wavy' && <WavyHairFemale color={color} headSize={headSize} />}
          {style === 'curly' && <CurlyHairFemale color={color} headSize={headSize} />}
          {style === 'ponytail' && <Ponytail color={color} headSize={headSize} />}
          {style === 'bun' && <BunHair color={color} headSize={headSize} />}
          {style === 'braids' && <BraidsHair color={color} headSize={headSize} />}
          {style === 'bangs' && <BangsHair color={color} headSize={headSize} />}
        </>
      )}
    </group>
  );
}

// Hair style components - Male
function BuzzCut({ color, headSize }: { color: string; headSize: number }) {
  return (
    <mesh position={[0, 0.02, 0]} scale={[1, 1.05, 1]}>
      <sphereGeometry args={[headSize * 1.02, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
      <meshToonMaterial color={color} />
    </mesh>
  );
}

function ShortHair({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} scale={[1.02, 1.08, 1.02]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Bangs */}
      <mesh position={[0, 0.05, headSize * 0.85]} scale={[1.2, 0.5, 0.8]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
    </group>
  );
}

function SpikyHair({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} scale={[1.02, 1.08, 1.02]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Spikes */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        const x = Math.sin(angle) * 0.12;
        const z = Math.cos(angle) * 0.12;
        return (
          <mesh key={i} position={[x, 0.25, z]} rotation={[angle, 0, 0]}>
            <coneGeometry args={[0.025, 0.12, 8]} />
            <meshToonMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}

function MediumHair({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} scale={[1.05, 1.12, 1.05]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.75]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Sides hanging down */}
      <mesh position={[-headSize * 0.9, -0.10, 0]}>
        <capsuleGeometry args={[0.04, 0.25, 8, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh position={[headSize * 0.9, -0.10, 0]}>
        <capsuleGeometry args={[0.04, 0.25, 8, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
    </group>
  );
}

function LongHair({ color, headSize, gender }: { color: string; headSize: number; gender: 'male' | 'female' }) {
  const length = gender === 'female' ? 0.5 : 0.35;
  return (
    <group>
      <mesh position={[0, 0.03, 0]} scale={[1.05, 1.12, 1.05]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.75]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Long flowing hair */}
      <mesh position={[0, -length/2, -headSize * 0.5]}>
        <cylinderGeometry args={[0.12, 0.15, length, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
    </group>
  );
}

function CurlyHair({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      {/* Base */}
      <mesh position={[0, 0.05, 0]} scale={[1.15, 1.20, 1.15]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Curls */}
      {[...Array(12)].map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const x = Math.sin(angle) * headSize * 0.95;
        const z = Math.cos(angle) * headSize * 0.95;
        const y = 0.08 + (i % 3) * 0.03; // Deterministic instead of random
        return (
          <mesh key={i} position={[x, y, z]} scale={[0.8, 1.2, 0.8]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshToonMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}

function WavyHair({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} scale={[1.05, 1.12, 1.05]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Wavy sections */}
      <mesh position={[-headSize * 0.8, -0.05, 0]}>
        <capsuleGeometry args={[0.05, 0.20, 8, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh position={[headSize * 0.8, -0.05, 0]}>
        <capsuleGeometry args={[0.05, 0.20, 8, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
    </group>
  );
}

function FadeHair({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      {/* Top longer */}
      <mesh position={[0, 0.08, 0]} scale={[0.95, 1.15, 0.95]}>
        <sphereGeometry args={[headSize * 0.85, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Sides very short */}
      <mesh position={[0, -0.02, 0]} scale={[1.01, 1.05, 1.01]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.3]} />
        <meshToonMaterial color={color} opacity={0.7} transparent />
      </mesh>
    </group>
  );
}

function UndercutHair({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      {/* Long top */}
      <mesh position={[0, 0.12, 0]} scale={[0.9, 1.2, 1.0]}>
        <boxGeometry args={[headSize * 1.5, 0.12, headSize * 1.3]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Very short sides */}
      <mesh position={[0, -0.02, 0]} scale={[1.01, 1.02, 1.01]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.3]} />
        <meshToonMaterial color={color} opacity={0.5} transparent />
      </mesh>
    </group>
  );
}

function PompadourHair({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} scale={[1.02, 1.08, 1.02]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* High front */}
      <mesh position={[0, 0.20, headSize * 0.6]} rotation={[-0.3, 0, 0]} scale={[1.1, 1.5, 0.8]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
    </group>
  );
}

function QuiffHair({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} scale={[1.02, 1.08, 1.02]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Front quiff */}
      <mesh position={[0, 0.15, headSize * 0.7]} rotation={[-0.4, 0, 0]}>
        <sphereGeometry args={[0.10, 16, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
    </group>
  );
}

// Female hair styles
function PixieCut({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} scale={[1.03, 1.09, 1.03]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Short side swept bangs */}
      <mesh position={[0.08, 0.08, headSize * 0.80]} scale={[1.5, 0.6, 0.8]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
    </group>
  );
}

function BobHair({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} scale={[1.08, 1.10, 1.05]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.75]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Bob shape - chin length */}
      <mesh position={[0, -0.15, -headSize * 0.3]} scale={[1.3, 0.8, 1]}>
        <sphereGeometry args={[0.15, 24, 24]} />
        <meshToonMaterial color={color} />
      </mesh>
    </group>
  );
}

function LobHair({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} scale={[1.08, 1.12, 1.05]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.75]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Long bob - shoulder length */}
      <mesh position={[-headSize * 0.85, -0.25, 0]}>
        <capsuleGeometry args={[0.05, 0.30, 8, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh position={[headSize * 0.85, -0.25, 0]}>
        <capsuleGeometry args={[0.05, 0.30, 8, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
    </group>
  );
}

function MediumHairFemale({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} scale={[1.08, 1.12, 1.08]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.75]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Medium length sides */}
      <mesh position={[-headSize * 0.90, -0.20, 0]}>
        <capsuleGeometry args={[0.06, 0.35, 8, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
      <mesh position={[headSize * 0.90, -0.20, 0]}>
        <capsuleGeometry args={[0.06, 0.35, 8, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Back */}
      <mesh position={[0, -0.20, -headSize * 0.80]}>
        <cylinderGeometry args={[0.10, 0.12, 0.35, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
    </group>
  );
}

function StraightHair({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} scale={[1.05, 1.10, 1.05]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.75]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Straight long hair */}
      <mesh position={[0, -0.30, -headSize * 0.6]}>
        <cylinderGeometry args={[0.11, 0.14, 0.50, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
    </group>
  );
}

function WavyHairFemale({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} scale={[1.08, 1.12, 1.08]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.75]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Wavy sections */}
      {[...Array(6)].map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const x = Math.sin(angle) * headSize * 0.85;
        const z = Math.cos(angle) * headSize * 0.85;
        return (
          <mesh key={i} position={[x, -0.25, z]}>
            <capsuleGeometry args={[0.04, 0.35, 8, 16]} />
            <meshToonMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}

function CurlyHairFemale({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      <mesh position={[0, 0.05, 0]} scale={[1.18, 1.25, 1.18]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.75]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Big curls all around */}
      {[...Array(16)].map((_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const radius = headSize * 0.95 + (i % 2) * 0.08;
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;
        const y = 0.05 + (i % 3) * 0.08;
        return (
          <mesh key={i} position={[x, y, z]} scale={[0.9, 1.3, 0.9]}>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshToonMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}

function Ponytail({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      {/* Hair base */}
      <mesh position={[0, 0.03, 0]} scale={[1.05, 1.10, 1.05]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Ponytail at back */}
      <mesh position={[0, 0.05, -headSize * 1.1]} rotation={[0.3, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.04, 0.45, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Hair tie */}
      <mesh position={[0, 0.05, -headSize * 0.95]}>
        <torusGeometry args={[0.08, 0.02, 16, 32]} />
        <meshToonMaterial color="#333333" />
      </mesh>
    </group>
  );
}

function BunHair({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} scale={[1.05, 1.08, 1.05]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Bun on top */}
      <mesh position={[0, 0.32, -0.08]}>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshToonMaterial color={color} />
      </mesh>
    </group>
  );
}

function BraidsHair({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} scale={[1.05, 1.10, 1.05]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Left braid */}
      <group position={[-headSize * 0.70, -0.05, 0]}>
        <mesh position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.04, 0.03, 0.40, 8]} />
          <meshToonMaterial color={color} />
        </mesh>
      </group>
      {/* Right braid */}
      <group position={[headSize * 0.70, -0.05, 0]}>
        <mesh position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.04, 0.03, 0.40, 8]} />
          <meshToonMaterial color={color} />
        </mesh>
      </group>
    </group>
  );
}

function BangsHair({ color, headSize }: { color: string; headSize: number }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} scale={[1.05, 1.10, 1.05]}>
        <sphereGeometry args={[headSize, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.75]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Front bangs */}
      <mesh position={[0, 0.08, headSize * 0.80]} scale={[2, 0.5, 1]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
      {/* Sides */}
      <mesh position={[0, -0.20, -headSize * 0.70]}>
        <cylinderGeometry args={[0.10, 0.12, 0.40, 16]} />
        <meshToonMaterial color={color} />
      </mesh>
    </group>
  );
}

// Facial hair
function FacialHair({ style, color, headSize }: { style: string; color: string; headSize: number }) {
  const facialHairColor = color || '#3d2817';
  
  if (style === 'none' || style === 'Clean Shaven') return null;
  
  return (
    <group>
      {style === 'stubble' && (
        <mesh position={[0, -0.10, headSize * 0.72]} scale={[1.3, 0.8, 1]}>
          <sphereGeometry args={[0.12, 24, 24]} />
          <meshToonMaterial color={facialHairColor} opacity={0.3} transparent />
        </mesh>
      )}
      
      {(style === 'goatee' || style === 'vandyke') && (
        <>
          {/* Chin beard */}
          <mesh position={[0, -0.15, headSize * 0.75]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshToonMaterial color={facialHairColor} />
          </mesh>
          {style === 'vandyke' && (
            <mesh position={[0, -0.08, headSize * 0.76]} scale={[1.5, 0.4, 0.6]}>
              <sphereGeometry args={[0.05, 16, 16]} />
              <meshToonMaterial color={facialHairColor} />
            </mesh>
          )}
        </>
      )}
      
      {(style === 'mustache' || style === 'handlebar') && (
        <mesh position={[0, -0.08, headSize * 0.77]} scale={[1.8, 0.4, 0.6]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshToonMaterial color={facialHairColor} />
        </mesh>
      )}
      
      {(style === 'fullBeard' || style === 'shortBeard' || style === 'longBeard') && (
        <>
          {/* Full beard coverage */}
          <mesh position={[0, -0.13, headSize * 0.68]} scale={[1.4, 1.2, 1]}>
            <sphereGeometry args={[0.14, 24, 24]} />
            <meshToonMaterial color={facialHairColor} />
          </mesh>
          {style === 'longBeard' && (
            <mesh position={[0, -0.25, headSize * 0.70]}>
              <cylinderGeometry args={[0.08, 0.06, 0.20, 16]} />
              <meshToonMaterial color={facialHairColor} />
            </mesh>
          )}
        </>
      )}
      
      {style === 'soulPatch' && (
        <mesh position={[0, -0.13, headSize * 0.78]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshToonMaterial color={facialHairColor} />
        </mesh>
      )}
      
      {style === 'chinCurtain' && (
        <mesh position={[0, -0.15, headSize * 0.55]} scale={[1.6, 0.8, 0.8]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.15, 0.04, 16, 32, Math.PI * 1.5]} />
          <meshToonMaterial color={facialHairColor} />
        </mesh>
      )}
    </group>
  );
}

// Glasses
function Glasses({ style, headSize }: { style: string; headSize: number }) {
  const glassColor = '#333333';
  const lensColor = style === 'sunglasses' ? '#111111' : '#ffffff';
  const lensOpacity = style === 'sunglasses' ? 0.8 : 0.3;
  
  return (
    <group position={[0, 0.05, headSize * 0.80]}>
      {/* Left lens */}
      <mesh position={[-0.08, 0, 0]}>
        {style === 'round' && <sphereGeometry args={[0.05, 24, 24]} />}
        {style === 'square' && <boxGeometry args={[0.09, 0.08, 0.01]} />}
        {style === 'aviator' && <sphereGeometry args={[0.06, 24, 24]} />}
        {style === 'wayfarer' && <boxGeometry args={[0.10, 0.08, 0.01]} />}
        {style === 'cat' && (
          <boxGeometry args={[0.09, 0.08, 0.01]} />
        )}
        {!style || style === 'none' ? null : <meshToonMaterial color={lensColor} opacity={lensOpacity} transparent />}
      </mesh>
      
      {/* Right lens */}
      <mesh position={[0.08, 0, 0]}>
        {style === 'round' && <sphereGeometry args={[0.05, 24, 24]} />}
        {style === 'square' && <boxGeometry args={[0.09, 0.08, 0.01]} />}
        {style === 'aviator' && <sphereGeometry args={[0.06, 24, 24]} />}
        {style === 'wayfarer' && <boxGeometry args={[0.10, 0.08, 0.01]} />}
        {style === 'cat' && <boxGeometry args={[0.09, 0.08, 0.01]} />}
        {!style || style === 'none' ? null : <meshToonMaterial color={lensColor} opacity={lensOpacity} transparent />}
      </mesh>
      
      {/* Bridge */}
      {style !== 'rimless' && (
        <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.01, 0.01, 0.03, 8]} />
          <meshToonMaterial color={glassColor} />
        </mesh>
      )}
      
      {/* Frame */}
      {style !== 'rimless' && (
        <>
          <mesh position={[-0.08, 0, 0]}>
            <torusGeometry args={[0.05, 0.008, 8, 24]} />
            <meshToonMaterial color={glassColor} />
          </mesh>
          <mesh position={[0.08, 0, 0]}>
            <torusGeometry args={[0.05, 0.008, 8, 24]} />
            <meshToonMaterial color={glassColor} />
          </mesh>
        </>
      )}
    </group>
  );
}

// Earrings
function Earrings({ style, headSize }: { style: string; headSize: number }) {
  const earringColor = '#FFD700'; // gold
  
  return (
    <>
      {/* Left earring */}
      <group position={[-headSize * 0.95, -0.02, 0]}>
        {style === 'studs' && (
          <mesh>
            <sphereGeometry args={[0.015, 12, 12]} />
            <meshStandardMaterial color={earringColor} metalness={0.9} roughness={0.1} />
          </mesh>
        )}
        
        {style === 'hoops' && (
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.03, 0.008, 12, 24]} />
            <meshStandardMaterial color={earringColor} metalness={0.9} roughness={0.1} />
          </mesh>
        )}
        
        {style === 'dangles' && (
          <group>
            <mesh position={[0, -0.03, 0]}>
              <cylinderGeometry args={[0.006, 0.006, 0.05, 8]} />
              <meshStandardMaterial color={earringColor} metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[0, -0.06, 0]}>
              <sphereGeometry args={[0.015, 12, 12]} />
              <meshStandardMaterial color={earringColor} metalness={0.9} roughness={0.1} />
            </mesh>
          </group>
        )}
        
        {style === 'gauges' && (
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.025, 0.015, 12, 24]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.7} />
          </mesh>
        )}
      </group>
      
      {/* Right earring (mirror) */}
      <group position={[headSize * 0.95, -0.02, 0]}>
        {style === 'studs' && (
          <mesh>
            <sphereGeometry args={[0.015, 12, 12]} />
            <meshStandardMaterial color={earringColor} metalness={0.9} roughness={0.1} />
          </mesh>
        )}
        
        {style === 'hoops' && (
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.03, 0.008, 12, 24]} />
            <meshStandardMaterial color={earringColor} metalness={0.9} roughness={0.1} />
          </mesh>
        )}
        
        {style === 'dangles' && (
          <group>
            <mesh position={[0, -0.03, 0]}>
              <cylinderGeometry args={[0.006, 0.006, 0.05, 8]} />
              <meshStandardMaterial color={earringColor} metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[0, -0.06, 0]}>
              <sphereGeometry args={[0.015, 12, 12]} />
              <meshStandardMaterial color={earringColor} metalness={0.9} roughness={0.1} />
            </mesh>
          </group>
        )}
        
        {style === 'gauges' && (
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.025, 0.015, 12, 24]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.7} />
          </mesh>
        )}
      </group>
    </>
  );
}

// Anime body with age-based proportions
function AnimeBody({ skinTone, config, gender }: { skinTone: string; config: AnimeAvatarProps['config']; gender: 'male' | 'female' }) {
  const isMale = gender === 'male';
  
  // Age affects body proportions
  const ageScale = config.age === 'child' ? 0.7 :
                   config.age === 'teen' ? 0.85 :
                   config.age === 'elder' ? 0.95 : 1.0;
  
  const torsoHeight = 0.45 * ageScale;
  const shoulderWidth = isMale ? 0.38 : 0.32;
  const hipWidth = isMale ? 0.30 : 0.35;
  
  return (
    <group>
      {/* Neck */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.09, 0.15, 32]} />
        <meshToonMaterial color={skinTone} />
      </mesh>
      
      {/* Torso */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[shoulderWidth, hipWidth, torsoHeight, 32]} />
        <meshToonMaterial color={skinTone} />
      </mesh>
      
      {/* Shoulders */}
      <mesh position={[-shoulderWidth * 0.6, 1.0, 0]} castShadow>
        <sphereGeometry args={[0.10, 20, 20]} />
        <meshToonMaterial color={skinTone} />
      </mesh>
      <mesh position={[shoulderWidth * 0.6, 1.0, 0]} castShadow>
        <sphereGeometry args={[0.10, 20, 20]} />
        <meshToonMaterial color={skinTone} />
      </mesh>
      
      {/* Arms */}
      <mesh position={[-shoulderWidth * 0.65, 0.75, 0]} castShadow>
        <capsuleGeometry args={[0.06, 0.35, 12, 20]} />
        <meshToonMaterial color={skinTone} />
      </mesh>
      <mesh position={[shoulderWidth * 0.65, 0.75, 0]} castShadow>
        <capsuleGeometry args={[0.06, 0.35, 12, 20]} />
        <meshToonMaterial color={skinTone} />
      </mesh>
      
      {/* Hands */}
      <mesh position={[-shoulderWidth * 0.65, 0.52, 0]} castShadow>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshToonMaterial color={skinTone} />
      </mesh>
      <mesh position={[shoulderWidth * 0.65, 0.52, 0]} castShadow>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshToonMaterial color={skinTone} />
      </mesh>
      
      {/* Legs */}
      <mesh position={[-0.10, 0.30, 0]} castShadow>
        <capsuleGeometry args={[0.08, 0.55, 12, 20]} />
        <meshToonMaterial color={skinTone} />
      </mesh>
      <mesh position={[0.10, 0.30, 0]} castShadow>
        <capsuleGeometry args={[0.08, 0.55, 12, 20]} />
        <meshToonMaterial color={skinTone} />
      </mesh>
      
      {/* Feet */}
      <mesh position={[-0.10, 0.05, 0.05]} castShadow rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.06, 0.12, 12, 20]} />
        <meshToonMaterial color={skinTone} />
      </mesh>
      <mesh position={[0.10, 0.05, 0.05]} castShadow rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.06, 0.12, 12, 20]} />
        <meshToonMaterial color={skinTone} />
      </mesh>
    </group>
  );
}

// Main export
export default function AnimeAvatar({ skinTone, gender, config }: AnimeAvatarProps) {
  // Parse config if it's a string
  const parsedConfig = typeof config === 'string' ? JSON.parse(config) : config;
  
  return (
    <group>
      <AnimeBody skinTone={skinTone} config={parsedConfig} gender={gender} />
      <AnimeHead skinTone={skinTone} config={parsedConfig} gender={gender} />
    </group>
  );
}
