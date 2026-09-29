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
        btn.append(label);
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
const tabs = document.querySelectorAll('[role="tab"]');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function selectTab(tab) {
    const id = tab.getAttribute('aria-controls');

    const apply = () => {
        for (const t of tabs) {
            const selected = t === tab;
            t.setAttribute('aria-selected', String(selected));
            document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
        }
        document.documentElement.dataset.theme = id;
        close(); // in case the lightbox is open
    };

    if (!document.startViewTransition || reduceMotion.matches) return apply();

    // Circle starts at the center of the clicked tab
    const rect = tab.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(
        Math.max(x, innerWidth - x),
        Math.max(y, innerHeight - y)
    );

    document.startViewTransition(apply).ready.then(() => {
        document.documentElement.animate(
            {
                clipPath: [
                    `circle(0px at ${x}px ${y}px)`,
                    `circle(${radius}px at ${x}px ${y}px)`,
                ],
            },
            {
                duration: 600,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
                pseudoElement: '::view-transition-new(root)',
            }
        );
    });
}

tabs.forEach(t => t.addEventListener('click', () => {
    if (t.getAttribute('aria-selected') === 'true') return; // no animation on the active tab
    selectTab(t);
}));