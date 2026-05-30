'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { CaretLeft, CaretRight, Sparkle } from '@phosphor-icons/react';

const AvatarCanvas = dynamic(() => import('./AvatarCanvas'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black/5 rounded-xl animate-pulse" />
  ),
});

interface MemojiWizardProps {
  customerId: string;
  onComplete?: () => void;
}

// Customization steps in order
const STEPS = [
  { id: 'skin', title: 'Skin Tone', subtitle: 'Choose your skin tone' },
  { id: 'face', title: 'Face Shape', subtitle: 'Select your face shape' },
  { id: 'eyes', title: 'Eyes', subtitle: 'Pick your eye style' },
  { id: 'eyebrows', title: 'Eyebrows', subtitle: 'Choose your eyebrows' },
  { id: 'nose', title: 'Nose', subtitle: 'Select your nose' },
  { id: 'mouth', title: 'Mouth', subtitle: 'Pick your mouth style' },
  { id: 'hair', title: 'Hairstyle', subtitle: 'Choose your hairstyle' },
  { id: 'hairColor', title: 'Hair Color', subtitle: 'Pick your hair color' },
  { id: 'facialHair', title: 'Facial Hair', subtitle: 'Add facial hair (optional)' },
  { id: 'accessories', title: 'Accessories', subtitle: 'Add glasses or earrings' },
  { id: 'age', title: 'Age', subtitle: 'Select age appearance' },
  { id: 'review', title: 'Review', subtitle: 'Final look at your avatar' },
];

// Enhanced skin tone options
const SKIN_TONES = [
  { name: 'Porcelain', color: '#FFF5F0' },
  { name: 'Fair', color: '#FFE0BD' },
  { name: 'Light', color: '#FFCD94' },
  { name: 'Medium', color: '#E0AC69' },
  { name: 'Olive', color: '#D4A574' },
  { name: 'Tan', color: '#C68642' },
  { name: 'Brown', color: '#8D5524' },
  { name: 'Dark', color: '#6B4423' },
  { name: 'Deep', color: '#4A2C17' },
  { name: 'Ebony', color: '#2E1A0F' },
];

// Face shapes with visual differences
const FACE_SHAPES = [
  { value: 'round', label: 'Round', icon: '⭕' },
  { value: 'oval', label: 'Oval', icon: '🥚' },
  { value: 'square', label: 'Square', icon: '◻️' },
  { value: 'heart', label: 'Heart', icon: '💛' },
  { value: 'diamond', label: 'Diamond', icon: '💎' },
  { value: 'triangle', label: 'Triangle', icon: '🔺' },
];

// Expanded eye options
const EYE_STYLES = [
  { value: 'round', label: 'Round', description: 'Large and open' },
  { value: 'almond', label: 'Almond', description: 'Classic shape' },
  { value: 'wide', label: 'Wide', description: 'Far apart' },
  { value: 'close', label: 'Close', description: 'Close together' },
  { value: 'upturned', label: 'Upturned', description: 'Cat-like' },
  { value: 'downturned', label: 'Downturned', description: 'Gentle slope' },
  { value: 'hooded', label: 'Hooded', description: 'Deep set' },
  { value: 'monolid', label: 'Monolid', description: 'No crease' },
  { value: 'small', label: 'Small', description: 'Petite' },
  { value: 'large', label: 'Large', description: 'Prominent' },
];

// Eye colors
const EYE_COLORS = [
  { value: 'brown', label: 'Brown', color: '#4A3728' },
  { value: 'hazel', label: 'Hazel', color: '#8B7355' },
  { value: 'green', label: 'Green', color: '#2E8B57' },
  { value: 'blue', label: 'Blue', color: '#4169E1' },
  { value: 'gray', label: 'Gray', color: '#708090' },
  { value: 'amber', label: 'Amber', color: '#FFBF00' },
  { value: 'violet', label: 'Violet', color: '#8B00FF' },
];

