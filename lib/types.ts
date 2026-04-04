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
};

export type TimePeriodSlug =
  | "today"
  | "tonight"
  | "this-week"
  | "this-weekend"
  | "this-month"
  | "free";
