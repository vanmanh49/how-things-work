async (page) => {
  const ctx = page.context(); const errs = []; const r = {};
  const watch = (p, tag) => { p.on('pageerror', e => errs.push(tag + ':' + e.message)); p.on('console', m => m.type() === 'error' && errs.push(tag + ':' + m.text())); p.on('response', res => res.status() >= 400 && errs.push(tag + ' http ' + res.status() + ' ' + res.url())); };
  // Home + sub-path: cards, images, every card and top-bar option navigates.
  for (const B of ['http://localhost:8000/', 'http://localhost:8000/how-things-work/']) {
    const p = await ctx.newPage(); watch(p, B); await p.setViewportSize({ width: 1440, height: 900 }); await p.goto(B, { waitUntil: 'networkidle' });
    r[B] = { cards: await p.locator('.card').count(), imgs: await p.evaluate(() => [...document.images].every(i => i.complete && i.naturalWidth > 0)) };
    const hrefs = await p.$$eval('.card', as => as.map(a => a.getAttribute('href')));
    r[B].nav = [];
    for (const h of hrefs) { await p.goto(B + h, { waitUntil: 'networkidle' }); const opts = await p.$$eval('.topbar option', o => o.map(x => x.value).filter(Boolean)); r[B].nav.push([h, await p.title(), opts.length]);
      for (const v of opts) { const q = await ctx.newPage(); watch(q, B + h + '>' + v); await q.goto(new URL(v, B + h).href, { waitUntil: 'networkidle' }); r[B].nav.push(v + ':' + (await q.title()).split(' ·')[0]); await q.close(); }
    }
    await p.close();
  }
  // Motor: reduced motion, resize, narrow, hidden-tab clamp, fallback.
  const M = 'http://localhost:8000/motor/';
  const q = await ctx.newPage(); watch(q, 'rm'); await q.emulateMedia({ reducedMotion: 'reduce' }); await q.setViewportSize({ width: 1440, height: 900 }); await q.goto(M); await q.waitForTimeout(400);
  const a = await q.screenshot({ clip: { x: 0, y: 50, width: 860, height: 800 } }); await q.waitForTimeout(900); r.rmHeroStatic = a.equals(await q.screenshot({ clip: { x: 0, y: 50, width: 860, height: 800 } }));
  await q.evaluate(() => { const w = document.getElementById('walkthrough').getBoundingClientRect(); scrollBy(0, w.top + (2.75 / 6) * w.height - innerHeight / 2); }); await q.waitForTimeout(300);
  r.rmScrollDrives = await q.evaluate(() => [document.querySelector('.panel.active')?.dataset.step, !document.getElementById('gauge').hidden]);
  await q.locator('#sandbox').scrollIntoViewIfNeeded(); await q.waitForTimeout(500); r.rmPlay = await q.textContent('#play'); r.rmSpeed = (await q.textContent('#readout')).split('\n')[0];
  await q.close();
  const p = await ctx.newPage(); watch(p, 'm'); await p.setViewportSize({ width: 1440, height: 900 }); await p.goto(M); await p.waitForTimeout(400);
  await p.locator('#sandbox').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  r.hiddenTab = await p.evaluate(() => { const v = document.getElementById('volts'); v.value = 12; v.dispatchEvent(new Event('input'));
    const rpm = () => +document.getElementById('readout').textContent.match(/Speed: (-?\d+)/)[1];
    return new Promise(res => requestAnimationFrame(() => { const before = rpm(); const t0 = performance.now(); while (performance.now() - t0 < 3000) {} requestAnimationFrame(() => requestAnimationFrame(() => res([before, rpm()]))); })); });
  for (const [w, h] of [[1000, 700], [1600, 900]]) { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(250); r['aspect' + w] = await p.evaluate(() => ['stage-canvas', 'sandbox-canvas'].map(id => { const c = document.getElementById(id); return Math.abs(c.width / c.height - c.clientWidth / c.clientHeight) < 0.02; })); }
  await p.setViewportSize({ width: 390, height: 844 }); await p.goto(M); await p.waitForTimeout(400);
  r.narrow = []; for (const f of [0.5, 1.5, 2.5, 3.5, 4.5, 5.5]) { await p.evaluate(f => { const w = document.getElementById('walkthrough').getBoundingClientRect(); scrollBy(0, w.top + (f / 6) * w.height - innerHeight / 2); }, f); await p.waitForTimeout(250); r.narrow.push(await p.evaluate(() => document.documentElement.scrollWidth)); }
  await p.locator('#sandbox').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); r.narrow.push(await p.evaluate(() => document.documentElement.scrollWidth));
  await p.screenshot({ path: '.playwright-mcp/motor-390.png', fullPage: false });
  await p.close();
  return { r, errs };
}
