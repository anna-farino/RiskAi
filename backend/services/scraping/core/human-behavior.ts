import type { Page } from 'rebrowser-puppeteer';

export class HumanBehavior {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Generate random number in range
  private random(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Random delay with human-like variation
  async randomDelay(minMs: number = 500, maxMs: number = 2000): Promise<void> {
    const delay = this.random(minMs, maxMs);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Simulate human-like mouse movement
  async randomMouseMovement(): Promise<void> {
    try {
      const viewport = await this.page.viewport();
      if (!viewport) return;

      // Generate random path with 3-5 points
      const numPoints = this.random(3, 5);
      const points: { x: number; y: number }[] = [];
      
      for (let i = 0; i < numPoints; i++) {
        points.push({
          x: this.random(100, viewport.width - 100),
          y: this.random(100, viewport.height - 100)
        });
      }

      // Move through points with varying speed
      for (const point of points) {
        await this.page.mouse.move(point.x, point.y, {
          steps: this.random(5, 15)
        });
        await this.randomDelay(100, 500);
      }
    } catch (error) {
      // Silently fail - non-critical operation
    }
  }

  // Simulate random scrolling
  async randomScroll(): Promise<void> {
    try {
      const scrollDirection = Math.random() > 0.5 ? 1 : -1;
      const scrollAmount = this.random(50, 300) * scrollDirection;
      
      await this.page.evaluate((amount) => {
        window.scrollBy({
          top: amount,
          behavior: 'smooth'
        });
      }, scrollAmount);
      
      await this.randomDelay(500, 1500);
    } catch (error) {
      // Silently fail - non-critical operation
    }
  }

  // Simulate keyboard focus events
  async randomKeyboardActivity(): Promise<void> {
    try {
      const keys = ['Tab', 'Escape', ' '] as const; // Space key is just a space character
      const key = keys[this.random(0, keys.length - 1)];
      
      // Press and release with human-like timing
      await this.page.keyboard.down(key as any);
      await this.randomDelay(50, 150);
      await this.page.keyboard.up(key as any);
    } catch (error) {
      // Silently fail - non-critical operation
    }
  }

  // Simulate random click in safe area
  async randomClick(): Promise<void> {
    try {
      const viewport = await this.page.viewport();
      if (!viewport) return;

      // Click in a safe area (avoid buttons/links)
      const x = this.random(viewport.width * 0.1, viewport.width * 0.9);
      const y = this.random(viewport.height * 0.1, viewport.height * 0.9);
      
      await this.page.mouse.click(x, y);
      await this.randomDelay(200, 800);
    } catch (error) {
      // Silently fail - non-critical operation
    }
  }

  // Simulate tab visibility changes
  async simulateTabSwitch(): Promise<void> {
    try {
      // Simulate going to another tab
      await this.page.evaluate(() => {
        Object.defineProperty(document, 'hidden', {
          value: true,
          writable: true
        });
        Object.defineProperty(document, 'visibilityState', {
          value: 'hidden',
          writable: true
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Wait as if user is on another tab
      await this.randomDelay(2000, 8000);

      // Come back to tab
      await this.page.evaluate(() => {
        Object.defineProperty(document, 'hidden', {
          value: false,
          writable: true
        });
        Object.defineProperty(document, 'visibilityState', {
          value: 'visible',
          writable: true
        });
        document.dispatchEvent(new Event('visibilitychange'));
      });
    } catch (error) {
      // Silently fail - non-critical operation
    }
  }

  // Combine multiple behaviors randomly
  async performRandomActions(count: number = 3): Promise<void> {
    const actions = [
      () => this.randomMouseMovement(),
      () => this.randomScroll(),
      () => this.randomKeyboardActivity(),
      () => this.randomClick(),
      () => this.simulateTabSwitch()
    ];

    for (let i = 0; i < count; i++) {
      const action = actions[this.random(0, actions.length - 1)];
      await action();
      await this.randomDelay(1000, 3000);
    }
  }

  // Add natural "thinking" pause
  async thinkingPause(): Promise<void> {
    // Longer pause as if human is reading/thinking
    await this.randomDelay(3000, 8000);
    
    // Maybe move mouse slightly while thinking
    if (Math.random() > 0.5) {
      await this.randomMouseMovement();
    }
  }

  // Session warming - build legitimate looking history
  async warmSession(domain: string): Promise<void> {
    try {
      // Normalize the URL - add https:// if missing
      let normalizedUrl = domain;
      if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
        normalizedUrl = 'https://' + domain;
      }
      
      // Visit main domain first
      const mainUrl = new URL(normalizedUrl).origin;
      await this.page.goto(mainUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      await this.thinkingPause();
      
      // Perform some random actions to look human
      await this.performRandomActions(2);
      
      // Maybe visit another page
      if (Math.random() > 0.5) {
        const paths = ['/about', '/contact', '/privacy', '/terms'];
        const randomPath = paths[this.random(0, paths.length - 1)];
        
        await this.page.goto(mainUrl + randomPath, { 
          waitUntil: 'domcontentloaded',
          timeout: 15000 
        }).catch(() => {
          // Page might not exist, that's ok
        });
        
        await this.randomDelay(2000, 5000);
      }
    } catch (error) {
      // Session warming failed, continue anyway
    }
  }

  // Add WebGL noise to fingerprint
  async addWebGLNoise(): Promise<void> {
    try {
      await this.page.evaluateOnNewDocument(() => {
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
            return 'Intel Inc.';
          }
          if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
            const renderers = [
              'Intel Iris OpenGL Engine',
              'Intel HD Graphics 630',
              'Intel UHD Graphics 620',
              'Mesa DRI Intel(R) HD Graphics'
            ];
            return renderers[Math.floor(Math.random() * renderers.length)];
          }
          return getParameter.apply(this, arguments as any);
        };

        // Add noise to canvas fingerprinting
        const toDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function() {
          const context = this.getContext('2d');
          if (context) {
            // Add tiny random noise
            const imageData = context.getImageData(0, 0, this.width, this.height);
            for (let i = 0; i < imageData.data.length; i += 100) {
              imageData.data[i] = Math.min(255, imageData.data[i] + Math.random() * 2);
            }
            context.putImageData(imageData, 0, 0);
          }
          return toDataURL.apply(this, arguments as any);
        };
      });
    } catch (error) {
      // Fingerprint modification failed, continue anyway
    }
  }

  // Randomize window properties
  async randomizeWindow(): Promise<void> {
    try {
      const width = this.random(1200, 1920);
      const height = this.random(700, 1080);
      
      await this.page.setViewport({ width, height });
      
      // Add random screen properties
      await this.page.evaluateOnNewDocument((w, h) => {
        Object.defineProperty(window.screen, 'width', { value: w });
        Object.defineProperty(window.screen, 'height', { value: h });
        Object.defineProperty(window.screen, 'availWidth', { value: w });
        Object.defineProperty(window.screen, 'availHeight', { value: h - 40 });
      }, width, height);
    } catch (error) {
      // Window randomization failed, continue anyway
    }
  }
}