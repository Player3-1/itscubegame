import React, { useRef, useEffect } from 'react';
import { GameState, Obstacle, ObstacleType, Particle, LevelData } from '../types';
import { GAME_WIDTH, GAME_HEIGHT, GRAVITY, JUMP_FORCE, GROUND_HEIGHT, PLAYER_SIZE, BASE_SPEED, COLORS } from '../constants';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setScore: (score: number) => void;
  levelData: LevelData;
  onDeath: () => void;
  onWin: () => void;
  playerColor?: string;
  isTestMode?: boolean;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, setGameState, setScore, levelData, onDeath, onWin, playerColor = COLORS.player, isTestMode = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State Refs
  const player = useRef({
    x: 100,
    y: GROUND_HEIGHT - PLAYER_SIZE,
    dy: 0,
    rotation: 0,
    isJumping: false,
    isDead: false,
    onPlatform: false
  });
  
  // Physics State
  const obstacles = useRef<Obstacle[]>([]);
  const particles = useRef<Particle[]>([]);
  const cameraX = useRef(0);
  const frameId = useRef<number>(0);
  const hasWon = useRef(false);
  
  // Input State
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
    }
  }, [gameState, levelData, setScore, isTestMode]);

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
        if(e.button === 0) {
            isHoldingJump.current = true;
            jumpQueued.current = true;
        }
    };
    
    const handleMouseUp = () => {
        isHoldingJump.current = false;
    };

    const handleTouchStart = (e: TouchEvent) => {
      // Prevent scrolling/zooming
      if(e.cancelable) e.preventDefault(); 
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

  // Main Loop
  useEffect(() => {
    const shouldRun = isTestMode || gameState === GameState.PLAYING;
    if (shouldRun) {
      let lastTime = performance.now();

      const loop = (time: number) => {
        const deltaTime = Math.min((time - lastTime) / 16.67, 2.0); // Cap dt
        lastTime = time;

        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !canvasRef.current) return;

        if (!player.current.isDead && !hasWon.current) {
             updatePhysics(deltaTime);
        }
        
        draw(ctx);
        
        if (!hasWon.current && !player.current.isDead) {
            frameId.current = requestAnimationFrame(loop);
        } else if (particles.current.length > 0) {
             frameId.current = requestAnimationFrame(loop);
        }
      };

      frameId.current = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(frameId.current);
    }
  }, [gameState, isTestMode]);

  const updatePhysics = (deltaTime: number) => {
      const p = player.current;

      // --- 1. Horizontal Movement ---
      p.x += BASE_SPEED * deltaTime;
      cameraX.current = p.x - 100;

      // --- 2. Determine "Floor Level" at current X ---
      let floorY = GROUND_HEIGHT - PLAYER_SIZE; // Default Floor
      
      // Check for Floor Gaps (Pits)
      const overGap = obstacles.current.some(obs => 
          obs.type === ObstacleType.FLOOR_GAP &&
          p.x + PLAYER_SIZE > obs.x + 5 && 
          p.x < obs.x + obs.width - 5
      );
      
      if (overGap) {
          floorY = GAME_HEIGHT + 200; // Abyss
      }

      // Check for Blocks acting as platforms
      for (const obs of obstacles.current) {
          if (obs.type === ObstacleType.BLOCK || obs.type === ObstacleType.HALF_BLOCK) {
              // Exact overlap check for floor support
              if (p.x + PLAYER_SIZE > obs.x && p.x < obs.x + obs.width) {
                  const blockTop = obs.y - PLAYER_SIZE;
                  
                  // Only snap to top if we are currently above it or barely inside it (gravity pull)
                  // AND it provides a higher platform than what we found so far
                  if (p.y <= blockTop + 15) { 
                       if (blockTop < floorY) {
                           floorY = blockTop;
                       }
                  }
              }
          }
      }

      // --- 3. Vertical Movement & Landing ---
      p.dy += GRAVITY * deltaTime;
      p.y += p.dy * deltaTime;

      // Hard clamp to calculated floor
      if (p.y >= floorY) {
          p.y = floorY;
          p.dy = 0;
          p.onPlatform = true;
          p.isJumping = false;
          
          // Rotation snap when grounded
          const snap = Math.round(p.rotation / 90) * 90;
          if (Math.abs(snap - p.rotation) > 1) {
             p.rotation += (snap - p.rotation) * 0.2 * deltaTime;
          } else {
             p.rotation = snap;
          }
      } else {
          p.onPlatform = false;
          // Rotate while in air
          p.rotation += 6 * deltaTime;
      }

      // --- 4. Jump Handling ---
      // Logic: If on ground AND (holding jump OR buffered jump exists)
      if (p.onPlatform && (isHoldingJump.current || jumpQueued.current)) {
          p.dy = JUMP_FORCE;
          p.isJumping = true;
          p.onPlatform = false;
          p.y -= 2; // Lift off immediately
          
          // Consume the buffered jump trigger
          jumpQueued.current = false;
      }

      // --- 5. Lethal Collision (Spikes & Side Walls) ---
      const hitBoxBuffer = 6; // Forgiving hitbox

      for (const obs of obstacles.current) {
          // Skip if far away
          if (obs.x > p.x + 100 || obs.x + obs.width < p.x - 100) continue;

          // Standard AABB Intersection
          if (
              p.x + PLAYER_SIZE - hitBoxBuffer > obs.x + hitBoxBuffer &&
              p.x + hitBoxBuffer < obs.x + obs.width - hitBoxBuffer &&
              p.y + PLAYER_SIZE - hitBoxBuffer > obs.y + hitBoxBuffer &&
              p.y + hitBoxBuffer < obs.y + obs.height - hitBoxBuffer
          ) {
              // If it's a spike, instant death.
              if (obs.type === ObstacleType.SPIKE) {
                  handleDeath();
                  return;
              }

              // If it's a block, only die if we are hitting side/bottom
              if (obs.type === ObstacleType.BLOCK || obs.type === ObstacleType.HALF_BLOCK) {
                   // If we are effectively "on" this block, ignore collision
                   if (Math.abs((p.y + PLAYER_SIZE) - obs.y) < 5) {
                       continue;
                   }
                   handleDeath();
                   return;
              }
          }
      }

      // --- 6. Win/Death Bounds ---
      if (p.x > levelData.length) {
          hasWon.current = true;
          onWin();
      }
      if (p.y > GAME_HEIGHT + 50) { // Fell into void
          handleDeath();
      }

      // --- 7. Score ---
      const progress = Math.min(100, (p.x / levelData.length) * 100);
      setScore(Math.floor(progress));

      // --- 8. Particles ---
      particles.current.forEach(pt => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life -= 0.05;
      });
      particles.current = particles.current.filter(pt => pt.life > 0);
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
     // Clear
     ctx.fillStyle = '#0f172a';
     ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

     ctx.save();
     // Camera
     ctx.translate(-cameraX.current, 0);

     // Floor
     ctx.fillStyle = COLORS.ground;
     ctx.fillRect(cameraX.current, GROUND_HEIGHT, GAME_WIDTH, GAME_HEIGHT - GROUND_HEIGHT);
     ctx.fillStyle = COLORS.groundLine;
     ctx.fillRect(cameraX.current, GROUND_HEIGHT, GAME_WIDTH, 4); 

     // Obstacles
     obstacles.current.forEach(obs => {
         // Cull offscreen
         if(obs.x + obs.width < cameraX.current || obs.x > cameraX.current + GAME_WIDTH) return;

         if (obs.type === ObstacleType.SPIKE) {
             ctx.fillStyle = COLORS.spike;
             ctx.beginPath();
             ctx.moveTo(obs.x, obs.y + obs.height);
             ctx.lineTo(obs.x + obs.width / 2, obs.y);
             ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
             ctx.fill();
             ctx.strokeStyle = '#000'; 
             ctx.stroke();
         } else if (obs.type === ObstacleType.BLOCK || obs.type === ObstacleType.HALF_BLOCK) {
             ctx.fillStyle = obs.type === ObstacleType.HALF_BLOCK ? COLORS.halfBlock : COLORS.block;
             ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
             ctx.strokeStyle = '#000';
             ctx.lineWidth = 2;
             ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
             
             // Top highlight
             ctx.fillStyle = 'rgba(255,255,255,0.3)';
             ctx.fillRect(obs.x, obs.y, obs.width, 4);
         } else if (obs.type === ObstacleType.FLOOR_GAP) {
             ctx.clearRect(obs.x, GROUND_HEIGHT, obs.width, GAME_HEIGHT - GROUND_HEIGHT);
             const grad = ctx.createLinearGradient(0, GROUND_HEIGHT, 0, GAME_HEIGHT);
             grad.addColorStop(0, '#000');
             grad.addColorStop(1, '#0f172a');
             ctx.fillStyle = grad;
             ctx.fillRect(obs.x, GROUND_HEIGHT, obs.width, GAME_HEIGHT - GROUND_HEIGHT);
         } 
     });

     // Player
     const p = player.current;
     if (!p.isDead) {
         ctx.save();
         ctx.translate(p.x + PLAYER_SIZE / 2, p.y + PLAYER_SIZE / 2);
         ctx.rotate((p.rotation * Math.PI) / 180);
         
         // Trail effect
         ctx.shadowBlur = 15;
         ctx.shadowColor = playerColor;
         
         ctx.fillStyle = playerColor;
         ctx.fillRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);
         
         ctx.strokeStyle = '#000';
         ctx.lineWidth = 2;
         ctx.strokeRect(-PLAYER_SIZE / 2, -PLAYER_SIZE / 2, PLAYER_SIZE, PLAYER_SIZE);

         // Face
         ctx.fillStyle = (playerColor === '#000000' || playerColor === '#a855f7') ? '#fff' : '#000';
         ctx.fillRect(4, -6, 6, 6); 
         ctx.fillRect(4, 4, 6, 6);
         ctx.restore();
     }

     // Particles
     particles.current.forEach(pt => {
        ctx.globalAlpha = pt.life;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
     });

     ctx.restore();
  };

  const handleDeath = () => {
     if (player.current.isDead) return;
     player.current.isDead = true;
     spawnParticles(player.current.x + PLAYER_SIZE/2, player.current.y + PLAYER_SIZE/2, playerColor);
     
     if (canvasRef.current) {
         const shake = () => {
            if(!canvasRef.current) return;
            const dx = (Math.random() - 0.5) * 10;
            const dy = (Math.random() - 0.5) * 10;
            canvasRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
            setTimeout(() => {
                if(canvasRef.current) canvasRef.current.style.transform = 'none';
            }, 50);
         }
         shake();
         setTimeout(shake, 100);
     }
     onDeath();
  };

  const containerClasses = (gameState === GameState.PLAYING && !isTestMode) 
    ? "fixed inset-0 w-screen h-screen z-50 bg-slate-900 flex items-center justify-center cursor-none" 
    : "relative w-full max-w-[800px] aspect-video rounded-xl overflow-hidden shadow-2xl border-4 border-slate-700 bg-slate-900 select-none";

  const canvasStyle = (gameState === GameState.PLAYING && !isTestMode)
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
      {gameState === GameState.PLAYING && !isTestMode && (
          <div className="absolute top-4 left-4 text-white/50 text-sm font-mono pointer-events-none">
              ESC to Exit
          </div>
      )}
      <div className="absolute inset-0 z-10 touch-manipulation pointer-events-none" />
    </div>
  );
};

export default GameCanvas;