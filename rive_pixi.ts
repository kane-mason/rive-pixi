import {
  Assets,
  Sprite,
  Texture,
  settings,
  extensions,
  checkExtension,
  ExtensionType,
  LoaderParserPriority,
  Ticker,
} from "pixi.js";
import Rive, {
  Artboard,
  File,
  RiveCanvas,
  WrappedRenderer,
  LinearAnimationInstance,
  StateMachineInstance,
  SMIInput,
  Mat2D,
} from "@rive-app/canvas-advanced-single";

// Add type definition at the top of the file after imports
interface CachedRiveFile extends File {
  refCount: number;
}

/**
 * Manages Rive initialization and file caching
 */
class RiveManager {
  private static instance: RiveManager;
  private riveInstance?: RiveCanvas;
  private fileCache: Map<string, CachedRiveFile> = new Map();
  private initializationPromise?: Promise<RiveCanvas>;

  private constructor() {}

  static getInstance(): RiveManager {
    if (!RiveManager.instance) {
      RiveManager.instance = new RiveManager();
    }
    return RiveManager.instance;
  }

  async initialize(): Promise<RiveCanvas> {
    if (!this.initializationPromise) {
      this.initializationPromise = Rive().then(rive => {
        this.riveInstance = rive;
        return rive;
      });
    }
    return this.initializationPromise;
  }

  async loadFile(asset: string | Uint8Array): Promise<CachedRiveFile> {
    const rive = await this.initialize();

    // Use cached file if available
    if (typeof asset === 'string' && this.fileCache.has(asset)) {
      const file = this.fileCache.get(asset)!;
      file.refCount++;
      return file;
    }

    // Load new file
    const assetData = typeof asset === "string" ? await Assets.load(asset) : asset;
    const file = await rive.load(assetData) as CachedRiveFile;
    file.refCount = 1;
    
    // Cache the file if it's from a URL
    if (typeof asset === 'string') {
      this.fileCache.set(asset, file);
    }

    return file;
  }

  releaseFile(assetKey: string): void {
    const file = this.fileCache.get(assetKey);
    if (file) {
      file.refCount--;
      if (file.refCount <= 0) {
        file.delete();
        this.fileCache.delete(assetKey);
      }
    }
  }

  getRiveInstance(): RiveCanvas | undefined {
    return this.riveInstance;
  }

  // Add method to check if a file is cached
  isFileCached(assetKey: string): boolean {
    return this.fileCache.has(assetKey);
  }

  // Add method to get cached file without incrementing ref count
  peekCachedFile(assetKey: string): CachedRiveFile | undefined {
    return this.fileCache.get(assetKey);
  }
}

/**
 * Register Pixi.js extension for loading Rive files (.riv)
 */
extensions.add({
  name: "loadRive",
  extension: {
    type: ExtensionType.LoadParser,
    priority: LoaderParserPriority.High,
  },
  test(url: string) {
    // checkDataUrl(url, 'mime/type');
    return checkExtension(url, ".riv");
  },
  async load(url: string) {
    const response = await settings.ADAPTER.fetch(url);
    return new Uint8Array(await response.arrayBuffer());
  },
});

// Fit options for the canvas
export enum Fit {
  Cover = "cover",
  Contain = "contain",
  Fill = "fill",
  FitWidth = "fitWidth",
  FitHeight = "fitHeight",
  None = "none",
  ScaleDown = "scaleDown",
}

// Alignment options for the canvas
export enum Alignment {
  Center = "center",
  TopLeft = "topLeft",
  TopCenter = "topCenter",
  TopRight = "topRight",
  CenterLeft = "centerLeft",
  CenterRight = "centerRight",
  BottomLeft = "bottomLeft",
  BottomCenter = "bottomCenter",
  BottomRight = "bottomRight",
}

/**
 * Properties accepted by RiveSprite Component
 * @param {string} asset name of the asset element (will be loaded if still not loaded) or *.riv file content (Uint8Array)
 * @param {boolean} debug turning on debug mode will display original Rive canvas
 * @param {boolean} autoplay run animation or state machine after initializing
 * @param {boolean} interactive enable passing pointer events into Rive state machine
 * @param {string} artboard create artoard by name (default artboard will be loaded if name is not set)
 * @param {string} animation run animation by name
 * @param {string} stateMachine name of the loaded statemachine (default state machine will be loaded if name is not set)
 * @param {Function} onStateChange callback fires when state machine has changes (will pass array of state names)
 * @param {Function} onReady callback method which will be called after rive component initialization
 */
