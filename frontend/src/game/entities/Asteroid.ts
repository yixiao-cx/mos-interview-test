import * as PIXI from 'pixi.js';

export class Asteroid extends PIXI.Container {
  private sprite: PIXI.Sprite;
  private rotationSpeed: number;
  public velocity: { x: number; y: number };
  public radius: number;

  private app: PIXI.Application;

  constructor(app: PIXI.Application) {
    super();
    this.app = app;

    const size = Math.random() * 20 + 20; // 随机大小
    this.radius = size / 2;

    // 创建临时纹理，异步加载后更新
    const tempGraphics = new PIXI.Graphics();
    tempGraphics.beginFill(0x808080);
    tempGraphics.drawCircle(0, 0, this.radius);
    tempGraphics.endFill();
    const tempTexture = app.renderer.generateTexture(tempGraphics);
    this.sprite = new PIXI.Sprite(tempTexture);
    
    // 加载高质量SVG
    const texture = PIXI.Texture.from('/assets/asteroid.svg');
    this.sprite.texture = texture;
    this.sprite.width = size * 2;
    this.sprite.height = size * 2;
    this.sprite.anchor.set(0.5);
    this.addChild(this.sprite);

    // 设置随机旋转速度
    this.rotationSpeed = (Math.random() - 0.5) * 0.1;

    // 设置随机移动速度
    const speed = Math.random() * 1 + 0.5;
    const angle = Math.random() * Math.PI * 2;
    this.velocity = {
      x: Math.cos(angle) * speed,
      y: Math.abs(Math.sin(angle) * speed) + 1 // 确保向下移动
    };

    // 添加表面裂缝效果
    this.addCracks();

    // 添加发光效果
    this.addGlow();
  }

  private addCracks() {
    const cracks = new PIXI.Graphics();
    cracks.lineStyle(1, 0x606060);

    // 添加随机裂缝
    for (let i = 0; i < 3; i++) {
      const startAngle = Math.random() * Math.PI * 2;
      const length = Math.random() * this.radius * 0.8;
      const segments = 3;
      
      let x = Math.cos(startAngle) * this.radius * 0.3;
      let y = Math.sin(startAngle) * this.radius * 0.3;
      
      cracks.moveTo(x, y);
      
      for (let j = 0; j < segments; j++) {
        const angleVariance = (Math.random() - 0.5) * 0.5;
        const newAngle = startAngle + angleVariance;
        const segmentLength = length / segments;
        
        x += Math.cos(newAngle) * segmentLength;
        y += Math.sin(newAngle) * segmentLength;
        
        cracks.lineTo(x, y);
      }
    }

    this.addChild(cracks);
  }

  private addGlow() {
    const glow = new PIXI.Graphics();
    glow.beginFill(0xff6600, 0.2);
    glow.drawCircle(0, 0, this.radius * 1.2);
    glow.endFill();
    glow.alpha = 0.5;
    this.addChildAt(glow, 0);
  }

  update() {
    // 更新位置
    this.x += this.velocity.x;
    this.y += this.velocity.y;

    // 更新旋转
    this.rotation += this.rotationSpeed;
  }

  reset(): void {
    this.x = Math.random() * (this.app.screen.width - 40) + 20;
    this.y = -30;
    this.visible = true;
    this.rotation = 0;
    
    // Reset velocity
    const speed = Math.random() * 1 + 0.5;
    const angle = Math.random() * Math.PI * 2;
    this.velocity = {
      x: Math.cos(angle) * speed,
      y: Math.abs(Math.sin(angle) * speed) + 1
    };
  }

  getCollisionBounds(): PIXI.Rectangle {
    return new PIXI.Rectangle(
      this.x - this.radius,
      this.y - this.radius,
      this.radius * 2,
      this.radius * 2
    );
  }
}
