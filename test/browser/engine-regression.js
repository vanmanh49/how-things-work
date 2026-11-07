async (page) => {
  const ctx = page.context(); const errs = []; const r = {}; const B = 'http://localhost:8000/engine/';
  const watch = (p, tag) => { p.on('pageerror', e => errs.push(tag + ':' + e.message)); p.on('console', m => m.type() === 'error' && errs.push(tag + ':' + m.text())); p.on('response', res => res.status() >= 400 && errs.push(tag + ' http ' + res.status() + ' ' + res.url())); };
  const goStep = (p, s) => p.evaluate(s => { const el = document.querySelector(`.panel[data-step="${s}"]`); const b = el.getBoundingClientRect(); scrollBy(0, b.top + b.height / 2 - innerHeight / 2); }, s);
  const th = (p) => p.evaluate(() => +document.getElementById('readout').textContent.match(/θ = (\d+)/)[1]);
  const p = await ctx.newPage(); watch(p, 'p'); await p.setViewportSize({ width: 1440, height: 900 }); await p.goto(B); await p.waitForTimeout(600);
  r.steps = {}; for (const s of ['parts', 'intake', 'compression', 'power', 'exhaust', 'multi']) { await goStep(p, s); await p.waitForTimeout(300); r.steps[s] = await p.evaluate(() => document.querySelector('.panel.active')?.dataset.step); await p.screenshot({ path: `.playwright-mcp/eng-${s}.png`, clip: { x: 0, y: 0, width: 864, height: 900 } }); }
  r.labelsShownInParts = await (async () => { await goStep(p, 'parts'); await p.waitForTimeout(300); return p.evaluate(() => !document.getElementById('labels').hidden && document.querySelectorAll('#labels .label').length); })();
  r.multiPinned = await p.evaluate(() => { const w = document.getElementById('walkthrough'); const b = w.getBoundingClientRect(); scrollBy(0, b.top + (5.9 / 6) * b.height - innerHeight / 2); return new Promise(res => requestAnimationFrame(() => res(Math.round(document.getElementById('stage').getBoundingClientRect().top)))); });
  await goStep(p, 'power'); await p.waitForTimeout(300); await p.reload(); await p.waitForTimeout(400); r.reloadPower = await p.evaluate(() => document.querySelector('.panel.active')?.dataset.step);
  await p.locator('#sandbox').scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  await p.fill('#rpm', '6000'); const b0 = await th(p); await p.waitForTimeout(1000); r.deg6000 = ((await th(p)) - b0 + 720) % 720;
  await p.fill('#rpm', '0'); const z0 = await th(p); await p.waitForTimeout(500); r.rpm0still = (await th(p)) === z0;
  await p.check('#cutaway'); await p.check('input[name=cyl][value="1"]'); await p.waitForTimeout(200); r.oneCylReadout = (await p.textContent('#readout')).split('\n').length; await p.check('input[name=cyl][value="4"]');
  r.hiddenTab = await p.evaluate(() => { const i = document.getElementById('rpm'); i.value = 6000; i.dispatchEvent(new Event('input')); return new Promise(res => requestAnimationFrame(() => { const read = () => +document.getElementById('readout').textContent.match(/θ = (\d+)/)[1]; const before = read(); const t0 = performance.now(); while (performance.now() - t0 < 3000) {} requestAnimationFrame(() => requestAnimationFrame(() => res(((read() - before) + 720) % 720))); })); });
  for (const [w, h] of [[1000, 700], [1600, 900]]) { await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(250); r['aspect' + w] = await p.evaluate(() => ['stage-canvas', 'sandbox-canvas'].map(id => { const c = document.getElementById(id); return Math.abs(c.width / c.height - c.clientWidth / c.clientHeight) < 0.02; })); }
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300); r.narrowScrollW = await p.evaluate(() => document.documentElement.scrollWidth);
  await p.close();
  const q = await ctx.newPage(); watch(q, 'q'); await q.emulateMedia({ reducedMotion: 'reduce' }); await q.setViewportSize({ width: 1440, height: 900 }); await q.goto(B); await q.waitForTimeout(400);
  const a = await q.screenshot({ clip: { x: 0, y: 50, width: 860, height: 800 } }); await q.waitForTimeout(900); r.rmHeroStatic = a.equals(await q.screenshot({ clip: { x: 0, y: 50, width: 860, height: 800 } }));
  await q.locator('#sandbox').scrollIntoViewIfNeeded(); await q.waitForTimeout(300); r.rmPlay = await q.textContent('#play'); await q.click('#step-back'); await q.waitForTimeout(100); r.rmStepBack = (await q.textContent('#readout')).split('\n').slice(0, 2).join(' / ');
  await q.close();
  const f = await ctx.newPage(); watch(f, 'f'); await f.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; }); await f.goto(B); await f.waitForTimeout(300); r.fallback = await f.evaluate(() => [!document.getElementById('no-webgl').hidden, getComputedStyle(document.getElementById('story')).display]); await f.close();
  return { r, errs };
}
