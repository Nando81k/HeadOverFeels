'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Sparkle } from '@phosphor-icons/react';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
}

interface AvatarItem {
  id: string;
  name: string;
  description?: string;
  slot: string;
  modelUrl: string;
  thumbnailUrl?: string;
  productId?: string;
  product?: Product;
  rarity: string;
  isDefault: boolean;
}

export default function AdminAvatarItemsPage() {
  const [items, setItems] = useState<AvatarItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    slot: 'TOP',
    modelUrl: '',
    thumbnailUrl: '',
    productId: '',
    rarity: 'COMMON',
    isDefault: false,
  });

  useEffect(() => {
    fetchItems();
    fetchProducts();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await fetch('/api/avatar/items', {
        headers: {
          'x-is-admin': 'true',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setItems(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch avatar items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/avatar/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-is-admin': 'true',
        },
        body: JSON.stringify({
          ...formData,
          productId: formData.productId || null,
        }),
      });

      if (response.ok) {
        setShowForm(false);
        setFormData({
          name: '',
          description: '',
          slot: 'TOP',
          modelUrl: '',
          thumbnailUrl: '',
          productId: '',
          rarity: 'COMMON',
          isDefault: false,
        });
        fetchItems();
      }
    } catch (error) {
      console.error('Failed to create avatar item:', error);
    }
  };

  return (
    <div className="min-h-screen bg-black pt-32 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-6 group"
        >
          <ArrowLeft size={20} weight="bold" className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Admin</span>
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Sparkle size={32} weight="fill" className="text-purple-400" />
            <div>
              <h1 className="text-4xl font-bold text-white logo-font">
                Avatar Items
              </h1>
              <p className="text-white/40 mt-1">
                Manage avatar customization items
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 bg-[#FF3131] text-white px-6 py-3 hover:bg-[#E02828] transition-colors"
          >
            <Plus size={20} weight="bold" />
            Add Avatar Item
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="bg-neutral-900 border border-white/10 p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">Create Avatar Item</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2">Slot *</label>
                  <select
                    required
                    value={formData.slot}
                    onChange={(e) => setFormData({ ...formData, slot: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 text-white focus:outline-none focus:border-white/30"
                  >
                    <option value="HAIR" className="bg-neutral-900">Hair</option>
                    <option value="HEADWEAR" className="bg-neutral-900">Headwear</option>
                    <option value="TOP" className="bg-neutral-900">Top</option>
                    <option value="OUTERWEAR" className="bg-neutral-900">Outerwear</option>
                    <option value="BOTTOM" className="bg-neutral-900">Bottom</option>
                    <option value="SHOES" className="bg-neutral-900">Shoes</option>
                    <option value="ACCESSORY" className="bg-neutral-900">Accessory</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2">Model URL (GLB/GLTF) *</label>
                  <input
                    type="url"
                    required
                    value={formData.modelUrl}
                    onChange={(e) => setFormData({ ...formData, modelUrl: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                    placeholder="https://example.com/model.glb"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2">Thumbnail URL</label>
                  <input
                    type="url"
                    value={formData.thumbnailUrl}
                    onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                    placeholder="https://example.com/thumbnail.jpg"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2">Rarity</label>
                  <select
                    value={formData.rarity}
                    onChange={(e) => setFormData({ ...formData, rarity: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 text-white focus:outline-none focus:border-white/30"
                  >
                    <option value="COMMON" className="bg-neutral-900">Common</option>
                    <option value="UNCOMMON" className="bg-neutral-900">Uncommon</option>
                    <option value="RARE" className="bg-neutral-900">Rare</option>
                    <option value="EPIC" className="bg-neutral-900">Epic</option>
                    <option value="LEGENDARY" className="bg-neutral-900">Legendary</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2">Associated Product</label>
                  <select
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 text-white focus:outline-none focus:border-white/30"
                  >
                    <option value="" className="bg-neutral-900">None</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id} className="bg-neutral-900">
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-white/30"
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="w-4 h-4 text-[#FF3131] focus:ring-[#FF3131] bg-white/5 border-white/10"
                />
                <label htmlFor="isDefault" className="text-sm text-white/70">
                  Default Item (Available to all users)
                </label>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="bg-[#FF3131] text-white px-6 py-2 hover:bg-[#E02828] transition-colors"
                >
                  Create Item
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-white/5 border border-white/10 text-white/70 px-6 py-2 hover:bg-white/10 hover:border-white/20 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Items List */}
        <div className="bg-neutral-900 border border-white/10 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <Sparkle size={48} weight="duotone" className="mx-auto mb-3 text-white/30" />
              <p className="font-medium text-white">No avatar items yet</p>
              <p className="text-sm text-white/40">Create your first avatar item to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                      Slot
                    </th>
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                      Rarity
                    </th>
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-[10px] font-medium text-white/40 uppercase tracking-[0.15em]">
                      Default
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-white/5">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-white">{item.name}</div>
                        {item.description && (
                          <div className="text-sm text-white/40">{item.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-400">
                          {item.slot}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium ${
                          item.rarity === 'LEGENDARY' ? 'bg-yellow-500/20 text-yellow-400' :
                          item.rarity === 'EPIC' ? 'bg-purple-500/20 text-purple-400' :
                          item.rarity === 'RARE' ? 'bg-blue-500/20 text-blue-400' :
                          item.rarity === 'UNCOMMON' ? 'bg-green-500/20 text-green-400' :
                          'bg-white/10 text-white/70'
                        }`}>
                          {item.rarity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white/40">
                        {item.product?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.isDefault && (
                          <span className="px-2 py-1 text-xs font-medium bg-emerald-500/20 text-emerald-400">
                            Default
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
