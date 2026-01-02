'use client';

import { useState, useEffect, useCallback } from 'react';
import AvatarCanvas from './AvatarCanvas';
import { Sparkle, ShoppingBag, Lock } from '@phosphor-icons/react';

interface AvatarItem {
  id: string;
  name: string;
  description?: string;
  slot: string;
  modelUrl: string;
  thumbnailUrl?: string;
  rarity: string;
  unlocked?: boolean;
}

interface AvatarData {
  avatar: {
    id: string;
    configuration: Record<string, string>;
    skinTone: string;
    bodyType: string;
    gender?: string;
    faceFeatures?: {
      eyeShape?: string;
      noseShape?: string;
      mouthShape?: string;
      eyebrowShape?: string;
    };
  };
  unlockedItems: AvatarItem[];
  defaultItems: AvatarItem[];
}

interface AvatarCustomizerProps {
  customerId: string;
}

const SKIN_TONES = [
  { name: 'Fair', color: '#FFE0BD' },
  { name: 'Light', color: '#FFCD94' },
  { name: 'Medium', color: '#E0AC69' },
  { name: 'Tan', color: '#C68642' },
  { name: 'Brown', color: '#8D5524' },
  { name: 'Dark', color: '#6B4423' },
  { name: 'Deep', color: '#4A2C17' },
  { name: 'Rich', color: '#2E1A0F' },
];

