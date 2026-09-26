import { initGhostFibers } from './ghost-fibers.js';

function init() {
  // Initialize GhostFibers on the hero background
  const heroBg = document.querySelector('.hero-bg');
  if (heroBg) {
    initGhostFibers(heroBg, {
      lineColor: '#ff2d55',
      glowColor: '#a21caf',
      scale: 1.5,
      speed: 0.15
    });
  }
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;
      
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({
          behavior: 'smooth'
        });
      }
    });
  });

  // Simple reveal animation on scroll
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = 1;
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Apply reveal to cards
  const elementsToReveal = document.querySelectorAll('.service-card, .sidebar-card, .intro-card, .cta-card');
  elementsToReveal.forEach(el => {
    el.style.opacity = 0;
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
    observer.observe(el);
  });
  // --- Past Works Backend Logic ---
  let pastWorksData = [];
  const gridContainer = document.getElementById('past-works-grid');
  const filtersContainer = document.getElementById('filter-container');

  function renderPastWorks(data) {
    gridContainer.innerHTML = '';
    if (data.length === 0) {
      gridContainer.innerHTML = '<p style="color: var(--color-mute);">No works found for this category.</p>';
      return;
    }
    
    data.forEach((work, index) => {
      const card = document.createElement('div');
      // Using animation delay based on index for staggered fade-in
      card.className = 'fade-in-up h-full';
      card.style.animationDelay = `${Math.min(index * 0.06, 0.3)}s`;
      
      card.innerHTML = `
        <article class="project-card flex h-full cursor-pointer flex-col gap-4 rounded-[1.5rem] border border-foreground/10 bg-background p-4 sm:p-5 hover:border-foreground/20 hover:bg-foreground/[0.02] transition-all duration-300 shadow-sm" onclick="window.location.href='project-detail.html?id=${work.id}'">
          <!-- Header -->
          <header class="flex items-center gap-3">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-foreground/10 bg-foreground/5 text-foreground/70">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            </div>
            <span class="text-[14px] font-semibold tracking-wide text-foreground uppercase">
              ${work.category}
            </span>
          </header>

          <!-- Image -->
          <div class="relative w-full overflow-hidden rounded-xl border border-foreground/5 bg-foreground/5" style="aspect-ratio: 4/5;">
            <img src="${work.image}" alt="${work.title}" class="object-cover w-full h-full transition-transform duration-700 hover:scale-105" onerror="this.src='https://placehold.co/600x400/171717/333333?text=Work'">
          </div>

          <!-- Content -->
          <div class="flex flex-col gap-2.5 pb-1">
            <h3 class="text-[18px] font-semibold leading-[1.3] tracking-tight text-foreground sm:text-[20px]">
              ${work.title}
            </h3>
            <p class="text-[14px] leading-[1.6] text-foreground/60">
              ${work.description}
            </p>
          </div>

          <!-- Footer -->
          <div class="mt-auto pt-3">
            <p class="text-[12px] tracking-tight text-foreground/40 font-medium">
              TEAM BROTHERS, 2024
            </p>
          </div>
        </article>
      `;
      gridContainer.appendChild(card);
    });
  }

  if (gridContainer && filtersContainer) {
    // Fetch the JSON "backend" data from the Node.js API
    fetch('/api/past-works')
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        pastWorksData = data;
        let dataToRender = pastWorksData;
        if (window.location.pathname === '/' || window.location.pathname.endsWith('/index.html')) {
          dataToRender = pastWorksData.slice(0, 4);
        }
        renderPastWorks(dataToRender);

        // Dynamically generate category filters based on data
        const uniqueCategories = [...new Set(pastWorksData.map(work => work.category))];
        
        // Add ALL button first
        const allBtn = document.createElement('button');
        allBtn.className = 'filter-btn active';
        allBtn.setAttribute('data-category', 'all');
        allBtn.textContent = 'ALL';
        filtersContainer.appendChild(allBtn);

        uniqueCategories.forEach(category => {
          if (!category) return;
          const btn = document.createElement('button');
          btn.className = 'filter-btn';
          btn.setAttribute('data-category', category);
          btn.textContent = category;
          filtersContainer.appendChild(btn);
        });
      })
      .catch(error => {
        console.error('Error loading past works:', error);
        gridContainer.innerHTML = '<p style="color: var(--color-flare);">Failed to load past works data.</p>';
      });

    // Filter Buttons Logic via Event Delegation
    filtersContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('filter-btn')) {
        // Update active state
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        const selectedCategory = e.target.getAttribute('data-category');
        
        // Filter data
        let filteredData = selectedCategory === 'all' 
          ? pastWorksData 
          : pastWorksData.filter(work => work.category === selectedCategory);
        
        if (window.location.pathname === '/' || window.location.pathname.endsWith('/index.html')) {
          filteredData = filteredData.slice(0, 4);
        }
        
        renderPastWorks(filteredData);
      }
    });
  }

  // --- Ongoing Events Logic ---
  const ongoingEventsContainer = document.getElementById('ongoing-events-grid');

  if (ongoingEventsContainer) {
    fetch('/api/ongoing-events')
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(events => {
        if (!events || events.length === 0) {
          ongoingEventsContainer.innerHTML = '<p class="text-sm text-foreground/60">No ongoing events right now.</p>';
          return;
        }

        ongoingEventsContainer.innerHTML = events.map(event => {
          const prizeText = event.prize_pool ? `₹${Number(event.prize_pool).toLocaleString('en-IN')}` : 'Prize Pool TBA';
          return `
            <article class="project-card mx-auto flex h-full w-full cursor-pointer flex-col gap-3 rounded-[1.5rem] border border-foreground/10 bg-background p-3 shadow-sm transition-all duration-300 hover:border-foreground/20 hover:bg-foreground/[0.02] sm:p-4" onclick="window.location.href='ongoing-events.html'">
              <div class="relative w-full overflow-hidden rounded-xl border border-foreground/5 bg-foreground/5" style="aspect-ratio: 4/5;">
                <img src="${event.image}" alt="${event.title}" class="h-full w-full object-cover transition-transform duration-700 hover:scale-105" onerror="this.src='https://placehold.co/800x600/171717/333333?text=Event'">
              </div>

              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/60">${event.category || 'Event'}</span>
                <span class="rounded-full border border-foreground/10 bg-foreground/5 px-2 py-1 text-[10px] font-medium text-foreground/80">${prizeText}</span>
              </div>

              <div class="flex flex-col gap-2 pb-1">
                <h3 class="text-[15px] font-semibold leading-[1.25] tracking-tight text-foreground sm:text-[17px]">${event.title}</h3>
                <p class="text-[12px] leading-[1.5] text-foreground/60">${event.description || 'Live tournament action is currently running.'}</p>
              </div>

              <div class="mt-auto flex items-center justify-between gap-2 pt-1">
                <span class="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#ff2d55]">
                  <span class="h-2 w-2 rounded-full bg-[#ff2d55] shadow-[0_0_16px_rgba(255,45,85,0.9)]"></span>
                  Live
                </span>
                <a href="ongoing-events.html" class="inline-flex items-center justify-center rounded-full border border-foreground/10 bg-foreground px-3 py-1.5 text-[10px] font-semibold text-background transition-transform hover:scale-[1.02]" onclick="event.stopPropagation();">
                  Join Now
                </a>
              </div>
            </article>
          `;
        }).join('');

        ongoingEventsContainer.style.gridTemplateColumns = 'repeat(2, minmax(0, 478px))';
        ongoingEventsContainer.style.justifyContent = 'center';

        ongoingEventsContainer.querySelectorAll('article').forEach(card => {
          card.style.width = '100%';
          card.style.maxWidth = '478px';
          card.style.minWidth = '0';
        });
      })
      .catch(error => {
        console.error('Error loading ongoing events:', error);
        ongoingEventsContainer.innerHTML = '<p class="text-sm text-foreground/60">Unable to load ongoing events.</p>';
      });
  }

  // --- Custom Cursor Logic ---
  const cursorLayer = document.querySelector('.cursor-layer');
  const cursorDot = document.querySelector('.cursor-dot');
  const cursorTrails = [...document.querySelectorAll('.cursor-trail')];

  if (cursorLayer && cursorDot && cursorTrails.length) {
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;

    const trailState = cursorTrails.map((trail, index) => ({
      x: mouseX,
      y: mouseY,
      trail,
      index
    }));

    document.addEventListener('pointermove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursorLayer.classList.add('visible');
    });

    document.addEventListener('pointerleave', () => {
      cursorLayer.classList.remove('visible');
    });

    const animateCursor = () => {
      cursorDot.style.left = `${mouseX}px`;
      cursorDot.style.top = `${mouseY}px`;

      trailState.forEach((item, index) => {
        const factor = (index + 1) / trailState.length;
        item.x += (mouseX - item.x) * (0.18 + index * 0.04);
        item.y += (mouseY - item.y) * (0.18 + index * 0.04);
        item.trail.style.left = `${item.x}px`;
        item.trail.style.top = `${item.y}px`;
        item.trail.style.opacity = String(0.9 - factor * 0.75);
        item.trail.style.transform = `translate(-50%, -50%) scale(${1 - factor * 0.3})`;
      });

      requestAnimationFrame(animateCursor);
    };

    requestAnimationFrame(animateCursor);
  }

  // --- Theme Toggle Logic ---
  const themeToggle = document.getElementById('theme-toggle');
  const htmlEl = document.documentElement;
  
  function updateThemeIcons() {
    const isDark = htmlEl.classList.contains('dark');
    const sunIcon = document.getElementById('icon-sun');
    const moonIcon = document.getElementById('icon-moon');
    if(sunIcon && moonIcon) {
      if(isDark) {
        sunIcon.classList.remove('rotate-0', 'scale-100', 'opacity-100');
        sunIcon.classList.add('-rotate-90', 'scale-0', 'opacity-0');
        moonIcon.classList.remove('rotate-90', 'scale-0', 'opacity-0');
        moonIcon.classList.add('rotate-0', 'scale-100', 'opacity-100');
      } else {
        sunIcon.classList.add('rotate-0', 'scale-100', 'opacity-100');
        sunIcon.classList.remove('-rotate-90', 'scale-0', 'opacity-0');
        moonIcon.classList.add('rotate-90', 'scale-0', 'opacity-0');
        moonIcon.classList.remove('rotate-0', 'scale-100', 'opacity-100');
      }
    }
  }

  // Set initial state based on localStorage
  if(localStorage.getItem('theme') === 'light') {
    htmlEl.classList.remove('dark');
  } else {
    htmlEl.classList.add('dark');
  }
  updateThemeIcons();

  if(themeToggle) {
    themeToggle.addEventListener('click', () => {
      if(htmlEl.classList.contains('dark')) {
        htmlEl.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      } else {
        htmlEl.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      }
      updateThemeIcons();
    });
  }

  // --- Scroll Spy Logic ---
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  function updateNav() {
    let currentId = '';
    const scrollY = window.pageYOffset;
    sections.forEach(section => {
      const sectionTop = section.offsetTop - 200;
      const sectionHeight = section.offsetHeight;
      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        currentId = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('text-foreground');
      link.classList.add('text-foreground/60');
      if (link.getAttribute('href') === `#${currentId}`) {
        link.classList.remove('text-foreground/60');
        link.classList.add('text-foreground');
      }
    });
  }
  
  window.addEventListener('scroll', updateNav);
  updateNav();
}

