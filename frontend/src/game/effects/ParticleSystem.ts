import * as PIXI from 'pixi.js';

export class ParticleSystem {
  private app: PIXI.Application;
  private particles: PIXI.Container;

  constructor(app: PIXI.Application) {
    this.app = app;
    this.particles = new PIXI.Container();
    this.app.stage.addChild(this.particles);
  }

  createEngineFlame(x: number, y: number): PIXI.Container {
    const flame = new PIXI.Container();
    const particleCount = 10;

    for (let i = 0; i < particleCount; i++) {
      const particle = new PIXI.Graphics();
      particle.beginFill(0xff9933);
      particle.drawCircle(0, 0, 2);
      particle.endFill();
      particle.alpha = Math.random() * 0.5 + 0.2;
      particle.x = x;
      particle.y = y;
      
      // 随机初始速度
      (particle as any).vx = (Math.random() - 0.5) * 2;
      (particle as any).vy = Math.random() * 4 + 2;
      
      flame.addChild(particle);
    }

    return flame;
  }

  createExplosion(x: number, y: number, color: number = 0xff0000): void {
    const particleCount = 20;
    const explosion = new PIXI.Container();
    
    for (let i = 0; i < particleCount; i++) {
      const particle = new PIXI.Graphics();
      particle.beginFill(color);
      particle.drawCircle(0, 0, Math.random() * 3 + 1);
      particle.endFill();
      
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = Math.random() * 3 + 2;
      
      (particle as any).vx = Math.cos(angle) * speed;
      (particle as any).vy = Math.sin(angle) * speed;
      (particle as any).life = 1.0;
      
      particle.x = x;
      particle.y = y;
      
      explosion.addChild(particle);
    }
    
    this.particles.addChild(explosion);
    
    const animate = () => {
      let allDead = true;
      
      explosion.children.forEach((particle) => {
        if (!(particle instanceof PIXI.Graphics)) return;
        if ((particle as any).life > 0) {
          particle.x += (particle as any).vx;
          particle.y += (particle as any).vy;
          (particle as any).life -= 0.02;
          particle.alpha = (particle as any).life;
          allDead = false;
        }
      });
      
      if (allDead) {
        this.particles.removeChild(explosion);
        this.app.ticker.remove(animate);
      }
    };
    
    this.app.ticker.add(animate);
  }

  createGlow(sprite: PIXI.Sprite, color: number = 0x00ffff): void {
    const glow = new PIXI.Graphics();
    glow.beginFill(color, 0.3);
    glow.drawCircle(
      sprite.width / 2,
      sprite.height / 2,
      Math.max(sprite.width, sprite.height) * 0.7
    );
    glow.endFill();
    glow.alpha = 0.5;
    
    sprite.addChild(glow);
    
    // 光晕动画
    const animate = () => {
      glow.alpha = 0.3 + Math.sin(Date.now() / 500) * 0.2;
    };
    
    this.app.ticker.add(animate);
  }
}
