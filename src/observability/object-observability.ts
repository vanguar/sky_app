/**
 * ObjectObservability = AstronomicalVisibility (existing naked-eye model, unchanged) combined with
 * WeatherObservability (forecast for the current hour). Weather is never mixed into coordinate
 * astronomy: the naked-eye result stays exactly as computed, this module only adds a verdict.
 */
import type { PracticalVisibility } from '../astronomy/naked-eye';
import type { ObservingConditionsResult } from '../weather/observing-conditions';

export type WeatherObservability = 'clear' | 'mixed' | 'cloudy' | 'unknown';

export type CombinedVerdict =
  /** Well placed and the sky should be clear. */
  | 'goodBoth'
  /** Well placed, but clouds / rain may get in the way. */
  | 'placedButWeather'
  /** Sky clear, but the object is too low / sky too bright / too faint. */
  | 'clearButPosition'
  /** Neither the position nor the weather is favourable. */
  | 'poorBoth'
  /** Object below the horizon — weather is irrelevant. */
  | 'belowHorizon'
  /** No forecast: only the astronomical estimate is available. */
  | 'weatherUnknown';

export interface ObjectObservability {
  astronomy: PracticalVisibility['status'];
  weather: WeatherObservability;
  verdict: CombinedVerdict;
}

export function weatherObservability(w: ObservingConditionsResult | null): WeatherObservability {
  if (!w) return 'unknown';
  if (w.score >= 60) return 'clear';
  if (w.score >= 35) return 'mixed';
  return 'cloudy';
}

export function combineObservability(
  practical: Pick<PracticalVisibility, 'status'>,
  weather: ObservingConditionsResult | null,
): ObjectObservability {
  const wx = weatherObservability(weather);
  const astronomy = practical.status;
  const placed = astronomy === 'visible' || astronomy === 'difficult';
  let verdict: CombinedVerdict;
  if (astronomy === 'belowHorizon') verdict = 'belowHorizon';
  else if (wx === 'unknown') verdict = 'weatherUnknown';
  else if (placed && astronomy === 'visible' && wx === 'clear') verdict = 'goodBoth';
  else if (placed && wx !== 'clear') verdict = astronomy === 'visible' ? 'placedButWeather' : 'poorBoth';
  else if (wx === 'clear') verdict = 'clearButPosition';
  else verdict = 'poorBoth';
  return { astronomy, weather: wx, verdict };
}
