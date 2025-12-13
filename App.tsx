import React, { useState, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import LevelEditor from './components/LevelEditor';
import { GameState, LevelData, User, LevelMetadata, ObstacleType } from './types';
import { ADMIN_PASSWORD, SKINS, COLORS } from './constants';
import { Play, RotateCcw, PenTool, User as UserIcon, Lock, Trophy, Star, ChevronLeft, ShieldAlert, Globe, Heart, Eye, CheckCircle, LogIn, UserPlus } from 'lucide-react';
import { db } from './firebase';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';

// Start with empty levels
const DEFAULT_LEVELS: LevelMetadata[] = [];

const App: React.FC = () => {
  // Screens
  const [gameState, setGameState] = useState<GameState>(GameState.LOGIN);
  
  // Data
  const [user, setUser] = useState<User | null>(null);
  const [levels, setLevels] = useState<LevelMetadata[]>([]);
  const [currentLevel, setCurrentLevel] = useState<LevelMetadata | null>(null);
  const [score, setScore] = useState(0); // Progress %

  // Login Form State
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginName, setLoginName] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [showAdminCodeInput, setShowAdminCodeInput] = useState(false); // Special step for dgoa
  const [loginError, setLoginError] = useState("");

  // Load Levels Data (prefer Firestore, fallback to localStorage)
  useEffect(() => {
    const loadLevels = async () => {
      try {
        const snap = await getDocs(collection(db, 'levels'));
        if (!snap.empty) {
          const remoteLevels: LevelMetadata[] = snap.docs.map((d) => d.data() as LevelMetadata);
          setLevels(remoteLevels);
          localStorage.setItem('nd_levels', JSON.stringify(remoteLevels));
          return;
        }
      } catch (err) {
        console.error('Firestore level load error:', err);
      }

      const storedLevels = localStorage.getItem('nd_levels');
      if (storedLevels) {
        setLevels(JSON.parse(storedLevels));
      } else {
        setLevels(DEFAULT_LEVELS);
        localStorage.setItem('nd_levels', JSON.stringify(DEFAULT_LEVELS));
      }
    };

    loadLevels();
  }, []);

  // Load Users DB from Firestore into localStorage (for existing helper usage)
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        if (!snap.empty) {
          const users: User[] = snap.docs.map((d) => d.data() as User);
          localStorage.setItem('nd_users_db', JSON.stringify(users));
        }
      } catch (err) {
        console.error('Firestore users load error:', err);
      }
    };

    loadUsers();
  }, []);

  // Helper: Get full DB (local cache of users)
  const getUsersDB = (): User[] => {
      const dbStr = localStorage.getItem('nd_users_db');
      return dbStr ? JSON.parse(dbStr) : [];
  };

  // Helper: Save user to DB and State
  const saveUserFull = (updatedUser: User) => {
      // 1. Update State
      setUser(updatedUser);
      
      // 2. Update Session Storage
      localStorage.setItem('nd_user', JSON.stringify(updatedUser));

      // 3. Update Global DB (local cache)
      const usersDb = getUsersDB();
      const index = usersDb.findIndex(u => u.name === updatedUser.name);
      
      if (index !== -1) {
          usersDb[index] = updatedUser;
      } else {
          usersDb.push(updatedUser);
      }
      localStorage.setItem('nd_users_db', JSON.stringify(usersDb));

      // 4. Mirror to Firestore (fire-and-forget)
      (async () => {
        try {
          const ref = doc(db, 'users', updatedUser.name);
          await setDoc(ref, updatedUser);
        } catch (err) {
          console.error('Firestore save user error:', err);
        }
      })();
  };

  // Initialize Default Admin (dgoa) if not exists
  useEffect(() => {
      const usersDb = getUsersDB();
      const adminExists = usersDb.find(u => u.name === 'dgoa');
      if (!adminExists) {
          const defaultAdmin: User = {
              name: 'dgoa',
              password: 'd2d0d1d4',
              isAdmin: true, 
              totalStars: 0, // Reset to 0 stars
              completedLevels: [],
              likedLevels: [],
              selectedColor: '#00f0ff'
          };
          usersDb.push(defaultAdmin);
          localStorage.setItem('nd_users_db', JSON.stringify(usersDb));

          (async () => {
            try {
              const ref = doc(db, 'users', defaultAdmin.name);
              await setDoc(ref, defaultAdmin);
            } catch (err) {
              console.error('Firestore init admin error:', err);
            }
          })();
      }
  }, []);

  // Check for auto-login session
  useEffect(() => {
    const sessionUser = localStorage.getItem('nd_user');
    if (sessionUser) {
        // Verify against DB to get latest stats
        const parsedSession = JSON.parse(sessionUser);
        const db = getUsersDB();
        const freshUser = db.find(u => u.name === parsedSession.name);
        if (freshUser) {
            setUser(freshUser);
        } else {
            setUser(parsedSession);
        }
    }
  }, []);

  const handleAuthAction = () => {
     setLoginError("");
     const name = loginName.trim();
     const pass = loginPass.trim();

     if (!name || !pass) {
       setLoginError("Kullanıcı adı ve şifre gerekli!");
       return;
     }

     const db = getUsersDB();
     const existingUser = db.find(u => u.name === name);

     if (isRegistering) {
         // REGISTER LOGIC
         if (existingUser) {
             setLoginError("Bu isim zaten alınmış!");
             return;
         }
         if (name.toLowerCase() === 'dgoa') {
             setLoginError("Bu isim yasaklı.");
             return;
         }

         const newUser: User = {
            name: name,
            password: pass,
            isAdmin: false,
            totalStars: 0,
            completedLevels: [],
            likedLevels: [],
            selectedColor: COLORS.player
         };
         
         saveUserFull(newUser);
         setGameState(GameState.MENU);
     } else {
         // LOGIN LOGIC
         if (!existingUser) {
             setLoginError("Kullanıcı bulunamadı.");
             return;
         }
         if (existingUser.password && existingUser.password !== pass) {
             setLoginError("Hatalı şifre!");
             return;
         }

         // Special Admin Check for 'dgoa'
         if (existingUser.name === 'dgoa') {
             setShowAdminCodeInput(true);
             setLoginError(""); // Clear errors
             return; // Stop here, wait for admin code
         }

         // Normal User Login
         saveUserFull(existingUser);
         setGameState(GameState.MENU);
     }
  };

  const handleAdminCodeSubmit = () => {
      if (adminCode === ADMIN_PASSWORD) {
          const db = getUsersDB();
          const adminUser = db.find(u => u.name === 'dgoa');
          if (adminUser) {
            saveUserFull(adminUser);
            setGameState(GameState.MENU);
          }
      } else {
          setLoginError("Geçersiz Yönetici Kodu!");
      }
  };

  const handleLogout = () => {
      setUser(null);
      localStorage.removeItem('nd_user');
      setGameState(GameState.LOGIN);
      setLoginName("");
      setLoginPass("");
      setAdminCode("");
      setShowAdminCodeInput(false);
      setLoginError("");
  };

  const handleSkinSelect = (color: string) => {
     if (!user) return;
     const updatedUser = { ...user, selectedColor: color };
     saveUserFull(updatedUser);
  };

  const saveLevel = (data: LevelData, name: string) => {
     const newLevel: LevelMetadata = {
       id: Date.now().toString(),
       name: name,
       author: user?.name || 'Anon',
       difficulty: 'Unlisted',
       stars: 0,
       data: data,
       plays: 0,
       likes: 0
     };
     
     const currentStoredLevels = localStorage.getItem('nd_levels');
     const currentLevels = currentStoredLevels ? JSON.parse(currentStoredLevels) : levels;
     
     const updatedLevels = [...currentLevels, newLevel];
     setLevels(updatedLevels);
     localStorage.setItem('nd_levels', JSON.stringify(updatedLevels));
     // Persist to Firestore
     (async () => {
       try {
         const ref = doc(db, 'levels', newLevel.id);
         await setDoc(ref, newLevel);
       } catch (err) {
         console.error('Firestore save level error:', err);
       }
     })();
     setGameState(GameState.LEVEL_SELECT);
  };

  const updateDifficulty = (levelId: string, diff: LevelMetadata['difficulty']) => {
      if (!user?.isAdmin) return;
      
      const starsMap = { 'Unlisted': 0, 'Easy': 2, 'Normal': 4, 'Hard': 6, 'Insane': 8 };
      
      const updatedLevels = levels.map(l => {
          if (l.id === levelId) {
             return { ...l, difficulty: diff, stars: starsMap[diff] };
          }
          return l;
      });
      setLevels(updatedLevels);
      localStorage.setItem('nd_levels', JSON.stringify(updatedLevels));
      // Mirror difficulty/stars to Firestore
      const updated = updatedLevels.find(l => l.id === levelId);
      if (updated) {
        (async () => {
          try {
            const ref = doc(db, 'levels', levelId);
            await updateDoc(ref, { difficulty: updated.difficulty, stars: updated.stars });
          } catch (err) {
            console.error('Firestore update difficulty error:', err);
          }
        })();
      }
  };

  const handleLevelComplete = () => {
      if (!currentLevel || !user) return;
      
      const db = getUsersDB();
      const freshUser = db.find(u => u.name === user.name) || user;

      let updatedUser = { ...freshUser };
      let changed = false;

      const alreadyCompleted = freshUser.completedLevels.includes(currentLevel.id);

      if (!alreadyCompleted) {
          updatedUser.completedLevels = [...freshUser.completedLevels, currentLevel.id];
          if (currentLevel.stars > 0) {
              updatedUser.totalStars = (freshUser.totalStars || 0) + currentLevel.stars;
          }
          changed = true;
      }
      
      if (changed) {
        saveUserFull(updatedUser);
      }
      setGameState(GameState.GAME_OVER);
  };

  const handlePlayLevel = (level: LevelMetadata) => {
      const updatedLevels = levels.map(l => {
          if (l.id === level.id) {
              return { ...l, plays: (l.plays || 0) + 1 };
          }
          return l;
      });
      setLevels(updatedLevels);
      localStorage.setItem('nd_levels', JSON.stringify(updatedLevels));

      // Mirror plays count to Firestore
      const updated = updatedLevels.find(l => l.id === level.id);
      if (updated) {
        (async () => {
          try {
            const ref = doc(db, 'levels', level.id);
            await updateDoc(ref, { plays: updated.plays });
          } catch (err) {
            console.error('Firestore update plays error:', err);
          }
        })();
      }

      setCurrentLevel(level);
      setScore(0);
      setGameState(GameState.PLAYING);
  }

  const handleLikeLevel = (levelId: string) => {
      if (!user) return;
      const isLiked = user.likedLevels?.includes(levelId);
      
      const updatedUser = {
          ...user,
          likedLevels: isLiked 
            ? user.likedLevels.filter(id => id !== levelId)
            : [...(user.likedLevels || []), levelId]
      };
      saveUserFull(updatedUser);

      const updatedLevels = levels.map(l => {
          if (l.id === levelId) {
              return { ...l, likes: (l.likes || 0) + (isLiked ? -1 : 1) };
          }
          return l;
      });
      setLevels(updatedLevels);
      localStorage.setItem('nd_levels', JSON.stringify(updatedLevels));
      // Mirror likes count to Firestore
      const updated = updatedLevels.find(l => l.id === levelId);
      if (updated) {
        (async () => {
          try {
            const ref = doc(db, 'levels', levelId);
            await updateDoc(ref, { likes: updated.likes });
          } catch (err) {
            console.error('Firestore update likes error:', err);
          }
        })();
      }
  }

  // --- RENDERERS ---

  if (gameState === GameState.LOGIN) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-rajdhani">
            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 relative overflow-hidden">
               {/* Decorative background element */}
               <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-500 via-pink-500 to-yellow-500"></div>

               <h1 className="text-4xl font-black text-center text-cyan-400 mb-2 font-orbitron tracking-wider">CUBE DASH</h1>
               <p className="text-center text-slate-400 mb-8 font-bold">
                   {showAdminCodeInput ? "YÖNETİCİ DOĞRULAMA" : (isRegistering ? "HESAP OLUŞTUR" : "GİRİŞ YAP")}
               </p>
               
               {showAdminCodeInput ? (
                   // ADMIN CODE SCREEN
                   <div className="space-y-4 animate-in zoom-in-95">
                       <div className="bg-pink-900/20 p-4 rounded border border-pink-500/50 text-center mb-4">
                           <ShieldAlert className="mx-auto text-pink-500 mb-2" size={32} />
                           <p className="text-pink-200 text-sm">Bu hesaba erişmek için yönetici anahtarı gereklidir.</p>
                       </div>
                       <div>
                          <label className="block text-xs uppercase font-bold text-pink-500 mb-1">Yönetici Şifresi</label>
                          <input 
                              type="password"
                              className="w-full bg-slate-900 border border-pink-500 rounded p-3 text-white focus:outline-none focus:shadow-[0_0_10px_rgba(236,72,153,0.5)] transition"
                              value={adminCode}
                              onChange={(e) => setAdminCode(e.target.value)}
                              placeholder="Kodu girin..."
                          />
                       </div>
                       {loginError && <p className="text-red-500 text-sm font-bold text-center bg-red-900/20 p-2 rounded">{loginError}</p>}
                       <button onClick={handleAdminCodeSubmit} className="w-full bg-pink-600 hover:bg-pink-500 py-3 rounded font-bold text-lg font-orbitron transition shadow-lg">
                          DOĞRULA
                       </button>
                       <button onClick={() => { setShowAdminCodeInput(false); setAdminCode(""); }} className="w-full text-slate-500 hover:text-white text-sm py-2">
                          Geri Dön
                       </button>
                   </div>
               ) : (
                   // NORMAL LOGIN / REGISTER SCREEN
                   <div className="space-y-4">
                      <div>
                          <label className="block text-xs uppercase font-bold text-slate-500 mb-1">Kullanıcı Adı</label>
                          <input 
                            className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-cyan-500 outline-none transition"
                            value={loginName}
                            onChange={(e) => setLoginName(e.target.value)}
                            placeholder="Kullanıcı adı..."
                          />
                      </div>
                      
                      <div>
                          <label className="block text-xs uppercase font-bold text-slate-500 mb-1">Şifre</label>
                          <input 
                            type="password"
                            className="w-full bg-slate-900 border border-slate-600 rounded p-3 text-white focus:border-cyan-500 outline-none transition"
                            value={loginPass}
                            onChange={(e) => setLoginPass(e.target.value)}
                            placeholder="••••••••"
                          />
                      </div>

                      {loginError && <p className="text-red-500 text-sm font-bold text-center bg-red-900/20 p-2 rounded">{loginError}</p>}

                      <button 
                        onClick={handleAuthAction} 
                        className={`w-full py-3 rounded font-bold text-lg font-orbitron transition flex items-center justify-center gap-2 ${isRegistering ? 'bg-green-600 hover:bg-green-500' : 'bg-cyan-600 hover:bg-cyan-500'}`}
                      >
                          {isRegistering ? <><UserPlus size={20}/> KAYIT OL</> : <><LogIn size={20}/> GİRİŞ YAP</>}
                      </button>
                      
                      <div className="pt-4 border-t border-slate-700 flex justify-center">
                         <button 
                            onClick={() => { setIsRegistering(!isRegistering); setLoginError(""); }}
                            className="text-sm text-slate-400 hover:text-white transition"
                         >
                            {isRegistering ? "Zaten hesabın var mı? Giriş Yap" : "Hesabın yok mu? Kayıt Ol"}
                         </button>
                      </div>
                   </div>
               )}
            </div>
        </div>
      );
  }

  if (gameState === GameState.MENU) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
             <div className="absolute top-4 right-4 flex items-center gap-4">
                <div className="text-right">
                    <div className="text-cyan-400 font-bold flex items-center justify-end gap-2">
                        {user?.isAdmin && <ShieldAlert size={16} className="text-pink-500"/>}
                        {user?.name}
                    </div>
                    <div className="text-xs text-yellow-400 flex items-center justify-end gap-1">
                        <Star size={12} fill="currentColor"/> {user?.totalStars} Stars
                    </div>
                </div>
                <button onClick={handleLogout} className="bg-red-900/50 p-2 rounded hover:bg-red-900 text-xs">Çıkış</button>
             </div>

             <h1 className="text-7xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-12 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] font-orbitron transform -skew-x-6">
                CUBE DASH
             </h1>

             <div className="flex gap-8">
                 <button 
                    onClick={() => setGameState(GameState.CHARACTER_SELECT)}
                    className="group w-40 h-40 bg-slate-800 border-2 border-slate-600 hover:border-cyan-400 rounded-2xl flex flex-col items-center justify-center gap-4 transition-all hover:scale-110 hover:shadow-[0_0_30px_rgba(34,211,238,0.2)]"
                 >
                    <UserIcon size={48} className="text-slate-400 group-hover:text-cyan-400" />
                    <span className="font-bold font-orbitron text-lg">KARAKTER</span>
                 </button>

                 <button 
                    onClick={() => setGameState(GameState.LEVEL_SELECT)}
                    className="group w-40 h-40 bg-cyan-600 hover:bg-cyan-500 border-2 border-cyan-400 rounded-2xl flex flex-col items-center justify-center gap-4 transition-all hover:scale-110 hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]"
                 >
                    <Play size={48} className="text-black fill-black" />
                    <span className="font-bold font-orbitron text-lg text-black">OYNA</span>
                 </button>

                 <button 
                    onClick={() => setGameState(GameState.LEADERBOARD)}
                    className="group w-40 h-40 bg-purple-900 border-2 border-purple-700 hover:border-purple-500 rounded-2xl flex flex-col items-center justify-center gap-4 transition-all hover:scale-110 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]"
                 >
                    <Globe size={48} className="text-purple-300 group-hover:text-white" />
                    <span className="font-bold font-orbitron text-lg">TOP 50</span>
                 </button>
             </div>
          </div>
      );
  }

  if (gameState === GameState.CHARACTER_SELECT) {
      return (
          <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center">
              <div className="w-full max-w-4xl">
                <div className="flex items-center justify-between mb-8">
                    <button onClick={() => setGameState(GameState.MENU)} className="p-2 hover:bg-slate-800 rounded-full"><ChevronLeft size={32}/></button>
                    <h2 className="text-3xl font-orbitron font-bold text-cyan-400">KARAKTER SEÇİMİ</h2>
                    <div className="w-10"></div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {SKINS.map(skin => {
                        const isLocked = (user?.totalStars || 0) < skin.starsRequired;
                        const isSelected = user?.selectedColor === skin.color;

                        return (
                            <button
                                key={skin.id}
                                disabled={isLocked}
                                onClick={() => handleSkinSelect(skin.color)}
                                className={`
                                    relative aspect-square rounded-xl border-4 flex flex-col items-center justify-center gap-2 transition-all
                                    ${isSelected ? 'border-white bg-slate-700 scale-105 shadow-xl' : 'border-slate-700 bg-slate-800'}
                                    ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-500 cursor-pointer'}
                                `}
                            >
                                {isLocked ? (
                                    <>
                                        <Lock size={32} className="text-slate-500"/>
                                        <div className="flex items-center gap-1 text-xs text-yellow-500 font-bold">
                                            {skin.starsRequired} <Star size={10} fill="currentColor"/>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div 
                                            className="w-10 h-10 border-2 border-black" 
                                            style={{backgroundColor: skin.color}}
                                        >
                                            <div className="w-2 h-2 bg-black absolute top-2 right-2"></div> {/* Eye */}
                                        </div>
                                        <span className="font-bold text-sm font-orbitron">{skin.name}</span>
                                    </>
                                )}
                            </button>
                        )
                    })}
                </div>
              </div>
          </div>
      )
  }

  if (gameState === GameState.LEADERBOARD) {
      const db = getUsersDB();
      db.sort((a, b) => b.totalStars - a.totalStars);

      return (
          <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center">
             <div className="w-full max-w-2xl">
                 <div className="flex items-center justify-between mb-8">
                    <button onClick={() => setGameState(GameState.MENU)} className="p-2 hover:bg-slate-800 rounded-full"><ChevronLeft size={32}/></button>
                    <h2 className="text-3xl font-orbitron font-bold text-purple-400">DÜNYA SIRALAMASI</h2>
                    <div className="w-10"></div>
                 </div>

                 <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                     {db.length === 0 && (
                         <div className="p-8 text-center text-slate-500">Henüz kimse sıralamaya girmedi.</div>
                     )}
                     {db.map((entry, idx) => (
                         <div key={idx} className={`flex items-center justify-between p-4 border-b border-slate-700 ${entry.name === user?.name ? 'bg-purple-900/30' : ''}`}>
                             <div className="flex items-center gap-4">
                                 <div className="font-black text-2xl w-8 text-slate-500 italic">#{idx + 1}</div>
                                 <div className="w-8 h-8 border border-black" style={{backgroundColor: entry.selectedColor}}></div>
                                 <div className="font-bold text-lg">
                                     {entry.name}
                                     {entry.name === 'dgoa' && <ShieldAlert size={14} className="inline ml-2 text-pink-500"/>}
                                 </div>
                             </div>
                             <div className="flex items-center gap-2 text-yellow-400 font-bold font-mono text-xl">
                                 {entry.totalStars} <Star fill="currentColor" size={20}/>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
          </div>
      )
  }

  if (gameState === GameState.LEVEL_SELECT) {
      return (
          <div className="min-h-screen bg-slate-900 text-white p-4">
              <div className="max-w-4xl mx-auto">
                 <div className="flex items-center justify-between mb-8">
                    <button onClick={() => setGameState(GameState.MENU)} className="p-2 hover:bg-slate-800 rounded-full"><ChevronLeft size={32}/></button>
                    <h2 className="text-3xl font-orbitron font-bold text-cyan-400">BÖLÜMLER</h2>
                    <div className="w-10"></div>
                 </div>

                 <div className="flex gap-4 mb-6 justify-center">
                    <button 
                        onClick={() => setGameState(GameState.EDITOR)}
                        className="flex items-center gap-2 bg-pink-600 px-6 py-3 rounded-lg font-bold hover:bg-pink-500 hover:scale-105 transition shadow-lg"
                    >
                        <PenTool size={20}/> BÖLÜM OLUŞTUR
                    </button>
                 </div>

                 <div className="grid gap-4">
                     {levels.length === 0 && (
                         <div className="text-center text-slate-500 py-20">
                             Henüz yayınlanmış bir bölüm yok. İlk bölümü sen yap!
                         </div>
                     )}
                     {levels.map((level) => {
                         const difficultyColors: Record<string, string> = {
                             'Unlisted': 'text-slate-500',
                             'Easy': 'text-green-400',
                             'Normal': 'text-yellow-400',
                             'Hard': 'text-red-400',
                             'Insane': 'text-purple-500'
                         };
                         
                         const isCompleted = user?.completedLevels.includes(level.id);
                         const isLiked = user?.likedLevels?.includes(level.id);

                         return (
                             <div key={level.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between hover:border-slate-500 transition group">
                                 <div>
                                     <div className="flex items-center gap-3">
                                        <h3 className="text-xl font-bold font-orbitron">{level.name}</h3>
                                        {isCompleted && (
                                            <div className="text-green-500 text-xs border border-green-500 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                                                <CheckCircle size={10}/> TAMAMLANDI
                                            </div>
                                        )}
                                     </div>
                                     <p className="text-sm text-slate-400">by {level.author}</p>
                                     <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                         <span className="flex items-center gap-1"><Eye size={12}/> {level.plays || 0}</span>
                                         <button 
                                            onClick={(e) => { e.stopPropagation(); handleLikeLevel(level.id); }}
                                            className={`flex items-center gap-1 hover:text-pink-400 ${isLiked ? 'text-pink-500 font-bold' : ''}`}
                                         >
                                             <Heart size={12} fill={isLiked ? "currentColor" : "none"}/> {level.likes || 0}
                                         </button>
                                     </div>
                                 </div>
                                 
                                 <div className="flex items-center gap-6">
                                     <div className="text-center min-w-[80px]">
                                         <div className={`font-black uppercase ${difficultyColors[level.difficulty] || 'text-white'}`}>
                                            {level.difficulty === 'Unlisted' ? 'Unrated' : level.difficulty}
                                         </div>
                                         {level.stars > 0 && (
                                             <div className="text-yellow-400 text-sm font-bold flex justify-center items-center gap-1">
                                                {level.stars} <Star size={12} fill="currentColor"/>
                                             </div>
                                         )}
                                     </div>

                                     {/* Admin Controls */}
                                     {user?.isAdmin && (
                                         <div className="flex flex-col gap-1">
                                             <select 
                                                className="bg-black text-xs p-1 rounded border border-slate-600 text-white"
                                                value={level.difficulty}
                                                onChange={(e) => updateDifficulty(level.id, e.target.value as any)}
                                             >
                                                <option value="Unlisted">Unlisted</option>
                                                <option value="Easy">Easy (2*)</option>
                                                <option value="Normal">Normal (4*)</option>
                                                <option value="Hard">Hard (6*)</option>
                                                <option value="Insane">Insane (8*)</option>
                                             </select>
                                         </div>
                                     )}

                                     <button 
                                        onClick={() => handlePlayLevel(level)}
                                        className="bg-cyan-600 hover:bg-cyan-500 p-3 rounded-full text-black transition hover:scale-110 shadow-lg group-hover:shadow-cyan-500/50"
                                     >
                                         <Play size={24} fill="currentColor"/>
                                     </button>
                                 </div>
                             </div>
                         )
                     })}
                 </div>
              </div>
          </div>
      );
  }

  if (gameState === GameState.EDITOR) {
      return (
          <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
              <LevelEditor 
                  onSave={saveLevel} 
                  onExit={() => setGameState(GameState.LEVEL_SELECT)}
              />
          </div>
      );
  }

  if (gameState === GameState.PLAYING && currentLevel) {
      return (
          <GameCanvas 
             gameState={GameState.PLAYING}
             setGameState={setGameState}
             setScore={setScore}
             levelData={currentLevel.data}
             onDeath={() => setGameState(GameState.GAME_OVER)}
             onWin={handleLevelComplete}
             playerColor={user?.selectedColor}
          />
      );
  }

  if (gameState === GameState.GAME_OVER && currentLevel) {
      // Calculate progress
      const isWin = score >= 100;
      
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white relative">
              <div className="absolute inset-0 overflow-hidden">
                  <div className={`absolute inset-0 opacity-20 bg-gradient-to-b ${isWin ? 'from-green-500 to-slate-900' : 'from-red-500 to-slate-900'}`}></div>
              </div>

              <div className="relative z-10 bg-slate-800 p-12 rounded-3xl shadow-2xl text-center border-4 border-slate-700 max-w-lg w-full animate-in zoom-in">
                  <h2 className={`text-6xl font-black mb-4 font-orbitron ${isWin ? 'text-green-400' : 'text-red-500'}`}>
                      {isWin ? "TAMAMLANDI!" : "ELENDİN!"}
                  </h2>
                  
                  <div className="flex justify-center my-8">
                     <div className="relative w-48 h-4 bg-slate-700 rounded-full overflow-hidden border border-slate-500">
                         <div className={`h-full ${isWin ? 'bg-green-500' : 'bg-red-500'}`} style={{width: `${score}%`}}></div>
                     </div>
                     <span className="absolute mt-6 font-mono font-bold text-xl">{score}%</span>
                  </div>

                  {isWin && currentLevel.stars > 0 && (
                      <div className="flex justify-center items-center gap-2 text-yellow-400 text-2xl font-bold mb-8 bg-yellow-900/20 p-4 rounded-xl border border-yellow-500/30">
                          <Trophy size={32} />
                          +{currentLevel.stars} YILDIZ KAZANDIN!
                      </div>
                  )}

                  <div className="flex gap-4 justify-center">
                      <button 
                        onClick={() => { setScore(0); setGameState(GameState.PLAYING); }}
                        className="bg-cyan-600 hover:bg-cyan-500 p-4 rounded-full transition hover:scale-110 shadow-lg"
                      >
                          <RotateCcw size={32} />
                      </button>
                      <button 
                        onClick={() => setGameState(GameState.LEVEL_SELECT)}
                        className="bg-slate-600 hover:bg-slate-500 px-8 py-4 rounded-full font-bold font-orbitron transition hover:scale-105"
                      >
                          MENÜ
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  return null;
}

export default App;