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
    const particleCount = 15; // Increased particle count for richer effect
    
    // Color range for flame particles
    const colors = [0xff9933, 0xff8833, 0xff6600, 0xff4400];

    for (let i = 0; i < particleCount; i++) {
      const particle = new PIXI.Graphics();
      // Randomly select color from palette
      const color = colors[Math.floor(Math.random() * colors.length)];
      particle.beginFill(color);
      // Varied particle sizes
      const size = Math.random() * 2 + 1;
      particle.drawCircle(0, 0, size);
      particle.endFill();
      // Higher alpha range for more vibrant effect
      particle.alpha = Math.random() * 0.6 + 0.4;
      particle.x = x + (Math.random() - 0.5) * 4; // Spread particles horizontally
      particle.y = y + Math.random() * 2;
      
      // Enhanced particle movement
      (particle as any).vx = (Math.random() - 0.5) * 3;
      (particle as any).vy = Math.random() * 5 + 3;
      (particle as any).flickerSpeed = Math.random() * 0.1 + 0.05;
      (particle as any).baseAlpha = particle.alpha;
      
      flame.addChild(particle);
    }
    
    // Add flicker animation
    const flicker = () => {
      flame.children.forEach(child => {
        if (!(child instanceof PIXI.Graphics)) return;
        const flickerAmount = Math.sin(Date.now() * (child as any).flickerSpeed) * 0.2;
        child.alpha = (child as any).baseAlpha + flickerAmount;
      });
    };
    
    this.app.ticker.add(flicker);
    
    return flame;
  }

  createExplosion(x: number, y: number, color: number = 0xff0000): void {
    const particleCount = 30; // Increased particle count
    const explosion = new PIXI.Container();
    
    // Dynamic color palette for explosions
    const colors = [color, 0xffff00, 0xff8800, 0xff4400];
    
    // Create initial flash
    const flash = new PIXI.Graphics();
    flash.beginFill(0xffffff);
    flash.drawCircle(x, y, 30);
    flash.endFill();
    flash.alpha = 0.8;
    this.particles.addChild(flash);
    
    // Fade out flash
    const fadeFlash = () => {
      flash.alpha *= 0.85;
      flash.scale.x *= 1.1;
      flash.scale.y *= 1.1;
      if (flash.alpha < 0.1) {
        this.particles.removeChild(flash);
        this.app.ticker.remove(fadeFlash);
      }
    };
    this.app.ticker.add(fadeFlash);
    
    for (let i = 0; i < particleCount; i++) {
      const particle = new PIXI.Graphics();
      // Random color from palette
      const particleColor = colors[Math.floor(Math.random() * colors.length)];
      particle.beginFill(particleColor);
      
      // Varied particle shapes
      if (Math.random() < 0.3) {
        // Sparks
        particle.drawRect(-1, -4, 2, 8);
      } else {
        // Circles with varied sizes
        particle.drawCircle(0, 0, Math.random() * 4 + 2);
      }
      particle.endFill();
      
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
      const speed = Math.random() * 5 + 3;
      
      (particle as any).vx = Math.cos(angle) * speed;
      (particle as any).vy = Math.sin(angle) * speed;
      (particle as any).life = 1.0;
      (particle as any).spin = (Math.random() - 0.5) * 0.2;
      (particle as any).drag = 0.98;
      
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
          // Apply velocity with drag
          (particle as any).vx *= (particle as any).drag;
          (particle as any).vy *= (particle as any).drag;
          (particle as any).vy += 0.1; // Gravity effect
          
          particle.x += (particle as any).vx;
          particle.y += (particle as any).vy;
          particle.rotation += (particle as any).spin;
          
          
          (particle as any).life -= 0.02;
          particle.alpha = (particle as any).life;
          
          // Scale down as life decreases
          const scale = 0.5 + (particle as any).life * 0.5;
          particle.scale.set(scale);
          
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
