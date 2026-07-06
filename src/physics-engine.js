import Matter from 'matter-js';

const { Engine, World, Bodies, Mouse, MouseConstraint, Composite, Body } = Matter;

export let engine;
export let world;
export let mouseConstraint;
let boundaries = [];

// Screen boundary configuration
const WALL_THICKNESS = 300;

export function initPhysics() {
  // Create engine
  engine = Engine.create({
    gravity: { x: 0, y: 0, scale: 0.001 } // Start with 0 gravity, will switch dynamically
  });
  
  world = engine.world;

  // Add viewport boundaries
  createBoundaries();

  // Listen to window resizing
  window.addEventListener('resize', handleResize);
}

function createBoundaries() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Remove existing boundaries from the world
  if (boundaries.length > 0) {
    Composite.remove(world, boundaries);
  }

  // Create four boundary walls offset by half their thickness
  const ground = Bodies.rectangle(
    width / 2, 
    height + WALL_THICKNESS / 2, 
    width + WALL_THICKNESS * 2, 
    WALL_THICKNESS, 
    { isStatic: true, label: 'boundary-bottom', friction: 0.1, restitution: 0.8 }
  );
  
  const ceiling = Bodies.rectangle(
    width / 2, 
    -WALL_THICKNESS / 2, 
    width + WALL_THICKNESS * 2, 
    WALL_THICKNESS, 
    { isStatic: true, label: 'boundary-top', friction: 0.1, restitution: 0.8 }
  );
  
  const leftWall = Bodies.rectangle(
    -WALL_THICKNESS / 2, 
    height / 2, 
    WALL_THICKNESS, 
    height + WALL_THICKNESS * 2, 
    { isStatic: true, label: 'boundary-left', friction: 0.1, restitution: 0.8 }
  );
  
  const rightWall = Bodies.rectangle(
    width + WALL_THICKNESS / 2, 
    height / 2, 
    WALL_THICKNESS, 
    height + WALL_THICKNESS * 2, 
    { isStatic: true, label: 'boundary-right', friction: 0.1, restitution: 0.8 }
  );

  boundaries = [ground, ceiling, leftWall, rightWall];
  
  // Add boundaries to the world
  World.add(world, boundaries);
}

export function enableMouseInteraction() {
  if (mouseConstraint) return;

  // We bind mouse to the entire document body
  const mouse = Mouse.create(document.body);
  
  mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
      stiffness: 0.2,
      render: { visible: false }
    }
  });

  // Ensure mouse scroll is not intercepted by the physics mouse constraint
  mouseConstraint.mouse.element.removeEventListener("mousewheel", mouseConstraint.mouse.mousewheel);
  mouseConstraint.mouse.element.removeEventListener("DOMMouseScroll", mouseConstraint.mouse.mousewheel);

  World.add(world, mouseConstraint);
}

export function disableMouseInteraction() {
  if (mouseConstraint) {
    if (mouseConstraint.mouse) {
      Mouse.clearSourceEvents(mouseConstraint.mouse);
    }
    World.remove(world, mouseConstraint);
    mouseConstraint = null;
  }
}

function handleResize() {
  if (!engine) return;
  
  // Re-create boundary walls relative to the new window dimensions
  createBoundaries();
}

/**
 * Creates a dynamic body matching the dimensions of a DOM element's client bounding rectangle.
 * @param {ClientRect} rect Bounding rect of the element
 * @param {HTMLElement} element The HTML element itself
 * @returns {Matter.Body}
 */
export function createBodyForElement(rect, element) {
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  
  // Customize physics properties based on element type/size
  // Skill badges (small, rounded, bouncy) vs Project Cards (heavy, less bouncy)
  const isBadge = element.classList.contains('skill-badge');
  
  const options = {
    restitution: isBadge ? 0.8 : 0.4, // bounciness
    friction: 0.1,
    frictionAir: 0.02, // slight air resistance
    density: isBadge ? 0.001 : 0.005, // weight
    label: isBadge ? 'badge' : 'card'
  };

  // Create rectangle body
  const body = Bodies.rectangle(x, y, rect.width, rect.height, options);
  
  // Associate the element with the body
  body.domElement = element;

  return body;
}

export function startPhysicsLoop() {
  // Manual stepping is handled inside dom-mapper loop.
}

export function cleanPhysicsWorld() {
  disableMouseInteraction();
  if (engine) {
    World.clear(world, false);
    Engine.clear(engine);
    boundaries = [];
  }
}
