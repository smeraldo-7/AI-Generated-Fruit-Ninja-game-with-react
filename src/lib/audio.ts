export type AudioStyle = 'funky' | 'dreamy' | 'soft' | 'rock' | 'pop';

class AudioManager {
  ctx: AudioContext | null = null;
  bgmInterval: any = null;
  isPlayingBGM: boolean = false;
  currentStyle: AudioStyle = 'funky';

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setBGMStyle(style: AudioStyle) {
    this.currentStyle = style;
    if (this.isPlayingBGM) {
      this.playBGM(); // Restart with new style to immediately reflect changes
    }
  }

  playBGM() {
    this.init();
    this.resume();
    this.stopBGM();
    this.isPlayingBGM = true;
    
    let step = 0;
    const playNote = () => {
      if (!this.isPlayingBGM || !this.ctx) return;
      
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      let freq = 440;
      let duration = 0.1;
      let vol = 0.1;
      let type: OscillatorType = 'sine';
      
      if (this.currentStyle === 'funky') {
        const scale = [130.81, 155.56, 174.61, 196.00, 233.08]; // C minor pentatonic
        freq = scale[Math.floor(Math.random() * scale.length)];
        if (step % 4 === 0) freq /= 2; // bass on downbeat
        duration = 0.1;
        vol = 0.2;
        type = 'sawtooth';
      } else if (this.currentStyle === 'dreamy') {
        const scale = [261.63, 293.66, 329.63, 370.00, 392.00, 440.00, 493.88]; // C Lydian
        freq = scale[Math.floor(Math.random() * scale.length)];
        duration = 0.8;
        vol = 0.1;
        type = 'sine';
      } else if (this.currentStyle === 'soft') {
        const scale = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00]; // Major
        freq = scale[step % scale.length];
        duration = 0.4;
        vol = 0.1;
        type = 'sine';
      } else if (this.currentStyle === 'rock') {
        const scale = [82.41, 110.00, 123.47, 146.83, 164.81]; // E minor pentatonic
        freq = scale[(step * 7) % scale.length];
        duration = 0.15;
        vol = 0.2;
        type = 'square';
      } else if (this.currentStyle === 'pop') {
        const scale = [261.63, 329.63, 392.00, 523.25]; // C major arpeggio
        freq = scale[step % scale.length];
        duration = 0.2;
        vol = 0.15;
        type = 'triangle';
      }
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
      
      osc.start(t);
      osc.stop(t + duration);
      
      step++;
      
      let tempoMs = 250; 
      if (this.currentStyle === 'funky') tempoMs = 200;
      if (this.currentStyle === 'dreamy') tempoMs = 600;
      if (this.currentStyle === 'soft') tempoMs = 500;
      if (this.currentStyle === 'rock') tempoMs = 150;
      if (this.currentStyle === 'pop') tempoMs = 200;

      this.bgmInterval = setTimeout(playNote, tempoMs);
    };
    
    playNote();
  }

  stopBGM() {
    this.isPlayingBGM = false;
    if (this.bgmInterval) {
      clearTimeout(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  playSlice() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    
    const bufferSize = this.ctx.sampleRate * 0.1; 
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    noise.start(t);
    
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.1);
    oscGain.gain.setValueAtTime(0.2, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
    
    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playMiss() {
    this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.5);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  playGameOver() {
    this.init();
    if (!this.ctx) return;
    [100, 110, 120].forEach(f => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, this.ctx!.currentTime);
      gain.gain.setValueAtTime(0.2, this.ctx!.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 1.5);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start();
      osc.stop(this.ctx!.currentTime + 1.5);
    });
  }
}

export const audio = new AudioManager();
