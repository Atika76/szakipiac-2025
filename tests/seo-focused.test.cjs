const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), cp = require('node:child_process'), vm = require('node:vm');
const baseline = '564847a883c7a7614e799887da8cda5fe097a721';
const read = f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const urls = [...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
const sourceFile = url => {
  const path = new URL(url).pathname;
  return path === '/' ? 'index.html' : path === '/en/' ? 'En/index.html' : path.slice(1);
};
const attr = (source, tag, key, value, result) => {
  const found = [...source.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map(m => m[0]).filter(t => new RegExp(`\\b${key}=["']${value}["']`).test(t));
  return found.map(t => t.match(new RegExp(`\\b${result}=["']([^"']*)["']`))?.[1]);
};

test('a sitemap létező, egyedi, indexelhető canonical célokat tartalmaz', () => {
  assert.equal(urls.length, 12); assert.equal(new Set(urls).size, urls.length);
  for (const url of urls) {
    assert.ok(fs.existsSync(sourceFile(url)), url);
    const s = read(sourceFile(url));
    assert.deepEqual(attr(s, 'link', 'rel', 'canonical', 'href'), [url]);
    assert.ok(!attr(s, 'meta', 'name', 'robots', 'content')[0].includes('noindex'));
    assert.equal(new URL(url).hash, '');
  }
  assert.ok(urls.includes('https://szakipiac-2025.hu/kalkulator.html'));
  assert.ok(!urls.some(u => /admin|rolunk\.html|kapcsolat\.html|hirdetes-feltoltes/.test(u)));
});

test('minden fontos oldal címe, leírása és Open Graph URL-je egyedi és célzott', () => {
  const titles = [], descriptions = [];
  for (const url of urls) {
    const s = read(sourceFile(url));
    titles.push(s.match(/<title>(.*?)<\/title>/s)[1]);
    descriptions.push(attr(s, 'meta', 'name', 'description', 'content')[0]);
    assert.deepEqual(attr(s, 'meta', 'property', 'og:url', 'content'), [url]);
    assert.ok(!s.includes('Friss tippek, kalkulátorok és árbecslések a SzakiPiac oldalán.'));
  }
  assert.equal(new Set(titles).size, titles.length);
  assert.equal(new Set(descriptions).size, descriptions.length);
});

test('a magyar és angol változat kölcsönös hreflang és saját canonical kapcsolatot kap', () => {
  for (const f of ['index.html', 'En/index.html']) {
    const s = read(f);
    for (const [lang, url] of [['hu','https://szakipiac-2025.hu/'], ['en','https://szakipiac-2025.hu/en/'], ['x-default','https://szakipiac-2025.hu/']]) {
      assert.deepEqual(attr(s, 'link', 'hreflang', lang, 'href'), [url]);
    }
  }
});

test('a privát nézetek noindexet kapnak, a főoldalra visszalépés helyreállítja az indexelést', () => {
  for (const f of ['ar-admin.html', 'profilom.html', 'uzenetek.html', 'ajanlat.html', 'index-pagespeed-preview.html']) {
    assert.ok(attr(read(f), 'meta', 'name', 'robots', 'content')[0].includes('noindex'), f);
  }
  const robots = { content: 'index,follow,max-image-preview:large' }, hub = {}, events = {};
  const window = { location: { hash: '#admin' }, addEventListener: (e, fn) => events[e] = fn };
  vm.runInNewContext(read('seo-route-meta.js'), { window, document: { querySelector: () => robots, getElementById: () => hub } });
  assert.equal(robots.content, 'noindex,nofollow'); assert.equal(hub.hidden, true);
  window.location.hash = '#home'; events.hashchange();
  assert.equal(robots.content, 'index,follow,max-image-preview:large'); assert.equal(hub.hidden, false);
});

test('az alkalmazás űrlapjai, azonosítói és meglévő futtatható scriptjei megmaradnak', () => {
  const changed = cp.execFileSync('git', ['diff', '--name-only', '--diff-filter=M', baseline], { encoding: 'utf8' }).trim().split(/\r?\n/);
  for (const f of changed.filter(f => f.endsWith('.html'))) {
    const old = cp.execFileSync('git', ['show', `${baseline}:${f}`], { encoding: 'utf8' }).replace(/\r\n/g, '\n'), s = read(f);
    const scripts = source => [...source.matchAll(/<script([^>]*)>(.*?)<\/script>/gs)].filter(m => !m[1].includes('ld+json') && !m[1].includes('seo-route-meta.js')).map(m => m[0]);
    assert.deepEqual(scripts(s), scripts(old), f + ' executable scripts');
    const ids = source => [...source.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    for (const id of ids(old)) assert.ok(ids(s).includes(id), f + ': ' + id);
    const forms = source => [...source.matchAll(/<(?:form|input|select)\b[^>]*>/g)].map(m => m[0]);
    assert.deepEqual(forms(s), forms(old), f + ' forms');
  }
  assert.ok(changed.every(f => f.endsWith('.html') || ['sitemap.xml','seo-route-meta.js','seo-guide.css','tests/seo-focused.test.cjs'].includes(f)), 'Unexpected runtime change');
});

test('az önálló szakemberkereső és az új belső linkek céljai ténylegesen léteznek', () => {
  assert.ok(read('szakemberkereso.html').includes('id="villanyszerelo"'));
  for (const url of urls) {
    const file = sourceFile(url), s = read(file);
    const addedBlock = file === 'index.html' ? s.match(/<section id="seo-service-links".*?<\/section>/s)?.[0] : s;
    for (const match of (addedBlock || '').matchAll(/href="([^"]*)"/g)) {
      const target = new URL(match[1], url);
      if (target.origin !== 'https://szakipiac-2025.hu') continue;
      const path = target.pathname;
      if (path === '/en/' || path === '/') continue;
      if (path.endsWith('.html') || path.endsWith('.css') || path.endsWith('.png')) assert.ok(fs.existsSync(path.slice(1)), file + ': ' + target);
    }
  }
});
