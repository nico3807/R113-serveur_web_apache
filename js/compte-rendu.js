// Compte rendu PDF du TP3 (jsPDF). Même mise en page que le certificat des
// exercices du dépôt bases_de_js :
//   - page 1 : logos de part et d'autre du titre, identité de l'étudiant·e,
//     statistiques et état d'avancement ;
//   - ensuite : les réponses aux questions Q1 à Q9 ;
//   - enfin : les deux captures d'écran, une par page.
// Le PDF est verrouillé : impression seule, aucune modification possible.
// Tant qu'il manque une réponse ou une capture, le document s'intitule
// « Compte rendu incomplet » et porte la mention « INCOMPLET ».

var CompteRendu = (function () {
  var TITRE_TP = 'TP3 - Serveur web Apache';
  var RESSOURCE = 'R1.13 Hébergement';

  // Les polices standard du PDF ne connaissent que le latin-1 : on retire
  // les autres caractères (émojis, symboles…).
  function nettoyer(s) {
    return String(s).replace(/[^\x20-\x7EÀ-ÿŒœ€«»'’‘…–—°]/g, '').replace(/[ \t]+/g, ' ').trim();
  }

  function motDePasseAleatoire() {
    var octets = new Uint8Array(24);
    (window.crypto || window.msCrypto).getRandomValues(octets);
    return Array.prototype.map.call(octets, function (o) { return ('0' + o.toString(16)).slice(-2); }).join('');
  }

  function slug(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'etudiant';
  }

  /*
   * opts = {
   *   prenom, nom, date,
   *   questions: [{ titre, enonce, reponse, partie }],
   *   captures: [{ data, w, h } | null, null], titresCaptures, legendesCaptures,
   *   entrainement: [{ libelle, faites, total }]
   * }
   */
  function generer(opts) {
    var jsPDF = window.jspdf.jsPDF;
    // Document verrouillé : il s'ouvre sans mot de passe, mais seule
    // l'impression est autorisée. Le mot de passe « propriétaire » qui
    // lèverait ces restrictions est tiré au hasard et n'est conservé nulle
    // part : personne ne le connaît.
    var doc = new jsPDF({
      unit: 'mm',
      format: 'a4',
      encryption: {
        userPassword: '',
        ownerPassword: motDePasseAleatoire(),
        userPermissions: ['print']
      }
    });
    var W = 210, H = 297, MARGE = 14, BAS = H - 23;
    var prenom = nettoyer(opts.prenom);
    var nom = nettoyer(opts.nom).toUpperCase();
    var nbReponses = opts.questions.filter(function (q) { return q.reponse.trim(); }).length;
    var nbCaptures = opts.captures.filter(Boolean).length;
    var complet = nbReponses === opts.questions.length && nbCaptures === opts.captures.length;

    function cadre() {
      doc.setDrawColor(30, 58, 95);
      doc.setLineWidth(1.2);
      doc.roundedRect(7, 7, W - 14, H - 14, 4, 4);
      if (complet) doc.setDrawColor(22, 163, 74);
      else doc.setDrawColor(255, 160, 100);
      doc.setLineWidth(0.4);
      doc.roundedRect(9.5, 9.5, W - 19, H - 19, 3, 3);
    }

    function filigrane() {
      if (complet) return;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(52);
      try {
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({ opacity: 0.13 }));
        doc.setTextColor(200, 40, 40);
        doc.text('INCOMPLET', W / 2, H / 2 + 30, { angle: 45, align: 'center' });
        doc.restoreGraphicsState();
      } catch (e) {
        doc.setTextColor(246, 214, 214);
        doc.text('INCOMPLET', W / 2, H / 2 + 30, { angle: 45, align: 'center' });
      }
    }

    function nouvellePage() {
      doc.addPage();
      filigrane();
      cadre();
      return 20;
    }

    function separateur(y) {
      doc.setDrawColor(180, 180, 200);
      doc.setLineWidth(0.3);
      doc.line(MARGE + 6, y, W - MARGE - 6, y);
    }

    function titreSection(texte, y) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 30, 60);
      doc.text(texte, MARGE, y);
    }

    filigrane();
    cadre();

    /* ---------- Logos de part et d'autre du titre ---------- */
    var haut = 16, hLogo = 20;
    var logos = window.CERTIFICAT_LOGOS || {};
    [['gauche', MARGE], ['droite', null]].forEach(function (c) {
      var logo = logos[c[0]];
      if (!logo) return;
      var w = Math.min(hLogo * logo.ratio, 38), h = w / logo.ratio;
      var x = c[1] === null ? W - MARGE - w : c[1];
      try { doc.addImage(logo.data, logo.format, x, haut + (hLogo - h) / 2, w, h); } catch (e) { /* logo ignoré */ }
    });

    /* ---------- Titre ---------- */
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 60);
    doc.setFontSize(17);
    doc.text(complet ? 'COMPTE RENDU DE TP' : 'COMPTE RENDU INCOMPLET', W / 2, haut + 9, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(30, 58, 95);
    doc.text(nettoyer(TITRE_TP), W / 2, haut + 16, { align: 'center' });
    separateur(42);

    /* ---------- Corps ---------- */
    var y = 50;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 80);
    doc.setFontSize(11);
    doc.text('Compte rendu rédigé par', W / 2, y, { align: 'center' });
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(20, 20, 40);
    doc.text(prenom + ' ' + nom, W / 2, y, { align: 'center' });
    y += 9;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 80);
    var intro = doc.splitTextToSize(
      complet
        ? 'dans le cadre du « ' + TITRE_TP + ' » (BUT MMI 1, ' + RESSOURCE + ') : réponses aux ' +
          opts.questions.length + ' questions du sujet et captures d\'écran de son serveur web ' +
          'Apache configuré sur Killercoda.'
        : 'dans le cadre du « ' + TITRE_TP + ' » (BUT MMI 1, ' + RESSOURCE + '). Ce document est incomplet : ' +
          'il contient ' + nbReponses + ' réponse' + (nbReponses > 1 ? 's' : '') + ' sur ' + opts.questions.length +
          ' et ' + nbCaptures + ' capture' + (nbCaptures > 1 ? 's' : '') + ' d\'écran sur ' + opts.captures.length + '.',
      W - 2 * MARGE - 20);
    doc.text(intro, W / 2, y, { align: 'center' });
    y += intro.length * 5 + 7;

    /* ---------- Statistiques ---------- */
    var lignes = [
      ['Statut', complet ? 'Complet' : 'INCOMPLET'],
      ['Date d\'édition', opts.date],
      ['Réponses rédigées', nbReponses + ' / ' + opts.questions.length],
      ['Captures d\'écran', nbCaptures + ' / ' + opts.captures.length]
    ];
    opts.entrainement.forEach(function (e) {
      lignes.push(['Activité : ' + e.libelle, e.faites + ' / ' + e.total]);
    });
    doc.setFontSize(10.5);
    lignes.forEach(function (l) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(80, 80, 110);
      doc.text(nettoyer(l[0]) + ' :', W / 2 - 4, y, { align: 'right' });
      doc.setFont('helvetica', l[0] === 'Statut' ? 'bold' : 'normal');
      if (l[0] === 'Statut') {
        if (complet) doc.setTextColor(30, 140, 60);
        else doc.setTextColor(200, 40, 40);
      } else doc.setTextColor(40, 40, 60);
      doc.text(nettoyer(l[1]), W / 2 + 2, y);
      y += 6.5;
    });

    /* ---------- État d'avancement ---------- */
    y += 4;
    separateur(y);
    y += 7;
    titreSection('État d\'avancement', y);
    y += 6;
    var parties = [];
    ['Installation, accès (Q1 à Q3)', 'Droits, alias, logs (Q4 à Q7)'].forEach(function (lib, i) {
      var qs = opts.questions.filter(function (q) { return q.partie === i; });
      parties.push({ libelle: 'Réponses - ' + lib, reussis: qs.filter(function (q) { return q.reponse.trim(); }).length, total: qs.length });
    });
    parties.push({ libelle: 'Captures d\'écran', reussis: nbCaptures, total: opts.captures.length });
    opts.entrainement.forEach(function (e) {
      parties.push({ libelle: e.libelle, reussis: e.faites, total: e.total });
    });
    var barX = MARGE + 66, barW = 60, barH = 3.2;
    doc.setFontSize(9.5);
    parties.forEach(function (c) {
      var fini = c.reussis >= c.total;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 60);
      doc.text(nettoyer(c.libelle), MARGE + 2, y);
      doc.setDrawColor(200, 205, 220);
      doc.setFillColor(235, 238, 245);
      doc.roundedRect(barX, y - 2.6, barW, barH, 1.2, 1.2, 'FD');
      var remplissage = Math.max(0, Math.min(1, c.reussis / c.total)) * barW;
      if (remplissage > 0) {
        if (fini) doc.setFillColor(22, 163, 74);
        else doc.setFillColor(30, 58, 95);
        doc.roundedRect(barX, y - 2.6, Math.max(remplissage, 2.4), barH, 1.2, 1.2, 'F');
      }
      doc.setFont('helvetica', fini ? 'bold' : 'normal');
      if (fini) doc.setTextColor(22, 130, 60);
      else doc.setTextColor(80, 80, 110);
      doc.text(c.reussis + '/' + c.total + (fini ? ' — complet' : ''), barX + barW + 4, y);
      y += 6.2;
    });

    /* ---------- Réponses aux questions ---------- */
    y += 4;
    separateur(y);
    y += 7;
    titreSection('Réponses aux questions', y);
    y += 7;
    var largeur = W - 2 * MARGE - 4;
    opts.questions.forEach(function (q) {
      doc.setFontSize(10.5);
      var titre = doc.splitTextToSize(nettoyer(q.titre), largeur);
      doc.setFontSize(8.5);
      var enonce = doc.splitTextToSize(nettoyer(q.enonce), largeur);
      doc.setFontSize(10);
      var paragraphes = q.reponse.trim() ? q.reponse.trim().split(/\n+/) : [];
      var corps = [];
      paragraphes.forEach(function (p) {
        corps = corps.concat(doc.splitTextToSize(nettoyer(p), largeur - 4));
      });
      if (!corps.length) corps = ['(pas de réponse)'];
      // On évite de séparer le titre de la question de sa réponse.
      var besoin = titre.length * 5 + enonce.length * 3.8 + Math.min(corps.length, 3) * 4.6 + 4;
      if (y + besoin > BAS) y = nouvellePage();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(30, 58, 95);
      doc.text(titre, MARGE + 2, y);
      y += titre.length * 5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(120, 120, 140);
      doc.text(enonce, MARGE + 2, y);
      y += enonce.length * 3.8 + 1.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      if (q.reponse.trim()) doc.setTextColor(40, 40, 60);
      else doc.setTextColor(200, 40, 40);
      var haut0 = y;
      corps.forEach(function (ligne) {
        if (y > BAS) {
          // Trait de marge sur la partie déjà écrite, puis page suivante.
          doc.setDrawColor(200, 205, 220);
          doc.line(MARGE + 3, haut0 - 3.4, MARGE + 3, y - 3.4);
          y = nouvellePage();
          haut0 = y;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(40, 40, 60);
        }
        doc.text(ligne, MARGE + 6, y);
        y += 4.6;
      });
      doc.setDrawColor(200, 205, 220);
      doc.setLineWidth(0.6);
      doc.line(MARGE + 3, haut0 - 3.4, MARGE + 3, y - 3.4);
      doc.setLineWidth(0.3);
      y += 4;
    });

    /* ---------- Captures d'écran (une par page) ---------- */
    opts.captures.forEach(function (c, i) {
      y = nouvellePage();
      titreSection(nettoyer('Capture d\'écran ' + (i + 1) + ' : ' + opts.titresCaptures[i]), y);
      y += 6;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 120);
      var leg = doc.splitTextToSize(nettoyer(opts.legendesCaptures[i]), W - 2 * MARGE);
      doc.text(leg, MARGE, y);
      y += leg.length * 4 + 4;
      if (!c) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(200, 40, 40);
        doc.text('Capture non fournie', W / 2, y + 30, { align: 'center' });
        return;
      }
      var maxW = W - 2 * MARGE, maxH = BAS - y;
      var w = maxW, h = w * c.h / c.w;
      if (h > maxH) {
        h = maxH;
        w = h * c.w / c.h;
      }
      var x = (W - w) / 2;
      doc.addImage(c.data, 'JPEG', x, y, w, h);
      doc.setDrawColor(180, 180, 200);
      doc.rect(x, y, w, h);
    });

    /* ---------- Pieds de page ---------- */
    // Deux lignes au-dessus du cadre intérieur (tracé à H - 9,5) : écrites
    // plus bas, elles reposaient sur le trait.
    var pages = doc.getNumberOfPages();
    for (var p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 160);
      doc.text(nettoyer(RESSOURCE + ' — ' + TITRE_TP + ' — ' + prenom + ' ' + nom), MARGE, H - 13);
      doc.text('page ' + p + ' / ' + pages, W - MARGE, H - 13, { align: 'right' });
      doc.text('Document protégé : modification interdite', W / 2, H - 17, { align: 'center' });
    }

    doc.save('compte_rendu_TP3_' + slug(opts.nom) + '_' + slug(opts.prenom) + (complet ? '' : '_incomplet') + '.pdf');
    return { pages: pages, complet: complet };
  }

  return { generer: generer };
})();
