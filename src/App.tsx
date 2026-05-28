/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Compass, 
  PlusSquare, 
  Repeat, 
  MessageCircle, 
  User as UserIcon,
  Search,
  Bell,
  Filter,
  ArrowLeft,
  Share2,
  ShieldCheck,
  Star,
  MapPin,
  CheckCircle2,
  MoreVertical,
  Camera,
  ChevronRight,
  Send,
  HelpCircle,
  Image,
  Trash2,
  Check,
  Briefcase,
  Sparkles,
  Package,
  X,
  Info,
  Clock,
  ArrowRight,
  Zap,
  Lock,
  Heart,
  Brain,
  TrendingUp
} from 'lucide-react';
import { cn, getApiUrl } from './lib/utils';
import { Listing, User, Offer } from './types';
import { mockListings, currentUser, mockOffers, mockUsers } from './lib/mockData';
import { LoginPage, OnboardingPage } from './components/AuthFlow';
import { IdVerificationPage } from './components/IdVerificationPage';

// Auth state synchronizer
const AUTH_LISTENERS = new Set<() => void>();

export const defaultLocalUser: User = {
  id: 'me',
  name: 'Ravi Kumar',
  avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=RK',
  location: 'Surat, Gujarat',
  rating: 4.8,
  tradesCount: 47,
  isVerified: true,
  isTopTrader: true,
  responseRate: '100%',
  cashUsed: 0,
  phoneVerified: true,
  idVerified: true,
  idVerificationStatus: 'verified',
  cancellationRate: '2%',
  memberSince: 'Oct 2023',
  emailOrPhone: 'ravi@barterhub.in',
  interests: ['Electronics', 'Skills'],
  isOnboardingCompleted: true
};

export const getLocalUsersRegistry = (): User[] => {
  const stored = localStorage.getItem('barter_users_registry');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (_) {}
  }
  const initialRegistry: User[] = [
    ...mockUsers,
    defaultLocalUser
  ];
  localStorage.setItem('barter_users_registry', JSON.stringify(initialRegistry));
  return initialRegistry;
};

export const saveLocalUserToRegistry = (user: User) => {
  const registry = getLocalUsersRegistry();
  const existsIndex = registry.findIndex(u => u.id === user.id || (user.emailOrPhone && u.emailOrPhone === user.emailOrPhone));
  if (existsIndex >= 0) {
    registry[existsIndex] = { ...registry[existsIndex], ...user };
  } else {
    registry.push(user);
  }
  localStorage.setItem('barter_users_registry', JSON.stringify(registry));
};

