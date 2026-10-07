import { Body } from 'astronomy-engine';
import type { SolarBodyId } from './types';

/** Mapping of AstroPoint body ids to Astronomy Engine bodies. */
export const ENGINE_BODY: Record<SolarBodyId, Body> = {
  sun: Body.Sun,
  moon: Body.Moon,
  mercury: Body.Mercury,
  venus: Body.Venus,
  mars: Body.Mars,
  jupiter: Body.Jupiter,
  saturn: Body.Saturn,
  uranus: Body.Uranus,
  neptune: Body.Neptune,
};

/** Mean equatorial radius in km (NASA planetary fact sheets). */
export const BODY_RADIUS_KM: Record<SolarBodyId, number> = {
  sun: 695700,
  moon: 1737.4,
  mercury: 2439.7,
  venus: 6051.8,
  mars: 3396.2,
  jupiter: 71492,
  saturn: 60268,
  uranus: 25559,
  neptune: 24764,
};

export const AU_KM = 149597870.7;
