/**
 * Centralised observation time. All astronomy code asks the TimeController for "now" instead of
 * calling `new Date()` directly, so time travel / time-lapse can be added without touching the
 * astronomy or rendering layers.
 */
export type TimeListener = (date: Date) => void;

export class TimeController {
  private baseReal: number;
  private baseSim: number;
  private rate = 1;
  private listeners = new Set<TimeListener>();
  private readonly clock: () => number;

  constructor(clock: () => number = () => Date.now()) {
    this.clock = clock;
    this.baseReal = clock();
    this.baseSim = this.baseReal;
  }

  /** Current simulated observation time. */
  now(): Date {
    return new Date(this.nowMs());
  }

  nowMs(): number {
    return this.baseSim + (this.clock() - this.baseReal) * this.rate;
  }

  /** True when following real time at normal speed. */
  isLive(): boolean {
    return this.rate === 1 && Math.abs(this.nowMs() - this.clock()) < 1000;
  }

  getRate(): number {
    return this.rate;
  }

  /** Jump to a specific moment, keeping the current rate. */
  setTime(date: Date): void {
    this.baseReal = this.clock();
    this.baseSim = date.getTime();
    this.emit();
  }

  /** Simulation speed multiplier (1 = real time, 60 = one minute per second, 0 = paused). */
  setRate(rate: number): void {
    const current = this.nowMs();
    this.baseReal = this.clock();
    this.baseSim = current;
    this.rate = rate;
    this.emit();
  }

  /** Return to live "NOW" mode. */
  resetToNow(): void {
    this.baseReal = this.clock();
    this.baseSim = this.baseReal;
    this.rate = 1;
    this.emit();
  }

  subscribe(listener: TimeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const d = this.now();
    for (const l of this.listeners) l(d);
  }
}

export const timeController = new TimeController();
