import { Application } from 'pixi.js';
import { RiveSprite, Fit, Alignment } from '../dist/rive_pixi.js';

// Create the PixiJS application
const app = new Application({
    background: '#000000',
    resizeTo: window,
});
document.body.appendChild(app.view);

// Example Rive animation URL - replace with your own
const riveUrl = 'https://cdn.rive.app/animations/vehicles.riv';

// Store all instances
const instances = [];
let instanceCount = 0;

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
    const cellWidth = app.screen.width / layout.cols;
    const cellHeight = app.screen.height / layout.rows;

    instances.forEach((sprite, index) => {
        const row = Math.floor(index / layout.cols);
        const col = index % layout.cols;
        
        // Update sprite position and size
        sprite.x = cellWidth * (col + 0.5);
        sprite.y = cellHeight * (row + 0.5);
        sprite.maxWidth = cellWidth * 0.9; // 90% of cell width
        sprite.maxHeight = cellHeight * 0.9; // 90% of cell height
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
        fit: Fit.Contain,
        align: Alignment.Center
    });

    // Set the anchor point to center
    riveSprite.anchor.set(0.5, 0.5);

    // Add to stage and instances array
    app.stage.addChild(riveSprite);
    instances.push(riveSprite);

    // Update layout for all instances
    updateGridLayout();
}

// Add click handler for the button
document.getElementById('addButton').addEventListener('click', createNewInstance);

// Create first instance
createNewInstance();

// Handle window resize
window.addEventListener('resize', updateGridLayout); 