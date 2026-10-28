// A közös főoldal indexelhető marad; a belső hash-nézetek külön noindexet kapnak.
(function () {
  const robots = document.querySelector('meta[name="robots"]');
  if (!robots) return;
  const publicRobots = robots.content;
  const privateRoutes = new Set(['#admin', '#auth', '#feltoltes', '#profil', '#profilom', '#uzenetek']);
  function update() {
    const hash = window.location.hash.split('?')[0].toLowerCase();
    robots.content = privateRoutes.has(hash) ? 'noindex,nofollow' : publicRobots;
    const links = document.getElementById('seo-service-links');
    if (links) links.hidden = !!hash && hash !== '#home';
  }
  update();
  window.addEventListener('hashchange', update);
})();
