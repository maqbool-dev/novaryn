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
  if (morph && !reduceMotion) {
    const canvas = morph.querySelector(".morph-canvas");
    const morphHead = morph.querySelector(".morph-head");
    const morphImgB = morph.querySelector(".morph-img-b");
    const heroFigure = document.querySelector(".hero-figure");
    const heroSubject = document.querySelector(".hero .subject");
    const ctx = canvas.getContext("2d");
    let pairs = [];
    let startY = 40;
    let endY = 1;
    let unpinY = 1;
    let targetP = 0;
    let shownP = -1;
    let rafOn = false;

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
      const narrow = w <= 1100;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // A = the hero subject's box in DOCUMENT coords, so particles start glued
      // to the real hero figure and travel with it as it scrolls. offsetWidth
      // ignores the img's load-in transform; on mobile the figure wrapper is
      // full-width with the img centered inside, so centre within its rect.
      const figRect = heroFigure.getBoundingClientRect();
      const subjW = heroSubject.offsetWidth || Math.round(figRect.width) || 500;
      const aX = figRect.left + (figRect.width - subjW) / 2;
      const aY = figRect.top + window.scrollY;
      // B = the profile's resting spot in VIEWPORT coords (stage is pinned
      // there): left of centre on desktop, centred and nudged down on mobile
      // so it clears the section copy at the top of the stage
      const bX = narrow ? Math.max((w - subjW) / 2, 8) : w * 0.1;
      const bYExtra = narrow ? h * 0.08 : 0;
      // pin the crisp profile img to the exact box the particles converge on,
      // so the end-of-morph crossfade never shifts position or size
      const subjHB = Math.round(subjW * (imgB.naturalHeight / imgB.naturalWidth));
      morphImgB.style.width = `${subjW}px`;
      morphImgB.style.left = `${bX}px`;
      morphImgB.style.top = `${(h - subjHB) / 2 + bYExtra}px`;
      morphImgB.style.transform = "none";
      // particle budget scales with viewport so phones stay smooth
      const budget = w < 720 ? 2200 : narrow ? 3200 : 4500;
      const ampScale = Math.max(0.55, Math.min(w / 1200, 1));
      let stride = Math.max(3, Math.round(Math.sqrt((subjW * subjW * 0.45) / budget)));
      const make = (img, ox, oy, centerB) => {
        const subjH = Math.round(subjW * (img.naturalHeight / img.naturalWidth));
        return samplePoints(img, subjW, subjH, stride, ox, centerB ? (h - subjH) / 2 + bYExtra : oy);
      };
      let a = make(imgA, aX, aY, false);
      let b = make(imgB, bX, 0, true);
      while (Math.max(a.length, b.length) > budget * 1.45 && stride < 12) {
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
          amp: (40 + Math.random() * 110) * ampScale,
          size: 1.5 + Math.random() * 1.5,
        };
      }
      startY = 40;
      // the scrub completes at ~72% of the pinned distance — the remaining
      // scroll is dwell room so the eased animation finishes while the stage
      // is still pinned, even on fast flings
      const pinRange = Math.max(morph.offsetHeight - h, 1);
      const pinTop = morph.getBoundingClientRect().top + window.scrollY;
      unpinY = pinTop + pinRange;
      endY = pinTop + pinRange * 0.72;
      shownP = -1; // force a restyle on the next scrub
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

    const applyState = (p, scrollNow) => {
      // nothing to do while parked at either end — cheap early-out replaces
      // the IntersectionObserver gate now that the scene starts at page top
      const parked = p === shownP && (p === 0 || p === 1);
      shownP = p;
      if (parked) return;
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

    const computeTarget = () =>
      Math.min(Math.max((window.scrollY - startY) / (endY - startY), 0), 1);

    // anchor-link jumps (nav, "explore services") shouldn't be caught by the
    // scroll hold below — let them snap straight through the scene instead
    let snapUntil = 0;
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", () => { snapUntil = performance.now() + 1700; });
    });

    // shown progress eases toward the scroll target each frame, so the scene
    // glides through wheel steps and touch flicks instead of jumping per event
    const tick = () => {
      targetP = computeTarget();
      const snap = performance.now() < snapUntil;
      const gap = targetP - shownP;
      // if a fling outruns the dwell room, complete instantly the moment the
      // stage would unpin — the figure is never carried away half-formed
      const mustFinish = targetP === 1 && window.scrollY >= unpinY - 8;
      // catch up faster on big jumps and on the final approach
      const factor = targetP === 1 ? 0.45 : Math.abs(gap) > 0.2 ? 0.3 : 0.16;
      const next =
        snap || mustFinish || shownP < 0 || Math.abs(gap) < 0.001
          ? targetP
          : shownP + gap * factor;
      applyState(next, window.scrollY);
      if (shownP !== targetP) {
        requestAnimationFrame(tick);
      } else {
        rafOn = false;
      }
    };

    const scrub = () => {
      if (document.hidden) { // rAF is suspended while hidden — snap directly
        applyState(computeTarget(), window.scrollY);
        return;
      }
      if (rafOn) return;
      rafOn = true;
      requestAnimationFrame(tick);
    };

    const morphImgs = ["assets/subject-cutout.png", "assets/subject-profile.png"].map((src) => {
      const im = new Image();
      im.src = src;
      return im;
    });
    // wait on load, not decode() — decode promises stall in background tabs
    const imgReady = (im) =>
      im.complete && im.naturalWidth
        ? Promise.resolve()
        : new Promise((res, rej) => {
            im.addEventListener("load", res, { once: true });
            im.addEventListener("error", rej, { once: true });
          });
    Promise.all(morphImgs.map(imgReady))
      .then(() => {
        build(morphImgs[0], morphImgs[1]);
        morph.classList.add("is-canvas");
        scrub();
        // re-anchor whenever late-arriving layout (hero image, fonts, load)
        // shifts the sections the particle coordinates were sampled against
        let rebuildT = null;
        const scheduleRebuild = () => {
          clearTimeout(rebuildT);
          rebuildT = setTimeout(() => {
            build(morphImgs[0], morphImgs[1]);
            scrub();
          }, 120);
        };
        if (document.readyState === "complete") scheduleRebuild();
        else window.addEventListener("load", scheduleRebuild);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleRebuild);
        window.addEventListener("scroll", scrub, { passive: true });
        let lastW = window.innerWidth;
        let lastH = window.innerHeight;
        window.addEventListener("resize", () => {
          // ignore height-only wobble from mobile URL bars collapsing —
          // rebuilding mid-scroll would make the scene jump
          if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 140) return;
          lastW = window.innerWidth;
          lastH = window.innerHeight;
          scheduleRebuild();
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
