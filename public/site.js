
(function(){
  'use strict';

  /* --- Logos marquee (dupliqués pour une boucle fluide) --- */
  var logos = [
    ['Construction Voghel','https://cdn.prod.website-files.com/69b1b4d77f9ad62171e00788/69b1c07105b95ccbeccdebd7_Construction%20Voghel.png'],
    ['KZ Extermination','https://cdn.prod.website-files.com/69b1b4d77f9ad62171e00788/69b1c17ae31b68ee0cf4a9af_KZ%20Extermination.png'],
    ['Majestik Époxy','https://cdn.prod.website-files.com/69b1b4d77f9ad62171e00788/69b1c2b09c959149894617ad_Majestik%20%C3%89poxy.png'],
    ['Construction Rénovanor','https://cdn.prod.website-files.com/69b1b4d77f9ad62171e00788/69b1c7ba957bd0684cf4c1e6_Construction%20R%C3%A9novanor.png'],
    ['Époxy Artemis','https://cdn.prod.website-files.com/69b1b4d77f9ad62171e00788/69b1cac743486d9972b10ac1_Epoxy%20Artemis.png'],
    ['CLAAS','https://cdn.prod.website-files.com/69b1b4d77f9ad62171e00788/69b1cc24a8b62e2d66b95739_CLAAS.png']
  ];
  var track = document.getElementById('marqueeTrack');
  function group(){
    var g = document.createElement('div');
    g.className = 'marquee-group';
    logos.forEach(function(l){
      var img = document.createElement('img');
      img.src = l[1]; img.alt = l[0]; img.loading = 'lazy';
      g.appendChild(img);
    });
    return g;
  }
  if(track){
    track.appendChild(group());
    track.appendChild(group());
  }

  /* --- Header au scroll --- */
  var header = document.querySelector('.site-header');
  function onScroll(){ header.classList.toggle('is-scrolled', window.scrollY > 24); }
  onScroll();
  window.addEventListener('scroll', onScroll, {passive:true});

  /* --- Menu mobile --- */
  var toggle = document.getElementById('menuToggle');
  var links = document.getElementById('navLinks');
  toggle.addEventListener('click', function(){
    var open = links.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  });
  links.addEventListener('click', function(e){
    if(e.target.tagName === 'A'){
      links.classList.remove('is-open');
      toggle.setAttribute('aria-expanded','false');
      toggle.setAttribute('aria-label','Ouvrir le menu');
      closeDropdowns();
    }
  });

  /* --- Sous-menus (clic / clavier, en plus du survol sur desktop) --- */
  var dropdownItems = Array.prototype.slice.call(document.querySelectorAll('.nav-item'));
  function closeDropdowns(except){
    dropdownItems.forEach(function(item){
      if(item === except) return;
      item.classList.remove('is-open');
      var btn = item.querySelector('.nav-parent');
      if(btn) btn.setAttribute('aria-expanded','false');
    });
  }
  dropdownItems.forEach(function(item){
    var btn = item.querySelector('.nav-parent');
    if(!btn) return;
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var willOpen = !item.classList.contains('is-open');
      closeDropdowns(willOpen ? item : null);
      item.classList.toggle('is-open', willOpen);
      btn.setAttribute('aria-expanded', String(willOpen));
    });
  });
  document.addEventListener('click', function(e){
    if(!e.target.closest('.nav-item')) closeDropdowns();
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
      closeDropdowns();
      links.classList.remove('is-open');
      toggle.setAttribute('aria-expanded','false');
      toggle.setAttribute('aria-label','Ouvrir le menu');
    }
  });

  /* --- Scan : révélation progressive des images et passage du scan --- */
  var scanStep1 = document.querySelectorAll('.scan-connector--1, .scan-card--2');
  var scanStep2 = document.querySelectorAll('.scan-connector--2, .scan-card--3');
  var scanCard1 = document.querySelector('.scan-card--1');
  var scanCard2 = document.querySelector('.scan-card--2');
  var scanCard3 = document.querySelector('.scan-card--3');
  function revealScan(nodes){
    Array.prototype.forEach.call(nodes, function(el){
      el.classList.remove('scan-hidden');
      el.classList.add('scan-reveal');
    });
  }
  function scanOn(el){ if(el) el.classList.add('is-scanning'); }
  function scanOff(el){ if(el) el.classList.remove('is-scanning'); }
  if(scanStep1.length){
    window.setTimeout(function(){ revealScan(scanStep1); }, 4800);
    window.setTimeout(function(){ scanOff(scanCard1); scanOn(scanCard2); }, 5000);
    window.setTimeout(function(){ revealScan(scanStep2); }, 9800);
    window.setTimeout(function(){ scanOff(scanCard2); scanOn(scanCard3); }, 10000);
  }

  /* --- Reveal au scroll --- */
  var items = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    },{threshold:.12,rootMargin:'0px 0px -40px 0px'});
    items.forEach(function(el){ io.observe(el); });
    /* Filet de sécurité : si l'observer ne rend pas (onglet en arrière-plan, etc.),
       on révèle quand même ce qui est dans le viewport. */
    function revealInViewport(){
      items.forEach(function(el){
        if(el.classList.contains('is-visible')) return;
        var r = el.getBoundingClientRect();
        if(r.top < window.innerHeight*0.92 && r.bottom > 0) el.classList.add('is-visible');
      });
    }
    window.addEventListener('scroll', revealInViewport, {passive:true});
    setTimeout(revealInViewport, 400);
  } else {
    items.forEach(function(el){ el.classList.add('is-visible'); });
  }

  /* --- Formulaire (démo front-end : brancher un webhook/API pour production) --- */
  var form = document.getElementById('leadForm');
  var status = document.getElementById('formStatus');
  if(form && status){
  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(!form.checkValidity()){
      status.textContent = 'Veuillez remplir tous les champs obligatoires.';
      status.style.color = '#ff8f8f';
      status.classList.add('is-visible');
      form.reportValidity();
      return;
    }
    var payload = Object.fromEntries(new FormData(form).entries());
    console.log('[Solution Lead] Nouvelle demande :', payload);
    status.textContent = 'Votre demande a bien été envoyée. Notre équipe vous contacte sous 24 h.';
    status.style.color = '';
    status.classList.add('is-visible');
    form.reset();
  });
  }
})();