type RiveOptions = {
  asset: string | Uint8Array;
  debug?: boolean;
  autoPlay?: boolean;
  interactive?: boolean;
  artboard?: string;
  animation?: string | string[];
  stateMachine?: string | string[];
  onStateChange?: Function;
  onReady?: Function;
};

/**
 * RiveSprite component extended from Pixi.js Sprite
 *
 * Usage example:
 * PIXI.Assets.add({ alias: 'vehicles', src: 'https://cdn.rive.app/animations/vehicles.riv' });
 * const vehiclesSprite = new RiveSprite({ asset: 'vehicles', autoPlay: true });
 * app.stage.addChild(vehiclesSprite);
 *
 * @param {Artboard} artboard current Rive Artboard instance
 * @param {LinearAnimationInstance} animations current Animation instances
 * @param {StateMachineInstance} stateMachines current Rive State Machine instances
 * @param {Map<string, SMIInput>} inputFields current artboard input fields from all state machines
 * @param {Function} onStateChange callback method for catching state machines changes
 * @param {Fit} fit fit Rive component into container sizes (Contain by default)
 * @param {Alignment} align align Rive component in container (Center by default)
 * @param {number} maxWidth max width of sprite (original Rive artboard size will be used if maxWidth is not set)
 * @param {number} maxHeight max height of sprite (original Rive artboard size will be used if maxHeight is not set)
 */
export class RiveSprite extends Sprite {
  private _rive?: RiveCanvas;
  private _file?: CachedRiveFile;
  private _renderer?: WrappedRenderer;
  private _canvas?: HTMLCanvasElement | OffscreenCanvas;
  private _enabled: boolean = false;
  private _lastTime: number = 0;
  private _debug: boolean = false;
  private _aligned?: Mat2D;
  private _assetKey: string = '';
  private _boundRenderLoop;
  private _boundFakeRenderLoop;
  
  maxWidth: number = 0;
  maxHeight: number = 0;
  fit: Fit = Fit.Contain;
  align: Alignment = Alignment.Center;
  animations: LinearAnimationInstance[] = [];
  stateMachines: StateMachineInstance[] = [];
  inputFields: Map<string, SMIInput> = new Map();
  onStateChange?: Function;
  artboard?: Artboard;

  constructor(options: RiveOptions) {
    super(Texture.EMPTY);  // Start with an empty texture
    this._debug = options.debug ?? false;
    this.onStateChange = options.onStateChange;
    this.initEvents(options.interactive ?? false);
    this._assetKey = typeof options.asset === 'string' ? options.asset : '';
    this._boundRenderLoop = this.renderLoop.bind(this);
    this._boundFakeRenderLoop = this.fakeRenderLoop.bind(this);
    
    // Initialize Rive and load file
    this.initRive(options.asset).then(() => {
      if (!this._rive || !this._file) {
        console.error('Failed to initialize Rive or load file');
        return;
      }
      
      // Create canvas and renderer
      this._canvas = this.createCanvas();
      this._renderer = this._rive.makeRenderer(this._canvas);
      
      // Load artboard first
      this.loadArtboard(options.artboard);
      
      // Set up animations and state machines
      this.loadStateMachine(options.stateMachine);
      this.playAnimation(options.animation);
      
      // Force an initial render to ensure texture is ready
      if (this.artboard && this._renderer && this._canvas) {
        // Get initial bounds
        const bounds = this.artboard.bounds;
        const { minX, minY, maxX, maxY } = bounds;
        const originalWidth = maxX - minX;
        const originalHeight = maxY - minY;
        
        // Set initial dimensions if not already set
        if (!this.maxWidth && !this.maxHeight) {
          this.maxWidth = originalWidth;
          this.maxHeight = originalHeight;
        }
        
        // Set initial canvas size
        this._canvas.width = this.maxWidth;
        this._canvas.height = this.maxHeight;
        
        // Initial render
        this._renderer.clear();
        this._renderer.save();
        this.artboard.draw(this._renderer);
        this._renderer.restore();
        this._renderer.flush();
        
        // Create initial texture
        this.texture.destroy();
        this.texture = Texture.from(this._canvas);
        this.texture.update();
        
        // Update sprite dimensions
        this.width = this.maxWidth;
        this.height = this.maxHeight;
      }
      
      // Start rendering if autoplay is enabled
      if (options.autoPlay) {
        this.enable();
      }
      
      if (options.onReady) {
        options.onReady(this._rive);
      }
    }).catch(error => {
      console.error('Error initializing RiveSprite:', error);
    });
  }

