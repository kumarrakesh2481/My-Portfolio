import * as THREE from 'three';

let scene, camera, renderer;

// Fluid Particle System
let particles;
const particleCount = 1000; // Optimized for O(N^2) membrane calculations at 60fps
let positions = [];
let velocities = [];
let colors = [];
let initialSpeeds = [];

// Fluid Membranes (Surface Tension Lines)
let lineGeometry, lineSegments;
const maxDistance = 65; // Short distance for viscous liquid look

// Mouse tracking
let mouseX = 0, mouseY = 0;
let targetX = 0, targetY = 0;
const windowHalfX = window.innerWidth / 2;
const windowHalfY = window.innerHeight / 2;

// Mouse fluid interaction coordinates
let mouseWorld = new THREE.Vector3();

// Zero-G drift state
let isZeroG = false;

// Shockwave state
let shockwaveCenter = new THREE.Vector3();
let shockwaveTime = 0;
const SHOCKWAVE_SPEED = 16;
const MAX_SHOCKWAVE_RADIUS = 400;
let isShockwaveActive = false;

// Generate glowing circular sprite texture for fluid droplets
function createFluidTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  
  // Radial gradient simulating a viscous droplet glow
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.2, 'rgba(6, 182, 212, 0.85)'); // Cyan core
  gradient.addColorStop(0.6, 'rgba(139, 92, 246, 0.3)');  // Violet halo
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function initThreeBackground() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas) return;

  // Scene & Fog
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x030712, 0.0015);

  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2000);
  camera.position.z = 500;

  // WebGL Renderer
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Initialize Fluid Particles
  const geometry = new THREE.BufferGeometry();
  const texture = createFluidTexture();

  for (let i = 0; i < particleCount; i++) {
    // Distribute in a spherical liquid blob shape initially
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = Math.cbrt(Math.random()) * 450; // volume radius

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = (Math.random() - 0.5) * 300;

    positions.push(x, y, z);
    
    // Initial velocity
    velocities.push(
      (Math.random() - 0.5) * 1.0,
      (Math.random() - 0.5) * 1.0,
      (Math.random() - 0.5) * 0.5
    );

    initialSpeeds.push(0.4 + Math.random() * 0.8);

    // Liquid color mixing (Cyan/Blue/Magenta/Purple gradient blend)
    const mix = Math.random();
    const color = new THREE.Color();
    if (mix < 0.33) {
      color.lerpColors(new THREE.Color(0x06b6d4), new THREE.Color(0x3b82f6), mix * 3); // Cyan to Blue
    } else if (mix < 0.66) {
      color.lerpColors(new THREE.Color(0x3b82f6), new THREE.Color(0x8b5cf6), (mix - 0.33) * 3); // Blue to Violet
    } else {
      color.lerpColors(new THREE.Color(0x8b5cf6), new THREE.Color(0xd946ef), (mix - 0.66) * 3); // Violet to Magenta
    }
    colors.push(color.r, color.g, color.b);
  }

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 15,
    map: texture,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.9
  });

  particles = new THREE.Points(geometry, material);
  scene.add(particles);

  // Initialize Fluid Membrane Lines (Surface Tension segments)
  lineGeometry = new THREE.BufferGeometry();
  const maxLineVertices = particleCount * 6 * 3; // Cap connections to prevent performance drops
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxLineVertices), 3));
  lineGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(maxLineVertices), 3));

  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    linewidth: 2.0
  });

  lineSegments = new THREE.LineSegments(lineGeometry, lineMat);
  scene.add(lineSegments);

  // Listeners
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('click', triggerShockwave);
  window.addEventListener('resize', onWindowResize);

  animate(0);
}

function onMouseMove(event) {
  mouseX = event.clientX - windowHalfX;
  mouseY = event.clientY - windowHalfY;

  // Approximate mouse position in 3D world space for fluid vortex
  mouseWorld.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    - (event.clientY / window.innerHeight) * 2 + 1,
    0.5
  );
  mouseWorld.unproject(camera);
  // Bring close to coordinates plane
  const dir = mouseWorld.clone().sub(camera.position).normalize();
  const distance = - camera.position.z / dir.z;
  mouseWorld.copy(camera.position).add(dir.multiplyScalar(distance));
}

