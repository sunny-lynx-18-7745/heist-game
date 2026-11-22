// Sound, synthesised live with WebAudio: no audio files, no network. A soft tension pad
// underneath, and short blips for footsteps, pickups, the alarm and being caught. Mute with M.

export function createAudio() {
  let context = null;
  let master = null;
  let pad = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ensure() || muted) return;
    const t0 = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function startPad() {
    if (!ensure() || muted || pad) return;
    pad = context.createGain();
    pad.gain.value = 0.05;
    pad.connect(master);
    for (const freq of [55, 82.4, 110]) {
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(pad);
      osc.start();
    }
    const lfo = context.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(pad.gain);
    lfo.start();
  }

  return {
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume();
      startPad();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
    step() {
      tone(1400, 0.05, 'sine', 0.05);
    },
    pickup() {
      tone(660, 0.12, 'sine', 0.16);
      tone(990, 0.18, 'sine', 0.16, 0.08);
    },
    star() {
      tone(523, 0.15, 'sine', 0.18);
      tone(659, 0.15, 'sine', 0.18, 0.1);
      tone(784, 0.3, 'sine', 0.2, 0.2);
      tone(1046, 0.4, 'sine', 0.16, 0.3);
    },
    coin() {
      tone(2400, 0.06, 'square', 0.07);
      tone(1800, 0.05, 'square', 0.05, 0.07);
    },
    smoke() {
      tone(300, 0.4, 'sawtooth', 0.05, 0, 90);
    },
    emp() {
      tone(1200, 0.25, 'square', 0.08, 0, 120);
    },
    spotted() {
      tone(880, 0.12, 'square', 0.1);
      tone(880, 0.12, 'square', 0.1, 0.15);
    },
    alarmTrip() {
      for (let i = 0; i < 3; i += 1) tone(620, 0.16, 'square', 0.12, i * 0.22);
    },
    caught() {
      tone(220, 0.5, 'sawtooth', 0.18, 0, 55);
      tone(110, 0.7, 'sawtooth', 0.14, 0.1, 40);
    },
    win() {
      for (const [freq, when] of [[523, 0], [659, 0.12], [784, 0.24], [1046, 0.36], [1318, 0.5]]) {
        tone(freq, 0.3, 'sine', 0.16, when);
      }
    },
    laser() {
      tone(180, 0.1, 'sawtooth', 0.1, 0, 320);
    },
  };
}
