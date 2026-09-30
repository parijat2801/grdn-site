// Fetch og:image + title for a list of URLs; save images to web/, write web.json.
const fs = require('fs');
const urls = process.argv.slice(2);
const pick = (html, re) => { const m = html.match(re); return m ? m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim() : null; };
(async () => {
  const out = [];
  for (const url of urls) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130 Safari/537.36' }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
      const html = await r.text();
      let img = pick(html, /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)/i) || pick(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
             || pick(html, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i);
      const title = pick(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || pick(html, /<title[^>]*>([^<]+)/i);
      let file = null;
      if (img) {
        img = new URL(img, r.url).href;
        const ir = await fetch(img, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
        const ct = ir.headers.get('content-type') || '';
        if (ir.ok && ct.startsWith('image/')) {
          const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : ct.includes('svg') ? 'svg' : 'jpg';
          file = 'web/' + new URL(url).hostname.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-') + '-' + (out.length) + '.' + ext;
          fs.writeFileSync(file, Buffer.from(await ir.arrayBuffer()));
        }
      }
      out.push({ url, status: r.status, title, file });
      console.log(r.status, file ? 'IMG ' : 'noimg', url, '|', title);
    } catch (e) { console.log('ERR', url, e.message); out.push({ url, error: e.message }); }
  }
  fs.writeFileSync('web.json', JSON.stringify(out, null, 2));
})();
