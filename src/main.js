let uid = 0;
const START_OPEN = false;

function makeCollapsible(listEl, depth = 0) {
    for (const li of listEl.querySelectorAll(':scope > li')) {
        const nested = li.querySelector(':scope > ol, :scope > ul');
        if (!nested) continue;

        const textNodes = [...li.childNodes].filter(
            n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()
        );
        const label = textNodes.map(n => n.textContent.trim()).join(' ');
        textNodes.forEach(n => n.remove());

        nested.id ||= `sublist-${uid++}`;
        nested.hidden = !START_OPEN;
        nested.style.setProperty('--depth', depth + 1); // add: li lines inherit this

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.innerHTML = '<span class="w-4 shrink-0 border-t border-dotted border-(--line)"></span>'; // add shrink-0
        const text = document.createElement('span');
        text.className = 'label';
        text.textContent = label;
        btn.append(text); // its own element, so it can nudge without the connector
        btn.className = "toggle cursor-pointer flex items-center gap-1.5 [&>span]:order-first";
        btn.setAttribute('aria-expanded', String(START_OPEN));
        btn.setAttribute('aria-controls', nested.id);
        btn.style.setProperty('--depth', depth);

        btn.addEventListener('click', () => {
            const open = btn.getAttribute('aria-expanded') === 'true';
            btn.setAttribute('aria-expanded', String(!open));
            nested.hidden = open;
        });

        li.prepend(btn);
        makeCollapsible(nested, depth + 1);
    }
}

document.querySelectorAll('ol:not(li ol)').forEach(ol => makeCollapsible(ol));

// End nodes stick too, at their own depth. Their label is a bare text node, so
// it needs wrapping before it can be positioned - the depth comes down from the
// list they sit in, the same value the toggles use.
for (const li of document.querySelectorAll('#work li:not(:has(> ol, > ul))')) {
    const textNodes = [...li.childNodes].filter(
        n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()
    );
    if (!textNodes.length) continue;

    const leaf = document.createElement('span');
    leaf.className = 'leaf';
    leaf.textContent = textNodes.map(n => n.textContent.trim()).join(' ');
    textNodes.forEach(n => n.remove());
    li.prepend(leaf);
}

const lightbox = document.createElement('div');
lightbox.className = 'lightbox';
const bigImg = document.createElement('img');
lightbox.append(bigImg);
document.body.append(lightbox);

const DURATION = 300;
const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
let current = null;

// Transform that makes the big image sit exactly over the small one
function fromRect(small, big) {
    const dx = small.left - big.left;
    const dy = small.top - big.top;
    const scale = small.width / big.width;
    return `translate(${dx}px, ${dy}px) scale(${scale})`;
}

async function open(img) {
    current = img;
    bigImg.src = img.currentSrc || img.src;
    bigImg.alt = img.alt;
    await bigImg.decode().catch(() => { });

    lightbox.classList.add('open');
    const small = img.getBoundingClientRect();
    const big = bigImg.getBoundingClientRect();
    img.style.visibility = 'hidden';

    requestAnimationFrame(() => lightbox.classList.add('dim'));
    bigImg.animate(
        [{ transform: fromRect(small, big) }, { transform: 'none' }],
        { duration: DURATION, easing: EASING }
    );
}

function close() {
    if (!current) return;
    const img = current;
    current = null;

    const small = img.getBoundingClientRect();
    const big = bigImg.getBoundingClientRect();

    lightbox.classList.remove('dim');
    bigImg.animate(
        [{ transform: 'none' }, { transform: fromRect(small, big) }],
        { duration: DURATION, easing: EASING }
    ).onfinish = () => {
        lightbox.classList.remove('open');
        img.style.visibility = '';
    };
}

document.querySelectorAll('li img').forEach(img => {
    img.addEventListener('click', () => open(img));
});

lightbox.addEventListener('click', close);

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
});

// Close on scroll
for (const type of ['scroll', 'wheel', 'touchmove']) {
    window.addEventListener(type, close, { passive: true });
}

function splitLetters(el) {
    const text = el.textContent;
    el.textContent = '';
    [...text].forEach((ch, i) => {
        const span = document.createElement('span');
        span.className = 'letter';
        span.textContent = ch;
        span.style.setProperty('--i', i);
        el.append(span);
    });
}

document.querySelectorAll('.typewriter').forEach(div => splitLetters(div))

document.documentElement.classList.add('ready');

document.querySelectorAll('img, iframe').forEach(el => {
    const links = [];
    for (let n = 1; el.hasAttribute(`link-${n}`); n++) {
        links.push({
            href: el.getAttribute(`link-${n}`),
            title: el.getAttribute(`link-${n}-title`) || 'Open',
        });
    }
    if (!links.length) return;

    // Wrap the element so the links can sit on top of it
    const wrap = document.createElement('div');
    wrap.className = 'img-wrap';
    el.before(wrap);
    wrap.append(el);

    const bar = document.createElement('div');
    bar.className = 'img-links';
    for (const { href, title } of links) {
        const a = document.createElement('a');
        a.href = href;
        a.textContent = title + ' ↗';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        bar.append(a);
    }
    wrap.append(bar);
});

// Tabs
const tabs = [...document.querySelectorAll('[role="tab"]')];

