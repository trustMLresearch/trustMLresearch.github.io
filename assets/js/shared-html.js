/* A local HTML component shares its own markup with the page that opened it. */
(function () {
    'use strict';
    const token = location.hash.slice(1);
    if (window.parent === window || !/^shared-[0-9a-f-]+$/i.test(token)) return;
    const targetOrigin = location.protocol === 'file:' || location.origin === 'null' ? '*' : location.origin;
    window.parent.postMessage({ type: 'trustml-shared-html', token, html: document.documentElement.outerHTML }, targetOrigin);
})();