// Eyebrow styles
const EYEBROW_STYLES = [
  { value: 'thin', label: 'Thin', description: 'Delicate arch' },
  { value: 'normal', label: 'Normal', description: 'Natural look' },
  { value: 'thick', label: 'Thick', description: 'Bold and full' },
  { value: 'bushy', label: 'Bushy', description: 'Extra full' },
  { value: 'arched', label: 'Arched', description: 'High arch' },
  { value: 'straight', label: 'Straight', description: 'No arch' },
  { value: 'angled', label: 'Angled', description: 'Sharp angle' },
  { value: 'rounded', label: 'Rounded', description: 'Soft curve' },
];

// Nose styles
const NOSE_STYLES = [
  { value: 'small', label: 'Small', description: 'Petite' },
  { value: 'medium', label: 'Medium', description: 'Average' },
  { value: 'large', label: 'Large', description: 'Prominent' },
  { value: 'button', label: 'Button', description: 'Small and round' },
  { value: 'straight', label: 'Straight', description: 'Straight bridge' },
  { value: 'roman', label: 'Roman', description: 'High bridge' },
  { value: 'wide', label: 'Wide', description: 'Broad' },
  { value: 'narrow', label: 'Narrow', description: 'Slim' },
  { value: 'upturned', label: 'Upturned', description: 'Turned up' },
  { value: 'aquiline', label: 'Aquiline', description: 'Curved' },
];

// Mouth styles
const MOUTH_STYLES = [
  { value: 'small', label: 'Small', description: 'Petite lips' },
  { value: 'medium', label: 'Medium', description: 'Average lips' },
  { value: 'full', label: 'Full', description: 'Full lips' },
  { value: 'thin', label: 'Thin', description: 'Thin lips' },
  { value: 'wide', label: 'Wide', description: 'Wide smile' },
  { value: 'smile', label: 'Smiling', description: 'Always smiling' },
  { value: 'neutral', label: 'Neutral', description: 'Relaxed' },
  { value: 'pouty', label: 'Pouty', description: 'Full pout' },
  { value: 'cupid', label: 'Cupid\'s Bow', description: 'Defined shape' },
];

// Lip colors
const LIP_COLORS = [
  { value: 'natural', label: 'Natural', color: '#ff6b9d' },
  { value: 'nude', label: 'Nude', color: '#d4a59a' },
  { value: 'pink', label: 'Pink', color: '#ff69b4' },
  { value: 'red', label: 'Red', color: '#dc143c' },
  { value: 'berry', label: 'Berry', color: '#8b008b' },
  { value: 'coral', label: 'Coral', color: '#ff7f50' },
];

// Hair styles
const HAIR_STYLES = {
  male: [
    { value: 'bald', label: 'Bald', description: 'No hair' },
    { value: 'buzzcut', label: 'Buzz Cut', description: 'Very short' },
    { value: 'short', label: 'Short', description: 'Classic short' },
    { value: 'medium', label: 'Medium', description: 'Shoulder length' },
    { value: 'long', label: 'Long', description: 'Long hair' },
    { value: 'spiky', label: 'Spiky', description: 'Styled up' },
    { value: 'curly', label: 'Curly', description: 'Natural curls' },
    { value: 'wavy', label: 'Wavy', description: 'Beach waves' },
    { value: 'fade', label: 'Fade', description: 'Faded sides' },
    { value: 'undercut', label: 'Undercut', description: 'Short sides, long top' },
    { value: 'pompadour', label: 'Pompadour', description: 'Styled high' },
    { value: 'quiff', label: 'Quiff', description: 'Front styled up' },
  ],
  female: [
    { value: 'pixie', label: 'Pixie', description: 'Short and chic' },
    { value: 'bob', label: 'Bob', description: 'Chin length' },
    { value: 'lob', label: 'Long Bob', description: 'Shoulder length' },
    { value: 'medium', label: 'Medium', description: 'Mid-length' },
    { value: 'long', label: 'Long', description: 'Long hair' },
    { value: 'straight', label: 'Straight', description: 'Sleek and straight' },
    { value: 'wavy', label: 'Wavy', description: 'Soft waves' },
    { value: 'curly', label: 'Curly', description: 'Bouncy curls' },
    { value: 'ponytail', label: 'Ponytail', description: 'Tied back' },
    { value: 'bun', label: 'Bun', description: 'Hair up' },
    { value: 'braids', label: 'Braids', description: 'Braided' },
    { value: 'bangs', label: 'Bangs', description: 'With fringe' },
  ],
};

