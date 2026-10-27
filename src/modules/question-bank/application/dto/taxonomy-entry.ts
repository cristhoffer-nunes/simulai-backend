export interface TaxonomyEntry {
  id: string;
  name: string;
  custom: boolean;
  /** false when an entry with the same name already existed and was returned instead. */
  created: boolean;
}
