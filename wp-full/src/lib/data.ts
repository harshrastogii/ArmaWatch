import type { SiteCollection } from "../types";

export async function loadSites(url: string): Promise<SiteCollection> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load sites: ${res.status}`);
  return (await res.json()) as SiteCollection;
}

export const uniqueSorted = (values: (string | undefined)[]): string[] =>
  [...new Set(values.filter((v): v is string => !!v && v.length > 0))].sort();

export const PRIME = "Prime";
