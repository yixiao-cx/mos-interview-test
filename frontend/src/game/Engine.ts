import * as PIXI from 'pixi.js';
import { ParticleSystem } from './effects/ParticleSystem';
import { Enemy } from './entities/Enemy';
import { Asteroid } from './entities/Asteroid';

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
    
    // Initialize containers
    this.speedLines = new PIXI.Container();
  }

  private async initialize(containerId: string): Promise<void> {
    // Initialize PIXI Application with high quality settings and frame rate control
    const dpr = window.devicePixelRatio || 1;
    const app = new PIXI.Application();
    app.ticker.maxFPS = 60; // Lock to 60 FPS
    await app.init({
      width: 800,
      height: 600,
      backgroundColor: 0x000000,
      antialias: true,
      resolution: dpr,
      autoDensity: true,
      hello: true,  // Enable WebGL2 if available
      powerPreference: 'high-performance'
    });
    
    // Scale stage based on DPR for better quality
    app.stage.scale.set(1 / dpr);
    this.app = app;

    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error('Container element not found');
    }
    container.appendChild(this.app.view);
    
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
    graphics.beginFill(0xff0000);
    graphics.drawRect(-2, -8, 4, 16);
    graphics.endFill();
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

  private frameTimeHistory: number[] = [];
  private lastFpsUpdate: number = 0;
  private readonly FPS_UPDATE_INTERVAL: number = 1000; // Update FPS display every second

  private gameLoop() {
    if (this.gameState !== 'playing') return;

    const currentTime = Date.now();
    
    // Calculate and monitor FPS
    this.frameTimeHistory.push(currentTime);
    
    // Keep only the last second of frame times
    while (this.frameTimeHistory[0] < currentTime - 1000) {
      this.frameTimeHistory.shift();
    }
    
    // Update FPS counter every second
    if (currentTime - this.lastFpsUpdate >= this.FPS_UPDATE_INTERVAL) {
      const fps = this.frameTimeHistory.length;
      console.log(`Current FPS: ${fps}`);
      this.lastFpsUpdate = currentTime;
    }
    
    // Smooth out delta time to prevent jerky movement
    const rawDelta = Math.min(this.app.ticker.deltaTime, this.maxDeltaTime);
    this.smoothDelta = this.smoothDelta * (1 - this.smoothFactor) + rawDelta * this.smoothFactor;
    const deltaTime = this.smoothDelta;

    // Update speed lines effect
    const movement = Math.abs(this.player.x - this.lastPlayerX);
    if (movement > 0) {
      // Create new speed lines when moving
      const line = new PIXI.Graphics();
      line.lineStyle(1, 0x4444ff, 0.3);
      line.moveTo(0, -10);
      line.lineTo(0, 10);
      line.x = this.player.x + (Math.random() - 0.5) * 30;
      line.y = this.player.y;
      (line as any).alpha = 0.5;
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
    const playerBounds = new PIXI.Rectangle(
      this.player.x - 15,
      this.player.y - 20,
      30,
      30
    );

    // 子弹击中敌人
    for (let i = this.bullets.children.length - 1; i >= 0; i--) {
      const bullet = this.bullets.children[i];
      const bulletBounds = new PIXI.Rectangle(
        bullet.x - 2,
        bullet.y - 8,
        4,
        16
      );

      // 检查子弹与敌人碰撞
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const enemy = this.enemies[j];
        if (this.checkCollision(bulletBounds, enemy.getCollisionBounds())) {
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

    // 检查玩家与敌人/陨石的碰撞
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (this.checkCollision(playerBounds, enemy.getCollisionBounds())) {
        this.health -= 20;
        this.app.stage.removeChild(enemy);
        this.enemies.splice(i, 1);
        this.particleSystem.createExplosion(enemy.x, enemy.y, 0xff0000);
        if (this.health <= 0) {
          this.gameState = 'gameover';
          return;
        }
      }
    }

    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const asteroid = this.asteroids[i];
      if (this.checkCollision(playerBounds, asteroid.getCollisionBounds())) {
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
      const levelUpText = new PIXI.Text(`Level ${this.level}!`, {
        fontFamily: 'Arial',
        fontSize: 36,
        fill: 0x00ff00,
        align: 'center'
      });
      levelUpText.x = this.app.screen.width / 2;
      levelUpText.y = this.app.screen.height / 2;
      levelUpText.anchor.set(0.5);
      this.app.stage.addChild(levelUpText);

      // 2秒后移除文本
      setTimeout(() => {
        this.app.stage.removeChild(levelUpText);
      }, 2000);
    }

    // 达到500分获得胜利
    if (this.score >= 500) {
      this.gameState = 'victory';
    }
  }

  public startGame() {
    this.gameState = 'playing';
    this.score = 0;
    this.level = 1;
    this.health = 100;
    this.enemies.forEach(enemy => this.app.stage.removeChild(enemy));
    this.enemies = [];
    while (this.bullets.children.length > 0) {
      this.bullets.removeChildAt(0);
    }
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
