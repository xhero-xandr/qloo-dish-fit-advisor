export interface Demographics {
  age: Record<string, number>;
  gender: Record<string, number>;
}

export interface VenueCandidate {
  name: string;
  address?: string;
  phone?: string;
  rating?: number;
  priceLevel?: number | null;
  description?: string;
  website?: string;
  imageUrl?: string;
  vibeTags: string[];
  dietaryOptions: string[];
  demographics?: Demographics;
}

export interface RegionInsight {
  keyword: string;
  mentions: number;
}

export interface CulturalSignalItem {
  name: string;
  imageUrl?: string;
  subtitle?: string;
}

export interface CulturalAffinity {
  brands: CulturalSignalItem[];
  tvShows: CulturalSignalItem[];
  artists: CulturalSignalItem[];
  podcasts: CulturalSignalItem[];
}

export interface PilotPackage {
  concept: string;
  city: string;
  matchedTag?: { id: string; name: string; type: string };
  resolvedTags: { id: string; name: string; type: string }[];
  venues: VenueCandidate[];
  aggregateDemographics?: Demographics;
  regionInsights: RegionInsight[];
  culturalAffinity?: CulturalAffinity;
  audienceProfile: string;
  tastingBrief: string;
  pilotPlan: string[];
  ownerLetter: string;
  limitations: string[];
}

export type CityResult = { city: string; data?: PilotPackage; error?: string };
