'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function RefreshButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      // Call the API endpoint to verify data is fresh
      const response = await fetch('/api/dashboard-stats');
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      
      // Refresh the page data using Next.js router
      router.refresh();
      
      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Refresh failed:', error);
      alert('Failed to refresh dashboard. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
      title="Refresh dashboard data"
    >
      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      {isRefreshing ? 'Refreshing...' : 'Refresh'}
    </button>
  );
}
