export type Screening = {
  id: string;
  city: string;
  cityName: string;
  venue: string;
  hostOrg: string;
  address: string;
  neighbourhood: string;
  lat: number;
  lng: number;
  film: string;
  filmYear: number;
  description: string;
  date: string;
  time: string;
  price: string;
  isFree: boolean;
  outdoorType: string;
  dogFriendly: boolean;
  wheelchairAccessible: boolean;
  byoFood: boolean;
  bookingUrl: string;
  listingUrl: string;
  imageUrl: string;
  addedBy?: string;
  status: "confirmed" | "tbc";
};

export type City = {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  addedBy?: string;
  addedDate?: string;
  /** IANA zone, e.g. "Europe/London". Set by the add-a-city sweep. */
  timezone?: string | null;
  /** ISO 4217, e.g. "GBP". */
  currency?: string | null;
  /** ISO 3166-1 alpha-2, e.g. "GB". */
  country_code?: string | null;
};

export type TimePeriodSlug =
  | "today"
  | "tonight"
  | "this-week"
  | "this-weekend"
  | "this-month"
  | "free";
