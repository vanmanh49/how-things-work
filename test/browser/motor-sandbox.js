async (page) => {
  const errs = []; const r = {};
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text())); page.on('response', res => res.status() >= 400 && errs.push('http ' + res.status() + ' ' + res.url()));
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('http://localhost:8000/motor/'); await page.waitForTimeout(400);
  await page.locator('#sandbox').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
  const rd = () => page.textContent('#readout');
  const num = (txt, re) => +txt.match(re)[1];
  const set = (id, v) => page.evaluate(([id, v]) => { const i = document.getElementById(id); i.value = v; i.dispatchEvent(new Event('input')); }, [id, v]);
  await page.waitForTimeout(15000);
  let t = await rd(); r.rpm6V = num(t, /Speed: (-?\d+)/); r.i6V = num(t, /Current: (-?[\d.]+)/);
  await page.screenshot({ path: '.playwright-mcp/sb-6v.png' });
  await set('load', 20); await page.waitForTimeout(8000); t = await rd(); r.rpmLoad = num(t, /Speed: (-?\d+)/); r.iLoad = num(t, /Current: (-?[\d.]+)/); r.effLoad = num(t, /Efficiency: (-?\d+)/);
  await set('load', 0); await set('volts', -6); await page.waitForTimeout(15000); t = await rd(); r.rpmNeg = num(t, /Speed: (-?\d+)/);
  const a0 = await page.evaluate(() => 0);
  await page.check('input[name=mode][value=generator]'); await page.waitForTimeout(500); t = await rd(); r.gen = t.split('\n').filter(l => /Back-EMF|Bulb|Speed/.test(l));
  r.genControls = await page.evaluate(() => [document.getElementById('motor-controls').hidden, document.getElementById('gen-controls').hidden]);
  await page.screenshot({ path: '.playwright-mcp/sb-gen.png' });
  await set('volts', 0); await page.check('input[name=mode][value=motor]'); await page.waitForTimeout(100); t = await rd(); r.backToMotorRpm = num(t, /Speed: (-?\d+)/);
  await page.waitForTimeout(3000); t = await rd(); r.coastRpm = num(t, /Speed: (-?\d+)/);
  await page.click('#play'); await page.waitForTimeout(200);
  const box = await page.locator('#sandbox-canvas').boundingBox(); let coil = false;
  for (let y = 0.3; y <= 0.7 && !coil; y += 0.03) for (let x = 0.3; x <= 0.7 && !coil; x += 0.03) {
    await page.mouse.click(box.x + box.width * x, box.y + box.height * y); await page.waitForTimeout(20);
    coil = await page.evaluate(() => !document.getElementById('part-card').hidden && document.querySelector('#part-card h3').textContent === 'Coil');
  }
  r.coilCard = coil; await page.keyboard.press('Escape'); await page.waitForTimeout(50); r.escCloses = await page.evaluate(() => document.getElementById('part-card').hidden);
  return { r, errs };
}
