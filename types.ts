export enum GameState {
  LOGIN = 'LOGIN',
  MENU = 'MENU',
  SHOP = 'SHOP',
  LEVEL_SELECT = 'LEVEL_SELECT',
  EDITOR = 'EDITOR',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  LEADERBOARD = 'LEADERBOARD',
  CHARACTER_SELECT = 'CHARACTER_SELECT'
}

export enum ObstacleType {
  SPIKE = 'SPIKE',
  SPIKE_DOWN = 'SPIKE_DOWN',
  BLOCK = 'BLOCK',
  PASS_THROUGH = 'PASS_THROUGH', // New: visual block you can pass through
  BOUNCER = 'BOUNCER', // Zıplatıcı blok
  HALF_BLOCK = 'HALF_BLOCK', // Yarım blok
  FLOOR_GAP = 'FLOOR_GAP'
}

export interface Obstacle {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: ObstacleType;
  passed: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface LevelData {
  obstacles: Obstacle[]; // Changed from relative to absolute for editor
  theme: 'neon-cyan' | 'sunset-magenta' | 'toxic-green';
  length: number; // Level length in pixels
}

export interface LevelMetadata {
  id: string;
  name: string;
  author: string;
  levelNumber?: number; // incremental human-friendly ID (1,2,3...)
  difficulty: 'Unlisted' | 'Easy' | 'Normal' | 'Hard' | 'Insane' | 'Extreme';
  stars: number; // 0 if unlisted, 2, 4, 6, 8, 12 otherwise
  data: LevelData;
  plays: number;
  likes: number;
}

export interface User {
  name: string;
  password?: string; // Added password
  isAdmin: boolean;
  totalStars: number;
  completedLevels: string[]; // IDs of levels completed
  likedLevels: string[]; // IDs of levels liked
  selectedColor: string;
  selectedFace?: string; // Yüz ifadesi (opsiyonel, geriye dönük uyum için)
}
