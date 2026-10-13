import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Keyboard,
  Trophy,
  Zap,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Info,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import {
  ActiveShape,
  BlockCell,
  createEmptyGrid,
  getRandomShape,
  getRotation,
  checkLeft,
  checkRight,
  checkBottom,
  getGhostY,
  SHAPES_DATA,
} from './tetris';
import { sounds } from './audio';

type BoardPreset = 'original' | 'standard';

export default function App() {
  // Preset: 'original' is 20 cols x 40 rows (from original MukulBarai/Block-Tetris python code)
  // 'standard' is classic 10 cols x 20 rows
  const [boardPreset, setBoardPreset] = useState<BoardPreset>('original');
  const cols = boardPreset === 'original' ? 20 : 10;
  const rows = boardPreset === 'original' ? 40 : 20;

  const [score, setScore] = useState<number>(0);
  const [lines, setLines] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [highScore, setHighScore] = useState<number>(() => {
    return parseInt(localStorage.getItem('block_tetris_highscore') || '0', 10);
  });
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showGhost, setShowGhost] = useState<boolean>(true);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mutable game state held in refs for 60fps rAF loop and precise timekeeping
  const gridRef = useRef<BlockCell[][]>(createEmptyGrid(rows, cols));
  const currentShapeRef = useRef<ActiveShape>(getRandomShape(cols));
  const nextShapeRef = useRef<ActiveShape>(getRandomShape(cols));
  const isDownPressedRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const gameOverRef = useRef<boolean>(false);

  // Time tracking mirroring Python tetris.py
  // startTime, clockTime = 0.25, nTime = 0
  const clockTimeRef = useRef<number>(0.25);
  const lastTimeRef = useRef<number>(0);
  const accumulatedTimeRef = useRef<number>(0);

  // Keep sounds sync
  useEffect(() => {
    sounds.enabled = soundEnabled;
  }, [soundEnabled]);

  // Sync refs with react state
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    gameOverRef.current = gameOver;
  }, [gameOver]);

  // Reset or change mode
  const resetGame = useCallback(
    (newPreset?: BoardPreset) => {
      const activePreset = newPreset || boardPreset;
      const targetCols = activePreset === 'original' ? 20 : 10;
      const targetRows = activePreset === 'original' ? 40 : 20;

      gridRef.current = createEmptyGrid(targetRows, targetCols);
      currentShapeRef.current = getRandomShape(targetCols);
      nextShapeRef.current = getRandomShape(targetCols);
      clockTimeRef.current = 0.25;
      accumulatedTimeRef.current = 0;
      lastTimeRef.current = performance.now();
      isDownPressedRef.current = false;

      setScore(0);
      setLines(0);
      setLevel(1);
      setGameOver(false);
      setIsPaused(false);
      gameOverRef.current = false;
      isPausedRef.current = false;
    },
    [boardPreset]
  );

  // Handle Preset switch
  const handlePresetChange = (preset: BoardPreset) => {
    if (preset === boardPreset) return;
    setBoardPreset(preset);
    resetGame(preset);
  };

  // Move methods mirroring tetris.py
  const handleMoveLeft = useCallback(() => {
    if (gameOverRef.current || isPausedRef.current) return;
    const current = currentShapeRef.current;
    if (checkLeft(current, gridRef.current)) {
      current.xCor -= 1;
      sounds.playMove();
    }
  }, []);

  const handleMoveRight = useCallback(() => {
    if (gameOverRef.current || isPausedRef.current) return;
    const current = currentShapeRef.current;
    if (checkRight(current, gridRef.current, cols)) {
      current.xCor += 1;
      sounds.playMove();
    }
  }, [cols]);

  const handleRotate = useCallback(() => {
    if (gameOverRef.current || isPausedRef.current) return;
    const rotated = getRotation(currentShapeRef.current, gridRef.current, rows, cols);
    if (rotated !== currentShapeRef.current) {
      currentShapeRef.current = rotated;
      sounds.playRotate();
    }
  }, [rows, cols]);

  // Hard drop
  const handleHardDrop = useCallback(() => {
    if (gameOverRef.current || isPausedRef.current) return;
    const current = currentShapeRef.current;
    const finalY = getGhostY(current, gridRef.current, rows);
    const dropDistance = finalY - current.yCor;
    current.yCor = finalY;

    // Immediately trigger lock-in
    accumulatedTimeRef.current = clockTimeRef.current + 1;
    setScore((s) => s + dropDistance * 2);
    sounds.playDrop();
  }, [rows]);

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'p' || e.key === 'P') {
        setIsPaused((prev) => !prev);
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        setSoundEnabled((prev) => !prev);
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        resetGame();
        return;
      }

      if (gameOverRef.current || isPausedRef.current) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          handleMoveLeft();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          handleMoveRight();
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
        case 'x':
        case 'X':
          handleRotate();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          isDownPressedRef.current = true;
          clockTimeRef.current = 0.025; // Matching tetris.py clockTime = 0.025
          break;
        case ' ':
          handleHardDrop();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowDown', 's', 'S'].includes(e.key)) {
        isDownPressedRef.current = false;
        // Base speed based on current level
        clockTimeRef.current = Math.max(0.04, 0.25 - (level - 1) * 0.02);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleMoveLeft, handleMoveRight, handleRotate, handleHardDrop, resetGame, level]);

  // Main game tick & render loop
  useEffect(() => {
    let animId: number;

    const fillMatricesAndSpawn = () => {
      const shape = currentShapeRef.current;
      const grid = gridRef.current;

      // Lock current shape into grid
      for (let i = 0; i < shape.height; i++) {
        for (let j = 0; j < shape.width; j++) {
          if (shape.shape[i][j]) {
            const targetY = shape.yCor + i;
            const targetX = shape.xCor + j;
            if (targetY >= 0 && targetY < rows && targetX >= 0 && targetX < cols) {
              grid[targetY][targetX] = {
                fill: true,
                color: shape.color,
              };
            }
          }
        }
      }

      // Check full rows (clearRow from tetris.py)
      let clearedRows = 0;
      for (let r = 0; r < rows; r++) {
        let isFull = true;
        for (let c = 0; c < cols; c++) {
          if (!grid[r][c].fill) {
            isFull = false;
            break;
          }
        }
        if (isFull) {
          clearedRows++;
          // Shift rows above down
          for (let shift = r; shift > 0; shift--) {
            grid[shift] = grid[shift - 1].map((cell) => ({ ...cell }));
          }
          grid[0] = Array.from({ length: cols }, () => ({
            fill: false,
            color: '#00fa00',
          }));
        }
      }

      if (clearedRows > 0) {
        sounds.playLineClear(clearedRows);
        const points = [0, 100, 300, 500, 800][clearedRows] || clearedRows * 200;
        setScore((prevScore) => {
          const nextScore = prevScore + points * level;
          setHighScore((prevHigh) => {
            const maxVal = Math.max(prevHigh, nextScore);
            localStorage.setItem('block_tetris_highscore', maxVal.toString());
            return maxVal;
          });
          return nextScore;
        });
        setLines((prev) => {
          const newLines = prev + clearedRows;
          const newLevel = Math.floor(newLines / 10) + 1;
          setLevel(newLevel);
          return newLines;
        });
      } else {
        sounds.playDrop();
      }

      // Spawn next shape
      currentShapeRef.current = nextShapeRef.current;
      nextShapeRef.current = getRandomShape(cols);

      // Check if new spawned shape collides immediately -> Game Over
      if (!checkBottom(currentShapeRef.current, grid, rows) && currentShapeRef.current.yCor === 0) {
        setGameOver(true);
        gameOverRef.current = true;
        sounds.playGameOver();
      }

      // Reset clock
      if (!isDownPressedRef.current) {
        clockTimeRef.current = Math.max(0.04, 0.25 - (level - 1) * 0.02);
      }
    };

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const blockW = canvas.width / cols;
      const blockH = canvas.height / rows;

      // 1. Draw Background (rgb(0, 0, 0))
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const grid = gridRef.current;
      const current = currentShapeRef.current;

      // 2. Draw locked blocks in grid
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = grid[r][c];
          if (cell.fill) {
            ctx.fillStyle = cell.color;
            ctx.fillRect(c * blockW, r * blockH, blockW, blockH);

            // Subtle 3D highlight/shadow for classic block feel
            ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
            ctx.fillRect(c * blockW, r * blockH, blockW, 2);
            ctx.fillRect(c * blockW, r * blockH, 2, blockH);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
            ctx.fillRect(c * blockW, (r + 1) * blockH - 2, blockW, 2);
            ctx.fillRect((c + 1) * blockW - 2, r * blockH, 2, blockH);
          }
        }
      }

      // 3. Draw Ghost Shape (Shadow)
      if (showGhost && !gameOverRef.current) {
        const ghostY = getGhostY(current, grid, rows);
        if (ghostY !== current.yCor) {
          ctx.strokeStyle = current.color;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          for (let i = 0; i < current.height; i++) {
            for (let j = 0; j < current.width; j++) {
              if (current.shape[i][j]) {
                const px = (current.xCor + j) * blockW;
                const py = (ghostY + i) * blockH;
                ctx.strokeRect(px + 1, py + 1, blockW - 2, blockH - 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.fillRect(px + 1, py + 1, blockW - 2, blockH - 2);
              }
            }
          }
          ctx.setLineDash([]);
        }
      }

      // 4. Draw Active Shape
      if (!gameOverRef.current) {
        for (let i = 0; i < current.height; i++) {
          for (let j = 0; j < current.width; j++) {
            if (current.shape[i][j]) {
              const px = (current.xCor + j) * blockW;
              const py = (current.yCor + i) * blockH;

              ctx.fillStyle = current.color;
              ctx.fillRect(px, py, blockW, blockH);

              // 3D block bevels
              ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
              ctx.fillRect(px, py, blockW, 2);
              ctx.fillRect(px, py, 2, blockH);
              ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
              ctx.fillRect(px, py + blockH - 2, blockW, 2);
              ctx.fillRect(px + blockW - 2, py, 2, blockH);
            }
          }
        }
      }

      // 5. Draw Grid Lines (17, 17, 18) matching Python tetris.py line drawing
      ctx.strokeStyle = 'rgb(17, 17, 18)';
      ctx.lineWidth = 1;

      // Horizontal lines
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        ctx.moveTo(0, Math.floor(r * blockH) + 0.5);
        ctx.lineTo(canvas.width, Math.floor(r * blockH) + 0.5);
        ctx.stroke();
      }

      // Vertical lines
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        ctx.moveTo(Math.floor(c * blockW) + 0.5, 0);
        ctx.lineTo(Math.floor(c * blockW) + 0.5, canvas.height);
        ctx.stroke();
      }

      // Pause or Game Over overlay
      if (isPausedRef.current && !gameOverRef.current) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
      } else if (gameOverRef.current) {
        ctx.fillStyle = 'rgba(15, 0, 0, 0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#eb344c';
        ctx.font = 'bold 18px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 20);

        ctx.fillStyle = '#e5e7eb';
        ctx.font = '11px "Press Start 2P", monospace';
        ctx.fillText(`SCORE: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
      }
    };

    const loop = (currentTime: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = currentTime;
      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      if (!isPausedRef.current && !gameOverRef.current) {
        accumulatedTimeRef.current += deltaTime;

        if (accumulatedTimeRef.current >= clockTimeRef.current) {
          const current = currentShapeRef.current;
          if (checkBottom(current, gridRef.current, rows)) {
            current.yCor += 1;
            if (isDownPressedRef.current) {
              setScore((s) => s + 1);
            }
          } else {
            fillMatricesAndSpawn();
          }
          accumulatedTimeRef.current = 0;
        }
      }

      render();
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [rows, cols, level, showGhost, score]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-3 sm:p-6 selection:bg-cyan-500 selection:text-black">
      {/* Top Header Bar */}
      <header className="w-full max-w-4xl flex items-center justify-between py-2 px-3 border-b border-neutral-800/80 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-400 to-emerald-500 p-0.5 shadow-md flex items-center justify-center">
            <div className="grid grid-cols-2 gap-0.5 w-6 h-6">
              <span className="bg-neutral-950 rounded-[1px]"></span>
              <span className="bg-cyan-300 rounded-[1px]"></span>
              <span className="bg-emerald-400 rounded-[1px]"></span>
              <span className="bg-neutral-950 rounded-[1px]"></span>
            </div>
          </div>
          <div>
            <h1 className="font-arcade text-base sm:text-lg tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-300 to-yellow-300">
              BLOCK TETRIS
            </h1>
            <p className="text-[11px] text-neutral-400">
              Migrated from Python/Pygame (MukulBarai/Block-Tetris)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Preset switch */}
          <div className="hidden sm:flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-1 text-xs">
            <button
              onClick={() => handlePresetChange('original')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                boardPreset === 'original'
                  ? 'bg-neutral-800 text-cyan-300 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="20 cols x 40 rows matching original tetris.py"
            >
              20×40 (Original)
            </button>
            <button
              onClick={() => handlePresetChange('standard')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                boardPreset === 'standard'
                  ? 'bg-neutral-800 text-cyan-300 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
              title="Classic standard 10 cols x 20 rows"
            >
              10×20 (Standard)
            </button>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 transition"
            title={soundEnabled ? 'Mute Sounds (M)' : 'Enable Sounds (M)'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-neutral-500" />}
          </button>

          <button
            onClick={() => setShowInfoModal(true)}
            className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 transition"
            title="Controls & About"
          >
            <Info className="w-4 h-4 text-cyan-400" />
          </button>
        </div>
      </header>

      {/* Main Game Stage */}
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 sm:gap-6 items-start justify-center">
        {/* Left Side: Score & Stats Panel */}
        <div className="flex flex-col gap-3 order-2 md:order-1">
          {/* Stats Card */}
          <div className="bg-neutral-900/90 border border-neutral-800/80 rounded-xl p-4 shadow-xl backdrop-blur-sm">
            <h2 className="font-arcade text-xs text-neutral-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" /> Game Stats
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-1 gap-2.5">
              <div className="bg-neutral-950/80 border border-neutral-800 p-2.5 rounded-lg">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-arcade">SCORE</span>
                <span className="font-arcade text-lg sm:text-xl text-yellow-400 font-bold">{score}</span>
              </div>

              <div className="bg-neutral-950/80 border border-neutral-800 p-2.5 rounded-lg">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-arcade flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-amber-500 inline" /> HIGH
                </span>
                <span className="font-arcade text-lg sm:text-xl text-amber-400 font-bold">{highScore}</span>
              </div>

              <div className="bg-neutral-950/80 border border-neutral-800 p-2.5 rounded-lg">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-arcade">LINES</span>
                <span className="font-arcade text-base sm:text-lg text-cyan-300 font-bold">{lines}</span>
              </div>

              <div className="bg-neutral-950/80 border border-neutral-800 p-2.5 rounded-lg">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block font-arcade">LEVEL</span>
                <span className="font-arcade text-base sm:text-lg text-emerald-400 font-bold">{level}</span>
              </div>
            </div>
          </div>

          {/* Quick Controls Card */}
          <div className="hidden md:block bg-neutral-900/70 border border-neutral-800/80 rounded-xl p-4 shadow-xl">
            <h3 className="font-arcade text-[10px] text-neutral-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-cyan-400" /> Keyboard
            </h3>
            <div className="text-xs space-y-1.5 text-neutral-300">
              <div className="flex justify-between items-center py-0.5 border-b border-neutral-800/50">
                <span className="text-neutral-400">Move Left / Right</span>
                <span className="font-mono text-[11px] bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-200">← → / A D</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-neutral-800/50">
                <span className="text-neutral-400">Rotate</span>
                <span className="font-mono text-[11px] bg-neutral-800 px-1.5 py-0.5 rounded text-cyan-300">↑ / W / X</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-neutral-800/50">
                <span className="text-neutral-400">Soft Drop</span>
                <span className="font-mono text-[11px] bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-200">↓ / S</span>
              </div>
              <div className="flex justify-between items-center py-0.5 border-b border-neutral-800/50">
                <span className="text-neutral-400">Hard Drop</span>
                <span className="font-mono text-[11px] bg-neutral-800 px-1.5 py-0.5 rounded text-yellow-300">SPACE</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-neutral-400">Pause / Mute</span>
                <span className="font-mono text-[11px] bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-200">P / M</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Arcade Canvas Display */}
        <div className="flex flex-col items-center order-1 md:order-2">
          {/* Arcade Cabinet Screen Frame */}
          <div className="relative p-2.5 sm:p-3.5 bg-gradient-to-b from-neutral-800 via-neutral-900 to-neutral-950 rounded-2xl border-2 border-neutral-700/80 shadow-[0_0_50px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.15)] flex flex-col items-center">
            {/* Retro Bezel Label */}
            <div className="w-full flex justify-between items-center pb-2 px-1 text-[10px] font-arcade text-neutral-400">
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                ACTIVE
              </span>
              <span className="text-neutral-500">{cols}×{rows} MATRIX</span>
            </div>

            {/* Canvas */}
            <div className="relative rounded-lg overflow-hidden border border-neutral-800 bg-black shadow-inner">
              <canvas
                ref={canvasRef}
                width={boardPreset === 'original' ? 300 : 250}
                height={boardPreset === 'original' ? 600 : 500}
                className="block max-h-[68vh] w-auto aspect-[1/2] object-contain"
              />
              <div className="absolute inset-0 pointer-events-none scanlines opacity-40"></div>
            </div>

            {/* Bottom Status / Buttons under screen */}
            <div className="w-full flex items-center justify-between mt-3 pt-1 border-t border-neutral-800/60">
              <button
                onClick={() => setIsPaused(!isPaused)}
                disabled={gameOver}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 disabled:opacity-50 transition"
              >
                {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-yellow-400" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>

              <button
                onClick={() => resetGame()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                Restart
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Next Piece & Settings Panel */}
        <div className="flex flex-col gap-3 order-3">
          {/* Next Piece Card */}
          <div className="bg-neutral-900/90 border border-neutral-800/80 rounded-xl p-4 shadow-xl backdrop-blur-sm">
            <h2 className="font-arcade text-xs text-neutral-400 uppercase tracking-widest mb-3">
              NEXT PIECE
            </h2>
            <div className="bg-neutral-950/80 border border-neutral-800 rounded-lg h-28 flex items-center justify-center p-3 relative overflow-hidden">
              <div className="grid gap-1" style={{
                gridTemplateColumns: `repeat(${nextShapeRef.current.width}, minmax(0, 1fr))`,
              }}>
                {nextShapeRef.current.shape.map((row, rIdx) =>
                  row.map((val, cIdx) => (
                    <div
                      key={`${rIdx}-${cIdx}`}
                      className="w-5 h-5 rounded-[2px]"
                      style={{
                        backgroundColor: val ? nextShapeRef.current.color : 'transparent',
                        boxShadow: val ? 'inset 0 0 0 1px rgba(255,255,255,0.2)' : 'none',
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Options Card */}
          <div className="bg-neutral-900/70 border border-neutral-800/80 rounded-xl p-4 shadow-xl">
            <h3 className="font-arcade text-[10px] text-neutral-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Options
            </h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer">
                <span>Ghost Drop Shadow</span>
                <input
                  type="checkbox"
                  checked={showGhost}
                  onChange={(e) => setShowGhost(e.target.checked)}
                  className="rounded bg-neutral-800 border-neutral-700 text-cyan-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-neutral-300 cursor-pointer">
                <span>Sound FX</span>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="rounded bg-neutral-800 border-neutral-700 text-cyan-500 focus:ring-0"
                />
              </label>

              {/* Mobile Presets switcher */}
              <div className="sm:hidden pt-2 border-t border-neutral-800">
                <span className="text-[11px] text-neutral-400 block mb-1.5 font-arcade">GRID SIZE</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handlePresetChange('original')}
                    className={`py-1.5 px-2 rounded text-[11px] font-medium border ${
                      boardPreset === 'original'
                        ? 'bg-neutral-800 border-cyan-500/50 text-cyan-300'
                        : 'border-neutral-800 text-neutral-400'
                    }`}
                  >
                    20×40 (Original)
                  </button>
                  <button
                    onClick={() => handlePresetChange('standard')}
                    className={`py-1.5 px-2 rounded text-[11px] font-medium border ${
                      boardPreset === 'standard'
                        ? 'bg-neutral-800 border-cyan-500/50 text-cyan-300'
                        : 'border-neutral-800 text-neutral-400'
                    }`}
                  >
                    10×20 (Standard)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Touch / Mobile D-Pad Controls for touchscreens */}
      <div className="w-full max-w-sm mt-4 p-2 bg-neutral-900/60 border border-neutral-800 rounded-xl md:hidden flex flex-col items-center gap-2">
        <div className="text-[10px] font-arcade text-neutral-400 uppercase tracking-widest">
          Touch Controls
        </div>
        <div className="flex items-center gap-3">
          <button
            onPointerDown={handleMoveLeft}
            className="w-12 h-12 rounded-xl bg-neutral-800 active:bg-neutral-700 flex items-center justify-center text-neutral-200 border border-neutral-700 active:scale-95 transition"
            title="Left"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex flex-col gap-2">
            <button
              onPointerDown={handleRotate}
              className="w-12 h-12 rounded-xl bg-neutral-800 active:bg-neutral-700 flex items-center justify-center text-cyan-300 border border-neutral-700 active:scale-95 transition"
              title="Rotate"
            >
              <RotateCw className="w-6 h-6" />
            </button>
            <button
              onPointerDown={() => {
                isDownPressedRef.current = true;
                clockTimeRef.current = 0.025;
              }}
              onPointerUp={() => {
                isDownPressedRef.current = false;
                clockTimeRef.current = Math.max(0.04, 0.25 - (level - 1) * 0.02);
              }}
              className="w-12 h-12 rounded-xl bg-neutral-800 active:bg-neutral-700 flex items-center justify-center text-neutral-200 border border-neutral-700 active:scale-95 transition"
              title="Soft Drop"
            >
              <ArrowDown className="w-6 h-6" />
            </button>
          </div>
          <button
            onPointerDown={handleMoveRight}
            className="w-12 h-12 rounded-xl bg-neutral-800 active:bg-neutral-700 flex items-center justify-center text-neutral-200 border border-neutral-700 active:scale-95 transition"
            title="Right"
          >
            <ArrowRight className="w-6 h-6" />
          </button>
          <button
            onPointerDown={handleHardDrop}
            className="w-12 h-12 rounded-xl bg-yellow-500/20 active:bg-yellow-500/30 flex items-center justify-center text-yellow-300 border border-yellow-500/40 active:scale-95 transition ml-2"
            title="Hard Drop"
          >
            <Zap className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Info / About Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="font-arcade text-sm text-cyan-400 mb-2">
              ABOUT BLOCK TETRIS
            </h3>
            <p className="text-xs text-neutral-300 leading-relaxed mb-4">
              Successfully migrated to a full web app from GitHub repository{' '}
              <span className="font-mono text-cyan-300">MukulBarai/Block-Tetris</span>.
            </p>

            <div className="space-y-3 mb-5 text-xs text-neutral-400">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Original piece geometry and 7 tetromino classes (O, Z, S, I, L, F, T) with original RGB palette.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Original 20×40 matrix dimension preserved with 10×20 standard mode switch.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Original drop timing algorithm (0.25s default, 0.025s soft-drop).</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Added Web Audio synthesized retro sound FX, ghost piece shadow, and mobile touch controls.</span>
              </div>
            </div>

            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-arcade rounded-xl transition"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
