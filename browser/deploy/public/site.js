/* Landing page behaviour: nothing but a health check link and honest counts. */
(function () {
  'use strict';

  fetch('/health', { headers: { accept: 'application/json' } })
    .then(function (response) { return response.json(); })
    .then(function (data) {
      if (!data || !data.ok) { return; }
      var target = document.querySelector('.wordmark');
      if (target) { target.setAttribute('title', 'Update server online'); }
    })
    .catch(function () { /* offline is fine, the page is static */ });
})();
