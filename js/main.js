/* =============================================================================
   Novaryn — interactions

   Ported from the Claude Design component. Four canvas systems:
     field()   — drifting particle field with cursor repulsion (hero + CTA)
     mesh()    — deterministic blob-graph in the Picsly card
     orbital() — concentric orbits in the hero figure
   plus scroll reveals, magnetic hover, count-up stats, and the process rail.
   ============================================================================= */

(() => {
  "use strict";

  /* Design-component props, resolved once at their defaults. */
  const CONFIG = {
    accent: "#017346",
    particleDensity: 1,
    motionSpeed: 1,
    magneticHover: true,
    scrollReveal: true
  };

  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SPEED = CONFIG.motionSpeed * (reduce ? 0.25 : 1);

  const hexRgb = (h) => {
    const s = h.replace("#", "");
    const v = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
    const n = parseInt(v, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  const ACCENT = hexRgb(CONFIG.accent);
  const rgba = (a) => "rgba(" + ACCENT[0] + "," + ACCENT[1] + "," + ACCENT[2] + "," + a + ")";
  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

  /* ===========================================================================
     Particle field — hero and CTA backdrops
     =========================================================================== */

  function field(canvas, opt) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const state = {
      w: 0, h: 0, parts: [], mx: -9999, my: -9999,
      active: false, t: Math.random() * 1000, raf: 0, vis: true
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const d = dpr();
      state.w = r.width;
      state.h = r.height;
      canvas.width = Math.round(r.width * d);
      canvas.height = Math.round(r.height * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);

      const target = Math.max(24, Math.min(280, Math.round(r.width * r.height * opt.density)));
      const p = state.parts;
      while (p.length > target) p.pop();
      while (p.length < target) {
        p.push({
          x: Math.random() * r.width,
          y: Math.random() * r.height,
          vx: 0, vy: 0,
          ph: Math.random() * Math.PI * 2,
          r: opt.dot[0] + Math.random() * (opt.dot[1] - opt.dot[0]),
          e: 0
        });
      }
    };
    resize();
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver((es) => { state.vis = es[0].isIntersecting; }, { threshold: 0 }).observe(canvas);

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      state.mx = e.clientX - r.left;
      state.my = e.clientY - r.top;
      state.active = state.mx > -80 && state.my > -80 &&
                     state.mx < r.width + 80 && state.my < r.height + 80;
    };
    const onLeave = () => { state.active = false; state.mx = -9999; state.my = -9999; };

    /* Click shoves nearby particles outward, then friction reels them back. */
    const onDown = (e) => {
      const r = canvas.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      if (cx < 0 || cy < 0 || cx > r.width || cy > r.height) return;
      state.parts.forEach((p) => {
        const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
        if (d < 260) {
          const f = (1 - d / 260) * 7;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
          p.e = 1;
        }
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("blur", onLeave);

    const draw = () => {
      state.raf = requestAnimationFrame(draw);
      if (!state.vis || !state.w) return;
      state.t += 0.0022 * SPEED;

      const p = state.parts, n = p.length, C = opt.connect;
      ctx.clearRect(0, 0, state.w, state.h);

      for (let i = 0; i < n; i++) {
        const a = p[i];
        const ang = Math.sin(a.x * 0.0035 + state.t) * 1.7 +
                    Math.cos(a.y * 0.0031 - state.t * 1.3) * 1.7 +
                    a.ph * 0.15;
        a.vx += Math.cos(ang) * 0.035 * SPEED;
        a.vy += Math.sin(ang) * 0.035 * SPEED;

        if (opt.interactive && state.active) {
          const dx = a.x - state.mx, dy = a.y - state.my, d2 = dx * dx + dy * dy;
          const R = 150;
          if (d2 < R * R) {
            const d = Math.sqrt(d2) || 1, f = 1 - d / R;
            a.vx += (dx / d) * f * 1.05;
            a.vy += (dy / d) * f * 1.05;
            a.e = Math.max(a.e, f);
          }
        }

        a.e *= 0.94;
        a.vx *= 0.955;
        a.vy *= 0.955;
        const sp = Math.hypot(a.vx, a.vy);
        if (sp > 3.2) { a.vx = a.vx / sp * 3.2; a.vy = a.vy / sp * 3.2; }
        a.x += a.vx;
        a.y += a.vy;
        if (a.x < -20) a.x = state.w + 20; else if (a.x > state.w + 20) a.x = -20;
        if (a.y < -20) a.y = state.h + 20; else if (a.y > state.h + 20) a.y = -20;
      }

      /* Links between neighbours — accent-tinted where the cursor has passed. */
      ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const a = p[i];
        for (let j = i + 1; j < n; j++) {
          const b = p[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          if (dx > C || dx < -C || dy > C || dy < -C) continue;
          const d = Math.hypot(dx, dy);
          if (d > C) continue;
          const t = 1 - d / C, e = Math.max(a.e, b.e);
          ctx.strokeStyle = e > 0.06
            ? rgba((t * 0.5 * e + t * 0.06).toFixed(3))
            : "rgba(23,23,23," + (t * 0.1).toFixed(3) + ")";
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      /* Spokes from the cursor to whatever is within reach. */
      if (opt.interactive && state.active) {
        ctx.strokeStyle = rgba(0.22);
        for (let i = 0; i < n; i++) {
          const a = p[i], d = Math.hypot(a.x - state.mx, a.y - state.my);
          if (d < 130) {
            ctx.globalAlpha = 1 - d / 130;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(state.mx, state.my);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }

      for (let i = 0; i < n; i++) {
        const a = p[i];
        const e = Math.min(1, a.e * 1.6);
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r * (1 + e * 0.7), 0, Math.PI * 2);
        ctx.fillStyle = e > 0.05 ? rgba((0.35 + e * 0.6).toFixed(3)) : "rgba(64,64,64,0.42)";
        ctx.fill();
      }
    };
    state.raf = requestAnimationFrame(draw);
  }

  /* ===========================================================================
     Blob mesh — the Picsly card visual
     =========================================================================== */

  function mesh(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const st = { w: 0, h: 0, nodes: [], edges: [], mx: -9999, my: -9999, raf: 0, vis: true, t: 0, frames: 0 };

    /* Seeded PRNG so the graph is identical on every load. */
    const rnd = ((s) => () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)(20260804);

    const build = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const d = dpr();
      st.w = r.width;
      st.h = r.height;
      canvas.width = Math.round(r.width * d);
      canvas.height = Math.round(r.height * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);

      const cx = r.width / 2, cy = r.height / 2;
      const R = Math.min(r.width, r.height) * 0.42;
      const N = 60, M = 24;
      const nodes = [];

      /* Rim: three summed sines give the outline its irregular, organic edge. */
      for (let i = 0; i < N; i++) {
        const th = (i / N) * Math.PI * 2;
        const rad = R * (1 +
          0.115 * Math.sin(th * 3 + 0.7) +
          0.07 * Math.sin(th * 7 + 2.1) +
          0.045 * Math.sin(th * 13 + 4.3));
        nodes.push({ bx: cx + Math.cos(th) * rad, by: cy + Math.sin(th) * rad, x: 0, y: 0, vx: 0, vy: 0, e: 0, edge: true, th: th });
      }
      for (let i = 0; i < M; i++) {
        const th = rnd() * Math.PI * 2, rad = R * (0.12 + rnd() * 0.72);
        nodes.push({ bx: cx + Math.cos(th) * rad, by: cy + Math.sin(th) * rad, x: 0, y: 0, vx: 0, vy: 0, e: 0, edge: false, th: th });
      }
      nodes.forEach((n) => { n.x = n.bx; n.y = n.by; });

      const edges = [];
      for (let i = 0; i < N; i++) {
        edges.push({ a: i, b: (i + 1) % N, w: 4.2, o: 0.72 });
        edges.push({ a: i, b: (i + 2) % N, w: 1.5, o: 0.34 });
        if (i % 2 === 0) edges.push({ a: i, b: (i + 4) % N, w: 1, o: 0.2 });
      }
      /* Interior nodes wire to their seven nearest neighbours. */
      for (let i = N; i < N + M; i++) {
        const dl = [];
        for (let j = 0; j < N + M; j++) {
          if (j === i) continue;
          dl.push([Math.hypot(nodes[i].bx - nodes[j].bx, nodes[i].by - nodes[j].by), j]);
        }
        dl.sort((p, q) => p[0] - q[0]);
        for (let k = 0; k < 7 && k < dl.length; k++) edges.push({ a: i, b: dl[k][1], w: 1.1, o: 0.3 });
      }
      for (let k = 0; k < 74; k++) {
        const a = Math.floor(rnd() * N), b = Math.floor(rnd() * (N + M));
        if (a !== b) edges.push({ a: a, b: b, w: 0.8, o: 0.17 });
      }

      st.nodes = nodes;
      st.edges = edges;
    };
    build();
    new ResizeObserver(build).observe(canvas);
    new IntersectionObserver((es) => { st.vis = es[0].isIntersecting; }, { threshold: 0 }).observe(canvas);

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      st.mx = e.clientX - r.left;
      st.my = e.clientY - r.top;
    };
    const onDown = (e) => {
      const r = canvas.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      if (cx < 0 || cy < 0 || cx > r.width || cy > r.height) return;
      st.nodes.forEach((n) => {
        const dx = n.x - cx, dy = n.y - cy, d = Math.hypot(dx, dy) || 1;
        if (d < 240) {
          const f = (1 - d / 240) * 9;
          n.vx += (dx / d) * f;
          n.vy += (dy / d) * f;
          n.e = 1;
        }
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });

    const draw = () => {
      st.raf = requestAnimationFrame(draw);
      if (!st.w) return;
      /* Run the first ~90 frames even while offscreen so it settles before reveal. */
      if (!st.vis && st.frames > 90) return;
      st.frames++;
      st.t += 0.012 * SPEED;

      const n = st.nodes, E = st.edges;
      ctx.clearRect(0, 0, st.w, st.h);

      for (let i = 0; i < n.length; i++) {
        const p = n[i];
        const bx = p.bx + Math.sin(st.t * 0.8 + p.th * 2.3) * (p.edge ? 3.4 : 2);
        const by = p.by + Math.cos(st.t * 0.7 + p.th * 1.9) * (p.edge ? 3.4 : 2);
        p.vx += (bx - p.x) * 0.045;
        p.vy += (by - p.y) * 0.045;

        const dx = p.x - st.mx, dy = p.y - st.my, d = Math.hypot(dx, dy);
        const R = 120;
        if (d < R) {
          const f = 1 - d / R;
          p.vx += (dx / (d || 1)) * f * 2.2;
          p.vy += (dy / (d || 1)) * f * 2.2;
          p.e = Math.max(p.e, f);
        }
        p.e *= 0.94;
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.x += p.vx;
        p.y += p.vy;
      }

      ctx.lineCap = "round";
      for (let k = 0; k < E.length; k++) {
        const e = E[k], a = n[e.a], b = n[e.b];
        const act = Math.min(1, Math.max(a.e, b.e) * 1.6);
        ctx.lineWidth = e.w * (1 + act * 0.5);
        ctx.strokeStyle = act > 0.05
          ? rgba(Math.min(0.95, e.o + act * 0.5).toFixed(3))
          : "rgba(23,23,23," + e.o.toFixed(3) + ")";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      for (let i = 0; i < n.length; i++) {
        const p = n[i];
        const act = Math.min(1, p.e * 1.7);
        ctx.beginPath();
        ctx.arc(p.x, p.y, (p.edge ? 2.4 : 1.8) * (1 + act * 0.9), 0, Math.PI * 2);
        ctx.fillStyle = act > 0.05 ? rgba((0.5 + act * 0.5).toFixed(3)) : "rgba(23,23,23,0.7)";
        ctx.fill();
      }
    };
    st.raf = requestAnimationFrame(draw);
  }

  /* ===========================================================================
     Orbits — the hero figure
     =========================================================================== */

  function orbital(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const st = { w: 0, h: 0, nodes: [], mx: -9999, my: -9999, raf: 0, vis: true, t: 0 };

    const build = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      const d = dpr();
      st.w = r.width;
      st.h = r.height;
      canvas.width = Math.round(r.width * d);
      canvas.height = Math.round(r.height * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);

      const min = Math.min(r.width, r.height) / 2;
      const orbits = [
        { rad: min * 0.34, n: 6, spd: 0.16 },
        { rad: min * 0.58, n: 11, spd: -0.1 },
        { rad: min * 0.82, n: 16, spd: 0.06 },
        { rad: min * 0.97, n: 9, spd: -0.035 }
      ];
      st.nodes = [];
      orbits.forEach((o, oi) => {
        for (let i = 0; i < o.n; i++) {
          st.nodes.push({
            rad: o.rad,
            a: (i / o.n) * Math.PI * 2 + oi * 0.4,
            spd: o.spd,
            x: 0, y: 0, ox: 0, oy: 0, e: 0, ring: oi,
            r: oi === 3 ? 1.6 : oi === 0 ? 3 : 2.1
          });
        }
      });
    };
    build();
    new ResizeObserver(build).observe(canvas);
    new IntersectionObserver((es) => { st.vis = es[0].isIntersecting; }, { threshold: 0 }).observe(canvas);

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      st.mx = e.clientX - r.left;
      st.my = e.clientY - r.top;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const draw = () => {
      st.raf = requestAnimationFrame(draw);
      if (!st.vis || !st.w) return;
      st.t += 0.016 * SPEED;

      const cx = st.w / 2, cy = st.h / 2, n = st.nodes;
      ctx.clearRect(0, 0, st.w, st.h);

      for (let i = 0; i < n.length; i++) {
        const p = n[i];
        p.a += p.spd * 0.006 * SPEED;
        const wob = Math.sin(st.t * 0.9 + p.a * 2 + p.ring) * (p.ring === 3 ? 4 : 7);
        const x = cx + Math.cos(p.a) * (p.rad + wob);
        const y = cy + Math.sin(p.a) * (p.rad + wob);

        /* Nodes get pushed off their orbit near the cursor, then ease back. */
        const dx = x - st.mx, dy = y - st.my, d = Math.hypot(dx, dy);
        const R = 140;
        if (d < R) {
          const f = 1 - d / R;
          p.ox += ((dx / (d || 1)) * f * 38 - p.ox) * 0.14;
          p.oy += ((dy / (d || 1)) * f * 38 - p.oy) * 0.14;
          p.e = Math.max(p.e, f);
        } else {
          p.ox += (0 - p.ox) * 0.07;
          p.oy += (0 - p.oy) * 0.07;
        }
        p.e *= 0.95;
        p.x = x + p.ox;
        p.y = y + p.oy;
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < n.length; i++) {
        const a = n[i];
        for (let j = i + 1; j < n.length; j++) {
          const b = n[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          if (dx > 96 || dx < -96 || dy > 96 || dy < -96) continue;
          const d = Math.hypot(dx, dy);
          if (d > 96) continue;
          const t = 1 - d / 96, e = Math.max(a.e, b.e);
          ctx.strokeStyle = e > 0.06
            ? rgba((t * 0.55 * e + t * 0.07).toFixed(3))
            : "rgba(23,23,23," + (t * 0.13).toFixed(3) + ")";
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (let i = 0; i < n.length; i++) {
        const p = n[i];
        if (p.ring === 0) {
          ctx.strokeStyle = rgba(0.16);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }
        const e = Math.min(1, p.e * 1.7);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + e * 0.8), 0, Math.PI * 2);
        ctx.fillStyle = e > 0.05
          ? rgba((0.4 + e * 0.55).toFixed(3))
          : (p.ring === 0 ? "rgba(1,115,70,0.55)" : "rgba(64,64,64,0.4)");
        ctx.fill();
      }
    };
    st.raf = requestAnimationFrame(draw);
  }

  /* ===========================================================================
     Scroll reveals
     =========================================================================== */

  function reveals() {
    const nodes = Array.from(document.querySelectorAll("[data-reveal]"));
    if (!nodes.length) return;

    if (CONFIG.scrollReveal === false || reduce) return;

    nodes.forEach((n) => {
      n.style.opacity = "0";
      n.style.transform = "translate3d(0,22px,0)";
      n.style.transition = "opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1)";
      n.style.transitionDelay = parseInt(n.dataset.delay || "0", 10) + "ms";
      n.style.willChange = "opacity, transform";
    });

    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.style.opacity = "1";
        e.target.style.transform = "translate3d(0,0,0)";
        io.unobserve(e.target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });

    nodes.forEach((n) => io.observe(n));
  }

  /* ===========================================================================
     Magnetic hover
     =========================================================================== */

  function magnets() {
    if (CONFIG.magneticHover === false || reduce) return;

    document.querySelectorAll("[data-magnet]").forEach((el) => {
      const amt = parseFloat(el.dataset.magnet) || 5;
      const base = el.style.transform || "";
      let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;

      const tick = () => {
        raf = 0;
        cx += (tx - cx) * 0.18;
        cy += (ty - cy) * 0.18;
        el.style.transform = base + " translate3d(" + cx.toFixed(2) + "px," + cy.toFixed(2) + "px,0)";
        if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) raf = requestAnimationFrame(tick);
      };
      const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        tx = ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * amt;
        ty = ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * amt;
        kick();
      });
      el.addEventListener("pointerleave", () => { tx = 0; ty = 0; kick(); });
    });
  }

  /* ===========================================================================
     Count-up stats
     =========================================================================== */

  function counters() {
    const nodes = Array.from(document.querySelectorAll("[data-count]"));
    if (!nodes.length) return;

    const io = new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        io.unobserve(el);

        const target = parseFloat(el.dataset.count);
        const dec = parseInt(el.dataset.decimals || "0", 10);
        const suffix = el.dataset.suffix || "";

        if (reduce) {
          el.textContent = target.toFixed(dec) + suffix;
          return;
        }

        const start = performance.now(), dur = 1400;
        const step = (now) => {
          const t = Math.min(1, (now - start) / dur);
          const k = 1 - Math.pow(1 - t, 3);
          el.textContent = (target * k).toFixed(dec) + suffix;
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.4 });

    nodes.forEach((n) => io.observe(n));
  }

  /* ===========================================================================
     Process rail — fills as the list scrolls past three-quarter height
     =========================================================================== */

  function progress() {
    const wrap = document.querySelector(".process-list");
    const bar = document.querySelector(".process-progress");
    if (!wrap || !bar) return;

    const onScroll = () => {
      const r = wrap.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (window.innerHeight * 0.75 - r.top) / (r.height || 1)));
      bar.style.transform = "scaleY(" + p.toFixed(4) + ")";
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
  }

  /* ===========================================================================
     Mobile nav
     =========================================================================== */

  function mobileNav() {
    const toggle = document.querySelector(".nav-toggle");
    const menu = document.querySelector(".mobile-nav");
    if (!toggle || !menu) return;

    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menu.hidden = !open;
    };

    toggle.addEventListener("click", () => {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    menu.addEventListener("click", (e) => {
      if (e.target.tagName === "A") setOpen(false);
    });
    /* Leaving the mobile breakpoint should not strand the panel open. */
    window.matchMedia("(min-width: 901px)").addEventListener("change", (e) => {
      if (e.matches) setOpen(false);
    });
  }

  /* ===========================================================================
     Boot
     =========================================================================== */

  const init = () => {
    const density = CONFIG.particleDensity;

    field(document.querySelector(".hero-canvas"), {
      density: 0.00016 * density, connect: 118, dot: [1.1, 2.6], interactive: true
    });
    field(document.querySelector(".cta-canvas"), {
      density: 0.00009 * density, connect: 130, dot: [1, 2.4], interactive: true
    });
    mesh(document.querySelector(".work-canvas"));
    orbital(document.querySelector(".figure-canvas"));

    reveals();
    magnets();
    counters();
    progress();
    mobileNav();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
