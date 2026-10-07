import { astronomyService } from './astronomy.service';
import { PLANET_IDS, type Observer, type PlanetId, type SolarBodyPosition } from './types';

export function getPlanetPosition(body: PlanetId, date: Date, observer: Observer): SolarBodyPosition {
  return astronomyService.getPlanetPosition(body, date, observer);
}

export function getAllPlanetPositions(date: Date, observer: Observer): SolarBodyPosition[] {
  return PLANET_IDS.map((id) => getPlanetPosition(id, date, observer));
}

export function isPlanetId(id: string): id is PlanetId {
  return (PLANET_IDS as readonly string[]).includes(id);
}
