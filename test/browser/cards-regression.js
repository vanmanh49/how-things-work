async (page) => {
  const ctx = page.context(); const errs = []; const r = {};
  const watch = (p) => { p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('response', res => res.status() >= 400 && errs.push('http ' + res.status() + ' ' + res.url())); };
  const p = await ctx.newPage(); watch(p); await p.setViewportSize({ width: 1440, height: 900 });
  for (const [url, cut] of [['http://localhost:8000/engine/', true], ['http://localhost:8000/engine/', false]]) {
    await p.goto(url); await p.waitForTimeout(500);
    await p.locator('#sandbox').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    await p.evaluate(() => { const b = document.getElementById('play'); if (b.textContent === 'Pause') b.click(); });
    if (cut) await p.check('#cutaway'); else await p.uncheck('#cutaway');
    await p.waitForTimeout(200);
    const box = await p.locator('#sandbox-canvas').boundingBox();
    // scan a grid for a point whose click yields Piston
    let got = null;
    for (let y = 0.2; y <= 0.8 && !got; y += 0.04) for (let x = 0.3; x <= 0.7 && !got; x += 0.04) {
      await p.mouse.click(box.x + box.width * x, box.y + box.height * y); await p.waitForTimeout(30);
      const t = await p.evaluate(() => !document.getElementById('part-card').hidden && document.querySelector('#part-card h3').textContent);
      if (t && t.startsWith('Piston')) got = [x, y];
    }
    r['piston_cut_' + cut] = !!got;
    if (cut) {
      await p.screenshot({ path: '.playwright-mcp/card-engine.png', clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
      await p.mouse.click(box.x + 5, box.y + 5); await p.waitForTimeout(50);
      r.emptyHides = await p.evaluate(() => document.getElementById('part-card').hidden);
      await p.mouse.click(box.x + box.width * got[0], box.y + box.height * got[1]); await p.waitForTimeout(50);
      await p.keyboard.press('Escape'); await p.waitForTimeout(50);
      r.escHides = await p.evaluate(() => document.getElementById('part-card').hidden);
    }
  }
  await p.goto('http://localhost:8000/solar/'); await p.waitForTimeout(600);
  await p.locator('#sandbox').scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  const box = await p.locator('#sandbox-canvas').boundingBox();
  let earth = false;
  for (let y = 0.3; y <= 0.7 && !earth; y += 0.02) for (let x = 0.3; x <= 0.7 && !earth; x += 0.02) {
    await p.mouse.click(box.x + box.width * x, box.y + box.height * y); await p.waitForTimeout(20);
    earth = await p.evaluate(() => !document.getElementById('part-card').hidden && document.querySelector('#part-card h3').textContent === 'Earth');
  }
  r.solarEarth = earth; await p.keyboard.press('Escape'); await p.waitForTimeout(50);
  r.solarEsc = await p.evaluate(() => document.getElementById('part-card').hidden);
  await p.close();
  return { r, errs };
}