// Hair colors
const HAIR_COLORS = [
  { value: 'black', label: 'Black', color: '#1a1a1a' },
  { value: 'darkBrown', label: 'Dark Brown', color: '#3d2817' },
  { value: 'brown', label: 'Brown', color: '#6f4e37' },
  { value: 'lightBrown', label: 'Light Brown', color: '#a0826d' },
  { value: 'blonde', label: 'Blonde', color: '#f4e7c3' },
  { value: 'platinumBlonde', label: 'Platinum', color: '#e8dcc0' },
  { value: 'red', label: 'Red', color: '#b55239' },
  { value: 'auburn', label: 'Auburn', color: '#a52a2a' },
  { value: 'strawberryBlonde', label: 'Strawberry', color: '#ff9966' },
  { value: 'gray', label: 'Gray', color: '#808080' },
  { value: 'white', label: 'White', color: '#f5f5f5' },
  { value: 'blue', label: 'Blue', color: '#4169e1' },
  { value: 'pink', label: 'Pink', color: '#ff69b4' },
  { value: 'purple', label: 'Purple', color: '#800080' },
  { value: 'green', label: 'Green', color: '#228b22' },
];

// Facial hair styles (for male avatars)
const FACIAL_HAIR_STYLES = [
  { value: 'none', label: 'Clean Shaven', description: 'No facial hair' },
  { value: 'stubble', label: 'Stubble', description: '5 o\'clock shadow' },
  { value: 'goatee', label: 'Goatee', description: 'Chin only' },
  { value: 'vandyke', label: 'Van Dyke', description: 'Goatee + mustache' },
  { value: 'mustache', label: 'Mustache', description: 'Mustache only' },
  { value: 'handlebar', label: 'Handlebar', description: 'Styled mustache' },
  { value: 'fullBeard', label: 'Full Beard', description: 'Complete beard' },
  { value: 'shortBeard', label: 'Short Beard', description: 'Trimmed beard' },
  { value: 'longBeard', label: 'Long Beard', description: 'Long and full' },
  { value: 'soulPatch', label: 'Soul Patch', description: 'Small chin patch' },
  { value: 'chinCurtain', label: 'Chin Curtain', description: 'Jawline beard' },
];

// Accessories
const ACCESSORIES = {
  glasses: [
    { value: 'none', label: 'None', description: 'No glasses' },
    { value: 'round', label: 'Round', description: 'Round frames' },
    { value: 'square', label: 'Square', description: 'Square frames' },
    { value: 'aviator', label: 'Aviator', description: 'Classic aviators' },
    { value: 'wayfarer', label: 'Wayfarer', description: 'Retro style' },
    { value: 'cat', label: 'Cat Eye', description: 'Cat eye frames' },
    { value: 'rimless', label: 'Rimless', description: 'No frame' },
    { value: 'sunglasses', label: 'Sunglasses', description: 'Dark lenses' },
  ],
  earrings: [
    { value: 'none', label: 'None', description: 'No earrings' },
    { value: 'studs', label: 'Studs', description: 'Small studs' },
    { value: 'hoops', label: 'Hoops', description: 'Hoop earrings' },
    { value: 'dangles', label: 'Dangles', description: 'Hanging earrings' },
    { value: 'gauges', label: 'Gauges', description: 'Large plugs' },
  ],
};