export const getActiveUserById = (userId: string): User => {
  const registry = getLocalUsersRegistry();
  const activeObj = getLocalUser();
  
  if (userId === 'me') {
    return activeObj || defaultLocalUser;
  }
  
  const found = registry.find(u => u.id === userId);
  if (found) return found;
  
  if (activeObj && activeObj.id === userId) {
    return activeObj;
  }
  
  const mockFound = mockUsers.find(u => u.id === userId);
  if (mockFound) return mockFound;
  
  return {
    id: userId,
    name: userId.startsWith('u_') ? userId.substring(2).replace(/_/g, ' ') : userId,
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userId)}`,
    location: 'Surat, Gujarat',
    rating: 4.8,
    tradesCount: 1,
    isVerified: true,
    isTopTrader: false,
    responseRate: '100%',
    cashUsed: 0,
    phoneVerified: true,
    idVerified: true,
    cancellationRate: '0%',
    memberSince: 'May 2026'
  };
};

let globalUserState: User | null = (() => {
  const stored = localStorage.getItem('barter_user');
  return stored ? JSON.parse(stored) : null;
})();

export const getLocalUser = (): User | null => globalUserState;

export const saveLocalUser = (user: User | null | ((prev: User | null) => User | null)) => {
  const next = typeof user === 'function' ? user(globalUserState) : user;
  globalUserState = next;
  if (next === null) {
    localStorage.removeItem('barter_user');
    localStorage.removeItem('barter_user_token');
  } else {
    localStorage.setItem('barter_user', JSON.stringify(next));
  }
  AUTH_LISTENERS.forEach(l => l());
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(globalUserState);

  useEffect(() => {
    const update = () => setUser(globalUserState);
    AUTH_LISTENERS.add(update);
    return () => {
      AUTH_LISTENERS.delete(update);
    };
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('barter_user_token');
      if (!token) return;
      try {
        const res = await fetch(getApiUrl('/api/auth/me'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          saveLocalUser(data);
        } else {
          saveLocalUser(null);
        }
      } catch (_) {}
    };
    checkSession();
  }, []);

  return [user, saveLocalUser] as const;
};

// Chats shared database
export interface SavedMessage {
  id: string;
  senderId: string;
  receiverId: string;
  listingId?: string;
  text: string;
  time: string;
  timestamp: number;
}

let globalChatsState: SavedMessage[] = [];
const CHAT_LISTENERS = new Set<() => void>();

export const getLocalChats = (): SavedMessage[] => globalChatsState;

export const saveLocalChats = (items: SavedMessage[] | ((prev: SavedMessage[]) => SavedMessage[])) => {
  const next = typeof items === 'function' ? items(globalChatsState) : items;
  globalChatsState = next;
  CHAT_LISTENERS.forEach(l => l());
};

export const useChats = () => {
  const [chats, setChats] = useState(globalChatsState);

  useEffect(() => {
    const update = () => setChats(globalChatsState);
    CHAT_LISTENERS.add(update);
    return () => {
      CHAT_LISTENERS.delete(update);
    };
  }, []);

  const refreshChats = async () => {
    const token = localStorage.getItem('barter_user_token');
    if (!token) return;
    try {
      const res = await fetch(getApiUrl('/api/messages'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const mappedChats = data.map((msg: any) => ({
          id: msg.id,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          listingId: msg.listingId || undefined,
          text: msg.text,
          time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: msg.timestamp
        }));
        saveLocalChats(mappedChats);
      }
    } catch (_) {}
  };

  useEffect(() => {
    refreshChats();
    const interval = setInterval(refreshChats, 4000);
    return () => clearInterval(interval);
  }, []);

  const setChatsWrapper = async (input: any) => {
    if (typeof input === 'function') {
      const result = input(globalChatsState);
      const newMsg = result[result.length - 1];
      if (newMsg) {
        const token = localStorage.getItem('barter_user_token');
        try {
          const res = await fetch(getApiUrl('/api/messages'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              receiverId: newMsg.receiverId,
              listingId: newMsg.listingId,
              text: newMsg.text
            })
          });
          if (res.ok) {
            const data = await res.json();
            const mapped = {
              id: data.id,
              senderId: data.senderId,
              receiverId: data.receiverId,
              listingId: data.listingId || undefined,
              text: data.text,
              time: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              timestamp: data.timestamp
            };
            saveLocalChats(prev => [...prev.filter(item => item.id !== newMsg.id), mapped]);
            return;
          }
        } catch (_) {}
      }
      saveLocalChats(result);
    } else {
      saveLocalChats(input);
    }
  };

  return [chats, setChatsWrapper] as const;
};

// Listings state synchronizer
let globalListingsState: Listing[] = [];
const LISTENERS = new Set<() => void>();

export const getLocalListings = (): Listing[] => globalListingsState;

export const saveLocalListings = (items: Listing[] | ((prev: Listing[]) => Listing[])) => {
  const next = typeof items === 'function' ? items(globalListingsState) : items;
  globalListingsState = next;
  LISTENERS.forEach(l => l());
};

export const useListings = () => {
  const [listings, setListings] = useState(globalListingsState);

  useEffect(() => {
    const update = () => setListings(globalListingsState);
    LISTENERS.add(update);
    return () => {
      LISTENERS.delete(update);
    };
  }, []);

  const refreshListings = async () => {
    try {
      const res = await fetch(getApiUrl('/api/listings'));
      if (res.ok) {
        const data = await res.json();
        saveLocalListings(data);
      }
    } catch (_) {}
  };

  useEffect(() => {
    refreshListings();
  }, []);

  const setListingsWrapper = async (input: any) => {
    if (typeof input === 'function') {
      const result = input(globalListingsState);
      const newListing = result[0];
      if (newListing) {
        const token = localStorage.getItem('barter_user_token');
        try {
          const res = await fetch(getApiUrl('/api/listings'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              title: newListing.title,
              description: newListing.description,
              images: newListing.images,
              category: newListing.category,
              condition: newListing.condition,
              estimatedValue: newListing.estimatedValue,
              location: newListing.location,
              distance: newListing.distance,
              wants: newListing.wants,
              openToNegotiate: newListing.openToNegotiate,
              negotiableCategories: newListing.negotiableCategories,
              tags: newListing.tags,
              isService: newListing.isService
            })
          });
          if (res.ok) {
            const data = await res.json();
            const formatted = {
              ...data,
              images: typeof data.images === 'string' ? JSON.parse(data.images) : data.images,
              wants: typeof data.wants === 'string' ? JSON.parse(data.wants) : data.wants,
              negotiableCategories: typeof data.negotiableCategories === 'string' ? JSON.parse(data.negotiableCategories) : data.negotiableCategories,
              tags: typeof data.tags === 'string' ? JSON.parse(data.tags) : data.tags
            };
            saveLocalListings(prev => [formatted, ...prev.filter(item => item.id !== newListing.id)]);
            return;
          }
        } catch (_) {}
      }
      saveLocalListings(result);
    } else {
      saveLocalListings(input);
    }
  };

  return [listings, setListingsWrapper] as const;
};

export const isVideoUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  return url.startsWith('video:');
};

export const getCleanMediaUrl = (url: string | undefined): string => {
  if (!url) return '';
  if (url.startsWith('video:')) return url.substring(6);
  return url;
};

// Pages - defined here for now, will keep them clean
const DiscoverPage = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('All');
  const [listings] = useListings();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeUser] = useAuth();

  const userObj = activeUser || defaultLocalUser;

  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good morning';
    if (hours < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Active Location Hub State
  const [activeHub, setActiveHub] = useState(() => localStorage.getItem('barter_selected_hub') || 'Surat, Gujarat');
  const [showHubSelector, setShowHubSelector] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [toastMessageLocal, setToastMessageLocal] = useState('');

  const triggerToast = (msg: string) => {
    setToastMessageLocal(msg);
    setTimeout(() => setToastMessageLocal(''), 4000);
  };

  const handleAutoDetectLocation = () => {
    if (!navigator.geolocation) {
      triggerToast("Geolocation is not supported by your browser. 📍");
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const cities = [
          { name: 'Surat, Gujarat', lat: 21.1702, lng: 72.8311 },
          { name: 'Mumbai, Maharashtra', lat: 19.0760, lng: 72.8777 },
          { name: 'New Delhi, Delhi', lat: 28.7041, lng: 77.1025 },
          { name: 'Bengaluru, Karnataka', lat: 12.9716, lng: 77.5946 },
          { name: 'Ahmedabad, Gujarat', lat: 23.0225, lng: 72.5714 },
          { name: 'Pune, Maharashtra', lat: 18.5204, lng: 73.8567 },
          { name: 'Hyderabad, Telangana', lat: 17.3850, lng: 78.4867 }
        ];
        
        let closest = cities[0];
        let minDist = Infinity;
        cities.forEach(c => {
          const d = Math.sqrt(Math.pow(c.lat - latitude, 2) + Math.pow(c.lng - longitude, 2));
          if (d < minDist) {
            minDist = d;
            closest = c;
          }
        });

        setActiveHub(closest.name);
        localStorage.setItem('barter_selected_hub', closest.name);
        setDetectingLocation(false);
        setShowHubSelector(false);
        triggerToast(`Auto-detected: Pinned to ${closest.name}! 📍`);
      },
      (error) => {
        setDetectingLocation(false);
        triggerToast("Location access denied or unavailable. Choose a hub manually! 📍");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Advanced Filter state integrations
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'goods' | 'services'>('all');
  const [filterValueMax, setFilterValueMax] = useState<number>(100000);
  const [filterCondition, setFilterCondition] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'valueAsc' | 'valueDesc'>('newest');

  const categories = ['All', 'Goods', 'Services', 'Electronics', 'Furniture', 'Gaming', 'Fitness', 'Fashion', 'Books', 'Skills', 'Other'];

  const filteredListings = listings.filter(item => {
    // Geographical Hub Filtering
    const itemLoc = item.location?.toLowerCase() || '';
    const hubL = activeHub.toLowerCase();
    if (hubL !== 'worldwide' && hubL !== 'all') {
      if (itemLoc !== 'remote' && !itemLoc.includes(hubL) && !hubL.includes(itemLoc)) {
        return false;
      }
    }

    // Search query filter
    const matchesSearch = searchQuery 
      ? item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) 
      : true;
    
    if (!matchesSearch) return false;

    // Category filter
    if (activeCategory !== 'All') {
      if (activeCategory === 'Goods') {
        if (item.isService) return false;
      } else if (activeCategory === 'Services') {
        if (!item.isService) return false;
      } else {
        // Specific category matching (case insensitive with synonmys check)
        const itemCat = item.category?.toLowerCase() || '';
        const activeL = activeCategory.toLowerCase();
        if (itemCat !== activeL) {
          if (activeL === 'other' && itemCat === 'others') {
            // match
          } else if (activeL === 'others' && itemCat === 'other') {
            // match
          } else if (activeL === 'skills' && itemCat === 'freelance services') {
            // match
          } else if (activeL === 'services' && (itemCat === 'freelance services' || itemCat === 'skills' || itemCat === 'tutoring' || itemCat === 'digital services')) {
            // match
          } else {
            return false;
          }
        }
      }
    }

    // Advanced Type filter
    if (filterType === 'goods' && item.isService) return false;
    if (filterType === 'services' && !item.isService) return false;

    // Advanced Price limits filter
    if (item.estimatedValue > filterValueMax) return false;

    // Advanced Condition quality filter
    if (filterCondition !== 'All') {
      const condL = item.condition?.toLowerCase() || '';
      const filterL = filterCondition.toLowerCase();
      if (condL !== filterL) {
        if (filterL === 'used' && (condL === 'good' || condL === 'used' || condL === 'fair' || condL === 'healthy')) {
          // match
        } else if (filterL === 'new' && condL === 'excellent') {
          // match
        } else {
          return false;
        }
      }
    }

    return true;
  });

  // Sort feed based on criteria
  const sortedAndFilteredListings = [...filteredListings].sort((a, b) => {
    if (sortBy === 'valueAsc') {
      return a.estimatedValue - b.estimatedValue;
    }
    if (sortBy === 'valueDesc') {
      return b.estimatedValue - a.estimatedValue;
    }
    // Newest / default order (id descending or list index)
    return b.id.localeCompare(a.id);
  });

  return (
    <div className="pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100/90 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.015)] transition-all">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div 
              onClick={() => navigate('/profile')}
              className="w-12 h-12 rounded-[20px] bg-brand-accent p-0.5 border border-brand-primary/10 shadow-sm flex-shrink-0 cursor-pointer hover:rotate-2 transition-transform overflow-hidden select-none"
            >
              <img src={userObj.avatar} alt={userObj.name} className="w-full h-full object-cover rounded-[18px]" />
            </div>
            
            <div className="flex flex-col text-left">
              <span className="text-[9px] font-black uppercase tracking-widest text-[#0284c7] font-mono leading-none mb-1">
                {getGreeting()},
              </span>
              <h1 className="text-xl font-display text-text-charcoal font-black tracking-tight flex items-center gap-1.5 leading-none">
                {userObj.name.split(' ')[0]} <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-pulse" title="Online in Surat Hub"></span>
              </h1>
              
              {/* Active Hub Selection Pill */}
              <div 
                onClick={() => setShowHubSelector(true)} 
                className="cursor-pointer group mt-1 self-start"
              >
                <span className="text-[9px] font-extrabold uppercase tracking-wider bg-sky-50 text-[#0284c7] border border-sky-100/60 py-0.5 px-2 rounded-full select-none inline-flex items-center gap-1 hover:bg-[#e0f2fe] hover:text-[#0369a1] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <MapPin size={9} className="text-[#0284c7] animate-bounce" /> {activeHub}
                  <span className="text-[7.5px] text-[#38bdf8] font-bold ml-0.5 group-hover:text-[#0284c7]">(change)</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => navigate('/inbox', { state: { selectedTab: 'matches' } })}
              title="Notifications"
              className="w-11 h-11 bg-white border border-border-sleek rounded-2xl flex items-center justify-center text-text-charcoal shadow-sm hover:bg-slate-50 hover:-translate-y-0.5 active:translate-y-0 transition-all relative cursor-pointer"
            >
              <Bell size={18} className="text-text-charcoal/80" />
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-brand-primary border-2 border-white rounded-full flex items-center justify-center font-mono">
                <span className="text-[8px] font-black text-brand-accent">1</span>
              </span>
            </button>
            <button 
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              title="Toggle Filters"
              className={cn(
                "w-11 h-11 border rounded-2xl flex items-center justify-center shadow-sm transition-all relative cursor-pointer",
                showAdvancedFilters 
                  ? "bg-brand-primary border-brand-primary text-white shadow-lg shadow-brand-primary/25 hover:bg-brand-primary/95" 
                  : "bg-white border-border-sleek text-text-charcoal/80 hover:bg-slate-50 hover:-translate-y-0.5"
              )}
            >
              <Filter size={18} />
              {(filterType !== 'all' || filterValueMax < 100000 || filterCondition !== 'All' || sortBy !== 'newest' || activeCategory !== 'All') && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#4f46e5] text-white text-[8px] font-black rounded-full border border-white flex items-center justify-center shadow-lg animate-pulse">✓</span>
              )}
            </button>
          </div>
        </div>
        
        {/* Search Bar - modern minimal look */}
        <div className="relative mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-charcoal/30" size={16} />
          <input 
            type="text" 
            placeholder="Search goods, gear or skills nearby..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50/70 border border-slate-100/85 rounded-2xl py-3.5 pl-11 pr-4 text-xs font-bold font-sans focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0ea5e9]/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)] border-border-sleek/40 placeholder:text-text-charcoal/30 select-text text-text-charcoal transition-all font-medium"
          />
        </div>

        {/* Horizontally Scrollable Categories */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 -mx-2 px-2">
          {[
            { name: 'All', icon: '✨' },
            { name: 'Goods', icon: '📦' },
            { name: 'Services', icon: '💼' },
            { name: 'Electronics', icon: '🔌' },
            { name: 'Furniture', icon: '🛋️' },
            { name: 'Gaming', icon: '🎮' },
            { name: 'Fitness', icon: '💪' },
            { name: 'Fashion', icon: '👔' },
            { name: 'Books', icon: '📚' },
            { name: 'Skills', icon: '🧠' },
            { name: 'Other', icon: '🏷️' }
          ].map((cat) => {
            const isActive = activeCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[10px] font-extrabold tracking-wider uppercase whitespace-nowrap transition-all border cursor-pointer select-none",
                  isActive 
                    ? "bg-brand-primary text-white border-brand-primary shadow-sm" 
                    : "bg-surface-beige text-text-charcoal/70 border-border-sleek hover:bg-white"
                )}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Advanced Collapsible Filters Panel */}
      <AnimatePresence>
        {showAdvancedFilters && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden bg-white border-b border-border-sleek shadow-inner px-6 pb-6 space-y-4"
          >
            <div className="pt-4 flex items-center justify-between border-t border-border-sleek/50">
              <h3 className="text-[10px] font-black uppercase text-text-charcoal/40 tracking-wider">Advanced Core Filters</h3>
              <button 
                onClick={() => {
                  setFilterType('all');
                  setFilterValueMax(100000);
                  setFilterCondition('All');
                  setSortBy('newest');
                  setActiveCategory('All');
                }}
                className="text-[9px] font-black uppercase text-brand-primary hover:underline"
              >
                Reset Filters
              </button>
            </div>

            {/* Filter by Category Selection */}
            <div className="space-y-1.5 pb-2">
              <label className="text-[9px] font-black uppercase text-text-charcoal/50 tracking-wider">Trading Category</label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all cursor-pointer",
                      activeCategory === cat
                        ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                        : "bg-surface-beige text-text-charcoal/70 border-border-sleek hover:bg-white"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter by Listing Type */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-text-charcoal/50 tracking-wider">Listing Category Mode</label>
              <div className="flex gap-2">
                {(['all', 'goods', 'services'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer",
                      filterType === t 
                        ? "bg-brand-primary text-white border-brand-primary shadow-sm" 
                        : "bg-surface-beige text-text-charcoal/70 border-border-sleek hover:bg-white"
                    )}
                  >
                    {t === 'all' ? 'All' : t === 'goods' ? 'Goods Only' : 'Services Only'}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter by Condition */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-text-charcoal/50 tracking-wider">Condition / Quality Level</label>
              <div className="flex flex-wrap gap-1.5">
                {['All', 'Healthy', 'New', 'Excellent', 'Used'].map((cond) => (
                  <button
                    key={cond}
                    onClick={() => setFilterCondition(cond)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border transition-all cursor-pointer",
                      filterCondition === cond
                        ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                        : "bg-surface-beige text-text-charcoal/70 border-border-sleek hover:bg-white"
                    )}
                  >
                    {cond}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter by Max Estimated Value */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[9px] uppercase font-black text-text-charcoal/50 tracking-wider">
                <span>Maximum Value Limit</span>
                <span className="text-brand-primary font-black">₹{filterValueMax === 100000 ? "Any Value" : filterValueMax.toLocaleString()}</span>
              </div>
              <input 
                type="range"
                min="1000"
                max="100000"
                step="2000"
                value={filterValueMax}
                onChange={(e) => setFilterValueMax(Number(e.target.value))}
                className="w-full accent-brand-primary cursor-pointer focus:outline-none"
              />
              <div className="flex justify-between text-[8px] text-text-charcoal/30 font-black uppercase tracking-wider">
                <span>₹1,000</span>
                <span>₹50,000</span>
                <span>₹1,00,000+</span>
              </div>
            </div>

            {/* Sort Options */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-text-charcoal/50 tracking-wider">Sort Feed Ranking</label>
              <div className="flex gap-2">
                {[
                  { value: 'newest', label: '🆕 Newest' },
                  { value: 'valueAsc', label: '📉 Value: Low-High' },
                  { value: 'valueDesc', label: '📈 Value: High-Low' }
                ].map((sorting) => (
                  <button
                    key={sorting.value}
                    onClick={() => setSortBy(sorting.value as any)}
                    className={cn(
                      "flex-1 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-wider border transition-all cursor-pointer",
                      sortBy === sorting.value
                        ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                        : "bg-surface-beige text-text-charcoal/70 border-border-sleek hover:bg-white"
                    )}
                  >
                    {sorting.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feed - Instagram Style */}
      <div className="w-full space-y-4 pb-28 pt-2">
        {sortedAndFilteredListings.length > 0 ? (
          sortedAndFilteredListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))
        ) : (
          <div className="col-span-full text-center py-12 bg-white rounded-[32px] border border-border-sleek p-6">
            <p className="text-3xl mb-2">🔍</p>
            <p className="text-sm font-bold text-text-charcoal animate-pulse">No trades match query</p>
            <p className="text-xs text-text-charcoal/40 mt-1">Try another category, adjust criteria slider, or search query!</p>
          </div>
        )}
      </div>

      {/* Dynamic Barter Hub Selector Modal / Dialog */}
      <AnimatePresence>
        {showHubSelector && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowHubSelector(false)}
          >
            <motion.div 
              initial={{ y: 100, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 100, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[36px] p-6 shadow-2xl relative border border-border-sleek animate-fade-in"
            >
              <div className="w-12 h-1.5 bg-text-charcoal/10 rounded-full mx-auto mb-4 sm:hidden"></div>
              
              <div className="text-center space-y-2 mb-6">
                <div className="w-12 h-12 bg-[#e0f2fe] text-[#0284c7] rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                  <MapPin size={24} className="animate-pulse" />
                </div>
                <h3 className="text-lg font-display font-black text-text-charcoal">Geo-pinned Barter Hub</h3>
                <p className="text-xs text-text-charcoal/50 max-w-[280px] mx-auto">
                  Pin your trading location hub to see nearby items and skills, or auto-detect using live browser coordinates.
                </p>
              </div>

              {/* Auto Detect Action Button */}
              <button
                type="button"
                onClick={handleAutoDetectLocation}
                disabled={detectingLocation}
                className="w-full mb-4 bg-brand-primary text-white font-black uppercase tracking-wider text-xs py-4 rounded-[22px] shadow-lg flex items-center justify-center gap-2 hover:bg-brand-primary/95 transition-all cursor-pointer disabled:opacity-50"
              >
                {detectingLocation ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                    Accessing Geolocation API...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} className="text-brand-accent animate-bounce" />
                    Auto-Detect Near Me (GPS)
                  </>
                )}
              </button>

              <div className="relative flex py-2 items-center mb-4">
                <div className="flex-grow border-t border-border-sleek"></div>
                <span className="flex-shrink mx-4 text-[9px] font-black text-text-charcoal/20 uppercase tracking-widest">or choose a hub city</span>
                <div className="flex-grow border-t border-border-sleek"></div>
              </div>

              {/* Major Indian Hub cities */}
              <div className="grid grid-cols-2 gap-2 mb-6">
                {[
                  'Surat, Gujarat',
                  'Mumbai, Maharashtra',
                  'New Delhi, Delhi',
                  'Bengaluru, Karnataka',
                  'Ahmedabad, Gujarat',
                  'Pune, Maharashtra',
                  'Hyderabad, Telangana',
                  'Worldwide'
                ].map((city) => (
                  <button
                    key={city}
                    onClick={() => {
                      setActiveHub(city);
                      localStorage.setItem('barter_selected_hub', city);
                      setShowHubSelector(false);
                      triggerToast(`Switched active hub to ${city}! 📍`);
                    }}
                    className={cn(
                      "py-3 px-4 rounded-2xl text-[10px] font-bold uppercase tracking-wider border transition-all text-center cursor-pointer",
                      activeHub === city
                        ? "bg-[#e0f2fe] border-[#0284c7] text-[#0284c7] font-black scale-[1.02] shadow-sm"
                        : "bg-surface-beige border-border-sleek text-text-charcoal/70 hover:bg-white hover:border-text-charcoal/30"
                    )}
                  >
                    {city === 'Worldwide' ? '🌐 All (Worldwide)' : city.split(',')[0]}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowHubSelector(false)}
                  className="w-full bg-surface-beige hover:bg-text-charcoal/5 border border-border-sleek text-text-charcoal/80 font-black uppercase tracking-wider text-[10px] py-3.5 rounded-[18px] transition-all cursor-pointer text-center"
                >
                  Close Panel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Local floating toast indicator */}
      <AnimatePresence>
        {toastMessageLocal && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-6 right-6 bg-[#0f172a] text-[#38bdf8] border border-sky-900/30 font-bold text-[10px] uppercase tracking-widest p-4.5 rounded-[22px] shadow-2xl flex items-center justify-center gap-2 z-50 text-center"
          >
            <Sparkles size={12} className="animate-spin" />
            <span>{toastMessageLocal}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ListingCard = ({ listing }: { listing: Listing; key?: string }) => {
  const navigate = useNavigate();
  const [activeUser] = useAuth();
  const user = getActiveUserById(listing.userId);
  const [isLiked, setIsLiked] = useState(false);

  const minVal = Math.round(listing.estimatedValue * 0.85);
  const maxVal = Math.round(listing.estimatedValue * 1.15);
  const rangeStr = `₹${(minVal/1000).toFixed(0)}k–₹${(maxVal/1000).toFixed(0)}k`;

  let score = 75;
  for (let i = 0; i < listing.title.length; i++) {
    score = (score + listing.title.charCodeAt(i)) % 31 + 65;
  }

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border-y border-slate-100/90 sm:border sm:rounded-[24px] overflow-hidden flex flex-col shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.02)] transition-all cursor-pointer"
      onClick={() => navigate(`/listing/${listing.id}`)}
    >
      {/* 1. Post Header Row */}
      <div className="flex items-center justify-between p-3.5 px-4 bg-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-brand-accent p-0.5 border border-brand-primary/10 overflow-hidden flex-shrink-0 shadow-sm flex items-center justify-center">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              <span className="font-display font-black text-brand-primary text-[10px]">
                {user?.name.split(' ').map(n => n[0]).join('')}
              </span>
            )}
          </div>
          <div className="flex flex-col text-left min-w-0 leading-tight">
            <span className="text-[11.5px] font-black text-text-charcoal truncate flex items-center gap-0.5">
              {user?.name || 'User'}
              {user?.idVerified && (
                <ShieldCheck size={11} className="text-brand-secondary fill-brand-secondary/10 flex-shrink-0" />
              )}
            </span>
            <span className="text-[9.5px] text-text-charcoal/40 font-semibold truncate flex items-center gap-1 mt-0.5">
              <MapPin size={9} className="text-text-charcoal/30" /> {listing.location} • {listing.distance}
            </span>
          </div>
        </div>
        <button className="text-text-charcoal/45 hover:text-text-charcoal p-1 rounded-full cursor-pointer">
          <MoreVertical size={16} />
        </button>
      </div>

      {/* 2. Media Container */}
      <div className="relative aspect-[4/5] w-full bg-slate-50 overflow-hidden">
        {isVideoUrl(listing.images[0]) ? (
          <video src={getCleanMediaUrl(listing.images[0])} className="w-full h-full object-cover" muted autoPlay loop playsInline />
        ) : (
          <img src={getCleanMediaUrl(listing.images[0])} alt={listing.title} className="w-full h-full object-cover hover:scale-101 transition-transform duration-500" />
        )}
        
        {/* Dynamic Category Overlay Pill */}
        <div className="absolute top-3 left-4 flex gap-1.5 z-10">
          <span className="px-2.5 py-1 bg-black/45 backdrop-blur-md text-white text-[8px] font-extrabold uppercase rounded-full tracking-wider">
            {listing.condition || 'Verified'}
          </span>
          <span className="px-2.5 py-1 bg-brand-primary/80 backdrop-blur-md text-brand-accent text-[8px] font-extrabold uppercase rounded-full tracking-wider">
            {listing.isService ? '💼 Service' : '📦 Goods'}
          </span>
        </div>

        {/* Compatibility Score Overlay */}
        <div className="absolute top-3 right-4 z-10">
          <span className="px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-black uppercase rounded-full flex items-center gap-0.5 shadow-sm border border-emerald-400/20">
            <Sparkles size={9} className="fill-current text-white animate-pulse" />
            {score}% Match
          </span>
        </div>
      </div>

      {/* 3. Action Section */}
      <div className="p-4 pt-3.5 flex flex-col text-left bg-white border-t border-slate-50">
        {/* Caption Description */}
        <p className="text-xs text-text-charcoal leading-relaxed font-medium">
          <span className="font-black mr-1.5 text-text-charcoal">{user?.name.split(' ')[0]}</span>
          <span className="font-extrabold text-[12.5px] text-text-charcoal block mt-0.5 font-display">{listing.title}</span>
          <span className="text-text-charcoal/70 block mt-1 text-[11.5px]">{listing.description}</span>
        </p>

        {/* Trade Requirements (Wants) Caption Line */}
        <div className="mt-3.5 flex items-start gap-1.5 bg-emerald-50/50 border border-emerald-100/50 p-2.5 rounded-xl">
          <span className="text-emerald-700 font-extrabold uppercase text-[8px] tracking-wider bg-emerald-100 px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5 select-none">
            Looking For
          </span>
          <span className="text-xs font-semibold text-emerald-800 leading-normal">
            {listing.wants.join(' • ')}
          </span>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center gap-2.5 mt-4">
          {/* Like Heart Button */}
          <button 
            onClick={handleLike}
            className="flex-shrink-0 w-10.5 h-10.5 border border-slate-200/90 rounded-[14px] flex items-center justify-center text-text-charcoal hover:scale-105 active:scale-95 transition-all cursor-pointer bg-white"
          >
            <Heart size={18} className={cn(isLiked ? "fill-red-500 text-red-500" : "text-text-charcoal/70")} />
          </button>
          
          {/* Message Button */}
          <button 
            onClick={(e) => { e.stopPropagation(); navigate('/chat', { state: { listing, recipient: user } }); }}
            className="flex-1 py-3 border border-slate-200/90 rounded-[14px] font-bold text-[10px] uppercase tracking-wider text-text-charcoal hover:bg-slate-50 transition-all active:scale-95 cursor-pointer text-center bg-white"
          >
            Message
          </button>

          {/* Make Offer Button */}
          <button 
            onClick={(e) => { e.stopPropagation(); navigate(`/offer/${listing.id}`); }}
            className="flex-1 py-3 bg-brand-primary text-white rounded-[14px] font-bold text-[10px] uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer text-center"
          >
            Make Offer
          </button>
        </div>
        
        {/* Estimated Value & Date footer */}
        <div className="flex items-center justify-between mt-3.5 pt-3.5 border-t border-slate-100/50">
          <span className="text-[10px] font-black text-brand-primary bg-brand-accent/50 px-2.5 py-0.5 rounded-lg select-none">
            Est. Value: ₹{listing.estimatedValue.toLocaleString()}
          </span>
          <span className="text-[8px] text-text-charcoal/30 uppercase font-black tracking-widest select-none">
            {new Date(listing.createdAt || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

const PostPage = () => {
  const navigate = useNavigate();
  const [listings, setListings] = useListings();
  const [activeUser] = useAuth();
  
  // Form states
  const [listingTitle, setListingTitle] = useState('');
  const [listingDesc, setListingDesc] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [isServiceType, setIsServiceType] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Electronics');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  
  // Return criteria states
  const [isOpenToAny, setIsOpenToAny] = useState(false);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedNegCats, setSelectedNegCats] = useState<string[]>(['Electronics', 'Furniture']);

  // UI Interactive States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [publishingState, setPublishingState] = useState<'idle' | 'scanning' | 'match_found' | 'success'>('idle');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const categories = [
    'Electronics', 'Furniture', 'Fashion', 'Vehicles', 'Books', 
    'Home appliances', 'Freelance services', 'Tutoring', 'Fitness', 
    'Gaming', 'Art', 'Photography', 'Digital services', 'Others'
  ];

  // Map category to aesthetic default images for mock capture
  const MOCK_GALLERY: Record<string, { title: string; url: string }[]> = {
    'Electronics': [
      { title: 'Mechanical Keyboard RGB', url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&q=80&w=500' },
      { title: 'Sony Wireless Headphones', url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=500' }
    ],
    'Furniture': [
      { title: 'Ergonomic Office Chair', url: 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&q=80&w=500' },
      { title: 'Minimalist Wooden Desk', url: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&q=80&w=500' }
    ],
    'Fashion': [
      { title: 'Denim Vintage Jacket', url: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&q=80&w=500' },
      { title: 'Classic Leather Boots', url: 'https://images.unsplash.com/photo-1520639888713-7851133b1ed0?auto=format&fit=crop&q=80&w=500' }
    ],
    'Vehicles': [
      { title: 'Vintage Cruiser Bike', url: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&q=80&w=500' }
    ],
    'Books': [
      { title: 'Barter Design Books Set', url: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=500' }
    ],
    'Home appliances': [
      { title: 'Aesthetic Espresso Machine', url: 'https://images.unsplash.com/photo-1517256064527-09c53b2d0c6f?auto=format&fit=crop&q=80&w=500' }
    ],
    'Freelance services': [
      { title: 'Sleek Vector Brand Logo', url: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?auto=format&fit=crop&q=80&w=500' }
    ],
    'Tutoring': [
      { title: 'Interactive Calculus Sheet', url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=500' }
    ],
    'Fitness': [
      { title: 'Neoprene Dumbbells 5kg', url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&q=80&w=500' }
    ],
    'Gaming': [
      { title: 'Retro Wireless Handheld Console', url: 'https://images.unsplash.com/photo-1612287230202-1bf1d85d1bdf?auto=format&fit=crop&q=80&w=500' }
    ],
    'Art': [
      { title: 'Acrylic Abstract Canvas Art', url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&q=80&w=500' }
    ],
    'Photography': [
      { title: 'f/1.4 Portrait Lens 50mm', url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=500' }
    ],
    'Digital services': [
      { title: 'Tailwind React Frontend Coding', url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&q=80&w=500' }
    ],
    'Others': [
      { title: 'Succulent Potted Plant Set', url: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&q=80&w=500' }
    ]
  };

  const currentCategoryGallery = MOCK_GALLERY[selectedCategory] || MOCK_GALLERY['Electronics'];

  const startCameraStream = async (mode: 'photo' | 'video' = 'photo') => {
    try {
      setIsCameraActive(true);
      setCameraMode(mode);
      setRecordingSeconds(0);
      setIsRecording(false);
      
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      
      const constraints: MediaStreamConstraints = {
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: mode === 'video'
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 300);
      
    } catch (err) {
      console.error('Camera stream access failed or permission issue:', err);
      showToast('Live camera is unavailable. Feel free to use the native snap fallback! 📸');
    }
  };

  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setUploadedImages(prev => [...prev, dataUrl].slice(0, 5));
          showToast('Prisinte photo captured live! 📸');
          stopCameraStream();
        } catch (e) {
          showToast('Failed to render photo capture.');
        }
      }
    }
  };

  const startRecording = () => {
    if (!mediaStreamRef.current) {
      showToast('Camera active stream missing.');
      return;
    }
    chunksRef.current = [];
    
    let options = {};
    const mimeTypes = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'];
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        options = { mimeType: type };
        break;
      }
    }

    try {
      const recorder = new MediaRecorder(mediaStreamRef.current, options);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const videoBlob = new Blob(chunksRef.current as any[], { type: (chunksRef.current[0] as any)?.type || 'video/mp4' });
        const objectUrl = 'video:' + URL.createObjectURL(videoBlob);
        setUploadedImages(prev => [...prev, objectUrl].slice(0, 5));
        showToast('Video clip recorded beautifully! 🎥');
        stopCameraStream();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 15) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      
      showToast('Recording started... ⏺️');
    } catch (err) {
      console.error('Recording initialization failed', err);
      showToast('Web browser could not capture audio/video.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, 3000);
  };

  // Add tag want
  const addCustomTag = () => {
    if (!tagInput.trim()) return;
    if (customTags.includes(tagInput.trim())) {
      showToast('Tag already added');
      return;
    }
    setCustomTags(prev => [...prev, tagInput.trim()]);
    setTagInput('');
  };

  const removeCustomTag = (indexToRemove: number) => {
    setCustomTags(tags => tags.filter((_, idx) => idx !== indexToRemove));
  };

  const toggleBroadNegCat = (cat: string) => {
    setSelectedNegCats(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  // Publish flow with Instant Match Check
  const publishTrade = () => {
    if (!listingTitle.trim()) {
      showToast('Please provide what you are offering');
      return;
    }
    if (!estimatedValue) {
      showToast('Please set an estimated value');
      return;
    }
    if (uploadedImages.length === 0) {
      showToast('Please upload or snap at least one photo');
      return;
    }

    setPublishingState('scanning');

    // Artificial scan delay
    setTimeout(() => {
      // 50% chance or if they want monstera/plant/yoga to find an instant trade with Priya S.
      const searchTerms = [...customTags, tagInput, ...selectedNegCats].map(s => s.toLowerCase());
      const hasMatchWord = searchTerms.some(t => t.includes('plant') || t.includes('yoga') || t.includes('garden') || t.includes('flower') || t.includes('monstera') || t.includes('service'));
      
      if (hasMatchWord || Math.random() > 0.4) {
        setPublishingState('match_found');
      } else {
        completePublishingDirect();
      }
    }, 2800);
  };

  const completePublishingDirect = () => {
    const finalImages = uploadedImages.length > 0 ? uploadedImages : [currentCategoryGallery[0].url];
    const userLoc = activeUser?.location || localStorage.getItem('barter_selected_hub') || 'Surat, Gujarat';
    const newListingItem: Listing = {
      id: 'l_' + Date.now(),
      userId: activeUser?.id || 'me',
      title: listingTitle.substring(0, 40),
      description: listingDesc || `Exchange offer of ${listingTitle}`,
      images: finalImages,
      category: selectedCategory,
      condition: isServiceType ? 'Professional Skill' : 'Excellent condition',
      estimatedValue: Number(estimatedValue) || 1200,
      location: userLoc,
      distance: '0.1km away',
      wants: isOpenToAny ? ['Open to negotiate'] : (customTags.length > 0 ? customTags : ['Fair swap']),
      openToNegotiate: isOpenToAny,
      negotiableCategories: isOpenToAny ? selectedNegCats : [],
      tags: [isServiceType ? 'Service' : 'Goods', 'Self Upload'],
      createdAt: new Date().toISOString(),
      isService: isServiceType
    };

    setListings((prev: Listing[]) => [newListingItem, ...prev]);
    setPublishingState('success');
    
    setTimeout(() => {
      navigate('/');
    }, 1800);
  };

  const acceptMatchSwap = () => {
    // Generate the listings and also mock adding an active matching offer in memory!
    const finalImages = uploadedImages.length > 0 ? uploadedImages : [currentCategoryGallery[0].url];
    const userLoc = activeUser?.location || localStorage.getItem('barter_selected_hub') || 'Surat, Gujarat';
    const matchingListingId = 'l_' + Date.now();
    const newListingItem: Listing = {
      id: matchingListingId,
      userId: activeUser?.id || 'me',
      title: listingTitle.substring(0, 40),
      description: listingDesc || `Exchange offer of ${listingTitle}`,
      images: finalImages,
      category: selectedCategory,
      condition: isServiceType ? 'Professional Skill' : 'Excellent condition',
      estimatedValue: Number(estimatedValue) || 1500,
      location: userLoc,
      distance: '0.1km away',
      wants: ['Monstera Plant'],
      openToNegotiate: true,
      negotiableCategories: ['Other'],
      tags: [isServiceType ? 'Service' : 'Goods', 'Instant Swapped'],
      createdAt: new Date().toISOString(),
      isService: isServiceType
    };

    // Prepend new listing and trigger simulated success transition
    setListings((prev: Listing[]) => [newListingItem, ...prev]);
    
    // Add match offer from Priya
    const matchedOffer: Offer = {
      id: 'o_match_' + Date.now(),
      listingId: matchingListingId,
      senderId: 'priya',
      receiverId: activeUser?.id || 'me',
      offeredItemIds: ['l1'],
      offeredDescription: 'Monstera Plant (large) 🌿',
      status: 'pending',
      createdAt: new Date().toISOString(),
      note: 'Hey! Your new upload is an instant match for my Monstera plant. Lets trade!'
    };
    mockOffers.unshift(matchedOffer);

    setPublishingState('success');
    setTimeout(() => {
      navigate('/inbox');
    }, 1800);
  };

  return (
    <div className="bg-surface-beige min-h-screen pb-32 relative overflow-x-hidden">
      {/* Toast notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-6 left-6 right-6 bg-brand-primary text-white font-bold text-xs p-4 rounded-2xl shadow-xl border border-brand-primary/20 flex items-center justify-between z-50 text-center uppercase tracking-wider"
          >
            <span>{toastMessage}</span>
            <X size={14} className="opacity-70 cursor-pointer" onClick={() => setToastMessage(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Publishing Stages Screens */}
      <AnimatePresence mode="wait">
        {publishingState === 'scanning' && (
          <motion.div 
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-brand-primary h-screen w-full flex flex-col items-center justify-center p-6 z-50 text-white"
          >
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center border-4 border-dashed border-brand-accent animate-spin mb-6">
              <Zap size={40} className="text-brand-accent animate-bounce" />
            </div>
            <h2 className="text-2xl font-display font-bold text-center">BarterHub Match Engine™</h2>
            <p className="text-xs text-brand-accent uppercase tracking-widest font-bold mt-2">Checking Swap Compatibility</p>
            
            <div className="space-y-2 mt-8 w-full max-w-[280px]">
              <div className="flex gap-2 items-center text-xs opacity-60">
                <Clock size={12} /> <span>Scanning Surat local radius...</span>
              </div>
              <div className="flex gap-2 items-center text-xs text-brand-accent font-bold">
                <Zap size={12} className="animate-pulse" /> <span>Matching listing value criteria...</span>
              </div>
              <div className="flex gap-2 items-center text-xs opacity-60">
                <Lock size={12} /> <span>Auditing certified safe-swap ledger...</span>
              </div>
            </div>
          </motion.div>
        )}

        {publishingState === 'match_found' && (
          <motion.div 
            key="match_found"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white h-screen w-full flex flex-col justify-between p-6 z-50 overflow-y-auto"
          >
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-4 animate-bounce">
                <Sparkles size={32} />
              </div>
              <h2 className="text-3xl font-display font-black text-text-charcoal text-center leading-tight">Instant Swap Found!</h2>
              <p className="text-xs text-emerald-700 font-bold uppercase tracking-widest mt-1">Perfect Double Match</p>
              
              <div className="w-full max-w-[340px] my-8 p-6 bg-[#f0fdfa] rounded-[40px] border border-emerald-500/20 shadow-xl shadow-emerald-700/5 relative">
                {/* Instant connection overlay circles */}
                <div className="absolute top-[43%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border-4 border-white z-20 animate-pulse">
                  <Repeat size={18} className="animate-spin" style={{ animationDuration: '6s' }} />
                </div>

                <div className="space-y-4">
                  {/* Your prospective item */}
                  <div className="flex gap-4 items-center bg-white p-3 rounded-3xl border border-dashed border-emerald-500/10">
                    <div className="w-14 h-14 bg-surface-beige rounded-2xl overflow-hidden flex-shrink-0">
                      {isVideoUrl(uploadedImages[0]) ? (
                        <video src={getCleanMediaUrl(uploadedImages[0])} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                      ) : (
                        <img src={getCleanMediaUrl(uploadedImages[0] || currentCategoryGallery[0].url)} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-text-charcoal/40 uppercase tracking-widest">You are offering</p>
                      <p className="text-xs font-bold text-text-charcoal">{listingTitle || 'Your item'}</p>
                    </div>
                  </div>

                  {/* Priya item */}
                  <div className="flex gap-4 items-center bg-white p-3 rounded-3xl border border-dashed border-emerald-500/10">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-emerald-50">
                      <img src="https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&q=80&w=400" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest">You will receive</p>
                      <p className="text-xs font-bold text-text-charcoal">Monstera plant (large) 🌿</p>
                      <p className="text-[10px] text-text-charcoal/40 mt-0.5">from Priya S. (2km away)</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-brand-accent p-4 rounded-3xl text-center max-w-[300px] border border-brand-primary/5">
                <p className="text-xs leading-relaxed text-brand-primary font-medium">
                  <strong>Priya S.</strong> is looking for exactly what you listed, and she is offering what you desire!
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={acceptMatchSwap}
                className="w-full py-5 bg-[#030712] text-white rounded-[24px] text-sm font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
              >
                Accept Instant Swaps <Sparkles size={16} />
              </button>
              <button 
                onClick={completePublishingDirect}
                className="w-full py-4 text-xs font-bold text-text-charcoal/50 uppercase tracking-widest text-center hover:text-text-charcoal"
              >
                No, Just Publish Generally
              </button>
            </div>
          </motion.div>
        )}

        {publishingState === 'success' && (
          <motion.div 
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#0ea5e9] h-screen w-full flex flex-col items-center justify-center p-6 z-50 text-white"
          >
            <div className="w-20 h-20 bg-white text-[#0ea5e9] rounded-2xl flex items-center justify-center shadow-2xl mb-4 border-2 border-white animate-scale-in">
              <CheckCircle2 size={44} className="stroke-[2.5]" />
            </div>
            <h2 className="text-2xl font-display font-bold">Successfully Published!</h2>
            <p className="text-xs text-white/80 mt-1 uppercase tracking-wider">Trading space updated live</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Form Navigation */}
      <header className="p-6 sticky top-0 bg-white/80 backdrop-blur-md border-b border-border-sleek flex items-center gap-4 z-40">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-surface-beige transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-display font-bold text-text-charcoal">Post a Trade</h1>
      </header>

      {/* Form Content */}
      <div className="p-6 space-y-8 max-w-sm mx-auto">
        
        {/* Step 1: Media Capture Option */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-text-charcoal/40">Photos & Videos (Snap or Pick)</label>
            <button 
              type="button"
              onClick={() => setShowGallery(true)}
              className="text-[9px] uppercase font-bold text-brand-primary"
            >
              Pick Stock Presets Key
            </button>
          </div>
          
          {/* Core Device Input Triggers */}
          <input 
            type="file" 
            id="native-capture-fallback" 
            accept="image/*,video/*" 
            capture="environment" 
            className="hidden" 
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) {
                const file: any = files[0];
                const objectUrl = URL.createObjectURL(file);
                const isVideo = file.type.startsWith('video/');
                const finalUrl = isVideo ? 'video:' + objectUrl : objectUrl;
                setUploadedImages(prev => [...prev, finalUrl].slice(0, 5));
                showToast(isVideo ? 'Video recorded natively and uploaded! 🎥' : 'Photo captured natively and uploaded! 📸');
                stopCameraStream();
              }
            }}
          />

          <input 
            type="file" 
            id="gallery-file-input" 
            accept="image/*,video/*" 
            multiple 
            className="hidden" 
            onChange={(e) => {
              const files = e.target.files;
              if (files) {
                const fileArr = Array.from(files);
                if (uploadedImages.length + fileArr.length > 5) {
                  showToast('Maximum 5 media items allowed');
                }
                const newMedia: string[] = [];
                fileArr.forEach((file: any) => {
                  const objectUrl = URL.createObjectURL(file);
                  const isVideo = file.type.startsWith('video/');
                  const finalUrl = isVideo ? 'video:' + objectUrl : objectUrl;
                  newMedia.push(finalUrl);
                });
                setUploadedImages(prev => [...prev, ...newMedia].slice(0, 5));
                showToast(`Loaded ${fileArr.length} files from device! 📁`);
              }
            }}
          />

          <div className="grid grid-cols-2 gap-4">
            
            {/* Live Camera Dialog Action */}
            <button 
              type="button"
              onClick={() => startCameraStream('photo')}
              className="py-6 px-4 bg-white border border-border-sleek rounded-[28px] shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-brand-accent/30 transition-all cursor-pointer relative overflow-hidden group active:scale-95"
            >
              <div className="w-10 h-10 rounded-2xl bg-brand-accent flex items-center justify-center text-brand-primary group-hover:scale-110 transition-transform">
                <Camera size={20} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-charcoal/60">Take Photo/Video</span>
            </button>

            {/* Core Device File Selector */}
            <button 
              type="button"
              onClick={() => document.getElementById('gallery-file-input')?.click()}
              className="py-6 px-4 bg-white border border-border-sleek rounded-[28px] shadow-sm flex flex-col items-center justify-center gap-2 hover:bg-brand-accent/30 transition-all cursor-pointer group active:scale-95"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#06b6d4]/10 flex items-center justify-center text-[#06b6d4] group-hover:scale-110 transition-transform">
                <Image size={20} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-charcoal/60">Choose from Device</span>
            </button>
          </div>

          {/* Real-time Interactive Camera Stream Layout Modal */}
          {isCameraActive && (
            <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex flex-col items-center justify-between p-6 text-white animate-fade-in">
              
              {/* Top Panel Actions */}
              <div className="w-full max-w-sm flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-bold text-white/70 tracking-widest uppercase">Barter Camera Stream</span>
                </div>
                <button 
                  type="button"
                  onClick={stopCameraStream} 
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Instant Tab Switching Controls */}
              <div className="flex bg-white/10 p-1.5 rounded-2xl w-full max-w-xs justify-center items-center">
                <button
                  type="button"
                  onClick={() => startCameraStream('photo')}
                  disabled={isRecording}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer",
                    cameraMode === 'photo' ? "bg-white text-black shadow-lg" : "text-white/60 hover:text-white"
                  )}
                >
                  Photo Mode 📸
                </button>
                <button
                  type="button"
                  onClick={() => startCameraStream('video')}
                  disabled={isRecording}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer",
                    cameraMode === 'video' ? "bg-white text-black shadow-lg" : "text-white/60 hover:text-white"
                  )}
                >
                  Video Mode 🎥
                </button>
              </div>

              {/* Viewport Frame Box with real-time media track */}
              <div className="relative w-full max-w-sm aspect-[4/3] rounded-[36px] overflow-hidden bg-zinc-950 border border-white/5 flex items-center justify-center shadow-2xl">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover" 
                />
                
                {isRecording && (
                  <div className="absolute top-4 left-4 flex items-center gap-1.5 bg-red-600 px-3 py-1.5 rounded-full text-[9px] font-bold tracking-widest uppercase animate-pulse shadow-md">
                    <span className="w-2 h-2 rounded-full bg-white block"></span>
                    REC {recordingSeconds}s / 15s limit
                  </div>
                )}
                
                {!mediaStreamRef.current && (
                  <div className="absolute inset-0 bg-zinc-950/90 flex flex-col items-center justify-center p-6 text-center gap-3">
                    <span className="text-4xl animate-bounce">🎥</span>
                    <p className="text-xs font-semibold text-white/80">Connecting camera feed...</p>
                    <p className="text-[10px] text-white/45 max-w-[200px]">Allow webcam permissions when prompted or click below to snap natively instead</p>
                  </div>
                )}
              </div>

              {/* Controls Footer */}
              <div className="w-full max-w-sm flex flex-col items-center gap-3 mb-6">
                
                <div className="flex items-center justify-center w-full">
                  {cameraMode === 'photo' ? (
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="w-20 h-20 rounded-full bg-white border-[6px] border-white/20 hover:scale-105 active:scale-95 transition-all text-black flex items-center justify-center shadow-lg cursor-pointer"
                      title="Capture Photo Frame"
                    >
                      <Camera size={26} className="text-black" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={isRecording ? stopRecording : startRecording}
                      className={cn(
                        "w-20 h-20 rounded-full border-[6px] transition-all flex items-center justify-center shadow-lg cursor-pointer active:scale-95",
                        isRecording 
                          ? "bg-red-500 border-red-500/25 animate-pulse" 
                          : "bg-white border-white/20"
                      )}
                      title={isRecording ? "Stop Video Clip" : "Start Video Clip"}
                    >
                      {isRecording ? (
                        <span className="w-6 h-6 bg-white rounded-lg block"></span>
                      ) : (
                        <span className="w-6 h-6 bg-red-600 rounded-full block animate-ping" style={{ animationDuration: '2.5s' }}></span>
                      )}
                    </button>
                  )}
                </div>

                {/* Direct native camera launcher trigger fallback */}
                <div className="w-full flex justify-center mt-1">
                  <label 
                    htmlFor="native-capture-fallback" 
                    className="text-[10px] text-brand-accent hover:text-white font-black tracking-widest uppercase cursor-pointer border border-brand-accent/20 hover:border-white px-4 py-2.5 rounded-xl transition-all bg-white/5 flex items-center gap-1.5 active:scale-95"
                  >
                    <Camera size={14} /> Tap to Open System Camera App
                  </label>
                </div>
                
                <p className="text-[9px] text-zinc-500 text-center uppercase tracking-widest font-black mt-2">Prisinte dynamic compression engine active</p>
              </div>
            </div>
          )}

          {/* Uploaded thumbnails list */}
          {uploadedImages.length > 0 && (
            <div className="bg-white p-4 rounded-[28px] border border-border-sleek shadow-sm animate-fade-in">
              <p className="text-[9px] font-bold uppercase text-text-charcoal/30 tracking-widest mb-3">Selected Media ({uploadedImages.length}/5)</p>
              <div className="flex flex-wrap gap-2.5">
                {uploadedImages.map((img, idx) => (
                  <div key={idx} className="relative w-14 h-14 rounded-xl overflow-hidden border border-border-sleek group bg-surface-beige flex-shrink-0">
                    {isVideoUrl(img) ? (
                      <video src={getCleanMediaUrl(img)} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                    ) : (
                      <img src={getCleanMediaUrl(img)} className="w-full h-full object-cover" />
                    )}
                    <button 
                      type="button"
                      onClick={() => setUploadedImages(imgs => imgs.filter((_, i) => i !== idx))}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600 transition-colors cursor-pointer"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Segmented type control */}
        <div className="space-y-3">
          <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-text-charcoal/40">Listing Type</label>
          <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl border border-transparent">
            <button 
              type="button"
              onClick={() => setIsServiceType(false)}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all text-center flex justify-center items-center gap-1.5",
                !isServiceType ? "bg-white text-brand-primary shadow-sm" : "text-text-charcoal/40 hover:text-text-charcoal"
              )}
            >
              <Package size={14} /> Goods / Item
            </button>
            <button 
              type="button"
              onClick={() => setIsServiceType(true)}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all text-center flex justify-center items-center gap-1.5",
                isServiceType ? "bg-white text-brand-primary shadow-sm" : "text-text-charcoal/40 hover:text-text-charcoal"
              )}
            >
              <Sparkles size={14} /> Services / Skills
            </button>
          </div>
        </div>

        {/* Step 3: Scrollable Category Selection */}
        <div className="space-y-3">
          <div className="flex justify-between items-center mb-1">
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-text-charcoal/40">Listing Category</label>
            <span className="text-[9px] uppercase font-bold text-brand-primary bg-brand-accent p-1.5 py-0.5 rounded">{selectedCategory}</span>
          </div>
          
          <div className="flex gap-2 flex-wrap max-h-40 overflow-y-auto p-2 bg-white rounded-3xl border border-border-sleek scrollbar-hide">
            {categories.map(cat => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    // Clear uploaded list or seed if empty
                    setUploadedImages([]);
                  }}
                  className={cn(
                    "px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all border shrink-0 flex items-center gap-1 cursor-pointer active:scale-95",
                    isSelected 
                      ? "bg-brand-primary text-white border-brand-primary shadow-md shadow-brand-primary/10" 
                      : "bg-surface-beige text-text-charcoal/65 border-transparent hover:border-brand-primary/30"
                  )}
                >
                  {isSelected && <Check size={10} />}
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 4: Title, Description, and Price fields */}
        <div className="space-y-5 bg-white p-6 rounded-[32px] border border-border-sleek shadow-sm">
          
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-text-charcoal/40">Item / Skill Name</label>
            <input 
              type="text" 
              placeholder={isServiceType ? "e.g., Professional Web Development, Yoga Session" : "e.g., Vintage DSLR Camera, Aloe Vera Plant"} 
              value={listingTitle}
              onChange={(e) => setListingTitle(e.target.value)}
              maxLength={40}
              className="w-full border-b border-border-sleek py-2 text-sm font-semibold focus:border-brand-primary outline-none transition-all placeholder:text-text-charcoal/20" 
            />
            <div className="text-[9px] text-right text-text-charcoal/30 uppercase mt-0.5 font-mono">{listingTitle.length}/40</div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-text-charcoal/40">Estimated Value (₹)</label>
            <input 
              type="number" 
              placeholder="e.g. 5000" 
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              className="w-full border-b border-border-sleek py-2 text-sm font-semibold focus:border-brand-primary outline-none transition-all placeholder:text-text-charcoal/20" 
            />
            <p className="text-[9px] text-text-charcoal/40 leading-relaxed font-semibold mt-1 flex items-center gap-1">
              <Info size={11} /> Value estimation aligns items perfectly for instant matches.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-text-charcoal/40">Details & Story</label>
            <textarea 
              rows={3}
              placeholder="Describe condition, specifications, age or highlights..." 
              value={listingDesc}
              onChange={(e) => setListingDesc(e.target.value)}
              className="w-full resize-none bg-surface-beige p-3 rounded-2xl text-xs font-semibold focus:ring-1 focus:ring-brand-primary outline-none transition-all" 
            />
          </div>
        </div>

        {/* Step 5: What do you want Section - Tag builder + Open to negotiation toggle */}
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 py-3 rounded-3xl border border-border-sleek shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-charcoal">Open to Anything</p>
              <p className="text-[9px] text-text-charcoal/40 font-semibold uppercase mt-0.5">Accept broad negotiations</p>
            </div>
            <button 
              type="button"
              onClick={() => setIsOpenToAny(!isOpenToAny)}
              className={cn(
                "w-12 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer",
                isOpenToAny ? "bg-emerald-500" : "bg-slate-300"
              )}
            >
              <span className={cn("bg-white w-4 h-4 rounded-full shadow-lg transition-transform", isOpenToAny ? "translate-x-6" : "translate-x-0")} />
            </button>
          </div>

          {/* Conditional block for Open To negotiate or Specific wants */}
          <AnimatePresence mode="wait">
            {isOpenToAny ? (
              <motion.div 
                key="any"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-[#f0fdfa]/60 border border-dashed border-emerald-300/40 rounded-[32px] p-6 space-y-4"
              >
                <div className="flex gap-2 items-start">
                  <span className="text-xl">🌿</span>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Broad Exchange Options</h4>
                    <p className="text-[10px] leading-relaxed text-emerald-700 font-semibold mt-0.5">Select broad categories you are willing to check for mutual swaps:</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {['Electronics', 'Furniture', 'Fashion', 'Fitness', 'Others'].map(cat => {
                    const active = selectedNegCats.includes(cat);
                    return (
                      <button 
                        type="button"
                        key={cat}
                        onClick={() => toggleBroadNegCat(cat)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase border transition-all cursor-pointer",
                          active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-emerald-700/60 border-emerald-200"
                        )}
                      >
                        {cat} {active ? '✓' : '+'}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="specific"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-white p-6 rounded-[32px] border border-border-sleek shadow-sm space-y-4"
              >
                <div>
                  <h4 className="text-xs font-bold text-text-charcoal uppercase tracking-wider">Specific Exchange Wants</h4>
                  <p className="text-[10px] text-text-charcoal/40 font-semibold uppercase mt-0.5">What specific items are you looking for?</p>
                </div>

                <div className="flex gap-2 relative">
                  <input 
                    type="text" 
                    placeholder="e.g. Acoustic Guitar, MacBook Pro" 
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomTag();
                      }
                    }}
                    className="flex-1 bg-surface-beige py-2 px-4 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-brand-primary outline-none transition-all placeholder:text-text-charcoal/30 text-text-charcoal" 
                  />
                  <button 
                    type="button"
                    onClick={addCustomTag}
                    className="p-3.5 px-4 bg-brand-primary text-white rounded-xl text-xs font-bold hover:scale-105 active:scale-95 transition-all text-center flex-shrink-0"
                  >
                    + Add
                  </button>
                </div>

                {customTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-border-sleek/50">
                    {customTags.map((tag, tIdx) => (
                      <span 
                        key={tIdx} 
                        onClick={() => removeCustomTag(tIdx)}
                        className="px-3 py-1 bg-brand-accent/50 text-brand-primary text-[10px] font-bold uppercase tracking-wider rounded-xl border border-brand-primary/10 cursor-pointer flex items-center gap-1 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                        title="Click to remove"
                      >
                        {tag} <X size={10} />
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Publish Action Button */}
        <button 
          onClick={publishTrade}
          className="w-full bg-brand-primary text-white py-5 rounded-[24px] font-bold text-sm uppercase tracking-[0.2em] shadow-xl shadow-brand-primary/20 hover:bg-[#030712] transition-colors active:scale-95 text-center cursor-pointer flex items-center justify-center gap-2 mt-4"
        >
          Publish Trade Exchange
        </button>

      </div>

      {/* Mock Gallery Select Overlay */}
      <AnimatePresence>
        {showGallery && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end justify-center z-50 p-4"
            onClick={() => setShowGallery(false)}
          >
            <motion.div 
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              exit={{ y: 200 }}
              className="bg-white rounded-[40px] w-full max-w-[440px] p-6 space-y-5 pb-8 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center border-b border-border-sleek pb-4">
                <div>
                  <h3 className="text-sm font-bold text-text-charcoal uppercase tracking-wider">Device Gallery</h3>
                  <p className="text-[10px] text-text-charcoal/40 font-semibold uppercase">{selectedCategory} Previews</p>
                </div>
                <button 
                  onClick={() => setShowGallery(false)}
                  className="w-8 h-8 rounded-full bg-surface-beige flex items-center justify-center cursor-pointer text-text-charcoal/30 hover:text-text-charcoal"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3.5 max-h-[240px] overflow-y-auto pr-1">
                {currentCategoryGallery.map((img, idx) => {
                  const alreadySelected = uploadedImages.includes(img.url);
                  return (
                    <div 
                      key={idx}
                      onClick={() => {
                        if (alreadySelected) {
                          setUploadedImages(imgs => imgs.filter(i => i !== img.url));
                        } else {
                          setUploadedImages(imgs => [...imgs, img.url].slice(0, 5));
                        }
                      }}
                      className={cn(
                        "relative aspect-video rounded-2xl overflow-hidden border cursor-pointer select-none group focus:outline-none",
                        alreadySelected ? "border-brand-primary ring-2 ring-brand-primary/10 scale-95" : "border-border-sleek"
                      )}
                    >
                      <img src={img.url} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent p-3 flex items-end">
                        <p className="text-[9px] font-bold text-white uppercase tracking-wider truncate w-full">{img.title}</p>
                      </div>
                      {alreadySelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-brand-primary text-white rounded-full flex items-center justify-center shadow-lg">
                          <Check size={11} className="stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button 
                onClick={() => setShowGallery(false)}
                className="w-full py-4 bg-text-charcoal text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest text-center shadow shadow-black/10 hover:bg-brand-primary cursor-pointer mt-4"
              >
                Confirm Selection
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

const TradeCard = ({ offer }: { offer: Offer; key?: string }) => {
  const listing = getLocalListings().find(l => l.id === offer.listingId);
  const sender = getActiveUserById(offer.senderId);

  return (
    <div className="bg-white rounded-[32px] border border-border-sleek overflow-hidden shadow-sm">
      <div className="bg-brand-accent/50 p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-brand-primary rounded-lg flex items-center justify-center text-white">
            <Repeat size={14} />
          </div>
          <span className="text-xs font-bold text-brand-primary">New offer from {sender?.name || 'User'}</span>
        </div>
        <span className="text-[10px] font-bold text-text-charcoal/40 uppercase tracking-widest italic">2h ago</span>
      </div>
      <div className="p-6 space-y-4">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest font-bold text-text-charcoal/30">Targeting your:</p>
          <p className="text-sm font-bold text-text-charcoal">{listing?.title || 'Your Listing'}</p>
        </div>
        <div className="p-4 bg-surface-beige rounded-2xl border border-border-sleek">
          <p className="text-[10px] uppercase tracking-widest font-bold text-text-charcoal/30 mb-1">They're offering:</p>
          <p className="text-sm font-bold text-brand-primary flex gap-2 items-center">
             <span className="text-lg">🌿</span> {offer.offeredDescription}
          </p>
        </div>
        
        <div className="grid grid-cols-3 gap-3 pt-2">
          <button className="py-3 border border-border-sleek rounded-2xl text-xs font-bold uppercase transition-all hover:bg-surface-beige">Decline</button>
          <button className="py-3 border border-border-sleek rounded-2xl text-xs font-bold uppercase transition-all hover:bg-surface-beige">Counter</button>
          <button className="py-3 bg-brand-primary text-white rounded-2xl text-xs font-bold uppercase shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-1.5 active:scale-95">
            Accept <CheckCircle2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

const InboxHub = () => {
  const location = useLocation();
  const initialTab = (location.state as { selectedTab?: 'messages' | 'offers' | 'matches' })?.selectedTab || 'messages';
  const [activeTab, setActiveTab] = useState<'messages' | 'offers' | 'matches'>(initialTab);
  const navigate = useNavigate();

  const [activeUser] = useAuth();
  const [chats] = useChats();
  const myId = activeUser?.id || 'me';

  // Find all messages involving us
  const myInboxChats = chats.filter(c => c.senderId === myId || c.receiverId === myId);

  // Group latest message per partner
  const conversationsMap: Record<string, { lastMessage: SavedMessage; partner: User }> = {};
  
  myInboxChats.forEach(msg => {
    const partnerId = msg.senderId === myId ? msg.receiverId : msg.senderId;
    const partner = getActiveUserById(partnerId);
    
    if (!conversationsMap[partnerId] || conversationsMap[partnerId].lastMessage.timestamp < msg.timestamp) {
      conversationsMap[partnerId] = {
        lastMessage: msg,
        partner
      };
    }
  });
  
  const conversationsList = Object.values(conversationsMap).sort((a,b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
  
  return (
    <div className="bg-surface-beige min-h-screen pb-32">
       <header className="p-6 bg-white border-b border-border-sleek sticky top-0 z-10 shadow-sm">
        <h1 className="text-2xl font-display font-bold text-text-charcoal mb-4">Inbox</h1>
        <div className="flex p-1 bg-surface-beige rounded-2xl border border-border-sleek">
          <button 
            onClick={() => setActiveTab('messages')}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer",
              activeTab === 'messages' ? "bg-white text-brand-primary shadow-sm" : "text-text-charcoal/40"
            )}
          >
            Messages
          </button>
          <button 
             onClick={() => setActiveTab('offers')}
             className={cn(
              "flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all relative cursor-pointer",
              activeTab === 'offers' ? "bg-white text-brand-primary shadow-sm" : "text-text-charcoal/40"
             )}
          >
            Offers
            <span className="absolute top-2 right-4 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
          </button>
          <button 
             onClick={() => setActiveTab('matches')}
             className={cn(
              "flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all relative cursor-pointer",
              activeTab === 'matches' ? "bg-white text-brand-primary shadow-sm" : "text-text-charcoal/40"
             )}
          >
            Matches
            <span className="absolute top-1.5 right-2 px-1.5 py-0.5 bg-brand-primary text-brand-accent text-[8.5px] font-black rounded-full leading-none">1</span>
          </button>
        </div>
      </header>

      <div className="p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'messages' && (
            <motion.div 
              key="messages"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-3"
            >
              {conversationsList.length > 0 ? (
                conversationsList.map(({ lastMessage, partner }) => {
                  const isOurMessage = lastMessage.senderId === myId;
                  const isUnread = !isOurMessage && lastMessage.id === 'm3';
                  return (
                    <div 
                      key={partner.id}
                      onClick={() => {
                        const matchedListing = getLocalListings().find(l => l.id === lastMessage.listingId);
                        navigate('/chat', { state: { recipient: partner, listing: matchedListing } });
                      }}
                      className={cn(
                        "flex items-center gap-4 p-4 bg-white rounded-[32px] border border-border-sleek shadow-sm active:scale-[0.98] transition-all cursor-pointer text-left",
                        isOurMessage ? "opacity-95" : ""
                      )}
                    >
                      <div className="w-14 h-14 rounded-2xl bg-brand-accent overflow-hidden border-2 border-white shadow-sm flex-shrink-0 font-display font-bold text-brand-primary flex items-center justify-center">
                        <img src={partner.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${partner.id}`} alt={partner.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <h3 className="text-sm font-bold text-text-charcoal">{partner.name}</h3>
                          <span className="text-[9px] font-bold text-text-charcoal/20 uppercase tracking-widest">{lastMessage.time}</span>
                        </div>
                        <p className={cn("text-xs truncate", isUnread ? "text-brand-primary font-black animate-pulse" : "text-text-charcoal/60")}>
                          {lastMessage.text}
                        </p>
                      </div>
                      {isUnread && (
                        <div className="w-2.5 h-2.5 bg-brand-primary rounded-full animate-pulse flex-shrink-0"></div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 bg-white rounded-[32px] border border-border-sleek p-6">
                  <p className="text-3xl mb-2">🤝</p>
                  <p className="text-sm font-bold text-text-charcoal">Your mailbox is empty</p>
                  <p className="text-xs text-text-charcoal/40 mt-1">Explore goods or services and send trade messages to other barterers!</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'offers' && (
            <motion.div 
              key="offers"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-4"
            >
              {mockOffers.map(offer => (
                <TradeCard key={offer.id} offer={offer} />
              ))}
            </motion.div>
          )}

          {activeTab === 'matches' && (
            <motion.div 
              key="matches"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-4 font-sans"
            >
              {/* Relocated Instant Match Banner - highly customized & detailed */}
              <div className="bg-brand-primary rounded-[36px] p-6 text-white border border-brand-primary shadow-xl shadow-brand-primary/20 relative overflow-hidden text-left">
                {/* Accent design blur circles */}
                <div className="absolute right-0 top-0 translate-x-3 -translate-y-3 w-24 h-24 bg-brand-accent/20 rounded-full blur-xl pointer-events-none"></div>
                <div className="absolute -left-6 -bottom-6 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl pointer-events-none"></div>

                <div className="flex items-center justify-between mb-4 relative z-10">
                  <span className="px-3 py-1 bg-brand-accent text-brand-primary text-[8px] font-black tracking-widest uppercase rounded-full">
                    ⚡ Instant match found
                  </span>
                  <span className="text-[9px] uppercase tracking-widest text-emerald-300 font-extrabold flex items-center gap-1">
                    🟢 100% mutual match
                  </span>
                </div>
                
                <h3 className="text-xl font-display font-black leading-tight tracking-tight mb-2">
                  Trade path with Sarah K.
                </h3>
                <p className="text-xs opacity-80 leading-relaxed mb-6">
                  Our smart matching ledger analyzed listings and found mutual demand matching!
                </p>
                
                {/* Wants and Offers Cards layout */}
                <div className="grid grid-cols-2 gap-3 bg-white/10 p-4 rounded-3xl border border-white/15 mb-6 backdrop-blur-sm">
                  <div className="space-y-1">
                    <p className="text-[8.5px] font-black uppercase text-brand-accent tracking-widest">She wants your</p>
                    <p className="text-sm font-bold truncate">🎸 Classic Camera / Gear</p>
                    <p className="text-[10px] opacity-75">Canon 200D DSLR</p>
                  </div>
                  <div className="space-y-1 border-l border-white/10 pl-3">
                    <p className="text-[8.5px] font-black uppercase text-brand-accent tracking-widest">She offers her</p>
                    <p className="text-sm font-bold truncate">📷 Fujifilm X-T30</p>
                    <p className="text-[10px] opacity-75">Condition: Excellent</p>
                  </div>
                </div>

                <div className="flex gap-2 relative z-10">
                  <button 
                    onClick={() => {
                      const matchRecipient = mockUsers.find(u => u.name.includes("Sarah")) || mockUsers[1];
                      const matchListing = getLocalListings().find(l => l.userId === matchRecipient?.id || l.id === 'l5');
                      navigate('/chat', { state: { recipient: matchRecipient, listing: matchListing } });
                    }}
                    className="flex-1 py-3.5 bg-brand-accent text-brand-primary font-black uppercase tracking-wider text-[10px] rounded-2xl hover:scale-[1.01] active:scale-99 transition-all cursor-pointer text-center"
                  >
                    Initiate Swapping Chat
                  </button>
                  <button 
                    onClick={() => alert("Matches have been secured and locked on the decentral ledger. SafeSwap protected. 🛡️")}
                    className="w-12 bg-white/10 text-white rounded-2xl flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"
                    title="Ledger Info"
                  >
                     <Repeat size={16} />
                  </button>
                </div>
              </div>

              {/* Secondary symmetric match recommendation card */}
              <div className="bg-white border border-border-sleek rounded-[32px] p-5 shadow-sm space-y-3.5 text-left">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-3 bg-[#06b6d4] rounded-full"></span>
                    <h4 className="text-[9px] font-black text-text-charcoal/40 uppercase tracking-widest">Category Preference Match</h4>
                  </div>
                  <span className="text-[8px] bg-[#06b6d4]/10 text-[#0891b2] px-2 py-0.5 rounded-md font-black tracking-widest uppercase">85% Compatibility</span>
                </div>

                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden bg-surface-beige border border-border-sleek flex-shrink-0">
                    <img src="https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&q=80&w=200" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-text-charcoal">Priya S. wants your "Yoga help"</p>
                    <p className="text-[10px] text-text-charcoal/50 leading-relaxed truncate">For her Large Monstera Plant (Healthy)</p>
                  </div>
                  <button 
                    onClick={() => navigate('/listing/l1')}
                    className="p-2.5 bg-surface-beige rounded-xl text-text-charcoal hover:bg-brand-accent hover:text-brand-primary transition-all cursor-pointer"
                    title="View Listing"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const ProfilePage = () => {
  const navigate = useNavigate();
  const [listings] = useListings();
  const [activeUser, setActiveUser] = useAuth();
  
  const [toastMsg, setToastMsg] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [newNameVal, setNewNameVal] = useState('');

  const user = activeUser || defaultLocalUser;
  const myListings = listings.filter(l => l.userId === user.id || l.userId === 'me');

  // Initialize name input field
  useState(() => {
    setNewNameVal(user.name || '');
  });

  const handleLogout = () => {
    setActiveUser(null);
    navigate('/');
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleNameSave = () => {
    if (!newNameVal.trim()) return;
    setActiveUser(prev => prev ? {
      ...prev,
      name: newNameVal.trim()
    } : null);
    setEditingName(false);
    showToast('Display Name updated successfully! 👤');
  };

  const handlePhoneVerifyClick = () => {
    if (user.phoneVerified) return;
    const phoneNo = prompt("Enter 10-digit mobile phone number to link:", "+91 ");
    if (!phoneNo || phoneNo.trim() === "+91") return;
    
    // Simulate instantaneous OTP
    const otp = prompt(`Verification: A 6-digit passcode was sent to ${phoneNo}. Enter OTP key (E.g. 123456):`);
    if (otp) {
      setActiveUser(prev => prev ? {
        ...prev,
        phoneVerified: true,
        emailOrPhone: phoneNo
      } : null);
      showToast('Phone verified and linked to e-KYC! 📱');
    }
  };

  const toggleInterest = (category: string) => {
    const currentInterests = user.interests || [];
    let updated: string[];
    if (currentInterests.includes(category)) {
      updated = currentInterests.filter(c => c !== category);
      showToast(`Removed category: ${category} ❌`);
    } else {
      updated = [...currentInterests, category];
      showToast(`Added category preference: ${category} 🎯`);
    }
    
    setActiveUser(prev => prev ? {
      ...prev,
      interests: updated
    } : null);
  };

  // Indian city map pin lookup database
  const hubCoords: Record<string, { x: number; y: number; code: string; name: string }> = {
    'Surat, Gujarat': { x: 28, y: 55, code: 'SRT', name: 'Surat' },
    'Mumbai, Maharashtra': { x: 30, y: 72, code: 'BOM', name: 'Mumbai' },
    'New Delhi, Delhi': { x: 45, y: 25, code: 'DEL', name: 'Delhi' },
    'Bengaluru, Karnataka': { x: 48, y: 88, code: 'BLR', name: 'Bengaluru' },
    'Ahmedabad, Gujarat': { x: 24, y: 48, code: 'AMD', name: 'Ahmedabad' },
    'Pune, Maharashtra': { x: 34, y: 76, code: 'PNQ', name: 'Pune' },
    'Hyderabad, Telangana': { x: 55, y: 70, code: 'HYD', name: 'Hyderabad' }
  };

  const handleSelectHubCity = (city: string) => {
    setActiveUser(prev => prev ? {
      ...prev,
      location: city
    } : null);
    showToast(`Geographical swap hub pinned to ${city}! 📍`);
  };

  // Extract initials if avatar doesn't exist
  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'SW';
    return nameStr.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // Onboarding milestones checklist (Interactive Timeline)
  const timelineSteps = [
    {
      id: 1,
      title: 'Passcode Verified',
      desc: user.emailOrPhone ? `Key Linked: ${user.emailOrPhone}` : 'Connected',
      isCompleted: true,
      btnLabel: 'Link Saved',
      icon: Lock,
    },
    {
      id: 2,
      title: 'Geographical Pin',
      desc: user.location ? `Hub Centered at ${user.location}` : 'No local hub pinned',
      isCompleted: !!user.location,
      btnLabel: 'Pin Hub Map',
      icon: MapPin,
      hashLink: 'map-section'
    },
    {
      id: 3,
      title: 'Trade Interests Chosen',
      desc: user.interests && user.interests.length > 0 
        ? `${user.interests.length} Categories setup` 
        : 'Select trade categories',
      isCompleted: !!(user.interests && user.interests.length > 0),
      btnLabel: 'Categories Toggler',
      icon: Compass,
      hashLink: 'interests-section'
    },
    {
      id: 4,
      title: 'Aadhaar Secure Vault',
      desc: user.idVerified ? 'e-KYC Document Certified' : 'Verification Needed',
      isCompleted: !!user.idVerified,
      btnLabel: user.idVerified ? 'Certified' : 'Verify Now',
      icon: ShieldCheck,
      action: !user.idVerified ? () => navigate('/verify-id') : undefined
    }
  ];

  const interestCategories = [
    { name: 'Electronics', icon: '💻' },
    { name: 'Furniture', icon: '🪑' },
    { name: 'Fashion', icon: '👕' },
    { name: 'Service', icon: '🛠️' },
    { name: 'Skills', icon: '✍️' },
    { name: 'Food', icon: '🍕' },
    { name: 'Books', icon: '📚' },
    { name: 'Other', icon: '📦' }
  ];

  // Resolve current active map pin coordinates
  const currentHubData = hubCoords[user.location || ''] || { x: 50, y: 50, code: 'HUB', name: user.location || 'Custom Coordinate' };

  return (
    <div className="bg-white min-h-screen pb-32 relative">
      {/* Dynamic Interactive Toast Bar */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-xl z-50 flex items-center gap-2 border border-white/20 whitespace-nowrap"
          >
            <Sparkles size={14} className="text-brand-accent" />
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="p-6 flex justify-between items-center bg-white border-b border-border-sleek sticky top-0 bg-white/90 backdrop-blur-md z-35">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-primary text-brand-accent flex items-center justify-center font-display font-black text-sm">B</div>
          <h1 className="text-lg font-display font-bold tracking-tight text-text-charcoal">Security Panel</h1>
        </div>
        <button 
          onClick={handleLogout}
          className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-xl border border-red-200 transition-all cursor-pointer"
        >
          Logout Session
        </button>
      </header>

      <div className="p-6 flex flex-col items-center">
        {/* Profile Card Main */}
        <div className="w-full bg-surface-beige/30 border border-border-sleek rounded-[36px] p-6 flex flex-col items-center shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3">
            <span className="bg-brand-primary text-brand-accent px-2 py-1 text-[8.5px] font-black uppercase tracking-wider rounded-xl">
              {user.idVerified ? 'TRUST SCORE 100%' : 'TRUST SCORE 40%'}
            </span>
          </div>

          <div className="w-24 h-24 rounded-[36px] bg-brand-accent flex items-center justify-center mb-4 border-4 border-white shadow-md overflow-hidden relative group">
            {user.avatar ? (
              <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-3xl font-display font-bold text-brand-primary">{getInitials(user.name)}</span>
            )}
            <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
              <Camera size={18} className="text-white" />
              <input 
                type="file" 
                className="hidden" 
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    const reader = new FileReader();
                    reader.onload = () => {
                      if (typeof reader.result === 'string') {
                        setActiveUser(prev => prev ? { ...prev, avatar: reader.result as string } : null);
                        showToast('Custom Avatar locked in securely! 📸');
                      }
                    };
                    reader.readAsDataURL(files[0]);
                  }
                }}
              />
            </label>
          </div>
          
          {editingName ? (
            <div className="flex gap-2 items-center w-full max-w-xs mb-1 bg-white p-1 rounded-xl border border-border-sleek">
              <input 
                type="text" 
                value={newNameVal} 
                onChange={(e) => setNewNameVal(e.target.value)}
                className="bg-transparent flex-1 px-3 py-1 text-sm font-semibold outline-none"
              />
              <button 
                type="button" 
                onClick={handleNameSave} 
                className="px-3 py-1 bg-brand-primary text-white text-[10px] font-black uppercase rounded-lg"
              >
                Save
              </button>
            </div>
          ) : (
            <h2 className="text-xl font-display font-black text-text-charcoal flex items-center gap-1.5 mb-1">
              {user.name || 'Anonymous User'}
              <button 
                onClick={() => { setNewNameVal(user.name || ''); setEditingName(true); }}
                className="text-text-charcoal/30 hover:text-brand-primary text-xs font-normal"
              >
                ✏️
              </button>
            </h2>
          )}
          
          <p className="text-[11px] text-text-charcoal/50 flex items-center gap-1.5 font-bold uppercase tracking-wider mb-5">
            <MapPin size={12} className="text-brand-primary" /> {user.location || 'No active location mapped'}
          </p>

          <div className="grid grid-cols-4 w-full border-t border-border-sleek pt-5 text-center">
            <div>
              <p className="text-lg font-display font-extrabold text-text-charcoal">{myListings.length}</p>
              <p className="text-[8px] font-black text-text-charcoal/40 uppercase tracking-widest mt-1">My Ads</p>
            </div>
            <div className="border-l border-border-sleek text-brand-secondary">
              <p className="text-lg font-display font-extrabold">{user.rating}★</p>
              <p className="text-[8px] font-black opacity-60 uppercase tracking-widest mt-1">Rating</p>
            </div>
            <div className="border-l border-border-sleek">
              <p className="text-lg font-display font-extrabold text-brand-primary">{user.responseRate || '100%'}</p>
              <p className="text-[8px] font-black text-brand-primary/40 uppercase tracking-widest mt-1">Response</p>
            </div>
            <div className="border-l border-border-sleek">
              <p className="text-lg font-display font-extrabold text-red-500">{user.cancellationRate || '0%'}</p>
              <p className="text-[8px] font-black text-red-500/40 uppercase tracking-widest mt-1">Cancels</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 space-y-6">
        {/* INTERACTIVE TIMELINE SECTION */}
        <div className="bg-white p-5 rounded-[32px] border border-border-sleek shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-3 bg-brand-primary rounded-full"></span>
            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-text-charcoal/40">Credential Verification Roadmap</h3>
          </div>

          <div className="space-y-4">
            {timelineSteps.map((stepItem, idx) => (
              <div 
                key={stepItem.id} 
                className={cn(
                  "flex gap-4 relative",
                  idx !== timelineSteps.length - 1 && "after:content-[''] after:absolute after:left-5 after:top-10 after:bottom-[-20px] after:w-0.5 after:bg-border-sleek"
                )}
              >
                {/* Visual Circle Indicator */}
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all z-10",
                  stepItem.isCompleted 
                    ? "bg-brand-primary text-white border-brand-primary shadow-sm" 
                    : "bg-surface-beige text-text-charcoal/30 border-border-sleek"
                )}>
                  <stepItem.icon size={16} />
                </div>

                {/* Step Metadata text */}
                <div className="flex-1 flex items-center justify-between">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <p className={cn("text-xs font-black uppercase tracking-wider", stepItem.isCompleted ? "text-text-charcoal" : "text-text-charcoal/45")}>
                        {stepItem.title}
                      </p>
                      {stepItem.isCompleted && (
                        <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                          <Check size={8} className="stroke-[4px]" />
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-semibold text-text-charcoal/50">{stepItem.desc}</p>
                  </div>

                  {stepItem.action ? (
                    <button 
                      onClick={stepItem.action}
                      className="px-3 py-1.5 bg-brand-primary text-brand-secondary text-[9px] font-black uppercase tracking-widest rounded-lg hover:scale-105 active:scale-95 transition-all text-white"
                    >
                      {stepItem.btnLabel}
                    </button>
                  ) : (
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md",
                      stepItem.isCompleted 
                        ? "bg-emerald-500/10 text-emerald-600" 
                        : "bg-amber-500/10 text-amber-600"
                    )}>
                      {stepItem.isCompleted ? "Verified" : "Pending"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GEOGRAPHICAL SWAP HUB PIN (Interactive CSS/SVG Map Plane) */}
        <div id="map-section" className="bg-white p-5 rounded-[32px] border border-border-sleek shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-3 bg-brand-primary rounded-full"></span>
              <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-text-charcoal/40">Geographical Hub Pin</h3>
            </div>
            {currentHubData.code && (
              <span className="px-2 py-1 bg-brand-accent/50 text-brand-primary text-[9px] font-black uppercase rounded-lg tracking-widest">
                Active node: {currentHubData.code}
              </span>
            )}
          </div>

          {/* Interactive Indian Regional Coordinate Plotter Card Grid */}
          <div className="relative w-full aspect-[4/3] bg-surface-beige/50 rounded-2xl border border-border-sleek overflow-hidden select-none">
            
            {/* Visual Vector Grid Underlay representing physical India nodes */}
            <div className="absolute inset-0 grid grid-cols-12 grid-rows-12 opacity-[0.07] pointer-events-none">
              {Array.from({ length: 144 }).map((_, i) => (
                <div key={i} className="border-b border-r border-text-charcoal"></div>
              ))}
            </div>

            {/* Simulated Regional Landmass Outlines */}
            <svg className="absolute inset-0 w-full h-full text-brand-primary/5 pointer-events-none" viewBox="0 0 100 100" fill="none">
              <path d="M 25 35 Q 35 15 45 30 Q 55 10 65 35 Q 85 45 70 65 Q 50 95 40 85 Q 20 70 25 35 Z" fill="currentColor" />
            </svg>

            {/* Real-time Dynamic Locator Radar Ping Circle */}
            <div 
              className="absolute w-20 h-20 -mt-10 -ml-10 rounded-full bg-brand-primary/10 border border-brand-primary/30 pointer-events-none flex items-center justify-center transition-all duration-700 ease-out animate-pulse"
              style={{ left: `${currentHubData.x}%`, top: `${currentHubData.y}%` }}
            >
              <div className="w-8 h-8 rounded-full bg-brand-primary/20 animate-ping"></div>
            </div>

            {/* Geographical Interactive Marker Points */}
            {Object.keys(hubCoords).map((cityName) => {
              const coord = hubCoords[cityName];
              const isSelected = user.location === cityName;
              return (
                <button
                  key={cityName}
                  type="button"
                  onClick={() => handleSelectHubCity(cityName)}
                  className="absolute -mt-3 -ml-3 w-6 h-6 rounded-full flex items-center justify-center transition-all focus:outline-none hover:scale-125 z-20 cursor-pointer"
                  style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
                  title={cityName}
                >
                  <span className={cn(
                    "w-3 h-3 rounded-full border border-white block transition-all shadow-md relative",
                    isSelected 
                      ? "bg-brand-primary scale-125 ring-4 ring-brand-primary/30 animate-bounce" 
                      : "bg-[#06b6d4]"
                  )}>
                    {isSelected && (
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider whitespace-nowrap shadow-md z-30">
                        {coord.code}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}

            {/* Tooltip Overlay */}
            <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md p-2 rounded-xl border border-border-sleek/60 text-center flex items-center justify-between">
              <div className="text-left">
                <p className="text-[10px] font-black uppercase text-text-charcoal tracking-wide">Centered Local Area</p>
                <p className="text-[9px] font-semibold text-text-charcoal/50 italic">{user.location || "Outside service ranges"}</p>
              </div>
              <p className="text-[8px] font-black uppercase text-brand-primary flex items-center gap-1 bg-brand-accent/50 p-1 rounded-md">
                🛰️ GPS LOCK
              </p>
            </div>
          </div>

          {/* Quick Click Map presets list */}
          <div className="space-y-1.5">
            <p className="text-[9px] font-extrabold uppercase text-text-charcoal/40 tracking-wider">Fast Hub Pinning Presets</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(hubCoords).map((cityName) => (
                <button
                  key={cityName}
                  onClick={() => handleSelectHubCity(cityName)}
                  className={cn(
                    "px-2.5 py-1.5 text-[10px] font-bold rounded-lg border cursor-pointer transition-all active:scale-95",
                    user.location === cityName
                      ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                      : "bg-surface-beige text-text-charcoal/70 border-border-sleek hover:bg-white"
                  )}
                >
                  📍 {hubCoords[cityName].name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* INTERACTIVE TRADE TOPIC INTERESTS MODULE */}
        <div id="interests-section" className="bg-white p-5 rounded-[32px] border border-border-sleek shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-3 bg-brand-primary rounded-full"></span>
            <div className="flex flex-col">
              <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-text-charcoal/40">Topic Interests</h3>
              <p className="text-[9px] text-text-charcoal/40">Tap cards to automatically personalize your feed matching criteria!</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {interestCategories.map((cat) => {
              const isSelected = (user.interests || []).includes(cat.name);
              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => toggleInterest(cat.name)}
                  className={cn(
                    "p-3.5 rounded-2xl border flex flex-col items-start gap-3 cursor-pointer text-left transition-all active:scale-95 group",
                    isSelected
                      ? "bg-brand-accent/55 border-brand-primary text-brand-primary shadow-sm"
                      : "bg-white border-border-sleek text-text-charcoal/80 hover:bg-surface-beige"
                  )}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center text-sm",
                    isSelected ? "bg-white shadow-sm" : "bg-surface-beige group-hover:scale-105 transition-transform"
                  )}>
                    {cat.icon}
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-black uppercase tracking-wider">{cat.name}</span>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-brand-primary text-white flex items-center justify-center">
                        <Check size={8} className="stroke-[4.5px]" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* AADHAAR VAULT INTEGRATIVE STATE PANEL CARD */}
        <div className="bg-white p-5 rounded-[32px] border border-border-sleek shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-3 bg-brand-primary rounded-full"></span>
            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-text-charcoal/40">Aadhaar Vault e-KYC</h3>
          </div>

          {user.idVerified ? (
            <div className="bg-emerald-500/10 border-2 border-emerald-500/20 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <ShieldCheck size={20} className="stroke-[2.5px]" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-emerald-800">Approved Secure ID</h4>
                  <p className="text-[10px] text-emerald-600/80 font-semibold">Government Certified Peer Identity Badge</p>
                </div>
              </div>

              {/* Masked Aadhaar Card Certificate visualization preview */}
              <div className="bg-white/80 p-4 rounded-xl border border-emerald-500/10 font-mono text-[10px] text-zinc-600 space-y-2">
                <div className="flex justify-between border-b border-zinc-100 pb-1.5">
                  <span className="font-bold text-zinc-400">UIDAI REGISTERED</span>
                  <span className="text-emerald-600 font-extrabold flex items-center gap-0.5">🟢 ONLINE</span>
                </div>
                <p><span className="font-bold text-zinc-400">HOLDER:</span> {user.name?.toUpperCase() || 'REGISTERED PATRON'}</p>
                <p><span className="font-bold text-zinc-400">CARD ID:</span> 6784 •••• ••••</p>
                <p className="truncate"><span className="font-bold text-zinc-400">HASH:</span> SHA256-78fa2ce06d09</p>
              </div>

              <div className="flex items-center gap-1 justify-center text-[10px] uppercase font-black text-emerald-700 select-none">
                <Sparkles size={11} /> e-KYC Certified Verified Peer Circled
              </div>
            </div>
          ) : (
            <div className="bg-amber-500/5 border-2 border-dashed border-amber-500/30 rounded-2xl p-5 text-center space-y-4 animate-fade-in">
              <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-600 mx-auto">
                <ShieldCheck size={24} className="stroke-[2.5px]" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-800">Verify Identity with Aadhaar</h4>
                <p className="text-[10px] text-amber-700/70 max-w-[240px] mx-auto font-semibold leading-relaxed">
                  Earn a permanent "ID Verified badge", unlock priority swaps, and join the secure trusted network circle.
                </p>
              </div>
              
              <button 
                onClick={() => navigate('/verify-id')}
                className="w-full bg-brand-primary text-white text-xs font-black tracking-wider uppercase py-3.5 rounded-xl transition-all hover:scale-[1.01] hover:bg-brand-primary/95 cursor-pointer"
              >
                Launch e-KYC Verification Page
              </button>
            </div>
          )}
        </div>

        {/* Listings Section */}
        <div className="bg-surface-beige p-6 rounded-[32px] border border-border-sleek">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-charcoal/40 mb-5">Active Listings</h3>
          <div className="bg-white rounded-2xl border border-border-sleek divide-y divide-border-sleek overflow-hidden">
            {myListings.length > 0 ? (
              myListings.map((item, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between hover:bg-surface-beige/50 transition-colors cursor-pointer" onClick={() => navigate(`/listing/${item.id}`)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-surface-beige">
                      {isVideoUrl(item.images[0]) ? (
                        <video src={getCleanMediaUrl(item.images[0])} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                      ) : (
                        <img src={getCleanMediaUrl(item.images[0])} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold">{item.title}</p>
                      <p className="text-[10px] text-text-charcoal/40 uppercase tracking-widest font-mono">Est. Value: ₹{item.estimatedValue.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-surface-beige flex items-center justify-center">
                     <ChevronRight size={14} className="text-text-charcoal/30" />
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-text-charcoal/40 uppercase tracking-widest font-bold text-[10px]">
                No listings cataloged yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { listing?: Listing; recipient?: User } | null;
  const [activeUser] = useAuth();
  const [chats, setChats] = useChats();

  // Let's get actual default user or fallback
  const fallbackRecipient = mockUsers.find(u => u.name.includes("Priya")) || mockUsers[0];
  const recipient = state?.recipient || fallbackRecipient;
  const listing = state?.listing;

  const recipientNameClean = recipient.name || 'Priya S.';
  const recipientAvatar = recipient.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(recipientNameClean)}`;

  const myUser = activeUser || defaultLocalUser;
  const myFirstName = myUser.name.split(' ')[0] || 'PP';

  const myId = myUser.id || 'me';
  const partnerId = recipient.id || 'priya';

  const isOwnListing = listing ? (listing.userId === myId || listing.userId === 'me') : false;

  // Conversation starts empty and crisp. User will genuinely initiate the dialogue and trade proposal first!
  useEffect(() => {
    // Left empty intentionally to prevent unsolicited mock conversational messages.
  }, []);

  // Load chats relative to current conversation
  const messagesList = chats.filter(c => 
    (c.senderId === myId && c.receiverId === partnerId) || 
    (c.senderId === partnerId && c.receiverId === myId)
  ).sort((a,b) => a.timestamp - b.timestamp);

  const [typedMessage, setTypedMessage] = useState(() => (location.state as any)?.initialMessage || '');

  const handleSendMessage = () => {
    if (!typedMessage.trim()) return;
    const currentMsgText = typedMessage;
    setTypedMessage('');

    const newMsg: SavedMessage = {
      id: 'm_' + Date.now(),
      senderId: myId,
      receiverId: partnerId,
      listingId: listing?.id,
      text: currentMsgText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };

    setChats((prev: SavedMessage[]) => [...prev, newMsg]);

    // Simulate response after short delay if partner is a mockUser
    if (mockUsers.some(u => u.id === partnerId)) {
      setTimeout(() => {
        const botMsg: SavedMessage = {
          id: 'm_bot_' + Date.now(),
          senderId: partnerId,
          receiverId: myId,
          listingId: listing?.id,
          text: `Excellent. Let's make an formal swap offer using the 'Make Offer' button so we can secure the trade on BarterHub safe ledger. 🤝`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: Date.now() + 100
        };
        setChats((prev: SavedMessage[]) => [...prev, botMsg]);
      }, 1500);
    }
  };

  return (
  <div className="bg-white h-screen flex flex-col pb-24">
    <header className="p-6 border-b border-border-sleek flex items-center gap-4 bg-white/80 backdrop-blur-md sticky top-0 z-10">
      <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:scale-105 active:scale-95 transition-all"><ArrowLeft size={24} className="text-text-charcoal" /></button>
      <div className="w-12 h-12 rounded-[18px] bg-brand-accent flex items-center justify-center border-2 border-white shadow-sm overflow-hidden flex-shrink-0">
         <img src={recipientAvatar} alt={recipientNameClean} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1">
        <h2 className="text-base font-bold">{recipientNameClean}</h2>
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-secondary flex items-center">
          <span className="w-1.5 h-1.5 bg-brand-secondary rounded-full mr-1.5 animate-pulse"></span>
          Responds fast
        </p>
      </div>
      <MoreVertical size={20} className="text-text-charcoal/40" />
    </header>

    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-surface-beige/30">
      <div className="flex justify-center">
        <div className="bg-white px-4 py-1.5 rounded-full border border-border-sleek text-[9px] font-bold text-text-charcoal/30 uppercase tracking-[0.2em]">
          Today
        </div>
      </div>

      {messagesList.length === 0 && (
        <div className="p-6 bg-white rounded-[32px] border border-border-sleek shadow-sm text-center max-w-sm mx-auto space-y-4 my-4">
          <div className="w-12 h-12 bg-sky-50 text-brand-primary rounded-full flex items-center justify-center mx-auto shadow-sm">
            <MessageCircle size={20} className="text-[#0284c7] animate-pulse" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-black uppercase text-text-charcoal tracking-widest">Genuine Swap Inquiry</h4>
            <p className="text-[11px] text-text-charcoal/50 leading-relaxed">
              Propose your trade or ask a question. Pick a custom quick-starter prompt below to pre-fill your conversation box instantly:
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-1.5 text-left">
            {[
              listing 
                ? `Hi ${recipientNameClean.split(' ')[0]}! Is your "${listing.title}" still available to swap?`
                : `Hi ${recipientNameClean.split(' ')[0]}! I'd love to chat about a mutual barter swap.`,
              listing 
                ? `Hey! I'm interested in trade options for your "${listing.title}". Would you be open to exchanging?`
                : `Hey there! Do let me know if you are open to bartering any goods or professional skills.`,
              `Hello! I've viewed your profile listings and would love to propose a secure deal on BarterHub. 🤝`
            ].map((icebreaker, i) => (
              <button
                type="button"
                key={i}
                onClick={() => setTypedMessage(icebreaker)}
                className="p-3 text-left bg-surface-beige hover:bg-sky-50 hover:text-[#0284c7] border border-border-sleek rounded-2xl text-[10px] font-bold text-text-charcoal/70 transition-all select-none cursor-pointer leading-snug active:scale-[0.99]"
              >
                💡 {icebreaker}
              </button>
            ))}
          </div>
        </div>
      )}

      {messagesList.map((msg) => {
        const isMeMessage = msg.senderId === myId;
        return (
          <div 
            key={msg.id} 
            className={cn(
              "flex gap-3 max-w-[85%]",
              isMeMessage ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <div 
              className={cn(
                "p-4 rounded-[28px] shadow-sm text-sm leading-relaxed text-left",
                isMeMessage 
                  ? "bg-brand-primary text-white rounded-tr-none shadow-xl shadow-brand-primary/10" 
                  : "bg-white text-text-charcoal border border-border-sleek rounded-tl-none"
              )}
            >
              <p>{msg.text}</p>
              <span 
                className={cn(
                  "text-[9px] font-bold mt-2 block uppercase",
                  isMeMessage ? "text-white/40" : "text-text-charcoal/20"
                )}
              >
                {msg.time}
              </span>
            </div>
          </div>
        );
      })}

      {listing && (
        <div className="p-6 bg-brand-accent/30 rounded-[32px] border border-brand-primary/10 shadow-sm relative overflow-hidden group text-left">
          <div className="absolute -right-6 -top-6 w-20 h-20 bg-brand-primary/5 rounded-full blur-2xl"></div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-brand-primary uppercase tracking-widest">Barter Listing reference</span>
            <Repeat size={14} className="text-brand-primary" />
          </div>
          <div className="text-sm font-bold mb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-beige overflow-hidden border border-border-sleek/50 select-none">
              <img src={getCleanMediaUrl(listing.images[0])} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-xs font-bold text-text-charcoal mb-0.5">{listing.title}</p>
              <p className="text-[9px] font-extrabold text-brand-primary uppercase tracking-wider">Est. Value: ₹{listing.estimatedValue.toLocaleString()}</p>
            </div>
          </div>
          <button 
            onClick={() => navigate(`/offer/${listing.id}`)}
            className="w-full py-3 bg-brand-primary text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-brand-primary/20 transition-all hover:scale-[1.02] active:scale-98 cursor-pointer"
          >
            Make swapping offer
          </button>
        </div>
      )}

      {!listing && (
        <div className="p-6 bg-brand-accent/30 rounded-[32px] border border-brand-primary/10 shadow-sm relative overflow-hidden group text-left">
          <div className="absolute -right-6 -top-6 w-20 h-20 bg-brand-primary/5 rounded-full blur-2xl"></div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-brand-primary uppercase tracking-widest">Default Trade Proposal</span>
            <Repeat size={14} className="text-brand-primary" />
          </div>
          <div className="text-sm font-bold mb-5 flex items-center gap-3">
            <span className="text-xl">🪴</span> Monstera + Yoga sessions
          </div>
          <button 
            onClick={() => navigate('/listing/l1')}
            className="w-full py-3 bg-brand-primary text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-brand-primary/20 transition-all hover:scale-[1.02] active:scale-98 cursor-pointer"
          >
            View barter item
          </button>
        </div>
      )}
    </div>

    <div className="p-6 border-t border-border-sleek flex gap-4 items-center bg-white sticky bottom-0">
      <button className="p-3 text-text-charcoal/40 hover:text-brand-primary transition-all">
        <PlusSquare size={26} />
      </button>
      <div className="flex-1 relative">
        <input 
          type="text" 
          placeholder="Type a message..." 
          value={typedMessage}
          onChange={(e) => setTypedMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSendMessage();
            }
          }}
          className="w-full bg-surface-beige border border-border-sleek rounded-[24px] py-3.5 px-5 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/10 transition-all"
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-text-charcoal/30 flex gap-2">
          <Camera size={18} />
        </div>
      </div>
      <button 
        onClick={handleSendMessage}
        className="p-4 bg-brand-primary text-white rounded-2xl shadow-xl shadow-brand-primary/20 active:scale-95 hover:scale-105 transition-all cursor-pointer flex items-center justify-center"
      >
        <Send size={20} />
      </button>
    </div>
  </div>
  );
};

const ListingDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const listingId = id || 'l1';
  const [listings] = useListings();
  const listing = listings.find(l => l.id === listingId) || listings[0];
  const [activeUser] = useAuth();
  const user = getActiveUserById(listing.userId);

  // Dynamic AI Barter Intelligence State
  interface BarterIntelligence {
    pricingSuggestion: string;
    tradeScore: number;
    insights: {
      whoToTradeWith: string;
      fairExchange: string;
      threeWayTrade: string;
      bestItemToExchange: string;
    };
  }

  const [intelligence, setIntelligence] = useState<BarterIntelligence | null>(null);
  const [loadingIntel, setLoadingIntel] = useState(true);
  const [activeIntelTab, setActiveIntelTab] = useState<'who' | 'fair' | 'three' | 'best'>('who');
  
  // Instant Match Simulation
  const myListings = listings.filter(l => l.userId === activeUser?.id || l.userId === 'me');
  const isDirectMatch = myListings.some(myL => 
    listing.wants.some(w => myL.title.toLowerCase().includes(w.toLowerCase())) ||
    (myL.openToNegotiate && myL.negotiableCategories.includes(listing.category))
  );

  // Load dynamic AI Barter Intelligence prediction
  useEffect(() => {
    let active = true;
    setLoadingIntel(true);
    fetch(getApiUrl('/api/ai/barter-intelligence'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: listing.title,
        category: listing.category,
        estimatedValue: listing.estimatedValue,
        wants: listing.wants,
        user: activeUser
      })
    })
      .then(res => res.json())
      .then(data => {
        if (active) {
          setIntelligence(data);
          setLoadingIntel(false);
        }
      })
      .catch(err => {
        console.error('Error loading AI pricing or compatibility:', err);
        if (active) setLoadingIntel(false);
      });

    return () => {
      active = false;
    };
  }, [listing, activeUser]);

  // Craft a dynamic message based on active insights
  const getSelectedInsightText = () => {
    if (!intelligence) return '';
    switch (activeIntelTab) {
      case 'who': return intelligence.insights.whoToTradeWith;
      case 'fair': return intelligence.insights.fairExchange;
      case 'three': return intelligence.insights.threeWayTrade;
      case 'best': return intelligence.insights.bestItemToExchange;
    }
  };

  const getSelectedInsightLabel = () => {
    switch (activeIntelTab) {
      case 'who': return 'Ideal Partner Insight';
      case 'fair': return 'Fair Swap Valuation';
      case 'three': return 'Circular 3-Way Path';
      case 'best': return 'Prime Exchange Candidate';
    }
  };

  const handleApplyIcebreaker = () => {
    const text = getSelectedInsightText();
    const icebreakerMessage = `Hi ${user.name.split(' ')[0]}! I saw your post for "${listing.title}". I got a recommendation from the AI Barter Hub suggesting a trade: "${text}". Would you be open to talking about a barter along these lines?`;
    navigate('/chat', { state: { listing, recipient: user, initialMessage: icebreakerMessage } });
  };

  return (
    <div className="bg-white min-h-screen pb-32">
      <div className="relative h-[420px] bg-brand-accent/20">
        {isVideoUrl(listing.images[0]) ? (
          <video src={getCleanMediaUrl(listing.images[0])} className="w-full h-full object-cover animate-fade-in" controls autoPlay loop playsInline />
        ) : (
          <img src={getCleanMediaUrl(listing.images[0])} alt={listing.title} className="w-full h-full object-cover animate-fade-in" />
        )}
        <div className="absolute top-6 left-6 right-6 flex justify-between">
          <button onClick={() => navigate(-1)} className="w-12 h-12 bg-black/20 backdrop-blur-xl rounded-2xl flex items-center justify-center text-white border border-white/10 transition-all active:scale-90">
            <ArrowLeft size={22} />
          </button>
          <button className="w-12 h-12 bg-black/20 backdrop-blur-xl rounded-2xl flex items-center justify-center text-white border border-white/15 transition-all active:scale-90">
            <Share2 size={22} />
          </button>
        </div>
        {isDirectMatch && (
           <div className="absolute top-24 left-6 right-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-brand-primary text-white p-4 rounded-2xl shadow-xl flex items-center gap-3 border border-white/20"
              >
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Repeat size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-accent">Direct Match!</p>
                  <p className="text-xs font-bold">You have an item {user.name} wants.</p>
                </div>
              </motion.div>
           </div>
        )}
        <div className="absolute bottom-10 left-6 right-6 flex gap-2">
          <span className="px-4 py-1.5 bg-brand-secondary text-white text-[10px] font-bold uppercase tracking-widest rounded-full shadow-lg shadow-brand-secondary/40">Verified Pro</span>
          <span className="px-4 py-1.5 bg-black/40 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest rounded-full">Mint Condition</span>
        </div>
      </div>

      <div className="p-8 -mt-8 bg-white rounded-t-[40px] relative z-10 border-t border-slate-100 shadow-xl">
        {/* User Card */}
        <div className="flex items-center gap-4 mb-8 p-4 bg-surface-beige/50 rounded-[32px] border border-border-sleek">
          <div className="w-14 h-14 rounded-[22px] bg-brand-accent flex items-center justify-center border-4 border-white shadow-md">
            <span className="text-xl font-display font-bold text-brand-primary">{user.name[0]}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-base font-bold text-text-charcoal">{user.name}</h4>
              <ShieldCheck size={16} className="text-brand-secondary" />
            </div>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-[11px] font-bold text-text-charcoal/40 inline-flex items-center"><Star size={12} className="mr-1 text-brand-secondary fill-current" /> {user.rating}</p>
              <p className="text-[11px] font-bold text-text-charcoal/40">• {user.tradesCount} verified swaps</p>
            </div>
          </div>
          <div className="px-3 py-1.5 bg-brand-primary/10 text-brand-primary text-[9px] font-bold uppercase tracking-wider rounded-lg border border-brand-primary/10">
            98% response
          </div>
        </div>

        {/* Title, Category & Value */}
        <div className="mb-8">
          <div className="flex flex-col gap-2 mb-4">
            <span className="text-[10px] font-bold text-text-charcoal/30 uppercase tracking-[0.2em]">{listing.category}</span>
            <div className="flex justify-between items-start">
               <h1 className="text-3xl font-display font-bold text-text-charcoal leading-tight flex-1 mr-4">{listing.title}</h1>
               <div className="text-right flex-shrink-0">
                  <p className="text-[10px] font-bold text-text-charcoal/30 uppercase tracking-widest">Est. Value</p>
                  <p className="text-2xl font-display font-black text-[#0ea5e9]">₹{listing.estimatedValue.toLocaleString()}</p>
               </div>
            </div>
          </div>

          {/* AI-Powered Pricing Recommendations Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-4 bg-gradient-to-r from-sky-50/60 to-indigo-50/60 rounded-[24px] border border-sky-100/60 shadow-[0_4px_16px_rgba(14,165,233,0.02)] relative overflow-hidden"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-[#0ea5e9]/10 rounded-xl flex items-center justify-center text-[#0ea5e9] flex-shrink-0 mt-0.5">
                <TrendingUp size={16} className="animate-pulse" />
              </div>
              <div className="flex-1">
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-[#0369a1] bg-[#e0f2fe] py-0.5 px-2 rounded-md mb-1.5">
                  <Sparkles size={9} className="text-[#0369a1]" /> AI Barter Recommendation
                </span>
                {loadingIntel ? (
                  <div className="h-4 bg-slate-200/50 animate-pulse rounded w-3/4 mt-1"></div>
                ) : (
                  <p className="text-xs font-bold text-text-charcoal leading-relaxed">
                    {intelligence?.pricingSuggestion || "This exchanges beautifully for technological items of similar values."}
                  </p>
                )}
                <p className="text-[9px] text-[#0369a1]/70 mt-1 font-medium">Value calibration based on recent neighborhood goods & skill swap registries in Surat.</p>
              </div>
            </div>
          </motion.div>

          {/* Location & Distance Metadata */}
          <div className="flex items-center gap-4 py-4 border-y border-slate-100/90 mb-6">
            <div className="flex items-center gap-2 text-xs font-bold text-text-charcoal/50">
              <MapPin size={14} className="text-brand-secondary" /> {listing.location}
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-text-charcoal/50">
              <Compass size={14} className="text-brand-secondary" /> {listing.distance}
            </div>
          </div>

          <p className="text-sm text-text-charcoal/70 leading-relaxed font-semibold">
            {listing.description}
          </p>
        </div>

        {/* Dynamic Trade Compatibility Score Card */}
        <div className="mb-8 p-6 bg-slate-50/80 rounded-[32px] border border-slate-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.015)]">
          <div className="flex justify-between items-center mb-4">
            <div className="space-y-0.5">
              <h3 className="text-xs font-black uppercase tracking-widest text-text-charcoal/40 font-mono">Trade Consistency Rating</h3>
              <p className="text-[11px] text-text-charcoal/50 font-bold leading-none">Compatibility based on category and current inventories</p>
            </div>
            <span className="px-3 py-1 bg-[#10b981]/10 text-[#0f766e] text-xs font-extrabold rounded-full font-mono flex items-center gap-1 shadow-sm border border-[#10b981]/15 animate-pulse">
              {loadingIntel ? 'Calculating...' : `${intelligence?.tradeScore || 92}% Match`}
            </span>
          </div>

          <div className="space-y-2">
            <div className="w-full bg-slate-200/65 h-3.5 rounded-full overflow-hidden p-0.5 border border-slate-300/40">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: loadingIntel ? '40%' : `${intelligence?.tradeScore || 92}%` }}
                className="h-full bg-gradient-to-r from-brand-secondary via-brand-primary to-emerald-500 rounded-full"
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-black tracking-wider text-text-charcoal/30 uppercase">
              <span>Low fit (0%)</span>
              <span className="text-brand-primary">Ideal swapping sync zone</span>
              <span>Perfect compatibility (100%)</span>
            </div>
          </div>
        </div>

        {/* AI Barter Intelligence Hub Interactive Tabs */}
        <div className="mb-8 p-6 bg-zinc-900 text-white rounded-[32px] border border-zinc-800 shadow-xl shadow-slate-900/10">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold">
              <Brain size={18} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 font-mono">🤖 Barter AI Intelligence Hub</h3>
              <p className="text-[10px] text-zinc-500 font-semibold leading-none mt-0.5">Instant peer predictions to reduce friction & settle swaps</p>
            </div>
          </div>

          {/* Tab buttons */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 p-1 bg-zinc-800/80 rounded-2xl border border-zinc-700/40 mb-5 text-[9.5px]">
            <button
              onClick={() => setActiveIntelTab('who')}
              className={cn(
                "py-2.5 px-1.5 rounded-xl font-bold flex items-center justify-center gap-1 transition-all select-none cursor-pointer",
                activeIntelTab === 'who' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-zinc-400 hover:text-zinc-200 bg-transparent"
              )}
            >
              👥 Trading Partner
            </button>
            <button
              onClick={() => setActiveIntelTab('fair')}
              className={cn(
                "py-2.5 px-1.5 rounded-xl font-bold flex items-center justify-center gap-1 transition-all select-none cursor-pointer",
                activeIntelTab === 'fair' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-zinc-400 hover:text-zinc-200 bg-transparent"
              )}
            >
              ⚖️ Fair Exchange
            </button>
            <button
              onClick={() => setActiveIntelTab('three')}
              className={cn(
                "py-2.5 px-1.5 rounded-xl font-bold flex items-center justify-center gap-1 transition-all select-none cursor-pointer",
                activeIntelTab === 'three' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-zinc-400 hover:text-zinc-200 bg-transparent"
              )}
            >
              🔄 3-Way Trade
            </button>
            <button
              onClick={() => setActiveIntelTab('best')}
              className={cn(
                "py-2.5 px-1.5 rounded-xl font-bold flex items-center justify-center gap-1 transition-all select-none cursor-pointer",
                activeIntelTab === 'best' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-zinc-400 hover:text-zinc-200 bg-transparent"
              )}
            >
              🎯 Best Candidacy
            </button>
          </div>

          {/* Active Tab Screen */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIntelTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-5 bg-zinc-800 rounded-2xl border border-zinc-700/30 flex flex-col justify-between min-h-[140px]"
            >
              <div className="space-y-1.5">
                <span className="text-[8px] font-mono tracking-widest uppercase font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                  {getSelectedInsightLabel()}
                </span>
                {loadingIntel ? (
                  <div className="space-y-2 py-2">
                    <div className="h-3 bg-zinc-700 animate-pulse rounded w-11/12"></div>
                    <div className="h-3 bg-zinc-700 animate-pulse rounded w-8/12"></div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-300 font-medium leading-relaxed italic pr-2">
                    " {getSelectedInsightText()} "
                  </p>
                )}
              </div>

              {!loadingIntel && (
                <button
                  onClick={handleApplyIcebreaker}
                  className="mt-4 self-start py-2 px-4 bg-indigo-500 hover:bg-indigo-600 active:scale-95 text-[9px] font-black uppercase tracking-widest rounded-xl text-white inline-flex items-center gap-1 transition-all shadow-md shadow-indigo-500/10 cursor-pointer"
                >
                  <Sparkles size={11} className="text-white" /> Pre-fill Swap Icebreaker 💬
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Exchange requirements */}
        <div className="mb-0">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-charcoal/30">Exchange Requirements</h3>
            <span className="px-2.5 py-1 bg-sky-50 text-[#0284c7] text-[9.5px] font-black rounded-lg border border-sky-100/60 uppercase tracking-wide">
              {listing.wants.length} target swaps
            </span>
          </div>
          <div className="space-y-3">
            {listing.wants.map((want, idx) => (
              <div key={idx} className="flex items-center gap-4 p-5 bg-surface-beige border border-border-sleek rounded-[24px] transition-all hover:bg-white hover:shadow-md">
                <div className="w-10 h-10 rounded-xl bg-brand-primary text-white flex items-center justify-center flex-shrink-0 shadow-lg shadow-brand-primary/20">
                  <CheckCircle2 size={20} />
                </div>
                <span className="text-sm font-bold text-text-charcoal">{want}</span>
              </div>
            ))}
            <div className="flex items-center gap-4 p-5 bg-white border-2 border-dashed border-border-sleek rounded-[24px] opacity-40">
              <div className="w-10 h-10 rounded-xl border-2 border-text-charcoal/20 flex items-center justify-center flex-shrink-0">
                <PlusSquare size={20} className="text-text-charcoal" />
              </div>
              <span className="text-sm font-bold text-text-charcoal">Open to negotiable swaps</span>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-border-sleek flex gap-4 safe-area-bottom z-20">
        <button 
          onClick={() => navigate('/chat', { state: { listing, recipient: user } })}
          className="flex-1 py-4 border border-border-sleek rounded-[20px] font-bold text-xs uppercase tracking-widest text-text-charcoal hover:bg-surface-beige transition-all active:scale-95 cursor-pointer"
        >
          Message
        </button>
        <button 
          onClick={() => navigate(`/offer/${listing.id}`)}
          className="flex-[1.5] py-4 bg-brand-primary text-white rounded-[20px] font-bold text-xs uppercase tracking-widest shadow-xl shadow-brand-primary/20 transition-all active:scale-95 cursor-pointer"
        >
          Make an Offer
        </button>
      </div>
    </div>
  );
};

const OfferPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const listingId = id || 'l1';
  const [listings] = useListings();
  const targetListing = listings.find(l => l.id === listingId) || listings[0];
  const [selectedOfferType, setSelectedOfferType] = useState('goods');
  const [activeUser] = useAuth();
  const targetUser = getActiveUserById(targetListing.userId);

  return (
    <div className="bg-surface-beige min-h-screen pb-32">
      <header className="p-6 border-b border-border-sleek bg-white flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2"><ArrowLeft size={24} /></button>
          <h1 className="text-xl font-display font-bold">Offer Builder</h1>
        </div>
        <HelpCircle size={20} className="text-text-charcoal/30" />
      </header>

      <div className="p-6 space-y-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-charcoal/30 mb-4">Targeting Item</p>
          <div className="flex gap-4 p-4 bg-white rounded-[32px] border border-border-sleek shadow-sm">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-inner flex-shrink-0 bg-surface-beige">
               {isVideoUrl(targetListing.images[0]) ? (
                 <video src={getCleanMediaUrl(targetListing.images[0])} className="w-full h-full object-cover" muted autoPlay loop playsInline />
               ) : (
                 <img src={getCleanMediaUrl(targetListing.images[0])} className="w-full h-full object-cover" />
               )}
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-sm font-bold">{targetListing.title}</p>
              <p className="text-[10px] font-bold text-brand-primary bg-brand-accent/50 inline-block self-start px-2 py-0.5 rounded mt-1">Est. Value: ₹{targetListing.estimatedValue.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-charcoal/30 mb-1">Your Proposal</p>
          
          <div className="flex gap-2 p-1.5 bg-white rounded-[24px] border border-border-sleek">
            <button 
              onClick={() => setSelectedOfferType('goods')}
              className={cn(
                "flex-1 py-3 rounded-[20px] text-[10px] font-bold uppercase tracking-[0.1em] transition-all",
                selectedOfferType === 'goods' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-text-charcoal/40 bg-transparent"
              )}
            >
              My Inventory
            </button>
            <button 
              onClick={() => setSelectedOfferType('service')}
              className={cn(
                "flex-1 py-3 rounded-[20px] text-[10px] font-bold uppercase tracking-[0.1em] transition-all",
                selectedOfferType === 'service' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-text-charcoal/40 bg-transparent"
              )}
            >
              Services/Skills
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={selectedOfferType}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white p-8 rounded-[32px] border border-border-sleek shadow-sm"
            >
              {selectedOfferType === 'goods' ? (
                <div className="flex flex-col items-center justify-center text-center py-6">
                  <div className="w-16 h-16 bg-brand-accent/30 rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-brand-primary/20 text-brand-primary">
                    <PlusSquare size={28} />
                  </div>
                  <h4 className="text-sm font-bold mb-1">Select an item</h4>
                  <p className="text-[10px] text-text-charcoal/40 max-w-[200px] leading-relaxed italic">You don't have matching items. List something new to trade!</p>
                  <button className="mt-6 px-6 py-2 bg-brand-primary text-white rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-brand-primary/20">List New Item</button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative">
                    <textarea 
                      placeholder="Describe the services or mixed value you're offering..." 
                      className="w-full min-h-[160px] p-6 bg-surface-beige border-none rounded-[28px] text-sm font-medium focus:ring-2 focus:ring-brand-primary/10 transition-all outline-none resize-none"
                    />
                    <div className="absolute bottom-4 right-6 text-[10px] font-bold text-text-charcoal/20 uppercase">0/250</div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-surface-beige rounded-2xl border border-border-sleek">
                    <div className="flex items-center gap-3">
                       <span className="text-lg">💰</span>
                       <span className="text-xs font-bold text-text-charcoal/60">Include cash topper?</span>
                    </div>
                    <input type="checkbox" className="w-6 h-6 accent-brand-primary rounded-lg" />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="p-6 bg-brand-primary text-white rounded-[32px] shadow-xl shadow-brand-primary/20 relative overflow-hidden">
          <div className="absolute -left-4 -top-4 w-12 h-12 bg-white/10 rounded-full blur-xl"></div>
          <div className="flex gap-4 items-center relative z-10">
            <ShieldCheck className="text-brand-accent" size={32} />
            <div>
              <p className="text-xs font-bold tracking-tight">BarterHub SafeSwap™</p>
              <p className="text-[10px] text-brand-accent/70 leading-relaxed font-medium mt-0.5 italic">This trade is protected by our escrow system. We hold the trust until both sides confirm.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-border-sleek safe-area-bottom z-20">
        <button 
          onClick={() => navigate('/chat', { state: { listing: targetListing, recipient: targetUser } })}
          className="w-full py-5 bg-text-charcoal text-white rounded-[24px] font-bold text-sm uppercase tracking-widest shadow-2xl transition-all active:scale-95 cursor-pointer"
        >
          Submit Offer
        </button>
      </div>
    </div>
  );
};

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.pathname;

  const navItems = [
    { label: 'Feed', icon: Compass, path: '/' },
    { label: 'Inbox', icon: MessageCircle, path: '/inbox' },
    { label: 'Post', icon: PlusSquare, path: '/post' },
    { label: 'Me', icon: UserIcon, path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-border-sleek px-4 py-3 flex justify-around items-center z-20 safe-area-bottom shadow-[0_-8px_24px_rgba(0,0,0,0.02)]">
      {navItems.map(item => {
        const isActive = activeTab === item.path;
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "relative flex flex-col items-center gap-1.5 py-2 px-4 rounded-[20px] transition-all",
              isActive ? "text-brand-primary bg-brand-accent/40" : "text-text-charcoal/40 hover:text-text-charcoal"
            )}
          >
            <item.icon size={22} className={cn(isActive && "stroke-[2.5px]")} />
            <span className={cn("text-[8px] font-bold uppercase tracking-[0.15em]", isActive ? "opacity-100" : "opacity-0 h-0")}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [user] = useAuth();
  if (!user) {
    return <LoginPage />;
  }
  if (user.isOnboardingCompleted === false) {
    return <OnboardingPage />;
  }
  return <>{children}</>;
};

export default function App() {
  return (
    <BrowserRouter>
      <div className="max-w-[480px] mx-auto min-h-screen bg-surface-beige relative overflow-x-hidden">
        <Routes>
          <Route path="/" element={<DiscoverPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/verify-id" element={<ProtectedRoute><IdVerificationPage /></ProtectedRoute>} />
          
          <Route path="/post" element={<ProtectedRoute><PostPage /></ProtectedRoute>} />
          <Route path="/inbox" element={<ProtectedRoute><InboxHub /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/offer/:id" element={<ProtectedRoute><OfferPage /></ProtectedRoute>} />
          
          <Route path="/listing/:id" element={<ListingDetailPage />} />
        </Routes>
        <NavWrapper />
      </div>
    </BrowserRouter>
  );
}

const NavWrapper = () => {
  const location = useLocation();
  const hideOnPaths = ['/listing', '/offer', '/post', '/chat', '/login', '/onboarding', '/verify-id'];
  const shouldHide = hideOnPaths.some(path => location.pathname.startsWith(path));
  
  if (shouldHide) return null;
  return <BottomNav />;
};
