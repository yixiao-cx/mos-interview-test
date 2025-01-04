import * as PIXI from 'pixi.js';
import { ParticleSystem } from '../effects/ParticleSystem';

export class Enemy extends PIXI.Container {
  private sprite!: PIXI.Sprite;
  private particleSystem: ParticleSystem;
  public velocity: { x: number; y: number } = { x: 0, y: 0 };
  public health: number = 100;
  public canShoot: boolean = false;
  private lastShotTime: number = 0;
  private shotCooldown: number = 2000; // 2秒冷却时间
  public radius: number = 20;

  private app: PIXI.Application;
  private level: number;

  constructor(app: PIXI.Application, particleSystem: ParticleSystem, level: number) {
    super();
    this.app = app;
    this.level = level;
    this.particleSystem = particleSystem;

    // 创建临时纹理，异步加载后更新
    const tempGraphics = new PIXI.Graphics();
    tempGraphics.fill({ color: 0x00ff00 });
    tempGraphics.circle(0, 0, 20);
    const tempTexture = app.renderer.generateTexture(tempGraphics);
    this.sprite = new PIXI.Sprite(tempTexture);
    
    // 加载高质量SVG
    this.sprite.texture = PIXI.Texture.from('./assets/ufo.svg');
    const dpr = window.devicePixelRatio || 1;
    this.sprite.width = 64 * dpr;
    this.sprite.height = 40 * dpr;
    this.sprite.anchor.set(0.5);
    this.addChild(this.sprite);

    // 根据等级设置属性
    this.setupLevelProperties(level);

    // 添加视觉效果
    this.addVisualEffects(app);

    // 设置移动模式
    this.setupMovementPattern(app);
  }

  private setupLevelProperties(level: number) {
    // 2级及以上解锁射击能力
    this.canShoot = level >= 2;

    // 根据等级调整速度
    const baseSpeed = 1;
    const speedMultiplier = 1 + (level - 1) * 0.2;
    const speed = baseSpeed * speedMultiplier;

    // 设置随机初始速度
    const angle = Math.random() * Math.PI * 0.5 + Math.PI * 0.25; // 45-135度范围
    this.velocity = {
      x: Math.cos(angle) * speed,
      y: Math.abs(Math.sin(angle) * speed)
    };
  }

  private addVisualEffects(app: PIXI.Application) {
    // 添加护盾效果
    const shield = new PIXI.Graphics();
    shield.fill({ color: 0x33ff33, alpha: 0.2 });
    shield.circle(0, 0, 25);
    this.addChild(shield);

    // 添加扫描光束效果
    const scanBeam = new PIXI.Graphics();
    scanBeam.fill({ color: 0x33ff33, alpha: 0.3 });
    scanBeam.moveTo(-5, 5);
    scanBeam.lineTo(5, 5);
    scanBeam.lineTo(0, 30);
    scanBeam.lineTo(-5, 5);
    scanBeam.alpha = 0;
    this.addChild(scanBeam);

    // 扫描光束动画
    const animate = () => {
      scanBeam.alpha = 0.3 + Math.sin(Date.now() / 500) * 0.2;
    };
    
    app.ticker.add(animate);
    
    this.on('destroyed', () => {
      app.ticker.remove(animate);
    });
  }

  private setupMovementPattern(app: PIXI.Application) {
    // 添加正弦波动
    let time = 0;
    const movePattern = () => {
      time += 0.05;
      this.x += Math.sin(time) * this.velocity.x;
      this.y += this.velocity.y;
    };
    
    app.ticker.add(movePattern);
    
    this.on('destroyed', () => {
      app.ticker.remove(movePattern);
    });
  }

  update(currentTime: number): PIXI.Point | null {
    // 如果可以射击，尝试射击
    if (this.canShoot && currentTime - this.lastShotTime > this.shotCooldown) {
      this.lastShotTime = currentTime;
      // 返回子弹发射位置
      return new PIXI.Point(this.x, this.y + 20);
    }

    return null;
  }

  getCollisionBounds(): PIXI.Rectangle {
    return new PIXI.Rectangle(
      this.x - this.radius,
      this.y - this.radius,
      this.radius * 2,
      this.radius * 2
    );
  }

  reset(): void {
    this.x = Math.random() * (this.app.screen.width - 40) + 20;
    this.y = -30;
    this.health = 100;
    this.lastShotTime = 0;
    this.visible = true;
    this.setupLevelProperties(this.level);
  }

  takeDamage(damage: number): boolean {
    this.health -= damage;
    if (this.health <= 0) {
      // 创建爆炸效果
      this.particleSystem.createExplosion(this.x, this.y, 0x33ff33);
      this.emit('destroyed', this);
      return true; // 敌人已被摧毁
    }
    return false;
  }
}
