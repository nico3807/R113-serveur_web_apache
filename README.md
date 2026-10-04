# R113-serveur_web_apache

TP interactif (BUT MMI1 — R1.13 Hébergement) : **TP3 Serveur web Apache**.
Administration d'une machine Ubuntu distante (environnement éphémère
[Killercoda](https://killercoda.com/playgrounds/scenario/ubuntu)) :
installation et pilotage d'Apache2, exposition du port 80, utilisateurs et
permissions, alias, journaux, authentification Basic (`.htaccess`) et page
d'erreur 404 personnalisée.

## Utiliser ce TP en tant qu'étudiant·e

1. Ouvrir `index.html` dans un navigateur (double-clic suffit).
2. Page **TP** : suivre les huit parties sur Killercoda. Le bac à sable du
   site (terminal + onglet « Traffic / Ports » simulés) permet de s'entraîner
   ou de rattraper une machine expirée ; chaque action réussie est cochée.
3. Page **Livrable** : identité, 4 captures JPG, réponses Q1 à Q7, puis
   compte rendu PDF à déposer sur Moodle.

Les réponses, l'identité, les captures et l'état du bac à sable sont
enregistrés dans le navigateur (`localStorage`, préfixe `apache-`, distinct
des autres TP) : rien n'est envoyé.

## Utiliser ce dépôt en tant qu'enseignant·e

Activer GitHub Pages sur la branche `main` (dossier racine) pour obtenir un
lien cliquable à distribuer.

## Éléments interactifs

- **Bac à sable façon Killercoda** (`js/bac-a-sable.js`) : terminal Ubuntu
  (root) avec système de fichiers, propriétaires et droits réellement
  appliqués ; `apt`, `systemctl` (avec pager `q`), `adduser`, `su` / `exit`,
  `chown`, `chmod`, `nano` (Ctrl+O / Ctrl+X), `echo >`, `a2enconf`,
  `apache2ctl configtest`, `tail -f`, `htpasswd`… et un Apache simulé qui lit
  sa configuration au rechargement : alias, `AllowOverride` + `.htaccess`,
  `ErrorDocument`, journal d'accès. Le navigateur de l'onglet « Traffic /
  Ports » renvoie 200, 301, 401, 403 (avec la cause) ou 404 selon l'état de
  la machine. 29 actions du sujet validées automatiquement.
- **Étapes repliables** avec progression, images du sujet.
- **Livrable** : barème sur 20, prénom et nom verrouillés dès le premier PDF,
  4 captures JPG, réponses ni sélectionnables, ni copiables, ni collables
  (sauf la ligne du journal de Q7, prévue pour être collée), compte rendu PDF
  verrouillé avec la mise en page du certificat de `bases_de_js`.
- **Mémo** filtrable (commandes, fichiers d'Apache, lecture d'une ligne de
  log, dépannage) et quiz.

## Structure

```
R113-serveur_web_apache/
├── index.html        Accueil : contexte, objectifs, déroulé
├── tp.html           Les 8 parties du TP + bac à sable
├── livrable.html     Barème, identité, captures, réponses, PDF
├── memo.html         Commandes, fichiers, journal, dépannage, quiz
├── css/style.css     Feuille de style partagée (thème clair / sombre)
├── img/              Logos IUT et MMI, images du sujet (image1 à image8)
└── js/
    ├── main.js            Navigation, étapes, stockage
    ├── bac-a-sable.js     Terminal Ubuntu + Apache + navigateur simulés
    ├── tp.js              Page TP : bac à sable et compteur d'actions
    ├── livrable.js        Identité, captures, réponses Q1 à Q7
    ├── compte-rendu.js    Génération du compte rendu PDF (jsPDF)
    ├── certificat-logos.js  Logos du PDF en base64 (comme bases_de_js)
    ├── memo.js            Filtre, copie, quiz
    └── vendor/            jsPDF (licence MIT, jspdf.LICENSE.txt)
```

## Licence

Support pédagogique libre de réutilisation et d'adaptation dans un cadre
d'enseignement.