function triggerShockwave(event) {
  // Convert click to 3D center coords
  const x = ((event.clientX / window.innerWidth) * 2 - 1) * 350;
  const y = (- (event.clientY / window.innerHeight) * 2 + 1) * 350;

  shockwaveCenter.set(x, y, 0);
  shockwaveTime = 0;
  isShockwaveActive = true;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

export function setZeroGParticles(active) {
  isZeroG = active;
}

let lastTime = 0;
function animate(time) {
  requestAnimationFrame(animate);

  const delta = (time - lastTime) * 0.05 || 0.5;
  lastTime = time;

  // Smoothing mouse coordinates
  targetX += (mouseX * 0.15 - targetX) * 0.04;
  targetY += (mouseY * 0.15 - targetY) * 0.04;

  // Parallax scene rotations
  scene.rotation.y = targetX * 0.0008;
  scene.rotation.x = targetY * 0.0008;

  // Dynamic 3D zoom & pan based on scroll height
  const scrollY = window.scrollY;
  const targetCamZ = Math.max(280, 500 - scrollY * 0.35); // Physically zooms in closer on scroll!
  camera.position.z += (targetCamZ - camera.position.z) * 0.06 * delta;

  // Shift height on scroll
  scene.position.y = scrollY * 0.22;

  // Handle click fluid shockwave ripple radius expansion
  let currentWaveRadius = 0;
  if (isShockwaveActive) {
    shockwaveTime += delta;
    currentWaveRadius = shockwaveTime * SHOCKWAVE_SPEED;
    if (currentWaveRadius > MAX_SHOCKWAVE_RADIUS) {
      isShockwaveActive = false;
    }
  }

  // Update Fluid Particles Positions
  const posAttr = particles.geometry.attributes.position;
  const array = posAttr.array;

  for (let i = 0; i < particleCount; i++) {
    const idx = i * 3;
    let px = array[idx];
    let py = array[idx + 1];
    let pz = array[idx + 2];

    // 1. Fluid Turbulence Currents (Simulated curl noise vector field)
    const timeScale = time * 0.0004;
    const forceX = Math.sin(py * 0.004 + timeScale) * Math.cos(pz * 0.003) * 0.9;
    const forceY = Math.cos(px * 0.004 - timeScale) * Math.sin(pz * 0.003) * 0.9;
    const forceZ = Math.sin(px * 0.004 + timeScale) * Math.cos(py * 0.004) * 0.4;

    // Apply drift velocity
    if (isZeroG) {
      // In zero-g mode, bubbles flow upwards
      array[idx + 1] += initialSpeeds[i] * 2.2 * delta;
      
      // Wrap top bounds
      if (array[idx + 1] > 600) {
        array[idx + 1] = -600;
        array[idx] = (Math.random() - 0.5) * 800;
      }
    } else {
      velocities[idx] += forceX * 0.08 * delta;
      velocities[idx + 1] += forceY * 0.08 * delta;
      velocities[idx + 2] += forceZ * 0.08 * delta;

      // Damping drag force to simulate fluid viscosity
      velocities[idx] *= 0.98;
      velocities[idx + 1] *= 0.98;
      velocities[idx + 2] *= 0.98;

      array[idx] += velocities[idx] * delta;
      array[idx + 1] += velocities[idx + 1] * delta;
      array[idx + 2] += velocities[idx + 2] * delta;

      // Contain particles inside a fluid boundary cylinder
      const boundaryRadius = 550;
      const dist2D = Math.sqrt(px*px + py*py);
      if (dist2D > boundaryRadius) {
        array[idx] *= 0.97;
        array[idx + 1] *= 0.97;
        velocities[idx] *= -0.5;
        velocities[idx + 1] *= -0.5;
      }
      if (Math.abs(pz) > 280) {
        velocities[idx + 2] *= -0.5;
        array[idx + 2] *= 0.97;
      }
    }

    // 2. Interactive Mouse Fluid Vortex (swirl fluid around cursor)
    const dxMouse = px - mouseWorld.x;
    const dyMouse = py - (mouseWorld.y + scrollY * 0.22); // Offset scroll
    const distMouse = Math.sqrt(dxMouse*dxMouse + dyMouse*dyMouse);
    const hoverRadius = 160;

    if (distMouse < hoverRadius) {
      const swirlForce = (1.0 - distMouse / hoverRadius) * 5.0 * delta;
      
      // Tangent vector clockwise swirl: (-dy, dx)
      array[idx] += (-dyMouse / distMouse) * swirlForce;
      array[idx + 1] += (dxMouse / distMouse) * swirlForce;
      
      // Pull particles slightly closer (suction effect)
      array[idx] += (-dxMouse / distMouse) * swirlForce * 0.15;
      array[idx + 1] += (-dyMouse / distMouse) * swirlForce * 0.15;
    }

    // 3. Click Fluid Shockwave Ripple
    if (isShockwaveActive) {
      const dxClick = px - shockwaveCenter.x;
      const dyClick = py - (shockwaveCenter.y + scrollY * 0.22);
      const dzClick = pz - shockwaveCenter.z;
      const distClick = Math.sqrt(dxClick*dxClick + dyClick*dyClick + dzClick*dzClick);

      const waveWidth = 90;
      if (distClick < currentWaveRadius && distClick > currentWaveRadius - waveWidth) {
        const falloff = 1.0 - (currentWaveRadius - distClick) / waveWidth;
        const pushForce = falloff * 15 * delta;
        array[idx] += (dxClick / distClick) * pushForce;
        array[idx + 1] += (dyClick / distClick) * pushForce;
        array[idx + 2] += (dzClick / distClick) * pushForce * 0.5;
      }
    }
  }
  posAttr.needsUpdate = true;

  // Build Fluid Membrane Connection Segments (Surface Tension drawing)
  const linePosAttr = lineGeometry.attributes.position;
  const lineColAttr = lineGeometry.attributes.color;
  const lPosArray = linePosAttr.array;
  const lColArray = lineColAttr.array;

  let lineCount = 0;
  const maxLines = particleCount * 6; // Cap to keep render locked at 60fps

  for (let i = 0; i < particleCount; i++) {
    for (let j = i + 1; j < particleCount; j++) {
      const idxA = i * 3;
      const idxB = j * 3;

      const dx = array[idxA] - array[idxB];
      const dy = array[idxA + 1] - array[idxB + 1];
      const dz = array[idxA + 2] - array[idxB + 2];
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

      if (dist < maxDistance && lineCount < maxLines) {
        const lIdx = lineCount * 6;

        // Position coordinates
        lPosArray[lIdx] = array[idxA];
        lPosArray[lIdx + 1] = array[idxA + 1];
        lPosArray[lIdx + 2] = array[idxA + 2];
        lPosArray[lIdx + 3] = array[idxB];
        lPosArray[lIdx + 4] = array[idxB + 1];
        lPosArray[lIdx + 5] = array[idxB + 2];

        // Translucent liquid color glow
        const alpha = (1.0 - dist / maxDistance) * 0.55;

        // Node A color (Cyan scale)
        lColArray[lIdx] = colors[idxA] * alpha;
        lColArray[lIdx + 1] = colors[idxA + 1] * alpha;
        lColArray[lIdx + 2] = colors[idxA + 2] * alpha;

        // Node B color (Magenta scale)
        lColArray[lIdx + 3] = colors[idxB] * alpha;
        lColArray[lIdx + 4] = colors[idxB + 1] * alpha;
        lColArray[lIdx + 5] = colors[idxB + 2] * alpha;

        lineCount++;
      }
    }
  }

  // Draw lines
  lineGeometry.setDrawRange(0, lineCount * 2);
  linePosAttr.needsUpdate = true;
  lineColAttr.needsUpdate = true;

  // Add small continuous rotation to scene
  particles.rotation.z += 0.0004 * delta;
  lineSegments.rotation.z += 0.0004 * delta;

  renderer.render(scene, camera);
}

let isLightMode = false;
export function toggleThreeTheme(isLight) {
  isLightMode = isLight;
  if (!scene || !particles) return;
  
  const colorsAttr = particles.geometry.attributes.color;
  const cArray = colorsAttr.array;

  if (isLightMode) {
    // Light Mode WebGL styling
    scene.fog.color.setHex(0xf1f5f9);
    
    ambientLight.color.setHex(0xcbd5e1);
    ambientLight.intensity = 0.85;

    pointLight.color.setHex(0x6d28d9); // Deep Violet
    pointLight.intensity = 1.3;

    // Darker, high contrast particles for light mode background
    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      const mixColor = new THREE.Color();
      mixColor.lerpColors(new THREE.Color(0x4c1d95), new THREE.Color(0x0e7490), Math.random()); // Slate-violet to dark-cyan
      cArray[idx] = mixColor.r;
      cArray[idx + 1] = mixColor.g;
      cArray[idx + 2] = mixColor.b;
      
      // Update global colors array for connection line segment drawings
      colors[idx] = mixColor.r;
      colors[idx + 1] = mixColor.g;
      colors[idx + 2] = mixColor.b;
    }
  } else {
    // Dark Mode WebGL styling
    scene.fog.color.setHex(0x030712);
    
    ambientLight.color.setHex(0x1e293b);
    ambientLight.intensity = 0.3;

    pointLight.color.setHex(0xfff7ed);
    pointLight.intensity = 2.2;

    // Neon bright particles for dark mode background
    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3;
      const mix = Math.random();
      const color = new THREE.Color();
      if (mix < 0.33) {
        color.lerpColors(new THREE.Color(0x06b6d4), new THREE.Color(0x3b82f6), mix * 3);
      } else if (mix < 0.66) {
        color.lerpColors(new THREE.Color(0x3b82f6), new THREE.Color(0x8b5cf6), (mix - 0.33) * 3);
      } else {
        color.lerpColors(new THREE.Color(0x8b5cf6), new THREE.Color(0xd946ef), (mix - 0.66) * 3);
      }
      cArray[idx] = color.r;
      cArray[idx + 1] = color.g;
      cArray[idx + 2] = color.b;
      
      // Update global colors array for line segment drawings
      colors[idx] = color.r;
      colors[idx + 1] = color.g;
      colors[idx + 2] = color.b;
    }
  }
  colorsAttr.needsUpdate = true;
}

