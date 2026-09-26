window.BridgeNavigation = {
  init(activeModule) {
    document.querySelectorAll('[data-module]').forEach((link) => {
      const active = link.dataset.module === activeModule;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    document.querySelectorAll('.nav-separator ~ .nav-item').forEach((link) => {
      link.setAttribute('aria-disabled', 'true');
      link.addEventListener('click', (event) => event.preventDefault());
    });
  }
};