// --- Real-time Analytics Tracking ---
function initAnalytics() {
  // Generate or retrieve a session ID for the current browsing session
  let sessionId = sessionStorage.getItem('tb_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('tb_session_id', sessionId);
    
    // Start session
    fetch('/api/analytics/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId })
    }).catch(err => console.error('Analytics start error:', err));
  }

  // Heartbeat every 30 seconds
  setInterval(() => {
    fetch('/api/analytics/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId })
    }).catch(err => console.error('Analytics heartbeat error:', err));
  }, 30000);

  // Track interactions (clicks)
  document.addEventListener('click', () => {
    fetch('/api/analytics/interaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId })
    }).catch(err => console.error('Analytics interaction error:', err));
  });
}

async function initSiteContent() {
  try {
    const res = await fetch('/api/site-content');
    if (!res.ok) return;
    const content = await res.json();
    
    if (content.hero) {
      if (content.hero.eyebrow) {
        const eyebrowEl = document.getElementById('hero-eyebrow');
        if (eyebrowEl) eyebrowEl.innerHTML = content.hero.eyebrow;
      }
      if (content.hero.headline) {
        const headlineEl = document.getElementById('hero-headline');
        if (headlineEl) headlineEl.innerHTML = content.hero.headline;
      }
    }
  } catch (err) {
    console.error('Failed to load site content:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    initAnalytics();
    initSiteContent();
  });
} else {
  init();
  initAnalytics();
  initSiteContent();
}
