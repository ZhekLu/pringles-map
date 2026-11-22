export interface ProductPhoto {
  src: string;
  creditUrl: string;
  originalUrl: string;
  label: string;
  region?: string;
}
export interface Flavour {
  id: number;
  name: string;
  markets: string[];
  group: string;
  evidence: string;
  sourceUrl: string;
  photos: ProductPhoto[];
  photoNote?: string;
}
export interface Tasting {
  tasted: boolean;
  rating: number;
  note: string;
}
export type Collection = Record<string, Tasting>;
export type MarketNames = Record<string, string>;
export interface Region {
  id: string;
  name: string;
  markets: readonly string[];
}
export interface RegionProgress {
  region: Region;
  tasted: number;
  total: number;
  percent: number;
}
export type CollectionView = "all" | "untasted" | "tasted" | "favourites";
export interface Filters {
  query: string;
  market: string;
  group: string;
  view: CollectionView;
  sort: "catalogue" | "name" | "rating";
}
