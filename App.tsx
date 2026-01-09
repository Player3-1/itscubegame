import React, { useState, useEffect } from 'react';
import { GameCanvas } from './GameCanvas';
import LevelEditor from './LevelEditor';
import { GameState, LevelData, User, LevelMetadata, ObstacleType } from './types.ts';
import { ADMIN_PASSWORD, COLORS } from './constants.ts';
import { Play, RotateCcw, PenTool, User as UserIcon, Lock, Star, ChevronLeft, ShieldAlert, Globe, Heart, Eye, CheckCircle, LogIn, UserPlus, Trophy } from 'lucide-react';
import { db } from './firebase.ts';
import { collection, getDocs, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
// expressions/emotes removed per user request

// Start with empty levels
const DEFAULT_LEVELS: LevelMetadata[] = [];

const App: React.FC = () => {
  // Screens
  const [gameState, setGameState] = useState<GameState>(GameState.LOGIN);
  
  // Debug: log mount & state changes to help diagnose blank page
  React.useEffect(() => {
    console.log('App mounted');
  }, []);
  React.useEffect(() => {
    console.log('GameState:', gameState);
  }, [gameState]);
  
  // Data
  const [user, setUser] = useState<User | null>(null);
  const [levels, setLevels] = useState<LevelMetadata[]>([]);
    // show id next to name
  
    // Play attempt tracking
    const [currentAttempt, setCurrentAttempt] = useState(0);
    const [showAssignDifficulty, setShowAssignDifficulty] = useState(false);
    const [assignLevelId, setAssignLevelId] = useState('');
    const [assignDifficulty, setAssignDifficulty] = useState<LevelMetadata['difficulty']>('Unlisted');
    const [assignStarRating, setAssignStarRating] = useState(3);
    const [showSettings, setShowSettings] = useState(false);
  const [autoRespawn, setAutoRespawn] = useState<boolean>(() => {
      const v = localStorage.getItem('nd_auto_respawn');
      return v ? JSON.parse(v) : true;
  });  const [currentLevel, setCurrentLevel] = useState<LevelMetadata | null>(null);
  const [score, setScore] = useState(0); // Progress %
  const [levelSearch, setLevelSearch] = useState("");
  const [levelView, setLevelView] = useState<'all' | 'new' | 'uncompleted'>('all');

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
                    // Ensure levelNumber exists for older entries
                    const normalized = remoteLevels.map((l, idx) => ({ ...l, levelNumber: l.levelNumber || idx + 1 }));
                    setLevels(normalized);
                    localStorage.setItem('nd_levels', JSON.stringify(normalized));
          return;
        }
      } catch (err) {
        console.error('Firestore level load error:', err);
      }

      const storedLevels = localStorage.getItem('nd_levels');
            if (storedLevels) {
                const parsed = JSON.parse(storedLevels) as LevelMetadata[];
                const normalized = parsed.map((l, idx) => ({ ...l, levelNumber: l.levelNumber || idx + 1 }));
                setLevels(normalized);
      } else {
        setLevels(DEFAULT_LEVELS);
        localStorage.setItem('nd_levels', JSON.stringify(DEFAULT_LEVELS));
      }
    };

    loadLevels();
  }, []);

    // nothing here (hard list removed)

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

  // expressions removed: purchase/equip handlers deleted

  // Initialize Default Admin (dgoa) - load from Firestore if exists, else create
  useEffect(() => {
      const loadAdmin = async () => {
          try {
              const docRef = doc(db, 'users', 'dgoa');
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                  const adminData = docSnap.data() as User;
                  // Update localStorage
                  const usersDb = getUsersDB();
                  const index = usersDb.findIndex(u => u.name === 'dgoa');
                  if (index !== -1) {
                      usersDb[index] = adminData;
                  } else {
                      usersDb.push(adminData);
                  }
                  localStorage.setItem('nd_users_db', JSON.stringify(usersDb));
              } else {
                  // Create default admin
                  const defaultAdmin: User = {
                      name: 'dgoa',
                      password: 'd2d0d1d4',
                      isAdmin: true,
                      totalStars: 0,
                      completedLevels: [],
                      likedLevels: [],
                      selectedColor: COLORS.player
                  };
                  const usersDb = getUsersDB();
                  usersDb.push(defaultAdmin);
                  localStorage.setItem('nd_users_db', JSON.stringify(usersDb));
                  // Save to Firestore
                  await setDoc(docRef, defaultAdmin);
              }
          } catch (err) {
              console.error('Admin load/save error:', err);
              // Fallback: ensure admin exists in localStorage
              const usersDb = getUsersDB();
              const adminExists = usersDb.find(u => u.name === 'dgoa');
              if (!adminExists) {
                  const defaultAdmin: User = {
                      name: 'dgoa',
                      password: 'd2d0d1d4',
                      isAdmin: true,
                      totalStars: 0,
                      completedLevels: [],
                      likedLevels: [],
                      selectedColor: COLORS.player
                  };
                  usersDb.push(defaultAdmin);
                  localStorage.setItem('nd_users_db', JSON.stringify(usersDb));
              }
          }
      };
      loadAdmin();
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

  // Handle ESC key for exiting game over screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && gameState === GameState.GAME_OVER) {
        setGameState(GameState.LEVEL_SELECT);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

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

  // skins/colors removed: all players use the single admin color

  const saveLevel = (data: LevelData, name: string) => {
         // determine next levelNumber
         const dbLevels = localStorage.getItem('nd_levels');
         const existingLevels: LevelMetadata[] = dbLevels ? JSON.parse(dbLevels) : levels;
         const maxNum = existingLevels.reduce((m, l) => Math.max(m, l.levelNumber || 0), 0);
         const newLevelNumber = maxNum + 1;

         const newLevel: LevelMetadata = {
             id: Date.now().toString(),
             levelNumber: newLevelNumber,
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

  const updateDifficulty = (levelId: string, diff: LevelMetadata['difficulty'], starRating?: number) => {
      if (!user?.isAdmin) return;

      const baseStarsMap = { 'Unlisted': 0, 'Easy': 2, 'Normal': 4, 'Hard': 6, 'Insane': 8, 'Extreme': 12 };
      let calculatedStars = baseStarsMap[diff] || 0;

      if (diff !== 'Unlisted' && starRating !== undefined) {
          if (starRating === 0 || starRating === 1) {
              calculatedStars -= 1;
          } else if (starRating === 2) {
              // Normal, no change
          } else if (starRating === 3) {
              calculatedStars += 1;
          } else if (diff === 'Extreme' && starRating === 4) {
              calculatedStars = 15;
          }
          calculatedStars = Math.max(0, calculatedStars); // Ensure non-negative
      }

      const updatedLevels = levels.map(l => {
          if (l.id === levelId) {
             return { ...l, difficulty: diff, stars: calculatedStars };
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
            // Removed: Award the admin who changed the difficulty stars
  };

  const handleLevelComplete = () => {
      if (!currentLevel) return;
      
      // Eğer kullanıcı yoksa (teorik olarak olmamalı), sadece ekranı göster
      if (!user) {
        setGameState(GameState.GAME_OVER);
        return;
      }
      
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
      // Start attempt counter at 1 when starting a level
      setCurrentAttempt(1);
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


  // --- Helpers for character customization ---
  const colorOptions = [
    // 0 yıldız
    { id: 'blue', label: 'Mavi', color: '#00f0ff', cost: 0 },
    { id: 'yellow', label: 'Sarı', color: '#facc15', cost: 0 },
    { id: 'red', label: 'Kırmızı', color: '#ef4444', cost: 0 },
    // 10 yıldız
    { id: 'green', label: 'Yeşil', color: '#22c55e', cost: 10 },
    { id: 'orange', label: 'Turuncu', color: '#f97316', cost: 10 },
    { id: 'pink', label: 'Pembe', color: '#ec4899', cost: 10 },
    // 30 yıldız
    { id: 'white', label: 'Beyaz', color: '#ffffff', cost: 30 },
    { id: 'black', label: 'Siyah', color: '#000000', cost: 30 },
    { id: 'gray', label: 'Gri', color: '#9ca3af', cost: 30 },
    // 60 yıldız
    { id: 'purple', label: 'Mor', color: '#a855f7', cost: 60 },
  ];

  const faceOptions = [
    { id: 'default', label: 'Klasik', cost: 0, adminOnly: false },
    { id: 'happy', label: 'Mutlu', cost: 0, adminOnly: false },
    { id: 'angry', label: 'Sinirli', cost: 10, adminOnly: false },
    { id: 'surprised', label: 'Şaşkın', cost: 15, adminOnly: false },
    { id: 'cool', label: 'Havalı', cost: 50, adminOnly: false },
  ];

  const handleSelectColor = (colorHex: string, cost: number, adminOnly?: boolean) => {
    if (!user) return;
    if (adminOnly && user.name !== 'dgoa') {
      alert('Bu renk sadece dgoa için!');
      return;
    }
    if ((user.totalStars || 0) < cost) {
      alert(`${cost} yıldız gerekiyor!`);
      return;
    }
    const updatedUser: User = {
      ...user,
      selectedColor: colorHex,
    };
    saveUserFull(updatedUser);
  };

  const handleSelectFace = (faceId: string, cost: number) => {
    if (!user) return;
    if ((user.totalStars || 0) < cost) {
      alert(`${cost} yıldız gerekiyor!`);
      return;
    }
    const updatedUser: User = {
      ...user,
      selectedFace: faceId,
    };
    saveUserFull(updatedUser);
  };

  // Precompute leaderboard data (sorted by totalStars desc)
  const leaderboardDb = getUsersDB().slice().sort((a, b) => b.totalStars - a.totalStars);

  // --- RENDERERS ---

  if (gameState === GameState.LOGIN) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-rajdhani p-4">
            <div className="bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 relative overflow-hidden">
               {/* Decorative background element */}
               <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-500 via-pink-500 to-yellow-500"></div>

               <h1 className="text-3xl sm:text-4xl font-black text-center text-cyan-400 mb-2 font-orbitron tracking-wider">CUBE DASH</h1>
               <p className="text-center text-slate-400 mb-6 sm:mb-8 font-bold text-sm sm:text-base">
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

                {showAssignDifficulty && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60" onClick={() => setShowAssignDifficulty(false)} />
                        <div className="bg-slate-800 p-4 sm:p-6 rounded-lg z-10 w-full max-w-md border border-slate-700">
                            <h3 className="text-xl sm:text-2xl font-bold mb-4">Zorluk Ata (ID ile)</h3>
                            <div className="mb-4">
                                <label className="text-sm text-slate-400">Bölüm ID (numara)</label>
                                <input value={assignLevelId} onChange={(e) => setAssignLevelId(e.target.value)} placeholder="Örn: 12" className="w-full bg-black text-white px-3 py-2 rounded border border-slate-700 mt-1" />
                                <div className="text-xs text-slate-400 mt-1">ID'yi girin ve hangi zorluğu atamak istediğinizi seçin.</div>
                            </div>
                            <div className="mb-4">
                                <label className="text-sm text-slate-400">Zorluk</label>
                                <select className="w-full bg-black text-white px-3 py-2 rounded border border-slate-700 mt-1" value={assignDifficulty} onChange={(e) => setAssignDifficulty(e.target.value as any)}>
                                    <option value="Unlisted">Unlisted</option>
                                    <option value="Easy">Easy</option>
                                    <option value="Normal">Normal</option>
                                    <option value="Hard">Hard</option>
                                    <option value="Insane">Insane</option>
                                    <option value="Extreme">Extreme</option>
                                </select>
                            </div>
                            {assignDifficulty !== 'Unlisted' && (
                                <div className="mb-4">
                                    <label className="text-sm text-slate-400">Yıldız Derecesi</label>
                                    <div className="flex gap-1 mt-1">
                                        {[1, 2, 3, ...(assignDifficulty === 'Extreme' ? [4] : [])].map(star => (
                                            <button
                                                key={star}
                                                onClick={() => setAssignStarRating(star)}
                                                className={`w-8 h-8 ${assignStarRating >= star ? 'text-yellow-400' : 'text-slate-600'} hover:text-yellow-300`}
                                            >
                                                ★
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-2 justify-end">
                                <button onClick={() => setShowAssignDifficulty(false)} className="px-3 sm:px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm sm:text-base">Vazgeç</button>
                                <button onClick={() => {
                                    const n = Number(assignLevelId);
                                    if (!n || isNaN(n)) { alert('Geçerli bir ID girin'); return; }
                                    const found = levels.find(l => l.levelNumber === n);
                                    if (!found) { alert('ID ile eşleşen bölüm yok'); return; }
                                    updateDifficulty(found.id, assignDifficulty);
                                    setShowAssignDifficulty(false);
                                }} className="px-3 sm:px-4 py-2 rounded bg-pink-600 hover:bg-pink-500 text-white text-sm sm:text-base">Uygula</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      );
  }

  if (gameState === GameState.MENU) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] px-4">
             <div className="absolute top-4 right-4 flex items-center gap-2 sm:gap-4">
                <div className="text-right">
                    <div className="text-cyan-400 font-bold flex items-center justify-end gap-1 sm:gap-2 text-sm sm:text-base">
                        {user?.isAdmin && <ShieldAlert size={14} className="text-pink-500 sm:w-4 sm:h-4"/>}
                        {user?.name}
                    </div>
                    <div className="text-xs text-yellow-400 flex items-center justify-end gap-1">
                        <Star size={12} fill="currentColor"/> {user?.totalStars} Stars
                    </div>
                </div>
                <button onClick={() => setShowSettings(true)} className="bg-slate-800/50 p-1 sm:p-2 rounded hover:bg-slate-700 text-xs">Ayarlar</button>
                <button onClick={handleLogout} className="bg-red-900/50 p-1 sm:p-2 rounded hover:bg-red-900 text-xs">Çıkış</button>
             </div>

             {showSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setShowSettings(false)} />
                    <div className="bg-slate-800 p-4 sm:p-6 rounded-lg z-10 w-full max-w-md border border-slate-700">
                        <h3 className="text-xl sm:text-2xl font-bold mb-4">Ayarlar</h3>
                        <div className="mb-4">
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={autoRespawn} onChange={(e) => { setAutoRespawn(e.target.checked); localStorage.setItem('nd_auto_respawn', JSON.stringify(e.target.checked)); }} />
                                <span className="text-sm">Otomatik yeniden doğma (ölünce anında yeniden doğ)</span>
                            </label>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowSettings(false)} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600">Kapat</button>
                        </div>
                    </div>
                </div>
             )}


             <h1 className="text-4xl sm:text-7xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-6 sm:mb-12 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] font-orbitron transform -skew-x-6 text-center">
                CUBE DASH
             </h1>

             <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                 <button
                    onClick={() => setGameState(GameState.CHARACTER_SELECT)}
                    className="group w-32 h-32 sm:w-40 sm:h-40 bg-slate-800 border-2 border-slate-600 hover:border-cyan-400 rounded-2xl flex flex-col items-center justify-center gap-2 sm:gap-4 transition-all hover:scale-110 hover:shadow-[0_0_30px_rgba(34,211,238,0.2)]"
                 >
                    <UserIcon size={32} className="sm:w-12 sm:h-12 text-slate-400 group-hover:text-cyan-400" />
                    <span className="font-bold font-orbitron text-sm sm:text-lg">KARAKTER</span>
                 </button>


                 <button
                    onClick={() => setGameState(GameState.LEVEL_SELECT)}
                    className="group w-32 h-32 sm:w-40 sm:h-40 bg-cyan-600 hover:bg-cyan-500 border-2 border-cyan-400 rounded-2xl flex flex-col items-center justify-center gap-2 sm:gap-4 transition-all hover:scale-110 hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]"
                 >
                    <Play size={32} className="sm:w-12 sm:h-12 text-black fill-black" />
                    <span className="font-bold font-orbitron text-sm sm:text-lg text-black">OYNA</span>
                 </button>

                 <button
                    onClick={() => setGameState(GameState.LEADERBOARD)}
                    className="group w-32 h-32 sm:w-40 sm:h-40 bg-purple-900 border-2 border-purple-700 hover:border-purple-500 rounded-2xl flex flex-col items-center justify-center gap-2 sm:gap-4 transition-all hover:scale-110 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]"
                 >
                    <Globe size={32} className="sm:w-12 sm:h-12 text-purple-300 group-hover:text-white" />
                    <span className="font-bold font-orbitron text-sm sm:text-lg">TOP 50</span>
                 </button>
                     {/* EN ZOR 10 removed from main menu */}
             </div>

             <div className="mt-4 sm:mt-8 text-center text-slate-500 text-xs sm:text-sm">
               Versiyon: 1.1
             </div>
          </div>
      );
  } else if (gameState === GameState.CHARACTER_SELECT) {
      const currentColor = user?.selectedColor || COLORS.player;
      const currentFace = user?.selectedFace || 'default';
      const stars = user?.totalStars || 0;

      return (
        <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-8 flex flex-col items-center justify-center">
          <div className="w-full max-w-3xl">
            <button
              onClick={() => setGameState(GameState.MENU)}
              className="mb-4 sm:mb-6 p-2 hover:bg-slate-800 rounded-full"
            >
              <ChevronLeft size={24} className="sm:w-8 sm:h-8" />
            </button>
            <h2 className="text-2xl sm:text-3xl font-orbitron font-bold text-cyan-400 mb-4 text-center">
              KARAKTER
            </h2>

            <div className="bg-slate-800 p-4 sm:p-6 rounded-xl border border-slate-700">
              <div className="flex flex-col items-center gap-4 sm:gap-6">
                {/* Ortadaki karakter önizlemesi */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl border-4 border-black shadow-xl relative overflow-hidden"
                    style={{ backgroundColor: currentColor }}
                  >
                    <canvas
                      ref={(canvas) => {
                        if (canvas) {
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            ctx.clearRect(0, 0, 128, 128);
                            ctx.save();
                            ctx.translate(64, 64);
                            ctx.scale(3, 3); // Scale up for better visibility, adjusted for mobile
                            ctx.fillStyle = '#000';
                            if (currentFace === 'happy') {
                              ctx.fillRect(-7, -7, 5, 5);
                              ctx.fillRect(2, -7, 5, 5);
                              ctx.beginPath();
                              ctx.arc(0, 3, 7, 0, Math.PI);
                              ctx.stroke();
                            } else if (currentFace === 'angry') {
                              ctx.fillRect(-7, -7, 5, 5);
                              ctx.fillRect(2, -7, 5, 5);
                              ctx.beginPath();
                              ctx.moveTo(-7, -11);
                              ctx.lineTo(-2, -9);
                              ctx.moveTo(7, -11);
                              ctx.lineTo(2, -9);
                              ctx.stroke();
                              ctx.fillRect(-7, 4, 14, 2);
                            } else if (currentFace === 'surprised') {
                              ctx.fillRect(-7, -7, 4, 6);
                              ctx.fillRect(3, -7, 4, 6);
                              ctx.beginPath();
                              ctx.arc(0, 4, 4, 0, Math.PI * 2);
                              ctx.stroke();
                            } else if (currentFace === 'cool') {
                              ctx.fillRect(-9, -5, 7, 4);
                              ctx.fillRect(2, -5, 7, 4);
                              ctx.fillRect(-2, -4, 4, 1);
                              ctx.beginPath();
                              ctx.arc(0, 5, 6, 0, Math.PI);
                              ctx.stroke();
                            } else if (currentFace === 'admin') {
                              ctx.beginPath();
                              ctx.moveTo(-7, -5);
                              ctx.lineTo(-4, -9);
                              ctx.lineTo(-1, -5);
                              ctx.closePath();
                              ctx.fill();
                              ctx.beginPath();
                              ctx.moveTo(1, -5);
                              ctx.lineTo(4, -9);
                              ctx.lineTo(7, -5);
                              ctx.closePath();
                              ctx.fill();
                              ctx.beginPath();
                              ctx.arc(0, 5, 7, 0, Math.PI);
                              ctx.stroke();
                            } else {
                              ctx.fillRect(-7, -7, 5, 5);
                              ctx.fillRect(2, -7, 5, 5);
                              ctx.fillRect(-5, 4, 10, 2);
                            }
                            ctx.restore();
                          }
                        }
                      }}
                      width={128}
                      height={128}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="text-sm text-slate-300">
                    Toplam yıldızın: <span className="text-yellow-300 font-bold">{stars}</span>
                  </div>
                </div>

                {/* Üstte yüzler */}
                <div className="w-full">
                  <h3 className="text-sm uppercase tracking-wide text-slate-400 mb-2">
                    Yüzler
                  </h3>
                  <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
                    {faceOptions.map(face => {
                      const lockedByAdmin = face.adminOnly && !user?.isAdmin;
                      const lockedByStars = !lockedByAdmin && stars < face.cost;
                      const isLocked = lockedByAdmin || lockedByStars;
                      const isSelected = currentFace === face.id;

                      return (
                        <button
                          key={face.id}
                          onClick={() => handleSelectFace(face.id, face.cost, face.adminOnly)}
                          className={`px-2 sm:px-3 py-2 rounded-lg text-xs font-bold flex flex-col items-center min-w-[80px] sm:min-w-[90px] border
                            ${isSelected ? 'bg-cyan-600 border-cyan-400' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'}
                            ${isLocked ? 'opacity-60' : ''}`}
                        >
                          <span className="mb-1 flex items-center gap-1">
                            {face.adminOnly && <ShieldAlert size={12} className="text-pink-400" />}
                            {face.label}
                          </span>
                          {isLocked ? (
                            <span className="flex items-center gap-1 text-[10px] text-yellow-300">
                              <Lock size={10} /> {face.cost}⭐
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-300">
                              {face.cost === 0 ? 'Ücretsiz' : `${face.cost}⭐`}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Altta renkler */}
                <div className="w-full">
                  <h3 className="text-sm uppercase tracking-wide text-slate-400 mb-2">
                    Renkler
                  </h3>
                  <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
                    {colorOptions.map(opt => {
                      const isSelected = currentColor.toLowerCase() === opt.color.toLowerCase();
                      const locked = stars < opt.cost;

                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleSelectColor(opt.color, opt.cost)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border min-w-[60px] sm:min-w-[70px]
                            ${isSelected ? 'border-cyan-400 bg-slate-700' : 'border-slate-600 bg-slate-800 hover:bg-slate-700'}
                            ${locked ? 'opacity-60' : ''}`}
                        >
                          <div
                            className="w-6 h-6 sm:w-8 sm:w-8 rounded border border-black"
                            style={{ backgroundColor: opt.color }}
                          />
                          <span className="text-[10px] sm:text-[11px] font-bold">{opt.label}</span>
                          {locked ? (
                            <span className="flex items-center gap-1 text-[10px] text-yellow-300">
                              <Lock size={10} /> {opt.cost}⭐
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-300">
                              {opt.cost === 0 ? 'Ücretsiz' : `${opt.cost}⭐`}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={() => setGameState(GameState.MENU)}
                  className="mt-4 px-4 sm:px-6 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-full font-bold font-orbitron text-sm sm:text-base"
                >
                  Geri
                </button>
              </div>
            </div>
          </div>
        </div>
      );
  } else if (gameState === GameState.LEADERBOARD) {
      const scrollToBottom = () => {
          const element = document.getElementById('leaderboard-list');
          if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
      };

      return (
          <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-8 flex flex-col items-center">
             <div className="w-full max-w-2xl">
                 <div className="flex items-center justify-between mb-4 sm:mb-8">
                    <button onClick={() => setGameState(GameState.MENU)} className="p-2 hover:bg-slate-800 rounded-full"><ChevronLeft size={24} className="sm:w-8 sm:h-8"/></button>
                    <h2 className="text-2xl sm:text-3xl font-orbitron font-bold text-purple-400">DÜNYA SIRALAMASI</h2>
                    <div className="w-6 sm:w-10"></div>
                 </div>

                 <div id="leaderboard-list" className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden max-h-[70vh] overflow-y-auto">
                 {leaderboardDb.length === 0 && (
                         <div className="p-4 sm:p-8 text-center text-slate-500 text-sm sm:text-base">Henüz kimse sıralamaya girmedi.</div>
                     )}
                     {leaderboardDb.map((entry, idx) => (
                         <div key={idx} className={`flex items-center justify-between p-3 sm:p-4 border-b border-slate-700 ${entry.name === user?.name ? 'bg-purple-900/30' : ''}`}>
                             <div className="flex items-center gap-2 sm:gap-4">
                                 <div className="font-black text-lg sm:text-2xl w-6 sm:w-8 text-slate-500 italic">#{idx + 1}</div>
                                <div className="flex flex-col items-center">
                                     <div className="w-6 h-6 sm:w-8 sm:h-8 border border-black relative overflow-hidden" style={{backgroundColor: entry.selectedColor || COLORS.player}}>
                                       <canvas
                                         ref={(canvas) => {
                                           if (canvas) {
                                             const ctx = canvas.getContext('2d');
                                             if (ctx) {
                                               ctx.clearRect(0, 0, 32, 32);
                                               ctx.save();
                                               ctx.translate(16, 16);
                                               ctx.scale(1, 1);
                                               ctx.fillStyle = '#000';
                                               const face = entry.selectedFace || 'default';
                                               if (face === 'happy') {
                                                 ctx.fillRect(-3, -3, 2, 2);
                                                 ctx.fillRect(1, -3, 2, 2);
                                                 ctx.beginPath();
                                                 ctx.arc(0, 1, 3, 0, Math.PI);
                                                 ctx.stroke();
                                               } else if (face === 'angry') {
                                                 ctx.fillRect(-3, -3, 2, 2);
                                                 ctx.fillRect(1, -3, 2, 2);
                                                 ctx.beginPath();
                                                 ctx.moveTo(-3, -5);
                                                 ctx.lineTo(-1, -4);
                                                 ctx.moveTo(3, -5);
                                                 ctx.lineTo(1, -4);
                                                 ctx.stroke();
                                                 ctx.fillRect(-3, 2, 6, 1);
                                               } else if (face === 'surprised') {
                                                 ctx.fillRect(-3, -3, 2, 3);
                                                 ctx.fillRect(1, -3, 2, 3);
                                                 ctx.beginPath();
                                                 ctx.arc(0, 2, 2, 0, Math.PI * 2);
                                                 ctx.stroke();
                                               } else if (face === 'cool') {
                                                 ctx.fillRect(-4, -2, 3, 2);
                                                 ctx.fillRect(1, -2, 3, 2);
                                                 ctx.fillRect(-1, -2, 2, 1);
                                                 ctx.beginPath();
                                                 ctx.arc(0, 2, 3, 0, Math.PI);
                                                 ctx.stroke();
                                               } else if (face === 'admin') {
                                                 // Cute smiling cube for preview
                                                 // Little eyes
                                                 ctx.fillRect(-2, -2, 1, 1);
                                                 ctx.fillRect(1, -2, 1, 1);
                                                 // Tiny smiling mouth
                                                 ctx.beginPath();
                                                 ctx.arc(0, 1, 1, 0, Math.PI);
                                                 ctx.stroke();
                                               } else {
                                                 ctx.fillRect(-3, -3, 2, 2);
                                                 ctx.fillRect(1, -3, 2, 2);
                                                 ctx.fillRect(-2, 2, 4, 1);
                                               }
                                               ctx.restore();
                                             }
                                           }
                                         }}
                                         width={32}
                                         height={32}
                                         className="w-full h-full"
                                       />
                                     </div>
                                 </div>
                                 <div className="font-bold text-base sm:text-lg">
                                     {entry.name}
                                     {entry.name === 'dgoa' && <ShieldAlert size={12} className="sm:w-3.5 sm:h-3.5 inline ml-1 sm:ml-2 text-pink-500"/>}
                                 </div>
                             </div>
                             <div className="flex items-center gap-1 sm:gap-2 text-yellow-400 font-bold font-mono text-lg sm:text-xl">
                                 {entry.totalStars} <Star fill="currentColor" size={16} className="sm:w-5 sm:h-5"/>
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
          <div className="min-h-screen bg-slate-900 text-white p-2 sm:p-4">
              <div className="max-w-full sm:max-w-4xl mx-auto">
                 <div className="flex items-center justify-between mb-4 sm:mb-8">
                    <button onClick={() => setGameState(GameState.MENU)} className="p-2 hover:bg-slate-800 rounded-full"><ChevronLeft size={24} className="sm:w-8 sm:h-8"/></button>
                    <h2 className="text-2xl sm:text-3xl font-orbitron font-bold text-cyan-400">BÖLÜMLER</h2>
                    <div className="w-6 sm:w-10"></div>
                 </div>

                 <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-6 justify-center">
                    <button
                        onClick={() => setGameState(GameState.EDITOR)}
                        className="flex items-center gap-2 bg-pink-600 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-bold hover:bg-pink-500 hover:scale-105 transition shadow-lg text-sm sm:text-base"
                    >
                        <PenTool size={16} className="sm:w-5 sm:h-5"/> BÖLÜM OLUŞTUR
                    </button>
                    {user?.isAdmin && (
                        <>
                        <button onClick={() => { setShowAssignDifficulty(true); setAssignLevelId(''); setAssignDifficulty('Unlisted'); setAssignStarRating(3); }} className="flex items-center gap-2 bg-yellow-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-bold hover:bg-yellow-600 hover:scale-105 transition shadow-lg text-sm sm:text-base">
                            <ShieldAlert size={14} className="sm:w-4.5 sm:h-4.5"/> ZORLUK ATA
                        </button>
                        </>
                    )}
                 </div>

                 {/* Arama çubuğu */}
                 <div className="mb-2 sm:mb-4 flex justify-center">
                    <input
                       value={levelSearch}
                       onChange={(e) => setLevelSearch(e.target.value)}
                       placeholder="Bölüm adı veya yazar ara..."
                       className="w-full max-w-full sm:max-w-md bg-slate-800 border border-slate-600 rounded-lg px-3 sm:px-4 py-2 text-sm focus:outline-none focus:border-cyan-400"
                    />
                 </div>

                 {/* Admin-only hard list panel intentionally hidden from Level Select; open via the EN ZOR 10 button */}

                 <div className="grid gap-2 sm:gap-4 max-h-[60vh] sm:max-h-[480px] overflow-y-auto pr-1">
                     {levels.length === 0 && (
                         <div className="text-center text-slate-500 py-10 sm:py-20 text-sm sm:text-base">
                             Henüz yayınlanmış bir bölüm yok. İlk bölümü sen yap!
                         </div>
                     )}
                     {levels
                                                .filter(level => {
                                                        if (!levelSearch.trim()) return true;
                                                        const q = levelSearch.toLowerCase();
                                                        // search by name, author or levelNumber (id)
                                                        return (
                                                            level.name.toLowerCase().includes(q) ||
                                                            level.author.toLowerCase().includes(q) ||
                                                            String(level.levelNumber).includes(q)
                                                        );
                                                })
                        .map((level) => {
                         const difficultyColors: Record<string, string> = {
                             'Unlisted': 'text-slate-500',
                             'Easy': 'text-green-400',
                             'Normal': 'text-yellow-400',
                             'Hard': 'text-red-400',
                             'Insane': 'text-purple-500',
                             'Extreme': 'text-pink-500'
                         };

                         const isCompleted = user?.completedLevels.includes(level.id);
                         const isLiked = user?.likedLevels?.includes(level.id);

                         return (
                             <div key={level.id} className="bg-slate-800 p-2 sm:p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:border-slate-500 transition group gap-2 sm:gap-0">
                                 <div className="flex-1">
                                     <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                        <h3 className="text-lg sm:text-xl font-bold font-orbitron">{level.name} <span className="text-xs text-slate-400 font-mono ml-1 sm:ml-2">#{level.levelNumber}</span></h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            {/* Removed background and ground color previews */}
                                        </div>
                                        {isCompleted && (
                                            <div className="text-green-500 text-xs border border-green-500 px-2 py-0.5 rounded font-bold flex items-center gap-1 w-fit">
                                                <CheckCircle size={10}/> TAMAMLANDI
                                            </div>
                                        )}
                                     </div>
                                     <p className="text-sm text-slate-400">by {level.author}</p>
                                     <div className="flex items-center gap-2 sm:gap-4 mt-2 text-xs text-slate-500">
                                         <span className="flex items-center gap-1"><Eye size={12}/> {level.plays || 0}</span>
                                         <button
                                            onClick={(e) => { e.stopPropagation(); handleLikeLevel(level.id); }}
                                            className={`flex items-center gap-1 hover:text-pink-400 ${isLiked ? 'text-pink-500 font-bold' : ''}`}
                                         >
                                             <Heart size={12} fill={isLiked ? "currentColor" : "none"}/> {level.likes || 0}
                                         </button>
                                     </div>
                                 </div>

                                 <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2 sm:gap-6">
                                     <div className="text-center min-w-[80px] flex flex-col items-center">
                                         <div className={`font-black uppercase text-sm sm:text-base ${difficultyColors[level.difficulty] || 'text-white'}`}>
                                            {level.difficulty === 'Unlisted' ? 'Unrated' : level.difficulty}
                                         </div>
                                         {level.stars > 0 && (
                                             <div className="text-yellow-400 text-xs sm:text-sm font-bold flex justify-center items-center gap-1">
                                                {level.stars} <Star size={10} className="sm:w-3 sm:h-3" fill="currentColor"/>
                                             </div>
                                         )}
                                     </div>



                                     {/* Admin Controls */}
                                     {user?.isAdmin && (
                                         <div className="flex flex-col gap-0.5 sm:gap-1">
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
                                                <option value="Extreme">Extreme (12*)</option>
                                             </select>
                                             {level.difficulty !== 'Unlisted' && (
                                                 <div className="flex gap-0.5">
                                                     {[1, 2, 3, ...(level.difficulty === 'Extreme' ? [4] : [])].map(star => (
                                                         <button
                                                             key={star}
                                                             onClick={() => updateDifficulty(level.id, level.difficulty, star)}
                                                             className={`w-4 h-4 text-xs ${level.stars >= (level.difficulty === 'Extreme' && star === 4 ? 15 : (level.difficulty === 'Easy' ? 2 : level.difficulty === 'Normal' ? 4 : level.difficulty === 'Hard' ? 6 : level.difficulty === 'Insane' ? 8 : 12) + (star === 1 || star === 0 ? -1 : star === 3 ? 1 : 0)) ? 'text-yellow-400' : 'text-slate-600'} hover:text-yellow-300`}
                                                         >
                                                             ★
                                                         </button>
                                                     ))}
                                                 </div>
                                             )}
                                         </div>
                                     )}

                                     <button
                                        onClick={() => handlePlayLevel(level)}
                                        className="bg-cyan-600 hover:bg-cyan-500 p-2 sm:p-3 rounded-full text-black transition hover:scale-110 shadow-lg group-hover:shadow-cyan-500/50"
                                     >
                                         <Play size={20} className="sm:w-6 sm:h-6" fill="currentColor"/>
                                     </button>
                                 </div>
                             </div>
                         )
                     })}
                 </div>
              </div>

                 {/* SHOP: intentionally accessible from menu */}
                 {false}
          </div>
      );
  }




  if (gameState === GameState.EDITOR) {
      return (
          <LevelEditor
              onSave={saveLevel}
              onExit={() => setGameState(GameState.LEVEL_SELECT)}
          />
      );
  }

  if (gameState === GameState.PLAYING && currentLevel) {
      {
        return (
          <GameCanvas 
             gameState={GameState.PLAYING}
             setGameState={setGameState}
             setScore={setScore}
             levelData={currentLevel.data}
             onDeath={() => {
                 if (autoRespawn) {
                     setScore(0);
                     setCurrentAttempt(prev => prev + 1);
                 } else {
                     setGameState(GameState.GAME_OVER);
                 }
             }}
             onWin={handleLevelComplete}
             playerColor={user?.selectedColor || COLORS.player}
             playerFace={user?.selectedFace || 'default'}
             attempt={currentAttempt}
             progress={score}
             autoRespawn={autoRespawn}
             onRespawn={() => setCurrentAttempt(prev => prev + 1)}
          />
      );
      }
  }

  if (gameState === GameState.GAME_OVER && currentLevel) {
      // Calculate progress
      const isWin = score >= 100;

      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white relative p-4">
              <div className="absolute inset-0 overflow-hidden">
                  <div className={`absolute inset-0 opacity-20 bg-gradient-to-b ${isWin ? 'from-green-500 to-slate-900' : 'from-red-500 to-slate-900'}`}></div>
              </div>

              <div className="relative z-10 bg-slate-800 p-6 sm:p-12 rounded-3xl shadow-2xl text-center border-4 border-slate-700 max-w-lg w-full animate-in zoom-in">
                  <h2 className={`text-4xl sm:text-6xl font-black mb-4 font-orbitron ${isWin ? 'text-green-400' : 'text-red-500'}`}>
                      {isWin ? "TAMAMLANDI!" : "ELENDİN!"}
                  </h2>

                  <div className="flex justify-center my-6 sm:my-8">
                     <div className="relative w-36 sm:w-48 h-4 bg-slate-700 rounded-full overflow-hidden border border-slate-500">
                         <div className={`h-full ${isWin ? 'bg-green-500' : 'bg-red-500'}`} style={{width: `${score}%`}}></div>
                     </div>
                     <span className="absolute mt-6 font-mono font-bold text-lg sm:text-xl">{score}%</span>
                  </div>

                  {isWin && currentLevel.stars > 0 && (
                      <div className="flex justify-center items-center gap-2 text-yellow-400 text-lg sm:text-2xl font-bold mb-6 sm:mb-8 bg-yellow-900/20 p-3 sm:p-4 rounded-xl border border-yellow-500/30">
                          <Trophy size={24} className="sm:w-8 sm:h-8" />
                          +{currentLevel.stars} YILDIZ KAZANDIN!
                      </div>
                  )}

                  <div className="flex gap-4 justify-center">
                      <button
                        onClick={() => { setScore(0); setCurrentAttempt(prev => prev + 1); setGameState(GameState.PLAYING); }}
                        className="bg-cyan-600 hover:bg-cyan-500 p-3 sm:p-4 rounded-full transition hover:scale-110 shadow-lg"
                      >
                          <RotateCcw size={24} className="sm:w-8 sm:h-8" />
                      </button>
                      <button
                        onClick={() => setGameState(GameState.LEVEL_SELECT)}
                        onTouchStart={() => setGameState(GameState.LEVEL_SELECT)}
                        className="bg-slate-600 hover:bg-slate-500 px-6 sm:px-8 py-3 sm:py-4 rounded-full font-bold font-orbitron transition hover:scale-105 text-sm sm:text-base"
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