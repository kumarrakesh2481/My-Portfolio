import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { initThreeBackground, toggleThreeTheme } from './three-bg';
import { initPhysics } from './physics-engine';
import { setupDOMMapping, engageZeroG, restoreGravity } from './dom-mapper';

// Register GSAP ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

window.addEventListener('DOMContentLoaded', () => {
  // 1. Light/Dark Mode Theme Switcher (Initialized first for robustness)
  const themeToggle = document.getElementById('theme-toggle');
  const lightIcon = document.getElementById('theme-icon-light');
  const darkIcon = document.getElementById('theme-icon-dark');

  if (themeToggle && lightIcon && darkIcon) {
    const savedTheme = localStorage.getItem('theme');
    let isLight = savedTheme === 'light';

    const updateThemeUI = (light) => {
      if (light) {
        document.body.classList.add('light-mode');
        lightIcon.classList.remove('hidden');
        darkIcon.classList.add('hidden');
      } else {
        document.body.classList.remove('light-mode');
        lightIcon.classList.add('hidden');
        darkIcon.classList.remove('hidden');
      }
      
      // Dynamic header styling correction
      if (window.scrollY > 50) {
        gsap.set('header', {
          backgroundColor: light ? 'rgba(248, 250, 252, 0.85)' : 'rgba(3, 7, 18, 0.85)',
          borderColor: light ? 'rgba(203, 213, 225, 0.5)' : 'rgba(55, 65, 81, 0.25)'
        });
      }
      
      try {
        toggleThreeTheme(light);
      } catch (err) {
        console.warn('Three.js theme toggle deferred:', err);
      }
    };

    updateThemeUI(isLight);

    themeToggle.addEventListener('click', (e) => {
      e.preventDefault();
      isLight = !isLight;
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
      updateThemeUI(isLight);
    });
  }

  // 2. Initialize background scene
  initThreeBackground();

  // 3. Initialize physics engine (in background / waiting state)
  initPhysics();

  // 3. Set up DOM-to-Physics body mappings
  setupDOMMapping();

  // 4. Hook up controls
  const toggleBtn = document.getElementById('zero-g-toggle');
  const restoreBtn = document.getElementById('restore-gravity-btn');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Animate the button switch press briefly before activating
      gsap.to(toggleBtn, {
        scale: 0.95,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          engageZeroG();
        }
      });
    });
  }

  if (restoreBtn) {
    restoreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      restoreGravity();
    });
  }

  // 5. Build creative industry-standard scroll animations
  setupScrollAnimations();

  // 6. Interactive 3D Card Tilt effect
  setup3DTiltEffect();

  // 7. Initialize Custom Cursor Follower
  setupCustomCursor();

  // 8. Initialize Magnetic Buttons
  setupMagneticButtons();

  // 10. Initialize Typewriter Text Rotator
  setupTextRotator();
});

