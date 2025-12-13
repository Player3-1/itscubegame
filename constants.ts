
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 450;

// Physics Tweaks
export const GRAVITY = 1.1; // Yerçekimi artırıldı (daha hızlı düşüş)
export const JUMP_FORCE = -12.2; // Zıplama gücü azaltıldı (daha kısa zıplama)
export const GROUND_HEIGHT = 350; 
export const PLAYER_SIZE = 30;
export const BASE_SPEED = 5.8; // Hız düşürüldü (Daha kolay kontrol)
export const SPEED_INCREMENT = 0.001; 

export const ADMIN_PASSWORD = "99458137";

// Colors
export const COLORS = {
  player: '#00f0ff', // Default
  playerTrail: 'rgba(0, 240, 255, 0.4)',
  spike: '#ff003c', // Red/Pink
  block: '#fcee0a', // Yellow
  halfBlock: '#f97316', // Orange
  ground: '#1e293b', // Slate 800
  groundLine: '#334155', // Slate 700
};

export interface Skin {
  id: string;
  color: string;
  name: string;
  starsRequired: number;
}

export const SKINS: Skin[] = [
  { id: 'blue', color: '#00f0ff', name: 'Neon Mavi', starsRequired: 0 },
  { id: 'red', color: '#ef4444', name: 'Alev Kırmızı', starsRequired: 0 },
  { id: 'green', color: '#22c55e', name: 'Zehir Yeşil', starsRequired: 0 },
  { id: 'yellow', color: '#eab308', name: 'Güneş Sarı', starsRequired: 0 },
  { id: 'pink', color: '#ec4899', name: 'Şeker Pembe', starsRequired: 10 },
  { id: 'orange', color: '#f97316', name: 'Magma', starsRequired: 10 },
  { id: 'grey', color: '#94a3b8', name: 'Çelik', starsRequired: 10 },
  { id: 'white', color: '#ffffff', name: 'Hayalet', starsRequired: 25 },
  { id: 'black', color: '#000000', name: 'Gece', starsRequired: 25 },
  { id: 'purple', color: '#a855f7', name: 'Galaksi', starsRequired: 25 },
];
