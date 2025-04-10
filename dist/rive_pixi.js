import { Assets, Sprite, Texture, settings, extensions, checkExtension, ExtensionType, LoaderParserPriority, Ticker, } from "pixi.js";
import Rive from "@rive-app/canvas-advanced-single";
const NOOP = () => { };
/**
 * Manages Rive initialization and file caching
 */
class RiveManager {
    constructor() {
        Object.defineProperty(this, "riveInstance", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "fileCache", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "initializationPromise", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "activeSprites", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "lastTime", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        // Set up the global render loop
        Ticker.shared.add(this.updateSprites.bind(this));
    }
    updateSprites() {
        const time = Ticker.shared.lastTime;
        if (!this.lastTime)
            this.lastTime = time;
        const elapsedTime = (time - this.lastTime) / 1000;
        this.lastTime = time;
        // Update all active sprites
        this.activeSprites.forEach(sprite => {
            if (sprite.artboard && sprite.enabled) {
                // Update animations and state machines
                sprite.advanceStateMachines(elapsedTime);
                sprite.advanceAnimations(elapsedTime);
                sprite.artboard.advance(elapsedTime);
                // Render to canvas
                sprite.renderToCanvas();
            }
        });
        // Keep Rive's internal animation system running
        if (this.riveInstance) {
            this.riveInstance.requestAnimationFrame(NOOP);
        }
    }
    registerSprite(sprite) {
        this.activeSprites.add(sprite);
    }
    unregisterSprite(sprite) {
        this.activeSprites.delete(sprite);
    }
    static getInstance() {
        if (!RiveManager.instance) {
            RiveManager.instance = new RiveManager();
        }
        return RiveManager.instance;
    }
    async initialize() {
        if (!this.initializationPromise) {
            this.initializationPromise = Rive().then(rive => {
                this.riveInstance = rive;
                return rive;
            });
        }
        return this.initializationPromise;
    }
    async loadFile(asset) {
        const rive = await this.initialize();
        // Use cached file if available
        if (typeof asset === 'string' && this.fileCache.has(asset)) {
            const file = this.fileCache.get(asset);
            file.refCount++;
            return file;
        }
        // Load new file
        const assetData = typeof asset === "string" ? await Assets.load(asset) : asset;
        const file = await rive.load(assetData);
        file.refCount = 1;
        // Cache the file if it's from a URL
        if (typeof asset === 'string') {
            this.fileCache.set(asset, file);
        }
        return file;
    }
    releaseFile(assetKey) {
        const file = this.fileCache.get(assetKey);
        if (file) {
            file.refCount--;
            if (file.refCount <= 0) {
                file.delete();
                this.fileCache.delete(assetKey);
            }
        }
    }
    getRiveInstance() {
        return this.riveInstance;
    }
    // Add method to check if a file is cached
    isFileCached(assetKey) {
        return this.fileCache.has(assetKey);
    }
    // Add method to get cached file without incrementing ref count
    peekCachedFile(assetKey) {
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
    test(url) {
        // checkDataUrl(url, 'mime/type');
        return checkExtension(url, ".riv");
    },
    async load(url) {
        const response = await settings.ADAPTER.fetch(url);
        return new Uint8Array(await response.arrayBuffer());
    },
});
// Fit options for the canvas
export var Fit;
(function (Fit) {
    Fit["Cover"] = "cover";
    Fit["Contain"] = "contain";
    Fit["Fill"] = "fill";
    Fit["FitWidth"] = "fitWidth";
    Fit["FitHeight"] = "fitHeight";
    Fit["None"] = "none";
    Fit["ScaleDown"] = "scaleDown";
})(Fit || (Fit = {}));
// Alignment options for the canvas
export var Alignment;
(function (Alignment) {
    Alignment["Center"] = "center";
    Alignment["TopLeft"] = "topLeft";
    Alignment["TopCenter"] = "topCenter";
    Alignment["TopRight"] = "topRight";
    Alignment["CenterLeft"] = "centerLeft";
    Alignment["CenterRight"] = "centerRight";
    Alignment["BottomLeft"] = "bottomLeft";
    Alignment["BottomCenter"] = "bottomCenter";
    Alignment["BottomRight"] = "bottomRight";
})(Alignment || (Alignment = {}));
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
    constructor(options) {
        super(Texture.EMPTY);
        Object.defineProperty(this, "_rive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_file", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_renderer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_canvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "enabled", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "_debug", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "_aligned", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_assetKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "maxWidth", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "maxHeight", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "fit", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: Fit.Contain
        });
        Object.defineProperty(this, "align", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: Alignment.Center
        });
        Object.defineProperty(this, "animations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "stateMachines", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "inputFields", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "onStateChange", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "artboard", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._debug = options.debug ?? false;
        this.onStateChange = options.onStateChange;
        this.initEvents(options.interactive ?? false);
        this._assetKey = typeof options.asset === 'string' ? options.asset : '';
        this.initRive(options.asset)
            .then(() => this.init(options))
            .catch(error => {
            console.error('Error initializing RiveSprite:', error);
        });
    }
    async initRive(riv) {
        try {
            const riveManager = RiveManager.getInstance();
            const rive = await riveManager.initialize();
            this._rive = rive;
            this._file = await riveManager.loadFile(riv);
        }
        catch (error) {
            console.error('Failed to initialize Rive:', error);
            throw error; // Re-throw to be caught by the constructor's catch block
        }
    }
    async init(options) {
        if (!this._rive || !this._file) {
            console.error('Failed to initialize Rive or load file');
            return;
        }
        this._canvas = this.createCanvas();
        this._renderer = this._rive.makeRenderer(this._canvas);
        this.loadArtboard(options.artboard);
        this.loadStateMachine(options.stateMachine);
        this.playAnimation(options.animation);
        if (this.artboard && this._renderer && this._canvas) {
            const bounds = this.artboard.bounds;
            this.updateDimensions(bounds);
            this.updateCanvasSize();
            // Create initial texture
            this.texture.destroy();
            this.texture = Texture.from(this._canvas);
            this.texture.update();
            this.updateSpriteSize();
        }
        if (options.autoPlay) {
            this.enable();
        }
        if (options.onReady) {
            options.onReady(this._rive);
        }
    }
    createCanvas() {
        if (typeof OffscreenCanvas !== 'undefined' && !this._debug) {
            // Use OffscreenCanvas for better performance when available and not in debug mode
            return new OffscreenCanvas(100, 100); // Start with a reasonable size
        }
        // Fallback to regular canvas for debug mode or when OffscreenCanvas is not supported
        const canvas = document.createElement("canvas");
        canvas.width = 100; // Start with a reasonable size
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
    renderToCanvas() {
        if (this.artboard && this._renderer) {
            this._renderer.clear();
            this.artboard.draw(this._renderer);
            this._renderer.flush();
            this.texture.update();
        }
    }
    updateDimensions(bounds) {
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
    }
    updateCanvasSize() {
        if (this._canvas) {
            this._canvas.width = this.maxWidth;
            this._canvas.height = this.maxHeight;
        }
    }
    updateRendererAlignment(bounds) {
        if (this._rive && this._renderer && this.artboard) {
            const fit = this._rive.Fit[this.fit];
            const align = this._rive.Alignment[this.align];
            const frame = { minX: 0, minY: 0, maxX: this.maxWidth, maxY: this.maxHeight };
            this._aligned = this._rive.computeAlignment(fit, align, frame, bounds);
            this._renderer.align(fit, align, frame, bounds);
        }
    }
    updateSpriteSize() {
        this.width = this.maxWidth;
        this.height = this.maxHeight;
    }
    loadArtboard(artboard) {
        if (this.artboard) {
            this.artboard.delete();
        }
        if (this._file) {
            this.artboard = artboard
                ? this._file.artboardByName(artboard)
                : this._file.defaultArtboard();
            if (this.artboard) {
                const bounds = this.artboard.bounds;
                this.updateDimensions(bounds);
                this.updateSize();
            }
        }
    }
    updateSize() {
        if (this.artboard && this._rive && this._renderer && this._canvas) {
            const bounds = this.artboard.bounds;
            this.updateDimensions(bounds);
            this.updateCanvasSize();
            this.updateRendererAlignment(bounds);
            this.updateSpriteSize();
            // Render to canvas first
            this._renderer.clear();
            this.artboard.draw(this._renderer);
            this._renderer.flush();
            // Create new texture from the rendered canvas
            this.texture.destroy();
            this.texture = Texture.from(this._canvas);
            this.texture.update();
        }
    }
    enable() {
        this.enabled = true;
        RiveManager.getInstance().registerSprite(this);
    }
    disable() {
        this.enabled = false;
        RiveManager.getInstance().unregisterSprite(this);
    }
    destroy() {
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
    initEvents(interactive) {
        if (!interactive)
            return;
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
    loadStateMachine(machines = []) {
        if (!this.artboard || !this._rive)
            return;
        if (typeof machines === "string")
            machines = [machines];
        else if (!machines.length) {
            const defaultMachine = this.artboard.stateMachineByIndex(0);
            machines = defaultMachine ? [defaultMachine.name] : [];
        }
        machines.map((name) => {
            const machine = this.artboard.stateMachineByName(name);
            this.unloadStateMachine(name);
            this.stateMachines.push(new this._rive.StateMachineInstance(machine, this.artboard));
        });
        this.initInputFields();
    }
    /**
     * Unload state machine and destroy instance
     * @param {string} name name of the state machine
     */
    unloadStateMachine(name) {
        this.stateMachines = this.stateMachines.filter((machine) => {
            if (machine.name === name) {
                machine.delete();
                return false;
            }
            else
                return true;
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
    playAnimation(animations = []) {
        if (!this.artboard && !this._rive)
            return;
        if (typeof animations === "string")
            animations = [animations];
        else if (!animations.length && !this.stateMachines.length) {
            const defaultAnimation = this.artboard.animationByIndex(0);
            animations = defaultAnimation ? [defaultAnimation.name] : [];
        }
        animations.map((name) => {
            const animation = this.artboard.animationByName(name);
            this.stopAnimation(name);
            this.animations.push(new this._rive.LinearAnimationInstance(animation, this.artboard));
        });
    }
    /**
     * Stop current animation and destroy Rive animation instance
     */
    stopAnimation(name) {
        this.animations = this.animations.filter((animation) => {
            if (animation.name === name) {
                animation.delete();
                return false;
            }
            else
                return true;
        });
    }
    /**
     * Get list of available artboards in current Rive file
     */
    getAvailableArtboards() {
        let available = [];
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
    getAvailableStateMachines() {
        let available = [];
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
    getAvailableAnimations() {
        let available = [];
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
    translatePoint(global) {
        const { x, y } = this.toLocal(global);
        const { tx, ty, xx, yy } = this._aligned || { tx: 0, ty: 0, xx: 1, yy: 1 };
        return [(x - tx) / xx, (y - ty) / yy];
    }
    advanceStateMachines(elapsed) {
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
    advanceAnimations(elapsed) {
        this.animations.map((a) => {
            a.advance(elapsed);
            a.apply(1);
        });
    }
    /**
     * Receive input fields from all active state machines
     */
    initInputFields() {
        const { bool, trigger } = this._rive.SMIInput;
        this.inputFields.clear();
        this.stateMachines.forEach((m) => {
            for (let i = 0; i < m.inputCount(); i++) {
                let field;
                const input = m.input(i);
                if (input.type == bool)
                    field = input.asBool();
                else if (input.type == trigger)
                    field = input.asTrigger();
                else
                    field = input.asNumber();
                this.inputFields.set(input.name, field);
            }
        });
    }
    /**
     * Get state machine input field by name
     * @param {string} name input field name
     * @returns {number|boolean} value of the input field
     */
    getInputValue(name) {
        const input = this.inputFields.get(name);
        return input && input.value;
    }
    /**
     * Set state machine input field value by name
     * @param {string} name of the input field
     * @param {number|boolean} value  of the input field
     */
    setInput(name, value) {
        const input = this.inputFields.get(name);
        if (input && input.type !== this._rive?.SMIInput.trigger) {
            input.value = value;
        }
    }
    /**
     * Trigger state machine input field
     * @param {string} name of the trigger field
     */
    fireTrigger(name) {
        const input = this.inputFields.get(name);
        if (input && input.type === this._rive?.SMIInput.trigger) {
            input.fire();
        }
    }
}
