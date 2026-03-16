import React, { useState, useEffect } from 'react';
import { GameCanvas } from './GameCanvas';
import LevelEditor from './LevelEditor';
import { GameState, LevelData, User, LevelMetadata, ObstacleType, DraftLevel, VerifyDeal } from './types.ts';
import { ADMIN_PASSWORD, COLORS } from './constants.ts';
import { Play, RotateCcw, PenTool, User as UserIcon, Lock, Star, ChevronLeft, ShieldAlert, Globe, Heart, Eye, CheckCircle, LogIn, UserPlus, Trophy, Trash2, Package } from 'lucide-react';
import { db } from './firebase.ts';
import { collection, getDocs, doc, setDoc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
// expressions/emotes removed per user request

// test yazısı 2

// Start with empty levels
const DEFAULT_LEVELS: LevelMetadata[] = [];

// Difficulty colors for Color Difficulty mod
const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'Easy': return '#4ade80'; // text-green-400
    case 'Normal': return '#facc15'; // text-yellow-400
    case 'Hard': return '#f87171'; // text-red-400
    case 'Insane': return '#a855f7'; // text-purple-500
    case 'Extreme': return '#ec4899'; // text-pink-500
    default: return '#6b7280';
  }
};

const getDifficultyStars = (difficulty: string) => {
  switch (difficulty) {
    case 'Easy': return 2;
    case 'Normal': return 4;
    case 'Hard': return 6;
    case 'Insane': return 8;
    case 'Extreme': return 12;
    default: return 0;
  }
};

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
  const [drafts, setDrafts] = useState<DraftLevel[]>([]);
  const [currentDraft, setCurrentDraft] = useState<DraftLevel | null>(null);
  const [verifyDraft, setVerifyDraft] = useState<DraftLevel | null>(null);
  const [verifyDeal, setVerifyDeal] = useState<VerifyDeal | null>(null);
    // show id next to name

    // Play attempt tracking
    const [currentAttempt, setCurrentAttempt] = useState(0);
    const [hardestLevelIds, setHardestLevelIds] = useState<string[]>([]);
    const [showAddToHardest, setShowAddToHardest] = useState(false);
    const [addLevelId, setAddLevelId] = useState('');
    const [addPosition, setAddPosition] = useState(1);
    const [showAssignDifficulty, setShowAssignDifficulty] = useState(false);
    const [assignLevelId, setAssignLevelId] = useState('');
    const [assignDifficulty, setAssignDifficulty] = useState<LevelMetadata['difficulty']>('Unlisted');
    const [assignStarRating, setAssignStarRating] = useState(3);
    const [showSettings, setShowSettings] = useState(false);
  const [autoRespawn, setAutoRespawn] = useState<boolean>(() => {
      const v = localStorage.getItem('nd_auto_respawn');
      return v ? JSON.parse(v) : true;
  }); 
  const [jumpButton, setJumpButton] = useState<number>(() => {
      const v = localStorage.getItem('nd_jump_button');
      return v ? parseInt(v) : 0; // 0 = left click, 1 = right click, 2 = middle click
  });
  const [isSettingJumpButton, setIsSettingJumpButton] = useState(false);  const [currentLevel, setCurrentLevel] = useState<LevelMetadata | null>(null);
  const [score, setScore] = useState(0); // Progress %
  const [levelSearch, setLevelSearch] = useState("");
  const [levelView, setLevelView] = useState<'all' | 'new' | 'hard'>('all');
  const [newBestAchieved, setNewBestAchieved] = useState(false);
  const [starsEarned, setStarsEarned] = useState(0); // Stars earned in current level completion

  const getDraftsKey = (name?: string) => `nd_drafts_${name || 'anon'}`;

  const loadDraftsForUser = (name?: string) => {
    if (!name) {
      setDrafts([]);
      return;
    }
    const raw = localStorage.getItem(getDraftsKey(name));
    setDrafts(raw ? (JSON.parse(raw) as DraftLevel[]) : []);
  };

  const saveDraftsForUser = (name: string, next: DraftLevel[]) => {
    localStorage.setItem(getDraftsKey(name), JSON.stringify(next));
    setDrafts(next);
  };

  const getVerifyDeals = (): VerifyDeal[] => {
    const raw = localStorage.getItem('nd_verify_deals');
    return raw ? (JSON.parse(raw) as VerifyDeal[]) : [];
  };

  const saveVerifyDeals = (deals: VerifyDeal[]) => {
    localStorage.setItem('nd_verify_deals', JSON.stringify(deals));
  };

  const deleteVerifyDeal = (dealId: string) => {
    const deals = getVerifyDeals();
    const updated = deals.filter(d => d.id !== dealId);
    saveVerifyDeals(updated);
  };

  const publishVerifiedDraft = (draft: DraftLevel, verifiedBy: string) => {
    const dbLevels = localStorage.getItem('nd_levels');
    const existingLevels: LevelMetadata[] = dbLevels ? JSON.parse(dbLevels) : levels;
    const maxNum = existingLevels.reduce((m, l) => Math.max(m, l.levelNumber || 0), 0);
    const newLevelNumber = maxNum + 1;

    const newLevel: LevelMetadata = {
      id: draft.id,
      levelNumber: newLevelNumber,
      name: draft.name,
      author: draft.author,
      difficulty: 'Unlisted',
      stars: 0,
      verifiedBy,
      data: draft.data,
      plays: 0,
      likes: 0
    };

    const updatedLevels = [...existingLevels.filter(l => l.id !== newLevel.id), newLevel];
    setLevels(updatedLevels);
    localStorage.setItem('nd_levels', JSON.stringify(updatedLevels));

    (async () => {
      try {
        const ref = doc(db, 'levels', newLevel.id);
        await setDoc(ref, newLevel);
      } catch (err) {
        console.error('Firestore save verified level error:', err);
      }
    })();
  };

  // Login Form State
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginName, setLoginName] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [showAdminCodeInput, setShowAdminCodeInput] = useState(false); // Special step for dgoa
  const [loginError, setLoginError] = useState("");

  // Load Levels Data (prefer Firestore, fallback to localStorage)
  const loadLevels = async () => {
    try {
      const snap = await getDocs(collection(db, 'levels'));
      if (!snap.empty) {
        const remoteLevels: LevelMetadata[] = snap.docs.map((d) => d.data() as LevelMetadata);
        // Ensure levelNumber exists for older entries
        const normalized = remoteLevels.map((l, idx) => ({
          ...l,
          levelNumber: l.levelNumber || idx + 1,
          stars: typeof l.stars === 'number' ? l.stars : getDifficultyStars(l.difficulty)
        }));
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
      const normalized = parsed.map((l, idx) => ({
        ...l,
        levelNumber: l.levelNumber || idx + 1,
        stars: typeof l.stars === 'number' ? l.stars : getDifficultyStars(l.difficulty)
      }));
      setLevels(normalized);
    } else {
      setLevels(DEFAULT_LEVELS);
      localStorage.setItem('nd_levels', JSON.stringify(DEFAULT_LEVELS));
    }
  };

  useEffect(() => {
    loadLevels();
  }, []);

   // Load Hardest Levels
   useEffect(() => {
     const loadHardest = async () => {
       try {
         const snap = await getDocs(collection(db, 'hardest'));
         if (!snap.empty) {
           const data = snap.docs[0].data() as { ids: string[] };
           setHardestLevelIds(data.ids);
           localStorage.setItem('nd_hardest_levels', JSON.stringify(data.ids));
         }
       } catch (err) {
         console.error('Firestore hardest load error:', err);
       }

       const stored = localStorage.getItem('nd_hardest_levels');
       if (stored) {
         setHardestLevelIds(JSON.parse(stored));
       }
     };

     loadHardest();
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
                      starsAwardedLevels: [],
                      starAwards: {},
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
                      starsAwardedLevels: [],
                      starAwards: {},
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
            loadDraftsForUser(freshUser.name);
        } else {
            setUser(parsedSession);
            loadDraftsForUser(parsedSession.name);
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
       setLoginError("Username and password required!");
       return;
     }

     const db = getUsersDB();
     const existingUser = db.find(u => u.name === name);

     if (isRegistering) {
         // REGISTER LOGIC
         if (existingUser) {
             setLoginError("This name is already taken!");
             return;
         }
         if (name.toLowerCase() === 'dgoa') {
             setLoginError("This name is forbidden.");
             return;
         }

            const newUser: User = {
            name: name,
            password: pass,
            isAdmin: false,
            totalStars: 0,
            completedLevels: [],
            starsAwardedLevels: [],
            likedLevels: [],
                selectedColor: COLORS.player
         };
         
         saveUserFull(newUser);
         setGameState(GameState.MENU);
     } else {
         // LOGIN LOGIC
         if (!existingUser) {
             setLoginError("User not found.");
             return;
         }
         if (existingUser.password && existingUser.password !== pass) {
             setLoginError("Incorrect password!");
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
          setLoginError("Invalid Admin Code!");
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

  const saveDraft = (draft: DraftLevel) => {
    if (!user?.name) return;

    const current = drafts;
    const exists = current.find(d => d.id === draft.id);

    if (!exists && current.length >= 10) {
      alert('You can only have up to 10 levels.');
      return;
    }

    const next = exists
      ? current.map(d => (d.id === draft.id ? { ...draft, author: user.name } : d))
      : [...current, { ...draft, author: user.name }];

    saveDraftsForUser(user.name, next);
    setCurrentDraft(draft);
  };

  const openDraftInEditor = (draft: DraftLevel) => {
    setCurrentDraft(draft);
    setVerifyDraft(null);
    setVerifyDeal(null);
    setGameState(GameState.EDITOR);
  };

  const deleteDraft = (draftId: string) => {
    if (!user?.name) return;
    const next = drafts.filter((d) => d.id !== draftId);
    saveDraftsForUser(user.name, next);
    if (currentDraft?.id === draftId) setCurrentDraft(null);
  };

  const requestVerify = (draft: DraftLevel) => {
    if (!user?.name) return;
    saveDraft(draft);
    setVerifyDraft(draft);
    setVerifyDeal(null);
    setCurrentLevel({
      id: draft.id,
      name: draft.name,
      author: draft.author,
      difficulty: 'Unlisted',
      stars: 0,
      data: draft.data,
      plays: 0,
      likes: 0,
      verifiedBy: draft.verifiedBy
    });
    setScore(0);
    setCurrentAttempt(1);
    setGameState(GameState.PLAYING);
  };

  const sendVerifyDeal = (draft: DraftLevel) => {
    if (!user?.name) return;
    saveDraft(draft);
    const deals = getVerifyDeals();
    const existing = deals.find(d => d.draftId === draft.id && d.status === 'open');
    if (existing) {
      alert('This draft is already in verify deals.');
      return;
    }
    const now = Date.now();
    const deal: VerifyDeal = {
      id: now.toString(),
      draftId: draft.id,
      author: draft.author,
      name: draft.name,
      data: draft.data,
      createdAt: now,
      status: 'open'
    };
    saveVerifyDeals([deal, ...deals].slice(0, 50));
    alert('Verify deal sent. Other players can verify it.');
  };

  const startVerifyDealPlay = (deal: VerifyDeal) => {
    setVerifyDeal(deal);
    setVerifyDraft(null);
    setCurrentLevel({
      id: deal.draftId,
      name: deal.name,
      author: deal.author,
      difficulty: 'Unlisted',
      stars: 0,
      data: deal.data,
      plays: 0,
      likes: 0
    });
    setScore(0);
    setCurrentAttempt(1);
    setGameState(GameState.PLAYING);
  };

  const updateHardestLevels = (newIds: string[]) => {
    setHardestLevelIds(newIds);
    localStorage.setItem('nd_hardest_levels', JSON.stringify(newIds));
    // Mirror to Firestore
    (async () => {
      try {
        const ref = doc(db, 'hardest', 'list');
        await setDoc(ref, { ids: newIds });
      } catch (err) {
        console.error('Firestore hardest save error:', err);
      }
    })();
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

  const deleteLevel = (levelId: string) => {
      const level = levels.find(l => l.id === levelId);
      if (!level) return;
      
      // Check if admin or level author
      const canDelete = user?.isAdmin || level.author === user?.name;
      if (!canDelete) {
          alert('Only the level author or an admin can delete this level.');
          return;
      }
      
      if (!confirm(`Are you sure you want to delete "${level.name}"?`)) return;

      const updatedLevels = levels.filter(l => l.id !== levelId);
      setLevels(updatedLevels);
      localStorage.setItem('nd_levels', JSON.stringify(updatedLevels));

      // Remove from hardest if present
      const updatedHardest = hardestLevelIds.filter(id => id !== levelId);
      if (updatedHardest.length !== hardestLevelIds.length) {
          updateHardestLevels(updatedHardest);
      }

      // Delete from Firestore
      (async () => {
        try {
          const ref = doc(db, 'levels', levelId);
          await deleteDoc(ref);
        } catch (err) {
          console.error('Firestore delete level error:', err);
        }
      })();
  };

  const handleLevelComplete = () => {
      if (!currentLevel) return;
      
      // If user doesn't exist (theoretically shouldn't), just show the screen
      if (!user) {
        setStarsEarned(0);
        setGameState(GameState.GAME_OVER);
        return;
      }
      
      const db = getUsersDB();
      const freshUser = db.find(u => u.name === user.name) || user;

      let updatedUser = { ...freshUser };
      let actuallyEarned = 0;

      const starsToAward = typeof currentLevel.stars === 'number' ? currentLevel.stars : getDifficultyStars(currentLevel.difficulty);

      // Mark level as completed
      if (!freshUser.completedLevels.includes(currentLevel.id)) {
          updatedUser.completedLevels = [...freshUser.completedLevels, currentLevel.id];
      }

      // Award stars if not already awarded - with timestamp for security
      const starsAlreadyAwarded = (freshUser.starsAwardedLevels || []).includes(currentLevel.id);
      const starAwardRecord = freshUser.starAwards?.[currentLevel.id];
      
      if (!starsAlreadyAwarded && starsToAward > 0) {
          updatedUser.totalStars = (freshUser.totalStars || 0) + starsToAward;
          updatedUser.starsAwardedLevels = [...(freshUser.starsAwardedLevels || []), currentLevel.id];
          
          // Track with timestamp for security and audit
          updatedUser.starAwards = {
              ...(freshUser.starAwards || {}),
              [currentLevel.id]: { stars: starsToAward, timestamp: Date.now() }
          };
          actuallyEarned = starsToAward;
      } else if (starsAlreadyAwarded) {
          // Stars already awarded, show 0
          actuallyEarned = 0;
      }
      
      // Save user data
      saveUserFull(updatedUser);
      
      // Set earned stars for display
      setStarsEarned(actuallyEarned);
      setGameState(GameState.GAME_OVER);
  };

  const handlePlayLevel = (level: LevelMetadata) => {
      // Retroactive stars: if user already has best 100% on this level but never received stars
      if (user) {
        const db = getUsersDB();
        const freshUser = db.find(u => u.name === user.name) || user;
        const best = freshUser.highestProgress?.[level.id] || 0;
        const starsAwarded = (freshUser.starsAwardedLevels || []).includes(level.id);
        const starsToAward = typeof level.stars === 'number' ? level.stars : getDifficultyStars(level.difficulty);
        if (best >= 100 && !starsAwarded && starsToAward > 0) {
          const updatedUser: User = {
            ...freshUser,
            totalStars: (freshUser.totalStars || 0) + starsToAward,
            starsAwardedLevels: [...(freshUser.starsAwardedLevels || []), level.id],
            starAwards: {
              ...(freshUser.starAwards || {}),
              [level.id]: { stars: starsToAward, timestamp: Date.now() }
            }
          };
          saveUserFull(updatedUser);
        }
      }

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
      setNewBestAchieved(false); // Reset new best flag
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

  const handleProgressUpdate = (progress: number) => {
      if (!user || !currentLevel) return;
      const currentHighest = user.highestProgress?.[currentLevel.id] || 0;
      if (progress > currentHighest) {
          const updatedUser = {
              ...user,
              highestProgress: {
                  ...user.highestProgress,
                  [currentLevel.id]: progress
              }
          };
          saveUserFull(updatedUser);
          setNewBestAchieved(true);
      }
  }


  // --- Helpers for character customization ---
  const colorOptions = [
    // 0 stars
    { id: 'blue', label: 'Blue', color: '#00f0ff', cost: 0, adminOnly: false },
    { id: 'yellow', label: 'Yellow', color: '#facc15', cost: 0, adminOnly: false },
    { id: 'red', label: 'Red', color: '#ef4444', cost: 0, adminOnly: false },
    // 10 stars
    { id: 'green', label: 'Green', color: '#22c55e', cost: 10, adminOnly: false },
    { id: 'orange', label: 'Orange', color: '#f97316', cost: 10, adminOnly: false },
    { id: 'pink', label: 'Pink', color: '#ec4899', cost: 10, adminOnly: false },
    // 30 stars
    { id: 'white', label: 'White', color: '#ffffff', cost: 30, adminOnly: false },
    { id: 'black', label: 'Black', color: '#000000', cost: 30, adminOnly: false },
    { id: 'gray', label: 'Gray', color: '#9ca3af', cost: 30, adminOnly: false },
    // 60 stars
    { id: 'purple', label: 'Purple', color: '#a855f7', cost: 60, adminOnly: false },
    // Admin only
    { id: 'admin', label: 'Admin', color: '#4c1d95', cost: 0, adminOnly: true },
     ];

  const faceOptions = [
    { id: 'default', label: 'Classic', cost: 0, adminOnly: false },
    { id: 'happy', label: 'Happy', cost: 0, adminOnly: false },
    { id: 'angry', label: 'Angry', cost: 10, adminOnly: false },
    { id: 'surprised', label: 'Surprised', cost: 15, adminOnly: false },
    { id: 'cool', label: 'Cool', cost: 50, adminOnly: false },
    { id: 'admin', label: 'Admin', cost: 0, adminOnly: true },
  ];

  const handleSelectColor = (colorHex: string, cost: number, adminOnly?: boolean) => {
    if (!user) return;
    if (adminOnly && !user.isAdmin) {
      alert('This color is for admins only!');
      return;
    }
    if ((user.totalStars || 0) < cost) {
      alert(`${cost} stars required!`);
      return;
    }
    const updatedUser: User = {
      ...user,
      selectedColor: colorHex,
    };
    saveUserFull(updatedUser);
  };

  const handleSelectFace = (faceId: string, cost: number, adminOnly?: boolean) => {
    if (!user) return;
    if (adminOnly && !user.isAdmin) {
      alert('This face is for admins only!');
      return;
    }
    if ((user.totalStars || 0) < cost) {
      alert(`${cost} stars required!`);
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
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] px-4">
              <h1 className="text-4xl sm:text-7xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-6 sm:mb-12 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] font-orbitron transform -skew-x-6 text-center">
                 CUBE DASH
              </h1>

              <div className="bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-700 w-full max-w-md">
                  <h2 className="text-2xl font-bold mb-6 text-center font-orbitron">
                      {isRegistering ? 'SIGN UP' : 'LOGIN'}
                  </h2>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm text-slate-400 mb-1">Username</label>
                          <input
                              type="text"
                              value={loginName}
                              onChange={(e) => setLoginName(e.target.value)}
                              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:border-cyan-400 focus:outline-none text-white"
                              placeholder="Your username"
                          />
                      </div>
                      
                      <div>
                          <label className="block text-sm text-slate-400 mb-1">Password</label>
                          <input
                              type="password"
                              value={loginPass}
                              onChange={(e) => setLoginPass(e.target.value)}
                              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg focus:border-cyan-400 focus:outline-none text-white"
                              placeholder="Your password"
                          />
                      </div>

                      {showAdminCodeInput && (
                          <div>
                              <label className="block text-sm text-pink-400 mb-1">Admin Code</label>
                              <input
                                  type="password"
                                  value={adminCode}
                                  onChange={(e) => setAdminCode(e.target.value)}
                                  className="w-full px-4 py-3 bg-slate-700 border border-pink-500 rounded-lg focus:border-pink-400 focus:outline-none text-white"
                                  placeholder="Enter admin code"
                              />
                          </div>
                      )}

                      {loginError && (
                          <div className="text-red-400 text-sm text-center bg-red-900/30 p-2 rounded">
                              {loginError}
                          </div>
                      )}

                      <button
                          onClick={showAdminCodeInput ? handleAdminCodeSubmit : handleAuthAction}
                          className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors font-orbitron"
                      >
                          {showAdminCodeInput ? 'Verify Admin Code' : (isRegistering ? 'Sign Up' : 'Login')}
                      </button>

                      <div className="text-center mt-4">
                          <button
                              onClick={() => { setIsRegistering(!isRegistering); setLoginError(''); }}
                              className="text-cyan-400 hover:text-cyan-300 text-sm"
                          >
                              {isRegistering ? 'Already have an account? Login' : "Don't have an account? Sign up"}
                          </button>
                      </div>
                  </div>
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
                <button onClick={() => setShowSettings(true)} className="bg-slate-800/50 p-1 sm:p-2 rounded hover:bg-slate-700 text-xs">Settings</button>
                <button onClick={handleLogout} className="bg-red-900/50 p-1 sm:p-2 rounded hover:bg-red-900 text-xs">Logout</button>
             </div>

             {showSettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setShowSettings(false)} />
                    <div className="bg-slate-800 p-4 sm:p-6 rounded-lg z-10 w-full max-w-md border border-slate-700">
                        <h3 className="text-xl sm:text-2xl font-bold mb-4">Settings</h3>
                        <div className="mb-4">
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={autoRespawn} onChange={(e) => { setAutoRespawn(e.target.checked); localStorage.setItem('nd_auto_respawn', JSON.stringify(e.target.checked)); }} />
                                <span className="text-sm">Auto respawn (respawn instantly on death)</span>
                            </label>
                        </div>
                        <div className="mb-4">
                            <span className="text-sm block mb-2">Jump Button:</span>
                            <button 
                                onClick={() => {
                                    setIsSettingJumpButton(true);
                                    const handleMouseDown = (e: MouseEvent) => {
                                        setJumpButton(e.button);
                                        localStorage.setItem('nd_jump_button', e.button.toString());
                                        setIsSettingJumpButton(false);
                                        window.removeEventListener('mousedown', handleMouseDown);
                                    };
                                    window.addEventListener('mousedown', handleMouseDown);
                                }}
                                className={`px-4 py-2 rounded font-bold ${isSettingJumpButton ? 'bg-yellow-500 animate-pulse' : 'bg-slate-600 hover:bg-slate-500'}`}
                            >
                                {isSettingJumpButton ? 'Click any button...' : 
                                  (jumpButton === 0 ? 'Left Click' : jumpButton === 1 ? 'Right Click' : 'Middle Click')}
                            </button>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowSettings(false)} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600">Close</button>
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
                    <span className="font-bold font-orbitron text-sm sm:text-lg">CHARACTER</span>
                 </button>


                 <button
                    onClick={() => setGameState(GameState.LEVEL_SELECT)}
                    className="group w-32 h-32 sm:w-40 sm:h-40 bg-cyan-600 hover:bg-cyan-500 border-2 border-cyan-400 rounded-2xl flex flex-col items-center justify-center gap-2 sm:gap-4 transition-all hover:scale-110 hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]"
                 >
                    <Play size={32} className="sm:w-12 sm:h-12 text-black fill-black" />
                    <span className="font-bold font-orbitron text-sm sm:text-lg text-black">PLAY</span>
                 </button>

                 <button
                    onClick={() => setGameState(GameState.LEADERBOARD)}
                    className="group w-32 h-32 sm:w-40 sm:h-40 bg-purple-900 border-2 border-purple-700 hover:border-purple-500 rounded-2xl flex flex-col items-center justify-center gap-2 sm:gap-4 transition-all hover:scale-110 hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]"
                 >
                    <Globe size={32} className="sm:w-12 sm:h-12 text-purple-300 group-hover:text-white" />
                    <span className="font-bold font-orbitron text-sm sm:text-lg">TOP 50</span>
                 </button>

                 <button
                    onClick={() => setGameState(GameState.MY_LEVELS)}
                    className="group w-32 h-32 sm:w-40 sm:h-40 bg-emerald-900 border-2 border-emerald-700 hover:border-emerald-500 rounded-2xl flex flex-col items-center justify-center gap-2 sm:gap-4 transition-all hover:scale-110 hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]"
                 >
                    <PenTool size={32} className="sm:w-12 sm:h-12 text-emerald-300 group-hover:text-white" />
                    <span className="font-bold font-orbitron text-sm sm:text-lg">LEVEL EDITOR</span>
                 </button>

                 <button
                    onClick={() => setGameState(GameState.UNVERIFIED_LEVELS)}
                    className="group w-32 h-32 sm:w-40 sm:h-40 bg-amber-900 border-2 border-amber-700 hover:border-amber-500 rounded-2xl flex flex-col items-center justify-center gap-2 sm:gap-4 transition-all hover:scale-110 hover:shadow-[0_0_30px_rgba(245,158,11,0.4)]"
                 >
                    <Eye size={32} className="sm:w-12 sm:h-12 text-amber-300 group-hover:text-white" />
                    <span className="font-bold font-orbitron text-sm sm:text-lg">VERIFY LEVELS</span>
                 </button>

                     {/* HARDEST 10 removed from main menu */}
             </div>

             <div className="mt-4 sm:mt-8 text-center text-slate-500 text-xs sm:text-sm">
              Version: 1.4.1
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
              CHARACTER
            </h2>

            <div className="bg-slate-800 p-4 sm:p-6 rounded-xl border border-slate-700">
              <div className="flex flex-col items-center gap-4 sm:gap-6">
                {/* Character preview in center */}
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
                              ctx.fillRect(-7, -7, 5, 5);
                              ctx.fillRect(2, -7, 5, 5);
                              ctx.beginPath();
                              ctx.arc(0, 4, 3, 0, Math.PI); // small smile
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
                    Total Stars: <span className="text-yellow-300 font-bold">{stars}</span>
                  </div>
                </div>

                {/* Faces */}
                <div className="w-full">
                  <h3 className="text-sm uppercase tracking-wide text-slate-400 mb-2">
                    Faces
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
                              <Lock size={10} /> {lockedByAdmin ? 'Admin' : `${face.cost}⭐`}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-300">
                              {face.cost === 0 ? 'Free' : `${face.cost}⭐`}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Colors */}
                <div className="w-full">
                  <h3 className="text-sm uppercase tracking-wide text-slate-400 mb-2">
                    Colors
                  </h3>
                  <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
                    {colorOptions.map(opt => {
                      const isSelected = currentColor.toLowerCase() === opt.color.toLowerCase();
                      const lockedByStars = stars < opt.cost;
                      const lockedByAdmin = opt.adminOnly && !user?.isAdmin;
                      const isLocked = lockedByStars || lockedByAdmin;

                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleSelectColor(opt.color, opt.cost, opt.adminOnly)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border min-w-[60px] sm:min-w-[70px]
                            ${isSelected ? 'border-cyan-400 bg-slate-700' : 'border-slate-600 bg-slate-800 hover:bg-slate-700'}
                            ${isLocked ? 'opacity-60' : ''}`}
                        >
                          <div className="flex items-center gap-1">
                            {opt.adminOnly && <ShieldAlert size={12} className="text-pink-400" />}
                            <div
                              className="w-6 h-6 sm:w-8 sm:h-8 rounded border border-black"
                              style={{ backgroundColor: opt.color }}
                            />
                          </div>
                          <span className="text-[10px] sm:text-[11px] font-bold">{opt.label}</span>
                          {isLocked ? (
                            <span className="flex items-center gap-1 text-[10px] text-yellow-300">
                              <Lock size={10} /> {lockedByAdmin ? 'Admin' : `${opt.cost}⭐`}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-300">
                              {opt.cost === 0 ? 'Free' : `${opt.cost}⭐`}
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
                  Back
                </button>
              </div>
            </div>
          </div>
        </div>
      );
  } else if (gameState === GameState.MY_LEVELS) {
      // Get user's drafts
      const myDrafts = user ? drafts.filter(d => d.author === user.name) : [];
      const displayedDrafts = myDrafts.slice(0, 10);

      return (
          <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-8 flex flex-col items-center">
              <button
                  onClick={() => setGameState(GameState.MENU)}
                  className="mb-4 sm:mb-6 p-2 hover:bg-slate-800 rounded-full self-start"
              >
                  <ChevronLeft size={24} className="sm:w-8 sm:h-8" />
              </button>
              <h2 className="text-2xl sm:text-3xl font-orbitron font-bold text-emerald-400 mb-4 text-center">
                MY LEVELS
              </h2>

              <div className="flex gap-4 mb-6">
                  <button
                      onClick={() => {
                          setCurrentDraft(null);
                          setVerifyDraft(null);
                          setVerifyDeal(null);
                          setGameState(GameState.EDITOR);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-bold flex items-center gap-2"
                  >
                      <PenTool size={18} /> CREATE NEW
                  </button>
              </div>

              <div className="w-full max-w-2xl space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                  {displayedDrafts.length === 0 && (
                      <div className="text-center text-slate-500 py-10">
                          You haven't created any levels yet.
                      </div>
                  )}
                  {displayedDrafts.map((draft) => (
                      <div key={draft.id} className="bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-700 flex items-center justify-between">
                          <div className="flex-1">
                              <h3 className="font-bold text-lg">{draft.name}</h3>
                              <p className="text-sm text-slate-400">
                                  {draft.verified ? (
                                      <span className="text-emerald-400 font-bold">✓ Verified</span>
                                  ) : (
                                      <span>Draft</span>
                                  )}
                                  {draft.verifiedBy && (
                                      <span className="text-emerald-400 text-xs ml-2">by {draft.verifiedBy}</span>
                                  )}
                              </p>
                          </div>
                          <div className="flex gap-2">
                              <button
                                  onClick={() => openDraftInEditor(draft)}
                                  className="bg-cyan-600 hover:bg-cyan-500 px-3 py-2 rounded font-bold text-sm"
                              >
                                  EDIT
                              </button>
                              <button
                                  onClick={() => {
                                    if (confirm(`Delete "${draft.name}"?`)) {
                                        deleteDraft(draft.id);
                                    }
                                  }}
                                  className="bg-red-700 hover:bg-red-600 px-3 py-2 rounded font-bold text-sm"
                              >
                                  DELETE
                              </button>
                              {!draft.verified && (
                                  <>
                                      <button
                                          onClick={() => requestVerify(draft)}
                                          className="bg-yellow-600 hover:bg-yellow-500 px-3 py-2 rounded font-bold text-sm"
                                      >
                                          VERIFY
                                      </button>
                                      <button
                                          onClick={() => sendVerifyDeal(draft)}
                                          className="bg-purple-700 hover:bg-purple-600 px-3 py-2 rounded font-bold text-sm"
                                      >
                                          SEND
                                      </button>
                                  </>
                              )}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
  } else if (gameState === GameState.UNVERIFIED_LEVELS) {
      // Get open verify deals
      const openDeals = getVerifyDeals().filter(d => d.status === 'open');

      return (
          <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-8 flex flex-col items-center">
              <button
                  onClick={() => setGameState(GameState.MENU)}
                  className="mb-4 sm:mb-6 p-2 hover:bg-slate-800 rounded-full self-start"
              >
                  <ChevronLeft size={24} className="sm:w-8 sm:h-8" />
              </button>
              <h2 className="text-2xl sm:text-3xl font-orbitron font-bold text-amber-400 mb-4 text-center">
                UNVERIFIED LEVELS
              </h2>

              <div className="w-full max-w-2xl space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                  {openDeals.length === 0 && (
                      <div className="text-center text-slate-500 py-10">
                          No levels waiting for verification.
                      </div>
                  )}
                  {openDeals.map((deal) => (
                      <div key={deal.id} className="bg-slate-800 p-3 sm:p-4 rounded-xl border border-amber-700 flex items-center justify-between">
                          <div className="flex-1">
                              <h3 className="font-bold text-lg">{deal.name}</h3>
                              <p className="text-sm text-slate-400">
                                  by {deal.author}
                              </p>
                          </div>
                          <div className="flex gap-2">
                              <button
                                  onClick={() => startVerifyDealPlay(deal)}
                                  className="bg-amber-600 hover:bg-amber-500 px-3 py-2 rounded font-bold text-sm"
                              >
                                  PLAY & VERIFY
                              </button>
                              <button
                                  onClick={() => {
                                    if (confirm(`Delete "${deal.name}"?`)) {
                                        deleteVerifyDeal(deal.id);
                                        window.location.reload();
                                    }
                                  }}
                                  className="bg-red-700 hover:bg-red-600 px-3 py-2 rounded font-bold text-sm"
                              >
                                  DELETE
                              </button>
                          </div>
                      </div>
                  ))}
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
                    <h2 className="text-2xl sm:text-3xl font-orbitron font-bold text-purple-400">GLOBAL LEADERBOARD</h2>
                    <div className="w-6 sm:w-10"></div>
                 </div>

                 <div id="leaderboard-list" className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden max-h-[70vh] overflow-y-auto">
                 {leaderboardDb.length === 0 && (
                         <div className="p-4 sm:p-8 text-center text-slate-500 text-sm sm:text-base">No one on the leaderboard yet.</div>
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
                                                 ctx.fillRect(-3, -3, 2, 2);
                                                 ctx.fillRect(1, -3, 2, 2);
                                                 ctx.beginPath();
                                                 ctx.arc(0, 1.5, 1.5, 0, Math.PI); // small smile
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
      const displayedLevels = levelView === 'hard' ? hardestLevelIds.map(id => levels.find(l => l.id === id)).filter(Boolean) as LevelMetadata[] :
        levelView === 'new' ? [...levels].sort((a, b) => b.levelNumber - a.levelNumber) :
        levels;

      return (
          <div className="min-h-screen bg-slate-900 text-white p-2 sm:p-4">
              <div className="max-w-full sm:max-w-4xl mx-auto">
                 <div className="flex items-center justify-between mb-4 sm:mb-8">
                    <button onClick={() => setGameState(GameState.MENU)} className="p-2 hover:bg-slate-800 rounded-full"><ChevronLeft size={24} className="sm:w-8 sm:h-8"/></button>
                    <h2 className="text-2xl sm:text-3xl font-orbitron font-bold text-cyan-400">LEVELS</h2>
                    <div className="w-6 sm:w-10"></div>
                 </div>

                 <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-6 justify-center">
                    <button
                        onClick={() => {
                          setCurrentDraft(null);
                          setVerifyDraft(null);
                          setVerifyDeal(null);
                          setGameState(GameState.EDITOR);
                        }}
                        className="flex items-center gap-2 bg-pink-600 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-bold hover:bg-pink-500 hover:scale-105 transition shadow-lg text-sm sm:text-base"
                    >
                        <PenTool size={16} className="sm:w-5 sm:h-5"/> CREATE LEVEL
                    </button>
                    {user?.isAdmin && (
                        <>
                        <button onClick={() => { setShowAssignDifficulty(true); setAssignLevelId(''); setAssignDifficulty('Unlisted'); setAssignStarRating(3); }} className="flex items-center gap-2 bg-yellow-700 px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-bold hover:bg-yellow-600 hover:scale-105 transition shadow-lg text-sm sm:text-base">
                            <ShieldAlert size={14} className="sm:w-4.5 sm:h-4.5"/> ASSIGN DIFFICULTY
                        </button>
                        </>
                    )}
                 </div>

                 <div className="flex gap-2 justify-center mt-1">
                    <button
                       onClick={() => setLevelView(levelView === 'new' ? 'all' : 'new')}
                       className={`px-4 py-2 rounded-lg font-bold transition ${levelView === 'new' ? 'bg-cyan-600 text-black' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                    >
                       Newest
                    </button>
                    <button
                       onClick={() => setLevelView('hard')}
                       className={`px-4 py-2 rounded-lg font-bold transition ${levelView === 'hard' ? 'bg-red-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
                    >
                       Hardest
                    </button>
                    <button
                       onClick={loadLevels}
                       className="px-4 py-2 rounded-lg font-bold transition bg-gray-700 hover:bg-gray-600 text-white"
                    >
                       Refresh
                    </button>
                 </div>

                 {/* Search bar */}
                 <div className="mb-2 sm:mb-4 flex justify-center">
                    <input
                       value={levelSearch}
                       onChange={(e) => setLevelSearch(e.target.value)}
                       placeholder="Search level name or author..."
                       className="w-full max-w-full sm:max-w-md bg-slate-800 border border-slate-600 rounded-lg px-3 sm:px-4 py-2 text-sm focus:outline-none focus:border-cyan-400"
                    />
                 </div>

                 {/* Admin-only hard list panel intentionally hidden from Level Select; open via the EN ZOR 10 button */}

                 <div className="grid gap-2 sm:gap-4 max-h-[60vh] sm:max-h-[480px] overflow-y-auto pr-1">
                     {levels.length === 0 && (
                         <div className="text-center text-slate-500 py-10 sm:py-20 text-sm sm:text-base">
                             No published levels yet. Create the first one!
                         </div>
                     )}
                     {displayedLevels
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

                         const isCompleted = user?.completedLevels.includes(level.id) || user?.highestProgress?.[level.id] === 100;
                         const isLiked = user?.likedLevels?.includes(level.id);

                         return (
                             <div key={level.id} className="bg-slate-800 p-2 sm:p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:border-slate-500 transition group gap-2 sm:gap-0">
                                 <div className="flex-1">
                                     <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                        <h3 className="text-lg sm:text-xl font-bold font-orbitron">
                                            {levelView === 'hard' && <span className="text-red-500 font-bold">#{displayedLevels.indexOf(level) + 1} </span>}
                                            {level.name} <span className="text-xs text-slate-400 font-mono ml-1 sm:ml-2">#{level.levelNumber}</span>
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            {/* Removed background and ground color previews */}
                                        </div>
                                        {isCompleted && (
                                            <div className="text-green-500 text-xs border border-green-500 px-2 py-0.5 rounded font-bold flex items-center gap-1 w-fit">
                                                <CheckCircle size={10}/> COMPLETED
                                            </div>
                                        )}
                                     </div>
                                      <p className="text-sm text-slate-400">by {level.author}{level.verifiedBy && <span className="text-emerald-400 font-bold ml-2">| verifier: {level.verifiedBy}</span>}</p>
                                     <div className="flex items-center gap-2 sm:gap-4 mt-2 text-xs text-slate-500">
                                         <span className="flex items-center gap-1"><Eye size={12}/> {level.plays || 0}</span>
                                         <button
                                            onClick={(e) => { e.stopPropagation(); handleLikeLevel(level.id); }}
                                            className={`flex items-center gap-1 hover:text-pink-400 ${isLiked ? 'text-pink-500 font-bold' : ''}`}
                                         >
                                             <Heart size={12} fill={isLiked ? "currentColor" : "none"}/> {level.likes || 0}
                                         </button>
                                         {user?.highestProgress?.[level.id] && !isCompleted && (
                                             <span className="flex items-center gap-1 text-cyan-400">
                                                 Best: {user.highestProgress[level.id]}%
                                             </span>
                                         )}
                                     </div>
                                 </div>

                                 <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2 sm:gap-6">
                                     <div className="text-center min-w-[80px] flex flex-col items-center">
                                         {localStorage.getItem('mod_colordifficulty_enabled') === 'true' && level.difficulty !== 'Unlisted' ? (
                                           <div className="flex flex-col items-center gap-1">
                                             <div 
                                               className="w-8 h-8 rounded-full border-2 border-white/30 flex items-center justify-center"
                                               style={{ backgroundColor: getDifficultyColor(level.difficulty) }}
                                             >
                                               <Star size={14} className="text-white fill-white" />
                                             </div>
                                             <div className="text-yellow-400 text-xs font-bold flex justify-center items-center gap-1">
                                               {getDifficultyStars(level.difficulty)} <Star size={8} fill="currentColor"/>
                                             </div>
                                           </div>
                                         ) : (
                                           <>
                                             <div className={`font-black uppercase text-sm sm:text-base ${difficultyColors[level.difficulty] || 'text-white'}`}>
                                                {level.difficulty === 'Unlisted' ? 'Unrated' : level.difficulty}
                                             </div>
                                             {level.stars > 0 && (
                                                 <div className="text-yellow-400 text-xs sm:text-sm font-bold flex justify-center items-center gap-1">
                                                    {level.stars} <Star size={10} className="sm:w-3 sm:h-3" fill="currentColor"/>
                                                 </div>
                                             )}
                                           </>
                                         )}
                                     </div>



                                     {/* Admin Controls */}
                                     {user?.isAdmin && (
                                         <div className="flex flex-col gap-0.5 sm:gap-1 ml-2">
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
                                             <div className="flex gap-1 mt-1">
                                                 {levelView === 'all' && !hardestLevelIds.includes(level.id) && hardestLevelIds.length < 11 && (
                                                     <button
                                                         onClick={() => { setShowAddToHardest(true); setAddLevelId(level.id); setAddPosition(1); }}
                                                         className="bg-red-600 hover:bg-red-500 px-1 py-0.5 rounded text-xs font-bold text-white"
                                                     >
                                                         Add to Hardest
                                                     </button>
                                                 )}
                                                 <button
                                                     onClick={() => deleteLevel(level.id)}
                                                     className="bg-red-700 hover:bg-red-600 px-1 py-0.5 rounded text-xs font-bold text-white flex items-center gap-1"
                                                 >
                                                     <Trash2 size={10} /> Delete
                                                 </button>
                                             </div>
                                         </div>
                                     )}

                                     <button
                                        onClick={() => handlePlayLevel(level)}
                                        className="bg-cyan-600 hover:bg-cyan-500 p-2 sm:p-3 rounded-full text-black transition hover:scale-110 shadow-lg group-hover:shadow-cyan-500/50"
                                     >
                                         <Play size={20} className="sm:w-6 sm:h-6" fill="currentColor"/>
                                     </button>
                                     {levelView === 'hard' && user?.isAdmin && (
                                         <button
                                             onClick={() => updateHardestLevels(hardestLevelIds.filter(id => id !== level.id))}
                                             className="bg-red-600 hover:bg-red-500 p-2 sm:p-3 rounded-full text-white transition hover:scale-110 shadow-lg"
                                         >
                                             Delete
                                         </button>
                                     )}
                                 </div>
                             </div>
                         )
                     })}
                 </div>
              </div>

              {showAddToHardest && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                      <div className="absolute inset-0 bg-black/60" onClick={() => setShowAddToHardest(false)} />
                      <div className="bg-slate-800 p-4 sm:p-6 rounded-lg z-10 w-full max-w-md border border-slate-700">
                          <h3 className="text-xl sm:text-2xl font-bold mb-4">Add to Hardest List</h3>
                          <div className="mb-4">
                              <label className="text-sm text-slate-400">Position (1-{hardestLevelIds.length + 1})</label>
                              <select
                                  className="w-full bg-black text-white px-3 py-2 rounded border border-slate-700 mt-1"
                                  value={addPosition}
                                  onChange={(e) => setAddPosition(Number(e.target.value))}
                              >
                                  {Array.from({ length: hardestLevelIds.length + 1 }, (_, i) => i + 1).map(pos => (
                                      <option key={pos} value={pos}>{pos}</option>
                                  ))}
                              </select>
                          </div>
                          <div className="flex gap-2 justify-end">
                              <button onClick={() => setShowAddToHardest(false)} className="px-3 sm:px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm sm:text-base">Cancel</button>
                              <button
                                  onClick={() => {
                                      const newIds = [...hardestLevelIds];
                                      newIds.splice(addPosition - 1, 0, addLevelId);
                                      if (newIds.length > 10) newIds.pop();
                                      updateHardestLevels(newIds);
                                      setShowAddToHardest(false);
                                  }}
                                  className="px-3 sm:px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white text-sm sm:text-base"
                              >
                                  Add
                              </button>
                          </div>
                      </div>
                  </div>
              )}

              {/* SHOP: intentionally accessible from menu */}
                 {false}
          </div>
      );
  }




  if (gameState === GameState.EDITOR) {
      return (
          <LevelEditor
              initialDraft={currentDraft || undefined}
              onSaveDraft={saveDraft}
              onRequestVerify={requestVerify}
              onSendVerifyDeal={sendVerifyDeal}
              onExit={() => setGameState(GameState.MENU)}
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
             jumpButton={jumpButton}
             onDeath={() => {
                 if (autoRespawn) {
                     setScore(0);
                     setCurrentAttempt(prev => prev + 1);
                 } else {
                     // If verifying, return to editor instead of game over
                     if (verifyDraft || verifyDeal) {
                       alert('Verification failed: you died.');
                       setGameState(GameState.EDITOR);
                     } else {
                       setGameState(GameState.GAME_OVER);
                     }
                 }
             }}
             onWin={() => {
               if (verifyDraft && user?.name) {
                 publishVerifiedDraft(verifyDraft, user.name);
                 // Mark draft as verified and keep it editable
                 if (user.name) {
                   const next = drafts.map(d =>
                     d.id === verifyDraft.id
                       ? { ...d, verified: true, verifiedBy: user.name, updatedAt: Date.now() }
                       : d
                   );
                   saveDraftsForUser(user.name, next);
                 }
                 setVerifyDraft(null);
                 alert('Verified! Your level is now published.');
                 setGameState(GameState.LEVEL_SELECT);
                 return;
               }
               if (verifyDeal && user?.name) {
                 // Delete deal and publish
                 deleteVerifyDeal(verifyDeal.id);
                 publishVerifiedDraft({
                   id: verifyDeal.draftId,
                   name: verifyDeal.name,
                   author: verifyDeal.author,
                   data: verifyDeal.data,
                   createdAt: verifyDeal.createdAt,
                   updatedAt: Date.now(),
                   verified: true,
                   verifiedBy: user.name
                 }, user.name);
                 setVerifyDeal(null);
                 alert('Verified deal! Level published.');
                 setGameState(GameState.LEVEL_SELECT);
                 return;
               }

               handleLevelComplete();
             }}
             playerColor={user?.selectedColor || COLORS.player}
             playerFace={user?.selectedFace || 'default'}
             attempt={currentAttempt}
             progress={score}
             autoRespawn={autoRespawn}
             onRespawn={() => setCurrentAttempt(prev => prev + 1)}
             onProgressUpdate={handleProgressUpdate}
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
                      {isWin ? "COMPLETED!" : "ELIMINATED!"}
                  </h2>

                  <div className="flex justify-center my-6 sm:my-8">
                     <div className="relative w-36 sm:w-48 h-4 bg-slate-700 rounded-full overflow-hidden border border-slate-500">
                         <div className={`h-full ${isWin ? 'bg-green-500' : 'bg-red-500'}`} style={{width: `${score}%`}}></div>
                     </div>
                     <span className="absolute mt-6 font-mono font-bold text-lg sm:text-xl">{score}%</span>
                  </div>

                  {isWin && starsEarned > 0 && (
                      <div className="flex justify-center items-center gap-2 text-yellow-400 text-lg sm:text-2xl font-bold mb-6 sm:mb-8 bg-yellow-900/20 p-3 sm:p-4 rounded-xl border border-yellow-500/30">
                          <Trophy size={24} className="sm:w-8 sm:h-8" />
                          +{starsEarned} STARS EARNED!
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
                          MENU
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  return null;
}

export default App;