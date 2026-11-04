// Cut-Out prototype: first screen, cursor, and a figure that reacts.
(() => {
  const $ = (id) => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const hero = $('hero'), name = $('name'), figure = $('figure'), dot = $('dot'), dotLabel = $('dotLabel');

  // ---------- Fit each line of the name to the screen.
  function fitName() {
    const lines = [...name.querySelectorAll('[data-fit]')];
    const wide = innerWidth / innerHeight >= 1.9;
    const maxW = innerWidth * (wide ? .325 : .96);
    const portrait = innerWidth <= innerHeight;
    const maxH = (portrait ? .30 : .62) * innerHeight;
    lines.forEach((b) => { b.style.fontSize = '100px'; b.style.display = 'inline-block'; });
    let sizes = lines.map((b) => 100 * maxW / b.getBoundingClientRect().width);
    if (wide) sizes = sizes.map(() => Math.min(...sizes));
    const total = sizes.reduce((a, s) => a + s * .98, 0);
    const k = Math.min(1, maxH / total);
    lines.forEach((b, i) => { b.style.fontSize = `${sizes[i] * k}px`; b.style.display = 'block'; });
    const role = document.querySelector('.role');
    role.style.top = portrait ? `${name.getBoundingClientRect().bottom + 2}px` : '';
  }
  addEventListener('resize', fitName);
  fitName();
  document.fonts?.ready.then(fitName);

  // ---------- Torn paper edge between the red sheet and the next one.
  (function buildTear() {
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const W = 1600, H = 100;
    const edge = (base, rough, step) => {
      let d = `M0 ${H}L0 ${base}`;
      for (let x = 0; x < W;) {
        x += step * (.45 + rnd());
        d += `L${Math.min(x, W).toFixed(1)} ${(base + (rnd() - .5) * rough + Math.sin(x * .006) * 14).toFixed(1)}`;
      }
      return `${d}L${W} ${H}Z`;
    };
    const fibre = edge(38, 26, 14), sheet = edge(50, 16, 20);
    $('tear').innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <path d="${fibre}" transform="translate(0 -5)" fill="#8F0B1B"/>
      <path d="${fibre}" fill="#FFFFFF"/>
      <path d="${sheet}" fill="#F3EDE1"/></svg>`;
  })();

  // ---------- Cursor. The dot sits exactly on the pointer with no smoothing.
  let usingMouse = false;
  const allowDot = () => matchMedia('(any-pointer: fine)').matches && !matchMedia('(forced-colors: active)').matches;
  const dotColors = {
    ink: ['#141216', '#F3EDE1'],
    red: ['#CC1126', '#F3EDE1'],
    paper: ['#F3EDE1', '#141216'],
  };
  let current = null, lastX = 0, lastY = 0;
  function describe(target) {
    const labelled = target.closest?.('[data-label], a');
    const zone = target.closest?.('[data-dot]');
    const key = `${labelled ? (labelled.dataset.label || 'Open') : ''}|${zone ? zone.dataset.dot : 'ink'}`;
    if (key === current) return;
    current = key;
    const [label, color] = key.split('|');
    const [bg, fg] = dotColors[color];
    dot.style.setProperty('--dot', bg);
    dot.style.setProperty('--dot-text', fg);
    dotLabel.textContent = label;
    dot.classList.toggle('is-big', Boolean(label));
  }

  // ---------- Depth and gaze: these trail the pointer on purpose. The cursor does not.
  const pose = { tx: 0, ty: 0, x: 0, y: 0, ex: 0, ey: 0, etx: 0, ety: 0 };
  let raf = 0, last = 0;
  function loop(now) {
    raf = 0;
    const dt = Math.min(Math.max(now - last, 0), 80);
    last = now;
    const k = reduced.matches ? 1 : 1 - Math.exp(-dt / 170);
    const ke = reduced.matches ? 1 : 1 - Math.exp(-dt / 55);
    pose.x += (pose.tx - pose.x) * k;
    pose.y += (pose.ty - pose.y) * k;
    pose.ex += (pose.etx - pose.ex) * ke;
    pose.ey += (pose.ety - pose.ey) * ke;
    if (!reduced.matches) {
      name.style.transform = `translate3d(${(-pose.x * 14).toFixed(2)}px, ${(-pose.y * 8).toFixed(2)}px, 0)`;
      figure.style.transform = `translate3d(${(pose.x * 20).toFixed(2)}px, ${(pose.y * 8).toFixed(2)}px, 0) rotate(${(pose.x * .9).toFixed(3)}deg)`;
    }
    const busy = Math.abs(pose.tx - pose.x) + Math.abs(pose.ty - pose.y) + Math.abs(pose.etx - pose.ex) + Math.abs(pose.ety - pose.ey) > .02;
    if (busy) raf = requestAnimationFrame(loop);
  }
  const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } };

  function look(x, y) {
    const r = figure.getBoundingClientRect();
    const eyeX = r.left + r.width * .5, eyeY = r.top + r.height * .36;
    const dx = x - eyeX, dy = y - eyeY, dist = Math.hypot(dx, dy) || 1, reach = Math.min(1, dist / 240);
    pose.etx = dx / dist * 13 * reach;
    pose.ety = dy / dist * 6 * reach;
    pose.tx = (x / innerWidth - .5) * 2;
    pose.ty = (y / innerHeight - .5) * 2;
    kick();
  }

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (!usingMouse && allowDot()) {
      usingMouse = true;
      document.documentElement.classList.add('has-dot');
    }
    lastX = e.clientX; lastY = e.clientY;
    dot.style.transform = `translate3d(${lastX}px, ${lastY}px, 0)`;
    dot.classList.add('is-in');
    describe(e.target);
    look(e.clientX, e.clientY);
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => dot.classList.remove('is-in'));
  addEventListener('pointerdown', () => dot.classList.add('is-press'));
  addEventListener('pointerup', () => dot.classList.remove('is-press'));
  const refreshDot = () => {
    if (!usingMouse) return;
    current = null;
    const under = document.elementFromPoint(lastX, lastY);
    if (under) describe(under);
  };
  addEventListener('scroll', refreshDot, { passive: true });

  // ---------- Reactions: a hop and a line of speech.
  const bubble = $('bubble');
  let pokes = 0;
  const LINES = ['Hey!', 'Ha, okay.', 'That tickles.', 'Still here.', 'You can stop now.', 'Fine. Keep going.'];
  let step = 0, resetTimer = 0;
  figure.addEventListener('click', () => {
    pokes++;
    bubble.textContent = LINES[step++ % LINES.length];
    bubble.classList.add('is-on');
    if (!reduced.matches) {
      figure.animate([
        { translate: '-50% 0', scale: '1 1' },
        { translate: '-50% 0', scale: '1.04 .95', offset: .16 },
        { translate: '-50% -4%', scale: '.98 1.03', offset: .46 },
        { translate: '-50% 0', scale: '1.015 .985', offset: .78 },
        { translate: '-50% 0', scale: '1 1' },
      ], { duration: 440, easing: 'cubic-bezier(.3, .7, .3, 1)' });
    }
    if (!reduced.matches && pokes < 5) {
      $('crown').animate([
        { transform: 'translateY(0) rotate(0deg)' },
        { transform: 'translateY(-46px) rotate(-11deg)', offset: .4 },
        { transform: 'translateY(0) rotate(5deg)', offset: .78 },
        { transform: 'translateY(0) rotate(0deg)' },
      ], { duration: 520, easing: 'cubic-bezier(.3, .7, .3, 1)' });
    }
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => bubble.classList.remove('is-on'), 1500);
  });


  // ---------- Prints: pull them around, click still opens them, touch just scrolls.
  const printsEl = $('prints'), putBack = $('putBack');
  let topZ = 2;
  printsEl.querySelectorAll('.print').forEach((print) => {
    const link = print.querySelector('a');
    const base = parseFloat(print.style.getPropertyValue('--r'));
    let start = null, moved = false, ox = 0, oy = 0, lastDx = 0;
    link.addEventListener('dragstart', (e) => e.preventDefault());
    link.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.button !== 0 || innerWidth <= 900) return;
      start = [e.clientX, e.clientY];
      link.setPointerCapture(e.pointerId);
      moved = false;
      ox = parseFloat(print.style.getPropertyValue('--x')) || 0;
      oy = parseFloat(print.style.getPropertyValue('--y')) || 0;
      lastDx = e.clientX;
    });
    link.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start[0], dy = e.clientY - start[1];
      if (!moved) {
        if (Math.hypot(dx, dy) < 6) return;
        moved = true;
        print.classList.remove('is-settling');
        print.classList.add('is-held');
        print.style.zIndex = ++topZ;
      }
      print.style.setProperty('--x', `${ox + dx}px`);
      print.style.setProperty('--y', `${oy + dy}px`);
      if (!reduced.matches) print.style.rotate = `${base + Math.max(-9, Math.min(9, (e.clientX - lastDx) * .6))}deg`;
      lastDx = e.clientX;
    });
    const drop = () => {
      if (!start) return;
      start = null;
      if (!moved) return;
      print.classList.remove('is-held');
      print.classList.add('is-settling');
      print.style.rotate = '';
      putBack.hidden = false;
    };
    link.addEventListener('pointerup', drop);
    link.addEventListener('pointercancel', drop);
    // A drag should not count as opening the project.
    link.addEventListener('click', (e) => { if (moved) { e.preventDefault(); moved = false; } });
  });
  putBack.addEventListener('click', () => {
    printsEl.querySelectorAll('.print').forEach((print) => {
      print.classList.add('is-settling');
      print.style.removeProperty('--x');
      print.style.removeProperty('--y');
    });
    putBack.hidden = true;
  });


  // ---------- Torn edges for later sections, and torn bottoms on the job sheets.
  (function tearSections() {
    let seed = 29;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const W = 1600, H = 100;
    const edge = (base, rough, step) => {
      let d = `M0 ${H}L0 ${base}`;
      for (let x = 0; x < W;) {
        x += step * (.45 + rnd());
        d += `L${Math.min(x, W).toFixed(1)} ${(base + (rnd() - .5) * rough + Math.sin(x * .006) * 14).toFixed(1)}`;
      }
      return `${d}L${W} ${H}Z`;
    };
    document.querySelectorAll('[data-tear]').forEach((el) => {
      const fibre = edge(38, 26, 14), sheet = edge(50, 16, 20);
      el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path d="${fibre}" fill="#FFFFFF"/><path d="${sheet}" fill="${el.dataset.tear}"/></svg>`;
    });
    document.querySelectorAll('[data-rip]').forEach((el) => {
      const pts = ['0 0', '100% 0'];
      const n = 34;
      for (let i = 0; i <= n; i++) {
        const y = (rnd() * 13).toFixed(1);
        pts.push(`${(100 - i / n * 100).toFixed(2)}% calc(100% - ${y}px)`);
      }
      el.style.clipPath = `polygon(${pts.join(',')})`;
    });
  })();

  // ---------- Doodles in the contact section draw once when it arrives on screen.
  const contactEl = $('contact');
  if ('IntersectionObserver' in window) {
    const seen = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { contactEl.classList.add('seen'); seen.disconnect(); }
    }, { threshold: .25 });
    seen.observe(contactEl);
  }

  // ---------- Copy my email.
  const copyBtn = $('copyEmail'), copied = $('copied');
  let copiedTimer = 0;
  copyBtn.addEventListener('click', async () => {
    const email = 'shreyanshsarthak10@gmail.com';
    let ok = false;
    try {
      await navigator.clipboard.writeText(email);
      ok = true;
    } catch {
      const area = document.createElement('textarea');
      area.value = email;
      area.style.cssText = 'position:fixed;opacity:0';
      document.body.append(area);
      area.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      area.remove();
      copyBtn.focus();
    }
    copied.textContent = ok ? 'Copied. Talk soon!' : 'Could not copy. Use the address above.';
    if (ok && !reduced.matches) {
      $('planeShape').animate([
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: 'translate(170px, -130px) rotate(8deg)', opacity: 1, offset: .55 },
        { transform: 'translate(420px, -320px) rotate(14deg)', opacity: 0, offset: .7 },
        { transform: 'translate(-90px, 60px)', opacity: 0, offset: .71 },
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      ], { duration: 1300, easing: 'cubic-bezier(.4, 0, .3, 1)' });
    }
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => { copied.textContent = ''; }, 2600);
  });


  // ---------- Skill stickers peel off and stay where they land. Touch keeps scrolling.
  document.querySelectorAll('.sticker').forEach((el) => {
    let start = null, ox = 0, oy = 0;
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      start = [e.clientX, e.clientY];
      ox = parseFloat(el.style.getPropertyValue('--x')) || 0;
      oy = parseFloat(el.style.getPropertyValue('--y')) || 0;
      el.setPointerCapture(e.pointerId);
      el.classList.remove('is-settling');
      el.classList.add('is-held');
    });
    el.addEventListener('pointermove', (e) => {
      if (!start) return;
      el.style.setProperty('--x', `${ox + e.clientX - start[0]}px`);
      el.style.setProperty('--y', `${oy + e.clientY - start[1]}px`);
    });
    const drop = () => { start = null; el.classList.remove('is-held'); };
    el.addEventListener('pointerup', drop);
    el.addEventListener('pointercancel', drop);
    el.addEventListener('dblclick', () => {
      el.classList.add('is-settling');
      el.style.removeProperty('--x');
      el.style.removeProperty('--y');
    });
  });

  // ---------- Poses land like stickers the first time they scroll into view.
  if ('IntersectionObserver' in window && !reduced.matches) {
    const landed = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        landed.unobserve(entry.target);
        entry.target.animate([
          { scale: '1.12', rotate: '-4deg', opacity: 0 },
          { scale: '.98', rotate: '1deg', opacity: 1, offset: .65 },
          { scale: '1', rotate: '0deg', opacity: 1 },
        ], { duration: 460, easing: 'cubic-bezier(.3, .7, .2, 1)' });
      });
    }, { threshold: .2 });
    document.querySelectorAll('.pose, .peek').forEach((el) => landed.observe(el));
  }

  // ---------- Custom right-click menu. Shift, selected text and touch keep the browser's own.
  const ctx = $('ctx'), ctxItems = $('ctxItems'), toast = $('toast');
  let toastTimer = 0, ctxReturn = null;
  const say = (text) => {
    toast.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.textContent = ''; }, 2200);
  };
  const copyText = async (text, done) => {
    try { await navigator.clipboard.writeText(text); say(done); } catch { say('Could not copy that one.'); }
  };
  const closeCtx = (restore = true) => {
    if (ctx.hidden) return;
    ctx.hidden = true;
    if (restore && ctxReturn && document.contains(ctxReturn)) ctxReturn.focus?.({ preventScroll: true });
  };
  function openCtx(x, y, target) {
    const link = target.closest?.('a[href]');
    const actions = [];
    if (link && !link.hash) {
      actions.push(['Open in a new tab', () => window.open(link.href, '_blank', 'noopener')]);
      actions.push(['Copy this link', () => copyText(link.href, 'Link copied.')]);
    }
    actions.push(['Search this site', () => openPalette()]);
    actions.push(['Copy my email', () => copyText('shreyanshsarthak10@gmail.com', 'Copied. Talk soon!')]);
    actions.push(['Download my resume', () => {
      const a = document.createElement('a');
      a.href = 'assets/Shreyansh-Sarthak-Resume.pdf';
      a.download = '';
      a.click();
    }]);
    actions.push(['See my GitHub', () => window.open('https://github.com/sarthax10', '_blank', 'noopener')]);
    actions.push(['Poke me', () => {
      scrollTo({ top: 0, behavior: reduced.matches ? 'auto' : 'smooth' });
      figure.click();
    }]);
    actions.push(['Back to top', () => scrollTo({ top: 0, behavior: reduced.matches ? 'auto' : 'smooth' })]);
    ctxItems.replaceChildren(...actions.map(([label, run]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.role = 'menuitem';
      b.textContent = label;
      b.addEventListener('click', () => { closeCtx(); run(); });
      return b;
    }));
    ctxReturn = document.activeElement;
    dot.classList.remove('is-big');
    current = null;
    ctx.hidden = false;
    const r = ctx.getBoundingClientRect();
    ctx.style.left = `${Math.max(8, Math.min(x, innerWidth - r.width - 14))}px`;
    ctx.style.top = `${Math.max(8, Math.min(y, innerHeight - r.height - 14))}px`;
    ctxItems.firstElementChild.focus({ preventScroll: true });
  }
  document.addEventListener('contextmenu', (e) => {
    if (e.shiftKey || matchMedia('(pointer: coarse)').matches || document.querySelector('dialog[open]')) return;
    if (String(getSelection()).trim()) return;
    if (ctx.contains(e.target)) { e.preventDefault(); return; }
    e.preventDefault();
    let x = e.clientX, y = e.clientY;
    if (!x && !y && document.activeElement) {
      const f = document.activeElement.getBoundingClientRect();
      x = f.left + 12; y = f.bottom + 6;
    }
    openCtx(x, y, e.target);
  });
  document.addEventListener('pointerdown', (e) => { if (!ctx.contains(e.target)) closeCtx(false); });
  addEventListener('scroll', () => closeCtx(false), { passive: true });
  addEventListener('blur', () => closeCtx(false));
  ctx.addEventListener('keydown', (e) => {
    const items = [...ctxItems.children], i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); closeCtx(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
    else if (e.key === 'Tab') { closeCtx(); }
  });


  // ---------- Modal helper: a dialog sits above everything, so the cursor dot must move inside it.
  const showModal = (d) => { dot.classList.remove('is-big', 'is-press'); current = null; d.append(dot); closeCtx(false); d.showModal(); };
  const afterClose = () => { document.body.append(dot); };
  const anyModal = () => Boolean(document.querySelector('dialog[open]'));

  // ---------- Project sheets. Without JavaScript the print is still a normal GitHub link.
  const PROJECTS = {
    strata: {
      name: 'Strata', tech: 'Rust, Tauri, TypeScript, React', url: 'https://github.com/sarthax10/strata',
      links: [['See the code', 'https://github.com/sarthax10/strata'], ['Get the installer', 'https://github.com/sarthax10/strata/releases']],
      problem: 'On Windows, the terminal, an AI agent, the editor, Git and a preview usually live in separate windows that know nothing about each other.',
      built: 'A Tauri app with Rust behind a React and TypeScript front end. Terminals run on ConPTY through portable-pty and render with xterm.js WebGL. Shell integration tracks commands and the working directory using OSC 133 and OSC 7.',
      decision: 'Run the real Claude Code through the Claude Agent SDK in its own Node process, instead of building a lookalike agent. The pane adds a readable work log and permission cards on top of it.',
      now: 'Version 0.1.0 has an installer. Terminals, the agent pane, session restore and the file explorer work. The editor, browser pane and settings screen aren’t built yet.',
    },
    rackwm: {
      name: 'rackwm', tech: 'Rust, Win32', url: 'https://github.com/sarthax10/rackwm',
      links: [['See the code', 'https://github.com/sarthax10/rackwm']],
      problem: 'I wanted automatic, keyboard-driven window tiling on Windows in the spirit of Hyprland, built directly on Win32 instead of ported from Linux.',
      built: 'A Rust workspace with an engine that tiles windows and draws its own focus glow and dimming overlays, a small control panel, and library crates for config, theme and platform code.',
      decision: 'The engine reacts to window events with no polling loop anywhere. The control panel only edits a config file, which the engine reloads live, so that file is the only contract between them.',
      now: 'It works on one monitor with up to 6 tiled windows. Configurable keybindings, multiple monitors and workspaces aren’t built yet.',
    },
    antiquary: {
      name: 'Antiquary', tech: 'Python, Flask, React, PostgreSQL, Docker', url: 'https://github.com/sarthax10/antiquary',
      links: [['See the code', 'https://github.com/sarthax10/antiquary']],
      problem: 'Generating a short history video is easy. Trusting it is harder, because an invented fact can slip straight through.',
      built: 'A Flask API and React app, with a separate video pipeline: Ollama writes and fact-checks, edge-tts narrates, faster-whisper captions and ffmpeg renders. Postgres holds the data, MinIO stores video and Caddy handles HTTPS.',
      decision: 'A second generation request joins a small FIFO queue instead of being rejected, and a database-level guard keeps it to one running job. Every story then waits at a review desk for a person to approve it.',
      now: 'Sign-up approval, generation, review and storage work end to end. Publishing to YouTube and Instagram isn’t built yet.',
    },
    schematic: {
      name: 'Schematic', tech: 'Python, HTML, JavaScript, ffmpeg', url: 'https://github.com/sarthax10/schematic',
      links: [['See the code', 'https://github.com/sarthax10/schematic']],
      problem: 'A good 60 to 90 second engineering explainer needs an accurate script, a storyboard, animation and narration, which is a lot of work per video.',
      built: 'A Python pipeline from topic to MP4: script, accuracy review, human review, storyboard, scene design, narration, a layout check in headless Chromium, then the render.',
      decision: 'Every frame is a pure function of time, so Chromium can seek to any frame and the render stays exact. Each LLM reply is validated in code, and named violations go back for repair.',
      now: 'It generates videos end to end and pauses for a person to approve the script. Finished stages are cached, so resuming never repeats work.',
    },
    juno: {
      name: 'Juno', tech: 'Python, QML, Whisper', url: 'https://github.com/sarthax10/juno-assistant',
      links: [['See the code', 'https://github.com/sarthax10/juno-assistant']],
      problem: 'I wanted to talk to Claude at my Linux desktop, hands free, and still see what it was doing.',
      built: 'A daemon owns the microphone, speech recognition, Claude and the voice. A Quickshell overlay and bar widget connect to it over a socket, with a command-line tool alongside.',
      decision: 'The overlay is a pure subscriber. Close it mid-answer and the answer still finishes, and the wake word keeps working with no interface open at all.',
      now: 'It runs on Omarchy Linux, and you can train the wake word on your own voice. I’m working on fewer false wake-ups without missing real ones.',
    },
    urbanConnect: {
      name: 'UrbanConnect', tech: 'C#, ASP.NET Core, React, MySQL', url: 'https://github.com/sarthax10/urbanConnect',
      links: [['See the code', 'https://github.com/sarthax10/urbanConnect']],
      problem: 'A home services booking system falls apart the moment two customers can book the same slot.',
      built: 'A React front end and an ASP.NET Core backend on MySQL, split into controller, business logic and data layers. Clerk handles sign-in, and new users start with a customer role.',
      decision: 'The data layer keeps separate command and query repositories, so reads and writes for bookings stay easy to change independently.',
      now: 'It has a booking flow with time slots, customer dashboards and admin controls.',
    },
  };
  const project = $('project'), projectCard = $('projectCard');
  let projectOpener = null;
  function openProject(key, opener) {
    const p = PROJECTS[key];
    if (!p) return;
    projectOpener = opener || document.activeElement;
    $('projectTitle').textContent = p.name;
    $('projectTech').textContent = p.tech;
    const cover = printsEl.querySelector(`a[href="${p.url}"] svg`);
    $('projectCover').replaceChildren(cover ? cover.cloneNode(true) : '');
    $('projectBody').replaceChildren(...[['The problem', p.problem], ['How I built it', p.built], ['A decision I made', p.decision], ['Where it stands', p.now]].map(([h, body]) => {
      const box = document.createElement('section');
      const title = document.createElement('h3'); title.textContent = h;
      const text = document.createElement('p'); text.textContent = body;
      box.append(title, text);
      return box;
    }));
    $('projectLinks').replaceChildren(...p.links.map(([label, url]) => {
      const a = document.createElement('a');
      a.href = url; a.textContent = label; a.dataset.label = 'Open'; a.target = '_blank'; a.rel = 'noopener';
      return a;
    }));
    showModal(project);
    project.scrollTop = 0;
    $('projectClose').focus({ preventScroll: true });
    if (!reduced.matches) {
      projectCard.animate([
        { transform: 'perspective(1400px) rotateX(-78deg) scale(.82)', opacity: 0 },
        { transform: 'perspective(1400px) rotateX(9deg) scale(1)', opacity: 1, offset: .65 },
        { transform: 'perspective(1400px) rotateX(0deg) scale(1)', opacity: 1 },
      ], { duration: 460, easing: 'cubic-bezier(.2, .8, .3, 1)' });
    }
  }
  const projectKey = (href) => Object.keys(PROJECTS).find((k) => PROJECTS[k].url === href);
  printsEl.querySelectorAll('.print a').forEach((link) => {
    link.dataset.label = 'Open';
    link.setAttribute('aria-haspopup', 'dialog');
    link.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const key = projectKey(link.href);
      if (!key) return;
      e.preventDefault();
      openProject(key, link);
    });
  });
  $('projectClose').addEventListener('click', () => project.close());
  project.addEventListener('click', (e) => { if (e.target === project) project.close(); });
  project.addEventListener('close', () => {
    afterClose();
    if (projectOpener && document.contains(projectOpener)) projectOpener.focus({ preventScroll: true });
  });

  // ---------- Doodle guide: walks down the page edge as you scroll, changing pose per section.
  const guide = $('guide'), guideImg = $('guideImg'), guideSay = $('guideSay');
  const guideStops = [...document.querySelectorAll('[data-guide]')];
  let guideSection = null, guideLast = scrollY, guideFlip = 1, guideRaf = 0, guideSayTimer = 0;
  // Load the poses up front so a swap never flashes empty.
  if (matchMedia('(min-width: 1180px)').matches) ['wave', 'laptop', 'confused', 'point', 'carry'].forEach((n) => { new Image().src = `assets/doodles/${n}.webp`; });
  function placeGuide() {
    guideRaf = 0;
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const y = scrollY, progress = y / max;
    if (y !== guideLast) guideFlip = y > guideLast ? 1 : -1;
    guideLast = y;
    const top = innerHeight * (.14 + progress * .56);
    const phase = reduced.matches ? 0 : y / 46;
    const bob = Math.abs(Math.sin(phase)) * 9, tilt = Math.sin(phase) * 4;
    guide.style.transform = `translate3d(0, ${(top - bob).toFixed(1)}px, 0) rotate(${tilt.toFixed(2)}deg)`;
    guideImg.style.transform = `scaleX(${guideFlip})`;
  }
  const requestGuide = () => { if (!guideRaf) guideRaf = requestAnimationFrame(placeGuide); };
  addEventListener('scroll', requestGuide, { passive: true });
  addEventListener('resize', requestGuide);
  if ('IntersectionObserver' in window) {
    const watcher = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          if (entry.target === guideSection) { guideSection = null; guide.classList.remove('is-on'); }
          return;
        }
        guideSection = entry.target;
        guideImg.src = `assets/doodles/${entry.target.dataset.guide}.webp`;
        guide.classList.add('is-on');
        guideSay.textContent = entry.target.dataset.say;
        guideSay.classList.add('is-on');
        clearTimeout(guideSayTimer);
        guideSayTimer = setTimeout(() => guideSay.classList.remove('is-on'), 2400);
        requestGuide();
      });
    }, { rootMargin: '-50% 0px -50% 0px' });
    guideStops.forEach((el) => watcher.observe(el));
  }
  guide.addEventListener('click', () => {
    const order = [...document.querySelectorAll('main > section')];
    const next = order[order.indexOf(guideSection) + 1];
    next?.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth' });
  });

  // ---------- Scribble: strokes live in page coordinates, so they scroll with the site.
  const scribble = $('scribble'), pen = scribble.getContext('2d');
  const strokes = [];
  let penColor = '#CC1126', current_stroke = null, drawing = false, sizeRaf = 0;
  function sizeScribble() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    scribble.width = Math.round(innerWidth * dpr);
    scribble.height = Math.round(innerHeight * dpr);
    pen.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintScribble();
  }
  function trace(st) {
    const p = st.pts, ox = scrollX, oy = scrollY;
    pen.strokeStyle = st.color;
    pen.lineWidth = 4.5;
    pen.lineCap = pen.lineJoin = 'round';
    pen.beginPath();
    pen.moveTo(p[0][0] - ox, p[0][1] - oy);
    for (let i = 1; i < p.length - 1; i++) {
      pen.quadraticCurveTo(p[i][0] - ox, p[i][1] - oy, (p[i][0] + p[i + 1][0]) / 2 - ox, (p[i][1] + p[i + 1][1]) / 2 - oy);
    }
    const last = p[p.length - 1];
    pen.lineTo(last[0] - ox, last[1] - oy);
    pen.stroke();
  }
  function paintScribble() {
    sizeRaf = 0;
    pen.clearRect(0, 0, innerWidth, innerHeight);
    strokes.forEach(trace);
  }
  const requestPaint = () => { if (!sizeRaf) sizeRaf = requestAnimationFrame(paintScribble); };
  addEventListener('scroll', () => { if (strokes.length) requestPaint(); }, { passive: true });
  addEventListener('resize', sizeScribble);
  sizeScribble();
  const drawLabel = () => (innerWidth <= 720 ? 'Draw' : 'Draw on this page');
  $('drawToggle').textContent = drawLabel();
  function setDrawing(on) {
    drawing = on;
    document.documentElement.classList.toggle('drawing', on);
    $('drawToggle').setAttribute('aria-pressed', String(on));
    $('drawToggle').textContent = on ? 'Done' : drawLabel();
    $('drawTools').hidden = !on;
    if (on) say('Scribble away. It stays on this page until you reload.');
  }
  $('drawToggle').addEventListener('click', () => setDrawing(!drawing));
  const setPen = (color, active, other) => {
    penColor = color;
    active.setAttribute('aria-pressed', 'true');
    other.setAttribute('aria-pressed', 'false');
  };
  $('penRed').addEventListener('click', () => setPen('#CC1126', $('penRed'), $('penInk')));
  $('penInk').addEventListener('click', () => setPen('#141216', $('penInk'), $('penRed')));
  $('drawUndo').addEventListener('click', () => { strokes.pop(); paintScribble(); });
  $('drawClear').addEventListener('click', () => { strokes.length = 0; paintScribble(); });
  scribble.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    scribble.setPointerCapture(e.pointerId);
    current_stroke = { color: penColor, pts: [[e.clientX + scrollX, e.clientY + scrollY]] };
    strokes.push(current_stroke);
  });
  scribble.addEventListener('pointermove', (e) => {
    if (!current_stroke) return;
    const events = e.getCoalescedEvents?.() || [e];
    (events.length ? events : [e]).forEach((ev) => current_stroke.pts.push([ev.clientX + scrollX, ev.clientY + scrollY]));
    paintScribble();
  });
  const endStroke = () => { current_stroke = null; };
  scribble.addEventListener('pointerup', endStroke);
  scribble.addEventListener('pointercancel', endStroke);
  addEventListener('keydown', (e) => {
    if (!drawing) return;
    if (e.key === 'Escape') setDrawing(false);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); strokes.pop(); paintScribble(); }
  });

  // ---------- Poke combos.
  const heckler = $('heckler'), crownEl = $('crown');
  let crownGone = false;
  figure.addEventListener('click', () => {
    if (pokes === 6 && !crownGone) {
      crownGone = true;
      bubble.textContent = 'My crown!';
      if (reduced.matches) crownEl.style.visibility = 'hidden';
      else crownEl.animate([
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: 'translate(70px, -90px) rotate(30deg)', opacity: 1, offset: .25 },
        { transform: 'translate(260px, 1900px) rotate(320deg)', opacity: 1 },
      ], { duration: 900, easing: 'cubic-bezier(.4, 0, .9, .6)' }).onfinish = () => { if (crownGone) crownEl.style.visibility = 'hidden'; };
    }
    if (pokes === 9) {
      bubble.textContent = 'He’s not wrong.';
      heckler.classList.add('is-up');
    }
    if (pokes === 13) {
      bubble.textContent = 'Fine. Starting over.';
      heckler.classList.remove('is-up');
      crownEl.getAnimations().forEach((a) => a.cancel());
      crownGone = false;
      crownEl.style.visibility = '';
      pokes = 0;
    }
  });

  // ---------- Sticker challenge: 8 on the shirt unlocks a note.
  const GOAL = 8;
  const shirtCount = $('shirtCount'), toolsPose = $('toolsPose');
  let shirtDone = false;
  function checkShirt() {
    const box = toolsPose.getBoundingClientRect();
    const zone = { l: box.left + box.width * .22, r: box.left + box.width * .8, t: box.top + box.height * .26, b: box.top + box.height * .58 };
    let n = 0;
    document.querySelectorAll('.sticker').forEach((el) => {
      const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const on = x > zone.l && x < zone.r && y > zone.t && y < zone.b;
      el.classList.toggle('stuck', on);
      if (on) n++;
    });
    if (shirtDone) return;
    shirtCount.textContent = n ? `${Math.min(n, GOAL)} of ${GOAL} on my shirt.` : `Stick ${GOAL} on my shirt.`;
    if (n >= GOAL) {
      shirtDone = true;
      shirtCount.textContent = 'You did it. Email me the word “sticker” and I’ll know you’re thorough.';
      if (!reduced.matches) {
        const colors = ['#F3EDE1', '#141216', '#FFFFFF'];
        for (let i = 0; i < 46; i++) {
          const bit = document.createElement('span');
          bit.className = 'scrap-fly';
          bit.style.background = colors[i % 3];
          bit.style.left = `${Math.random() * 100}vw`;
          bit.style.top = '-20px';
          document.body.append(bit);
          bit.animate([
            { transform: 'translateY(0) rotate(0deg)' },
            { transform: `translateY(${innerHeight + 60}px) rotate(${360 + Math.random() * 500}deg)` },
          ], { duration: 1100 + Math.random() * 1300, delay: Math.random() * 300, easing: 'cubic-bezier(.3, .2, .7, 1)' }).onfinish = () => bit.remove();
        }
      }
    }
  }
  document.querySelectorAll('.sticker').forEach((el) => {
    el.addEventListener('pointerup', () => requestAnimationFrame(checkShirt));
    el.addEventListener('dblclick', () => setTimeout(checkShirt, 450));
  });

  // ---------- Search palette.
  const palette = $('palette'), paletteInput = $('paletteInput'), paletteList = $('paletteList');
  const go = (id) => () => document.getElementById(id)?.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth' });
  const COMMANDS = [
    ...Object.entries(PROJECTS).map(([key, p]) => ({ label: p.name, hint: 'Project', terms: `${p.name} ${p.tech} project`, run: () => openProject(key) })),
    { label: 'My work', hint: 'Section', terms: 'projects things built', run: go('work') },
    { label: 'My toolbox', hint: 'Section', terms: 'skills tech stack tools', run: go('skills') },
    { label: 'Where I worked', hint: 'Section', terms: 'experience jobs leadsquared sabic career', run: go('experience') },
    { label: 'On my desk', hint: 'Section', terms: 'now current working', run: go('desk') },
    { label: 'Say hi', hint: 'Section', terms: 'contact', run: go('contact') },
    { label: 'Copy my email', hint: 'Action', terms: 'contact mail gmail', run: () => copyText('shreyanshsarthak10@gmail.com', 'Copied. Talk soon!') },
    { label: 'Download my resume', hint: 'Action', terms: 'cv pdf', run: () => { const a = document.createElement('a'); a.href = 'assets/Shreyansh-Sarthak-Resume.pdf'; a.download = ''; a.click(); } },
    { label: 'Open GitHub', hint: 'Link', terms: 'code repos', run: () => window.open('https://github.com/sarthax10', '_blank', 'noopener') },
    { label: 'Open LinkedIn', hint: 'Link', terms: 'profile', run: () => window.open('https://www.linkedin.com/in/shreyansh-sarthak', '_blank', 'noopener') },
    { label: 'Play Watchnight', hint: 'Link', terms: 'game itch horror', run: () => window.open('https://sarthax10.itch.io/watchnight', '_blank', 'noopener') },
    { label: 'Draw on this page', hint: 'Fun', terms: 'scribble pen doodle', run: () => setDrawing(true) },
    { label: 'Poke me', hint: 'Fun', terms: 'crown', run: () => { scrollTo({ top: 0, behavior: reduced.matches ? 'auto' : 'smooth' }); figure.click(); } },
  ];
  let paletteActive = 0, paletteShown = [];
  function renderPalette() {
    const q = paletteInput.value.trim().toLowerCase();
    paletteShown = COMMANDS.filter((c) => !q || `${c.label} ${c.terms}`.toLowerCase().includes(q));
    paletteActive = Math.min(paletteActive, Math.max(paletteShown.length - 1, 0));
    paletteList.replaceChildren(...paletteShown.map((c, i) => {
      const li = document.createElement('li');
      li.id = `pal-${i}`;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === paletteActive));
      li.append(c.label);
      const hint = document.createElement('span'); hint.textContent = c.hint;
      li.append(hint);
      li.addEventListener('click', () => runPalette(i));
      li.addEventListener('pointermove', () => { if (paletteActive !== i) { paletteActive = i; markPalette(); } });
      return li;
    }));
    if (!paletteShown.length) {
      const none = document.createElement('li');
      none.className = 'palette-empty';
      none.textContent = 'Nothing by that name. Try “resume”.';
      paletteList.append(none);
      paletteInput.removeAttribute('aria-activedescendant');
    } else paletteInput.setAttribute('aria-activedescendant', `pal-${paletteActive}`);
  }
  function markPalette() {
    [...paletteList.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === paletteActive)));
    paletteInput.setAttribute('aria-activedescendant', `pal-${paletteActive}`);
    paletteList.children[paletteActive]?.scrollIntoView({ block: 'nearest' });
  }
  function runPalette(i) {
    const cmd = paletteShown[i];
    if (!cmd) return;
    palette.close();
    cmd.run();
  }
  function openPalette() {
    if (anyModal()) return;
    paletteInput.value = '';
    paletteActive = 0;
    renderPalette();
    showModal(palette);
    paletteInput.focus();
  }
  paletteInput.addEventListener('input', () => { paletteActive = 0; renderPalette(); });
  paletteInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && paletteShown.length) { e.preventDefault(); paletteActive = (paletteActive + 1) % paletteShown.length; markPalette(); }
    if (e.key === 'ArrowUp' && paletteShown.length) { e.preventDefault(); paletteActive = (paletteActive - 1 + paletteShown.length) % paletteShown.length; markPalette(); }
    if (e.key === 'Enter') { e.preventDefault(); runPalette(paletteActive); }
  });
  palette.addEventListener('click', (e) => { if (e.target === palette) palette.close(); });
  palette.addEventListener('close', afterClose);
  $('searchBtn').addEventListener('click', openPalette);
  if (/Mac|iPhone|iPad/.test(navigator.platform || '')) $('searchKey').textContent = '⌘K';
  addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (palette.open) palette.close(); else openPalette();
    }
  });

  // ---------- A handwritten hello that depends on the visitor's clock.
  (function greet() {
    const h = new Date().getHours();
    $('greet').textContent = h < 5 ? 'Up late too?' : h < 12 ? 'Good morning!' : h < 17 ? 'Good afternoon!' : h < 22 ? 'Good evening!' : 'Up late too?';
  })();

  // ---------- One entrance: the letters rise, then the figure is slapped on like a sticker.
  if (!reduced.matches) {
    const ease = 'cubic-bezier(.16, 1, .3, 1)';
    name.querySelectorAll('b').forEach((b, i) => {
      b.animate([{ transform: 'translateY(108%)' }, { transform: 'translateY(0)' }], { duration: 820, delay: 80 + i * 90, easing: ease, fill: 'backwards' });
    });
    figure.animate([
      { opacity: 0, scale: '1.16', rotate: '-5deg' },
      { opacity: 1, scale: '.985', rotate: '1deg', offset: .62 },
      { opacity: 1, scale: '1', rotate: '0deg' },
    ], { duration: 520, delay: 480, easing: 'cubic-bezier(.3, .7, .2, 1)', fill: 'backwards' });
  }
})();
