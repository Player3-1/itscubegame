import React, { useRef, useEffect, useState } from 'react';
import { GameState, Obstacle, ObstacleType, Particle, LevelData } from '../types.ts';
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY, JUMP_FORCE, GROUND_HEIGHT, PLAYER_SIZE, BASE_SPEED, COLORS } from '../constants.ts';

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
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ 
  gameState, 
  setGameState, 
  setScore, 
  levelData, 
  onDeath, 
  onWin, 
  playerColor = COLORS.admin, 
  playerFace = 'default',
  isTestMode = false, 
  attempt = 0, 
  progress = 0 
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
    onPlatform: false
  });
  
  const obstacles = useRef<Obstacle[]>([]);
  const particles = useRef<Particle[]>([]);
  const cameraX = useRef(0);
  const frameId = useRef<number>(0);
  const hasWon = useRef(false);
  
  const isHoldingJump = useRef(false);
  const jumpQueued = useRef(false);

  // Initialize Level
  useEffect(() => {
    const shouldRun = isTestMode || gameState === GameState.PLAYING;

    if (shouldRun) {
      obstacles.current = JSON.parse(JSON.stringify(levelData.obstacles));
      player.current = {
        x: 100,
        y: GROUND_HEIGHT - PLAYER_SIZE,
        dy: 0,
        rotation: 0,
        isJumping: false,
        isDead: false,
        onPlatform: false
      };
      cameraX.current = 0;
      hasWon.current = false;
      particles.current = [];
      isHoldingJump.current = false;
      jumpQueued.current = false;
      setScore(0);
      setIsInitialized(true);
    }

    return () => { };
  }, [gameState, levelData, setScore, isTestMode, attempt]);

  // Input Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        isHoldingJump.current = true;
        jumpQueued.current = true;
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
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isHoldingJump.current = true;
        jumpQueued.current = true;
      }
    };
    
    const handleMouseUp = () => {
      isHoldingJump.current = false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();
      isHoldingJump.current = true;
      jumpQueued.current = true;
    };
    
    const handleTouchEnd = () => {
      isHoldingJump.current = false;
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
    // Clear canvas - fill entire canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.save();
    ctx.translate(-cameraX.current, 0);

    // Ground/Floor area
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(cameraX.current, GROUND_HEIGHT, GAME_WIDTH + 500, GAME_HEIGHT - GROUND_HEIGHT);
    
    ctx.fillStyle = '#334155';
    ctx.fillRect(cameraX.current, GROUND_HEIGHT, GAME_WIDTH + 500, 4);

    // Obstacles
    obstacles.current.forEach(obs => {
      if (obs.x + obs.width < cameraX.current || obs.x > cameraX.current + GAME_WIDTH) return;

      if (obs.type === ObstacleType.SPIKE) {
        ctx.fillStyle = '#ff003c';
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y + obs.height);
        ctx.lineTo(obs.x + obs.width / 2, obs.y);
        ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
      } else if (obs.type === ObstacleType.SPIKE_DOWN) {
        // Ters diken: tavandan aşağı sarkan kırmızı diken
        ctx.fillStyle = COLORS.spike;
        ctx.beginPath();
        ctx.moveTo(obs.x, obs.y); // sol üst
        ctx.lineTo(obs.x + obs.width, obs.y); // sağ üst
        ctx.lineTo(obs.x + obs.width / 2, obs.y + obs.height); // alt orta
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
      } else if (obs.type === ObstacleType.BLOCK || obs.type === ObstacleType.HALF_BLOCK) {
        ctx.fillStyle = '#fcee0a';
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
        
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(obs.x, obs.y, obs.width, 4);
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
      }
    });

    // Particles
    particles.current.forEach(pt => {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = pt.life;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
      ctx.globalAlpha = 1.0;
    });

    // Player
    const p = player.current;
    if (!p.isDead) {
      ctx.save();
      ctx.translate(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2);
      ctx.rotate((p.rotation * Math.PI) / 180);
      
      ctx.shadowBlur = 15;
      ctx.shadowColor = playerColor;
      
      ctx.fillStyle = playerColor;
      ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
      
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.strokeRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);

      // Faces / expressions
      ctx.fillStyle = '#000';
      if (playerFace === 'happy') {
        // two eyes + big smile
        ctx.fillRect(-7, -7, 5, 5);
        ctx.fillRect(2, -7, 5, 5);
        ctx.beginPath();
        ctx.arc(0, 3, 7, 0, Math.PI);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (playerFace === 'angry') {
        // tilted eyebrows + straight mouth
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
        // big eyes + O mouth
        ctx.fillRect(-7, -7, 4, 6);
        ctx.fillRect(3, -7, 4, 6);
        ctx.beginPath();
        ctx.arc(0, 4, 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (playerFace === 'cool') {
        // shades + smile
        ctx.fillRect(-9, -5, 7, 4);
        ctx.fillRect(2, -5, 7, 4);
        ctx.fillRect(-2, -4, 4, 1);
        ctx.beginPath();
        ctx.arc(0, 5, 6, 0, Math.PI);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (playerFace === 'admin') {
        // admin-only: cute smiling cube
        // Little eyes
        ctx.fillRect(-4, -4, 3, 3);
        ctx.fillRect(1, -4, 3, 3);
        // Tiny smiling mouth
        ctx.beginPath();
        ctx.arc(0, 3, 3, 0, Math.PI);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // default simple two-eye face
        ctx.fillRect(-7, -7, 5, 5);
        ctx.fillRect(2, -7, 5, 5);
        ctx.fillRect(-5, 4, 10, 2);
      }

      ctx.restore();
    }

    ctx.restore();
  };

  // Main Loop
  useEffect(() => {
    const shouldRun = isTestMode || gameState === GameState.PLAYING;
    if (!shouldRun || !isInitialized) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const loop = (time: number) => {
      const deltaTime = Math.min((time - lastTime) / 16.67, 2.0);
      lastTime = time;

      if (!player.current.isDead && !hasWon.current) {
        // Inline updatePhysics here
        const p = player.current;

        // Horizontal Movement
        p.x += BASE_SPEED * deltaTime;
        cameraX.current = p.x - 100;

        // Determine Floor Level
        let floorY = GROUND_HEIGHT - PLAYER_SIZE;
        
        const overGap = obstacles.current.some(obs => 
          obs.type === ObstacleType.FLOOR_GAP &&
          p.x + PLAYER_SIZE > obs.x + 5 && 
          p.x < obs.x + obs.width - 5
        );
        
        if (overGap) {
          floorY = GAME_HEIGHT + 200;
        }

        for (const obs of obstacles.current) {
          if (obs.type === ObstacleType.BLOCK || obs.type === ObstacleType.HALF_BLOCK) {
            if (p.x + PLAYER_SIZE > obs.x && p.x < obs.x + obs.width) {
              const blockTop = obs.y - PLAYER_SIZE;
              if (p.y <= blockTop + 15) {
                if (blockTop < floorY) {
                  floorY = blockTop;
                }
              }
            }
          }
        }

        // Vertical Movement
        p.dy += GRAVITY * deltaTime;
        p.y += p.dy * deltaTime;

        if (p.y >= floorY) {
          p.y = floorY;
          p.dy = 0;
          p.onPlatform = true;
          p.isJumping = false;
          
          const snap = Math.round(p.rotation / 90) * 90;
          if (Math.abs(snap - p.rotation) > 1) {
            p.rotation += (snap - p.rotation) * 0.2 * deltaTime;
          } else {
            p.rotation = snap;
          }
        } else {
          p.onPlatform = false;
          p.rotation += 6 * deltaTime;
        }

        // Jump Handling
        if (p.onPlatform && (isHoldingJump.current || jumpQueued.current)) {
          p.dy = JUMP_FORCE;
          p.isJumping = true;
          p.onPlatform = false;
          p.y -= 2;
          jumpQueued.current = false;
        }

        // Collision Detection
        const hitBoxBuffer = 6;

        for (const obs of obstacles.current) {
          if (obs.x > p.x + 100 || obs.x + obs.width < p.x - 100) continue;

          if (
            p.x + PLAYER_SIZE - hitBoxBuffer > obs.x + hitBoxBuffer &&
            p.x + hitBoxBuffer < obs.x + obs.width - hitBoxBuffer &&
            p.y + PLAYER_SIZE - hitBoxBuffer > obs.y + hitBoxBuffer &&
            p.y + hitBoxBuffer < obs.y + obs.height - hitBoxBuffer
          ) {
            if (p.y > GROUND_HEIGHT && obs.type !== ObstacleType.FLOOR_GAP) {
              handleDeath();
              return;
            }

            if (obs.type === ObstacleType.SPIKE || obs.type === ObstacleType.SPIKE_DOWN) {
              handleDeath();
              return;
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

            if (obs.type === ObstacleType.BLOCK || obs.type === ObstacleType.HALF_BLOCK) {
              if (Math.abs((p.y + PLAYER_SIZE) - obs.y) < 5) {
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
        if (p.y > GAME_HEIGHT + 50) {
          handleDeath();
        }

        // Score
        const progressValue = Math.min(100, (p.x / levelData.length) * 100);
        setScore(Math.floor(progressValue));

        // Particles
        particles.current.forEach(pt => {
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.life -= 0.05;
        });
        particles.current = particles.current.filter(pt => pt.life > 0);
      }
      
      draw(ctx);
      
      if (!hasWon.current && !player.current.isDead) {
        frameId.current = requestAnimationFrame(loop);
      } else if (particles.current.length > 0) {
        frameId.current = requestAnimationFrame(loop);
      }
    };

    frameId.current = requestAnimationFrame(loop);
    return () => {
      if (frameId.current) cancelAnimationFrame(frameId.current);
    };
  }, [gameState, isTestMode, isInitialized, levelData, onWin, setScore, attempt]);

  const containerClasses = (gameState === GameState.PLAYING || isTestMode)
    ? "fixed inset-0 w-screen h-screen z-50 bg-slate-900 flex items-center justify-center cursor-none"
    : "relative w-full max-w-[800px] aspect-video rounded-xl overflow-hidden shadow-2xl border-4 border-slate-700 bg-slate-900 select-none";

  const canvasStyle = (gameState === GameState.PLAYING || isTestMode)
    ? { width: '100%', height: '100%', objectFit: 'contain' as const, maxHeight: '100vh', maxWidth: '100vw' }
    : {};

  return (
    <div className={containerClasses}>
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        className="block cursor-pointer touch-none"
        style={canvasStyle}
      />
      {(gameState === GameState.PLAYING || isTestMode) && (
        <>
          <div className="absolute top-4 left-4 text-white/50 text-sm font-mono pointer-events-none">
            ESC to Exit
          </div>
          <div className="absolute top-4 right-4 text-white/80 text-sm font-mono pointer-events-none bg-black/20 px-3 py-1 rounded">
            {isTestMode ? 'TEST MODE' : `Deneme #${attempt} — ${progress}%`}
          </div>
        </>
      )}
      <div className="absolute inset-0 z-10 touch-manipulation pointer-events-none" />
    </div>
  );
};
