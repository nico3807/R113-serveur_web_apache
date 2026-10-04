// Page TP : crée le bac à sable et affiche le nombre d'étapes validées.

(function () {
  var el = document.getElementById('bac');
  if (!el) return;
  var total = document.querySelectorAll('[data-mission]').length;
  var compte = document.getElementById('missions-compte');
  function maj() {
    var n = document.querySelectorAll('[data-mission].faite').length;
    if (compte) compte.textContent = '· ' + n + ' / ' + total + ' actions validées dans le bac à sable';
  }
  el.classList.add('bac');
  BacASable.creer(el, { onMission: maj });
  maj();
})();