// Age ranges
const AGE_RANGES = [
  { value: 'child', label: 'Child', description: '8-12 years', icon: '👶' },
  { value: 'teen', label: 'Teen', description: '13-19 years', icon: '🧒' },
  { value: 'youngAdult', label: 'Young Adult', description: '20-30 years', icon: '🧑' },
  { value: 'adult', label: 'Adult', description: '31-50 years', icon: '👨' },
  { value: 'middleAge', label: 'Middle Age', description: '51-65 years', icon: '👨‍🦳' },
  { value: 'elder', label: 'Elder', description: '65+ years', icon: '👴' },
];

export default function MemojiWizard({ customerId, onComplete }: MemojiWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  
  // Avatar customization state
  const [avatarConfig, setAvatarConfig] = useState({
    skinTone: '#FFE0BD',
    faceShape: 'oval',
    eyeStyle: 'almond',
    eyeColor: 'brown',
    eyebrowStyle: 'normal',
    noseStyle: 'medium',
    mouthStyle: 'smile',
    lipColor: 'natural',
    hairStyle: 'short',
    hairColor: 'brown',
    facialHair: 'none',
    facialHairColor: 'brown',
    glasses: 'none',
    earrings: 'none',
    age: 'youngAdult',
  });

  const [saving, setSaving] = useState(false);

  // Load existing avatar data
  useEffect(() => {
    const fetchExistingAvatar = async () => {
      try {
        const response = await fetch('/api/avatar', {
          headers: { 'x-customer-id': customerId },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.avatar) {
            // Load existing configuration
            setGender((data.avatar.gender as 'male' | 'female') || 'male');
            // Parse existing features if available
            // ... merge with avatarConfig
          }
        }
      } catch (error) {
        console.error('Failed to fetch avatar:', error);
      }
    };
    fetchExistingAvatar();
  }, [customerId]);

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateConfig = (key: string, value: string) => {
    setAvatarConfig(prev => ({ ...prev, [key]: value }));
  };

  const randomizeAll = () => {
    const randomSkinTone = SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)].color;
    const randomFaceShape = FACE_SHAPES[Math.floor(Math.random() * FACE_SHAPES.length)].value;
    const randomEyeStyle = EYE_STYLES[Math.floor(Math.random() * EYE_STYLES.length)].value;
    const randomEyeColor = EYE_COLORS[Math.floor(Math.random() * EYE_COLORS.length)].value;
    const randomEyebrow = EYEBROW_STYLES[Math.floor(Math.random() * EYEBROW_STYLES.length)].value;
    const randomNose = NOSE_STYLES[Math.floor(Math.random() * NOSE_STYLES.length)].value;
    const randomMouth = MOUTH_STYLES[Math.floor(Math.random() * MOUTH_STYLES.length)].value;
    const randomLipColor = LIP_COLORS[Math.floor(Math.random() * LIP_COLORS.length)].value;
    
    const hairOptions = gender === 'male' ? HAIR_STYLES.male : HAIR_STYLES.female;
    const randomHairStyle = hairOptions[Math.floor(Math.random() * hairOptions.length)].value;
    const randomHairColor = HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)].value;
    
    const randomFacialHair = gender === 'male' 
      ? FACIAL_HAIR_STYLES[Math.floor(Math.random() * FACIAL_HAIR_STYLES.length)].value
      : 'none';
    
    const randomGlasses = ACCESSORIES.glasses[Math.floor(Math.random() * ACCESSORIES.glasses.length)].value;
    const randomEarrings = ACCESSORIES.earrings[Math.floor(Math.random() * ACCESSORIES.earrings.length)].value;
    const randomAge = AGE_RANGES[Math.floor(Math.random() * AGE_RANGES.length)].value;

    setAvatarConfig({
      skinTone: randomSkinTone,
      faceShape: randomFaceShape,
      eyeStyle: randomEyeStyle,
      eyeColor: randomEyeColor,
      eyebrowStyle: randomEyebrow,
      noseStyle: randomNose,
      mouthStyle: randomMouth,
      lipColor: randomLipColor,
      hairStyle: randomHairStyle,
      hairColor: randomHairColor,
      facialHair: randomFacialHair,
      facialHairColor: randomHairColor,
      glasses: randomGlasses,
      earrings: randomEarrings,
      age: randomAge,
    });
  };

  const saveAvatar = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/avatar', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': customerId,
        },
        body: JSON.stringify({
          configuration: {},
          skinTone: avatarConfig.skinTone,
          gender,
          faceFeatures: JSON.stringify(avatarConfig),
        }),
      });

      if (response.ok) {
        if (onComplete) onComplete();
      }
    } catch (error) {
      console.error('Failed to save avatar:', error);
    } finally {
      setSaving(false);
    }
  };

  const renderStepContent = () => {
    const step = STEPS[currentStep];

    switch (step.id) {
      case 'skin':
        return (
          <div className="grid grid-cols-5 gap-4">
            {SKIN_TONES.map((tone) => (
              <button
                key={tone.color}
                onClick={() => updateConfig('skinTone', tone.color)}
                className={`relative aspect-square rounded-2xl border-4 transition-all hover:scale-110 ${
                  avatarConfig.skinTone === tone.color
                    ? 'border-black ring-4 ring-black/20'
                    : 'border-gray-200'
                }`}
                style={{ backgroundColor: tone.color }}
              >
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap">
                  {tone.name}
                </span>
              </button>
            ))}
          </div>
        );

      case 'face':
        return (
          <div className="grid grid-cols-3 gap-4">
            {FACE_SHAPES.map((shape) => (
              <button
                key={shape.value}
                onClick={() => updateConfig('faceShape', shape.value)}
                className={`p-6 rounded-2xl border-2 transition-all hover:scale-105 ${
                  avatarConfig.faceShape === shape.value
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="text-4xl mb-2">{shape.icon}</div>
                <div className="text-sm font-semibold">{shape.label}</div>
              </button>
            ))}
          </div>
        );

      case 'eyes':
        return (
          <div>
            <h4 className="text-sm font-semibold mb-4">Eye Shape</h4>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {EYE_STYLES.map((style) => (
                <button
                  key={style.value}
                  onClick={() => updateConfig('eyeStyle', style.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-105 ${
                    avatarConfig.eyeStyle === style.value
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="font-semibold text-sm">{style.label}</div>
                  <div className="text-xs text-gray-600">{style.description}</div>
                </button>
              ))}
            </div>
            
            <h4 className="text-sm font-semibold mb-4">Eye Color</h4>
            <div className="grid grid-cols-7 gap-3">
              {EYE_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => updateConfig('eyeColor', color.value)}
                  className={`relative aspect-square rounded-full border-4 transition-all hover:scale-110 ${
                    avatarConfig.eyeColor === color.value
                      ? 'border-black ring-4 ring-black/20'
                      : 'border-gray-200'
                  }`}
                  style={{ backgroundColor: color.color }}
                >
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap">
                    {color.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );

      case 'eyebrows':
        return (
          <div className="grid grid-cols-2 gap-3">
            {EYEBROW_STYLES.map((style) => (
              <button
                key={style.value}
                onClick={() => updateConfig('eyebrowStyle', style.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-105 ${
                  avatarConfig.eyebrowStyle === style.value
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="font-semibold text-sm">{style.label}</div>
                <div className="text-xs text-gray-600">{style.description}</div>
              </button>
            ))}
          </div>
        );

      case 'nose':
        return (
          <div className="grid grid-cols-2 gap-3">
            {NOSE_STYLES.map((style) => (
              <button
                key={style.value}
                onClick={() => updateConfig('noseStyle', style.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-105 ${
                  avatarConfig.noseStyle === style.value
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="font-semibold text-sm">{style.label}</div>
                <div className="text-xs text-gray-600">{style.description}</div>
              </button>
            ))}
          </div>
        );

      case 'mouth':
        return (
          <div>
            <h4 className="text-sm font-semibold mb-4">Mouth Style</h4>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {MOUTH_STYLES.map((style) => (
                <button
                  key={style.value}
                  onClick={() => updateConfig('mouthStyle', style.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-105 ${
                    avatarConfig.mouthStyle === style.value
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="font-semibold text-sm">{style.label}</div>
                  <div className="text-xs text-gray-600">{style.description}</div>
                </button>
              ))}
            </div>

            <h4 className="text-sm font-semibold mb-4">Lip Color</h4>
            <div className="grid grid-cols-6 gap-3">
              {LIP_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => updateConfig('lipColor', color.value)}
                  className={`relative aspect-square rounded-full border-4 transition-all hover:scale-110 ${
                    avatarConfig.lipColor === color.value
                      ? 'border-black ring-4 ring-black/20'
                      : 'border-gray-200'
                  }`}
                  style={{ backgroundColor: color.color }}
                >
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap">
                    {color.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        );

      case 'hair':
        const hairOptions = gender === 'male' ? HAIR_STYLES.male : HAIR_STYLES.female;
        return (
          <div className="grid grid-cols-2 gap-3">
            {hairOptions.map((style) => (
              <button
                key={style.value}
                onClick={() => updateConfig('hairStyle', style.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-105 ${
                  avatarConfig.hairStyle === style.value
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="font-semibold text-sm">{style.label}</div>
                <div className="text-xs text-gray-600">{style.description}</div>
              </button>
            ))}
          </div>
        );

      case 'hairColor':
        return (
          <div className="grid grid-cols-5 gap-4">
            {HAIR_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => updateConfig('hairColor', color.value)}
                className={`relative aspect-square rounded-2xl border-4 transition-all hover:scale-110 ${
                  avatarConfig.hairColor === color.value
                    ? 'border-black ring-4 ring-black/20'
                    : 'border-gray-200'
                }`}
                style={{ backgroundColor: color.color }}
              >
                <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap">
                  {color.label}
                </span>
              </button>
            ))}
          </div>
        );

      case 'facialHair':
        if (gender === 'female') {
          return (
            <div className="text-center py-12">
              <p className="text-gray-500">Facial hair options are not available for female avatars.</p>
            </div>
          );
        }
        return (
          <div className="grid grid-cols-2 gap-3">
            {FACIAL_HAIR_STYLES.map((style) => (
              <button
                key={style.value}
                onClick={() => updateConfig('facialHair', style.value)}
                className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-105 ${
                  avatarConfig.facialHair === style.value
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="font-semibold text-sm">{style.label}</div>
                <div className="text-xs text-gray-600">{style.description}</div>
              </button>
            ))}
          </div>
        );

      case 'accessories':
        return (
          <div>
            <h4 className="text-sm font-semibold mb-4">Glasses</h4>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {ACCESSORIES.glasses.map((item) => (
                <button
                  key={item.value}
                  onClick={() => updateConfig('glasses', item.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-105 ${
                    avatarConfig.glasses === item.value
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="font-semibold text-sm">{item.label}</div>
                  <div className="text-xs text-gray-600">{item.description}</div>
                </button>
              ))}
            </div>

            <h4 className="text-sm font-semibold mb-4">Earrings</h4>
            <div className="grid grid-cols-2 gap-3">
              {ACCESSORIES.earrings.map((item) => (
                <button
                  key={item.value}
                  onClick={() => updateConfig('earrings', item.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-105 ${
                    avatarConfig.earrings === item.value
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="font-semibold text-sm">{item.label}</div>
                  <div className="text-xs text-gray-600">{item.description}</div>
                </button>
              ))}
            </div>
          </div>
        );

      case 'age':
        return (
          <div className="grid grid-cols-2 gap-4">
            {AGE_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => updateConfig('age', range.value)}
                className={`p-6 rounded-2xl border-2 text-left transition-all hover:scale-105 ${
                  avatarConfig.age === range.value
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="text-4xl mb-2">{range.icon}</div>
                <div className="font-semibold text-sm">{range.label}</div>
                <div className="text-xs text-gray-600">{range.description}</div>
              </button>
            ))}
          </div>
        );

      case 'review':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-gray-600">Skin Tone</div>
                <div className="font-semibold flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: avatarConfig.skinTone }} />
                  {SKIN_TONES.find(t => t.color === avatarConfig.skinTone)?.name}
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-gray-600">Face Shape</div>
                <div className="font-semibold capitalize">{avatarConfig.faceShape}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-gray-600">Eyes</div>
                <div className="font-semibold capitalize">{avatarConfig.eyeStyle}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-gray-600">Nose</div>
                <div className="font-semibold capitalize">{avatarConfig.noseStyle}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-gray-600">Mouth</div>
                <div className="font-semibold capitalize">{avatarConfig.mouthStyle}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-gray-600">Hair</div>
                <div className="font-semibold capitalize">{avatarConfig.hairStyle}</div>
              </div>
            </div>
            
            <button
              onClick={saveAvatar}
              disabled={saving}
              className="w-full py-4 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : 'Complete & Save Avatar'}
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-purple-50 via-pink-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Gender Selection (only shown at start) */}
        {currentStep === 0 && (
          <div className="mb-8 text-center">
            <h3 className="text-lg font-semibold mb-4">First, choose your gender</h3>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setGender('male')}
                className={`px-8 py-4 rounded-2xl font-semibold transition-all ${
                  gender === 'male'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                👨 Male
              </button>
              <button
                onClick={() => setGender('female')}
                className={`px-8 py-4 rounded-2xl font-semibold transition-all ${
                  gender === 'female'
                    ? 'bg-pink-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                👩 Female
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: 3D Preview */}
          <div className="bg-white rounded-3xl shadow-xl p-8 sticky top-4 h-fit">
            <div className="aspect-square bg-linear-to-br from-gray-50 to-gray-100 rounded-2xl mb-4">
              <AvatarCanvas
                configuration={{}}
                skinTone={avatarConfig.skinTone}
                bodyType="default"
                gender={gender}
                faceFeatures={{
                  eyeShape: avatarConfig.eyeStyle,
                  noseShape: avatarConfig.noseStyle,
                  mouthShape: avatarConfig.mouthStyle,
                  eyebrowShape: avatarConfig.eyebrowStyle,
                }}
                interactive={true}
              />
            </div>
            
            <button
              onClick={randomizeAll}
              className="w-full py-3 bg-linear-to-r from-purple-500 to-pink-500 text-white rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 transition-all flex items-center justify-center gap-2"
            >
              <Sparkle size={20} weight="fill" />
              Randomize All
            </button>
          </div>

          {/* Right: Customization Steps */}
          <div className="bg-white rounded-3xl shadow-xl p-8">
            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">
                  Step {currentStep + 1} of {STEPS.length}
                </span>
                <span className="text-sm font-medium text-gray-600">
                  {Math.round(((currentStep + 1) / STEPS.length) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-purple-500 to-pink-500 transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Step Title */}
            <div className="mb-6">
              <h2 className="text-3xl font-bold mb-1">{STEPS[currentStep].title}</h2>
              <p className="text-gray-600">{STEPS[currentStep].subtitle}</p>
            </div>

            {/* Step Content */}
            <div className="mb-8 min-h-[400px]">
              {renderStepContent()}
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-3">
              <button
                onClick={prevStep}
                disabled={currentStep === 0}
                className="px-6 py-3 rounded-xl border-2 border-gray-200 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <CaretLeft size={20} weight="bold" />
                Back
              </button>
              
              {currentStep < STEPS.length - 1 && (
                <button
                  onClick={nextStep}
                  className="flex-1 px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                  Next
                  <CaretRight size={20} weight="bold" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
