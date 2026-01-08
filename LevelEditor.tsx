import React, { useRef, useState, useEffect } from 'react';
import { ObstacleType, LevelData, Obstacle, GameState } from './types.ts';
import { GAME_HEIGHT, GAME_WIDTH, GROUND_HEIGHT, COLORS } from './constants.ts';
import { Save, Trash2, Box, Triangle, GripHorizontal, ArrowRight, ArrowUp, Play, Square, Eraser } from 'lucide-react';
import { GameCanvas } from './GameCanvas.tsx';

interface LevelEditorProps {
  onSave: (data: LevelData, name: string) => void;
  onExit: () => void;
}

const GRID_SIZE = 30;

const LevelEditor: React.FC<LevelEditorProps> = ({ onSave, onExit }) => {
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [levelName, setLevelName] = useState('New Level');
  const [selectedTool, setSelectedTool] = useState<ObstacleType | 'ERASER'>(ObstacleType.BLOCK);
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
    const [isTesting, setIsTesting] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
  // Background and ground colors removed per request; use defaults in renderer
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const tools = [
      { type: ObstacleType.BLOCK, icon: Box, label: 'Blok', color: COLORS.block },
      { type: ObstacleType.DECOR_1, icon: Box, label: 'Dekor 1', color: '#10b981' },
      { type: ObstacleType.HALF_BLOCK, icon: GripHorizontal, label: 'Yarım', color: COLORS.halfBlock },
          { type: ObstacleType.PASS_THROUGH, icon: Box, label: 'İçinden Geç', color: COLORS.passThrough },
          { type: ObstacleType.BOUNCER, icon: ArrowUp, label: 'Zıplatıcı', color: COLORS.bouncer },
      { type: ObstacleType.SPIKE, icon: Triangle, label: 'Diken', color: COLORS.spike },
      { type: ObstacleType.FAKE_SPIKE, icon: Triangle, label: 'Sahte Diken', color: 'rgba(255, 0, 60, 0.6)' },
      { type: ObstacleType.SPIKE_DOWN, icon: Triangle, label: 'Ters Diken', color: 'rgba(255, 0, 60, 0.6)' },
      { type: ObstacleType.FAKE_SPIKE_DOWN, icon: Triangle, label: 'Ters Sahte Diken', color: 'rgba(255, 0, 60, 0.6)' },
      { type: ObstacleType.FLOOR_GAP, icon: ArrowRight, label: 'Boşluk', color: '#fff' }
    ];

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
             if (obs.type === ObstacleType.SPIKE) {
                ctx.fillStyle = COLORS.spike;
                ctx.beginPath();
                ctx.moveTo(obs.x, obs.y + obs.height);
                ctx.lineTo(obs.x + obs.width / 2, obs.y);
                ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
                ctx.fill();
             } else if (obs.type === ObstacleType.BLOCK || obs.type === ObstacleType.HALF_BLOCK) {
                ctx.fillStyle = obs.type === ObstacleType.HALF_BLOCK ? COLORS.halfBlock : COLORS.block;
                ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
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
                     // Ters diken: tavandan aşağı doğru kırmızı diken
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
                 } else if (obs.type === ObstacleType.FAKE_SPIKE_DOWN) {
                     ctx.fillStyle = 'rgba(255, 0, 60, 0.6)';
                     ctx.beginPath();
                     ctx.moveTo(obs.x, obs.y);
                     ctx.lineTo(obs.x + obs.width, obs.y);
                     ctx.lineTo(obs.x + obs.width / 2, obs.y + obs.height);
                     ctx.closePath();
                     ctx.fill();
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
                 }
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
          clickX >= o.x && clickX <= o.x + o.width &&
          clickY >= o.y && clickY <= o.y + o.height
      );

      // (no color swatches / pickers anymore)



      if (selectedTool === 'ERASER') {
          if (existingIndex !== -1) {
              const newObs = [...obstacles];
              newObs.splice(existingIndex, 1);
              setObstacles(newObs);
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

      // Special case: placed SPIKE_DOWN under an existing SPIKE if clicked
      if (selectedTool === ObstacleType.SPIKE_DOWN && existingIndex !== -1 && obstacles[existingIndex].type === ObstacleType.SPIKE) {
          const sp = obstacles[existingIndex];
          const newObs: Obstacle = {
              id: Date.now(),
              type: ObstacleType.SPIKE_DOWN,
              x: sp.x,
              y: sp.y + sp.height,
              width: sp.width,
              height: sp.height,
              passed: false
          };
          setObstacles([...obstacles, newObs]);
          return;
      }

      // Special case: placed FAKE_SPIKE_DOWN under an existing FAKE_SPIKE if clicked
      if (selectedTool === ObstacleType.FAKE_SPIKE_DOWN && existingIndex !== -1 && obstacles[existingIndex].type === ObstacleType.FAKE_SPIKE) {
          const sp = obstacles[existingIndex];
          const newObs: Obstacle = {
              id: Date.now(),
              type: ObstacleType.FAKE_SPIKE_DOWN,
              x: sp.x,
              y: sp.y + sp.height,
              width: sp.width,
              height: sp.height,
              passed: false
          };
          setObstacles([...obstacles, newObs]);
          return;
      }


      const newObs: Obstacle = {
          id: Date.now(),
          type: selectedTool as ObstacleType,
          x: gridX,
          y: y,
          width,
          height,
          passed: false,
      };
      setObstacles([...obstacles, newObs]);
  };

  const handleSave = () => {
      if(!levelName) return alert("Lütfen bölüm ismi girin");
      if(obstacles.length < 5) return alert("Bölüm çok kısa!");

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
       <div className="flex justify-between items-center bg-slate-800 p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <input 
               value={levelName}
               onChange={(e) => setLevelName(e.target.value)}
               className="bg-slate-900 text-white px-3 py-2 rounded border border-slate-700"
               placeholder="Bölüm İsmi"
            />
            <div className="flex items-center gap-2">
    
            </div>
          </div>
          <div className="flex gap-2">
             <button 
                onClick={toggleTest} 
                className={`px-4 py-2 rounded font-bold flex gap-2 items-center ${isTesting ? 'bg-orange-500 hover:bg-orange-400' : 'bg-cyan-600 hover:bg-cyan-500'}`}
             >
                {isTesting ? <><Square size={18} fill="currentColor"/> DÜZENLE</> : <><Play size={18} fill="currentColor"/> TEST ET</>}
             </button>
             {!isTesting && (
                <>
                    <button onClick={onExit} className="px-4 py-2 bg-red-600 rounded font-bold hover:bg-red-500">Çık</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-green-600 rounded font-bold flex gap-2 items-center hover:bg-green-500">
                        <Save size={18} /> YAYINLA
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
                  playerColor={COLORS.admin}
                  isTestMode={true}
              />
            </div>
       ) : (
           <div className="relative border-4 border-slate-700 rounded-xl overflow-hidden bg-slate-900 flex-1 aspect-video">
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
            <div className="flex gap-2 justify-center bg-slate-800 p-4 rounded-lg overflow-x-auto">
                {tools.map(tool => {
                    const Icon = tool.icon;
                    const isSpikeDown = tool.type === ObstacleType.SPIKE_DOWN;
                    const isFakeSpikeDown = tool.type === ObstacleType.FAKE_SPIKE_DOWN;
                    return (
                        <button
                            key={tool.type}
                            onClick={() => setSelectedTool(tool.type)}
                            className={`flex flex-col items-center p-3 rounded transition-all w-20 ${selectedTool === tool.type ? 'bg-cyan-600 scale-105 shadow-lg' : 'bg-slate-700 hover:bg-slate-600'}`}
                        >
                            <div className={isSpikeDown || isFakeSpikeDown ? 'transform rotate-180' : ''}>
                                <Icon size={24} style={{ color: tool.color }} />
                            </div>
                            <span className="text-xs mt-1 font-bold">{tool.label}</span>
                        </button>
                    );
                })}
                
                <div className="w-px bg-slate-600 mx-2"></div>

                <button
                    onClick={() => setSelectedTool('ERASER')}
                    className={`flex flex-col items-center p-3 rounded transition-all w-20 ${selectedTool === 'ERASER' ? 'bg-red-600 scale-105 shadow-lg' : 'bg-slate-700 hover:bg-slate-600'}`}
                >
                    <Eraser size={24} className="text-white" />
                    <span className="text-xs mt-1 font-bold">Silgi</span>
                </button>


                <button onClick={() => setShowClearConfirm(true)} className="flex flex-col items-center p-3 rounded bg-red-900/50 hover:bg-red-900 w-20 text-red-400 ml-2">
                    <Trash2 size={24} />
                    <span className="text-xs mt-1">Sıfırla</span>
                </button>


                {showClearConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/60" onClick={() => setShowClearConfirm(false)} />
                        <div className="bg-slate-800 p-6 rounded-lg z-10 w-96 border border-slate-700">
                            <h3 className="text-lg font-bold mb-2">Temizlemek istiyor musunuz?</h3>
                            <p className="text-sm text-slate-400 mb-4">Bu, tüm nesneleri kaldıracaktır. İşlemi geri alamazsınız.</p>
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setShowClearConfirm(false)} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600">Vazgeç</button>
                                <button onClick={() => { setObstacles([]); setShowClearConfirm(false); }} className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white">Evet, Temizle</button>
                            </div>
                        </div>
                    </div>
                )}
                {/* color picking removed */}
            </div>
            <p className="text-center text-slate-500 text-sm">Nesne eklemek/silmek için ızgaraya tıklayın. Silgi seçiliyken nesneye tıklayın.</p>
           </>
       )}
    </div>
  );
};

export default LevelEditor;