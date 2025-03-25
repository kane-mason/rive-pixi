import * as PIXI from 'pixi.js';
import { RiveSprite, Fit, Alignment } from '../dist/rive_pixi.js';
import { Stats } from 'pixi-stats';

// Create the PixiJS application
const app = new PIXI.Application({
    background: '#000000',
    resizeTo: window,
    powerPreference: 'high-performance',
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
});
document.body.appendChild(app.view);

// Initialize stats
const stats = new Stats(app.renderer);

// Create context info panel
const contextInfo = document.createElement('div');
contextInfo.id = 'contextInfo';
document.body.appendChild(contextInfo);

// Example Rive animation URL - replace with your own
const riveUrl = 'https://cdn.rive.app/animations/vehicles.riv';

// Store all instances
const instances = [];
let instanceCount = 0;

// Store debug graphics
const debugGraphics = new PIXI.Graphics();
app.stage.addChild(debugGraphics);

// Function to calculate grid layout
function calculateGridLayout(count) {
    if (count <= 1) return { cols: 1, rows: 1 };
    if (count <= 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 9) return { cols: 3, rows: 3 };
    return { cols: 3, rows: 3 }; // Cap at 9 instances
}

// Function to position instances in grid
function updateGridLayout() {
    const layout = calculateGridLayout(instances.length);
    
    // Calculate cell dimensions
    const cellWidth = app.screen.width / layout.cols;
    const cellHeight = app.screen.height / layout.rows;
    
    // Use 90% of the smallest cell dimension to ensure padding
    const size = Math.min(cellWidth, cellHeight) * 0.9;
    
    // Clear previous debug graphics
    debugGraphics.clear();
    
    // Draw debug grid
    debugGraphics.lineStyle(2, 0x00ff00, 0.5);  // 2px green line with 0.5 alpha
    
    // Draw all cells in the grid
    for (let row = 0; row < layout.rows; row++) {
        for (let col = 0; col < layout.cols; col++) {
            // Draw cell border
            debugGraphics.drawRect(
                cellWidth * col,           // x
                cellHeight * row,          // y
                cellWidth,                 // width
                cellHeight                 // height
            );
            
            // Calculate center position of this cell
            const centerX = cellWidth * col + (cellWidth / 2);
            const centerY = cellHeight * row + (cellHeight / 2);
            
            // Draw the actual content area (square, centered in cell)
            debugGraphics.lineStyle(1, 0xff0000, 0.5);  // 1px red line with 0.5 alpha
            debugGraphics.drawRect(
                centerX - (size / 2),    // x (centered)
                centerY - (size / 2),    // y (centered)
                size,                    // width
                size                     // height
            );
        }
    }
    
    instances.forEach((sprite, index) => {
        const row = Math.floor(index / layout.cols);
        const col = index % layout.cols;
        
        // Calculate center position of each cell
        const centerX = cellWidth * col + (cellWidth / 2);
        const centerY = cellHeight * row + (cellHeight / 2);
        
        // Position sprite at cell center (since anchor is 0.5)
        sprite.x = centerX;
        sprite.y = centerY;
        
        // Set size and update
        sprite.maxWidth = size;
        sprite.maxHeight = size;
        
        // Set fit mode to ensure animation fills the space properly
        sprite.fit = Fit.Fill;
        
        // Update the sprite size
        sprite.updateSize();
    });
}

// Function to create a new instance
function createNewInstance() {
    if (instances.length >= 9) {
        console.log('Maximum number of instances reached (9)');
        return;
    }

    const riveSprite = new RiveSprite({
        asset: riveUrl,
        autoPlay: true,
        interactive: true,
        fit: Fit.Fill,  // Use Fill to ensure animation takes up the full space
        align: Alignment.Center
    });

    // Set the anchor point to center for proper positioning
    riveSprite.anchor.set(0.5, 0.5);

    // Add to stage and instances array
    app.stage.addChild(riveSprite);
    instances.push(riveSprite);

    // Update layout immediately
    updateGridLayout();
}

// Add click handler for the button
document.getElementById('addButton').addEventListener('click', createNewInstance);

// Create first instance
createNewInstance();

// Handle window resize
window.addEventListener('resize', () => {
    updateGridLayout();
    updateContextInfo();
});

// Add stats to the animation loop
app.ticker.add(() => {
    stats.update();
}); 

// Update context info
function updateContextInfo() {
  const renderer = app.renderer;
  const gl = renderer.gl;
  
  contextInfo.innerHTML = `
      Pixi: ${gl.getParameter(gl.RENDERER)}<br>
  `;
}

updateContextInfo();