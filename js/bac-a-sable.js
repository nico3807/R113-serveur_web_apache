// Bac à sable « façon Killercoda » : un terminal Ubuntu (root) et le
// navigateur de l'onglet « Traffic / Ports », entièrement simulés dans la
// page. Le système de fichiers connaît les propriétaires et les droits, et
// un Apache simulé lit vraiment sa configuration au rechargement : alias,
// AllowOverride + .htaccess, ErrorDocument, journal d'accès...
//
// Rien n'est installé nulle part : c'est un entraînement. Le vrai travail
// se fait sur https://killercoda.com/playgrounds/scenario/ubuntu.

var BacASable = (function () {
  var esc = TP.echapper;
  var CLE = 'bac';
  var HOTE = '5a813048329d-10-244-4-167-80.spca.r.killercoda.com';
  var MOIS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var JOURS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // ---------- Contenus par défaut ----------

  var PAGE_APACHE =
    '<!DOCTYPE html>\n<html>\n<head><title>Apache2 Ubuntu Default Page: It works</title>\n' +
    '<style>body{font-family:Arial,sans-serif;background:#eee;margin:0}.b{max-width:640px;margin:16px auto;background:#fff;border:1px solid #ccc}' +
    '.h{background:#dd4814;color:#fff;padding:14px 18px;font-size:22px;font-weight:bold}.c{padding:8px 18px}' +
    '.s{background:#88b04b;color:#fff;font-weight:bold;padding:6px 10px;margin:10px 0}</style></head>\n<body><div class="b">' +
    '<div class="h">Apache2 Default Page</div><div class="c"><div class="s">It works!</div>' +
    '<p>This is the default welcome page used to test the correct operation of the Apache2 server after installation on Ubuntu systems.</p>' +
    '<p>You should <b>replace this file</b> (located at <tt>/var/www/html/index.html</tt>) before continuing to operate your HTTP server.</p>' +
    '</div></div></body>\n</html>\n';

  var APACHE2_CONF =
    '# This is the main Apache server configuration file.\n' +
    'DefaultRuntimeDir ${APACHE_RUN_DIR}\nPidFile ${APACHE_PID_FILE}\nTimeout 300\nKeepAlive On\n\n' +
    'User ${APACHE_RUN_USER}\nGroup ${APACHE_RUN_GROUP}\n\nErrorLog ${APACHE_LOG_DIR}/error.log\nLogLevel warn\n\n' +
    'IncludeOptional mods-enabled/*.load\nIncludeOptional mods-enabled/*.conf\nInclude ports.conf\n\n' +
    '<Directory />\n\tOptions FollowSymLinks\n\tAllowOverride None\n\tRequire all denied\n</Directory>\n\n' +
    '<Directory /usr/share>\n\tAllowOverride None\n\tRequire all granted\n</Directory>\n\n' +
    '<Directory /var/www/>\n\tOptions Indexes FollowSymLinks\n\tAllowOverride None\n\tRequire all granted\n</Directory>\n\n' +
    'AccessFileName .htaccess\n\n<FilesMatch "^\\.ht">\n\tRequire all denied\n</FilesMatch>\n\n' +
    'IncludeOptional conf-enabled/*.conf\nIncludeOptional sites-enabled/*.conf\n';

  var VHOST =
    '<VirtualHost *:80>\n\t#ServerName www.example.com\n\n\tServerAdmin webmaster@localhost\n\tDocumentRoot /var/www/html\n\n' +
    '\tErrorLog ${APACHE_LOG_DIR}/error.log\n\tCustomLog ${APACHE_LOG_DIR}/access.log combined\n</VirtualHost>\n';

  var OS_RELEASE =
    'PRETTY_NAME="Ubuntu 24.04.1 LTS"\nNAME="Ubuntu"\nVERSION_ID="24.04"\nVERSION="24.04.1 LTS (Noble Numbat)"\n' +
    'VERSION_CODENAME=noble\nID=ubuntu\nID_LIKE=debian\nHOME_URL="https://www.ubuntu.com/"\n' +
    'SUPPORT_URL="https://help.ubuntu.com/"\nBUG_REPORT_URL="https://bugs.launchpad.net/ubuntu/"\n' +
    'UBUNTU_CODENAME=noble\n';

  // ---------- Système de fichiers ----------

  function D(o, p, c) { return { t: 'd', o: o || 'root', g: o || 'root', p: p || '755', m: Date.now(), c: c || {} }; }
  function F(txt, o, p) { return { t: 'f', o: o || 'root', g: o || 'root', p: p || '644', m: Date.now(), txt: txt || '' }; }

  function etatInitial() {
    var racine = D('root', '755', {
      bin: D(), boot: D(), dev: D(), lib: D(), opt: D(), proc: D('root', '555'), srv: D(), usr: D('root', '755', { share: D(), bin: D() }),
      tmp: D('root', '777'),
      root: D('root', '700', { '.bashrc': F('# ~/.bashrc\n'), '.profile': F('# ~/.profile\n') }),
      home: D('root', '755', { ubuntu: D('ubuntu', '750', { '.bashrc': F('', 'ubuntu') }) }),
      etc: D('root', '755', {
        'os-release': F(OS_RELEASE), hostname: F('ubuntu\n'), hosts: F('127.0.0.1 localhost\n127.0.1.1 ubuntu\n'),
        passwd: F('root:x:0:0:root:/root:/bin/bash\nubuntu:x:1000:1000::/home/ubuntu:/bin/bash\n')
      }),
      var: D('root', '755', { log: D(), www: D() })
    });
    return {
      v: 1,
      fs: racine,
      users: { root: { home: '/root' }, ubuntu: { home: '/home/ubuntu' }, 'www-data': { home: '/var/www' } },
      pile: [{ u: 'root', cwd: '/root' }],
      apache: { maj: false, installe: false, actif: false, depuis: 0, confs: [], charge: null },
      mdp: {},
      log: [],
      hist: [],
      lignes: [],
      faites: {}
    };
  }

  // ---------- Fabrique ----------

  function creer(racineEl, options) {
    options = options || {};
    var etat = TP.lire(CLE, null);
    if (!etat || etat.v !== 1) etat = etatInitial();
    var mode = 'shell'; // shell | prompt | pager | tail | nano | occupe
    var prompts = [];
    var promptFin = null;
    var reponsesPrompt = [];
    var posHist = null;
    var tailFichier = null;

    racineEl.innerHTML =
      '<div class="bac-entete"><strong>ubuntu</strong><span class="bac-onglets" role="tablist">' +
      '<button type="button" role="tab" data-onglet="terminal" aria-selected="true">Tab 1 · Terminal</button>' +
      '<button type="button" role="tab" data-onglet="web" aria-selected="false">Traffic / Ports</button></span>' +
      '<button type="button" class="bac-reset" title="Repartir d\'une machine neuve">Réinitialiser</button></div>' +
      '<div class="bac-panneau" data-panneau="terminal"><div class="terminal bac-terminal">' +
      '<div class="terminal-ecran" role="log" aria-live="polite"><div class="sortie"></div>' +
      '<label class="terminal-saisie"><span class="prompt"></span><input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Commande" /></label></div>' +
      '<div class="terminal-aide"><span class="aide-texte">Tape <code>help</code> pour la liste des commandes · <kbd>↑</kbd> historique · <kbd>Tab</kbd> complète</span>' +
      ' <button type="button" class="bac-ctrlc" hidden>Ctrl + C</button></div>' +
      '<div class="nano" hidden><div class="nano-titre"></div><textarea spellcheck="false" aria-label="Contenu du fichier"></textarea>' +
      '<div class="nano-statut"></div><div class="nano-pied"><button type="button" data-nano="o"><b>^O</b> Enregistrer</button>' +
      '<button type="button" data-nano="x"><b>^X</b> Quitter</button></div></div></div></div>' +
      '<div class="bac-panneau" data-panneau="web" hidden><div class="bac-ports">' +
      '<label>Port <input type="text" value="80" inputmode="numeric" size="5" /></label> <button type="button" class="btn" data-ouvrir-port>Ouvrir le port</button>' +
      '<span class="bac-ports-aide">Comme dans Killercoda : menu en haut à droite &gt; « Traffic / Ports ».</span></div>' +
      '<div class="bac-web" hidden><div class="devsim-barre"><span aria-hidden="true">🔒</span>' +
      '<form class="bac-url"><span class="bac-hote">https://' + HOTE + '</span><input type="text" value="/" spellcheck="false" aria-label="Chemin" />' +
      '<button class="btn" type="submit">⟳</button></form><span class="bac-code"></span></div>' +
      '<div class="devsim-favoris"><span>Raccourcis :</span><button type="button" data-chemin="/">/</button><button type="button" data-chemin="/test">/test</button>' +
      '<button type="button" data-chemin="/admin/">/admin/</button><button type="button" data-chemin="/toto.html">/toto.html</button></div>' +
      '<div class="bac-vue"><iframe sandbox="" title="Page renvoyée par le serveur"></iframe>' +
      '<form class="bac-auth" hidden><p><strong>Se connecter</strong><br /><small>https://' + HOTE + '</small></p>' +
      '<label>Nom d\'utilisateur <input name="u" autocomplete="off" /></label><label>Mot de passe <input name="p" type="password" autocomplete="off" /></label>' +
      '<p class="bac-auth-btns"><button class="btn" type="submit">Se connecter</button> <button class="btn secondary" type="button" data-annuler>Annuler</button></p></form>' +
      '</div></div></div>';

    var $ = function (s) { return racineEl.querySelector(s); };
    var ecran = $('.terminal-ecran');
    var sortie = $('.sortie');
    var input = $('.terminal-saisie input');
    var promptEl = $('.prompt');
    var nanoEl = $('.nano');
    var nanoTxt = nanoEl.querySelector('textarea');
    var iframe = $('iframe');
    var auth = $('.bac-auth');

    // ---------- Utilitaires d'affichage ----------

    function sauver() {
      etat.lignes = etat.lignes.slice(-250);
      etat.log = etat.log.slice(-200);
      TP.ecrire(CLE, etat);
    }
    function ajouter(html) {
      etat.lignes.push(html);
      var d = document.createElement('div');
      d.className = 'ligne';
      d.innerHTML = html;
      sortie.appendChild(d);
      ecran.scrollTop = ecran.scrollHeight;
    }
    function out(t, c) { ajouter(c ? '<span class="' + c + '">' + esc(t) + '</span>' : esc(t)); }
    function err(t) { out(t, 't-err'); }
    function aide(t) { out('💡 ' + t, 't-aide'); }
    function lignes(txt, c) { String(txt).replace(/\n$/, '').split('\n').forEach(function (l) { out(l, c); }); }

    function moi() { return etat.pile[etat.pile.length - 1]; }
    function user() { return moi().u; }
    function home() { return etat.users[user()].home; }
    function court(ch) {
      var h = home();
      if (ch === h) return '~';
      if (ch.indexOf(h + '/') === 0) return '~' + ch.slice(h.length);
      return ch;
    }
    function promptHtml() {
      // Killercoda affiche « ubuntu:~$ » pour root ; on garde la même invite.
      var u = user();
      return (u === 'root' ? '' : '<span class="t-prompt-user">' + esc(u) + '@</span>') +
        '<span class="t-prompt-user">ubuntu</span>:<span class="t-prompt-path">' + esc(court(moi().cwd)) + '</span>$ ';
    }
    function majPrompt() {
      promptEl.innerHTML = mode === 'prompt' ? esc(prompts[0].q) : mode === 'pager' ? '<span class="t-dim">(q pour quitter)</span> ' : promptHtml();
      input.type = mode === 'prompt' && prompts[0].cache ? 'password' : 'text';
      $('.bac-ctrlc').hidden = mode !== 'tail';
    }
    function dateLs(ts) {
      var d = new Date(ts), j = String(d.getDate());
      return MOIS[d.getMonth()] + ' ' + (j.length < 2 ? ' ' + j : j) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    // ---------- Chemins et droits ----------

    function parts(p) { return p.split('/').filter(Boolean); }
    function absolu(ch) {
      if (ch === undefined || ch === '') return moi().cwd;
      if (ch === '~' || ch.indexOf('~/') === 0) ch = home() + ch.slice(1);
      var base = ch.charAt(0) === '/' ? [] : parts(moi().cwd);
      parts(ch).forEach(function (p) {
        if (p === '.') return;
        if (p === '..') base.pop(); else base.push(p);
      });
      return '/' + base.join('/');
    }
    function noeud(abs) {
      var n = etat.fs;
      var ps = parts(abs);
      for (var i = 0; i < ps.length; i++) {
        if (!n || n.t !== 'd') return null;
        n = n.c[ps[i]];
      }
      return n || null;
    }
    function parentDe(abs) {
      var ps = parts(abs), nom = ps.pop();
      return { dir: noeud('/' + ps.join('/')), chemin: '/' + ps.join('/'), nom: nom };
    }
    // Droit r, w ou x de l'utilisateur u sur le nœud n.
    function peut(u, n, droit) {
      if (u === 'root') return true;
      var bit = { r: 4, w: 2, x: 1 }[droit];
      var idx = n.o === u ? 0 : n.g === u ? 1 : 2;
      return !!(parseInt(n.p.charAt(idx), 8) & bit);
    }
    // Tous les dossiers parents doivent être traversables (x).
    function traversable(u, abs) {
      var ps = parts(abs);
      var n = etat.fs, ch = '';
      for (var i = 0; i < ps.length; i++) {
        if (!n || n.t !== 'd') return { ok: true };
        if (!peut(u, n, 'x')) return { ok: false, bloque: ch || '/' };
        ch += '/' + ps[i];
        n = n.c[ps[i]];
      }
      return { ok: true };
    }
    function rwx(n) {
      var s = n.t === 'd' ? 'd' : n.lien ? 'l' : '-';
      n.p.split('').forEach(function (c) {
        var v = parseInt(c, 8);
        s += (v & 4 ? 'r' : '-') + (v & 2 ? 'w' : '-') + (v & 1 ? 'x' : '-');
      });
      return s;
    }
    function ecrireFichier(abs, txt, ajout) {
      var u = user();
      var tr = traversable(u, abs);
      if (!tr.ok) return 'Permission denied';
      var n = noeud(abs);
      if (n) {
        if (n.t === 'd') return 'Is a directory';
        if (!peut(u, n, 'w')) return 'Permission denied';
        n.txt = ajout ? n.txt + txt : txt;
        n.m = Date.now();
        return null;
      }
      var pa = parentDe(abs);
      if (!pa.dir || pa.dir.t !== 'd') return 'No such file or directory';
      if (!peut(u, pa.dir, 'w')) return 'Permission denied';
      pa.dir.c[pa.nom] = F(txt, u);
      return null;
    }

    // ---------- Apache : configuration chargée au (re)démarrage ----------

    function lireConf() {
      var res = { allowOverride: 'None', alias: [], accordes: [], err404: null, erreur: null };
      var conf = noeud('/etc/apache2/apache2.conf');
      var txt = conf ? conf.txt : '';
      var m = txt.match(/<Directory\s+\/var\/www\/?>([\s\S]*?)<\/Directory>/i);
      if (m) {
        var ao = m[1].match(/^\s*AllowOverride\s+(\w+)/im);
        if (ao) res.allowOverride = ao[1];
      }
      var textes = [txt];
      etat.apache.confs.forEach(function (nom) {
        var f = noeud('/etc/apache2/conf-available/' + nom + '.conf');
        if (f) textes.push(f.txt);
      });
      var vh = noeud('/etc/apache2/sites-available/000-default.conf');
      if (vh) textes.push(vh.txt);
      for (var i = 0; i < textes.length; i++) {
        var t = textes[i];
        var ouv = (t.match(/<Directory\b/gi) || []).length, fer = (t.match(/<\/Directory>/gi) || []).length;
        var ouv2 = (t.match(/<VirtualHost\b/gi) || []).length, fer2 = (t.match(/<\/VirtualHost>/gi) || []).length;
        if (ouv !== fer || ouv2 !== fer2) {
          res.erreur = 'Syntax error: <Directory> ou <VirtualHost> non refermé';
          return res;
        }
        t.split('\n').forEach(function (l) {
          var a = l.match(/^\s*Alias\s+"?(\/[^\s"]*)"?\s+"?(\/[^\s"]*)"?/i);
          if (a) res.alias.push({ url: a[1].replace(/\/+$/, '') || '/', dir: a[2].replace(/\/+$/, '') });
          var e = l.match(/^\s*ErrorDocument\s+404\s+(\S+)/i);
          if (e) res.err404 = e[1];
          else if (/^\s*[A-Za-z]/.test(l) && !/^\s*(Alias|Require|Options|AllowOverride|ServerAdmin|DocumentRoot|ErrorLog|CustomLog|LogLevel|Timeout|KeepAlive|User|Group|PidFile|DefaultRuntimeDir|Include|IncludeOptional|AccessFileName|ServerName|ErrorDocument|DirectoryIndex|AuthType|AuthName|AuthUserFile|Header)\b/i.test(l)) {
            res.erreur = 'Invalid command \'' + l.trim().split(/\s+/)[0] + '\', perhaps misspelled or defined by a module not included in the server configuration';
          }
        });
        var re = /<Directory\s+"?([^>"]+?)"?\s*>([\s\S]*?)<\/Directory>/gi, d;
        while ((d = re.exec(t))) {
          if (/Require\s+all\s+granted/i.test(d[2])) res.accordes.push(d[1].replace(/\/+$/, ''));
        }
      }
      return res;
    }

    function chargerConf() {
      var c = lireConf();
      if (c.erreur) return c.erreur;
      etat.apache.charge = c;
      return null;
    }

    // ---------- Serveur web simulé ----------

    function dateLog() {
      var d = new Date();
      return String(d.getUTCDate()).padStart(2, '0') + '/' + MOIS[d.getUTCMonth()] + '/' + d.getUTCFullYear() + ':' +
        [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()].map(function (x) { return String(x).padStart(2, '0'); }).join(':') + ' +0000';
    }
    function journaliser(chemin, code, taille, qui) {
      var l = '10.244.4.1 - ' + (qui || '-') + ' [' + dateLog() + '] "GET ' + chemin + ' HTTP/1.1" ' + code + ' ' + taille +
        ' "-" "' + navigator.userAgent + '"';
      etat.log.push(l);
      var f = noeud('/var/log/apache2/access.log');
      if (f) f.txt += l + '\n';
      if (mode === 'tail' && tailFichier === '/var/log/apache2/access.log') {
        out(l);
        if (code === 404) mission('log404');
      }
    }
    function pageErreur(code, titre, msg) {
      return '<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">\n<html><head><title>' + code + ' ' + titre + '</title></head><body>' +
        '<h1>' + titre + '</h1><p>' + msg + '</p><hr><address>Apache/2.4.58 (Ubuntu) Server at ' + HOTE + ' Port 80</address></body></html>';
    }

    // Traite une requête comme le ferait Apache (utilisateur www-data).
    function servir(chemin, ident) {
      if (!etat.apache.installe || !etat.apache.actif) return { code: 0 };
      var c = etat.apache.charge || lireConf();
      chemin = chemin.split('?')[0] || '/';
      if (chemin.charAt(0) !== '/') chemin = '/' + chemin;
      var fsChemin = null, viaAlias = null;
      c.alias.forEach(function (a) {
        if (!fsChemin && (chemin === a.url || chemin.indexOf(a.url + '/') === 0)) {
          fsChemin = a.dir + chemin.slice(a.url.length);
          viaAlias = a;
        }
      });
      if (!fsChemin) fsChemin = '/var/www/html' + chemin;
      fsChemin = absoluDepuis(fsChemin);

      // Accès autorisé par la configuration (Require all granted) ?
      var accorde = fsChemin.indexOf('/var/www') === 0 || c.accordes.some(function (d) {
        return fsChemin === d || fsChemin.indexOf(d + '/') === 0;
      });
      var interdit = function (raison) {
        return { code: 403, raison: raison, html: pageErreur(403, 'Forbidden', 'You don\'t have permission to access this resource.') };
      };
      if (!accorde) return interdit('Aucune section <Directory> n\'autorise ce dossier (Require all granted).');
      var tr = traversable('www-data', fsChemin);
      if (!tr.ok) return interdit('Le serveur (utilisateur www-data) ne peut pas traverser ' + tr.bloque + ' : il lui manque le droit x.');

      var n = noeud(fsChemin);
      if (n && /\/\.ht/.test(fsChemin)) return interdit('Les fichiers .ht* ne sont jamais servis.');
      if (n && n.t === 'd') {
        if (!/\/$/.test(chemin)) return { code: 301, location: chemin + '/' };
        // Authentification Basic via .htaccess (si AllowOverride All).
        if (c.allowOverride.toLowerCase() === 'all' && fsChemin.indexOf('/var/www/') === 0) {
          var prot = protection(fsChemin);
          if (prot) {
            if (!ident) return { code: 401, realm: prot.realm };
            if (!verifierIdent(prot.fichier, ident)) return { code: 401, realm: prot.realm, refus: true };
          }
        }
        var idx = n.c['index.html'];
        if (idx) {
          if (!peut('www-data', idx, 'r')) return interdit('index.html n\'est pas lisible par www-data.');
          return { code: 200, html: idx.txt, user: ident && ident.u };
        }
        if (!viaAlias && fsChemin.indexOf('/var/www/') === 0) {
          var noms = Object.keys(n.c).filter(function (x) { return x.charAt(0) !== '.'; }).sort();
          return { code: 200, html: '<html><head><title>Index of ' + esc(chemin) + '</title></head><body><h1>Index of ' + esc(chemin) + '</h1><hr><ul>' +
            noms.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><hr><address>Apache/2.4.58 (Ubuntu) Server at ' + HOTE + ' Port 80</address></body></html>' };
        }
        return interdit('Pas de index.html et listage du dossier non autorisé.');
      }
      if (n && n.t === 'f') {
        if (!peut('www-data', n, 'r')) return interdit('Le fichier n\'est pas lisible par www-data (droit r).');
        if (c.allowOverride.toLowerCase() === 'all') {
          var prot2 = protection(parentDe(fsChemin).chemin);
          if (prot2 && (!ident || !verifierIdent(prot2.fichier, ident))) return { code: 401, realm: prot2.realm, refus: !!ident };
        }
        return { code: 200, html: n.txt, user: ident && ident.u };
      }
      // 404, éventuellement personnalisée.
      if (c.err404) {
        var e = noeud(absoluDepuis('/var/www/html' + c.err404));
        if (e && e.t === 'f' && peut('www-data', e, 'r')) return { code: 404, html: e.txt, perso: true };
      }
      return { code: 404, html: pageErreur(404, 'Not Found', 'The requested URL was not found on this server.') };
    }
    function absoluDepuis(ch) {
      var b = [];
      parts(ch).forEach(function (p) { if (p === '..') b.pop(); else if (p !== '.') b.push(p); });
      return '/' + b.join('/');
    }
    function protection(dirAbs) {
      var ps = parts(dirAbs);
      for (var i = ps.length; i >= 3; i--) {
        var f = noeud('/' + ps.slice(0, i).join('/') + '/.htaccess');
        if (f && /AuthType\s+Basic/i.test(f.txt) && /Require\s+valid-user/i.test(f.txt)) {
          var uf = f.txt.match(/AuthUserFile\s+"?([^\s"]+)/i);
          var rn = f.txt.match(/AuthName\s+"([^"]*)"/i);
          return { fichier: uf ? uf[1] : null, realm: rn ? rn[1] : 'Restricted' };
        }
      }
      return null;
    }
    function verifierIdent(fichier, ident) {
      if (!fichier) return false;
      var f = noeud(fichier);
      if (!f || !peut('www-data', f, 'r')) return false;
      var present = f.txt.split('\n').some(function (l) { return l.split(':')[0] === ident.u; });
      return present && etat.mdp[fichier + ':' + ident.u] === ident.p;
    }

    // ---------- Navigateur (port 80) ----------

    var cheminCourant = '/';
    var identCourant = null;

    function afficherPage(html) {
      iframe.srcdoc = html;
    }
    function naviguer(chemin, ident) {
      cheminCourant = chemin || '/';
      $('.bac-url input').value = cheminCourant;
      auth.hidden = true;
      var r = servir(cheminCourant, ident || identCourant);
      var code = $('.bac-code');
      if (r.code === 0) {
        code.textContent = '';
        afficherPage('<body style="font-family:sans-serif;padding:20px;color:#444"><h2>Ce site est inaccessible</h2><p>Aucun service n\'écoute sur le port 80 de la machine.</p><p><small>' +
          (etat.apache.installe ? 'Le service apache2 est arrêté.' : 'Apache n\'est pas encore installé.') + '</small></p></body>');
        return;
      }
      if (r.code === 301) {
        journaliser(cheminCourant, 301, 0);
        return naviguer(r.location, ident);
      }
      code.textContent = r.code;
      code.className = 'bac-code c' + String(r.code).charAt(0);
      if (r.code === 401) {
        journaliser(cheminCourant, 401, 381, ident ? ident.u : null);
        afficherPage(pageErreur(401, 'Unauthorized', 'This server could not verify that you are authorized to access the document requested.'));
        auth.hidden = false;
        auth.querySelector('[name="u"]').focus();
        if (r.refus) aide2('Identifiants refusés : vérifie le nom et le mot de passe créés avec htpasswd.');
        return;
      }
      if (ident && r.code === 200) identCourant = ident;
      journaliser(cheminCourant, r.code, (r.html || '').length, r.user);
      afficherPage(r.html);
      if (r.code === 403 && r.raison) aide2('403 : ' + r.raison);
      evenementWeb(cheminCourant, r);
    }
    function aide2(t) {
      var p = racineEl.querySelector('.bac-web-aide');
      if (!p) {
        p = document.createElement('p');
        p.className = 'bac-web-aide';
        racineEl.querySelector('.bac-web').appendChild(p);
      }
      p.textContent = '💡 ' + t;
      p.hidden = false;
    }
    function cacherAide2() {
      var p = racineEl.querySelector('.bac-web-aide');
      if (p) p.hidden = true;
    }

    // ---------- Missions ----------

    var MISSIONS = {
      whoami: 1, osrelease: 1, update: 1, install: 1, status: 1, pager: 1, port: 1,
      adduser: 1, su: 1, refus: 1, lsld: 1, chown: 1, index: 1, 'voir-index': 1,
      dossier: 1, conf: 1, a2enconf: 1, 'reload-alias': 1, 'alias-ok': 1,
      tail: 1, log404: 1,
      admin: 1, override: 1, htaccess: 1, htpasswd: 1, 'auth-ok': 1,
      oups: 1, errordoc: 1, '404perso': 1
    };
    function marquer(id) {
      document.querySelectorAll('[data-mission="' + id + '"]').forEach(function (li) { li.classList.add('faite'); });
    }
    function mission(id) {
      if (etat.faites[id]) return;
      etat.faites[id] = true;
      marquer(id);
      if (mode !== 'nano') out('✔ Étape validée', 't-ok');
      sauver();
      if (options.onMission) options.onMission(id);
    }
    function contient(chemin, re) {
      var n = noeud(chemin);
      return !!n && n.t === 'f' && re.test(n.txt);
    }
    function verifierEtat() {
      var a = etat.apache, c = a.charge;
      if (a.maj) mission('update');
      if (a.installe) mission('install');
      if (etat.users.etudiant) mission('adduser');
      var www = noeud('/var/www/html');
      if (www && www.o === 'etudiant') mission('chown');
      if (contient('/var/www/html/index.html', /Site TP MMI/i)) mission('index');
      if (contient('/home/etudiant/dossier_test/index.html', /alias/i)) mission('dossier');
      if (contient('/etc/apache2/conf-available/mon_alias.conf', /Alias\s+\/test\b/i)) mission('conf');
      if (a.confs.indexOf('mon_alias') !== -1) mission('a2enconf');
      if (c && c.alias.some(function (x) { return x.url === '/test'; })) mission('reload-alias');
      if (contient('/var/www/html/admin/index.html', /zone/i)) mission('admin');
      if (c && c.allowOverride.toLowerCase() === 'all') mission('override');
      if (contient('/var/www/html/admin/.htaccess', /AuthType\s+Basic/i)) mission('htaccess');
      if (contient('/etc/apache2/.htpasswd', /^\w[^:]*:\$apr1\$/m)) mission('htpasswd');
      if (noeud('/var/www/html/oups.html')) mission('oups');
      if (c && c.err404 === '/oups.html') mission('errordoc');
    }
    function evenementWeb(chemin, r) {
      if (r.code === 200 && chemin === '/') mission('port');
      if (r.code === 200 && chemin === '/' && /Site TP MMI/i.test(r.html)) mission('voir-index');
      if (r.code === 200 && /^\/test\/?$/.test(chemin)) mission('alias-ok');
      if (r.code === 200 && /^\/admin\/?$/.test(chemin) && r.user) mission('auth-ok');
      if (r.code === 404 && r.perso) mission('404perso');
      sauver();
    }

    // ---------- Commandes ----------

    function ok() { return true; }
    var C = {};

    C.help = function () {
      out('Commandes simulées dans ce bac à sable :', 't-dim');
      ['whoami · id · hostname · pwd · cd · ls [-l -a -d] · cat · mkdir [-p] · touch · rm [-r -f] · mv · cp',
        'chmod · chown [-R] · echo "texte" > fichier · nano fichier · tail [-f] fichier',
        'apt update · apt install apache2 · systemctl status|start|stop|restart|reload apache2',
        'adduser etudiant · su - etudiant · exit · a2enconf · a2disconf · htpasswd [-c] · apache2ctl configtest · clear · history'
      ].forEach(function (l) { out('  ' + l); });
      return true;
    };
    C.whoami = function () {
      out(user());
      if (user() === 'root') mission('whoami');
      return true;
    };
    C.id = function () {
      var u = user();
      out(u === 'root' ? 'uid=0(root) gid=0(root) groups=0(root)' : 'uid=1001(' + u + ') gid=1001(' + u + ') groups=1001(' + u + ')');
      return true;
    };
    C.hostname = function () { out('ubuntu'); return true; };
    C.pwd = function () { out(moi().cwd); return true; };
    C.clear = function () { etat.lignes = []; sortie.innerHTML = ''; return true; };
    C.history = function () { etat.hist.forEach(function (h, i) { out(String(i + 1).padStart(4) + '  ' + h); }); return true; };
    C.sudo = function (args, o, brut) {
      if (user() !== 'root') {
        err('[sudo] password for ' + user() + ': ');
        err(user() + ' is not in the sudoers file.');
        aide('L\'utilisateur ' + user() + ' n\'est pas administrateur : tape exit pour redevenir root.');
        return false;
      }
      var reste = brut.replace(/^\s*sudo\s+/, '');
      return executerMots(decouper(reste), reste);
    };
    C.cd = function (args) {
      var cible = args.length ? absolu(args[0]) : home();
      var n = noeud(cible);
      if (!n) { err('-bash: cd: ' + args[0] + ': No such file or directory'); return false; }
      if (n.t !== 'd') { err('-bash: cd: ' + args[0] + ': Not a directory'); return false; }
      var tr = traversable(user(), cible);
      if (!tr.ok || !peut(user(), n, 'x')) { err('-bash: cd: ' + args[0] + ': Permission denied'); return false; }
      moi().cwd = cible;
      return true;
    };
    C.ls = function (args, o) {
      var cibles = args.length ? args : ['.'];
      var res = true;
      cibles.forEach(function (a) {
        var abs = absolu(a), n = noeud(abs);
        if (!n) { err("ls: cannot access '" + a + "': No such file or directory"); res = false; return; }
        var ligne = function (nom, x) {
          var t = x.t === 'd' ? 4096 : (x.txt || '').length;
          return esc(rwx(x) + ' ' + (x.t === 'd' ? 2 : 1) + ' ' + x.o + ' ' + x.g + ' ' + String(t).padStart(5) + ' ' + dateLs(x.m) + ' ') +
            (x.t === 'd' ? '<span class="t-dir">' + esc(nom) + '</span>' : esc(nom)) + (x.lien ? ' -&gt; ' + esc(x.lien) : '');
        };
        if (n.t === 'f' || o.d) {
          if (o.d && abs === '/var/www/html' && o.l) mission('lsld');
          ajouter(o.l ? ligne(a, n) : esc(a));
          return;
        }
        if (!peut(user(), n, 'r') || !traversable(user(), abs).ok) { err("ls: cannot open directory '" + a + "': Permission denied"); res = false; return; }
        var noms = Object.keys(n.c).sort(function (x, y) { return x.replace(/^\./, '').localeCompare(y.replace(/^\./, '')); });
        if (!o.a) noms = noms.filter(function (x) { return x.charAt(0) !== '.'; });
        if (o.l) {
          out('total ' + noms.length * 4);
          noms.forEach(function (x) { ajouter(ligne(x, n.c[x])); });
        } else if (noms.length) {
          ajouter(noms.map(function (x) { return n.c[x].t === 'd' ? '<span class="t-dir">' + esc(x) + '</span>' : esc(x); }).join('  '));
        }
      });
      return res;
    };
    C.cat = function (args) {
      var res = true;
      args.forEach(function (a) {
        var abs = absolu(a), n = noeud(abs);
        if (!n) { err('cat: ' + a + ': No such file or directory'); res = false; return; }
        if (n.t === 'd') { err('cat: ' + a + ': Is a directory'); res = false; return; }
        if (!traversable(user(), abs).ok || !peut(user(), n, 'r')) { err('cat: ' + a + ': Permission denied'); res = false; return; }
        if (n.txt) lignes(n.txt);
        if (abs === '/etc/os-release') mission('osrelease');
      });
      return res;
    };
    C.mkdir = function (args, o) {
      if (!args.length) { err('mkdir: missing operand'); return false; }
      var res = true;
      args.forEach(function (a) {
        var abs = absolu(a);
        if (o.p) {
          var cur = '/';
          parts(abs).forEach(function (p) {
            var suiv = absoluDepuis(cur + '/' + p);
            if (!noeud(suiv)) {
              var pd = noeud(cur);
              if (pd && peut(user(), pd, 'w')) pd.c[p] = D(user(), user() === 'root' ? '755' : '775');
              else if (res) { err("mkdir: cannot create directory '" + a + "': Permission denied"); res = false; }
            }
            cur = suiv;
          });
          return;
        }
        var pa = parentDe(abs);
        if (!pa.dir) { err("mkdir: cannot create directory '" + a + "': No such file or directory"); res = false; return; }
        if (pa.dir.c[pa.nom]) { err("mkdir: cannot create directory '" + a + "': File exists"); res = false; return; }
        if (!traversable(user(), abs).ok || !peut(user(), pa.dir, 'w')) { err("mkdir: cannot create directory '" + a + "': Permission denied"); res = false; return; }
        pa.dir.c[pa.nom] = D(user(), user() === 'root' ? '755' : '775');
      });
      return res;
    };
    C.touch = function (args) {
      if (!args.length) { err('touch: missing file operand'); return false; }
      var res = true;
      args.forEach(function (a) {
        var abs = absolu(a), n = noeud(abs);
        if (n) { n.m = Date.now(); return; }
        var e = ecrireFichier(abs, '');
        if (e) {
          err("touch: cannot touch '" + a + "': " + e);
          if (e === 'Permission denied' && /^\/var\/www\/html/.test(abs) && user() !== 'root') {
            mission('refus');
            aide('Analyse les droits du dossier avec : ls -ld /var/www/html');
          }
          res = false;
        }
      });
      return res;
    };
    C.rm = function (args, o) {
      if (!args.length) { err('rm: missing operand'); return false; }
      var res = true;
      var suite = [];
      args.forEach(function (a) {
        var abs = absolu(a), n = noeud(abs), pa = parentDe(abs);
        if (!n) { if (!o.f) { err("rm: cannot remove '" + a + "': No such file or directory"); res = false; } return; }
        if (abs === '/' || /^\/(etc|var|usr|home|root|bin)$/.test(abs)) { err("rm: refusing to remove '" + a + "'"); res = false; return; }
        if (n.t === 'd' && !o.r) { err("rm: cannot remove '" + a + "': Is a directory"); res = false; return; }
        if (!peut(user(), pa.dir, 'w') || !traversable(user(), abs).ok) { err("rm: cannot remove '" + a + "': Permission denied"); res = false; return; }
        if (n.t === 'f' && !o.f && !peut(user(), n, 'w')) {
          suite.push({ a: a, pa: pa });
          return;
        }
        delete pa.dir.c[pa.nom];
      });
      // Fichier protégé en écriture : rm demande confirmation.
      if (suite.length) {
        var demande = function (i) {
          if (i >= suite.length) return;
          demander([{ q: "rm: remove write-protected regular file '" + suite[i].a + "'? " }], function (r) {
            if (/^[yo]/i.test(r[0] || '')) delete suite[i].pa.dir.c[suite[i].pa.nom];
            demande(i + 1);
          });
        };
        demande(0);
      }
      return res;
    };
    C.mv = function (args) {
      if (args.length !== 2) { err('mv: missing destination file operand'); return false; }
      var s = absolu(args[0]), d = absolu(args[1]), n = noeud(s);
      if (!n) { err("mv: cannot stat '" + args[0] + "': No such file or directory"); return false; }
      var dn = noeud(d);
      if (dn && dn.t === 'd') d = d + '/' + parts(s).pop();
      var ps = parentDe(s), pd = parentDe(d);
      if (!pd.dir) { err("mv: cannot move '" + args[0] + "': No such file or directory"); return false; }
      if (!peut(user(), ps.dir, 'w') || !peut(user(), pd.dir, 'w')) { err("mv: cannot move '" + args[0] + "': Permission denied"); return false; }
      delete ps.dir.c[ps.nom];
      pd.dir.c[pd.nom] = n;
      return true;
    };
    C.cp = function (args) {
      if (args.length !== 2) { err('cp: missing destination file operand'); return false; }
      var n = noeud(absolu(args[0]));
      if (!n || n.t !== 'f') { err("cp: cannot stat '" + args[0] + "': No such file or directory"); return false; }
      var d = absolu(args[1]), dn = noeud(d);
      if (dn && dn.t === 'd') d = d + '/' + parts(absolu(args[0])).pop();
      var e = ecrireFichier(d, n.txt);
      if (e) { err("cp: cannot create regular file '" + args[1] + "': " + e); return false; }
      return true;
    };
    C.chmod = function (args, o) {
      if (args.length < 2) { err('chmod: missing operand'); return false; }
      var mode = args[0];
      if (!/^[0-7]{3}$/.test(mode) && !/^([ugoa]*[+\-=][rwx]*)(,[ugoa]*[+\-=][rwx]*)*$/.test(mode)) { err("chmod: invalid mode: '" + mode + "'"); return false; }
      var res = true;
      var appliquer = function (n) {
        if (/^[0-7]{3}$/.test(mode)) { n.p = mode; return; }
        var v = n.p.split('').map(function (c) { return parseInt(c, 8); });
        mode.split(',').forEach(function (cl) {
          var m = cl.match(/^([ugoa]*)([+\-=])([rwx]*)$/), qui = m[1] || 'a';
          var b = (m[3].indexOf('r') > -1 ? 4 : 0) + (m[3].indexOf('w') > -1 ? 2 : 0) + (m[3].indexOf('x') > -1 ? 1 : 0);
          ['u', 'g', 'o'].forEach(function (q, i) {
            if (qui.indexOf(q) === -1 && qui.indexOf('a') === -1) return;
            if (m[2] === '+') v[i] |= b; else if (m[2] === '-') v[i] &= ~b; else v[i] = b;
          });
        });
        n.p = v.join('');
      };
      var rec = function (n) { appliquer(n); if (o.r && n.t === 'd') Object.keys(n.c).forEach(function (k) { rec(n.c[k]); }); };
      args.slice(1).forEach(function (a) {
        var n = noeud(absolu(a));
        if (!n) { err("chmod: cannot access '" + a + "': No such file or directory"); res = false; return; }
        if (user() !== 'root' && n.o !== user()) { err("chmod: changing permissions of '" + a + "': Operation not permitted"); res = false; return; }
        rec(n);
      });
      return res;
    };
    C.chown = function (args, o) {
      if (args.length < 2) { err('chown: missing operand'); return false; }
      var m = args[0].split(':'), u = m[0], g = m[1] || null;
      if (u && !etat.users[u]) { err("chown: invalid user: '" + args[0] + "'"); aide('Cet utilisateur n\'existe pas (adduser ?).'); return false; }
      var res = true;
      args.slice(1).forEach(function (a) {
        var n = noeud(absolu(a));
        if (!n) { err("chown: cannot access '" + a + "': No such file or directory"); res = false; return; }
        if (user() !== 'root') { err("chown: changing ownership of '" + a + "': Operation not permitted"); res = false; return; }
        var rec = function (x) {
          if (u) x.o = u;
          if (g) x.g = g;
          if (o.r && x.t === 'd') Object.keys(x.c).forEach(function (k) { rec(x.c[k]); });
        };
        rec(n);
      });
      return res;
    };
    C.echo = function (args, o, brut) {
      // Redirections « > » et « >> » vers un fichier.
      var m = brut.match(/^echo\s+(-e\s+)?([\s\S]*?)\s*(>>|>)\s*(\S+)\s*$/);
      var texte = function (s) { return s.replace(/^(["'])([\s\S]*)\1$/, '$2'); };
      if (m) {
        var abs = absolu(m[4]);
        var e = ecrireFichier(abs, texte(m[2]) + '\n', m[3] === '>>');
        if (e) { err('-bash: ' + m[4] + ': ' + e); return false; }
        return true;
      }
      out(texte(brut.replace(/^echo\s*/, '')));
      return true;
    };
    C.tail = function (args, o) {
      var f = args.filter(function (a) { return !/^\d+$/.test(a); })[0];
      if (!f) { err('tail: missing file operand'); return false; }
      var abs = absolu(f), n = noeud(abs);
      if (!n) { err("tail: cannot open '" + f + "' for reading: No such file or directory"); return false; }
      if (user() !== 'root' && !peut(user(), n, 'r')) { err("tail: cannot open '" + f + "' for reading: Permission denied"); return false; }
      lignes(n.txt.split('\n').filter(Boolean).slice(-10).join('\n') || '');
      if (o.f) {
        mode = 'tail';
        tailFichier = abs;
        if (abs === '/var/log/apache2/access.log') mission('tail');
        out('(surveillance en cours : actualise des pages dans l\'onglet Traffic / Ports, puis Ctrl + C pour arrêter)', 't-dim');
      }
      return true;
    };
    C.nano = function (args) {
      if (!args.length) { err('Usage : nano fichier'); return false; }
      ouvrirNano(absolu(args[0]), args[0]);
      return true;
    };
    C.exit = function () {
      if (etat.pile.length > 1) {
        etat.pile.pop();
        out('logout');
        return true;
      }
      aide('Dans Killercoda, exit fermerait la session root. Ici, le terminal reste ouvert.');
      return true;
    };
    C.logout = C.exit;
    C.su = function (args) {
      var cible = args.filter(function (a) { return a !== '-'; })[0] || 'root';
      if (!etat.users[cible]) { err('su: user ' + cible + ' does not exist or the user entry does not contain all the required fields'); return false; }
      var faire = function () {
        etat.pile.push({ u: cible, cwd: args.indexOf('-') !== -1 || cible === 'root' ? etat.users[cible].home : moi().cwd });
        if (cible === 'etudiant') mission('su');
        majPrompt();
      };
      if (user() === 'root') { faire(); return true; }
      demander([{ q: 'Password: ', cache: true }], function () { err('su: Authentication failure'); aide('Pour redevenir root, tape plutôt exit.'); });
      return true;
    };
    C.adduser = function (args) {
      var nom = args[args.length - 1];
      if (!nom) { err('fatal: Only one or two names allowed.'); return false; }
      if (user() !== 'root') { err('fatal: Only root may add a user or group to the system.'); return false; }
      if (etat.users[nom]) { err("fatal: The user `" + nom + "' already exists."); return false; }
      ['info: Adding user `' + nom + "' ...", 'info: Selecting UID/GID from range 1000 to 59999 ...',
        "info: Adding new group `" + nom + "' (1001) ...", "info: Adding new user `" + nom + "' (1001) with group `" + nom + " (1001)' ...",
        "info: Creating home directory `/home/" + nom + "' ...", "info: Copying files from `/etc/skel' ..."].forEach(function (l) { out(l); });
      demander([
        { q: 'New password: ', cache: true }, { q: 'Retype new password: ', cache: true },
        { q: 'Full Name []: ' }, { q: 'Room Number []: ' }, { q: 'Work Phone []: ' }, { q: 'Home Phone []: ' }, { q: 'Other []: ' },
        { q: 'Is the information correct? [Y/n] ' }
      ], function () {
        out('passwd: password updated successfully');
        etat.users[nom] = { home: '/home/' + nom };
        // Ubuntu 24.04 crée les dossiers personnels en 750 (non traversables par les autres).
        noeud('/home').c[nom] = D(nom, '750', { '.bashrc': F('# ~/.bashrc\n', nom), '.profile': F('# ~/.profile\n', nom) });
        var pw = noeud('/etc/passwd');
        pw.txt += nom + ':x:1001:1001:,,,:/home/' + nom + ':/bin/bash\n';
        out("info: Adding new user `" + nom + "' to supplemental / extra groups `users' ...");
        verifierEtat();
      });
      return true;
    };
    C.useradd = function (args) { return C.adduser(args); };
    C.apt = function (args, o) {
      var sous = args[0];
      if (user() !== 'root') { err('E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)'); aide('Seul root peut installer des paquets : tape exit.'); return false; }
      if (sous === 'update') {
        occuper([
          'Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease',
          'Get:2 http://security.ubuntu.com/ubuntu noble-security InRelease [126 kB]',
          'Get:3 http://archive.ubuntu.com/ubuntu noble-updates InRelease [126 kB]',
          'Get:4 http://archive.ubuntu.com/ubuntu noble-backports InRelease [126 kB]',
          'Fetched 2 850 kB in 2s (1 425 kB/s)', 'Reading package lists... Done', 'Building dependency tree... Done',
          'Reading state information... Done', '42 packages can be upgraded. Run \'apt list --upgradable\' to see them.'
        ], function () { etat.apache.maj = true; verifierEtat(); });
        return true;
      }
      if (sous === 'install') {
        if (args[1] !== 'apache2') { err('E: Unable to locate package ' + (args[1] || '')); return false; }
        if (!etat.apache.maj) {
          out('Reading package lists... Done');
          err('E: Unable to locate package apache2');
          aide('L\'index des paquets n\'est pas à jour : lance d\'abord apt update.');
          return false;
        }
        if (etat.apache.installe) { out('apache2 is already the newest version (2.4.58-1ubuntu8.4).'); return true; }
        var installer = function () {
          occuper([
            'Get:1 http://archive.ubuntu.com/ubuntu noble/main amd64 libapr1t64 amd64 1.7.2-3.1build2 [107 kB]',
            'Get:2 http://archive.ubuntu.com/ubuntu noble-updates/main amd64 apache2-bin amd64 2.4.58-1ubuntu8.4 [1 329 kB]',
            'Get:3 http://archive.ubuntu.com/ubuntu noble-updates/main amd64 apache2 amd64 2.4.58-1ubuntu8.4 [90,2 kB]',
            'Setting up apache2-utils (2.4.58-1ubuntu8.4) ...', 'Setting up apache2 (2.4.58-1ubuntu8.4) ...',
            'Enabling site 000-default.', 'Enabling conf security.', 'Enabling conf charset.',
            'Created symlink /etc/systemd/system/multi-user.target.wants/apache2.service → /usr/lib/systemd/system/apache2.service.',
            'Processing triggers for man-db (2.12.0-4build2) ...'
          ], function () { installerApache(); verifierEtat(); });
        };
        out('Reading package lists... Done');
        out('Building dependency tree... Done');
        out('The following NEW packages will be installed:');
        out('  apache2 apache2-bin apache2-data apache2-utils libapr1t64 libaprutil1t64 ssl-cert');
        out('0 upgraded, 7 newly installed, 0 to remove and 42 not upgraded.');
        if (o.y) installer();
        else demander([{ q: 'Do you want to continue? [Y/n] ' }], function (r) {
          if (/^n/i.test(r[0] || '')) { out('Abort.'); return; }
          installer();
        });
        return true;
      }
      err('E: Invalid operation ' + (sous || ''));
      return false;
    };
    C['apt-get'] = C.apt;
    function installerApache() {
      var a = etat.apache;
      a.installe = true;
      a.actif = true;
      a.depuis = Date.now();
      var etc = noeud('/etc');
      etc.c.apache2 = D('root', '755', {
        'apache2.conf': F(APACHE2_CONF), 'ports.conf': F('Listen 80\n'),
        'conf-available': D('root', '755', { 'charset.conf': F('#AddDefaultCharset UTF-8\n'), 'security.conf': F('ServerTokens OS\nServerSignature On\n') }),
        'conf-enabled': D('root', '755', {}),
        'sites-available': D('root', '755', { '000-default.conf': F(VHOST) }),
        'sites-enabled': D('root', '755', {})
      });
      etc.c.apache2.c['conf-enabled'].c['charset.conf'] = F('', 'root', '777');
      etc.c.apache2.c['conf-enabled'].c['charset.conf'].lien = '../conf-available/charset.conf';
      etc.c.apache2.c['conf-enabled'].c['security.conf'] = F('', 'root', '777');
      etc.c.apache2.c['conf-enabled'].c['security.conf'].lien = '../conf-available/security.conf';
      etc.c.apache2.c['sites-enabled'].c['000-default.conf'] = F('', 'root', '777');
      etc.c.apache2.c['sites-enabled'].c['000-default.conf'].lien = '../sites-available/000-default.conf';
      var v = noeud('/var');
      v.c.www.c.html = D('root', '755', { 'index.html': F(PAGE_APACHE) });
      v.c.log.c.apache2 = D('root', '750', { 'access.log': F('', 'root', '640'), 'error.log': F('', 'root', '640') });
      v.c.log.c.apache2.g = 'adm';
      chargerConf();
    }
    C.systemctl = function (args) {
      var action = args[0], svc = (args[1] || '').replace(/\.service$/, '');
      if (svc !== 'apache2') { err('Failed to ' + (action || 'run') + ' ' + (svc || '') + '.service: Unit ' + (svc || '?') + '.service not found.'); return false; }
      if (!etat.apache.installe) { err('Unit apache2.service could not be found.'); aide('Apache n\'est pas encore installé.'); return false; }
      var a = etat.apache;
      if (action === 'status') {
        var depuis = new Date(a.depuis);
        var dt = JOURS[depuis.getUTCDay()] + ' ' + depuis.toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
        var min = Math.max(0, Math.round((Date.now() - a.depuis) / 60000));
        ajouter((a.actif ? '<span class="t-ok">●</span>' : '○') + ' apache2.service - The Apache HTTP Server');
        out('     Loaded: loaded (/usr/lib/systemd/system/apache2.service; enabled; preset: enabled)');
        ajouter('     Active: ' + (a.actif ? '<span class="t-ok">active (running)</span> since ' + esc(dt) + '; ' + min + 'min ago'
          : 'inactive (dead)'));
        out('       Docs: https://httpd.apache.org/docs/2.4/');
        if (a.actif) {
          out('   Main PID: 3071 (apache2)');
          out('      Tasks: 55 (limit: 2240)');
          out('     Memory: 5.3M (peak: 5.4M)');
          out('     CGroup: /system.slice/apache2.service');
          out('             ├─3071 /usr/sbin/apache2 -k start');
          out('             ├─3073 /usr/sbin/apache2 -k start');
          out('             └─3074 /usr/sbin/apache2 -k start');
          mission('status');
        }
        out('lines 1-12/12 (END)', 't-inverse');
        mode = 'pager';
        return true;
      }
      if (user() !== 'root') { err('Failed to ' + action + ' apache2.service: Access denied'); aide('Seul root pilote les services : tape exit.'); return false; }
      if (action === 'stop') { a.actif = false; return true; }
      if (action === 'start' || action === 'restart' || action === 'reload') {
        if (action === 'reload' && !a.actif) { err('apache2.service is not active, cannot reload.'); return false; }
        var e = chargerConf();
        if (e) {
          err('Job for apache2.service failed.');
          err('See "systemctl status apache2.service" and "journalctl -xeu apache2.service" for details.');
          aide('Erreur de configuration : ' + e + '. Corrige le fichier puis recommence (apache2ctl configtest aide à trouver l\'erreur).');
          return false;
        }
        if (!a.actif || action === 'restart') a.depuis = Date.now();
        a.actif = true;
        return true;
      }
      if (action === 'enable') { out('Synchronizing state of apache2.service with SysV service script.'); return true; }
      err('Unknown command verb ' + action + '.');
      return false;
    };
    C.service = function (args) { return C.systemctl([args[1], args[0]]); };
    C.apache2ctl = function (args) {
      if (!etat.apache.installe) { err('-bash: apache2ctl: command not found'); return false; }
      if (args[0] === 'configtest' || args[0] === '-t') {
        var c = lireConf();
        if (c.erreur) { err('AH00526: ' + c.erreur); return false; }
        out('Syntax OK');
        return true;
      }
      err('Usage: apache2ctl configtest');
      return false;
    };
    function a2conf(activer) {
      return function (args) {
        if (!etat.apache.installe) { err('-bash: a2' + (activer ? 'en' : 'dis') + 'conf: command not found'); return false; }
        if (user() !== 'root') { err('ERROR: You must be root to run this command'); return false; }
        var nom = (args[0] || '').replace(/\.conf$/, '');
        if (!noeud('/etc/apache2/conf-available/' + nom + '.conf')) { err('ERROR: Conf ' + nom + ' does not exist!'); aide('Le fichier doit s\'appeler /etc/apache2/conf-available/' + nom + '.conf'); return false; }
        var ce = noeud('/etc/apache2/conf-enabled');
        var i = etat.apache.confs.indexOf(nom);
        if (activer) {
          if (i !== -1) { out('Conf ' + nom + ' already enabled'); return true; }
          etat.apache.confs.push(nom);
          ce.c[nom + '.conf'] = F('', 'root', '777');
          ce.c[nom + '.conf'].lien = '../conf-available/' + nom + '.conf';
          out('Enabling conf ' + nom + '.');
        } else {
          if (i === -1) { out('Conf ' + nom + ' already disabled'); return true; }
          etat.apache.confs.splice(i, 1);
          delete ce.c[nom + '.conf'];
          out('Conf ' + nom + ' disabled.');
        }
        out('To activate the new configuration, you need to run:');
        out('  systemctl reload apache2');
        return true;
      };
    }
    C.a2enconf = a2conf(true);
    C.a2disconf = a2conf(false);
    C.htpasswd = function (args, o) {
      if (!etat.apache.installe) { err('-bash: htpasswd: command not found'); aide('htpasswd est fourni avec Apache (paquet apache2-utils).'); return false; }
      var f = args[0], login = args[1];
      if (!f || !login) { err('Usage: htpasswd [-c] passwordfile username'); return false; }
      var abs = absolu(f);
      if (!o.c && !noeud(abs)) { err('htpasswd: cannot modify file ' + abs + '; use \'-c\' to create it.'); return false; }
      demander([{ q: 'New password: ', cache: true }, { q: 'Re-type new password: ', cache: true }], function (r) {
        if (r[0] !== r[1]) { err('htpasswd: password verification error'); return; }
        var sel = Math.random().toString(36).slice(2, 10);
        var hash = '$apr1$' + sel + '$' + btoa(login + sel + r[0]).replace(/[^A-Za-z0-9]/g, '').slice(0, 22);
        var n = noeud(abs);
        var lignesF = o.c || !n ? [] : n.txt.split('\n').filter(function (l) { return l && l.split(':')[0] !== login; });
        lignesF.push(login + ':' + hash);
        var e = ecrireFichier(abs, lignesF.join('\n') + '\n');
        if (e) { err('htpasswd: cannot create file ' + abs); return; }
        etat.mdp[abs + ':' + login] = r[0];
        out((o.c || !n ? 'Adding' : 'Updating') + ' password for user ' + login);
        verifierEtat();
        sauver();
      });
      return true;
    };

    // ---------- nano ----------

    var nanoFichier = null, nanoNom = '', nanoModifie = false, nanoQuitter = false;
    function ouvrirNano(abs, nom) {
      var n = noeud(abs);
      if (n && n.t === 'd') { err('"' + nom + '" is a directory'); return; }
      if (n && (!traversable(user(), abs).ok || !peut(user(), n, 'r'))) { err('[ Error reading ' + nom + ': Permission denied ]'); return; }
      nanoFichier = abs;
      nanoNom = nom;
      nanoModifie = false;
      nanoQuitter = false;
      nanoTxt.value = n ? n.txt : '';
      nanoEl.querySelector('.nano-titre').textContent = 'GNU nano 7.2' + ' ' + abs + (n ? '' : ' (nouveau fichier)');
      statutNano(n ? '[ Read ' + n.txt.split('\n').filter(function (x, i, t) { return i < t.length - 1 || x; }).length + ' lines ]' : '[ New File ]');
      nanoEl.hidden = false;
      mode = 'nano';
      setTimeout(function () { nanoTxt.focus(); }, 0);
    }
    function statutNano(t) { nanoEl.querySelector('.nano-statut').textContent = t; }
    function enregistrerNano() {
      var txt = nanoTxt.value;
      if (txt && !/\n$/.test(txt)) txt += '\n';
      var e = ecrireFichier(nanoFichier, txt);
      if (e) {
        statutNano('[ Error writing ' + nanoFichier + ': ' + e + ' ]');
        return false;
      }
      nanoModifie = false;
      statutNano('[ Wrote ' + (txt.split('\n').length - 1) + ' lines ]');
      verifierEtat();
      sauver();
      return true;
    }
    function fermerNano() {
      nanoEl.hidden = true;
      mode = 'shell';
      majPrompt();
      input.focus();
    }
    nanoTxt.addEventListener('input', function () { nanoModifie = true; nanoQuitter = false; });
    nanoTxt.addEventListener('keydown', function (evt) {
      var k = evt.key.toLowerCase();
      if (nanoQuitter) {
        evt.preventDefault();
        if (k === 'y' || k === 'o') { if (enregistrerNano()) fermerNano(); else nanoQuitter = false; }
        else if (k === 'n') fermerNano();
        else if (k === 'escape' || (evt.ctrlKey && k === 'c')) { nanoQuitter = false; statutNano('[ Cancelled ]'); }
        return;
      }
      if (evt.ctrlKey && k === 'o') { evt.preventDefault(); enregistrerNano(); }
      else if (evt.ctrlKey && k === 'x') {
        evt.preventDefault();
        if (nanoModifie) { nanoQuitter = true; statutNano('Save modified buffer?  Y Yes   N No   ^C Cancel'); }
        else fermerNano();
      }
    });
    nanoEl.querySelector('[data-nano="o"]').addEventListener('click', function () { enregistrerNano(); nanoTxt.focus(); });
    nanoEl.querySelector('[data-nano="x"]').addEventListener('click', function () {
      if (nanoModifie) { nanoQuitter = true; statutNano('Save modified buffer?  Y Yes   N No   ^C Cancel'); nanoTxt.focus(); }
      else fermerNano();
    });

    // ---------- Saisie interactive (mots de passe, confirmations) ----------

    function demander(liste, fin) {
      prompts = liste.slice();
      reponsesPrompt = [];
      promptFin = fin;
      mode = 'prompt';
      majPrompt();
    }
    function occuper(sorties, fin) {
      mode = 'occupe';
      input.disabled = true;
      var i = 0;
      var t = setInterval(function () {
        if (i < sorties.length) { out(sorties[i++]); return; }
        clearInterval(t);
        input.disabled = false;
        mode = 'shell';
        fin();
        majPrompt();
        sauver();
        input.focus();
      }, 180);
    }

    // ---------- Exécution ----------

    function decouper(ligne) {
      var res = [], re = /"([^"]*)"|'([^']*)'|(\S+)/g, m;
      while ((m = re.exec(ligne))) res.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
      return res;
    }
    function executerMots(mots, brut) {
      var cmd = mots[0];
      var o = {}, args = [];
      mots.slice(1).forEach(function (m) {
        if (/^--?[a-zA-Z]+$/.test(m) && cmd !== 'echo' && !(cmd === 'chmod' && !args.length && /^-[rwx]+$/.test(m))) {
          if (m === '--yes') o.y = true;
          m.replace(/^-+/, '').split('').forEach(function (l) { o[l.toLowerCase()] = true; });
          if (cmd === 'su' && m === '-') args.push('-');
        } else args.push(m);
      });
      if (cmd === 'su' && mots.indexOf('-') !== -1 && args.indexOf('-') === -1) args.unshift('-');
      var f = C[cmd];
      if (!f) {
        err(cmd + ': command not found');
        if (/^(vim?|vi|gedit|code|notepad)$/.test(cmd)) aide('Utilise l\'éditeur nano : nano fichier');
        else if (C[cmd.toLowerCase()]) aide('Les commandes s\'écrivent en minuscules.');
        else aide('Commande inconnue (ou non simulée ici). Tape help.');
        return false;
      }
      var r = f(args, o, brut || mots.join(' '));
      if (mode === 'shell' || mode === 'pager' || mode === 'tail') verifierEtat();
      return r;
    }
    function executer(ligne) {
      ajouter(promptHtml() + esc(ligne));
      if (ligne.trim()) { etat.hist.push(ligne); etat.hist = etat.hist.slice(-100); }
      var mots = decouper(ligne.trim());
      if (mots.length) executerMots(mots, ligne.trim());
      majPrompt();
      sauver();
      ecran.scrollTop = ecran.scrollHeight;
    }

    // ---------- Clavier ----------

    function completer() {
      var v = input.value, mots = v.split(/\s+/), dernier = mots[mots.length - 1];
      var coupe = dernier.lastIndexOf('/'), dirPart = coupe >= 0 ? dernier.slice(0, coupe + 1) : '', debut = dernier.slice(coupe + 1);
      var d = noeud(absolu(dirPart || '.'));
      if (!d || d.t !== 'd') return;
      var c = Object.keys(d.c).filter(function (x) { return x.indexOf(debut) === 0 && (debut.charAt(0) === '.' || x.charAt(0) !== '.'); });
      if (c.length === 1) {
        mots[mots.length - 1] = dirPart + c[0] + (d.c[c[0]].t === 'd' ? '/' : ' ');
        input.value = mots.join(' ');
      } else if (c.length > 1) {
        ajouter(promptHtml() + esc(v));
        out(c.join('  '));
      }
    }
    function arreterTail() {
      out('^C');
      mode = 'shell';
      tailFichier = null;
      majPrompt();
      sauver();
      input.focus();
    }
    input.addEventListener('keydown', function (evt) {
      if (mode === 'pager') {
        evt.preventDefault();
        if (evt.key.toLowerCase() === 'q') {
          mode = 'shell';
          mission('pager');
          majPrompt();
        }
        return;
      }
      if (mode === 'tail') {
        evt.preventDefault();
        if (evt.ctrlKey && evt.key.toLowerCase() === 'c') arreterTail();
        return;
      }
      if (mode === 'prompt') {
        if (evt.key === 'Enter') {
          var p = prompts.shift();
          ajouter(esc(p.q) + (p.cache ? '' : esc(input.value)));
          reponsesPrompt.push(input.value);
          input.value = '';
          if (!prompts.length) {
            mode = 'shell';
            var fin = promptFin;
            promptFin = null;
            fin(reponsesPrompt);
            verifierEtat();
            sauver();
          }
          majPrompt();
        } else if (evt.ctrlKey && evt.key.toLowerCase() === 'c') {
          evt.preventDefault();
          out('^C');
          mode = 'shell';
          prompts = [];
          majPrompt();
        }
        return;
      }
      if (evt.key === 'Enter') {
        var v = input.value;
        input.value = '';
        posHist = null;
        executer(v);
      } else if (evt.key === 'ArrowUp' || evt.key === 'ArrowDown') {
        if (!etat.hist.length) return;
        evt.preventDefault();
        if (posHist === null) posHist = etat.hist.length;
        posHist = Math.max(0, Math.min(etat.hist.length, posHist + (evt.key === 'ArrowUp' ? -1 : 1)));
        input.value = etat.hist[posHist] || '';
      } else if (evt.key === 'Tab') {
        evt.preventDefault();
        completer();
      } else if (evt.ctrlKey && evt.key.toLowerCase() === 'l') {
        evt.preventDefault();
        C.clear();
      } else if (evt.ctrlKey && evt.key.toLowerCase() === 'c' && !window.getSelection().toString()) {
        ajouter(promptHtml() + esc(input.value) + '^C');
        input.value = '';
      }
    });
    $('.bac-ctrlc').addEventListener('click', arreterTail);
    ecran.addEventListener('click', function () { if (!window.getSelection().toString()) input.focus(); });

    // ---------- Onglets, ports, navigateur ----------

    function onglet(nom) {
      racineEl.querySelectorAll('[data-onglet]').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-onglet') === nom); });
      racineEl.querySelectorAll('[data-panneau]').forEach(function (p) { p.hidden = p.getAttribute('data-panneau') !== nom; });
      if (nom === 'terminal' && mode !== 'nano') input.focus();
    }
    racineEl.querySelectorAll('[data-onglet]').forEach(function (b) {
      b.addEventListener('click', function () { onglet(b.getAttribute('data-onglet')); });
    });
    $('[data-ouvrir-port]').addEventListener('click', function () {
      var port = $('.bac-ports input').value.trim();
      if (port !== '80') {
        $('.bac-web').hidden = false;
        afficherPage('<body style="font-family:sans-serif;padding:20px;color:#444"><h2>Rien sur le port ' + esc(port) + '</h2><p>Aucun service n\'écoute sur ce port. Le web (HTTP) utilise le port 80.</p></body>');
        $('.bac-code').textContent = '';
        return;
      }
      $('.bac-web').hidden = false;
      cacherAide2();
      naviguer('/');
    });
    $('.bac-url').addEventListener('submit', function (evt) {
      evt.preventDefault();
      cacherAide2();
      naviguer($('.bac-url input').value.trim() || '/');
    });
    racineEl.querySelectorAll('[data-chemin]').forEach(function (b) {
      b.addEventListener('click', function () { cacherAide2(); naviguer(b.getAttribute('data-chemin')); });
    });
    auth.addEventListener('submit', function (evt) {
      evt.preventDefault();
      var id = { u: auth.querySelector('[name="u"]').value, p: auth.querySelector('[name="p"]').value };
      auth.querySelector('[name="p"]').value = '';
      cacherAide2();
      naviguer(cheminCourant, id);
    });
    auth.querySelector('[data-annuler]').addEventListener('click', function () { auth.hidden = true; });

    $('.bac-reset').addEventListener('click', function () {
      if (!window.confirm('Repartir d\'une machine neuve ? Tout ce qui a été fait dans le bac à sable sera effacé (comme quand l\'environnement Killercoda expire).')) return;
      etat = etatInitial();
      Object.keys(MISSIONS).forEach(function (id) {
        document.querySelectorAll('[data-mission="' + id + '"]').forEach(function (li) { li.classList.remove('faite'); });
      });
      mode = 'shell';
      identCourant = null;
      nanoEl.hidden = true;
      $('.bac-web').hidden = true;
      demarrer();
      sauver();
    });

    function demarrer() {
      sortie.innerHTML = '';
      var anciennes = etat.lignes;
      etat.lignes = [];
      if (!anciennes.length) {
        out('Bac à sable d\'entraînement : une machine Ubuntu 24.04 simulée dans la page.', 't-dim');
        out('Le vrai TP se fait sur Killercoda. Tape help pour la liste des commandes.', 't-dim');
      } else anciennes.forEach(ajouter);
      Object.keys(etat.faites).forEach(marquer);
      majPrompt();
    }
    demarrer();
    return { onglet: onglet };
  }

  return { creer: creer };
})();
