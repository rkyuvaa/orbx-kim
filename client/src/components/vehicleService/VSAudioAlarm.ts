// Web Audio API generator for critical complaint audible alert

class CriticalAlarmService {
  private audioCtx: AudioContext | null = null;
  private isAlarmPlaying = false;
  private intervalId: any = null;
  private isMuted = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public playSingleBeep(freq = 880, duration = 0.15) {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio playback not permitted or failed', e);
    }
  }

  public playUrgentSequence() {
    this.playSingleBeep(920, 0.12);
    setTimeout(() => {
      this.playSingleBeep(1150, 0.18);
    }, 140);
  }

  public startLoop(intervalMs = 4000) {
    if (this.isAlarmPlaying) return;
    this.isAlarmPlaying = true;
    this.playUrgentSequence();
    this.intervalId = setInterval(() => {
      if (this.isAlarmPlaying && !this.isMuted) {
        this.playUrgentSequence();
      }
    }, intervalMs);
  }

  public stopLoop() {
    this.isAlarmPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopLoop();
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsPlaying(): boolean {
    return this.isAlarmPlaying;
  }
}

export const audioAlarm = new CriticalAlarmService();