  private async initRive(riv: string | Uint8Array): Promise<void> {
    try {
      const riveManager = RiveManager.getInstance();
      const rive = await riveManager.initialize();
      this._rive = rive;
      this._file = await riveManager.loadFile(riv);
    } catch (error) {
      console.error('Failed to initialize Rive:', error);
      throw error; // Re-throw to be caught by the constructor's catch block
    }
  }

  private createCanvas(): HTMLCanvasElement | OffscreenCanvas {
    if (typeof OffscreenCanvas !== 'undefined' && !this._debug) {
      // Use OffscreenCanvas for better performance when available and not in debug mode
      return new OffscreenCanvas(100, 100); // Start with a reasonable size
    }

    // Fallback to regular canvas for debug mode or when OffscreenCanvas is not supported
    const canvas = document.createElement("canvas");
    canvas.width = 100;  // Start with a reasonable size
    canvas.height = 100;
    if (this._debug) {
      canvas.style.position = "fixed";
      canvas.style.top = "0";
      canvas.style.right = "0";
      canvas.style.border = "1px solid red";
      document.body.appendChild(canvas);
    }
    return canvas;
  }

  private fakeRenderLoop = (): void => {}

  private renderLoop = (): void => {
    const time = Ticker.shared.lastTime;
    if (!this._lastTime) this._lastTime = time;
    const elapsedTime = (time - this._lastTime) / 1000;
    this._lastTime = time;

    if (this.artboard && this._renderer && this._enabled) {
      // Update animations and state machines
      this.advanceStateMachines(elapsedTime);
      this.advanceAnimations(elapsedTime);
      this.artboard.advance(elapsedTime);

      // Render to canvas
      this._renderer.clear();
      this._renderer.save();
      this.artboard.draw(this._renderer);
      this._renderer.restore();
      this._renderer.flush();

      // Update Pixi texture
      this.texture.update();
    }

    this._rive!.requestAnimationFrame(this._boundFakeRenderLoop);
  };

  loadArtboard(artboard: string | undefined): void {  
    if (this.artboard) {
      this.artboard.delete();
    }
    if (this._file) {
      this.artboard = artboard
        ? this._file.artboardByName(artboard)
        : this._file.defaultArtboard();
      
      if (this.artboard) {
        // Get initial bounds and set maxWidth/maxHeight if not already set
        const bounds = this.artboard.bounds;
        const { minX, minY, maxX, maxY } = bounds;
        const originalWidth = maxX - minX;
        const originalHeight = maxY - minY;
        
        // Set initial dimensions if not already set
        if (!this.maxWidth && !this.maxHeight) {
          this.maxWidth = originalWidth;
          this.maxHeight = originalHeight;
        }
        
        this.updateSize();
      }
    }
  }

