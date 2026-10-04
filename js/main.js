// Comportements communs à toutes les pages :
//  - mise en surbrillance du lien de navigation courant (data-page sur <body>) ;
//  - mémorisation du système choisi (Windows / macOS) ;
//  - étapes repliables avec case « terminé » et barre de progression ;
//  - cartes à retourner.
// Tout est stocké dans le navigateur de l'étudiant·e (localStorage) : rien
// n'est envoyé nulle part. Sans stockage disponible, la page reste utilisable.

var TP = (function () {
  var PREFIXE = 'apache-';

  function lire(cle, defaut) {
    try {
      var v = localStorage.getItem(PREFIXE + cle);
      return v === null ? defaut : JSON.parse(v);
    } catch (e) {
      return defaut;
    }
  }

  function ecrire(cle, valeur) {
    try {
      localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur));
    } catch (e) {
      /* stockage indisponible (navigation privée...) : on ignore */
    }
  }

  function echapper(txt) {
    return String(txt).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- Système choisi : 'windows' ou 'macos' ----------

  function os() {
    return lire('os', 'windows');
  }

  function appliquerOs() {
    var o = os();
    document.querySelectorAll('[data-os-btn]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-os-btn') === o);
    });
    document.querySelectorAll('[data-os-bloc]').forEach(function (bloc) {
      bloc.hidden = bloc.getAttribute('data-os-bloc') !== o;
    });
    document.dispatchEvent(new CustomEvent('tp:os', { detail: o }));
  }

  function initOs() {
    document.querySelectorAll('[data-os-btn]').forEach(function (b) {
      b.addEventListener('click', function () {
        ecrire('os', b.getAttribute('data-os-btn'));
        appliquerOs();
      });
    });
    appliquerOs();
  }

  // ---------- Étapes repliables + progression ----------

  function initEtapes() {
    var etapes = document.querySelectorAll('[data-etape]');
    if (!etapes.length) return;
    var cle = 'etapes-' + document.body.getAttribute('data-page');
    var faites = lire(cle, {});

    function majProgression() {
      var n = 0;
      etapes.forEach(function (e) {
        if (faites[e.id]) n++;
      });
      document.querySelectorAll('[data-progress]').forEach(function (barre) {
        barre.style.width = Math.round((100 * n) / etapes.length) + '%';
      });
      document.querySelectorAll('[data-progress-text]').forEach(function (t) {
        t.textContent = n + ' / ' + etapes.length + ' parties terminées';
      });
    }

    function ouvrir(etape, oui) {
      etape.classList.toggle('open', oui);
      etape.querySelector('.scenario-head').setAttribute('aria-expanded', oui);
    }

    etapes.forEach(function (etape, i) {
      var tete = etape.querySelector('.scenario-head');
      var check = etape.querySelector('.scenario-check');
      if (faites[etape.id]) {
        etape.classList.add('done');
        check.checked = true;
      }
      tete.addEventListener('click', function (evt) {
        if (evt.target === check) return;
        ouvrir(etape, !etape.classList.contains('open'));
      });
      tete.addEventListener('keydown', function (evt) {
        if (evt.target === check) return;
        if (evt.key === 'Enter' || evt.key === ' ') {
          evt.preventDefault();
          ouvrir(etape, !etape.classList.contains('open'));
        }
      });
      check.addEventListener('change', function () {
        faites[etape.id] = check.checked;
        etape.classList.toggle('done', check.checked);
        ecrire(cle, faites);
        majProgression();
        // On referme la partie terminée et on ouvre la suivante.
        if (check.checked) {
          ouvrir(etape, false);
          var suivante = etapes[i + 1];
          if (suivante && !suivante.classList.contains('open')) {
            ouvrir(suivante, true);
            suivante.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      });
    });

    // Un lien direct vers une étape (#etape-3) l'ouvre en priorité, sinon
    // la première non terminée.
    var cible = location.hash && document.querySelector(location.hash + '[data-etape]');
    var premiere = Array.prototype.find.call(etapes, function (e) {
      return !faites[e.id];
    });
    if (cible || premiere) ouvrir(cible || premiere, true);

    var reset = document.querySelector('[data-reset-etapes]');
    if (reset) {
      reset.addEventListener('click', function () {
        faites = {};
        ecrire(cle, faites);
        etapes.forEach(function (e) {
          e.classList.remove('done');
          e.querySelector('.scenario-check').checked = false;
        });
        majProgression();
      });
    }
    majProgression();
  }

  // ---------- Cartes à retourner ----------

  function initFlip() {
    document.querySelectorAll('.flip').forEach(function (carte) {
      carte.setAttribute('aria-pressed', 'false');
      carte.addEventListener('click', function () {
        carte.setAttribute('aria-pressed', carte.classList.toggle('retournee'));
      });
    });
  }

  // ---------- Navigation ----------

  function initNav() {
    var current = document.body.getAttribute('data-page');
    document.querySelectorAll('.site-nav a[data-nav]').forEach(function (link) {
      if (link.getAttribute('data-nav') === current) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  initNav();
  initOs();
  initEtapes();
  initFlip();

  return { lire: lire, ecrire: ecrire, echapper: echapper, os: os };
})();
