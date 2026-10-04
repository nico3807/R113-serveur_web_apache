// Page Livrable : identité, dépôt des captures d'écran (JPG), rédaction
// des réponses Q1 à Q7, puis génération du compte rendu PDF
// (js/compte-rendu.js). Tout reste dans le navigateur : rien n'est envoyé.

(function () {
  var zones = document.querySelectorAll('.reponse textarea');
  if (!zones.length) return;
  // Une question peut avoir plusieurs champs (Q7 : ligne du journal + explication).
  var blocs = document.querySelectorAll('.reponse[data-partie]');
  function blocRempli(b) {
    return Array.prototype.every.call(b.querySelectorAll('textarea'), function (t) {
      return t.value.trim().length > 0;
    });
  }
  var reponses = TP.lire('reponses', {});
  var prenom = document.getElementById('prenom');
  var nom = document.getElementById('nom');
  var info = document.getElementById('pdf-info');

  // Captures en mémoire (la copie dans le navigateur peut échouer si
  // l'espace de stockage est plein : la capture reste alors utilisable
  // tant que la page est ouverte).
  var captures = {};
  var clesCaptures = Array.prototype.map.call(document.querySelectorAll('.capture[data-capture]'), function (c) {
    var cle = c.getAttribute('data-capture');
    captures[cle] = TP.lire(cle, null);
    return cle;
  });

  // ---------- État du livrable ----------

  function nbReponses() {
    var n = 0;
    blocs.forEach(function (b) {
      if (blocRempli(b)) n++;
    });
    return n;
  }

  function maj() {
    var n = nbReponses();
    blocs.forEach(function (b) {
      b.classList.toggle('remplie', blocRempli(b));
    });
    document.getElementById('reponses-compteur').textContent = n + ' / ' + blocs.length;
    document.getElementById('reponses-progression').textContent = n + ' / ' + blocs.length + ' réponses rédigées';
    document.querySelectorAll('[data-progress]').forEach(function (b) {
      b.style.width = Math.round((100 * n) / blocs.length) + '%';
    });
    var etats = {
      identite: prenom.value.trim() && nom.value.trim(),
      reponses: n === blocs.length
    };
    clesCaptures.forEach(function (k) {
      etats[k] = !!captures[k];
    });
    Object.keys(etats).forEach(function (k) {
      var li = document.querySelector('[data-etat="' + k + '"]');
      if (li) li.classList.toggle('faite', !!etats[k]);
    });
  }

  // ---------- Identité et réponses ----------

  // Dès le premier PDF généré, l'identité est figée sur ce poste : on ne
  // peut plus changer de nom pour générer le compte rendu d'un·e camarade.
  // Le PDF utilise toujours l'identité verrouillée, même si les champs
  // sont réactivés avec les outils de développement du navigateur.
  var verrou = TP.lire('identite-verrou', null);

  function appliquerVerrou() {
    var note = document.getElementById('identite-verrou');
    if (!verrou) {
      if (note) note.hidden = true;
      return;
    }
    [prenom, nom].forEach(function (champ) {
      champ.value = verrou[champ.id];
      champ.readOnly = true;
      champ.setAttribute('aria-readonly', 'true');
      champ.title = 'Identité verrouillée depuis la génération du premier PDF';
    });
    if (note) {
      note.hidden = false;
      note.textContent = '\uD83D\uDD12 Identité verrouillée depuis la génération du premier PDF, le ' + verrou.date +
        '. Elle ne peut plus être modifiée. En cas d\'erreur, adresse-toi à ton enseignant·e.';
    }
  }

  prenom.value = TP.lire('prenom', '');
  nom.value = TP.lire('nom', '');
  [prenom, nom].forEach(function (champ) {
    champ.addEventListener('input', function () {
      if (verrou) {
        champ.value = verrou[champ.id];
        return;
      }
      TP.ecrire(champ.id, champ.value);
      maj();
    });
  });
  appliquerVerrou();

  zones.forEach(function (z) {
    z.value = reponses[z.id] || '';
    z.addEventListener('input', function () {
      reponses[z.id] = z.value;
      TP.ecrire('reponses', reponses);
      maj();
    });
  });

  // ---------- Captures d'écran ----------

  function estJpeg(fichier, octets) {
    var nomOk = /\.jpe?g$/i.test(fichier.name);
    var typeOk = fichier.type === 'image/jpeg' || fichier.type === '';
    // Signature d'un JPEG : les deux premiers octets valent FF D8.
    var magique = octets[0] === 0xff && octets[1] === 0xd8;
    return nomOk && typeOk && magique;
  }

  // Réduit l'image (1600 px de large au plus) et la réencode en JPEG : le
  // PDF reste léger et la capture tient dans le stockage du navigateur.
  function preparer(url, rappel) {
    var img = new Image();
    img.onload = function () {
      var max = 1600;
      var r = Math.min(1, max / img.naturalWidth);
      var w = Math.round(img.naturalWidth * r);
      var h = Math.round(img.naturalHeight * r);
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      rappel(null, { data: canvas.toDataURL('image/jpeg', 0.88), w: w, h: h });
    };
    img.onerror = function () {
      rappel(new Error('image illisible'));
    };
    img.src = url;
  }

  function sauverCapture(cle, valeur) {
    try {
      if (valeur) localStorage.setItem('apache-' + cle, JSON.stringify(valeur));
      else localStorage.removeItem('apache-' + cle);
      return true;
    } catch (e) {
      return false;
    }
  }

  document.querySelectorAll('.capture').forEach(function (bloc) {
    var cle = bloc.getAttribute('data-capture');
    var input = bloc.querySelector('input[type="file"]');
    var depot = bloc.querySelector('.depot');
    var apercu = bloc.querySelector('.depot-apercu');
    var etat = bloc.querySelector('.capture-etat');
    var retirer = bloc.querySelector('[data-retirer]');

    function afficher(message, erreur) {
      var c = captures[cle];
      bloc.classList.toggle('ok', !!c && !erreur);
      bloc.classList.toggle('erreur', !!erreur);
      apercu.hidden = !c;
      depot.classList.toggle('rempli', !!c);
      if (c) apercu.src = c.data;
      else apercu.removeAttribute('src');
      retirer.hidden = !c;
      etat.textContent = message || (c ? '✔ ' + c.nom + ' (' + c.w + ' × ' + c.h + ' px)' : 'Aucune capture');
      maj();
    }

    function charger(fichier) {
      if (!fichier) return;
      var lecteur = new FileReader();
      lecteur.onload = function () {
        var octets = new Uint8Array(lecteur.result.slice(0, 4));
        if (!estJpeg(fichier, octets)) {
          afficher('✖ « ' + fichier.name + ' » n\'est pas une image JPG. Enregistre ta capture au format .jpg.', true);
          return;
        }
        var url = URL.createObjectURL(fichier);
        preparer(url, function (err, res) {
          URL.revokeObjectURL(url);
          if (err) {
            afficher('✖ Impossible de lire cette image.', true);
            return;
          }
          res.nom = fichier.name;
          captures[cle] = res;
          var ok = sauverCapture(cle, res);
          afficher(ok ? null : '✔ ' + fichier.name + ' chargée, mais non mémorisée (stockage plein) : génère le PDF avant de quitter la page.');
        });
      };
      lecteur.readAsArrayBuffer(fichier);
    }

    input.addEventListener('change', function () {
      charger(input.files[0]);
      input.value = '';
    });
    ['dragenter', 'dragover'].forEach(function (t) {
      depot.addEventListener(t, function (evt) {
        evt.preventDefault();
        depot.classList.add('survol');
      });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      depot.addEventListener(t, function () {
        depot.classList.remove('survol');
      });
    });
    depot.addEventListener('drop', function (evt) {
      evt.preventDefault();
      charger(evt.dataTransfer.files[0]);
    });
    retirer.addEventListener('click', function () {
      captures[cle] = null;
      sauverCapture(cle, null);
      afficher();
    });
    afficher();
  });

  // ---------- Messages ----------

  function message(txt, ok) {
    info.textContent = txt;
    info.className = 'feedback ' + (ok ? 'ok' : 'ko');
  }

  // ---------- Réponses : ni sélection, ni copie, ni collage ----------
  // Les réponses s'écrivent normalement au clavier, mais ne peuvent être
  // ni sélectionnées ni copiées (on ne récupère pas le travail d'un·e
  // camarade resté ouvert sur un poste), ni collées depuis un autre texte
  // (camarade, site web, IA...) : clavier, clic droit ou glisser-déposer.
  zones.forEach(function (z) {
    // Champ prévu pour coller une ligne copiée depuis le terminal (Q7) :
    // le collage y reste autorisé.
    if (z.hasAttribute('data-collage')) return;
    ['copy', 'cut', 'dragstart', 'contextmenu'].forEach(function (type) {
      z.addEventListener(type, function (evt) {
        evt.preventDefault();
        message('\u26D4 La copie des réponses est désactivée sur cette page.', false);
      });
    });
    function refuserCollage(evt) {
      evt.preventDefault();
      message('\u26D4 Le collage est désactivé : rédige tes réponses toi-même.', false);
    }
    ['paste', 'drop'].forEach(function (type) {
      z.addEventListener(type, refuserCollage);
    });
    z.addEventListener('dragover', function (evt) {
      evt.preventDefault();
      evt.dataTransfer.dropEffect = 'none';
    });
    // Filet de sécurité pour les autres voies d'insertion (menu Édition du
    // navigateur, saisie vocale du presse-papiers...).
    z.addEventListener('beforeinput', function (evt) {
      if (/^insertFrom(Paste|Drop|PasteAsQuotation|YankRemove)/.test(evt.inputType || '') ||
          evt.inputType === 'insertReplacementText' && evt.dataTransfer) {
        refuserCollage(evt);
      }
    });
    // Toute sélection est aussitôt réduite au curseur (souris, Maj + flèches,
    // Ctrl + A...). La saisie et l'effacement restent possibles.
    z.addEventListener('select', function () {
      if (z.selectionStart !== z.selectionEnd) {
        var fin = z.selectionDirection === 'backward' ? z.selectionStart : z.selectionEnd;
        z.setSelectionRange(fin, fin);
      }
    });
  });

  // ---------- Génération du PDF ----------

  // Avancement des activités interactives (chacune mémorise { faites: {...} }).
  function entrainement() {
    return [
      { libelle: 'Bac à sable (actions)', cle: 'bac', total: 29 }
    ].map(function (t) {
      var etat = TP.lire(t.cle, null);
      var faites = etat && etat.faites ? Object.keys(etat.faites).filter(function (k) {
        return etat.faites[k];
      }).length : 0;
      return { libelle: t.libelle, faites: Math.min(faites, t.total), total: t.total };
    });
  }

  document.getElementById('generer-pdf').addEventListener('click', function () {
    var bouton = this;
    if (!prenom.value.trim() || !nom.value.trim()) {
      message('✖ Renseigne ton prénom et ton nom avant de générer le PDF.', false);
      (prenom.value.trim() ? nom : prenom).focus();
      return;
    }
    if (!window.jspdf || !window.CompteRendu) {
      message('✖ Le générateur de PDF n\'a pas pu être chargé.', false);
      return;
    }
    var maintenant = new Date();
    var quand = maintenant.toLocaleDateString('fr-FR') + ' à ' + maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    var identite = verrou || { prenom: prenom.value.trim(), nom: nom.value.trim() };
    if (!verrou && !window.confirm(
      'Ton identité va être verrouillée sur ce poste :\n\n    ' + identite.prenom + ' ' + identite.nom.toUpperCase() +
      '\n\nElle ne pourra plus être modifiée après la génération du PDF. Vérifie l\'orthographe. Continuer ?')) {
      message('Génération annulée : vérifie ton prénom et ton nom.', false);
      return;
    }
    var opts = {
      prenom: identite.prenom,
      nom: identite.nom,
      date: quand,
      questions: Array.prototype.map.call(blocs, function (bloc) {
        var champs = Array.prototype.map.call(bloc.querySelectorAll('textarea'), function (t) {
          var v = t.value.trim();
          var pre = t.getAttribute('data-prefixe');
          if (!v) return pre ? pre + ' : (non renseigné)' : '(partie non rédigée)';
          return pre ? pre + ' : ' + v : v;
        });
        var vide = Array.prototype.every.call(bloc.querySelectorAll('textarea'), function (t) { return !t.value.trim(); });
        return {
          titre: bloc.querySelector('label').textContent.trim(),
          enonce: bloc.querySelector('.rappel').firstChild.textContent.trim(),
          reponse: vide ? '' : champs.join('\n'),
          partie: +bloc.getAttribute('data-partie')
        };
      }),
      captures: clesCaptures.map(function (k) { return captures[k]; }),
      titresCaptures: Array.prototype.map.call(document.querySelectorAll('.capture h3'), function (h) {
        return h.textContent.replace(/^.*·\s*/, '').trim();
      }),
      legendesCaptures: Array.prototype.map.call(document.querySelectorAll('.capture .rappel'), function (p) {
        return p.textContent.trim();
      }),
      entrainement: entrainement()
    };
    bouton.disabled = true;
    bouton.textContent = 'Génération en cours…';
    try {
      var res = CompteRendu.generer(opts);
      if (!verrou) {
        verrou = { prenom: identite.prenom, nom: identite.nom, date: quand };
        TP.ecrire('identite-verrou', verrou);
        TP.ecrire('prenom', verrou.prenom);
        TP.ecrire('nom', verrou.nom);
      }
      appliquerVerrou();
      message(res.complet
        ? '✔ PDF généré (' + res.pages + ' pages) : dépose-le sur Moodle.'
        : '⚠ PDF généré (' + res.pages + ' pages) mais INCOMPLET : complète les éléments non cochés en haut de la page, puis régénère-le.',
        res.complet);
    } catch (e) {
      message('✖ Échec de la génération du PDF : ' + e.message, false);
    } finally {
      bouton.disabled = false;
      bouton.textContent = '📄 Générer mon compte rendu PDF';
    }
  });

  maj();
})();