  updateSize(): void {
    if (this.artboard && this._rive && this._renderer && this._canvas) {
      const bounds = this.artboard.bounds;
      const { minX, minY, maxX, maxY } = bounds;
      const originalWidth = maxX - minX;
      const originalHeight = maxY - minY;
      
      // Always maintain aspect ratio
      const aspectRatio = originalWidth / originalHeight;
      
      // If maxWidth is set, use it as the primary dimension
      if (this.maxWidth) {
        this.maxHeight = this.maxWidth / aspectRatio;
      } 
      // If maxHeight is set, use it as the primary dimension
      else if (this.maxHeight) {
        this.maxWidth = this.maxHeight * aspectRatio;
      }
      // If neither is set, use original dimensions
      else {
        this.maxWidth = originalWidth;
        this.maxHeight = originalHeight;
      }
      
      // Set canvas size
      this._canvas.width = this.maxWidth;
      this._canvas.height = this.maxHeight;
      
      // Update renderer alignment
      const fit = this._rive.Fit[this.fit];
      const align = this._rive.Alignment[this.align];
      const frame = { minX: 0, minY: 0, maxX: this.maxWidth, maxY: this.maxHeight };
      this._aligned = this._rive.computeAlignment(fit, align, frame, bounds);
      this._renderer.align(fit, align, frame, bounds);
      
      // Update sprite dimensions
      this.width = this.maxWidth;
      this.height = this.maxHeight;
      
      // Force immediate render and texture update
      this._renderer.clear();
      this._renderer.save();
      this.artboard.draw(this._renderer);
      this._renderer.restore();
      this._renderer.flush();
      
      // Destroy old texture and create new one
      this.texture.destroy();
      this.texture = Texture.from(this._canvas);
      this.texture.update();
    }
  }

  enable(): void {
    this._enabled = true;
    Ticker.shared.add(this._boundRenderLoop);
  }

  disable(): void {
    this._enabled = false;
    Ticker.shared.remove(this._boundRenderLoop);
  }

  destroy(): void {
    super.destroy();
    this.disable();
    this.stateMachines.forEach(machine => machine.delete());
    this.animations.forEach(animation => animation.delete());
    this.artboard?.delete();
    this._renderer?.delete();
    
    // Release file reference
    if (this._assetKey) {
      RiveManager.getInstance().releaseFile(this._assetKey);
    }
  }

  /**
   * Attach pointer events to the pixi sprite and pass them to the Rive state machine
   * @param {boolean} interactive true if we need to attach pointer events to sprite
   */
  private initEvents(interactive: boolean): void {
    if (!interactive) return;
    // this.cursor = 'pointer';
    this.eventMode = "static";
    this.onpointerdown = (e) => {
      const point = this.translatePoint(e.global);
      this.stateMachines.map((m) => m.pointerDown(...point));
    };
    this.onpointerup = (e) => {
      const point = this.translatePoint(e.global);
      this.stateMachines.map((m) => m.pointerUp(...point));
    };
    this.onpointermove = (e) => {
      const point = this.translatePoint(e.global);
      this.stateMachines.map((m) => m.pointerMove(...point));
    };
  }

  /**
   * Load Rive state machines by names or load first state machine
   * Artbaord should be loaded before
   * Will load first state machine if name is empty
   * @param {string|number} machines name or names of the loading state machines
   */
  loadStateMachine(machines: string | string[] = []): void {
    if (!this.artboard || !this._rive) return;
    if (typeof machines === "string") machines = [machines];
    else if (!machines.length) {
      const defaultMachine = this.artboard!.stateMachineByIndex(0);
      machines = defaultMachine ? [defaultMachine.name] : [];
    }
    machines.map((name) => {
      const machine = this.artboard!.stateMachineByName(name);
      this.unloadStateMachine(name);
      this.stateMachines.push(
        new this._rive!.StateMachineInstance(machine, this.artboard!)
      );
    });
    this.initInputFields();
  }

  /**
   * Unload state machine and destroy instance
   * @param {string} name name of the state machine
   */
  unloadStateMachine(name: string): void {
    this.stateMachines = this.stateMachines.filter((machine) => {
      if (machine.name === name) {
        machine.delete();
        return false;
      } else return true;
    });
  }

  /**
   * Play Rive animation by name (artbaord should be loaded before)
   * You can play only one timeline animation at the same time.
   * If animation is looped or it's a pingpong, it will be repeated endlessly
   * otherwise it plays only once
   *
   * TODO: add onStart/onEnd/onLoop methods for animation
   *
   * @param {string|number} animations animation name or array of nmaes
   */
  playAnimation(animations: string | string[] = []): void {
    if (!this.artboard && !this._rive) return;
    if (typeof animations === "string") animations = [animations];
    else if (!animations.length && !this.stateMachines.length) {
      const defaultAnimation = this.artboard!.animationByIndex(0);
      animations = defaultAnimation ? [defaultAnimation.name] : [];
    }
    animations.map((name) => {
      const animation = this.artboard!.animationByName(name);
      this.stopAnimation(name);
      this.animations.push(
        new this._rive!.LinearAnimationInstance(animation, this.artboard!)
      );
    });
  }

