(() => {
  const sidebar = document.querySelector('#sidebar');
  const menuButton = document.querySelector('#menuButton');
  if (menuButton && sidebar) {
    menuButton.addEventListener('click', () => sidebar.classList.toggle('open'));
  }

  for (const item of document.querySelectorAll('.nav-item')) {
    item.addEventListener('click', () => {
      for (const other of document.querySelectorAll('.nav-item')) other.classList.remove('active');
      item.classList.add('active');
      if (window.matchMedia('(max-width: 900px)').matches && sidebar) sidebar.classList.remove('open');
    });
  }

  for (const link of document.querySelectorAll('a[href="#"]')) {
    link.addEventListener('click', (event) => event.preventDefault());
  }
})();
