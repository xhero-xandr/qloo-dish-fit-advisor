import type { PilotPackage } from "@/lib/pilot-package";

export type { CulturalAffinity, CulturalSignalItem, PilotPackage, RegionInsight, VenueCandidate } from "@/lib/pilot-package";
export type { DemographicsResult as Demographics } from "@/lib/qloo";

export type CityResult = { city: string; data?: PilotPackage; error?: string };
