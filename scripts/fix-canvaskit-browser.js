const fs = require('fs');
const path = require('path');

// Fix canvaskit-wasm to disable Node.js modules in browser
const packageJsonPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'canvaskit-wasm',
  'package.json'
);

try {
  const packageJson = require(packageJsonPath);

  packageJson.browser = {
    fs: false,
    path: false,
    os: false,
  };

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log('✓ Fixed canvaskit-wasm browser compatibility');
} catch (error) {
  console.log('⚠ Could not fix canvaskit-wasm (may not be installed yet):', error.message);
}
