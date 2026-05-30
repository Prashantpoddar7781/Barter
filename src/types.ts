export type Category = 'Electronics' | 'Service' | 'Goods' | 'Food' | 'Skills' | 'Other';

export interface User {
  id: string;
  name: string;
  avatar: string;
  location: string;
  rating: number;
  tradesCount: number;
  isVerified: boolean;
  isTopTrader: boolean;
  responseRate: string;
  cashUsed: number;
  phoneVerified: boolean;
  idVerified: boolean;
  cancellationRate: string;
  memberSince: string;
  emailOrPhone?: string;
  idVerificationStatus?: 'unverified' | 'pending' | 'verified';
  aadhaarFront?: string;
  aadhaarBack?: string;
  interests?: string[];
  isOnboardingCompleted?: boolean;
}

export interface Listing {
  id: string;
  userId: string;
  title: string;
  description: string;
  images: string[];
  category: Category;
  condition?: string;
  estimatedValue: number;
  location: string;
  distance: string;
  wants: string[];
  openToNegotiate: boolean;
  negotiableCategories: string[];
  tags: string[];
  createdAt: string;
  isService: boolean;
  isFlagged?: boolean;
  isModerated?: boolean;
}

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'countered';

export interface Offer {
  id: string;
  listingId: string;
  senderId: string;
  receiverId: string;
  offeredItemIds: string[]; // IDs of listings from the sender
  offeredDescription?: string; // If it's a custom offer/text
  status: OfferStatus;
  note?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  tradeId: string;
  senderId: string;
  text: string;
  type: 'text' | 'image' | 'voice' | 'offer';
  contentUrl?: string;
  timestamp: string;
}
