import * as PIXI from 'pixi.js';
import { ParticleSystem } from './effects/ParticleSystem';
import { Enemy } from './entities/Enemy.js';
import { Asteroid } from './entities/Asteroid.js';

export interface GameState {
  score: number;
  level: number;
  health: number;
  state: 'start' | 'playing' | 'gameover' | 'victory';
}

export class GameEngine {
  private app!: PIXI.Application;
  private player!: PIXI.Container;
  private enemies: Enemy[] = [];
  private bullets!: PIXI.Container;
  private asteroids: Asteroid[] = [];
  private particleSystem!: ParticleSystem;
  private shipTexture!: PIXI.Texture;
  private missileTexture!: PIXI.Texture;
  
  // Object pools for better performance
  private bulletPool: PIXI.Container[] = [];
  private enemyPool: Enemy[] = [];
  private asteroidPool: Asteroid[] = [];
  
  // Frame timing for stable 60 FPS
  private smoothDelta: number = 1;
  private readonly smoothFactor: number = 0.1;
  private readonly maxDeltaTime: number = 2; // Cap at 2x normal speed
  
  // Speed lines effect
  private speedLines!: PIXI.Container;
  private lastPlayerX: number = 0;
  private readonly speedLineCount: number = 8;
  private speedLinePool: PIXI.Graphics[] = [];
  private levelUpTextPool: PIXI.Text[] = [];
  private cachedPlayerBounds: PIXI.Rectangle;
  private cachedBulletBounds: PIXI.Rectangle;
  
  private score: number = 0;
  private level: number = 1;
  private health: number = 100;
  private gameState: 'start' | 'playing' | 'gameover' | 'victory' = 'start';
  
  private doubleMissileUnlocked: boolean = false;
  private lastBulletTime: number = 0;
  private bulletCooldown: number = 250;
  private enemySpawnInterval: number = 2000;
  private lastEnemySpawnTime: number = 0;
  private asteroidSpawnInterval: number = 3000;
  private lastAsteroidSpawnTime: number = 0;
  static async create(containerId: string): Promise<GameEngine> {
    const engine = new GameEngine();
    await engine.initialize(containerId);
    return engine;
  }

  private constructor() {
    // Initialize default values
    this.enemies = [];
    this.score = 0;
    this.level = 1;
    this.health = 100;
    this.gameState = 'start';
    this.doubleMissileUnlocked = false;
    this.lastBulletTime = 0;
    this.bulletCooldown = 250;
    this.enemySpawnInterval = 2000;
    this.lastEnemySpawnTime = 0;
    this.asteroidSpawnInterval = 3000;
    this.lastAsteroidSpawnTime = 0;
    
    // Initialize containers and cached bounds
    this.speedLines = new PIXI.Container();
    this.cachedPlayerBounds = new PIXI.Rectangle(0, 0, 30, 30);
    this.cachedBulletBounds = new PIXI.Rectangle(0, 0, 4, 16);
  }

  private async initialize(containerId: string): Promise<void> {
    // Initialize PIXI Application with high quality settings and frame rate control
    const dpr = window.devicePixelRatio || 1;
    this.app = new PIXI.Application();
    
    // Initialize with WebGL2 settings
    await this.app.init({
      width: 800,
      height: 600,
      backgroundColor: 0x000000,
      antialias: true,
      resolution: dpr,
      autoDensity: true,
      hello: true,  // Enable WebGL2 if available
      powerPreference: 'high-performance'
    });

    // Set FPS limit after initialization
    this.app.ticker.maxFPS = 60; // Lock to 60 FPS
    
    // Scale stage based on DPR for better quality
    this.app.stage.scale.set(1 / dpr);

    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error('Container element not found');
    }
    
    // Ensure the view is properly created and added to the container
    if (this.app.view instanceof HTMLCanvasElement) {
      container.appendChild(this.app.view);
    } else {
      throw new Error('Failed to create canvas element');
    }
    
    // Initialize particle system first
    this.particleSystem = new ParticleSystem(this.app);
    
    // Preload all SVG assets
    await PIXI.Assets.load([
      '/assets/spaceship.svg',
      '/assets/missile.svg',
      '/assets/ufo.svg',
      '/assets/asteroid.svg'
    ]);
    
    // Get textures from cache
    this.shipTexture = PIXI.Texture.from('/assets/spaceship.svg');
    this.missileTexture = PIXI.Texture.from('/assets/missile.svg');
    
    // Initialize player ship with SVG
    const player = new PIXI.Container();
    const ship = new PIXI.Sprite(this.shipTexture);
    ship.anchor.set(0.5);
    ship.width = 48;
    ship.height = 48;
    