// A hidden panel gives its embeds a 0x0 box, and Chrome loads hidden iframes
// eagerly whatever loading="lazy" says - so YouTube measures nothing, picks its
// smallest poster and never upgrades. Hold the src back until the panel is
// shown and it measures the real player instead.
document.querySelectorAll('[role="tabpanel"][hidden] iframe[src]').forEach(frame => {
    frame.dataset.src = frame.src;
    frame.removeAttribute('src');
    frame.classList.add('pending'); // a placeholder until the player paints
});

function loadEmbeds(panel) {
    for (const frame of panel.querySelectorAll('iframe[data-src]')) {
        frame.addEventListener('load', () => frame.classList.remove('pending'), { once: true });
        frame.src = frame.dataset.src;
        delete frame.dataset.src;
    }
}
const panelOf = tab => document.getElementById(tab.getAttribute('aria-controls'));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const SWEEP = 500;

// Set while a reveal is in flight; calling it commits that reveal right away
let pending = null;

function commit(tab) {
    for (const t of tabs) {
        const selected = t === tab;
        const panel = panelOf(t);
        t.setAttribute('aria-selected', String(selected));
        panel.hidden = !selected;
        panel.removeAttribute('style');
        if (selected) loadEmbeds(panel);
    }
    document.documentElement.dataset.theme = tab.getAttribute('aria-controls');
    close(); // in case the lightbox is open
}

function selectTab(tab) {
    pending?.(); // land the reveal in flight, so clicks can be spammed
    const from = tabs.find(t => t.getAttribute('aria-selected') === 'true');
    const id = tab.getAttribute('aria-controls');
    const panel = panelOf(tab);
    const old = from && panelOf(from);

    // Which way the content enters: towards a later tab, it comes in from the
    // right. Kept on the root so commit() clearing the panel's inline styles
    // can't pull it out from under a running animation.
    const dir = Math.sign(tabs.indexOf(tab) - tabs.indexOf(from));
    document.documentElement.style.setProperty('--slide', `${dir * 12}px`);
    document.documentElement.style.setProperty('--rise', '0px');

    if (!old || old === panel || reduceMotion.matches) return commit(tab);

    for (const t of tabs) t.setAttribute('aria-selected', String(t === tab));
    close();

    // The theme flips now, not on commit: anything themed that isn't a panel
    // (the tab bar mixes var(--line) and var(--bg)) would otherwise sit a whole
    // animation behind the reveal. Only the page background is swept, by the
    // two layers below, so the outgoing panel carries the outgoing palette.
    const was = document.documentElement.dataset.theme || 'work';
    old.style.setProperty('--bg', `var(--bg-${was})`);
    old.style.setProperty('--line', `var(--line-${was})`);
    document.documentElement.dataset.theme = id;

    // The outgoing panel stays where it is; the incoming one is revealed over it
    // through a circle growing from the centre of the clicked tab. Nothing here
    // suppresses hit testing on the page itself, so the tabs stay live.
    // It sits below .sweep so the full-bleed bands its sticky toggles paint
    // don't show through the reveal in the old colour. The incoming panel needs
    // no z-index of its own: its clip-path already makes it a stacking context,
    // painted as if it were z-index 0, which is above the sweep.
    old.style.pointerEvents = 'none';
    old.style.zIndex = '-2';
    loadEmbeds(panel);
    // Locked for the duration: the outgoing panel is still in the grid, so the
    // page is taller than it will be once it's hidden, and anything scrolled to
    // in the meantime is clamped away on commit
    document.documentElement.style.overflow = 'hidden';
    panel.hidden = false;
    panel.style.background = 'var(--bg)';

    const tabRect = tab.getBoundingClientRect();
    const x = tabRect.left + tabRect.width / 2;
    const y = tabRect.top + tabRect.height / 2;
    const radius = Math.hypot(
        Math.max(x, innerWidth - x),
        Math.max(y, innerHeight - y)
    );

    // Two viewport layers behind the page: the outgoing colour, and the incoming
    // one revealed over it. Both sit under the outgoing panel's own layer.
    const sweep = (color, z) => {
        const el = document.createElement('div');
        el.className = 'sweep';
        el.style.background = color;
        if (z) el.style.zIndex = z;
        document.body.append(el);
        return el;
    };
    const under = sweep(`var(--bg-${was})`, '-3');
    const layer = sweep(`var(--bg-${id})`);

    // clip-path is relative to each element's own box
    const box = panel.getBoundingClientRect();
    const circle = (r, ox = 0, oy = 0) => `circle(${r}px at ${x - ox}px ${y - oy}px)`;
    const opts = { duration: SWEEP, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'both' };
    const anims = [
        panel.animate({ clipPath: [circle(0, box.left, box.top), circle(radius, box.left, box.top)] }, opts),
        layer.animate({ clipPath: [circle(0), circle(radius)] }, opts),
    ];

    const done = () => {
        if (pending !== done) return; // a newer reveal already took over
        pending = null;
        anims.forEach(a => a.cancel());
        document.documentElement.style.removeProperty('overflow');
        under.remove();
        layer.remove();
        commit(tab);
    };
    pending = done;
    Promise.all(anims.map(a => a.finished)).then(done, done);
}

tabs.forEach(t => t.addEventListener('click', () => {
    // The active tab is a no-op, double clicks included: aria-selected moves at
    // the start of a reveal, so a repeat click can't cut its own animation short
    if (t.getAttribute('aria-selected') === 'true') return;
    selectTab(t);
}));
