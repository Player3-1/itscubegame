import React, { useRef, useState, useEffect } from 'react';
import { ObstacleType, LevelData, Obstacle, GameState } from '../types';
import { GAME_HEIGHT, GAME_WIDTH, GROUND_HEIGHT, COLORS } from '../constants';
import { Save, Trash2, Box, Triangle, GripHorizontal, ArrowRight, Play, Square, Eraser } from 'lucide-react';
import GameCanvas from './GameCanvas';

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
  const [isTesting, setIsTesting] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const tools = [
    { type: ObstacleType.BLOCK, icon: Box, label: 'Blok', color: COLORS.block },
    { type: ObstacleType.HALF_BLOCK, icon: GripHorizontal, label: 'Yarım', color: COLORS.halfBlock },
    { type: ObstacleType.SPIKE, icon: Triangle, label: 'Diken', color: COLORS.spike },
    { type: ObstacleType.FLOOR_GAP, icon: ArrowRight, label: 'Boşluk', color: '#fff' },
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
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

        ctx.save();
        ctx.translate(-scrollX, 0);

        // Grid
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        for(let x = Math.floor(scrollX/GRID_SIZE)*GRID_SIZE; x < scrollX + GAME_WIDTH; x+=GRID_SIZE) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, GAME_HEIGHT);
            ctx.stroke();
        }
        for(let y = 0; y < GAME_HEIGHT; y+=GRID_SIZE) {
            ctx.beginPath();
            ctx.moveTo(scrollX, y);
            ctx.lineTo(scrollX+GAME_WIDTH, y);
            ctx.stroke();
        }

        // Floor Line
        ctx.fillStyle = COLORS.ground;
        ctx.fillRect(scrollX, GROUND_HEIGHT, GAME_WIDTH, GAME_HEIGHT-GROUND_HEIGHT);
        ctx.fillStyle = COLORS.groundLine;
        ctx.fillRect(scrollX, GROUND_HEIGHT, GAME_WIDTH, 2);

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
             } else if (obs.type === ObstacleType.FLOOR_GAP) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                ctx.fillRect(obs.x, GROUND_HEIGHT, obs.width, GAME_HEIGHT - GROUND_HEIGHT);
             }
        });
        
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(100, 0); ctx.lineTo(100, GAME_HEIGHT); ctx.stroke();
        
        ctx.fillStyle = 'rgba(0, 240, 255, 0.3)';
        ctx.fillRect(100, GROUND_HEIGHT - 30, 30, 30);

        ctx.restore();
    };
    
    let animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [obstacles, scrollX, isTesting]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isTesting) return;

      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const clickX = (e.clientX - rect.left) * scaleX + scrollX;
      const clickY = (e.clientY - rect.top) * scaleY;

      const gridX = Math.floor(clickX / GRID_SIZE) * GRID_SIZE;
      const gridY = Math.floor(clickY / GRID_SIZE) * GRID_SIZE;

      const existingIndex = obstacles.findIndex(o => 
          clickX >= o.x && clickX <= o.x + o.width &&
          clickY >= o.y && clickY <= o.y + o.height
      );

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
      if (selectedTool === ObstacleType.FLOOR_GAP) {
          y = GROUND_HEIGHT;
          height = 10;
      }
      if (selectedTool === ObstacleType.SPIKE) {
          y = gridY;
      }

      const newObs: Obstacle = {
          id: Date.now(),
          type: selectedTool,
          x: gridX,
          y: y,
          width,
          height,
          passed: false
      };
      setObstacles([...obstacles, newObs]);
  };

  const handleSave = () => {
      if(!levelName) return alert("Lütfen bölüm ismi girin");
      if(obstacles.length < 5) return alert("Bölüm çok kısa!");
      
      const maxDist = Math.max(...obstacles.map(o => o.x + o.width), 1000);

      const levelData: LevelData = {
          obstacles: obstacles,
          theme: 'neon-cyan',
          length: maxDist + 500
      };
      onSave(levelData, levelName);
  };

  const toggleTest = () => {
      setIsTesting(!isTesting);
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-[900px]">
       <div className="flex justify-between items-center bg-slate-800 p-4 rounded-lg">
          <input 
             value={levelName}
             onChange={(e) => setLevelName(e.target.value)}
             className="bg-slate-900 text-white px-3 py-2 rounded border border-slate-700"
             placeholder="Bölüm İsmi"
          />
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
       ) : (
           <div className="relative border-4 border-slate-700 rounded-xl overflow-hidden bg-slate-900 h-[450px]">
               <canvas 
                  ref={canvasRef}
                  width={GAME_WIDTH}
                  height={GAME_HEIGHT}
                  className="cursor-crosshair w-full h-full"
                  onMouseDown={handleCanvasClick}
               />
               <div className="absolute bottom-4 right-4 flex gap-2">
                  <button className="bg-slate-700 p-2 rounded hover:bg-slate-600" onClick={() => setScrollX(Math.max(0, scrollX - 200))}>&lt;</button>
                  <button className="bg-slate-700 p-2 rounded hover:bg-slate-600" onClick={() => setScrollX(scrollX + 200)}>&gt;</button>
               </div>
               <div className="absolute top-2 right-2 bg-black/50 p-1 text-xs text-white">Pos: {scrollX}</div>
           </div>
       )}

       {!isTesting && (
           <>
            <div className="flex gap-2 justify-center bg-slate-800 p-4 rounded-lg overflow-x-auto">
                {tools.map(tool => (
                    <button
                        key={tool.type}
                        onClick={() => setSelectedTool(tool.type)}
                        className={`flex flex-col items-center p-3 rounded transition-all w-20 ${selectedTool === tool.type ? 'bg-cyan-600 scale-105 shadow-lg' : 'bg-slate-700 hover:bg-slate-600'}`}
                    >
                        <tool.icon size={24} style={{ color: tool.color }} />
                        <span className="text-xs mt-1 font-bold">{tool.label}</span>
                    </button>
                ))}
                
                <div className="w-px bg-slate-600 mx-2"></div>

                <button
                    onClick={() => setSelectedTool('ERASER')}
                    className={`flex flex-col items-center p-3 rounded transition-all w-20 ${selectedTool === 'ERASER' ? 'bg-red-600 scale-105 shadow-lg' : 'bg-slate-700 hover:bg-slate-600'}`}
                >
                    <Eraser size={24} className="text-white" />
                    <span className="text-xs mt-1 font-bold">Silgi</span>
                </button>

                <button onClick={() => setObstacles([])} className="flex flex-col items-center p-3 rounded bg-red-900/50 hover:bg-red-900 w-20 text-red-400 ml-2">
                    <Trash2 size={24} />
                    <span className="text-xs mt-1">Sıfırla</span>
                </button>
            </div>
            <p className="text-center text-slate-500 text-sm">Nesne eklemek/silmek için ızgaraya tıklayın. Silgi seçiliyken nesneye tıklayın.</p>
           </>
       )}
    </div>
  );
};

export default LevelEditor;