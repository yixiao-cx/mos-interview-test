import * as PIXI from 'pixi.js';

export class ParticleSystem {
  private app: PIXI.Application;
  private particles: PIXI.Container;
  private explosionParticlePool: PIXI.Graphics[] = [];
  private speedLinePool: PIXI.Graphics[] = [];
  private engineFlames: Map<number, PIXI.Container> = new Map();

  constructor(app: PIXI.Application) {
    this.app = app;
    this.particles = new PIXI.Container();
    this.app.stage.addChild(this.particles);
  }

  createEngineFlame(x: number, y: number): PIXI.Container {
    const flame = new PIXI.Container();
    const particleCount = 4; // Reduced for better performance
    
    // Enhanced color range for flame particles
    const colors = [0xffff00, 0xff6600, 0xff2200];

    // Create a single graphics object for all particles
    const particles = new PIXI.Graphics();
    flame.addChild(particles);

    for (let i = 0; i < particleCount; i++) {
      // Randomly select color from enhanced palette
      const color = colors[Math.floor(Math.random() * colors.length)];
      particles.fill({ color: color, alpha: 0.8 });
      // Optimized size for better performance
      const size = Math.random() * 3 + 2;
      particles.circle(
        x + (Math.random() - 0.5) * 4,
        y + Math.random() * 2,
        size
      );
      const alpha = Math.random() * 0.7 + 0.5;
      particles.alpha = alpha;
    }
    
    // Store reference to flame container
    const id = Date.now();
    this.engineFlames.set(id, flame);
    
    // Add flicker animation
    const flicker = () => {
      const time = Date.now() / 200;
      particles.alpha = 0.5 + Math.sin(time) * 0.2;
      particles.y = y + Math.sin(time * 2) * 2;
    };
    
    this.app.ticker.add(flicker);
    
    // Cleanup method
    flame.destroy = () => {
      this.app.ticker.remove(flicker);
      this.engineFlames.delete(id);
      flame.removeChildren();
    };
    
    return flame;
  }

  createExplosion(x: number, y: number, color: number = 0xff0000): void {
    const particleCount = 6; // Balanced between performance and visual quality
    const explosion = new PIXI.Container();
    
    // Dynamic color palette for explosions
    const colors = [color, 0xffff00, 0xff8800, 0xff4400];
    
    // Create initial flash
    const flash = new PIXI.Graphics();
    flash.fill({ color: 0xffffff });
    flash.circle(x, y, 30);
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
      let particle: PIXI.Graphics;
      if (this.explosionParticlePool.length > 0) {
        particle = this.explosionParticlePool.pop()!;
        particle.clear();
      } else {
        particle = new PIXI.Graphics();
      }
      // Random color from palette
      const particleColor = colors[Math.floor(Math.random() * colors.length)];
      // Varied particle shapes
      if (Math.random() < 0.3) {
        // Sparks
        particle.fill({ color: particleColor });
        particle.rect(-1, -4, 2, 8);
      } else {
        // Circles with varied sizes
        particle.fill({ color: particleColor });
        particle.circle(0, 0, Math.random() * 4 + 2);
      }
      
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
        explosion.children.forEach((particle) => {
          if (particle instanceof PIXI.Graphics) {
            this.explosionParticlePool.push(particle);
          }
        });
        this.particles.removeChild(explosion);
        this.app.ticker.remove(animate);
      }
    };
    
    this.app.ticker.add(animate);
  }

  createGlow(sprite: PIXI.Sprite, color: number = 0x00ffff, isShield: boolean = false): void {
    // Single graphics object for both glows
    const glow = new PIXI.Graphics();
    
    if (isShield) {
      // Shield effect for UFOs
      glow.lineStyle(2, color, 0.8);
      glow.fill({ color: color, alpha: 0.1 });
      glow.circle(
        sprite.width / 2,
        sprite.height / 2,
        Math.max(sprite.width, sprite.height) * 0.7
      );
      
      // Add scanning beam
      const beam = new PIXI.Graphics();
      beam.fill({ color: color, alpha: 0.6 });
      beam.moveTo(sprite.width / 2, sprite.height / 2);
      beam.lineTo(sprite.width / 2, sprite.height * 2);
      beam.lineTo(sprite.width / 2 + 10, sprite.height * 2);
      beam.lineTo(sprite.width / 2, sprite.height / 2);
      sprite.addChild(beam);
      
      // Beam animation
      const animateBeam = () => {
        const time = Date.now() / 1000;
        beam.rotation = Math.sin(time) * Math.PI / 4;
        beam.alpha = 0.4 + Math.sin(time * 2) * 0.2;
      };
      this.app.ticker.add(animateBeam);
    } else {
      // Regular glow effect
      glow.fill({ color: color, alpha: 0.2 });
      glow.circle(
        sprite.width / 2,
        sprite.height / 2,
        Math.max(sprite.width, sprite.height) * 0.9
      );
      glow.fill({ color: color, alpha: 0.4 });
      glow.circle(
        sprite.width / 2,
        sprite.height / 2,
        Math.max(sprite.width, sprite.height) * 0.6
      );
    }
    
    sprite.addChild(glow);
    
    // Glow/shield animation
    const animate = () => {
      const time = Date.now() / 500;
      if (isShield) {
        glow.alpha = 0.4 + Math.sin(time) * 0.2;
        glow.rotation = Math.sin(time * 0.5) * 0.1;
      } else {
        glow.alpha = 0.3 + Math.sin(time) * 0.15;
        glow.scale.set(1 + Math.sin(time * 0.8) * 0.05);
      }
    };
    
    this.app.ticker.add(animate);
  }

  createSpeedLines(sprite: PIXI.Sprite): void {
    const speedLines = new PIXI.Container();
    const lineCount = 6; // Reduced for better performance while maintaining visual quality
    
    for (let i = 0; i < lineCount; i++) {
      let line: PIXI.Graphics;
      if (this.speedLinePool.length > 0) {
        line = this.speedLinePool.pop()!;
        line.clear();
      } else {
        line = new PIXI.Graphics();
      }
      
      line.fill({ color: 0xffffff, alpha: 0.5 });
      const width = Math.random() * 2 + 1;
      const length = Math.random() * 20 + 10;
      line.rect(-width/2, 0, width, length);
      
      line.x = sprite.x + (Math.random() - 0.5) * sprite.width;
      line.y = sprite.y + sprite.height / 2;
      line.alpha = Math.random() * 0.3 + 0.2;
      
      (line as any).speed = Math.random() * 3 + 2;
      speedLines.addChild(line);
    }
    
    this.particles.addChild(speedLines);
    
    const animate = () => {
      speedLines.children.forEach(line => {
        line.y += (line as any).speed;
        line.alpha -= 0.02;
        
        if (line.alpha <= 0) {
          this.speedLinePool.push(line as PIXI.Graphics);
          speedLines.removeChild(line);
          if (speedLines.children.length === 0) {
            this.particles.removeChild(speedLines);
            this.app.ticker.remove(animate);
          }
        }
      });
    };
    
    this.app.ticker.add(animate);
  }
}
