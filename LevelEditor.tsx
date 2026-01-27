import React, { useRef, useState, useEffect } from 'react';
import { ObstacleType, LevelData, Obstacle, GameState } from './types.ts';
import { GAME_HEIGHT, GAME_WIDTH, GROUND_HEIGHT, COLORS } from './constants.ts';
import { Save, Trash2, Box, Triangle, GripHorizontal, ArrowRight, ArrowUp, Play, Square, Eraser, RotateCw } from 'lucide-react';
import { GameCanvas } from './GameCanvas.tsx';

interface LevelEditorProps {
  onSave: (data: LevelData, name: string) => void;
  onExit: () => void;
}

const GRID_SIZE = 30;

const LevelEditor: React.FC<LevelEditorProps> = ({ onSave, onExit }) => {
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [levelName, setLevelName] = useState('New Level');
  const [selectedTool, setSelectedTool] = useState<ObstacleType | 'ERASER' | 'ROTATE'>(ObstacleType.BLOCK);
  const [selectedCategory, setSelectedCategory] = useState<'blocks' | 'interactive' | 'spikes'>('blocks');
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
    const [isTesting, setIsTesting] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedObstacleId, setSelectedObstacleId] = useState<number | null>(null);
  const [lastPlacedObstacleId, setLastPlacedObstacleId] = useState<number | null>(null);
  // Background and ground colors removed per request; use defaults in renderer
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const toolGroups = {
    blocks: [
      { type: ObstacleType.BLOCK, icon: Box, label: 'Block', color: COLORS.block },
      { type: ObstacleType.HALF_BLOCK, icon: GripHorizontal, label: 'Half Block', color: COLORS.halfBlock },
      { type: ObstacleType.PASS_THROUGH, icon: Box, label: 'Pass Through', color: COLORS.passThrough },
      { type: ObstacleType.DECOR_1, icon: Box, label: 'Decor 1', color: '#10b981' },
      { type: ObstacleType.FLOOR_GAP, icon: ArrowRight, label: 'Gap', color: '#fff' }
    ],
    interactive: [
      { type: ObstacleType.BOUNCER, icon: ArrowUp, label: 'Bouncer', color: COLORS.bouncer },
      { type: ObstacleType.GRAVITY_UP, icon: Box, label: 'Gravity Up', color: COLORS.gravityUp },
      { type: ObstacleType.GRAVITY_NORMAL, icon: Box, label: 'Gravity Normal', color: COLORS.gravityNormal },
      { type: ObstacleType.SLOW_BLOCK, icon: Box, label: 'Slow Block', color: COLORS.slowBlock },
      { type: ObstacleType.NORMAL_BLOCK, icon: Box, label: 'Normal Block', color: COLORS.normalBlock },
      { type: ObstacleType.FAST_BLOCK, icon: Box, label: 'Fast Block', color: COLORS.fastBlock },
      { type: ObstacleType.ORB, icon: Box, label: 'Orb', color: COLORS.orb },
      { type: ObstacleType.GRAVITY_ORB, icon: Box, label: 'Gravity Orb', color: COLORS.gravityOrb },
      { type: ObstacleType.WAVE_PORTAL, icon: Box, label: 'Wave', color: '#8b5cf6' },
      { type: ObstacleType.CUBE_PORTAL, icon: Box, label: 'Cube', color: '#a855f7' }
    ],
    spikes: [
      { type: ObstacleType.SPIKE, icon: Triangle, label: 'Spike', color: COLORS.spike },
      { type: ObstacleType.SMALL_SPIKE, icon: Triangle, label: 'Small Spike', color: COLORS.spike },
      { type: ObstacleType.FAKE_SPIKE, icon: Triangle, label: 'Fake Spike', color: 'rgba(255, 0, 60, 0.6)' }
    ]
  };

  const getRotatedAabb = (o: Obstacle) => {
    const rot = ((o.rotation ?? 0) % 360 + 360) % 360;
    const swap = rot === 90 || rot === 270;
    const w = swap ? o.height : o.width;
    const h = swap ? o.width : o.height;
    const x = o.x + (o.width - w) / 2;
    const y = o.y + (o.height - h) / 2;
    return { x, y, w, h };
  };

  // Draw Editor Loop
  useEffect(() => {
    if (isTesting) return; 

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
        // Bg
        ctx.fillStyle = '#0f172a'; // Default background color
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        ctx.save();
        ctx.translate(-scrollX, -scrollY);

        // Grid
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        for(let x = Math.floor(scrollX/GRID_SIZE)*GRID_SIZE; x < scrollX + GAME_WIDTH; x+=GRID_SIZE) {
            ctx.beginPath();
            ctx.moveTo(x, scrollY - 2000); // extend vertically
            ctx.lineTo(x, scrollY + GAME_HEIGHT + 2000);
            ctx.stroke();
        }
        for(let y = Math.floor(scrollY/GRID_SIZE)*GRID_SIZE; y < scrollY + GAME_HEIGHT; y+=GRID_SIZE) {
            ctx.beginPath();
            ctx.moveTo(scrollX - 2000, y);
            ctx.lineTo(scrollX + GAME_WIDTH + 2000, y);
            ctx.stroke();
        }

        // Floor Line
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(scrollX - 2000, GROUND_HEIGHT, GAME_WIDTH + 4000, GAME_HEIGHT - GROUND_HEIGHT + scrollY);
        ctx.fillStyle = '#334155';
        ctx.fillRect(scrollX - 2000, GROUND_HEIGHT, GAME_WIDTH + 4000, 2);

        // Obstacles
        obstacles.forEach(obs => {
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
                ctx.fillStyle = COLORS.spike;
                ctx.beginPath();
                ctx.moveTo(obs.x, obs.y + obs.height);
                ctx.lineTo(obs.x + obs.width / 2, obs.y);
                ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
                ctx.fill();
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
             } else if (obs.type === ObstacleType.BLOCK) {
                ctx.fillStyle = COLORS.block;
                ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
             } else if (obs.type === ObstacleType.HALF_BLOCK) {
                // Half block (old style)
                ctx.fillStyle = COLORS.halfBlock;
                ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                ctx.strokeStyle = '#000';
                ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                 } else if (obs.type === ObstacleType.PASS_THROUGH) {
                     // Visual only: pale translucent block
                     ctx.fillStyle = COLORS.passThrough as string;
                     ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                     // Dashed border for clarity
                     ctx.save();
                     ctx.setLineDash([6, 4]);
                     ctx.strokeStyle = 'rgba(0,0,0,0.25)';
                     ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.restore();
                 } else if (obs.type === ObstacleType.BOUNCER) {
                     // Bouncer visual: colored rectangle with an up arrow
                     ctx.fillStyle = COLORS.bouncer as string;
                     ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.strokeStyle = '#000';
                     ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                     // Draw up-arrow symbol
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
                 } else if (obs.type === ObstacleType.SPIKE_DOWN) {
                     // Inverted spike: red spike hanging from ceiling downward
                     ctx.fillStyle = COLORS.spike;
                     ctx.beginPath();
                     ctx.moveTo(obs.x, obs.y); // sol üst
                     ctx.lineTo(obs.x + obs.width, obs.y); // sağ üst
                     ctx.lineTo(obs.x + obs.width / 2, obs.y + obs.height); // alt orta
                     ctx.closePath();
                     ctx.fill();
                     ctx.strokeStyle = 'rgba(0,0,0,0.5)';
                     ctx.stroke();
                 } else if (obs.type === ObstacleType.FLOOR_GAP) {
                     ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                     ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
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
                 } else if (obs.type === ObstacleType.CUBE_PORTAL) {
                     ctx.fillStyle = '#a855f7';
                     ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.strokeStyle = '#000';
                     ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                     // Draw cube symbol
                     ctx.fillStyle = '#000';
                     const cx = obs.x + obs.width / 2;
                     const cy = obs.y + obs.height / 2;
                     const size = 6;
                     ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
                     // 3D effect lines
                     ctx.strokeStyle = '#fff';
                     ctx.lineWidth = 1;
                     ctx.beginPath();
                     ctx.moveTo(cx - size, cy - size);
                     ctx.lineTo(cx - size - 3, cy - size - 3);
                     ctx.moveTo(cx + size, cy - size);
                     ctx.lineTo(cx + size + 3, cy - size - 3);
                     ctx.moveTo(cx + size, cy + size);
                     ctx.lineTo(cx + size + 3, cy + size + 3);
                     ctx.stroke();
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
                     // Normal sembolü - soru işareti stilinde
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
                     ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
                     ctx.beginPath();
                     ctx.arc(obs.x + obs.width / 3, obs.y + obs.height / 3, obs.width / 6, 0, Math.PI * 2);
                     ctx.fill();
                 } else if (obs.type === ObstacleType.GRAVITY_UP) {
                     ctx.fillStyle = COLORS.gravityUp;
                     ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.strokeStyle = '#000';
                     ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.fillStyle = '#000';
                     const cx2 = obs.x + obs.width / 2;
                     const cy2 = obs.y + obs.height / 2;
                     ctx.beginPath();
                     ctx.moveTo(cx2, cy2 - 8);
                     ctx.lineTo(cx2 + 4, cy2 - 4);
                     ctx.lineTo(cx2 - 4, cy2 - 4);
                     ctx.closePath();
                     ctx.fill();
                     ctx.fillRect(cx2 - 1, cy2 - 4, 2, 8);
                 } else if (obs.type === ObstacleType.GRAVITY_NORMAL) {
                     ctx.fillStyle = COLORS.gravityNormal;
                     ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.strokeStyle = '#000';
                     ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.fillStyle = '#000';
                     const cx2 = obs.x + obs.width / 2;
                     const cy2 = obs.y + obs.height / 2;
                     ctx.beginPath();
                     ctx.moveTo(cx2, cy2 + 8);
                     ctx.lineTo(cx2 + 4, cy2 + 4);
                     ctx.lineTo(cx2 - 4, cy2 + 4);
                     ctx.closePath();
                     ctx.fill();
                     ctx.fillRect(cx2 - 1, cy2 - 4, 2, 8);
                 } else if (obs.type === ObstacleType.WAVE_PORTAL) {
                     ctx.fillStyle = '#8b5cf6';
                     ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.strokeStyle = '#000';
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
                     ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
                     ctx.fillStyle = '#000';
                     ctx.font = 'bold 14px Arial';
                     ctx.textAlign = 'center';
                     ctx.textBaseline = 'middle';
                     ctx.fillText('C', obs.x + obs.width / 2, obs.y + obs.height / 2);
                 }
             ctx.restore();
             });

        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(100, 0); ctx.lineTo(100, GAME_HEIGHT); ctx.stroke();
        
        // Test indicator: small cyan triangle (matches test triangle requested)
        ctx.fillStyle = 'rgba(0, 240, 255, 0.9)';
        ctx.beginPath();
        ctx.moveTo(100 + 15, GROUND_HEIGHT - 30); // top
        ctx.lineTo(100, GROUND_HEIGHT); // bottom-left
        ctx.lineTo(100 + 30, GROUND_HEIGHT); // bottom-right
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    };
    
    let animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [obstacles, scrollX, scrollY, isTesting]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTesting) return;

      let delta = 0;
      if (e.code === 'KeyQ') delta = -90;
      if (e.code === 'KeyE') delta = 90;
      if (delta === 0) return;

      e.preventDefault();

      const targetId = selectedObstacleId ?? lastPlacedObstacleId;
      if (targetId == null) return;

      setObstacles((prev) =>
        prev.map((o) =>
          o.id === targetId
            ? { ...o, rotation: ((((o.rotation ?? 0) + delta) % 360) + 360) % 360 }
            : o
        )
      );
      setLastPlacedObstacleId(targetId);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isTesting, lastPlacedObstacleId, selectedObstacleId]);



  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isTesting) return;

      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();

      const scale = Math.min(rect.width / GAME_WIDTH, rect.height / GAME_HEIGHT);
      const displayedWidth = GAME_WIDTH * scale;
      const displayedHeight = GAME_HEIGHT * scale;
      const offsetX = (rect.width - displayedWidth) / 2;
      const offsetY = (rect.height - displayedHeight) / 2;

      const clickX = ((e.clientX - rect.left - offsetX) / scale) + scrollX;
      const clickY = ((e.clientY - rect.top - offsetY) / scale) + scrollY;

      const gridX = Math.floor(clickX / GRID_SIZE) * GRID_SIZE;
      const gridY = Math.floor(clickY / GRID_SIZE) * GRID_SIZE;

      const existingIndex = obstacles.findIndex(o => 
          (() => {
            const a = getRotatedAabb(o);
            return clickX >= a.x && clickX <= a.x + a.w && clickY >= a.y && clickY <= a.y + a.h;
          })()
      );

      // (no color swatches / pickers anymore)



      if (selectedTool === 'ERASER') {
          if (existingIndex !== -1) {
              const newObs = [...obstacles];
              newObs.splice(existingIndex, 1);
              setObstacles(newObs);
          }
          setSelectedObstacleId(null);
          return;
      }

      if (selectedTool === 'ROTATE') {
          if (existingIndex !== -1) {
              setSelectedObstacleId(obstacles[existingIndex].id);
          } else {
              setSelectedObstacleId(null);
          }
          return;
      }



      if (gridX < 200) return;

      const overlapIndex = obstacles.findIndex(o => 
          Math.abs(o.x - gridX) < 1 && Math.abs(o.y - gridY) < 1
      );

      if (overlapIndex !== -1) {
          const newObs = [...obstacles];
          newObs.splice(overlapIndex, 1);
          setObstacles(newObs);
      }

      let width = GRID_SIZE;
      let height = GRID_SIZE;
      let y = gridY;

      if (selectedTool === ObstacleType.HALF_BLOCK) {
          height = GRID_SIZE / 2;
          y = gridY + GRID_SIZE/2; 
      }
      if (selectedTool === ObstacleType.PASS_THROUGH) {
          // Standard full block size but passable
          height = GRID_SIZE;
          y = gridY;
      }
      if (selectedTool === ObstacleType.BOUNCER) {
          // Bouncer is a full block by default
          height = GRID_SIZE;
          y = gridY;
      }
      if (selectedTool === ObstacleType.FLOOR_GAP) {
          y = GROUND_HEIGHT;
          height = GAME_HEIGHT - GROUND_HEIGHT; // make the gap fill ground->bottom so eraser clicks detect it reliably
      }
      if (selectedTool === ObstacleType.SPIKE) {
          y = gridY;
      }

      if (selectedTool === ObstacleType.SMALL_SPIKE) {
          height = GRID_SIZE / 2;
          y = gridY + GRID_SIZE / 2;
      }

      const newObs: Obstacle = {
          id: Date.now(),
          type: selectedTool as ObstacleType,
          x: gridX,
          y: y,
          width,
          height,
          passed: false,
          rotation: 0,
      };
      setObstacles([...obstacles, newObs]);
      setLastPlacedObstacleId(newObs.id);
      setSelectedObstacleId(newObs.id);
  };

  const handleSave = () => {
      if(!levelName) return alert("Please enter a level name");
      if(obstacles.length < 5) return alert("Level is too short!");

      if (obstacles.length === 0) {
          const levelData: LevelData = {
              obstacles: [],
              theme: 'neon-cyan',
              length: 1000
          };
          onSave(levelData, levelName);
          return;
      }

      const shiftedObstacles = obstacles;

      const levelData: LevelData = {
          obstacles: shiftedObstacles,
          theme: 'neon-cyan',
          length: Math.max(...obstacles.map(o => o.x + o.width), 1000) + 500
      };
      onSave(levelData, levelName);
  };

  const toggleTest = () => {
      setIsTesting(!isTesting);
  };

  // Arrow keys to pan the editor (when not testing)
  useEffect(() => {
    const step = 80;
    const handler = (e: KeyboardEvent) => {
      if (isTesting) return;
      if (e.code === 'ArrowLeft') { setScrollX((x) => Math.max(0, x - step)); }
      if (e.code === 'ArrowRight') { setScrollX((x) => x + step); }
      if (e.code === 'ArrowUp') { setScrollY((y) => y - step); }
      if (e.code === 'ArrowDown') { setScrollY((y) => y + step); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isTesting]);

  return (
    <div className="flex flex-col gap-4 w-full h-screen">
       <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-800 p-2 sm:p-4 rounded-lg gap-2 sm:gap-0">
           <div className="flex items-center gap-3 w-full sm:w-auto">
             <input
                value={levelName}
                onChange={(e) => setLevelName(e.target.value)}
                className="bg-slate-900 text-white px-3 py-2 rounded border border-slate-700 flex-1 sm:flex-none"
                placeholder="Level Name"
             />
             <div className="flex items-center gap-2">

             </div>
           </div>
           <div className="flex gap-2 w-full sm:w-auto justify-center sm:justify-end">
              <button
                 onClick={toggleTest}
                 className={`px-3 sm:px-4 py-2 rounded font-bold flex gap-2 items-center text-sm sm:text-base ${isTesting ? 'bg-orange-500 hover:bg-orange-400' : 'bg-cyan-600 hover:bg-cyan-500'}`}
              >
                 {isTesting ? <><Square size={16} className="sm:w-5 sm:h-5" fill="currentColor"/> EDIT</> : <><Play size={16} className="sm:w-5 sm:h-5" fill="currentColor"/> TEST</>}
              </button>
              {!isTesting && (
                 <>
                     <button onClick={onExit} className="px-3 sm:px-4 py-2 bg-red-600 rounded font-bold hover:bg-red-500 text-sm sm:text-base">Exit</button>
                     <button onClick={handleSave} className="px-3 sm:px-4 py-2 bg-green-600 rounded font-bold flex gap-2 items-center hover:bg-green-500 text-sm sm:text-base">
                         <Save size={16} className="sm:w-5 sm:h-5" /> PUBLISH
                     </button>
                 </>
              )}
           </div>
        </div>

       {isTesting ? (
            <div className="flex-1 w-full">
              <GameCanvas 
                  gameState={GameState.PLAYING}
                  setGameState={() => setIsTesting(false)}
                  setScore={() => {}}
                  levelData={{
                      obstacles: obstacles,
                      theme: 'neon-cyan',
                      length: Math.max(...obstacles.map(o => o.x), 1000) + 1000
                  }}
                  onDeath={() => setIsTesting(false)}
                  onWin={() => setIsTesting(false)}
                  playerColor={COLORS.player}
                  isTestMode={true}
              />
            </div>
       ) : (
           <div className="relative border-4 border-slate-700 rounded-xl overflow-hidden bg-slate-900 flex-1 min-h-[60vh]">
               <canvas
                  ref={canvasRef}
                  width={GAME_WIDTH}
                  height={GAME_HEIGHT}
                  className="cursor-crosshair"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: '100vh', maxWidth: '100vw' }}
                  onMouseDown={handleCanvasClick}
               />
               <div className="absolute bottom-4 right-4 flex gap-2">
                  <button className="bg-slate-700 p-2 rounded hover:bg-slate-600" onClick={() => setScrollX(Math.max(0, scrollX - 200))}>&lt;</button>
                  <button className="bg-slate-700 p-2 rounded hover:bg-slate-600" onClick={() => setScrollX(scrollX + 200)}>&gt;</button>
                  <button className="bg-slate-700 p-2 rounded hover:bg-slate-600" onClick={() => setScrollY((y) => y - 200)}>↑</button>
                  <button className="bg-slate-700 p-2 rounded hover:bg-slate-600" onClick={() => setScrollY((y) => y + 200)}>↓</button>
               </div>
               <div className="absolute top-2 right-2 bg-black/50 p-1 text-xs text-white">Pos: x:{scrollX} y:{scrollY}</div>
           </div>
       )}

       {!isTesting && (
           <>
            <div className="flex flex-col gap-3 bg-slate-800 p-4 rounded-lg">
                <div className="flex gap-2 justify-center">
                    <button
                        onClick={() => setSelectedCategory('blocks')}
                        className={`px-4 py-2 rounded font-bold ${selectedCategory === 'blocks' ? 'bg-cyan-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                    >
                        Bloklar
                    </button>
                    <button
                        onClick={() => setSelectedCategory('interactive')}
                        className={`px-4 py-2 rounded font-bold ${selectedCategory === 'interactive' ? 'bg-cyan-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                    >
                        Etkileşimli
                    </button>
                    <button
                        onClick={() => setSelectedCategory('spikes')}
                        className={`px-4 py-2 rounded font-bold ${selectedCategory === 'spikes' ? 'bg-cyan-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                    >
                        Dikenler
                    </button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 justify-center">
                    {toolGroups[selectedCategory].map(tool => {
                        const Icon = tool.icon;
                        return (
                            <button
                                key={tool.type}
                                onClick={() => setSelectedTool(tool.type)}
                                className={`flex flex-col items-center p-3 rounded transition-all w-20 ${selectedTool === tool.type ? 'bg-cyan-600 scale-105 shadow-lg' : 'bg-slate-700 hover:bg-slate-600'}`}
                            >
                                <Icon size={24} style={{ color: tool.color }} />
                                <span className="text-xs mt-1 font-bold">{tool.label}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-2 justify-center">
                    <button
                        onClick={() => setSelectedTool('ERASER')}
                        className={`flex flex-col items-center p-3 rounded transition-all w-20 ${selectedTool === 'ERASER' ? 'bg-red-600 scale-105 shadow-lg' : 'bg-slate-700 hover:bg-slate-600'}`}
                    >
                        <Eraser size={24} className="text-white" />
                        <span className="text-xs mt-1 font-bold">Eraser</span>
                    </button>

                    <button
                        onClick={() => setSelectedTool('ROTATE')}
                        className={`flex flex-col items-center p-3 rounded transition-all w-20 ${selectedTool === 'ROTATE' ? 'bg-cyan-600 scale-105 shadow-lg' : 'bg-slate-700 hover:bg-slate-600'}`}
                    >
                        <RotateCw size={24} className="text-white" />
                        <span className="text-xs mt-1 font-bold">Rotate</span>
                    </button>

                    <button onClick={() => setShowClearConfirm(true)} className="flex flex-col items-center p-3 rounded bg-red-900/50 hover:bg-red-900 w-20 text-red-400 ml-2">
                        <Trash2 size={24} />
                        <span className="text-xs mt-1">Reset</span>
                    </button>
                </div>

                {showClearConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/60" onClick={() => setShowClearConfirm(false)} />
                        <div className="bg-slate-800 p-6 rounded-lg z-10 w-96 border border-slate-700">
                            <h3 className="text-lg font-bold mb-2">Clear all objects?</h3>
                            <p className="text-sm text-slate-400 mb-4">This will remove all objects. You cannot undo this action.</p>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setShowClearConfirm(false)} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600">Cancel</button>
                                <button onClick={() => { setObstacles([]); setShowClearConfirm(false); }} className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white">Yes, Clear</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <p className="text-center text-slate-500 text-sm">Click on the grid to add/remove objects. Select the eraser and click on an object to delete it. Select rotate tool, click an object, then press Q/E to rotate.</p>
           </>
       )}
    </div>
  );
};

export default LevelEditor;