    // Add glow effect
    const glow = new PIXI.Graphics();
    glow.fill({ color: 0x00ff00, alpha: 0.2 }); // Updated to new PIXI.js syntax
    glow.circle(0, 0, 30);
    
    player.addChild(glow);
    player.addChild(ship);
    
    // Add engine flame effect using particle system
    const engineFlame = this.particleSystem.createEngineFlame(0, 20);
    player.addChild(engineFlame);
    
    player.x = this.app.screen.width / 2;
    player.y = this.app.screen.height - 50;
    
    this.app.stage.addChild(player);
    this.player = player;
    
    // Initialize bullets container
    this.bullets = new PIXI.Container();
    this.app.stage.addChild(this.bullets);
    
    // Initialize speed lines container
    this.speedLines = new PIXI.Container();
    this.app.stage.addChild(this.speedLines);
    this.lastPlayerX = this.player.x;
    
    // Set up game loop and keyboard events
    this.app.ticker.add(() => this.gameLoop());
    window.addEventListener('keydown', (e) => this.handleKeyPress(e));
  }

  private initializeGame(): void {
    // Reset game state
    this.score = 0;
    this.level = 1;
    this.health = 100;
    this.gameState = 'playing';
    this.doubleMissileUnlocked = false;
    this.lastBulletTime = 0;
    this.enemySpawnInterval = 2000;
    this.lastEnemySpawnTime = 0;
    this.asteroidSpawnInterval = 3000;
    this.lastAsteroidSpawnTime = 0;
    
    // Clear existing entities
    this.enemies.forEach(enemy => this.app.stage.removeChild(enemy));
    this.enemies = [];
    while (this.bullets.children.length > 0) {
      this.bullets.removeChildAt(0);
    }
  }

  private handleKeyPress(e: KeyboardEvent) {
    if (this.gameState !== 'playing') return;

    switch (e.key) {
      case 'ArrowLeft':
        if (this.player.x > 0) {
          this.player.x -= 5;
        }
        break;
      case 'ArrowRight':
        if (this.player.x < this.app.screen.width - this.player.width) {
          this.player.x += 5;
        }
        break;
      case ' ':
        this.fireBullet();
        break;
    }
  }

  private fireBullet() {
    const currentTime = Date.now();
    if (currentTime - this.lastBulletTime < this.bulletCooldown) return;
    
    this.lastBulletTime = currentTime;

    if (this.doubleMissileUnlocked) {
      // 发射双发导弹
      this.createBullet(this.player.x - 10);
      this.createBullet(this.player.x + 10);
    } else {
      // 发射单发导弹
      this.createBullet(this.player.x);
    }
  }

  private createEnemyBullet(x: number, y: number): PIXI.Container {
    const bullet = new PIXI.Container();
    const graphics = new PIXI.Graphics();
    graphics.fill({ color: 0xff0000 });
    graphics.rect(-2, -8, 4, 16);
    bullet.addChild(graphics);
    bullet.x = x;
    bullet.y = y;
    return bullet;
  }

  private createBullet(x: number) {
    const bullet = new PIXI.Container();
    
    // 使用预加载的导弹SVG
    const missileSprite = new PIXI.Sprite(this.missileTexture);
    missileSprite.anchor.set(0.5);
    missileSprite.width = 12;
    missileSprite.height = 24;
    bullet.addChild(missileSprite);

    // 添加导弹尾焰
    const missileFlame = this.particleSystem.createEngineFlame(0, 4);
    bullet.addChild(missileFlame);

    bullet.x = x;
    bullet.y = this.player.y - 20;
    this.bullets.addChild(bullet);
  }

  private fpsUpdateTime: number = 0;
  private frameCount: number = 0;
  private currentFps: number = 0;
  private readonly FPS_UPDATE_INTERVAL: number = 1000; // Update FPS display every second

  private gameLoop() {
    if (this.gameState !== 'playing') return;

    const currentTime = Date.now();
    
    // Calculate FPS using frame count
    this.frameCount++;
    if (currentTime - this.fpsUpdateTime >= this.FPS_UPDATE_INTERVAL) {
      this.currentFps = Math.round((this.frameCount * 1000) / (currentTime - this.fpsUpdateTime));
      console.log(`Current FPS: ${this.currentFps}`);
      this.frameCount = 0;
      this.fpsUpdateTime = currentTime;
    }
    
    // Smooth out delta time to prevent jerky movement
    const rawDelta = Math.min(this.app.ticker.deltaTime, this.maxDeltaTime);
    this.smoothDelta = this.smoothDelta * (1 - this.smoothFactor) + rawDelta * this.smoothFactor;
    const deltaTime = this.smoothDelta;

    // Update speed lines effect
    const movement = Math.abs(this.player.x - this.lastPlayerX);
    if (movement > 0) {
      // Create new speed lines when moving using object pool
      let line: PIXI.Graphics;
      if (this.speedLinePool.length > 0) {
        line = this.speedLinePool.pop()!;
      } else {
        line = new PIXI.Graphics();
        line.setStrokeStyle({ width: 1, color: 0x4444ff, alpha: 0.3 });
        line.moveTo(0, -10);
        line.lineTo(0, 10);
      }
      line.x = this.player.x + (Math.random() - 0.5) * 30;
      line.y = this.player.y;
      line.alpha = 0.5;
      (line as any).life = 1.0;
      this.speedLines.addChild(line);
    }
    
    // Update existing speed lines
    for (let i = this.speedLines.children.length - 1; i >= 0; i--) {
      const line = this.speedLines.children[i] as PIXI.Graphics;
      line.y += 5 * deltaTime;
      (line as any).life -= 0.02 * deltaTime;
      line.alpha = (line as any).life;
      
      if ((line as any).life <= 0) {
        this.speedLines.removeChild(line);
        this.speedLinePool.push(line);
      }
    }
    
    // Limit the number of speed lines
    while (this.speedLines.children.length > this.speedLineCount) {
      this.speedLines.removeChildAt(0);
    }
    
    this.lastPlayerX = this.player.x;

    // Use existing object pools for better performance

    // 更新子弹位置
    for (let i = this.bullets.children.length - 1; i >= 0; i--) {
      const bullet = this.bullets.children[i];
      bullet.y -= 7 * deltaTime;
      if (bullet.y < -20) {
        this.bulletPool.push(this.bullets.removeChild(bullet));
      }
    }

    // 更新敌人
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      const bulletPosition = enemy.update(currentTime);
      
      // 敌人射击
      if (bulletPosition && enemy.canShoot) {
        let bullet: PIXI.Container;
        if (this.bulletPool.length > 0) {
          const pooledBullet = this.bulletPool.pop();
          if (pooledBullet) {
            bullet = pooledBullet;
            bullet.x = bulletPosition.x;
            bullet.y = bulletPosition.y;
          } else {
            bullet = this.createEnemyBullet(bulletPosition.x, bulletPosition.y);
          }
        } else {
          bullet = this.createEnemyBullet(bulletPosition.x, bulletPosition.y);
        }
        this.bullets.addChild(bullet);
      }

      if (enemy.y > this.app.screen.height + 50) {
        this.enemyPool.push(enemy);
        this.app.stage.removeChild(enemy);
        this.enemies.splice(i, 1);
      }
    }

    // 更新陨石
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const asteroid = this.asteroids[i];
      asteroid.update();
      if (asteroid.y > this.app.screen.height + 50) {
        this.asteroidPool.push(asteroid);
        this.app.stage.removeChild(asteroid);
        this.asteroids.splice(i, 1);
      }
    }

    // 碰撞检测 - 使用四叉树优化
    this.checkCollisions();

    // 生成新敌人 - 使用对象池
    if (currentTime - this.lastEnemySpawnTime >= this.enemySpawnInterval) {
      if (this.enemyPool.length > 0) {
        const enemy = this.enemyPool.pop()!;
        enemy.reset();
        this.enemies.push(enemy);
      } else {
        this.generateEnemy();
      }
      this.lastEnemySpawnTime = currentTime;

      // 4级以上增加敌人密度
      if (this.level >= 4 && Math.random() < 0.5) {
        this.generateEnemy();
      }
    }

    // 生成新陨石 - 使用对象池
    if (currentTime - this.lastAsteroidSpawnTime >= this.asteroidSpawnInterval) {
      if (this.asteroidPool.length > 0) {
        const asteroid = this.asteroidPool.pop()!;
        asteroid.reset();
        this.asteroids.push(asteroid);
      } else {
        this.generateAsteroid();
      }
      this.lastAsteroidSpawnTime = currentTime;
    }
  }

  private generateEnemy() {
    const enemy = new Enemy(this.app, this.particleSystem, this.level);
    enemy.x = Math.random() * (this.app.screen.width - 40) + 20;
    enemy.y = -20;
    this.enemies.push(enemy);
    this.app.stage.addChild(enemy);
  }

  private generateAsteroid() {
    const asteroid = new Asteroid(this.app);
    asteroid.x = Math.random() * (this.app.screen.width - 40) + 20;
    asteroid.y = -20;
    this.asteroids.push(asteroid);
    this.app.stage.addChild(asteroid);
  }

  private checkCollisions() {
    // Update cached player bounds
    this.cachedPlayerBounds.x = this.player.x - 15;
    this.cachedPlayerBounds.y = this.player.y - 20;
    this.cachedPlayerBounds.width = 30;
    this.cachedPlayerBounds.height = 30;

    // Batch process collisions by spatial regions
    const regions: { [key: string]: Array<PIXI.Container> } = {};
    
    // Group objects by grid cells (simple spatial partitioning)
    const cellSize = 100; // Size of each grid cell
    
    // Helper function to get cell key
    const getCellKey = (x: number, y: number) => `${Math.floor(x/cellSize)},${Math.floor(y/cellSize)}`;
    
    // Group bullets by cells
    for (let i = this.bullets.children.length - 1; i >= 0; i--) {
      const bullet = this.bullets.children[i];
      const key = getCellKey(bullet.x, bullet.y);
      if (!regions[key]) regions[key] = [];
      regions[key].push(bullet);
    }

    // Check enemy collisions only in relevant cells
    for (let j = this.enemies.length - 1; j >= 0; j--) {
      const enemy = this.enemies[j];
      const key = getCellKey(enemy.x, enemy.y);
      
      if (regions[key]) {
        for (const bullet of regions[key]) {
          this.cachedBulletBounds.x = bullet.x - 2;
          this.cachedBulletBounds.y = bullet.y - 8;
          this.cachedBulletBounds.width = 4;
          this.cachedBulletBounds.height = 16;

          if (this.checkCollision(this.cachedBulletBounds, enemy.getCollisionBounds())) {
            this.bullets.removeChild(bullet);
            if (enemy.takeDamage(50)) {
              this.app.stage.removeChild(enemy);
              this.enemies.splice(j, 1);
              this.score += 10;
              this.checkLevelUp();
            }
            break;
          }
        }
      }

      // Check player collision
      if (this.checkCollision(this.cachedPlayerBounds, enemy.getCollisionBounds())) {
        this.health -= 20;
        this.app.stage.removeChild(enemy);
        this.enemies.splice(j, 1);
        this.particleSystem.createExplosion(enemy.x, enemy.y, 0xff0000);
        if (this.health <= 0) {
          this.gameState = 'gameover';
          return;
        }
      }
    }

    // Check asteroid collisions
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const asteroid = this.asteroids[i];
      if (this.checkCollision(this.cachedPlayerBounds, asteroid.getCollisionBounds())) {
        this.health -= 30;
        this.app.stage.removeChild(asteroid);
        this.asteroids.splice(i, 1);
        this.particleSystem.createExplosion(asteroid.x, asteroid.y, 0x808080);
        if (this.health <= 0) {
          this.gameState = 'gameover';
          return;
        }
      }
    }
  }

  private checkCollision(a: PIXI.Rectangle, b: PIXI.Rectangle): boolean {
    return a.x + a.width > b.x &&
           a.x < b.x + b.width &&
           a.y + a.height > b.y &&
           a.y < b.y + b.height;
  }

  private checkLevelUp() {
    const newLevel = Math.floor(this.score / 100) + 1;
    if (newLevel > this.level) {
      this.level = newLevel;
      
      // 每次升级增加敌人和陨石的速度
      this.enemySpawnInterval = Math.max(1000, 2000 - (this.level - 1) * 200);
      this.asteroidSpawnInterval = Math.max(1500, 3000 - (this.level - 1) * 300);

      // 3级解锁双发导弹
      if (this.level === 3) {
        this.doubleMissileUnlocked = true;
      }

      // 创建升级特效
      // Use text from pool or create new
      let levelUpText: PIXI.Text;
      if (this.levelUpTextPool.length > 0) {
        levelUpText = this.levelUpTextPool.pop()!;
        levelUpText.text = `Level ${this.level}!`;
      } else {
        levelUpText = new PIXI.Text(`Level ${this.level}!`, {
          fontFamily: 'Arial',
          fontSize: 36,
          fill: 0x00ff00,
          align: 'center'
        });
      }
      levelUpText.x = this.app.screen.width / 2;
      levelUpText.y = this.app.screen.height / 2;
      levelUpText.anchor.set(0.5);
      this.app.stage.addChild(levelUpText);
      
      // Use animation frame for smooth removal
      const startTime = performance.now();
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        if (elapsed >= 2000) {
          this.app.stage.removeChild(levelUpText);
          this.levelUpTextPool.push(levelUpText);
          return;
        }
        // Fade out effect
        if (elapsed > 1500) {
          levelUpText.alpha = 1 - (elapsed - 1500) / 500;
        }
        requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }

    // 达到500分获得胜利
    if (this.score >= 500) {
      this.gameState = 'victory';
    }
  }

  public startGame() {
    this.initializeGame();
  }

  public getGameState() {
    return {
      score: this.score,
      level: this.level,
      health: this.health,
      state: this.gameState
    };
  }
}
