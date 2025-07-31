// src/core/types.ts
import { GeoPoint } from "firebase/firestore";

export interface UserProfile {
  uid: string;
  email: string;
  isBusiness: boolean; // CRITICAL: To switch between Hunter and Creator views
  businessId?: string; // Link to a business profile
}

export interface BusinessProfile {
  id: string;
  ownerUid: string;
  name: string;
  category: 'food' | 'retail' | 'cafe' | 'other';
  address: string;
  latitude: number;
  longitude: number;
}

export interface Vault {
  id: string;
  businessId: string;
  businessName: string; // Denormalized for easy map display
  
  // Public "teaser" info
  publicName: string; // e.g., "A Caffeinated Reward"
  location: GeoPoint;
  totalQuantity: number;
  claimedQuantity: number;
  
  // Private reward info (revealed after unlock)
  privateReward: string; // e.g., "One free blueberry muffin."
  redemptionCode: string; // e.g., "POS Code: #1234"
  
  nfcTagId: string; // The unique ID of the linked NFC tag
  isActive: boolean;
}