const FACIAL_FEATURES = {
  eyeShape: [
    { value: 'round', label: 'Round' },
    { value: 'almond', label: 'Almond' },
    { value: 'wide', label: 'Wide' },
  ],
  noseShape: [
    { value: 'small', label: 'Small' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
  ],
  mouthShape: [
    { value: 'smile', label: 'Smile' },
    { value: 'neutral', label: 'Neutral' },
    { value: 'full', label: 'Full' },
  ],
  eyebrowShape: [
    { value: 'thin', label: 'Thin' },
    { value: 'normal', label: 'Normal' },
    { value: 'thick', label: 'Thick' },
  ],
};

const SLOTS = [
  { key: 'hair', label: 'Hair', icon: '💇' },
  { key: 'headwear', label: 'Headwear', icon: '🎩' },
  { key: 'top', label: 'Top', icon: '👕' },
  { key: 'outerwear', label: 'Outerwear', icon: '🧥' },
  { key: 'bottom', label: 'Bottom', icon: '👖' },
  { key: 'shoes', label: 'Shoes', icon: '👟' },
  { key: 'accessory', label: 'Accessory', icon: '💍' },
];

const RARITY_COLORS: Record<string, string> = {
  COMMON: 'bg-gray-500',
  UNCOMMON: 'bg-green-500',
  RARE: 'bg-blue-500',
  EPIC: 'bg-purple-500',
  LEGENDARY: 'bg-yellow-500',
};

export default function AvatarCustomizer({ customerId }: AvatarCustomizerProps) {
  const [avatarData, setAvatarData] = useState<AvatarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string>('hair');
  const [configuration, setConfiguration] = useState<Record<string, string>>({});
  const [skinTone, setSkinTone] = useState<string>('#FFE0BD');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [faceFeatures, setFaceFeatures] = useState({
    eyeShape: 'round',
    noseShape: 'medium',
    mouthShape: 'smile',
    eyebrowShape: 'normal',
  });

  const fetchAvatarData = useCallback(async () => {
    try {
      const response = await fetch('/api/avatar', {
        headers: {
          'x-customer-id': customerId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAvatarData(data);
        setConfiguration(data.avatar.configuration);
        setSkinTone(data.avatar.skinTone || '#FFE0BD');
        setGender((data.avatar.gender as 'male' | 'female') || 'male');
        if (data.avatar.faceFeatures) {
          setFaceFeatures(typeof data.avatar.faceFeatures === 'string' 
            ? JSON.parse(data.avatar.faceFeatures)
            : data.avatar.faceFeatures
          );
        }
      }
    } catch (error) {
      console.error('Failed to fetch avatar data:', error);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchAvatarData();
  }, [fetchAvatarData]);

  const saveConfiguration = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/avatar', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-id': customerId,
        },
        body: JSON.stringify({
          configuration,
          skinTone,
          gender,
          faceFeatures: JSON.stringify(faceFeatures),
        }),
      });

      if (response.ok) {
        // Success feedback
        console.log('Avatar saved successfully');
      }
    } catch (error) {
      console.error('Failed to save avatar:', error);
    } finally {
      setSaving(false);
    }
  };

  const equipItem = (slot: string, itemId: string | null) => {
    const newConfig = { ...configuration };
    if (itemId === null) {
      delete newConfig[slot];
    } else {
      newConfig[slot] = itemId;
    }
    setConfiguration(newConfig);
  };

  const getAvailableItemsForSlot = (slot: string) => {
    if (!avatarData) return [];

    const allItems = [
      ...avatarData.unlockedItems,
      ...avatarData.defaultItems,
    ];

    return allItems.filter((item) => item.slot.toLowerCase() === slot.toLowerCase());
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5E5] p-8">
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1A1A1A]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5E5] overflow-hidden">
      {/* Header */}
      <div className="bg-linear-to-r from-purple-500 to-pink-500 p-6 text-white">
        <div className="flex items-center gap-3">
          <Sparkle size={32} weight="fill" />
          <div>
            <h2 className="text-2xl font-bold">Avatar Customization</h2>
            <p className="text-white/90 text-sm">
              Customize your digital avatar with unlocked items
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
        {/* 3D Avatar Preview */}
        <div className="space-y-4">
          <div className="bg-linear-to-b from-gray-50 to-gray-100 rounded-xl overflow-hidden border border-gray-200">
            <div className="h-[500px]">
              <AvatarCanvas
                configuration={configuration}
                skinTone={skinTone}
                bodyType={avatarData?.avatar.bodyType}
                gender={gender}
                faceFeatures={faceFeatures}
                interactive={true}
              />
            </div>
          </div>
          
          {/* Appearance Controls */}
          <div className="space-y-4 bg-white border border-gray-200 rounded-xl p-4">
            {/* Gender Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gender
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setGender('male')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    gender === 'male'
                      ? 'bg-[#1A1A1A] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Male
                </button>
                <button
                  onClick={() => setGender('female')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    gender === 'female'
                      ? 'bg-[#1A1A1A] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Female
                </button>
              </div>
            </div>

            {/* Skin Tone Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Skin Tone
              </label>
              <div className="grid grid-cols-8 gap-2">
                {SKIN_TONES.map((tone) => (
                  <button
                    key={tone.color}
                    onClick={() => setSkinTone(tone.color)}
                    className={`w-10 h-10 rounded-full transition-all ${
                      skinTone === tone.color
                        ? 'ring-2 ring-[#1A1A1A] ring-offset-2 scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: tone.color }}
                    title={tone.name}
                  />
                ))}
              </div>
            </div>

            {/* Facial Features */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Eye Shape
                </label>
                <select
                  value={faceFeatures.eyeShape}
                  onChange={(e) => setFaceFeatures({ ...faceFeatures, eyeShape: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                >
                  {FACIAL_FEATURES.eyeShape.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Nose Shape
                </label>
                <select
                  value={faceFeatures.noseShape}
                  onChange={(e) => setFaceFeatures({ ...faceFeatures, noseShape: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                >
                  {FACIAL_FEATURES.noseShape.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Mouth Shape
                </label>
                <select
                  value={faceFeatures.mouthShape}
                  onChange={(e) => setFaceFeatures({ ...faceFeatures, mouthShape: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                >
                  {FACIAL_FEATURES.mouthShape.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Eyebrows
                </label>
                <select
                  value={faceFeatures.eyebrowShape}
                  onChange={(e) => setFaceFeatures({ ...faceFeatures, eyebrowShape: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1A1A1A] focus:border-transparent"
                >
                  {FACIAL_FEATURES.eyebrowShape.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <button
            onClick={saveConfiguration}
            disabled={saving}
            className="w-full bg-[#1A1A1A] text-white py-3 px-6 rounded-lg hover:bg-[#2A2A2A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {saving ? 'Saving...' : 'Save Avatar'}
          </button>
        </div>

        {/* Item Selection */}
        <div className="space-y-4">
          {/* Slot Tabs */}
          <div className="flex flex-wrap gap-2">
            {SLOTS.map((slot) => (
              <button
                key={slot.key}
                onClick={() => setSelectedSlot(slot.key)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedSlot === slot.key
                    ? 'bg-[#1A1A1A] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="mr-2">{slot.icon}</span>
                {slot.label}
              </button>
            ))}
          </div>

          {/* Items Grid */}
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 max-h-[600px] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              {/* Unequip Option */}
              <button
                onClick={() => equipItem(selectedSlot, null)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  !configuration[selectedSlot]
                    ? 'border-[#1A1A1A] bg-white'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="text-4xl mb-2">✖️</div>
                <div className="text-sm font-medium">None</div>
              </button>

              {/* Available Items */}
              {getAvailableItemsForSlot(selectedSlot).map((item) => (
                <button
                  key={item.id}
                  onClick={() => item.unlocked && equipItem(selectedSlot, item.id)}
                  disabled={!item.unlocked}
                  className={`p-4 rounded-lg border-2 transition-all relative ${
                    configuration[selectedSlot] === item.id
                      ? 'border-[#1A1A1A] bg-white'
                      : item.unlocked
                      ? 'border-gray-200 bg-white hover:border-gray-300'
                      : 'border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed'
                  }`}
                >
                  {/* Rarity Badge */}
                  <div
                    className={`absolute top-2 right-2 w-3 h-3 rounded-full ${
                      RARITY_COLORS[item.rarity] || 'bg-gray-400'
                    }`}
                    title={item.rarity}
                  />

                  {/* Item Preview */}
                  <div className="aspect-square bg-gray-200 rounded-lg mb-2 flex items-center justify-center">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <ShoppingBag size={32} weight="duotone" className="text-gray-400" />
                    )}
                  </div>

                  {/* Item Name */}
                  <div className="text-sm font-medium truncate">{item.name}</div>

                  {/* Locked Overlay */}
                  {!item.unlocked && (
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                      <Lock size={24} weight="fill" className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {getAvailableItemsForSlot(selectedSlot).length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <ShoppingBag size={48} weight="duotone" className="mx-auto mb-3 opacity-50" />
                <p className="font-medium">No items available for this slot</p>
                <p className="text-sm">Purchase products to unlock avatar items!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
