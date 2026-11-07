// Small 2D line chart: time on x (last `windowSeconds`), each series scaled to its own max, with a legend.
export function createChart(canvas, series) {
  const ctx = canvas.getContext('2d');
  return {
    draw(points, windowSeconds) {
      const dpr = Math.min(devicePixelRatio, 2), w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const pad = { l: 10, r: 10, t: 22 + 16 * Math.ceil(series.length / 2), b: 22 };
      const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
      const tEnd = Math.max(windowSeconds, points.length ? points.at(-1).t : 0), t0 = tEnd - windowSeconds;
      const X = (t) => pad.l + ((t - t0) / windowSeconds) * pw;

      ctx.strokeStyle = 'rgba(148,163,184,.35)'; ctx.lineWidth = 1;
      ctx.strokeRect(pad.l, pad.t, pw, ph);
      ctx.fillStyle = '#94a3b8'; ctx.font = '11px system-ui, sans-serif'; ctx.textBaseline = 'top';
      ctx.fillText(`${t0.toFixed(0)} s`, pad.l, pad.t + ph + 5);
      ctx.textAlign = 'right'; ctx.fillText(`${tEnd.toFixed(0)} s (shown time)`, pad.l + pw, pad.t + ph + 5); ctx.textAlign = 'left';

      series.forEach((s, i) => {
        const lx = pad.l + (i % 2) * (pw / 2), ly = 6 + 16 * Math.floor(i / 2);
        ctx.fillStyle = s.color; ctx.fillRect(lx, ly + 4, 12, 3);
        ctx.fillStyle = '#e2e8f0'; ctx.fillText(s.label, lx + 16, ly);
        ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath();
        let started = false;
        for (const p of points) {
          if (p.t < t0) continue;
          const y = pad.t + ph - Math.min(1, Math.max(0, p[s.key] / s.max)) * ph;
          if (started) ctx.lineTo(X(p.t), y); else { ctx.moveTo(X(p.t), y); started = true; }
        }
        ctx.stroke();
      });
    },
  };
}
