import { Sprite } from "pixi.js";
import { Artboard, LinearAnimationInstance, StateMachineInstance, SMIInput } from "@rive-app/canvas-advanced-single";
export declare enum Fit {
    Cover = "cover",
    Contain = "contain",
    Fill = "fill",
    FitWidth = "fitWidth",
    FitHeight = "fitHeight",
    None = "none",
    ScaleDown = "scaleDown"
}
export declare enum Alignment {
    Center = "center",
    TopLeft = "topLeft",
    TopCenter = "topCenter",
    TopRight = "topRight",
    CenterLeft = "centerLeft",
    CenterRight = "centerRight",
    BottomLeft = "bottomLeft",
    BottomCenter = "bottomCenter",
    BottomRight = "bottomRight"
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
export declare class RiveSprite extends Sprite {
    private _rive?;
    private _file?;
    private _renderer?;
    private _canvas?;
    enabled: boolean;
    private _debug;
    private _aligned?;
    private _assetKey;
    maxWidth: number;
    maxHeight: number;
    fit: Fit;
    align: Alignment;
    animations: LinearAnimationInstance[];
    stateMachines: StateMachineInstance[];
    inputFields: Map<string, SMIInput>;
    onStateChange?: Function;
    artboard?: Artboard;
    constructor(options: RiveOptions);
    private initRive;
    private init;
    private createCanvas;
    renderToCanvas(): void;
    private updateDimensions;
    private updateCanvasSize;
    private updateRendererAlignment;
    private updateSpriteSize;
    loadArtboard(artboard: string | undefined): void;
    updateSize(): void;
    enable(): void;
    disable(): void;
    destroy(): void;
    /**
     * Attach pointer events to the pixi sprite and pass them to the Rive state machine
     * @param {boolean} interactive true if we need to attach pointer events to sprite
     */
    private initEvents;
    /**
     * Load Rive state machines by names or load first state machine
     * Artbaord should be loaded before
     * Will load first state machine if name is empty
     * @param {string|number} machines name or names of the loading state machines
     */
    loadStateMachine(machines?: string | string[]): void;
    /**
     * Unload state machine and destroy instance
     * @param {string} name name of the state machine
     */
    unloadStateMachine(name: string): void;
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
    playAnimation(animations?: string | string[]): void;
    /**
     * Stop current animation and destroy Rive animation instance
     */
    stopAnimation(name: String): void;
    /**
     * Get list of available artboards in current Rive file
     */
    getAvailableArtboards(): string[];
    /**
     * Get list of available state machines in current artboard
     */
    getAvailableStateMachines(): string[];
    /**
     * Get list of available animations in current artboard
     */
    getAvailableAnimations(): string[];
    /**
     * Convert global Pixi.js coordinates to Rive point coordinates
     * @param {{x:number,y:number}} global point coordinates
     * @returns
     */
    private translatePoint;
    advanceStateMachines(elapsed: number): void;
    advanceAnimations(elapsed: number): void;
    /**
     * Receive input fields from all active state machines
     */
    initInputFields(): void;
    /**
     * Get state machine input field by name
     * @param {string} name input field name
     * @returns {number|boolean} value of the input field
     */
    getInputValue(name: string): number | boolean | undefined;
    /**
     * Set state machine input field value by name
     * @param {string} name of the input field
     * @param {number|boolean} value  of the input field
     */
    setInput(name: string, value: number | boolean): void;
    /**
     * Trigger state machine input field
     * @param {string} name of the trigger field
     */
    fireTrigger(name: string): void;
}
export {};
