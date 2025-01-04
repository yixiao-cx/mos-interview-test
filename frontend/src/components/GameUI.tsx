import React, { useEffect, useState } from 'react';
import { GameEngine } from '../game/Engine';

interface GameState {
  score: number;
  level: number;
  health: number;
  state: 'start' | 'playing' | 'gameover' | 'victory';
}

export const GameUI: React.FC = () => {
  const [gameEngine, setGameEngine] = useState<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    level: 1,
    health: 100,
    state: 'start'
  });

  useEffect(() => {
    let updateInterval: NodeJS.Timeout;
    
    const initGame = async () => {
      try {
        const engine = await GameEngine.create('game-container');
        setGameEngine(engine);

        updateInterval = setInterval(() => {
          if (engine) {
            setGameState(engine.getGameState());
          }
        }, 1000 / 60);
      } catch (error) {
        console.error('Failed to initialize game:', error);
      }
    };

    initGame();

    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
  }, []);

  const startGame = () => {
    if (gameEngine) {
      gameEngine.startGame();
    }
  };

  return (
    <div className="relative w-full h-screen bg-gray-900 text-white">
      <div id="game-container" className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        {/* 游戏画布将在这里渲染 */}
      </div>

      {/* 开始界面 */}
      {gameState.state === 'start' && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
          <h1 className="text-4xl font-bold mb-8">太空战机</h1>
          <div className="mb-8 text-left">
            <h2 className="text-xl font-bold mb-4">游戏规则：</h2>
            <ul className="space-y-2">
              <li>← → 方向键控制飞船移动</li>
              <li>空格键发射导弹</li>
              <li>击中敌人得10分</li>
              <li>每100分升一级</li>
              <li>达到500分获得胜利</li>
            </ul>
          </div>
          <button
            onClick={startGame}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold"
          >
            开始游戏
          </button>
        </div>
      )}

      {/* 游戏界面 */}
      {gameState.state === 'playing' && (
        <div className="absolute top-4 left-4 space-y-2">
          <div className="text-xl">得分: {gameState.score}</div>
          <div className="text-xl">等级: {gameState.level}</div>
          <div id="fps" className="text-sm opacity-50">FPS: --</div>
          <div className="w-48 h-4 bg-gray-700 rounded">
            <div
              className="h-full bg-red-600 rounded"
              style={{ width: `${gameState.health}%` }}
            />
          </div>
        </div>
      )}

      {/* 游戏结束界面 */}
      {gameState.state === 'gameover' && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
          <h2 className="text-4xl font-bold mb-8">游戏结束</h2>
          <p className="text-2xl mb-8">最终得分: {gameState.score}</p>
          <button
            onClick={startGame}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold"
          >
            再试一次
          </button>
        </div>
      )}

      {/* 胜利界面 */}
      {gameState.state === 'victory' && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
          <h2 className="text-4xl font-bold mb-8">胜利！</h2>
          <p className="text-2xl mb-8">恭喜你达到 {gameState.score} 分！</p>
          <button
            onClick={startGame}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold"
          >
            再来一局
          </button>
        </div>
      )}
    </div>
  );
};