  /**
   * Stop current animation and destroy Rive animation instance
   */
  stopAnimation(name: String): void {
    this.animations = this.animations.filter((animation) => {
      if (animation.name === name) {
        animation.delete();
        return false;
      } else return true;
    });
  }

  /**
   * Get list of available artboards in current Rive file
   */
  getAvailableArtboards(): string[] {
    let available: string[] = [];
    if (this._file) {
      for (let i = 0; i < this._file.artboardCount(); i++) {
        available[i] = this._file.artboardByIndex(i).name;
      }
    }
    return available;
  }

  /**
   * Get list of available state machines in current artboard
   */
  getAvailableStateMachines(): string[] {
    let available: string[] = [];
    if (this.artboard) {
      for (let i = 0; i < this.artboard.stateMachineCount(); i++) {
        available[i] = this.artboard.stateMachineByIndex(i).name;
      }
    }
    return available;
  }

  /**
   * Get list of available animations in current artboard
   */
  getAvailableAnimations(): string[] {
    let available: string[] = [];
    if (this.artboard) {
      for (let i = 0; i < this.artboard.animationCount(); i++) {
        available[i] = this.artboard.animationByIndex(i).name;
      }
    }
    return available;
  }

  /**
   * Convert global Pixi.js coordinates to Rive point coordinates
   * @param {{x:number,y:number}} global point coordinates
   * @returns
   */
  private translatePoint(global: { x: number; y: number }): [number, number] {
    const { x, y } = this.toLocal(global);
    const { tx, ty, xx, yy } = this._aligned || { tx: 0, ty: 0, xx: 1, yy: 1 };
    return [(x - tx) / xx, (y - ty) / yy];
  }

  /**
   * Play all state machines animations
   * @param {number} elapsed time from last update
   */
  private advanceStateMachines(elapsed: number): void {
    this.stateMachines.map((m) => {
      m.advance(elapsed);
      if (this.onStateChange && m.stateChangedCount()) {
        let states = [];
        for (let i = 0; i < m.stateChangedCount(); i++) {
          states.push(m.stateChangedNameByIndex(i));
        }
        if (states.length) {
          this.onStateChange(states);
        }
      }
    });
  }

  /**
   * Play all scene animations
   * @param {number} elapsed time from last update
   */
  private advanceAnimations(elapsed: number): void {
    this.animations.map((a) => {
      a.advance(elapsed);
      a.apply(1);
    });
  }

  /**
   * Receive input fields from all active state machines
   */
  initInputFields(): void {
    const { bool, trigger } = this._rive!.SMIInput;
    this.inputFields.clear();
    this.stateMachines.forEach((m) => {
      for (let i = 0; i < m.inputCount(); i++) {
        let field: SMIInput;
        const input = m.input(i);
        if (input.type == bool) field = input.asBool();
        else if (input.type == trigger) field = input.asTrigger();
        else field = input.asNumber();
        this.inputFields.set(input.name, field);
      }
    });
  }

  /**
   * Get state machine input field by name
   * @param {string} name input field name
   * @returns {number|boolean} value of the input field
   */
  getInputValue(name: string): number | boolean | undefined {
    const input = this.inputFields.get(name);
    return input && input.value;
  }

  /**
   * Set state machine input field value by name
   * @param {string} name of the input field
   * @param {number|boolean} value  of the input field
   */
  setInput(name: string, value: number | boolean): void {
    const input = this.inputFields.get(name);
    if (input && input.type !== this._rive?.SMIInput.trigger) {
      input.value = value;
    }
  }

  /**
   * Trigger state machine input field
   * @param {string} name of the trigger field
   */
  fireTrigger(name: string): void {
    const input = this.inputFields.get(name);
    if (input && input.type === this._rive?.SMIInput.trigger) {
      input.fire();
    }
  }
}