function setupScrollAnimations() {
  // --- Header Parallax / Shrink on Scroll ---
  ScrollTrigger.create({
    start: 'top -50',
    end: 99999,
    onEnter: () => {
      const isLight = document.body.classList.contains('light-mode');
      gsap.to('header', {
        paddingTop: '0.5rem',
        paddingBottom: '0.5rem',
        backgroundColor: isLight ? 'rgba(248, 250, 252, 0.85)' : 'rgba(3, 7, 18, 0.85)',
        borderColor: isLight ? 'rgba(203, 213, 225, 0.5)' : 'rgba(55, 65, 81, 0.25)',
        duration: 0.4,
        ease: 'power2.out'
      });
    },
    onLeaveBack: () => {
      gsap.to('header', {
        paddingTop: '1rem',
        paddingBottom: '1rem',
        backgroundColor: 'rgba(3, 7, 18, 0)',
        borderColor: 'rgba(55, 65, 81, 0)',
        duration: 0.4,
        ease: 'power2.out'
      });
    }
  });

  // --- Initial Hero Reveal ---
  gsap.from('header', {
    y: -50,
    opacity: 0,
    duration: 1,
    ease: 'power3.out'
  });

  const heroTl = gsap.timeline();
  heroTl.from('#hero h1', {
    y: 60,
    opacity: 0,
    duration: 1.4,
    ease: 'power4.out',
    delay: 0.2
  })
  .from('#hero p', {
    y: 30,
    opacity: 0,
    duration: 1,
    ease: 'power3.out'
  }, '-=1.0')
  .from('#hero div.inline-flex', {
    scale: 0.8,
    opacity: 0,
    duration: 0.8,
    ease: 'back.out(1.7)'
  }, '-=0.9')
  .from('#hero a, #hero button', {
    y: 20,
    opacity: 0,
    duration: 0.8,
    stagger: 0.12,
    ease: 'power3.out'
  }, '-=0.7');

  // --- Scroll reveals for cards and sections ---
  
  // 0. Hero Section parallax fade-out
  gsap.to('#hero > div', {
    scrollTrigger: {
      trigger: '#hero',
      start: 'top top',
      end: 'bottom top',
      scrub: 1
    },
    y: -80,
    opacity: 0,
    scale: 0.95
  });

  // 0.5. 3D Camera Earth Zoom-In Trigger
  window.earthZoomProgress = 0;
  const zoomState = { progress: 0 };
  gsap.to(zoomState, {
    scrollTrigger: {
      trigger: '#about',
      start: 'top bottom',
      end: 'top center-=50',
      scrub: 1.2,
      onUpdate: (self) => {
        window.earthZoomProgress = self.progress;
      }
    },
    progress: 1,
    ease: 'none'
  });

  // 1. About Card mask reveal
  gsap.fromTo('#about .glass-card', 
    { y: 120, opacity: 0, scale: 0.9, rotateX: 5 },
    {
      scrollTrigger: {
        trigger: '#about',
        start: 'top bottom+=100',
        end: 'top center+=100',
        scrub: 1.2
      },
      y: 0,
      opacity: 1,
      scale: 1,
      rotateX: 0,
      ease: 'power2.out'
    }
  );

  // 2. Experience & Projects Grid Cards staggered parallax
  gsap.utils.toArray('#experience .floatable').forEach((card, i) => {
    gsap.fromTo(card,
      { y: 150, opacity: 0, rotateZ: i % 2 === 0 ? -2 : 2 },
      {
        scrollTrigger: {
          trigger: card,
          start: 'top bottom+=120',
          end: 'top center-=50',
          scrub: 1.2
        },
        y: 0,
        opacity: 1,
        rotateZ: 0,
        ease: 'power2.out'
      }
    );
  });

  // 3. Staggered reveal for skills cloud badges
  gsap.utils.toArray('#skills h3').forEach((header) => {
    const parent = header.closest('div');
    const badges = parent.querySelectorAll('.skill-badge');

    gsap.fromTo(header,
      { x: -50, opacity: 0 },
      {
        scrollTrigger: {
          trigger: header,
          start: 'top bottom',
          end: 'top center+=100',
          scrub: 1
        },
        x: 0,
        opacity: 1,
        ease: 'power2.out'
      }
    );

    gsap.fromTo(badges,
      { scale: 0.7, opacity: 0 },
      {
        scrollTrigger: {
          trigger: header,
          start: 'top bottom-=50',
          end: 'top center+=50',
          scrub: 1.2
        },
        scale: 1,
        opacity: 1,
        stagger: 0.05,
        ease: 'back.out(1.5)'
      }
    );
  });

  // 4. Timeline Progress Line Growth
  gsap.to('.timeline-progress-line', {
    scrollTrigger: {
      trigger: '.timeline-container',
      start: 'top 75%',
      end: 'bottom 60%',
      scrub: 1.2
    },
    scaleY: 1,
    ease: 'none'
  });

  // 5. Timeline Nodes popup & Cards slide-in
  gsap.utils.toArray('.timeline-container .floatable').forEach((node) => {
    const marker = node.querySelector('.absolute'); // The circular marker
    
    gsap.fromTo(marker,
      { scale: 0 },
      {
        scrollTrigger: {
          trigger: node,
          start: 'top bottom',
          end: 'top center+=100',
          scrub: 1
        },
        scale: 1,
        ease: 'back.out(2)'
      }
    );

    gsap.fromTo(node,
      { x: 80, opacity: 0 },
      {
        scrollTrigger: {
          trigger: node,
          start: 'top bottom',
          end: 'top center+=50',
          scrub: 1.2
        },
        x: 0,
        opacity: 1,
        ease: 'power3.out'
      }
    );
  });

  // 6. Certifications Cards
  gsap.utils.toArray('#education .flex-1:last-child .floatable').forEach((cert) => {
    gsap.fromTo(cert,
      { y: 80, opacity: 0 },
      {
        scrollTrigger: {
          trigger: cert,
          start: 'top bottom',
          end: 'top center+=100',
          scrub: 1.2
        },
        y: 0,
        opacity: 1,
        ease: 'power3.out'
      }
    );
  });

  // 7. Contact Card Reveal
  gsap.fromTo('#contact .glass-card',
    { y: 120, opacity: 0, scale: 0.95 },
    {
      scrollTrigger: {
        trigger: '#contact',
        start: 'top bottom',
        end: 'top center+=100',
        scrub: 1.2
      },
      y: 0,
      opacity: 1,
      scale: 1,
      ease: 'power2.out'
    }
  );
}

