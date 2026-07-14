/* NOVARYN — interactions */
(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Load sequence ---------- */
  const start = () => {
    document.body.classList.add("is-loaded");
    const delay = reduceMotion ? 0 : 1300;
    setTimeout(() => {
      document.querySelectorAll(".stat-band, .hero-bracket").forEach((el) => el.classList.add("is-in"));
    }, delay);
  };
  if (reduceMotion) {
    start();
  } else if (document.readyState === "complete") {
    // hold the curtain long enough for one full orbit of the dot
    setTimeout(start, 700);
  } else {
    window.addEventListener("load", () => setTimeout(start, 700));
    // safety: never leave the curtain up
    setTimeout(start, 3000);
  }

  /* ---------- Logo dot orbit (always completes the full loop) ---------- */
  document.querySelectorAll(".logo").forEach((logo) => {
    const dot = logo.querySelector(".logo-dot");
    if (!dot) return;
    logo.addEventListener("mouseenter", () => {
      if (reduceMotion) return;
      dot.classList.add("is-orbiting");
    });
    dot.addEventListener("animationend", () => dot.classList.remove("is-orbiting"));
  });

  /* ---------- Header state ---------- */
  const header = document.querySelector(".site-header");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".mobile-menu");
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", open);
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", !open);
    document.body.style.overflow = open ? "hidden" : "";
  };
  toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));

  /* ---------- Scroll reveals (staggered per section) ---------- */
  const revealEls = document.querySelectorAll(".reveal");
  revealEls.forEach((el) => {
    const siblings = el.parentElement.querySelectorAll(":scope > .reveal");
    const i = Array.from(siblings).indexOf(el);
    if (i > 0) el.style.setProperty("--d", `${Math.min(i * 0.12, 0.5)}s`);
  });
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -6% 0px" }
  );
  revealEls.forEach((el) => revealObserver.observe(el));

  /* ---------- Counters ---------- */
  const animateCount = (el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const suffix = el.dataset.suffix || "";
    const duration = 1600;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const countObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (reduceMotion) {
            const el = entry.target;
            el.textContent = parseFloat(el.dataset.count).toFixed(parseInt(el.dataset.decimals || "0", 10)) + (el.dataset.suffix || "");
          } else {
            // hero counters wait for the load curtain to lift so the count-up is seen
            const delay = entry.target.closest(".hero") ? 1250 : 0;
            const el = entry.target;
            el.textContent = "0";
            setTimeout(() => animateCount(el), delay);
          }
          countObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.6 }
  );
  document.querySelectorAll("[data-count]").forEach((el) => countObserver.observe(el));

  /* ---------- Magnetic buttons ---------- */
  if (!reduceMotion && matchMedia("(pointer: fine)").matches) {
    document.querySelectorAll(".magnetic").forEach((btn) => {
      const strength = 8;
      btn.addEventListener("mousemove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width - 0.5) * 2;
        const y = ((e.clientY - r.top) / r.height - 0.5) * 2;
        btn.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "";
      });
    });
  }

  /* ---------- Stat band / bracket alignment ---------- */
  const band = document.querySelector(".stat-band");
  const bracket = document.querySelector(".hero-bracket");
  const statBlock = document.querySelector(".stat-block");
  const hero = document.querySelector(".hero");
  const alignBand = () => {
    if (!band || !statBlock) return;
    const heroRect = hero.getBoundingClientRect();
    const statRect = statBlock.getBoundingClientRect();
    const top = statRect.top - heroRect.top;
    band.style.top = `${top}px`;
    band.style.height = `${statRect.height}px`;
    if (bracket) {
      const bTop = heroRect.height * 0.265;
      bracket.style.height = `${Math.max(top + 24 - bTop, 40)}px`;
    }
  };
  alignBand();
  window.addEventListener("resize", alignBand);
  window.addEventListener("load", alignBand);

  /* ---------- Morph scene: subject dissolves to particles, reforms in profile ---------- */
  const morph = document.querySelector(".morph");
  const morphDesktop = window.matchMedia("(min-width: 1101px)");
  if (morph && !reduceMotion && morphDesktop.matches) {
    const canvas = morph.querySelector(".morph-canvas");
    const morphHead = morph.querySelector(".morph-head");
    const heroFigure = document.querySelector(".hero-figure");
    const ctx = canvas.getContext("2d");
    let pairs = [];
    let startY = 40;
    let endY = 1;
    let progress = -1;
    let morphRaf = null;

    const samplePoints = (img, w, h, stride, offsetX, offsetY) => {
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const octx = off.getContext("2d", { willReadFrequently: true });
      octx.drawImage(img, 0, 0, w, h);
      const data = octx.getImageData(0, 0, w, h).data;
      const pts = [];
      for (let y = 0; y < h; y += stride) {
        for (let x = 0; x < w; x += stride) {
          const i = (y * w + x) * 4;
          if (data[i + 3] > 128) {
            pts.push({ x: offsetX + x, y: offsetY + y, c: `rgb(${data[i]},${data[i + 1]},${data[i + 2]})` });
          }
        }
      }
      return pts;
    };

    const shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    const build = (imgA, imgB) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // A = the hero subject's box in DOCUMENT coords, so particles start glued
      // to the real hero figure and travel with it as it scrolls; the figure
      // wrapper is used because the img itself is transformed during load-in
      const subjRect = heroFigure.getBoundingClientRect();
      const subjW = Math.round(subjRect.width) || 500;
      const aX = subjRect.left;
      const aY = subjRect.top + window.scrollY;
      // B = the profile's resting spot in VIEWPORT coords (stage is pinned there)
      const bX = w * 0.1;
      // target ~4.5k particles whatever the subject size; silhouette covers ~45% of its box
      let stride = Math.max(4, Math.round(Math.sqrt((subjW * subjW * 0.45) / 4500)));
      const make = (img, ox, oy, centerB) => {
        const subjH = Math.round(subjW * (img.naturalHeight / img.naturalWidth));
        return samplePoints(img, subjW, subjH, stride, ox, centerB ? (h - subjH) / 2 : oy);
      };
      let a = make(imgA, aX, aY, false);
      let b = make(imgB, bX, 0, true);
      while (Math.max(a.length, b.length) > 6500 && stride < 12) {
        stride++;
        a = make(imgA, aX, aY, false);
        b = make(imgB, bX, 0, true);
      }
      shuffle(a);
      shuffle(b);
      // pair 1:1, wrapping the shorter set so every particle has a partner
      const n = Math.max(a.length, b.length);
      pairs = new Array(n);
      for (let i = 0; i < n; i++) {
        const theta = Math.random() * Math.PI * 2;
        pairs[i] = {
          a: a[i % a.length],
          b: b[i % b.length],
          dx: Math.cos(theta),
          dy: Math.sin(theta),
          amp: 40 + Math.random() * 110,
          size: 1.5 + Math.random() * 1.5,
        };
      }
      startY = 40;
      endY = morph.getBoundingClientRect().top + window.scrollY + Math.max(morph.offsetHeight - h, 1);
      progress = -1; // force a restyle on the next scrub
    };

    const draw = (p, scrollNow) => {
      // smoothstep keeps particles near the hero early on, so the dissolve
      // starts gently while the subject is still in view
      const pe = p * p * (3 - 2 * p);
      const scatter = Math.sin(p * Math.PI);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < pairs.length; i++) {
        const pt = pairs[i];
        const aYs = pt.a.y - scrollNow; // A rides along with the page scroll
        const x = pt.a.x + (pt.b.x - pt.a.x) * pe + pt.dx * pt.amp * scatter;
        const y = aYs + (pt.b.y - aYs) * pe + pt.dy * pt.amp * scatter;
        ctx.fillStyle = p < 0.5 ? pt.a.c : pt.b.c;
        ctx.fillRect(x, y, pt.size, pt.size);
      }
    };

    const scrub = () => {
      const run = () => {
        const scrollNow = window.scrollY;
        const p = Math.min(Math.max((scrollNow - startY) / (endY - startY), 0), 1);
        morphRaf = null;
        // nothing to do while parked at either end — cheap early-out replaces
        // the IntersectionObserver gate now that the scene starts at page top
        if (p === progress && (p === 0 || p === 1)) return;
        progress = p;
        if (p === 0) {
          canvas.style.opacity = "0";
          heroFigure.style.opacity = "";
          morphHead.style.opacity = "0";
          morph.classList.remove("morph-done");
          return;
        }
        if (p === 1) {
          canvas.style.opacity = "0";
          heroFigure.style.opacity = "";
          morphHead.style.opacity = "1";
          morph.classList.add("morph-done");
          return;
        }
        // hand-off: the real hero figure fades to the particle canvas over the
        // first few percent of the scrub, and back again when scrolling up
        const intro = Math.min(p / 0.05, 1);
        canvas.style.opacity = intro.toFixed(3);
        heroFigure.style.opacity = (1 - intro).toFixed(3);
        morphHead.style.opacity = Math.min(Math.max((p - 0.55) / 0.3, 0), 1).toFixed(3);
        morph.classList.remove("morph-done");
        draw(p, scrollNow);
      };
      if (document.hidden) { run(); return; } // rAF is suspended while hidden
      if (morphRaf) return;
      morphRaf = requestAnimationFrame(run);
    };

    const morphImgs = ["assets/subject-cutout.png", "assets/subject-profile.png"].map((src) => {
      const im = new Image();
      im.src = src;
      return im;
    });
    Promise.all(morphImgs.map((im) => im.decode()))
      .then(() => {
        build(morphImgs[0], morphImgs[1]);
        morph.classList.add("is-canvas");
        scrub();
        window.addEventListener("scroll", scrub, { passive: true });
        let morphResizeT = null;
        window.addEventListener("resize", () => {
          clearTimeout(morphResizeT);
          morphResizeT = setTimeout(() => {
            build(morphImgs[0], morphImgs[1]);
            scrub();
          }, 150);
        });
      })
      .catch(() => { /* image load failed — the static fallback img stays visible */ });
  }

  /* ---------- Service rows: wipe follows the cursor's entry/exit edge ---------- */
  document.querySelectorAll(".service-row").forEach((row) => {
    const setDir = (e) => {
      const r = row.getBoundingClientRect();
      row.classList.toggle("wipe-bottom", e.clientY > r.top + r.height / 2);
    };
    row.addEventListener("mouseenter", setDir);
    row.addEventListener("mouseleave", setDir);
  });

  /* ---------- Active nav link on scroll ---------- */
  const sections = ["services", "work", "process", "contact"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const navLinks = document.querySelectorAll(".main-nav .nav-link");
  const setActive = (id) => {
    navLinks.forEach((l) => l.classList.toggle("is-active", l.getAttribute("href") === `#${id}`));
  };
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  sections.forEach((s) => sectionObserver.observe(s));
  window.addEventListener("scroll", () => {
    if (window.scrollY < 300) setActive("top");
  }, { passive: true });
})();
