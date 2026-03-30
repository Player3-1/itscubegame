// Royalty-free game music tracks
export type TrackName = 'track1' | 'track2' | 'track3' | 'track4' | 'track5';

interface Track {
  name: TrackName;
  title: string;
  url: string;
  loop: boolean;
}

const tracks: Record<TrackName, Track> = {
  track1: {
    name: 'track1',
    title: 'Neon Dreams',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    loop: true
  },
  track2: {
    name: 'track2',
    title: 'Digital Rush',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    loop: true
  },
  track3: {
    name: 'track3',
    title: 'Pixel Journey',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    loop: true
  },
  track4: {
    name: 'track4',
    title: 'Cosmic Wave',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    loop: true
  },
  track5: {
    name: 'track5',
    title: 'Retro Game',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    loop: true
  }
};

let currentAudio: HTMLAudioElement | null = null;
let currentTrack: TrackName | null = null;
let currentVolume = 0.5;

export function playTrack(trackName: TrackName, volume?: number) {
  if (volume !== undefined) {
    currentVolume = Math.max(0, Math.min(1, volume));
  }

  // Stop current track if playing
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }

  // If same track, don't restart
  if (currentTrack === trackName && currentAudio) {
    currentAudio.play();
    return;
  }

  const track = tracks[trackName];
  if (!track) {
    console.warn(`Track ${trackName} not found`);
    return;
  }

  try {
    currentAudio = new Audio(track.url);
    currentAudio.loop = track.loop;
    currentAudio.volume = currentVolume;
    currentAudio.play().catch(err => {
      console.warn(`Failed to play track ${trackName}:`, err);
    });
    currentTrack = trackName;
  } catch (err) {
    console.warn(`Error creating audio for track ${trackName}:`, err);
  }
}

export function stop() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
    currentTrack = null;
  }
}

export function setVolume(volume: number) {
  currentVolume = Math.max(0, Math.min(1, volume));
  if (currentAudio) {
    currentAudio.volume = currentVolume;
  }
}

export function restartTrack() {
  if (currentAudio) {
    currentAudio.currentTime = 0;
  }
}

export default { playTrack, stop, setVolume, restartTrack, tracks };
