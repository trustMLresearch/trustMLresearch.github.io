/* Shared HTML loads automatically; individual pages remain directly editable HTML. */
(function () {
    'use strict';
    const siteRoot = new URL('../../', document.currentScript.src);
    const content = document.getElementById('page-content');
    const heading = document.getElementById('page-heading');
    if (!content || !heading) return;
    const reload = performance.getEntriesByType('navigation')[0]?.type === 'reload';

    function finishLoading() {
        clearTimeout(window.siteLoadingGuard);
        document.documentElement.classList.remove('site-loading');
    }

    function cachedHTML(url) {
        try { return sessionStorage.getItem('trustml-shared:v3:' + url.href); }
        catch (error) { return null; }
    }

    async function fetchHTML(url, refresh) {
        const response = await fetch(url, { cache: refresh ? 'no-cache' : 'default' });
        if (!response.ok) throw new Error('Unable to load ' + url.href);
        const html = await response.text();
        try { sessionStorage.setItem('trustml-shared:v3:' + url.href, html); }
        catch (error) { /* Storage may be unavailable; HTTP caching still works. */ }
        return html;
    }

    function parseHTML(html) {
        const parsed = new DOMParser().parseFromString(html, 'text/html');
        const template = document.createElement('template');
        template.innerHTML = parsed.body.innerHTML;
        return template.content;
    }

    function loadFromFrame(url, isolateOrigin) {
        return new Promise((resolve, reject) => {
            const frame = document.createElement('iframe');
            const values = crypto.getRandomValues(new Uint32Array(4));
            const token = 'shared-' + Array.from(values, value => value.toString(16)).join('-');
            frame.hidden = true;
            frame.tabIndex = -1;
            frame.setAttribute('aria-hidden', 'true');
            // An opaque-origin test exercises the same message path as local files.
            if (isolateOrigin) frame.setAttribute('sandbox', 'allow-scripts');
            const timer = setTimeout(() => finish(new Error('Unable to load ' + url.href)), 10000);
            function finish(error, html) {
                clearTimeout(timer);
                window.removeEventListener('message', receive);
                frame.remove();
                if (error) reject(error);
                else resolve(parseHTML(html));
            }
            function receive(event) {
                if (event.source !== frame.contentWindow || event.data?.type !== 'trustml-shared-html' || event.data.token !== token || typeof event.data.html !== 'string') return;
                finish(null, event.data.html);
            }
            window.addEventListener('message', receive);
            const target = new URL(url);
            target.hash = token;
            frame.src = target.href;
            document.body.append(frame);
        });
    }

    async function loadHTML(filename) {
        const url = new URL('common/' + filename, siteRoot);
        if (siteRoot.protocol === 'file:') return loadFromFrame(url, false);
        // Used only by the opaque-origin compatibility test, not normal page visits.
        if (new URL(location.href).searchParams.get('testLocalComponents') === '1') return loadFromFrame(url, true);
        const cached = cachedHTML(url);
        if (cached && !reload) {
            // Render immediately; a background check prepares updates for the next page.
            fetchHTML(url, true).catch(() => {});
            return parseHTML(cached);
        }
        return parseHTML(await fetchHTML(url, reload));
    }

    function rootURL(value) {
        if (!value || /^(?:#|[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return value;
        return new URL(value, siteRoot).href;
    }

    function resolveLinks(fragment) {
        fragment.querySelectorAll('[href], [src], [action], [srcset]').forEach(element => {
            for (const name of ['href', 'src', 'action']) {
                if (element.hasAttribute(name)) element.setAttribute(name, rootURL(element.getAttribute(name)));
            }
            if (element.hasAttribute('srcset') && !element.getAttribute('srcset').startsWith('data:')) {
                element.setAttribute('srcset', element.getAttribute('srcset').split(',').map(item => {
                    const parts = item.trim().split(/\s+/);
                    parts[0] = rootURL(parts[0]);
                    return parts.join(' ');
                }).join(', '));
            }
        });
    }

    function prepareMenu(menu, desktop) {
        menu.querySelectorAll('li').forEach((item, index) => {
            const anchor = Array.from(item.children).find(child => child.tagName === 'A');
            const children = Array.from(item.children).find(child => child.tagName === 'UL');
            item.classList.add('menu-item', 'menu-item-type-post_type', 'menu-item-object-page');
            if (desktop) item.id = 'menu-item-' + index;
            if (!anchor) return;
            if (anchor.getAttribute('href') !== '#') {
                const current = location.pathname.replace(/\/$/, '/index.html');
                if (new URL(anchor.getAttribute('href'), siteRoot).pathname === current) anchor.setAttribute('aria-current', 'page');
            }
            if (desktop) {
                anchor.classList.add('menu-link');
                const label = document.createElement('span');
                label.className = 'text-wrap';
                label.append(...Array.from(anchor.childNodes));
                anchor.append(label);
                if (children) {
                    const arrow = document.createElement('i');
                    arrow.className = 'nav-arrow fa fa-angle-down';
                    arrow.setAttribute('aria-hidden', 'true');
                    label.append(arrow);
                }
            }
            if (children) {
                item.classList.add('menu-item-has-children');
                if (desktop) item.classList.add('dropdown');
                children.classList.add('sub-menu');
                children.id = (desktop ? 'desktop-sub-' : 'mobile-sub-') + index;
                anchor.setAttribute('aria-haspopup', 'true');
                anchor.setAttribute('aria-expanded', 'false');
                anchor.setAttribute('aria-controls', children.id);
                if (!desktop) {
                    const toggle = document.createElement('span');
                    toggle.className = 'dropdown-toggle';
                    toggle.setAttribute('aria-hidden', 'true');
                    anchor.append(toggle);
                }
            }
        });
    }

    async function addStyles(head) {
        resolveLinks(head);
        const pending = [];
        for (const element of Array.from(head.children)) {
            if (element.tagName === 'LINK' && element.rel === 'stylesheet') {
                const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(link => link.href === element.href);
                if (existing?.sheet) continue;
                if (existing) existing.remove();
                pending.push(new Promise((resolve, reject) => {
                    element.addEventListener('load', resolve, { once: true });
                    element.addEventListener('error', () => reject(new Error('Unable to load ' + element.href)), { once: true });
                }));
                document.head.append(element);
            } else if (element.tagName === 'STYLE') {
                document.head.append(element);
            }
        }
        await Promise.all(pending);
    }

    function initializeControls() {
        const menuButton = document.querySelector('.mobile-menu');
        const mobileMenu = document.getElementById('mobile-dropdown');
        const desktopMenu = document.getElementById('menu-main-menu');
        const scrollTop = document.getElementById('scroll-top');

        function closeDesktopMenus() {
            desktopMenu.querySelectorAll('.sfHover').forEach(item => {
                item.classList.remove('sfHover');
                item.querySelector('a').setAttribute('aria-expanded', 'false');
            });
        }
        function setMobileOpen(open) {
            menuButton.classList.toggle('opened', open);
            menuButton.setAttribute('aria-expanded', String(open));
            mobileMenu.classList.toggle('is-open', open);
        }
        menuButton.addEventListener('click', event => {
            event.preventDefault();
            setMobileOpen(menuButton.getAttribute('aria-expanded') !== 'true');
        });
        mobileMenu.querySelectorAll('.menu-item-has-children > a').forEach(anchor => {
            anchor.addEventListener('click', event => {
                event.preventDefault();
                const item = anchor.parentElement;
                const open = !item.classList.contains('active');
                item.classList.toggle('active', open);
                anchor.setAttribute('aria-expanded', String(open));
            });
        });
        desktopMenu.querySelectorAll('.menu-item-has-children > a').forEach(anchor => {
            anchor.addEventListener('click', event => {
                event.preventDefault();
                const item = anchor.parentElement;
                const open = !item.classList.contains('sfHover');
                closeDesktopMenus();
                item.classList.toggle('sfHover', open);
                anchor.setAttribute('aria-expanded', String(open));
            });
        });
        window.addEventListener('resize', () => {
            if (window.matchMedia('(min-width: 960px)').matches) setMobileOpen(false);
        });
        document.addEventListener('click', event => {
            if (!desktopMenu.contains(event.target)) closeDesktopMenus();
            if (!mobileMenu.contains(event.target) && !menuButton.contains(event.target)) setMobileOpen(false);
        });
        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            if (menuButton.getAttribute('aria-expanded') === 'true') {
                setMobileOpen(false);
                menuButton.focus();
            }
            const current = desktopMenu.querySelector('.sfHover > a');
            closeDesktopMenus();
            if (current) current.focus();
        });
        function updateScrollControl() {
            scrollTop.classList.toggle('is-visible', window.scrollY > 100);
        }
        window.addEventListener('scroll', updateScrollControl, { passive: true });
        updateScrollControl();
        scrollTop.addEventListener('click', event => {
            event.preventDefault();
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
        });
    }

    async function start() {
        const footerFilename = document.body.dataset.siteFooter;
        const [shared, menu, years, footer] = await Promise.all([
            loadHTML('layout.html'), loadHTML('menu.html'), loadHTML('years.html'),
            footerFilename ? loadHTML(footerFilename) : Promise.resolve(document.createDocumentFragment())
        ]);
        const layoutTemplate = shared.querySelector('#site-layout');
        const headTemplate = shared.querySelector('#site-head');
        if (!layoutTemplate || !headTemplate) throw new Error('The shared layout is incomplete.');
        const frame = layoutTemplate.content.cloneNode(true);
        const styles = headTemplate.content.cloneNode(true);
        const profile = document.body.dataset.siteStyle;
        if (profile) {
            const extra = Array.from(shared.querySelectorAll('[data-site-style]')).find(template => template.dataset.siteStyle === profile);
            if (extra) styles.append(extra.content.cloneNode(true));
        }
        menu.querySelectorAll('[data-site-years]').forEach(slot => slot.append(years.cloneNode(true)));
        const desktopMenu = frame.querySelector('#menu-main-menu');
        const mobileMenu = frame.querySelector('#menu-main-menu-1');
        desktopMenu.append(menu.cloneNode(true));
        mobileMenu.append(menu.cloneNode(true));
        prepareMenu(desktopMenu, true);
        prepareMenu(mobileMenu, false);
        frame.querySelector('[data-site-slot="footer-widgets"]').replaceWith(footer);
        frame.querySelector('[data-site-slot="heading"]').replaceWith(heading.content.cloneNode(true));
        if (document.body.dataset.siteEmail) frame.querySelector('.trust-email a').setAttribute('href', document.body.dataset.siteEmail);
        // Resolve shared paths only; each page's existing content URLs stay untouched.
        resolveLinks(frame);
        await addStyles(styles);
        frame.querySelector('[data-site-slot="content"]').replaceWith(...Array.from(content.childNodes));
        document.body.replaceChildren(frame);
        document.body.classList.replace('tribe-no-js', 'tribe-js');
        initializeControls();
        if (location.hash.length > 1) {
            let identifier = location.hash.slice(1);
            try { identifier = decodeURIComponent(identifier); } catch (error) { /* Keep the literal fragment. */ }
            const target = document.getElementById(identifier);
            if (target) target.scrollIntoView();
        }
        document.body.dataset.siteReady = 'true';
        finishLoading();
    }

    start().catch(error => {
        console.error(error);
        const title = document.createElement('h1');
        title.append(heading.content.cloneNode(true));
        const notice = document.createElement('p');
        notice.textContent = 'Navigation could not be loaded. Please check that the common and assets folders are present beside this website.';
        content.prepend(title, notice);
        finishLoading();
    });
})();
