(function () {
  const toggle = document.getElementById('nav-toggle');
  const nav = document.getElementById('main-nav');
  const overlay = document.getElementById('nav-overlay');
  if (!toggle || !nav || !overlay) return;

  function openMenu() {
    nav.classList.add('open');
    overlay.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.innerHTML = '<i data-lucide="x" style="width:24px;height:24px;"></i>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    nav.classList.remove('open');
    overlay.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<i data-lucide="menu" style="width:24px;height:24px;"></i>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', () => nav.classList.contains('open') ? closeMenu() : openMenu());
  overlay.addEventListener('click', closeMenu);
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
})();
