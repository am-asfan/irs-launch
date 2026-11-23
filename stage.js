const destination = 'https://irs.icst.edu.lk/';
const stage = document.querySelector('.stage');
const start = document.querySelector('#start');
const startNow = document.querySelector('#start-now');
const launch = document.querySelector('#launch');
const countdown = document.querySelector('#countdown');
const announcement = document.querySelector('#announcement');

class SoundEngine {
  constructor() {
    this.audioContext = null;
    this.activeNodes = new Set();
    this.audio = {
      curtain: this.load('sounds/curtain-opening.wav', 0.7),
      countdown: this.load('sounds/countdown-shockwave.mp3', 0.7),
      impact: this.load('sounds/launch-climax.wav', 0.78),
    };
  }

  load(src, volume) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.volume = volume;
    audio.addEventListener('error', () => {}, { once: true });
    return audio;
  }

  getContext() {
    if (!this.audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.audioContext = new AudioContext();
    }
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  play(name) {
    const audio = this.audio[name];
    if (!audio) return;
    this.getContext();
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch (_) {
      // A missing or unsupported audio asset must not interrupt the launch.
    }
  }

  playCountdownBeat(index) {
    const audio = this.audio.countdown;
    if (!audio) return;
    this.getContext();
    try {
      audio.pause();
      audio.currentTime = index * 2.8;
      audio.playbackRate = 1;
      audio.play().catch(() => {});
    } catch (_) {
      // A missing or unsupported audio asset must not interrupt the launch.
    }
  }

  playTone({ frequencies, duration, startFrequency, endFrequency, type = 'sine', volume = 0.12 }) {
    const context = this.getContext();
    if (!context) return;

    const now = context.currentTime;
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const partialVolume = volume / Math.sqrt(frequencies.length);
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(startFrequency || frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency || frequency, now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(partialVolume, now + 0.09);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.onended = () => {
        this.activeNodes.delete(oscillator);
        try { oscillator.disconnect(); gain.disconnect(); } catch (_) {}
      };
      this.activeNodes.add(oscillator);
      oscillator.start(now + index * 0.025);
      oscillator.stop(now + duration + 0.05);
    });
  }

  playActivation() {
    this.playTone({ frequencies: [62], startFrequency: 62, endFrequency: 440, duration: 1.7, type: 'sine', volume: 0.2 });
    this.playTone({ frequencies: [196, 293.66], startFrequency: 196, endFrequency: 587, duration: 1.4, type: 'triangle', volume: 0.09 });
  }

  playAnnouncement() {
    this.playTone({ frequencies: [392, 493.88, 587.33, 783.99], duration: 2.4, type: 'sine', volume: 0.11 });
  }

  stopAll() {
    Object.values(this.audio).forEach(audio => {
      audio.pause();
      try { audio.currentTime = 0; } catch (_) {}
      audio.playbackRate = 1;
    });
    this.activeNodes.forEach(node => {
      try { node.stop(); } catch (_) {}
    });
    this.activeNodes.clear();
  }
}

const sound = new SoundEngine();
const timers = new Set();
let redirectStarted = false;

function schedule(callback, delay) {
  const id = window.setTimeout(() => {
    timers.delete(id);
    callback();
  }, delay);
  timers.add(id);
  return id;
}

function clearTimers() {
  timers.forEach(id => window.clearTimeout(id));
  timers.clear();
}

function redirect() {
  if (redirectStarted) return;
  redirectStarted = true;
  clearTimers();
  stage.dataset.scene = 'redirecting';
  sound.stopAll();
  window.location.assign(destination);
}

function playNumber(number, index) {
  const digit = document.createElement('span');
  digit.className = 'tick';
  digit.textContent = String(number);
  countdown.replaceChildren(digit);
  sound.playCountdownBeat(index);
  stage.classList.remove('flash');
  void stage.offsetWidth;
  stage.classList.add('flash');
}

function openCurtain() {
  if (stage.dataset.scene !== 'closed') return;
  sound.play('curtain');
  start.disabled = true;
  startNow.disabled = true;
  stage.dataset.scene = 'opening';

  schedule(() => {
    start.hidden = true;
    startNow.hidden = true;
  }, 350);
  schedule(() => {
    stage.dataset.scene = 'ready';
    launch.hidden = false;
    launch.focus();
  }, 2200);
}

start.addEventListener('click', openCurtain);
startNow.addEventListener('click', openCurtain);
stage.addEventListener('click', openCurtain);

window.addEventListener('keydown', event => {
  if (event.repeat) return;
  if (event.key !== 'Enter' && event.key !== 'Backspace') return;

  const scene = stage.dataset.scene;
  const target = scene === 'closed' ? start : scene === 'ready' && !launch.hidden ? launch : null;
  if (!target) return;

  // Prevent native button activation too, so the action fires exactly once.
  event.preventDefault();
  target.click();
});

launch.addEventListener('click', () => {
  launch.hidden = true;
  countdown.hidden = false;
  stage.dataset.scene = 'counting';

  const countdownStarted = performance.now();
  [5, 4, 3, 2, 1].forEach((number, index) => {
    schedule(() => {
      if (stage.dataset.scene !== 'counting') return;
      playNumber(number, index);
    }, Math.max(0, countdownStarted + index * 1000 - performance.now()));
  });

  schedule(() => {
    if (stage.dataset.scene !== 'counting') return;
    stage.dataset.scene = 'activating';
    countdown.hidden = true;
    countdown.replaceChildren();
    stage.classList.remove('flash');
    sound.play('impact');
    sound.playActivation();
  }, Math.max(0, countdownStarted + 5000 - performance.now()));

  schedule(() => {
    if (stage.dataset.scene !== 'activating') return;
    stage.dataset.scene = 'announcing';
    announcement.hidden = false;
    sound.playAnnouncement();
    schedule(redirect, 1500);
  }, Math.max(0, countdownStarted + 6800 - performance.now()));
}, { once: true });

