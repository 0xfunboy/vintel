export type Locale = "en" | "it";
export type Theme = "dark" | "light";

export type UserFilters = {
  categories: string[];
  includeKeywords: string[];
  excludeKeywords: string[];
  keywordMode: "and" | "or";
  searchInDescription: boolean;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  minScore: number;
  sellersAllowlist: string[];
  sellersBlocklist: string[];
  searchUrls: string[];
};

export type UserRecord = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  locale: Locale;
  theme: Theme;
  telegramChatId: string | null;
  telegramLinkToken: string;
  telegramEnabled: boolean;
  alertsEnabled: boolean;
  filters: UserFilters;
  createdAt: string;
  updatedAt: string;
};

export type ListingRecord = {
  id: string;
  source: string;
  sourceListingId: string;
  sourceSearchUrl: string | null;
  category: string | null;
  title: string;
  description: string | null;
  url: string;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  sellerName: string;
  sellerUrl: string | null;
  location: string | null;
  postedAt: string;
  discoveredAt: string;
  score: number;
  matchedUserIds: string[];
  matchedKeywords: string[];
  notes: string[];
  status: "new" | "alerted" | "opened" | "archived";
};

export type AlertRecord = {
  id: string;
  userId: string;
  listingId: string;
  channel: "dashboard" | "telegram";
  sentAt: string;
  openedAt: string | null;
  clickedAt: string | null;
};

export type IngestListing = {
  source: string;
  sourceListingId: string;
  searchUrl?: string | null;
  category?: string | null;
  title: string;
  description?: string | null;
  url: string;
  imageUrl?: string | null;
  priceCents: number;
  currency: string;
  sellerName: string;
  sellerUrl?: string | null;
  location?: string | null;
  postedAt: string;
};

export type MatchResult = {
  matches: boolean;
  score: number;
  matchedKeywords: string[];
  notes: string[];
};

export type IngestSummary = {
  received: number;
  inserted: number;
  matched: number;
  dashboardAlerts: number;
  telegramAlerts: number;
};

export type UserExport = {
  profile: UserRecord;
  alerts: AlertRecord[];
  listings: ListingRecord[];
};
