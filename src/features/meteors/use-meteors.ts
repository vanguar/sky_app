import { useMemo } from 'react';
import { usePlatform } from '../../app/providers/PlatformProvider';
import { sampleSky } from '../../astronomy/night';
import { isActiveStatus, showerActivity } from '../../meteors/activity';
import { evaluateMeteorAt, planMeteorNight, type MeteorNightPlan, type MeteorSlot } from '../../meteors/best-time';
import { METEOR_SHOWERS } from '../../meteors/catalog';
import type { MeteorShowerDefinition, ShowerActivity } from '../../meteors/types';
import { useObserver } from '../../utils/use-observer';
import type { TonightModel } from '../observing/tonight-model';

export interface ShowerTonight {
  def: MeteorShowerDefinition;
  activity: ShowerActivity;
  /** Conditions right now. */
  now: MeteorSlot;
  /** Plan for the rest of the night (empty when the shower is not active). */
  plan: MeteorNightPlan;
}

const STATUS_ORDER = { peak: 0, nearPeak: 1, active: 2, upcoming: 3, inactive: 4 } as const;

/** Active (and soon active) showers with their night plans, best first. Memoised on the tonight model. */
export function useShowersTonight(tonight: TonightModel, enabled = true, includeUpcoming = true): ShowerTonight[] {
  const platform = usePlatform();
  const observer = useObserver();
  return useMemo(() => {
    if (!enabled) return [];
    const nowSample = sampleSky(platform.astronomy, observer, tonight.now, tonight.now + 1, 1)[0];
    return METEOR_SHOWERS.map((def) => ({ def, activity: showerActivity(def, tonight.now) }))
      .filter(
        ({ activity }) => isActiveStatus(activity.status) || (includeUpcoming && activity.status === 'upcoming'),
      )
      .map(({ def, activity }) => {
        const now = evaluateMeteorAt(platform.astronomy, def, observer, nowSample, tonight.weatherHours);
        const plan = isActiveStatus(activity.status)
          ? planMeteorNight(platform.astronomy, def, observer, tonight.samples, tonight.weatherHours)
          : { slots: [], window: null, best: null, radiantHighAfter: null, weatherUsed: false };
        return { def, activity, now, plan };
      })
      .sort(
        (a, b) =>
          STATUS_ORDER[a.activity.status] - STATUS_ORDER[b.activity.status] ||
          (b.plan.best?.score ?? 0) - (a.plan.best?.score ?? 0),
      );
  }, [platform, observer, tonight, enabled, includeUpcoming]);
}

/** One shower (any status) for its card. */
export function useShowerTonight(def: MeteorShowerDefinition | null, tonight: TonightModel): ShowerTonight | null {
  const platform = usePlatform();
  const observer = useObserver();
  return useMemo(() => {
    if (!def) return null;
    const activity = showerActivity(def, tonight.now);
    const nowSample = sampleSky(platform.astronomy, observer, tonight.now, tonight.now + 1, 1)[0];
    const now = evaluateMeteorAt(platform.astronomy, def, observer, nowSample, tonight.weatherHours);
    const plan = isActiveStatus(activity.status)
      ? planMeteorNight(platform.astronomy, def, observer, tonight.samples, tonight.weatherHours)
      : { slots: [], window: null, best: null, radiantHighAfter: null, weatherUsed: false };
    return { def, activity, now, plan };
  }, [def, tonight, platform, observer]);
}
