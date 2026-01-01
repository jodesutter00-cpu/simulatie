
import { G, PIXELS_PER_METER, GROUND_Y_OFFSET, BUILDING_WIDTH } from './constants';
import VectorArrow from './components/VectorArrow';
import { GoogleGenAI } from "@google/genai";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Point, StoredSimulationResult } from './types';

const App: React.FC = () => {
  const [initialVelocity, setInitialVelocity] = useState(13.5);
  const [initialHeight, setInitialHeight] = useState(20);
  const [mass, setMass] = useState(50);
  const [isPaused, setIsPaused] = useState(true);
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [pastResults, setPastResults] = useState<StoredSimulationResult[]>([]);
  const [impactHappened, setImpactHappened] = useState(false);
  const [geminiExplanation, setGeminiExplanation] = useState<string>('');
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);

  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | undefined>(undefined);

  // Constants for current simulation
  const finalTime = Math.sqrt((2 * initialHeight) / G);
  const currentTime = Math.min(time, finalTime);
  const isLanded = time >= finalTime;

  const currentY = Math.max(0, initialHeight - 0.5 * G * Math.pow(currentTime, 2));
  const currentX = initialVelocity * currentTime;

  // Current simulation derived values
  const vx = initialVelocity;
  const vy = G * currentTime;
  const vResultant = Math.sqrt(vx * vx + vy * vy);
  const Fg = mass * G;
  const Fi_y = -mass * G; 

  const fetchExplanation = async () => {
    setIsLoadingExplanation(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Leg kort in het Nederlands uit wat er gebeurt bij een horizontale worp met een beginsnelheid van ${initialVelocity} m/s vanop een hoogte van ${initialHeight} meter met een massa van ${mass} kg.`,
      });
      setGeminiExplanation(response.text || 'Geen uitleg beschikbaar.');
    } catch (error) {
      setGeminiExplanation('Er kon geen AI-uitleg worden opgehaald.');
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  const animate = useCallback((timestamp: number) => {
    if (lastTimeRef.current !== undefined && !isPaused && isRunning && !isLanded) {
      const deltaTime = (timestamp - lastTimeRef.current) / 1000;
      setTime(prevTime => {
        const nextTime = prevTime + deltaTime;
        if (nextTime >= finalTime) {
          setImpactHappened(true);
          return finalTime;
        }
        return nextTime;
      });
    }
    lastTimeRef.current = timestamp;
    requestRef.current = requestAnimationFrame(animate);
  }, [isPaused, isRunning, isLanded, finalTime]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  const archiveCurrentRun = useCallback(() => {
    if (time > 0) {
      const archivedTrajectory: Point[] = [];
      const archiveStep = 0.02;
      const tEnd = Math.min(time, finalTime);
      for (let t = 0; t <= tEnd; t += archiveStep) {
        archivedTrajectory.push({ x: initialVelocity * t, y: initialHeight - 0.5 * G * t * t });
      }
      archivedTrajectory.push({ x: initialVelocity * tEnd, y: initialHeight - 0.5 * G * tEnd * tEnd });

      const result: StoredSimulationResult = {
        trajectory: archivedTrajectory,
        finalPos: { x: initialVelocity * tEnd, y: initialHeight - 0.5 * G * tEnd * tEnd },
        vx: initialVelocity,
        vy: G * tEnd,
        vResultant: Math.sqrt(initialVelocity**2 + (G * tEnd)**2),
        Fg: mass * G,
        Fi_y: -mass * G,
        mass: mass,
        initialParams: { v0: initialVelocity, h: initialHeight, m: mass }
      };
      setPastResults(prev => [result, ...prev].slice(0, 3));
    }
  }, [time, finalTime, initialVelocity, initialHeight, mass]);

  const handleStart = () => {
    if (isLanded) {
      archiveCurrentRun();
    }
    setIsRunning(true);
    setImpactHappened(false);
    setTime(0);
    setIsPaused(false);
  };

  const handleSliderChange = (type: 'v' | 'h' | 'm', value: number) => {
    if (isLanded) {
      archiveCurrentRun();
    }
    if (type === 'v') setInitialVelocity(value);
    if (type === 'h') setInitialHeight(value);
    if (type === 'm') setMass(value);
    setTime(0);
    setIsRunning(false);
    setImpactHappened(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsPaused(true);
    setTime(0);
    setPastResults([]); 
    setImpactHappened(false);
    setGeminiExplanation('');
  };

  const canvasHeight = (initialHeight + 10) * PIXELS_PER_METER;

  const getScreenCoords = (p: Point, h: number) => ({
    x: BUILDING_WIDTH + p.x * PIXELS_PER_METER,
    y: h - (p.y * PIXELS_PER_METER) - GROUND_Y_OFFSET
  });

  const currentPos = getScreenCoords({ x: currentX, y: currentY }, canvasHeight);

  const generateActivePathPoints = () => {
    const points: string[] = [];
    const step = 0.01;
    for (let t = 0; t <= currentTime; t += step) {
      const x = initialVelocity * t;
      const y = initialHeight - 0.5 * G * t * t;
      const screen = getScreenCoords({ x, y }, canvasHeight);
      points.push(`${screen.x},${screen.y}`);
    }
    points.push(`${currentPos.x},${currentPos.y}`);
    return points.join(' ');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex flex-col gap-6 font-sans antialiased text-slate-900">
      <header className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Horizontale Worp Simulator</h1>
        <p className="text-slate-500 mt-1">Interactief laboratorium voor kinematica en dynamica.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
        <aside className="lg:col-span-1 flex flex-col gap-6">
          <section className="bg-white p-6 rounded-2xl shadow-md border border-slate-100">
            <h2 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2 text-blue-600">
              <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span>
              Instellingen
            </h2>
            
            <div className="space-y-8">
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Beginsnelheid (v₀)</label>
                  <span className="text-sm font-black text-slate-900">{initialVelocity} m/s</span>
                </div>
                <input
                  type="range" min="0" max="30" step="0.5" value={initialVelocity}
                  onChange={(e) => handleSliderChange('v', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Hoogte (h)</label>
                  <span className="text-sm font-black text-slate-900">{initialHeight} m</span>
                </div>
                <input
                  type="range" min="2" max="50" step="1" value={initialHeight}
                  onChange={(e) => handleSliderChange('h', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Massa (m)</label>
                  <span className="text-sm font-black text-slate-900">{mass} kg</span>
                </div>
                <input
                  type="range" min="1" max="500" step="1" value={mass}
                  onChange={(e) => handleSliderChange('m', Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>

            <div className="mt-10 flex flex-col gap-3">
              <button
                onClick={isRunning && !isLanded ? () => setIsPaused(!isPaused) : handleStart}
                className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all ${
                  isPaused || !isRunning || isLanded
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-200' 
                    : 'bg-slate-800 hover:bg-slate-900 text-white'
                }`}
              >
                {!isRunning || isLanded ? 'Start Simulatie' : isPaused ? 'Hervatten' : 'Pauzeren'}
              </button>
              <button
                onClick={handleReset}
                className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-widest bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
              >
                Reset Historiek
              </button>
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 flex-1 overflow-hidden flex flex-col">
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-sm font-bold uppercase tracking-widest text-purple-600 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-purple-600 rounded-full"></span>
                AI Rapportage
               </h2>
               <button onClick={fetchExplanation} disabled={isLoadingExplanation} className="text-[10px] font-bold uppercase tracking-widest bg-purple-50 text-purple-600 px-3 py-1 rounded-full border border-purple-100 hover:bg-purple-100 transition-all disabled:opacity-50">
                 Analyseer
               </button>
             </div>
             <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
               {isLoadingExplanation ? (
                 <div className="animate-pulse space-y-3">
                   <div className="h-3 bg-slate-100 rounded w-3/4"></div>
                   <div className="h-3 bg-slate-100 rounded w-full"></div>
                 </div>
               ) : (
                 <p className="text-sm text-slate-600 italic leading-relaxed">
                   {geminiExplanation || "Gebruik de simulator en klik op 'Analyseer' voor fysica-uitleg."}
                 </p>
               )}
             </div>
          </section>
        </aside>

        <main className="lg:col-span-3 flex flex-col gap-6">
          <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl relative overflow-hidden border-[12px] border-slate-800" style={{ height: '620px' }}>
            <svg width="100%" height="100%" className="bg-slate-950" viewBox={`0 0 1000 ${canvasHeight}`} preserveAspectRatio="xMinYMin meet">
              <defs>
                <pattern id="grid" width={PIXELS_PER_METER * 5} height={PIXELS_PER_METER * 5} patternUnits="userSpaceOnUse">
                  <path d={`M ${PIXELS_PER_METER * 5} 0 L 0 0 0 ${PIXELS_PER_METER * 5}`} fill="none" stroke="#1e293b" strokeWidth="0.5"/>
                </pattern>
                <linearGradient id="buildingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#334155" />
                </linearGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Gebouw */}
              <rect
                x={0}
                y={canvasHeight - (initialHeight * PIXELS_PER_METER) - GROUND_Y_OFFSET}
                width={BUILDING_WIDTH}
                height={initialHeight * PIXELS_PER_METER}
                fill="url(#buildingGradient)"
                stroke="#475569"
                strokeWidth="1"
              />

              {/* Grond */}
              <line
                x1="0" y1={canvasHeight - GROUND_Y_OFFSET} x2="1000" y2={canvasHeight - GROUND_Y_OFFSET}
                stroke="#22c55e" strokeWidth="6" strokeLinecap="round"
              />

              {/* HISTORIEK (Ghosting) */}
              {pastResults.map((res, idx) => {
                const fPos = getScreenCoords(res.finalPos, canvasHeight);
                const opacity = 0.3 - (idx * 0.08);
                const p = res.initialParams;
                return (
                  <g key={`ghost-${idx}`} opacity={opacity}>
                    <polyline
                      points={res.trajectory.map(p => {
                        const s = getScreenCoords(p, canvasHeight);
                        return `${s.x},${s.y}`;
                      }).join(' ')}
                      fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 5"
                    />
                    <circle cx={fPos.x} cy={fPos.y} r={4 + Math.sqrt(res.mass)/3} fill="#64748b" />
                    
                    <g transform={`translate(${fPos.x - 40}, ${fPos.y + 15})`}>
                      <rect width="80" height="35" rx="8" fill="rgba(15, 23, 42, 0.6)" />
                      <text x="40" y="12" textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="bold">v₀: {p.v0} m/s</text>
                      <text x="40" y="22" textAnchor="middle" fill="#94a3b8" fontSize="8" fontWeight="bold">h: {p.h}m | m: {p.m}kg</text>
                      <text x="40" y="32" textAnchor="middle" fill="#cbd5e1" fontSize="8" fontWeight="black">x: {res.finalPos.x.toFixed(1)}m</text>
                    </g>

                    <VectorArrow startX={fPos.x} startY={fPos.y} vx={res.vx} vy={0} color="#94a3b8" label={`vx: ${res.vx.toFixed(1)}`} scale={3} labelOffset={0} />
                    <VectorArrow startX={fPos.x} startY={fPos.y} vx={0} vy={-res.vy} color="#94a3b8" label={`vy: ${res.vy.toFixed(1)}`} scale={3} labelOffset={1} />
                    <VectorArrow startX={fPos.x} startY={fPos.y} vx={0} vy={-res.Fg/10} color="#fca5a5" label={`Fg: ${res.Fg.toFixed(0)}`} scale={1} labelOffset={-1} />
                  </g>
                );
              })}

              {/* ACTUEEL TRAJECT */}
              {(isRunning || time > 0) && (
                <polyline
                  points={generateActivePathPoints()}
                  fill="none" stroke="#3b82f6" strokeWidth="3.5" strokeLinecap="round" strokeOpacity="0.9"
                />
              )}

              {/* HET OBJECT */}
              <circle
                cx={currentPos.x}
                cy={currentPos.y}
                r={6 + Math.sqrt(mass)/3}
                fill="#3b82f6" stroke="#ffffff" strokeWidth="2.5"
                className="drop-shadow-lg"
              />

              {/* ACTIEVE VECTOREN */}
              {(isRunning || time > 0) && (
                <g>
                  <VectorArrow startX={currentPos.x} startY={currentPos.y} vx={vx} vy={0} color="#60a5fa" label={`vx: ${vx.toFixed(1)} m/s`} scale={4} labelOffset={0} />
                  <VectorArrow startX={currentPos.x} startY={currentPos.y} vx={0} vy={-vy} color="#60a5fa" label={`vy: ${vy.toFixed(1)} m/s`} scale={4} labelOffset={1} />
                  <VectorArrow startX={currentPos.x} startY={currentPos.y} vx={vx} vy={-vy} color="#ffffff" label={`v_res: ${vResultant.toFixed(1)} m/s`} scale={4} labelOffset={2} />
                  <VectorArrow startX={currentPos.x} startY={currentPos.y} vx={0} vy={-Fg/10} color="#fca5a5" label={`Fg: ${Fg.toFixed(0)} N`} scale={1} labelOffset={-1} />
                  {/* Fi_y is removed from here as per user request to only show it on impact */}
                </g>
              )}

              {/* Impact animatie */}
              {isLanded && impactHappened && (
                <g>
                  <VectorArrow startX={currentPos.x} startY={currentPos.y} vx={0} vy={-Fi_y/10} color="#fdba74" label={`Fi_y: ${(-Fi_y).toFixed(0)} N`} scale={1} labelOffset={-2} />
                  <VectorArrow startX={currentPos.x} startY={currentPos.y} vx={0} vy={Fg/4} color="#ef4444" label={`Impact: ~${(Fg*5).toFixed(0)} N`} scale={1} labelOffset={-3} />
                  <circle cx={currentPos.x} cy={currentPos.y} r="28" fill="#ef4444" opacity="0.1" className="animate-ping" />
                </g>
              )}
            </svg>

            {/* Meetwaarden (Rechtsboven) */}
            <div className="absolute top-8 right-8 bg-slate-950/80 backdrop-blur-xl p-6 rounded-3xl border border-white/10 text-slate-200 text-xs font-mono shadow-2xl space-y-3 min-w-[180px]">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-slate-500 uppercase tracking-tighter">Tijd</span> 
                <span className="text-blue-400 font-black text-sm">{currentTime.toFixed(2)}s</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-slate-500 uppercase tracking-tighter">Hoogte (y)</span> 
                <span className="text-blue-400 font-black text-sm">{currentY.toFixed(1)}m</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 uppercase tracking-tighter">Snelheid</span> 
                <span className="text-white font-black text-sm">{vResultant.toFixed(1)}m/s</span>
              </div>
            </div>

            {/* FORMULE KADER (Rechtsonder) */}
            <div className="absolute bottom-8 right-8 bg-slate-950/70 backdrop-blur-lg p-5 rounded-3xl border border-white/10 text-slate-300 text-[10px] font-mono shadow-xl space-y-3 pointer-events-none border-r-4 border-r-blue-500 max-w-[280px]">
              <h4 className="text-white font-bold uppercase tracking-wider text-[11px] mb-2 flex justify-between items-center">
                <span>Theorie & Live Berekening</span>
                <span className="text-blue-500 text-[9px] px-2 py-0.5 bg-blue-500/10 rounded-full border border-blue-500/20">LIVE</span>
              </h4>
              <div className="space-y-3">
                <div className="space-y-1 bg-white/5 p-2 rounded-xl border border-white/5">
                  <p className="text-blue-400 font-bold mb-1">Valtijd (t_v):</p>
                  <p className="text-slate-400">t_v = √(2h / g)</p>
                  <p className="text-white text-[11px]">√({(2*initialHeight).toFixed(1)} / 9.81) = <span className="text-blue-400 font-black">{finalTime.toFixed(2)}s</span></p>
                </div>
                
                <div className="space-y-1 bg-white/5 p-2 rounded-xl border border-white/5">
                  <p className="text-emerald-400 font-bold mb-1">Reikwijdte (x_max):</p>
                  <p className="text-slate-400">x = v₀ · t_v</p>
                  <p className="text-white text-[11px]">{initialVelocity.toFixed(1)} · {finalTime.toFixed(2)} = <span className="text-emerald-400 font-black">{(initialVelocity * finalTime).toFixed(1)}m</span></p>
                </div>

                <div className="space-y-1 bg-white/5 p-2 rounded-xl border border-white/5">
                  <p className="text-purple-400 font-bold mb-1">Energie Status (start):</p>
                  <div className="grid grid-cols-1 gap-1">
                    <p className="flex justify-between"><span>E_p = mgh:</span> <span className="text-white">{(mass * G * initialHeight / 1000).toFixed(2)} kJ</span></p>
                    <p className="flex justify-between"><span>E_k = ½mv₀²:</span> <span className="text-white">{(0.5 * mass * Math.pow(initialVelocity, 2) / 1000).toFixed(2)} kJ</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Historiek</h3>
              <p className="text-slate-600 text-xs leading-relaxed">Vergelijk tot 3 trajecten. Beweeg over de ghosting worpen om de specifieke parameters bij de impact te zien.</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Live Theorie</h3>
              <p className="text-slate-600 text-xs leading-relaxed">Het kader rechtsonder rekent real-time mee met jouw schuifbalken voor de perfecte voorspelling.</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Vector Analyse</h3>
              <p className="text-slate-600 text-xs leading-relaxed">De blauwe lijnen tonen snelheid, de rode lijnen tonen de krachten die inwerken op het object.</p>
            </div>
          </div>
        </main>
      </div>

      <footer className="py-6 border-t border-slate-200 text-center text-slate-400 text-[10px] uppercase tracking-[0.3em] mt-auto">
        Physica Simulator &bull; Horizontale Worp &bull; v3.1 Impact-Focused
      </footer>
    </div>
  );
};

export default App;
