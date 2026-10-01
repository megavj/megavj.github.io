(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const unit = document.querySelector('.contact-unit');
  const button = document.querySelector('.meeting-orbit');
  if (!unit || !button || reduced || !finePointer) return;

  const canvas = document.getElementById('spark-canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  let dpr = Math.min(devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  let mx = innerWidth / 2;
  let my = innerHeight / 2;
  let lastX = mx;
  let lastY = my;
  const sparks = [];

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    width = innerWidth;
    height = innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function addSpark(x, y, force = 1) {
    const count = Math.max(1, Math.round(force * 2));
    for (let i = 0; i < count; i++) {
      const life = 30 + Math.random() * 28;
      sparks.push({
        x, y,
        vx: (Math.random() - .5) * (1.2 + force),
        vy: (Math.random() - .5) * (1.2 + force) - .25,
        size: .6 + Math.random() * 2.1,
        life,
        max: life,
        hue: Math.random() > .25 ? 46 : 38
      });
    }
    if (sparks.length > 180) sparks.splice(0, sparks.length - 180);
  }

  addEventListener('pointermove', event => {
    mx = event.clientX;
    my = event.clientY;
    const dx = mx - lastX;
    const dy = my - lastY;
    const speed = Math.min(4, Math.hypot(dx, dy) / 12);
    addSpark(mx, my, .7 + speed);
    lastX = mx;
    lastY = my;

    const rect = unit.getBoundingClientRect();
    unit.style.setProperty('--px', `${mx - rect.left}px`);
    unit.style.setProperty('--py', `${my - rect.top}px`);
  }, { passive: true });

  button.addEventListener('pointerenter', () => {
    unit.classList.add('is-hot');
    const rect = button.getBoundingClientRect();
    for (let i = 0; i < 65; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = rect.width * (.42 + Math.random() * .18);
      addSpark(
        rect.left + rect.width / 2 + Math.cos(angle) * radius,
        rect.top + rect.height / 2 + Math.sin(angle) * radius,
        2.8
      );
    }
  });
  button.addEventListener('pointerleave', () => {
    unit.classList.remove('is-hot');
    button.style.transform = '';
  });
  button.addEventListener('pointermove', event => {
    const rect = button.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    button.style.transform = `translate3d(${x * .075}px,${y * .075}px,0)`;
  });

  function render() {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const spark = sparks[i];
      spark.x += spark.vx;
      spark.y += spark.vy;
      spark.vx *= .985;
      spark.vy = spark.vy * .985 + .006;
      spark.life--;
      if (spark.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      const alpha = Math.pow(spark.life / spark.max, 1.8);
      const glow = ctx.createRadialGradient(spark.x, spark.y, 0, spark.x, spark.y, spark.size * 5);
      glow.addColorStop(0, `hsla(${spark.hue} 100% 92% / ${alpha})`);
      glow.addColorStop(.2, `hsla(${spark.hue} 90% 68% / ${alpha * .85})`);
      glow.addColorStop(1, `hsla(${spark.hue} 90% 54% / 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.size * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    requestAnimationFrame(render);
  }

  resize();
  addEventListener('resize', resize, { passive: true });
  render();
})();
