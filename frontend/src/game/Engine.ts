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
  }

  private async initialize(containerId: string): Promise<void> {
    // Initialize PIXI Application
    const app = new PIXI.Application();
    await app.init({
      width: 800,
      height: 600,
      backgroundColor: 0x000000,
      antialias: true,
      hello: true  // Enable WebGL2 if available
    });
    this.app = app;

    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error('Container element not found');
    }
    container.appendChild(this.app.view);
    
    // Initialize player ship with visual effects
    const player = new PIXI.Container();
    const ship = new PIXI.Graphics();
    ship.beginFill(0x00ff00);
    ship.moveTo(0, -20);
    ship.lineTo(15, 20);
    ship.lineTo(-15, 20);
    ship.closePath();
    ship.endFill();
    
    // Add engine flame effect
    const engineFlame = new PIXI.Graphics();
    engineFlame.beginFill(0xff3300);
    engineFlame.moveTo(-5, 20);
    engineFlame.lineTo(5, 20);
    engineFlame.lineTo(0, 30);
    engineFlame.closePath();
    engineFlame.endFill();
    
    // Add glow effect
    const glow = new PIXI.Graphics();
    glow.beginFill(0x00ff00, 0.2);
    glow.drawCircle(0, 0, 30);
    glow.endFill();
    
    player.addChild(glow);
    player.addChild(ship);
    player.addChild(engineFlame);
    
    player.x = this.app.screen.width / 2;
    player.y = this.app.screen.height - 50;
    
    this.app.stage.addChild(player);
    this.player = player;
    
    // Initialize game objects
    this.initializeGame();
  }

  private initializeGame(): void {
    this.player = new PIXI.Container();
    this.bullets = new PIXI.Container();
    this.particleSystem = new ParticleSystem(this.app);

    // 创建玩家飞船
    const playerGraphics = new PIXI.Graphics();
    playerGraphics.beginFill(0x3498db);
    playerGraphics.lineStyle(2, 0x2980b9);
    playerGraphics.moveTo(0, -20);
    playerGraphics.lineTo(-15, 10);
    playerGraphics.lineTo(15, 10);
    playerGraphics.lineTo(0, -20);
    playerGraphics.endFill();

    const playerSprite = new PIXI.Sprite(this.app.renderer.generateTexture(playerGraphics));
    playerSprite.anchor.set(0.5);
    this.player.addChild(playerSprite);

    // 添加引擎尾焰
    const engineFlame = this.particleSystem.createEngineFlame(0, 15);
    this.player.addChild(engineFlame);

    // 设置玩家位置
    this.player.x = this.app.screen.width / 2;
    this.player.y = this.app.screen.height - 60;

    // 添加到舞台
    this.app.stage.addChild(this.bullets);
    this.app.stage.addChild(this.player);

    // 设置游戏循环
    this.app.ticker.add(() => this.gameLoop());

    // 设置键盘事件监听
    window.addEventListener('keydown', (e) => this.handleKeyPress(e));
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
    
    // 创建导弹图形
    const missileGraphics = new PIXI.Graphics();
    missileGraphics.beginFill(0xf1c40f);
    missileGraphics.drawRect(-2, -8, 4, 16);
    missileGraphics.endFill();
    bullet.addChild(missileGraphics);

    // 添加导弹尾焰
    const missileFlame = this.particleSystem.createEngineFlame(0, 4);
    bullet.addChild(missileFlame);

    bullet.x = x;
    bullet.y = this.player.y - 20;
    this.bullets.addChild(bullet);
  }

  private gameLoop() {
    if (this.gameState !== 'playing') return;

    const currentTime = Date.now();
    const deltaTime = this.app.ticker.deltaTime;

    // Object pools for better performance
    const bulletPool: PIXI.Container[] = [];
    const enemyPool: Enemy[] = [];
    const asteroidPool: Asteroid[] = [];

    // 更新子弹位置
    for (let i = this.bullets.children.length - 1; i >= 0; i--) {
      const bullet = this.bullets.children[i];
      bullet.y -= 7 * deltaTime;
      if (bullet.y < -20) {
        bulletPool.push(this.bullets.removeChild(bullet));
      }
    }

    // 更新敌人
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      const bulletPosition = enemy.update(currentTime);
      
      // 敌人射击
      if (bulletPosition && enemy.canShoot) {
        let bullet: PIXI.Container;
        if (bulletPool.length > 0) {
          const pooledBullet = bulletPool.pop();
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
        enemyPool.push(enemy);
        this.app.stage.removeChild(enemy);
        this.enemies.splice(i, 1);
      }
    }

    // 更新陨石
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const asteroid = this.asteroids[i];
      asteroid.update();
      if (asteroid.y > this.app.screen.height + 50) {
        asteroidPool.push(asteroid);
        this.app.stage.removeChild(asteroid);
        this.asteroids.splice(i, 1);
      }
    }

    // 碰撞检测 - 使用四叉树优化
    this.checkCollisions();

    // 生成新敌人 - 使用对象池
    if (currentTime - this.lastEnemySpawnTime >= this.enemySpawnInterval) {
      if (enemyPool.length > 0) {
        const enemy = enemyPool.pop()!;
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
      if (asteroidPool.length > 0) {
        const asteroid = asteroidPool.pop()!;
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
