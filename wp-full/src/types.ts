import type { Feature, FeatureCollection, Point } from "geojson";
export interface SiteProps {
  Name: string;
  "Street Address"?: string;
  Facility?: string;
  Lat: number;
  Long: number;
  Suburb?: string;
  Postcode?: string | number;
  Program?: string;
  Details?: string;
  Source?: string;
}

export type SiteFeature = Feature<Point, SiteProps>;
export type SiteCollection = FeatureCollection<Point, SiteProps>;

export interface Filters {
  facility: string;
  program: string;
  query: string;
}
