import Matter from 'matter-js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { engine, world, createBodyForElement, cleanPhysicsWorld, enableMouseInteraction } from './physics-engine';
import { setZeroGParticles } from './three-bg';

const { World, Body, Composite } = Matter;

let floatableElements = [];
let mappedBodies = [];
let animFrameId = null;
let isPhysicsActive = false;

// Save original inline styles to restore later
const originalStylesMap = new Map();

export function setupDOMMapping() {
  // Find all elements to participate in physics
  floatableElements = Array.from(document.querySelectorAll('.floatable'));
}

export function engageZeroG() {
  if (isPhysicsActive) return;
  isPhysicsActive = true;

  // Add active class to body (locks scrollbar)
  document.body.classList.add('physics-active');

  // Reveal fixed physics control panel
  const panel = document.getElementById('physics-panel');
  if (panel) panel.classList.remove('translate-y-32');

  // Lock scroll position
  const scrollY = window.scrollY;
  document.body.style.top = `-${scrollY}px`;
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';

  // Update Three.js particles to drift upward
  setZeroGParticles(true);

  // Kill any active GSAP animations on floatable elements and clear inline styles
  gsap.killTweensOf(floatableElements);
  gsap.set(floatableElements, { clearProps: 'all' });

  // Map each HTML element to a Matter.js body
  mappedBodies = floatableElements.map(element => {
    const rect = element.getBoundingClientRect();
    
    // Save original styles for restoration
    originalStylesMap.set(element, {
      position: element.style.position,
      left: element.style.left,
      top: element.style.top,
      width: element.style.width,
      height: element.style.height,
      transform: element.style.transform,
      margin: element.style.margin,
      zIndex: element.style.zIndex
    });

    // Create Matter.js body
    const body = createBodyForElement(rect, element);

    // Apply styles to floatable to transition to fixed layout without shifting visually
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
    element.style.position = 'fixed';
    element.style.left = '0px';
    element.style.top = '0px';
    element.style.margin = '0px';
    element.style.zIndex = '50';
    
    // Position it at its initial center using translate
    const initialX = rect.left;
    const initialY = rect.top;
    element.style.transform = `translate3d(${initialX}px, ${initialY}px, 0px) rotate(0rad)`;
    
    // Add physics-active class
    element.classList.add('floatable-active');

    // Add slightly random initial forces so they float up dynamically
    const forceMagnitude = 0.02 * body.mass;
    const angle = Math.random() * Math.PI * 2;
    Body.applyForce(body, body.position, {
      x: Math.cos(angle) * forceMagnitude * 0.2,
      y: -forceMagnitude * (0.8 + Math.random() * 0.4) // Force upwards
    });

    // Add random torque/spin
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.05);

    return body;
  });

  // Add all bodies to the Matter.js world
  World.add(world, mappedBodies);

  // Enable mouse controls during physics freefall
  enableMouseInteraction();

  // Set physics engine gravity to slow negative (pulling up)
  world.gravity.y = -0.15;

  // Start the render/update loop
  runPhysicsLoop();
}

function runPhysicsLoop() {
  if (!isPhysicsActive) return;

  // Step the Matter.js engine (approx 60fps)
  Matter.Engine.update(engine, 16.66);

  // Sync DOM elements with Matter.js bodies
  mappedBodies.forEach(body => {
    const element = body.domElement;
    if (!element) return;

    const width = element.offsetWidth;
    const height = element.offsetHeight;

    // Center coordinates to top-left translation coordinates
    const tx = body.position.x - width / 2;
    const ty = body.position.y - height / 2;

    // Apply position and rotation using hardware-accelerated translate3d
    element.style.transform = `translate3d(${tx}px, ${ty}px, 0px) rotate(${body.angle}rad)`;
  });

  animFrameId = requestAnimationFrame(runPhysicsLoop);
}

export function restoreGravity() {
  if (!isPhysicsActive) return;
  isPhysicsActive = false;

  // Stop physics animation loop
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  // Slide down control panel
  const panel = document.getElementById('physics-panel');
  if (panel) panel.classList.add('translate-y-32');

  // Stop particle drift upward
  setZeroGParticles(false);

  // Unlock scroll
  const scrollY = parseInt(document.body.style.top || '0') * -1;
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  document.body.classList.remove('physics-active');
  window.scrollTo(0, scrollY);

  // Get current positions of floating elements (for starting the transition)
  const currentPositions = mappedBodies.map(body => {
    return {
      element: body.domElement,
      x: body.position.x - body.domElement.offsetWidth / 2,
      y: body.position.y - body.domElement.offsetHeight / 2,
      angle: body.angle
    };
  });

  // Clean physics engine structures
  cleanPhysicsWorld();
  mappedBodies = [];

  // Animate elements back to original positions
  currentPositions.forEach(({ element, x, y, angle }) => {
    // 1. Temporarily restore original static styling classes
    element.classList.remove('floatable-active');
    
    const saved = originalStylesMap.get(element);
    if (!saved) return;

    // Reapply original styles to let browser layout it correctly
    element.style.position = saved.position;
    element.style.left = saved.left;
    element.style.top = saved.top;
    element.style.width = saved.width;
    element.style.height = saved.height;
    element.style.transform = saved.transform;
    element.style.margin = saved.margin;
    element.style.zIndex = saved.zIndex;

    // 2. Measure the static layout coordinates relative to current scroll
    const targetRect = element.getBoundingClientRect();

    // 3. Immediately switch back to absolute positioning at the floating coordinates to start GSAP animation
    element.style.position = 'fixed';
    element.style.width = `${targetRect.width}px`;
    element.style.height = `${targetRect.height}px`;
    element.style.left = '0px';
    element.style.top = '0px';
    element.style.margin = '0px';
    element.style.zIndex = '50';
    element.style.transform = `translate3d(${x}px, ${y}px, 0px) rotate(${angle}rad)`;

    // 4. Run GSAP tween from current floating coordinates to the static layout coordinates
    gsap.to(element, {
      x: targetRect.left,
      y: targetRect.top,
      rotation: 0,
      duration: 1.0,
      ease: 'power3.out',
      onComplete: () => {
        // 5. Restore full original styles to lock it back into grid layout
        element.style.position = saved.position;
        element.style.left = saved.left;
        element.style.top = saved.top;
        element.style.width = saved.width;
        element.style.height = saved.height;
        element.style.transform = saved.transform;
        element.style.margin = saved.margin;
        element.style.zIndex = saved.zIndex;
      }
    });
  });

  // Re-initialize physics world in idle state for the next switch
  setTimeout(() => {
    setupDOMMapping();
    ScrollTrigger.refresh();
  }, 1100);
}
