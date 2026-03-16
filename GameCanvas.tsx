import React, { useRef, useEffect, useState } from 'react';
import { GameState, Obstacle, ObstacleType, Particle, LevelData } from './types.ts';
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY, JUMP_FORCE, GROUND_HEIGHT, PLAYER_SIZE, BASE_SPEED, COLORS } from './constants.ts';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setScore: (score: number) => void;
  levelData: LevelData;
  onDeath: () => void;
  attempt?: number;
  progress?: number;
  autoRespawn?: boolean;
  onRespawn?: () => void;
  onWin: () => void;
  playerColor?: string;
  playerFace?: string;
  isTestMode?: boolean;
  onProgressUpdate?: (progress: number) => void;
  jumpButton?: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  setGameState,
  setScore,
  levelData,
  onDeath,
  onWin,
  playerColor = COLORS.player,
  playerFace = 'default',
  isTestMode = false,
  attempt = 0,
  progress = 0,
  onProgressUpdate,
  jumpButton = 0
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const player = useRef({
    x: 100,
    y: GROUND_HEIGHT - PLAYER_SIZE,
    dy: 0,
    rotation: 0,
    isJumping: false,
    isDead: false,
    onPlatform: false,
    gravityDirection: 1, // 1 for down, -1 for up
    currentSpeed: BASE_SPEED, // Oyuncunun mevcut hızı
    jumpsAvailable: 0, // Double jump disabled
    inWave: false
  });
  
  const obstacles = useRef<Obstacle[]>([]);
  const particles = useRef<Particle[]>([]);
  const trail = useRef<Array<{ x: number; y: number; life: number }>>([]);
  const cameraX = useRef(0);
  const cameraY = useRef(0);
  const frameId = useRef<number>(0);
  const hasWon = useRef(false);

  const orbPressed = useRef(false);

  const getRotatedAabb = (o: Obstacle) => {
    const rot = ((o.rotation ?? 0) % 360 + 360) % 360;
    const swap = rot === 90 || rot === 270;
    const w = swap ? o.height : o.width;
    const h = swap ? o.width : o.height;
    const x = o.x + (o.width - w) / 2;
    const y = o.y + (o.height - h) / 2;
    return { x, y, w, h };
  };
  
  const isHoldingJump = useRef(false);
  const jumpQueued = useRef(false);

  // Initialize Level
  useEffect(() => {
    const shouldRun = isTestMode || gameState === GameState.PLAYING;

    if (shouldRun) {
      console.log('GameCanvas: Initializing level...');
      if (!levelData || !levelData.obstacles) {
        console.error('GameCanvas: Invalid levelData', levelData);
        setGameState(GameState.LEVEL_SELECT);
        return;
      }
      obstacles.current = JSON.parse(JSON.stringify(levelData.obstacles));
      const startX = isTestMode ? 100 : levelData.obstacles.length > 0 ? Math.min(...levelData.obstacles.map(o => o.x)) - 200 : 100;
      player.current = {
        x: startX,
        y: GROUND_HEIGHT - PLAYER_SIZE,
        dy: 0,
        rotation: 0,
        isJumping: false,
        isDead: false,
        onPlatform: false,
        gravityDirection: 1,
        currentSpeed: BASE_SPEED,
        jumpsAvailable: 0,
        inJetpack: false,
        isCube: false,
        wasInJetpackPortal: false,
        wasInCubePortal: false,
        inWave: false
      };
      cameraX.current = 0;
      hasWon.current = false;
      particles.current = [];
      trail.current = [];
      isHoldingJump.current = false;
      jumpQueued.current = false;
      setScore(0);
    }
  }, [gameState, levelData, setScore, isTestMode, attempt]);

  useEffect(() => {
    if (gameState === GameState.PLAYING || isTestMode) {
      if (levelData && levelData.obstacles) {
        setIsInitialized(true);
      }
    } else {
      setIsInitialized(false);
    }
  }, [gameState, isTestMode, levelData]);

  // Input Event Listeners
  useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        isHoldingJump.current = true;
        orbPressed.current = true;
        if (player.current.onPlatform) {
          jumpQueued.current = true;
        }
      }
      if (e.code === 'Escape') {
        if (gameState === GameState.PLAYING) {
          setGameState(GameState.LEVEL_SELECT);
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        isHoldingJump.current = false;
        orbPressed.current = false;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const jumpBtn = jumpButton ?? 0;
      if (e.button === jumpBtn) {
        isHoldingJump.current = true;
        jumpQueued.current = true;
        orbPressed.current = true;
      }
    };
    
    const handleMouseUp = () => {
      isHoldingJump.current = false;
      orbPressed.current = false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      isHoldingJump.current = true;
      orbPressed.current = true;
      if (player.current.onPlatform) {
        jumpQueued.current = true;
      }
    };
    
    const handleTouchEnd = () => {
      isHoldingJump.current = false;
      orbPressed.current = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gameState, setGameState]);

  const spawnParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 20; i++) {
      particles.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        life: 1.0,
        color: color,
        size: Math.random() * 5 + 2
      });
    }
  };

  const handleDeath = () => {
    if (player.current.isDead) {
      return;
    }

    player.current.isDead = true;
    spawnParticles(player.current.x + PLAYER_SIZE / 2, player.current.y + PLAYER_SIZE / 2, playerColor);

    if (canvasRef.current) {
      const shake = () => {
        if (!canvasRef.current) return;
        const dx = (Math.random() - 0.5) * 10;
        const dy = (Math.random() - 0.5) * 10;
        canvasRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
        setTimeout(() => {
          if (canvasRef.current) canvasRef.current.style.transform = 'none';
        }, 50);
      };
      shake();
      setTimeout(shake, 100);
    }

    onDeath();
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const p = player.current;
    // Clear canvas - fill entire canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvasRef.current?.width || GAME_WIDTH, canvasRef.current?.height || GAME_HEIGHT);

    if (!isInitialized) {
      return;
    }

    ctx.save();
    ctx.translate(-cameraX.current, -cameraY.current);

    // Ground/Floor area
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(cameraX.current, GROUND_HEIGHT, GAME_WIDTH + 500, GAME_HEIGHT - GROUND_HEIGHT + cameraY.current);
    
    ctx.fillStyle = '#334155';
    ctx.fillRect(cameraX.current, GROUND_HEIGHT, GAME_WIDTH + 500, 4);

    // Obstacles
    obstacles.current.forEach(obs => {
      if (obs.x + obs.width < cameraX.current || obs.x > cameraX.current + GAME_WIDTH) return;

      const rot = ((obs.rotation ?? 0) % 360 + 360) % 360;
      const cx = obs.x + obs.width / 2;
      const cy = obs.y + obs.height / 2;
      ctx.save();
      if (rot !== 0) {
        ctx.translate(cx, cy);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.translate(-cx, -cy);
      }

      if (obs.type === ObstacleType.SPIKE) {
        ctx.fillStyle = '#ff003c';
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.height);
        ctx.lineTo(obs.x + obs.width / 2, obs.y);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
      } else if (obs.type === ObstacleType.SMALL_SPIKE) {
        ctx.fillStyle = COLORS.spike;
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.height);
        ctx.lineTo(obs.x + obs.width / 2, obs.y);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
      } else if (obs.type === ObstacleType.SPIKE_DOWN) {
        // Inverted spike: red spike hanging down from ceiling
        ctx.fillStyle = COLORS.spike;
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y); // sol üst
        ctx.lineTo(obs.x + obs.width, obs.y); // sağ üst
        ctx.lineTo(obs.x + obs.width / 2, obs.y + obs.height); // alt orta
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
      } else if (obs.type === ObstacleType.SMALL_SPIKE_DOWN) {
        // Inverted small spike: red spike hanging down from ceiling
        ctx.fillStyle = COLORS.spike;
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.height / 2); // sol orta
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height / 2); // sağ orta
        ctx.lineTo(obs.x + obs.width / 2, obs.y + obs.height); // alt orta
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
      } else if (obs.type === ObstacleType.BLOCK) {
        ctx.fillStyle = COLORS.block;
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);

        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(obs.x, obs.y, obs.width, 4);
        ctx.fillStyle = COLORS.block;
      } else if (obs.type === ObstacleType.HALF_BLOCK) {
        // Half block (old style)
        ctx.fillStyle = COLORS.halfBlock;
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
      } else if (obs.type === ObstacleType.PASS_THROUGH) {
        ctx.fillStyle = 'rgba(148,163,184,0.45)';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
        ctx.restore();
      } else if (obs.type === ObstacleType.BOUNCER) {
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
        
        ctx.fillStyle = '#fff';
        const cx = obs.x + obs.width / 2;
        const cy = obs.y + obs.height / 2;
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy + 4);
        ctx.lineTo(cx + 6, cy + 4);
        ctx.lineTo(cx + 6, cy - 2);
        ctx.lineTo(cx + 2, cy - 2);
        ctx.lineTo(cx + 2, cy - 8);
        ctx.lineTo(cx - 2, cy - 8);
        ctx.lineTo(cx - 2, cy - 2);
        ctx.lineTo(cx - 6, cy - 2);
        ctx.closePath();
        ctx.fill();
                 } else if (obs.type === ObstacleType.FLOOR_GAP) {
                     ctx.clearRect(obs.x, GROUND_HEIGHT, obs.width, GAME_HEIGHT - GROUND_HEIGHT);
                     const grad = ctx.createLinearGradient(0, GROUND_HEIGHT, 0, GAME_HEIGHT);
                     grad.addColorStop(0, '#000');
                     grad.addColorStop(1, '#0f172a');
                     ctx.fillStyle = grad;
                     ctx.fillRect(obs.x, GROUND_HEIGHT, obs.width, GAME_HEIGHT - GROUND_HEIGHT);
                 } else if (obs.type === ObstacleType.DECOR_1) {
                     ctx.fillStyle = '#10b981';
                     ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.strokeStyle = '#000';
                     ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                 } else if (obs.type === ObstacleType.FAKE_SPIKE) {
                     ctx.fillStyle = 'rgba(255, 0, 60, 0.6)';
                     ctx.beginPath();
                     ctx.moveTo(obs.x, obs.y + obs.height);
                     ctx.lineTo(obs.x + obs.width / 2, obs.y);
                     ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
                     ctx.fill();
                     ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                     ctx.stroke();
                 } else if (obs.type === ObstacleType.FAKE_SPIKE_DOWN) {
                     ctx.fillStyle = 'rgba(255, 0, 60, 0.6)';
                     ctx.beginPath();
                     ctx.moveTo(obs.x, obs.y);
                     ctx.lineTo(obs.x + obs.width, obs.y);
                     ctx.lineTo(obs.x + obs.width / 2, obs.y + obs.height);
                     ctx.closePath();
                     ctx.fill();
                     ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                     ctx.stroke();
                 } else if (obs.type === ObstacleType.GRAVITY_UP) {
                     ctx.fillStyle = COLORS.gravityUp;
                     ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.strokeStyle = '#000';
                     ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                     // Draw up arrow
                     ctx.fillStyle = '#000';
                     const cx = obs.x + obs.width / 2;
                     const cy = obs.y + obs.height / 2;
                     ctx.beginPath();
                     ctx.moveTo(cx, cy - 8);
                     ctx.lineTo(cx + 4, cy - 4);
                     ctx.lineTo(cx - 4, cy - 4);
                     ctx.closePath();
                     ctx.fill();
                     ctx.fillRect(cx - 1, cy - 4, 2, 8);
                 } else if (obs.type === ObstacleType.GRAVITY_NORMAL) {
                     ctx.fillStyle = COLORS.gravityNormal;
                     ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.strokeStyle = '#000';
                     ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                     // Draw down arrow
                     ctx.fillStyle = '#000';
                     const cx = obs.x + obs.width / 2;
                     const cy = obs.y + obs.height / 2;
                     ctx.beginPath();
                     ctx.moveTo(cx, cy + 8);
                     ctx.lineTo(cx + 4, cy + 4);
                     ctx.lineTo(cx - 4, cy + 4);
                     ctx.closePath();
                     ctx.fill();
                     ctx.fillRect(cx - 1, cy - 4, 2, 8);
                 } else if (obs.type === ObstacleType.SLOW_BLOCK) {
                     // Pembe yavaşlatıcı blok
                     ctx.fillStyle = COLORS.slowBlock;
                     ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.strokeStyle = '#000';
                     ctx.lineWidth = 2;
                     ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                     // Yavaşlama sembolü - aşağı ok
                     ctx.fillStyle = '#000';
                     const cx_slow = obs.x + obs.width / 2;
                     const cy_slow = obs.y + obs.height / 2;
                     ctx.beginPath();
                     ctx.moveTo(cx_slow, cy_slow - 8);
                     ctx.lineTo(cx_slow + 4, cy_slow - 4);
                     ctx.lineTo(cx_slow - 4, cy_slow - 4);
                     ctx.closePath();
                     ctx.fill();
                 } else if (obs.type === ObstacleType.NORMAL_BLOCK) {
                     // Mavi normal blok
                     ctx.fillStyle = COLORS.normalBlock;
                     ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.strokeStyle = '#000';
                     ctx.lineWidth = 2;
                     ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                     // Normal sembolü - N harfi
                     ctx.fillStyle = '#000';
                     const cx_normal = obs.x + obs.width / 2;
                     const cy_normal = obs.y + obs.height / 2;
                     ctx.font = 'bold 16px Arial';
                     ctx.textAlign = 'center';
                     ctx.textBaseline = 'middle';
                     ctx.fillText('N', cx_normal, cy_normal);
                 } else if (obs.type === ObstacleType.FAST_BLOCK) {
                     // Yeşil hızlandırıcı blok
                     ctx.fillStyle = COLORS.fastBlock;
                     ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.strokeStyle = '#000';
                     ctx.lineWidth = 2;
                     ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                     // Hızlandırma sembolü - yukarı ok
                     ctx.fillStyle = '#000';
                     const cx_fast = obs.x + obs.width / 2;
                     const cy_fast = obs.y + obs.height / 2;
                     ctx.beginPath();
                     ctx.moveTo(cx_fast, cy_fast + 8);
                     ctx.lineTo(cx_fast + 4, cy_fast + 4);
                     ctx.lineTo(cx_fast - 4, cy_fast + 4);
                     ctx.closePath();
                     ctx.fill();
                 } else if (obs.type === ObstacleType.ORB) {
                     // Sarı yuvarlak orb
                     ctx.fillStyle = COLORS.orb;
                     ctx.beginPath();
                     ctx.arc(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, 0, Math.PI * 2);
                     ctx.fill();
                     ctx.strokeStyle = '#000';
                     ctx.lineWidth = 2;
                     ctx.stroke();
                     // İç ışık efekti
                     ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                     ctx.beginPath();
                     ctx.arc(obs.x + obs.width / 3, obs.y + obs.height / 3, obs.width / 6, 0, Math.PI * 2);
                     ctx.fill();
                 } else if (obs.type === ObstacleType.GRAVITY_ORB) {
                     // Mavi gravity orb
                     ctx.fillStyle = COLORS.gravityOrb;
                     ctx.beginPath();
                     ctx.arc(obs.x + obs.width / 2, obs.y + obs.height / 2, obs.width / 2, 0, Math.PI * 2);
                     ctx.fill();
                     ctx.strokeStyle = '#000';
                     ctx.lineWidth = 2;
                     ctx.stroke();
                     // Inner highlight
                     ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
                     ctx.beginPath();
                     ctx.arc(obs.x + obs.width / 3, obs.y + obs.height / 3, obs.width / 6, 0, Math.PI * 2);
                     ctx.fill();
                 } else if (obs.type === ObstacleType.WAVE_PORTAL) {
                     ctx.fillStyle = '#8b5cf6';
                     ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.strokeStyle = '#000';
                     ctx.lineWidth = 2;
                     ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.fillStyle = '#000';
                     ctx.font = 'bold 14px Arial';
                     ctx.textAlign = 'center';
                     ctx.textBaseline = 'middle';
                     ctx.fillText('W', obs.x + obs.width / 2, obs.y + obs.height / 2);
                 } else if (obs.type === ObstacleType.CUBE_PORTAL) {
                     ctx.fillStyle = '#a855f7';
                     ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.strokeStyle = '#000';
                     ctx.lineWidth = 2;
                     ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.fillStyle = '#000';
                     ctx.font = 'bold 14px Arial';
                     ctx.textAlign = 'center';
                     ctx.textBaseline = 'middle';
                     ctx.fillText('C', obs.x + obs.width / 2, obs.y + obs.height / 2);
                 }
      ctx.restore();
    });

    // Particles
    particles.current.forEach(pt => {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = pt.life;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
      ctx.globalAlpha = 1.0;
    });

    // Trail (behind player) — wave only
    const isCubeTrailEnabled = localStorage.getItem('mod_cubetrail_enabled') === 'true';
    const isRainbowTrailEnabled = localStorage.getItem('mod_rainbowtrail_enabled') === 'true';

    if ((p.inWave || isCubeTrailEnabled) && trail.current.length > 0) {
      ctx.save();
      for (const t of trail.current) {
        ctx.globalAlpha = Math.max(0, Math.min(1, t.life));
        if (isRainbowTrailEnabled && t.hue !== undefined) {
          ctx.fillStyle = `hsl(${t.hue}, 100%, 50%)`;
        } else {
          ctx.fillStyle = playerColor;
        }
        ctx.beginPath();
        ctx.arc(t.x, t.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1.0;
    }

    // Player
    if (!p.isDead) {
      ctx.save();
      ctx.translate(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2);
      ctx.rotate((p.rotation * Math.PI) / 180);

      ctx.shadowBlur = 15;
      ctx.shadowColor = playerColor;

      const isWave = p.inWave;

      if (isWave) {
        // Triangle player (wave)
        const waveSize = PLAYER_SIZE * 0.72;
        ctx.fillStyle = playerColor;
        ctx.beginPath();
        ctx.moveTo(0, -waveSize / 2);
        ctx.lineTo(-waveSize / 2, waveSize / 2);
        ctx.lineTo(waveSize / 2, waveSize / 2);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Cube player (normal)
        ctx.fillStyle = playerColor;
        ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
      }

      // Faces / expressions (disabled in wave mode)
      if (!isWave) {
        ctx.fillStyle = '#000';
        if (playerFace === 'happy') {
          ctx.fillRect(-7, -7, 5, 5);
          ctx.fillRect(2, -7, 5, 5);
          ctx.beginPath();
          ctx.arc(0, 3, 7, 0, Math.PI);
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (playerFace === 'angry') {
          ctx.fillRect(-7, -7, 5, 5);
          ctx.fillRect(2, -7, 5, 5);
          ctx.beginPath();
          ctx.moveTo(-7, -11);
          ctx.lineTo(-2, -9);
          ctx.moveTo(7, -11);
          ctx.lineTo(2, -9);
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillRect(-7, 4, 14, 2);
        } else if (playerFace === 'surprised') {
          ctx.fillRect(-7, -7, 4, 6);
          ctx.fillRect(3, -7, 4, 6);
          ctx.beginPath();
          ctx.arc(0, 4, 4, 0, Math.PI * 2);
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (playerFace === 'cool') {
          ctx.fillRect(-9, -5, 7, 4);
          ctx.fillRect(2, -5, 7, 4);
          ctx.fillRect(-2, -4, 4, 1);
          ctx.beginPath();
          ctx.arc(0, 5, 6, 0, Math.PI);
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (playerFace === 'admin') {
          ctx.fillRect(-7, -7, 5, 5);
          ctx.fillRect(2, -7, 5, 5);
          ctx.beginPath();
          ctx.arc(0, 3, 3, 0, Math.PI);
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.fillRect(-7, -7, 5, 5);
          ctx.fillRect(2, -7, 5, 5);
          ctx.fillRect(-5, 4, 10, 2);
        }
      }
      ctx.restore();
    }

    ctx.restore();
  };

  // Physics Update
  const updatePhysics = (deltaTime: number) => {
    if (!isInitialized || player.current.isDead || hasWon.current) return;

    const p = player.current;

    // Trail update (wave only)
    if (p.inWave) {
      trail.current.push({ x: p.x + PLAYER_SIZE / 2, y: p.y + PLAYER_SIZE / 2, life: 0.9 });
      if (trail.current.length > 26) trail.current.shift();
    } else {
      trail.current = [];
    }

    // Horizontal Movement
    p.x += p.currentSpeed * deltaTime;
    cameraX.current = p.x - 100;

    // Camera Y: no vertical follow in normal mode
    if (p.inWave) {
      cameraY.current = 0;
    }

    // Determine Floor Level
    let floorY = p.gravityDirection === 1 ? GROUND_HEIGHT - PLAYER_SIZE : 0;

    const overGap = obstacles.current.some(obs =>
      obs.type === ObstacleType.FLOOR_GAP &&
      p.x + PLAYER_SIZE > obs.x + 5 &&
      p.x < obs.x + obs.width - 5
    );

    if (overGap) {
      floorY = p.gravityDirection === 1 ? GAME_HEIGHT + 200 : -200;
    }

    for (const obs of obstacles.current) {
      if (obs.type === ObstacleType.BLOCK || obs.type === ObstacleType.HALF_BLOCK || obs.type === ObstacleType.DECOR_1) {
        if (p.x + PLAYER_SIZE > obs.x && p.x < obs.x + obs.width) {
          const blockTop = p.gravityDirection === 1 ? obs.y - PLAYER_SIZE : obs.y + obs.height;
          const condition = p.gravityDirection === 1 ? p.y <= blockTop + 15 : p.y >= blockTop - 15;
          if (condition) {
            const better = p.gravityDirection === 1 ? blockTop < floorY : blockTop > floorY;
            if (better) {
              floorY = blockTop;
            }
          }
        }
      }
    }

    // Vertical Movement
    if (p.inWave) {
      const waveAccel = 0.65;
      const waveMaxSpeed = 7.5;
      const dir = isHoldingJump.current ? -1 : 1;

      // accelerate toward target vertical speed
      const targetDy = dir * waveMaxSpeed;
      p.dy += (targetDy - p.dy) * waveAccel * deltaTime;
      // clamp
      if (p.dy > waveMaxSpeed) p.dy = waveMaxSpeed;
      if (p.dy < -waveMaxSpeed) p.dy = -waveMaxSpeed;

      p.y += p.dy * deltaTime;
    } else {
      p.dy += GRAVITY * p.gravityDirection * deltaTime;
      p.y += p.dy * deltaTime;
    }

    const onFloor = p.gravityDirection === 1 ? p.y >= floorY : p.y <= floorY;
    if (onFloor) {
      p.y = floorY;
      p.dy = 0;
      p.onPlatform = true;
      p.isJumping = false;
      p.jumpsAvailable = 0; // Double jump disabled

      if (p.inWave) {
        // Wave on ground: look forward
        p.rotation = 90;
      } else {
        const snap = Math.round(p.rotation / 90) * 90;
        if (Math.abs(snap - p.rotation) > 1) {
          p.rotation += (snap - p.rotation) * 0.2 * deltaTime;
        } else {
          p.rotation = snap;
        }
      }
    } else {
      p.onPlatform = false;
      if (p.inWave) {
        // Wave: point up when rising, point down when falling
        p.rotation = p.dy < 0 ? 180 : 0;
      } else {
        p.rotation += 6 * deltaTime * p.gravityDirection;
      }
    }

    // Ceiling collision removed for normal gravity
    if (p.gravityDirection === -1) {
      if (p.y >= GROUND_HEIGHT - PLAYER_SIZE) {
        p.y = GROUND_HEIGHT - PLAYER_SIZE;
        p.dy = 0;
      }
    }

    // Die on touching top boundary
    if (p.y <= 0) {
      handleDeath();
    }

    // Wave mode: auto ceiling 12 blocks above ground
    if (p.inWave) {
      const ceilingY = GROUND_HEIGHT - 30 * 12;
      if (p.y <= ceilingY) {
        p.y = ceilingY;
        p.dy = 0;
        handleDeath();
      }
    }

    // Jump Handling
    if (!p.inWave && (p.onPlatform) && (isHoldingJump.current || jumpQueued.current)) {
      p.dy = JUMP_FORCE * p.gravityDirection;
      p.isJumping = true;
      p.onPlatform = false;
      p.y -= 2 * p.gravityDirection;
      jumpQueued.current = false;
    }

    // Collision Detection
    const hitBoxBuffer = 6;

    for (const obs of obstacles.current) {
      if (obs.x > p.x + 100 || obs.x + obs.width < p.x - 100) continue;

      const a = getRotatedAabb(obs);

      if (
        p.x + PLAYER_SIZE - hitBoxBuffer > a.x + hitBoxBuffer &&
        p.x + hitBoxBuffer < a.x + a.w - hitBoxBuffer &&
        p.y + PLAYER_SIZE - hitBoxBuffer > a.y + hitBoxBuffer &&
        p.y + hitBoxBuffer < a.y + a.h - hitBoxBuffer
      ) {
        if (obs.type === ObstacleType.GRAVITY_UP) {
          p.gravityDirection = -1;
          p.dy = 0;
          p.isJumping = false;
          continue;
        }

        if (obs.type === ObstacleType.GRAVITY_NORMAL) {
          p.gravityDirection = 1;
          p.dy = 0;
          p.isJumping = false;
          continue;
        }

        if (obs.type === ObstacleType.WAVE_PORTAL) {
          p.inWave = true;
          p.dy = 0;
          p.isJumping = false;
          continue;
        }

        if (obs.type === ObstacleType.CUBE_PORTAL) {
          p.inWave = false;
          p.dy = 0;
          p.isJumping = false;
          continue;
        }

        if (obs.type === ObstacleType.SLOW_BLOCK) {
          p.currentSpeed = BASE_SPEED * 0.7; // 30% yavaşlat
          spawnParticles(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, COLORS.slowBlock);
          continue;
        }

        if (obs.type === ObstacleType.NORMAL_BLOCK) {
          p.currentSpeed = BASE_SPEED; // Normal hıza döndür
          spawnParticles(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, COLORS.normalBlock);
          continue;
        }

        if (obs.type === ObstacleType.FAST_BLOCK) {
          p.currentSpeed = BASE_SPEED * 1.25; // 25% hızlandır
          spawnParticles(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, COLORS.fastBlock);
          continue;
        }

        if (obs.type === ObstacleType.ORB) {
          const orbHitboxEnabled = localStorage.getItem('mod_orbhitbox_enabled') === 'true';
          const orbHitboxBuffer = orbHitboxEnabled ? 20 : 12; // Increased hitboxes
          const orbCenterX = obs.x + obs.width / 2;
          const orbCenterY = obs.y + obs.height / 2;
          const playerCenterX = p.x + PLAYER_SIZE / 2;
          const playerCenterY = p.y + PLAYER_SIZE / 2;
          const distance = Math.sqrt(
            Math.pow(orbCenterX - playerCenterX, 2) +
            Math.pow(orbCenterY - playerCenterY, 2)
          );
          const maxDistance = obs.width / 2 + PLAYER_SIZE / 2 + orbHitboxBuffer;
          // ORB - yukarı zıplatma
          if (!obs.passed && orbPressed.current && distance <= maxDistance) {
            obs.passed = true;
            p.y = obs.y - PLAYER_SIZE;
            p.dy = -12 * p.gravityDirection;
            p.isJumping = true;
            spawnParticles(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, COLORS.orb);
            setTimeout(() => { obs.passed = false; }, 100); // Reduced cooldown for consecutive orbs
          }
          continue;
        }

        if (obs.type === ObstacleType.GRAVITY_ORB) {
          const orbHitboxEnabled = localStorage.getItem('mod_orbhitbox_enabled') === 'true';
          const orbHitboxBuffer = orbHitboxEnabled ? 20 : 12; // Increased hitboxes
          const orbCenterX = obs.x + obs.width / 2;
          const orbCenterY = obs.y + obs.height / 2;
          const playerCenterX = p.x + PLAYER_SIZE / 2;
          const playerCenterY = p.y + PLAYER_SIZE / 2;
          const distance = Math.sqrt(
            Math.pow(orbCenterX - playerCenterX, 2) +
            Math.pow(orbCenterY - playerCenterY, 2)
          );
          const maxDistance = obs.width / 2 + PLAYER_SIZE / 2 + orbHitboxBuffer;
          // Mavi orb - basınca yer çekimini değiştir
          if (!obs.passed && distance <= maxDistance) {
            obs.passed = true;
            p.gravityDirection = p.gravityDirection === 1 ? -1 : 1;
            p.dy = 0;
            p.isJumping = false;
            spawnParticles(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, COLORS.gravityOrb);
            setTimeout(() => { obs.passed = false; }, 100); // Reduced cooldown for consecutive orbs
          }
          continue;
        }

        if (p.y > GROUND_HEIGHT && obs.type !== ObstacleType.FLOOR_GAP) {
          handleDeath();
          return;
        }

        if (obs.type === ObstacleType.SPIKE || obs.type === ObstacleType.SPIKE_DOWN ||
            obs.type === ObstacleType.SMALL_SPIKE || obs.type === ObstacleType.SMALL_SPIKE_DOWN) {
          handleDeath();
          return;
        }

        // Fake spikes are visual only, no collision
        if (obs.type === ObstacleType.FAKE_SPIKE || obs.type === ObstacleType.FAKE_SPIKE_DOWN) {
          continue;
        }

        if (obs.type === ObstacleType.BOUNCER) {
          if (!obs.passed) {
            obs.passed = true;
            p.y = obs.y - PLAYER_SIZE;
            p.dy = -16;
            p.isJumping = true;
            spawnParticles(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2, 'rgba(0,240,255,0.9)');
            setTimeout(() => { obs.passed = false; }, 300);
          }
          continue;
        }

        if (obs.type === ObstacleType.BLOCK || obs.type === ObstacleType.HALF_BLOCK || obs.type === ObstacleType.DECOR_1) {
          if (Math.abs((p.y + PLAYER_SIZE) - a.y) < 5) {
            continue;
          }
          handleDeath();
          return;
        }
      }
    }

    // Win/Death Bounds
    if (p.x > levelData.length) {
      hasWon.current = true;
      onWin();
    }
    if (p.gravityDirection === 1 && p.y > GAME_HEIGHT + 50 || p.gravityDirection === -1 && p.y < -50) {
      handleDeath();
    }

    // Score
    const progressValue = Math.min(100, (p.x / levelData.length) * 100);
    setScore(Math.floor(progressValue));
    onProgressUpdate?.(Math.floor(progressValue));

    // Particles
    particles.current.forEach(pt => {
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life -= 0.05;
    });
    particles.current = particles.current.filter(pt => pt.life > 0);

    // Trail fade + prune off-screen points (wave only)
    if (p.inWave) {
      const minX = cameraX.current - 60;
      const maxX = cameraX.current + GAME_WIDTH + 60;
      const minY = cameraY.current - 60;
      const maxY = cameraY.current + GAME_HEIGHT + 60;
      trail.current = trail.current
        .map((t) => ({ ...t, life: t.life - 0.07 * deltaTime }))
        .filter((t) =>
          t.life > 0 &&
          t.x >= minX && t.x <= maxX &&
          t.y >= minY && t.y <= maxY
        );
    } else {
      trail.current = [];
    }
  };

  // Main Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    console.log('GameCanvas: Mounting main loop');
    let lastTime = performance.now();

    const loop = (time: number) => {
      const deltaTime = Math.min((time - lastTime) / 16.67, 2.0);
      lastTime = time;

      // Update
      updatePhysics(deltaTime);

      // Draw
      draw(ctx);

      frameId.current = requestAnimationFrame(loop);
    };

    frameId.current = requestAnimationFrame(loop);
    return () => {
      if (frameId.current) cancelAnimationFrame(frameId.current);
    };
  }, [gameState, isTestMode, isInitialized, levelData]);

  const containerClasses = (gameState === GameState.PLAYING || isTestMode)
    ? "fixed inset-0 w-screen h-screen z-50 bg-[#0f172a] flex items-center justify-center cursor-none"
    : "relative w-full max-w-[800px] aspect-video rounded-xl overflow-hidden shadow-2xl border-4 border-slate-700 bg-[#0f172a] select-none";

  const canvasStyle = (gameState === GameState.PLAYING || isTestMode)
    ? { width: '100%', height: '100%', objectFit: 'contain' as const, maxHeight: '100vh', maxWidth: '100vw', display: 'block' }
    : { display: 'block' };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasSize = () => {
      const parent = canvas.parentElement;
      if (parent && (gameState === GameState.PLAYING || isTestMode)) {
        // Set internal resolution to game constants
        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;
      } else {
        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [gameState, isTestMode]);

  return (
    <div className={containerClasses}>
      <canvas
        ref={canvasRef}
        className="touch-none"
        style={canvasStyle}
      />
      <button
        onClick={() => setGameState(GameState.LEVEL_SELECT)}
        onTouchStart={() => setGameState(GameState.LEVEL_SELECT)}
        className="absolute top-4 left-4 bg-red-600/80 hover:bg-red-500 text-white px-3 py-2 rounded font-bold text-sm sm:text-base shadow-lg z-[100]"
      >
        EXIT
      </button>
      {(gameState === GameState.PLAYING || isTestMode) && (
        <>
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white/80 text-sm font-mono pointer-events-none bg-black/20 px-3 py-1 rounded">
            {isTestMode ? 'TEST MODE' : `Attempt #${attempt} — ${progress}%`}
          </div>
        </>
      )}
      <div className="absolute inset-0 z-10 touch-manipulation pointer-events-none" />
    </div>
  );
};