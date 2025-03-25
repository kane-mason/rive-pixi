# Rive-Pixi Test Page

This directory contains test files for the Rive-Pixi integration.

## Running the Tests

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to the URL shown in the terminal (typically http://localhost:5173)

## Test Files

- `index.html`: Main test page that demonstrates the Rive-Pixi integration
  - Loads a sample Rive animation from Rive's CDN
  - Displays it in a PixiJS application
  - Centers the animation on screen
  - Handles window resizing

## Customizing Tests

You can replace the sample Rive animation by changing the `riveUrl` in `index.html` to point to your own Rive animation file. 