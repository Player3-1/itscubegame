export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 450;

// Physics Tweaks
export const GRAVITY = 1.1; // Gravity increased (faster fall)
export const JUMP_FORCE = -12.2; // Jump force reduced (shorter jump)
export const GROUND_HEIGHT = 350; 
export const PLAYER_SIZE = 30;
export const BASE_SPEED = 5.8; // Speed reduced (easier control)
export const SPEED_INCREMENT = 0.001; 

export const ADMIN_PASSWORD = "99458137";

// Colors
export const COLORS = {
  player: '#00f0ff', // Default
  playerTrail: 'rgba(0, 240, 255, 0.4)',
  spike: '#ff003c', // Red/Pink
  block: '#ffa500', // Orange
  halfBlock: '#f97316', // Orange
  passThrough: 'rgba(148,163,184,0.45)', // Faded / passthrough block color
  bouncer: '#06b6d4', // Bouncer block color (cyan)
  gravityUp: '#ff6b6b', // Red - upward gravity
  gravityNormal: '#4ecdc4', // Turquoise - normal gravity
};

// Skins removed — colors handled centrally via `COLORS.player`

// EMOTES and expression support removed per user request
