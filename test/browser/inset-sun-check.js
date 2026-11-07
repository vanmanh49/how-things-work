async (page) => {
  const p = await page.context().newPage(); await p.setViewportSize({ width: 1440, height: 900 });
  await p.goto('http://localhost:8000/solar/'); await p.locator('#sandbox').scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
  const sunPixels = async () => {
    const png = (await p.locator('#sandbox-inset').screenshot()).toString('base64');
    return p.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 140 && d[i + 2] < 90) n++;
      return n;
    }, png);
  };
  await p.click('[data-kind="newMoon"]'); await p.waitForTimeout(300);
  const nm = { readout: (await p.textContent('#readout')).split('\n').filter(l => /Day|Eclipse/.test(l)).join(' / '), sunPx: await sunPixels() };
  await p.click('[data-kind="eclipse"]'); await p.waitForTimeout(300);
  const ec = { readout: (await p.textContent('#readout')).split('\n').filter(l => /Day|Eclipse/.test(l)).join(' / '), sunPx: await sunPixels() };
  await p.close(); return { nonEclipseNewMoon: nm, solarEclipse: ec };
}