function setup3DTiltEffect() {
  const cards = document.querySelectorAll('.glass-card');
  
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      // Avoid tilting if physics engine has taken over the element
      if (card.classList.contains('floatable-active')) return;

      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left; // x coordinate inside element
      const y = e.clientY - rect.top;  // y coordinate inside element
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Max tilt angles: 10 degrees
      const tiltX = ((y - centerY) / centerY) * -10;
      const tiltY = ((x - centerX) / centerX) * 10;

      gsap.to(card, {
        rotateX: tiltX,
        rotateY: tiltY,
        scale: 1.02,
        transformPerspective: 1000,
        ease: 'power2.out',
        duration: 0.3
      });
    });

    card.addEventListener('mouseleave', () => {
      if (card.classList.contains('floatable-active')) return;

      gsap.to(card, {
        rotateX: 0,
        rotateY: 0,
        scale: 1,
        ease: 'power2.out',
        duration: 0.5
      });
    });
  });
}

function setupCustomCursor() {
  const cursor = document.getElementById('custom-cursor');
  const follower = document.getElementById('custom-cursor-follower');
  if (!cursor || !follower) return;

  let mouseX = 0, mouseY = 0;
  let posX = 0, posY = 0;
  let fX = 0, fY = 0;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    // Unhide cursor elements on mouse move
    cursor.style.display = 'block';
    follower.style.display = 'block';
  });

  window.addEventListener('mouseout', () => {
    // Hide cursor when exiting the screen bounds
    cursor.style.display = 'none';
    follower.style.display = 'none';
  });

  // Cursor update loop using GSAP's high-precision ticker
  gsap.ticker.add(() => {
    posX += (mouseX - posX) * 0.45;
    posY += (mouseY - posY) * 0.45;
    gsap.set(cursor, { x: posX, y: posY });

    fX += (mouseX - fX) * 0.12;
    fY += (mouseY - fY) * 0.12;
    gsap.set(follower, { x: fX, y: fY });
  });

  // Snap outer ring around interactive items
  const interactives = document.querySelectorAll('a, button, .skill-badge');
  interactives.forEach(el => {
    el.addEventListener('mouseenter', () => {
      gsap.to(follower, {
        width: 46,
        height: 46,
        borderColor: '#8b5cf6', // Violet
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        duration: 0.2
      });
      gsap.to(cursor, {
        scale: 1.5,
        backgroundColor: '#06b6d4', // Cyan
        duration: 0.2
      });
    });

    el.addEventListener('mouseleave', () => {
      gsap.to(follower, {
        width: 32,
        height: 32,
        borderColor: '#06b6d4', // Cyan back
        backgroundColor: 'rgba(0, 0, 0, 0)',
        duration: 0.2
      });
      gsap.to(cursor, {
        scale: 1,
        backgroundColor: '#8b5cf6', // Violet back
        duration: 0.2
      });
    });
  });
}

function setupMagneticButtons() {
  const magnetics = document.querySelectorAll('.magnetic');
  
  magnetics.forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      // Don't attract button if physics engine is controlling it
      if (btn.classList.contains('floatable-active')) return;

      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      // Pull element towards cursor (damping multiplier: 0.35)
      gsap.to(btn, {
        x: x * 0.35,
        y: y * 0.35,
        duration: 0.35,
        ease: 'power2.out'
      });
    });
    
    btn.addEventListener('mouseleave', () => {
      if (btn.classList.contains('floatable-active')) return;

      // Snap back to center with rubber-elastic spring
      gsap.to(btn, {
        x: 0,
        y: 0,
        duration: 0.6,
        ease: 'elastic.out(1, 0.3)'
      });
    });
  });
}

function setupTextRotator() {
  const el = document.getElementById('rotator-text');
  if (!el) return;

  const words = [
    'Java Backends',
    'Scalable APIs',
    'Spring Boot Systems',
    'Interactive UIs',
    'Creative Web Apps'
  ];
  let wordIdx = 0;
  let charIdx = 0;
  let isDeleting = false;
  let typingSpeed = 100;

  function type() {
    const currentWord = words[wordIdx];
    
    if (isDeleting) {
      el.textContent = currentWord.substring(0, charIdx - 1);
      charIdx--;
      typingSpeed = 50;
    } else {
      el.textContent = currentWord.substring(0, charIdx + 1);
      charIdx++;
      typingSpeed = 100;
    }

    if (!isDeleting && charIdx === currentWord.length) {
      isDeleting = true;
      typingSpeed = 1500; // Pause at end of word
    } else if (isDeleting && charIdx === 0) {
      isDeleting = false;
      wordIdx = (wordIdx + 1) % words.length;
      typingSpeed = 400; // Pause before typing next word
    }

    setTimeout(type, typingSpeed);
  }

  type();
}

