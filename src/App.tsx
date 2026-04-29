import React, { useEffect, useRef, useState } from 'react';
import { Settings, Play, RotateCcw, Volume2, X } from 'lucide-react';
import { audio, AudioStyle } from './lib/audio';

type GameState = 'START' | 'PLAYING' | 'GAMEOVER';

const FRUITS = [
  { emoji: '🍎', glow: 'rgba(255, 0, 0, 0.8)', color: '#ff0000' },
  { emoji: '🍌', glow: 'rgba(255, 215, 0, 0.8)', color: '#ffd700' },
  { emoji: '🍉', glow: 'rgba(0, 255, 0, 0.8)', color: '#00ff00' },
  { emoji: '🍇', glow: 'rgba(128, 0, 128, 0.8)', color: '#800080' },
  { emoji: '🍓', glow: 'rgba(255, 20, 147, 0.8)', color: '#ff1493' },
];

interface Fruit {
  id: number;
  emoji: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRotation: number;
  size: number;
  glow: string;
  color: string;
  markedForDeletion: boolean;
  sliced: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface SlashPoint {
  x: number;
  y: number;
  age: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [audioStyle, setAudioStyle] = useState<AudioStyle>('funky');
  const [showSettings, setShowSettings] = useState(false);

  // Mutable game state for canvas loop
  const engineRef = useRef({
    fruits: [] as Fruit[],
    particles: [] as Particle[],
    slashPoints: [] as SlashPoint[],
    isPointerDown: false,
    pointerPos: { x: 0, y: 0 },
    lastTime: 0,
    spawnTimer: 0,
    score: 0,
    lives: 3,
    state: 'START' as GameState,
  });

  // Sync state cleanly
  useEffect(() => {
    engineRef.current.state = gameState;
    engineRef.current.score = score;
    engineRef.current.lives = lives;
  }, [gameState, score, lives]);

  useEffect(() => {
    // Handle resize
    const resizeCanvas = () => {
      if (canvasRef.current && containerRef.current) {
        // Need to match pixel ratio for sharp text
        const dpr = window.devicePixelRatio || 1;
        const rect = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = rect.width * dpr;
        canvasRef.current.height = rect.height * dpr;
        canvasRef.current.style.width = `${rect.width}px`;
        canvasRef.current.style.height = `${rect.height}px`;
        
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.scale(dpr, dpr);
      }
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const spawnFruit = () => {
    if (!canvasRef.current) return;
    const w = canvasRef.current.clientWidth;
    const h = canvasRef.current.clientHeight;
    
    const template = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    const x = Math.random() * (w - 100) + 50;
    const y = h + 60; // spawn below screen
    
    // velocity towards center-ish
    const vx = (w / 2 - x) * (Math.random() * 0.02 + 0.01) + (Math.random() * 4 - 2);
    const vy = -(Math.random() * 6 + 14); // Pop up

    engineRef.current.fruits.push({
      id: Math.random(),
      emoji: template.emoji,
      x, y, vx, vy,
      rotation: Math.random() * Math.PI * 2,
      vRotation: (Math.random() - 0.5) * 0.2,
      size: 50 + Math.random() * 20,
      glow: template.glow,
      color: template.color,
      markedForDeletion: false,
      sliced: false,
    });
  };

  const createParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 15; i++) {
        engineRef.current.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 0,
            maxLife: 30 + Math.random() * 20,
            color,
            size: Math.random() * 8 + 4
        });
    }
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const gameLoop = (timestamp: number) => {
      const dt = timestamp - engineRef.current.lastTime;
      engineRef.current.lastTime = timestamp;

      const w = canvasRef.current!.clientWidth;
      const h = canvasRef.current!.clientHeight;

      ctx.clearRect(0, 0, w, h);

      if (engineRef.current.state === 'PLAYING') {
        engineRef.current.spawnTimer += dt;
        if (engineRef.current.spawnTimer > 1000 - Math.min(800, engineRef.current.score * 10)) { // Speed up!
          spawnFruit();
          engineRef.current.spawnTimer = 0;
        }

        // Logic & Render Fruits
        for (let i = engineRef.current.fruits.length - 1; i >= 0; i--) {
          const f = engineRef.current.fruits[i];
          
          f.x += f.vx;
          f.y += f.vy;
          f.vy += 0.4; // gravity
          f.rotation += f.vRotation;

          if (f.y > h + 100) {
            f.markedForDeletion = true;
            if (!f.sliced) {
              // Missed!
              setLives(l => {
                const newLives = l - 1;
                if (newLives <= 0) {
                  setGameState('GAMEOVER');
                  audio.playGameOver();
                  audio.stopBGM();
                } else {
                  audio.playMiss();
                }
                return newLives;
              });
              // Red flash effect
              ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
              ctx.fillRect(0, 0, w, h);
            }
          }

          if (f.markedForDeletion) {
            engineRef.current.fruits.splice(i, 1);
            continue;
          }

          // Collision detection with pointer if down
          if (engineRef.current.isPointerDown && !f.sliced) {
            const dx = f.x - engineRef.current.pointerPos.x;
            const dy = f.y - engineRef.current.pointerPos.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < f.size) { // Slice it!
              f.sliced = true;
              f.markedForDeletion = true;
              createParticles(f.x, f.y, f.color);
              setScore(s => s + 1);
              audio.playSlice();
            }
          }

          // Draw Fruit
          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.rotate(f.rotation);
          
          ctx.font = `${f.size}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          ctx.shadowColor = f.glow;
          ctx.shadowBlur = 20;

          if (!f.sliced) {
              ctx.fillText(f.emoji, 0, 0);
          }
          ctx.restore();
        }
      }

      // Render Particles
      for (let i = engineRef.current.particles.length - 1; i >= 0; i--) {
        const p = engineRef.current.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.life++;
        
        if (p.life > p.maxLife) {
            engineRef.current.particles.splice(i, 1);
            continue;
        }

        const alpha = 1 - (p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      // Add & Render Slash
      if (engineRef.current.isPointerDown) {
        engineRef.current.slashPoints.push({
            x: engineRef.current.pointerPos.x,
            y: engineRef.current.pointerPos.y,
            age: 0
        });
      }

      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < engineRef.current.slashPoints.length; i++) {
        const sp = engineRef.current.slashPoints[i];
        sp.age++;
        if (i === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      }
      
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 15;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();

      // Clean up old slash points
      engineRef.current.slashPoints = engineRef.current.slashPoints.filter(sp => sp.age < 15);

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    engineRef.current.isPointerDown = true;
    engineRef.current.pointerPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!engineRef.current.isPointerDown) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    engineRef.current.pointerPos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
  };

  const handlePointerUp = () => {
    engineRef.current.isPointerDown = false;
    engineRef.current.slashPoints = [];
  };

  const startGame = () => {
    engineRef.current.fruits = [];
    engineRef.current.particles = [];
    engineRef.current.slashPoints = [];
    setScore(0);
    setLives(3);
    setGameState('PLAYING');
    audio.playBGM();
  };

  const changeAudioStyle = (style: AudioStyle) => {
    setAudioStyle(style);
    audio.setBGMStyle(style);
  };

  useEffect(() => {
    // Initial audio init wait for click, handled via standard button flow
  }, []);

  return (
    <div 
      className="relative w-full h-screen bg-slate-950 overflow-hidden font-sans select-none touch-none"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full cursor-crosshair z-0"
      />
      
      {/* Background Neon Grid Effect */}
      <div 
        className="pointer-events-none absolute inset-0 z-0 opacity-20" 
        style={{ backgroundImage: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)', backgroundSize: '64px 64px' }}
      ></div>

      {/* HUD Header */}
      <header className="absolute top-0 left-0 w-full p-8 flex justify-between items-start z-20 pointer-events-none">
        <div className="flex flex-col">
          {gameState === 'PLAYING' && (
            <>
              <span className="text-cyan-400 text-xs font-bold tracking-[0.3em] uppercase mb-1">Current Score</span>
              <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-cyan-300 to-blue-600 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">
                {score.toString().padStart(6, '0')}
              </span>
            </>
          )}
        </div>

        <div className="flex space-x-12 items-center">
          {gameState === 'PLAYING' && (
            <div className="flex flex-col items-center">
              <span className="text-fuchsia-400 text-xs font-bold tracking-[0.3em] uppercase mb-2">Stability</span>
              <div className="flex space-x-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-8 h-8 rounded-sm ${i < lives ? 'bg-fuchsia-500 shadow-[0_0_15px_#d946ef]' : 'bg-slate-800 border border-fuchsia-900'}`} 
                  />
                ))}
              </div>
            </div>
          )}

          {/* Settings Trigger */}
          <div 
            className="pointer-events-auto w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center hover:bg-slate-800 transition-colors cursor-pointer shadow-lg ml-auto"
            onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}
            title="Settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
        </div>
      </header>

      {/* Main Gameplay Area Overlays */}
      <main className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-center items-center">
        {gameState === 'START' && (
          <div className="flex flex-col items-center gap-12 pointer-events-auto">
            <h1 className="text-7xl sm:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-br from-cyan-300 to-blue-600 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)] text-center leading-tight tracking-tighter uppercase">
              Neon<br/>Slasher
            </h1>
            <button 
              onClick={(e) => { e.stopPropagation(); startGame(); }}
              className="group flex items-center gap-3 px-10 py-5 bg-cyan-950/50 border border-cyan-500/50 hover:bg-cyan-900/80 text-cyan-50 font-bold text-xl tracking-[0.2em] uppercase transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] backdrop-blur-md rounded-xl"
            >
              <div className="w-4 h-4 bg-cyan-400 group-hover:animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div> 
              INITIALIZE
            </button>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="flex flex-col items-center gap-8 pointer-events-auto">
             <h2 className="text-5xl sm:text-7xl font-black text-fuchsia-500 drop-shadow-[0_0_25px_rgba(217,70,239,0.8)] tracking-widest text-center uppercase">
                SYSTEM<br/>TERMINATED
              </h2>
              <div className="text-2xl font-mono text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)] tracking-widest uppercase">
                FINAL SCORE: {score.toString().padStart(6, '0')}
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); startGame(); }}
                className="mt-4 flex items-center gap-3 px-8 py-4 border-2 border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-slate-950 font-bold text-lg tracking-[0.2em] uppercase transition-all shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:shadow-[0_0_30px_rgba(34,211,238,0.8)]"
              >
                <RotateCcw /> SYSTEM REBOOT
              </button>
          </div>
        )}
      </main>

      {/* Settings Modal/Panel */}
      {showSettings && (
        <>
          <div className="absolute inset-0 z-30 bg-black/40 backdrop-blur-sm pointer-events-auto" onClick={(e) => { e.stopPropagation(); setShowSettings(false); }} />
          <aside 
            className="absolute right-8 top-1/2 -translate-y-1/2 w-80 p-6 bg-slate-900/80 backdrop-blur-xl border border-slate-700 rounded-3xl z-40 shadow-2xl pointer-events-auto flex flex-col"
            onClick={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-slate-400 text-xs font-black tracking-widest uppercase flex items-center">
                Audio Modules <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse ml-3"></div>
              </h3>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowSettings(false); }}
                className="text-slate-500 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            <nav className="space-y-3">
              {(['funky', 'dreamy', 'soft', 'rock', 'pop'] as AudioStyle[]).map(style => {
                const isSelected = audioStyle === style;
                const displayName = style === 'funky' ? 'Funky' : style === 'pop' ? 'Neo-Pop' : style === 'rock' ? 'Hard Rock' : style === 'soft' ? 'Soft Lo-Fi' : 'Dreamy';
                
                if (isSelected) {
                   return (
                      <div key={style} onClick={() => changeAudioStyle(style)} className="group cursor-pointer p-4 rounded-xl border border-cyan-500/50 bg-cyan-950/30 flex items-center shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 mr-3 animate-pulse"></div>
                        <span className="text-sm font-bold text-cyan-50 tracking-wide uppercase">{displayName}</span>
                      </div>
                   );
                } else {
                   return (
                      <div key={style} onClick={() => changeAudioStyle(style)} className="group cursor-pointer p-4 rounded-xl border border-slate-700 bg-slate-800/50 hover:border-fuchsia-500/50 hover:bg-fuchsia-950/20 transition-all flex items-center">
                        <div className="w-2 h-2 rounded-full bg-slate-600 mr-3 group-hover:bg-fuchsia-400 transition-colors"></div>
                        <span className="text-sm font-medium text-slate-400 group-hover:text-fuchsia-300 tracking-wide uppercase transition-colors">{displayName}</span>
                      </div>
                   );
                }
              })}
            </nav>
          </aside>
        </>
      )}
    </div>
  );
}
