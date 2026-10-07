import type { DeepSkyCategory, MessierRecord } from '../types';

export interface MessierFileEntry {
  id: string;
  number: number;
  ngc: string | null;
  commonName: string | null;
  category: DeepSkyCategory;
  subtype: string | null;
  mag: number | null;
  sizeArcmin: string | null;
  raDeg: number;
  decDeg: number;
  constellation: string;
  distanceLy: number | null;
}

export interface MessierFile {
  version: number;
  objects: MessierFileEntry[];
}

export const DEEP_SKY_CATEGORIES: readonly DeepSkyCategory[] = [
  'galaxy',
  'nebula',
  'planetaryNebula',
  'openCluster',
  'globularCluster',
  'other',
];

export function messierId(designation: string): string {
  return designation.toLowerCase();
}

export function parseMessier(file: MessierFile): MessierRecord[] {
  if (!file || !Array.isArray(file.objects)) throw new Error('Invalid Messier catalog');
  return file.objects.map((m) => ({
    id: messierId(m.id),
    designation: m.id,
    number: m.number,
    ngc: m.ngc,
    commonName: m.commonName,
    category: m.category,
    subtype: m.subtype,
    mag: m.mag,
    sizeArcmin: m.sizeArcmin,
    raDeg: m.raDeg,
    decDeg: m.decDeg,
    constellation: m.constellation,
    distanceLy: m.distanceLy,
  }));
}
