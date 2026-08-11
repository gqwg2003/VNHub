function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text, query) {
    if (!query) return escapeHTML(text);
    const escaped = escapeHTML(text);
    const terms = query.split(/\s+/).filter(Boolean).map(escapeRegExp);
    if (terms.length === 0) return escaped;
    const re = new RegExp(`(${terms.join('|')})`, 'gi');
    return escaped.replace(re, '<mark>$1</mark>');
}

function updateSearchResultCount() {
    let badge = document.getElementById('searchResultCount');
    if (!badge) {
        badge = document.createElement('span');
        badge.id = 'searchResultCount';
        badge.className = 'search-result-count';
        const topbar = document.querySelector('.topbar-search');
        if (topbar) topbar.appendChild(badge);
    }
    if (state.searchQuery) {
        const count = state.entries.length;
        badge.textContent = (t('searchResults') || '{0} results').replace('{0}', count);
        badge.style.display = '';
    } else {
        badge.style.display = 'none';
    }
}

function showSkeletonGrid() {
    const grid = document.getElementById('cardGrid');
    if (!grid) return;
    grid.className = 'card-grid grid-' + state.gridSize;
    const count = 12;
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `<div class="vn-card skeleton-card">
            <div class="skeleton-cover shimmer"></div>
            <div class="vn-card-info">
                <div class="skeleton-title shimmer"></div>
                <div class="skeleton-meta shimmer"></div>
            </div>
        </div>`;
    }
    grid.innerHTML = html;
}

const VIRTUAL = {
    allItems: [],
    rendered: 0,
    observer: null,
    batchSize: 40,
    sentinel: null
};

function cardSignature(entry) {
    return [
        entry.id,
        entry.title,
        entry.coverPath || '',
        entry.status,
        entry.isFavorite ? 1 : 0,
        entry.isPinned ? 1 : 0,
        state.runningGames.has(entry.id) ? 1 : 0,
        entry.exePath ? 1 : 0,
        entry.playTimeSeconds || 0,
        state.activeTab === 'reading' ? (entry.lastLaunchedAt || '') : '',
        entry.vndbId ? 1 : 0,
        entry.readingProgress || 0,
        state.searchQuery || '',
        currentLang
    ].join('\u241F');
}

function buildCard(entry) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = cardHTML(entry);
    const card = wrapper.firstElementChild;
    card.dataset.sig = cardSignature(entry);
    bindCardEvents(card);
    return card;
}

function teardownVirtual() {
    if (VIRTUAL.sentinel) {
        VIRTUAL.sentinel.remove();
        VIRTUAL.sentinel = null;
    }
    if (VIRTUAL.observer) {
        VIRTUAL.observer.disconnect();
        VIRTUAL.observer = null;
    }
}

function setupSentinel(grid) {
    VIRTUAL.sentinel = document.createElement('div');
    VIRTUAL.sentinel.className = 'grid-sentinel';
    VIRTUAL.sentinel.style.height = '1px';
    grid.after(VIRTUAL.sentinel);

    VIRTUAL.observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && VIRTUAL.rendered < VIRTUAL.allItems.length) {
            appendNextBatch(grid);
            if (VIRTUAL.rendered >= VIRTUAL.allItems.length) {
                teardownVirtual();
            }
        }
    }, { rootMargin: '200px' });

    VIRTUAL.observer.observe(VIRTUAL.sentinel);
}

function appendNextBatch(grid) {
    const start = VIRTUAL.rendered;
    const end = Math.min(start + VIRTUAL.batchSize, VIRTUAL.allItems.length);
    const fragment = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
        fragment.appendChild(buildCard(VIRTUAL.allItems[i]));
    }
    grid.appendChild(fragment);
    VIRTUAL.rendered = end;
}

// Keyed reconciliation: reuse existing card nodes by id, rebuild a card only
// when its data signature changed, and reorder nodes in place. Nodes without
// an id (e.g. skeleton placeholders) are discarded.
function reconcileCards(grid, items) {
    const existing = new Map();
    for (const node of Array.from(grid.children)) {
        const id = node.dataset && node.dataset.id;
        if (id) existing.set(id, node);
        else node.remove();
    }

    let pointer = grid.firstChild;
    for (const entry of items) {
        const old = existing.get(entry.id);
        let card;
        if (old) {
            existing.delete(entry.id);
            card = old.dataset.sig === cardSignature(entry) ? old : buildCard(entry);
        } else {
            card = buildCard(entry);
        }

        if (card === old) {
            if (card === pointer) {
                pointer = pointer.nextSibling;
            } else {
                grid.insertBefore(card, pointer);
            }
        } else {
            if (old) {
                if (old === pointer) pointer = pointer.nextSibling;
                old.remove();
            }
            grid.insertBefore(card, pointer);
        }
    }

    for (const node of existing.values()) node.remove();
}

function renderGrid() {
    const grid = document.getElementById('cardGrid');
    const empty = document.getElementById('emptyState');

    const filtered = state.entries;

    if (filtered.length === 0) {
        grid.innerHTML = '';
        VIRTUAL.allItems = [];
        VIRTUAL.rendered = 0;
        teardownVirtual();
        renderEmptyState(empty);
        empty.style.display = '';
        renderReadingStrip([]);
        return;
    }

    empty.style.display = 'none';
    renderReadingStrip(filtered);

    grid.className = 'card-grid grid-' + state.gridSize;

    const visibleCount = Math.min(filtered.length, Math.max(VIRTUAL.batchSize, VIRTUAL.rendered));

    VIRTUAL.allItems = filtered;
    reconcileCards(grid, filtered.slice(0, visibleCount));
    VIRTUAL.rendered = visibleCount;

    teardownVirtual();
    if (filtered.length > visibleCount) {
        setupSentinel(grid);
    }
}

function renderEmptyState(el) {
    let title = t('emptyTitle');
    let hint = t('emptyHint');
    const svgBook = ICONS.book;

    if (state.activeTag) {
        title = t('emptyTagTitle');
        hint = t('emptyTagHint');
    } else {
        switch (state.activeTab) {
            case 'marked':
                if (state.markedSubTab === 'favorites') {
                    title = t('emptyFavTitle');
                    hint = t('emptyFavHint');
                } else if (state.markedSubTab === 'priority') {
                    title = t('emptyPriorityTitle');
                    hint = t('emptyPriorityHint');
                } else if (state.markedSubTab === 'completed') {
                    title = t('emptyCompletedTitle');
                    hint = t('emptyCompletedHint');
                } else {
                    title = t('emptyMarkedTitle');
                    hint = t('emptyMarkedHint');
                }
                break;
            case 'reading':
                title = t('emptyReadingTitle');
                hint = t('emptyReadingHint');
                break;
        }
        if (state.activeGroupId) {
            title = t('emptyGroupTitle');
            hint = t('emptyGroupHint');
        }
    }

    el.innerHTML = `${svgBook}<h3>${escapeHTML(title)}</h3><p>${escapeHTML(hint)}</p>`;
}

function clearTagFilter() {
    state.activeTag = null;
    const badge = document.getElementById('activeTagBadge');
    if (badge) badge.style.display = 'none';
    refreshLibrary();
}

function setTagFilter(tag) {
    state.activeTag = tag;
    refreshLibrary();

    let badge = document.getElementById('activeTagBadge');
    if (!badge) {
        badge = document.createElement('span');
        badge.id = 'activeTagBadge';
        badge.className = 'active-tag-badge';
        const topbar = document.querySelector('.topbar-search');
        if (topbar) topbar.appendChild(badge);
    }
    badge.style.display = '';
    badge.innerHTML = `${escapeHTML(tag)} <span class="active-tag-clear">&times;</span>`;
    badge.querySelector('.active-tag-clear').addEventListener('click', (e) => {
        e.stopPropagation();
        clearTagFilter();
    });

    const dd = document.getElementById('tagDropdown');
    if (dd) closeTagDropdown(dd);
}

function getAllTags() {
    if (Array.isArray(state._tagsCache)) return state._tagsCache;
    return [];
}

let _tagDropdownCloseHandler = null;

function closeTagDropdown(dd) {
    dd.classList.remove('open');
    if (_tagDropdownCloseHandler) {
        document.removeEventListener('click', _tagDropdownCloseHandler);
        _tagDropdownCloseHandler = null;
    }
}

function toggleTagDropdown() {
    const dd = document.getElementById('tagDropdown');
    if (!dd) return;

    if (dd.classList.contains('open')) {
        closeTagDropdown(dd);
        return;
    }

    if (!Array.isArray(state._tagsCache)) {
        send('getTags');
        dd.innerHTML = `<div class="tag-dropdown-empty">${escapeHTML(t('loading') || '...')}</div>`;
        dd.classList.add('open');
        return;
    }

    renderTagDropdown(dd);
}

function renderTagDropdown(dd) {
    dd = dd || document.getElementById('tagDropdown');
    if (!dd) return;
    const tags = getAllTags();
    if (tags.length === 0) {
        dd.innerHTML = `<div class="tag-dropdown-empty">${escapeHTML(t('noTags'))}</div>`;
    } else {
        dd.innerHTML = tags.map(tag =>
            `<button class="tag-dropdown-item${state.activeTag && state.activeTag.toLowerCase() === tag.name.toLowerCase() ? ' active' : ''}" data-tag="${escapeAttr(tag.name)}">
                <span class="tag-dropdown-name">${escapeHTML(tag.name)}</span>
                <span class="tag-dropdown-count">${tag.count}</span>
            </button>`
        ).join('');

        dd.querySelectorAll('.tag-dropdown-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tag = btn.dataset.tag;
                if (state.activeTag && state.activeTag.toLowerCase() === tag.toLowerCase()) {
                    clearTagFilter();
                    closeTagDropdown(dd);
                } else {
                    setTagFilter(tag);
                }
            });
        });
    }

    dd.classList.add('open');

    if (_tagDropdownCloseHandler) {
        document.removeEventListener('click', _tagDropdownCloseHandler);
    }
    _tagDropdownCloseHandler = (e) => {
        if (!dd.contains(e.target) && e.target.id !== 'btnTagDropdown' && !e.target.closest('#btnTagDropdown')) {
            closeTagDropdown(dd);
        }
    };
    setTimeout(() => document.addEventListener('click', _tagDropdownCloseHandler), 0);
}

function cardHTML(entry) {
    const isRunning = state.runningGames.has(entry.id);
    const statusLabels = getStatusLabels();
    const coverSrc = entry.coverPath
        ? `https://covers.vnhub.local/${entry.coverPath}`
        : '';

    const coverEl = coverSrc
        ? `<img class="vn-card-cover" src="${escapeAttr(coverSrc)}?t=${entry.coverPath}" alt="${escapeAttr(entry.title)}" loading="lazy">`
        : `<div class="vn-card-cover-placeholder">
            ${ICONS.imagePlaceholder}
           </div>`;

    const icons = [];
    if (isRunning) icons.push(`<span class="vn-card-icon running">${ICONS.playFill}</span>`);
    if (entry.isFavorite) icons.push(`<span class="vn-card-icon heart">${ICONS.heartFill}</span>`);
    if (entry.isPinned) icons.push(`<span class="vn-card-icon star">${ICONS.starFill}</span>`);

    const playSvg = isRunning ? ICONS.pauseFill : ICONS.playFill;

    const playBtn = entry.exePath
        ? `<button class="vn-card-play${isRunning ? ' is-running' : ''}" data-id="${escapeAttr(entry.id)}" title="${isRunning ? t('running') : t('launch')}">
            ${playSvg}
           </button>`
        : '';

    const playTimeStr = entry.playTimeSeconds > 0
        ? `<span class="vn-card-playtime">${formatPlayTime(entry.playTimeSeconds)}</span>`
        : '';

    const lastPlayedStr = state.activeTab === 'reading' && entry.lastLaunchedAt
        ? `<span class="vn-card-lastplayed">${relativeTime(entry.lastLaunchedAt)}</span>`
        : '';

    const vndbBadge = entry.vndbId
        ? '<span class="vn-card-vndb" title="VNDB">V</span>'
        : '';

    const progressBar = entry.readingProgress > 0
        ? `<div class="vn-card-progress"><div class="vn-card-progress-fill" style="width:${entry.readingProgress}%"></div></div>`
        : '';

    return `
    <div class="vn-card${isRunning ? ' is-running' : ''}" data-id="${escapeAttr(entry.id)}">
        <div class="vn-card-cover-wrap">
            ${coverEl}
            <div class="vn-card-overlay">
                ${playBtn}
            </div>
            ${icons.length ? `<div class="vn-card-icons">${icons.join('')}</div>` : ''}
            ${progressBar}
        </div>
        <div class="vn-card-info">
            <div class="vn-card-title" title="${escapeAttr(entry.title)}">${highlightText(entry.title, state.searchQuery)}</div>
            <div class="vn-card-meta">
                <span class="status-badge" data-status="${entry.status}">${statusLabels[entry.status] || ''}</span>
                ${playTimeStr}
                ${lastPlayedStr}
                ${vndbBadge}
            </div>
        </div>
    </div>`;
}

function renderReadingStrip(entries) {
    const strip = document.getElementById('readingStrip');
    if (!strip) return;
    if (state.activeTab !== 'reading' || entries.length === 0) {
        strip.style.display = 'none';
        return;
    }

    const totalSec = entries.reduce((s, e) => s + (e.playTimeSeconds || 0), 0);
    const withProgress = entries.filter(e => e.readingProgress > 0);
    const avgProgress = withProgress.length > 0
        ? Math.round(withProgress.reduce((s, e) => s + e.readingProgress, 0) / withProgress.length)
        : 0;

    const svgBook  = ICONS.books;
    const svgClock  = ICONS.clock;
    const svgTarget = ICONS.target;

    strip.innerHTML = `
        <span class="reading-strip-stat">${svgBook} <strong>${entries.length}</strong> ${t('readingStripInProgress') || 'in progress'}</span>
        ${totalSec > 0 ? `<span class="reading-strip-stat">${svgClock} <strong>${formatPlayTime(totalSec)}</strong> ${t('readingStripTotal') || 'total'}</span>` : ''}
        ${avgProgress > 0 ? `<span class="reading-strip-stat">${svgTarget} ${t('readingStripAvg') || 'Avg.'} <strong>${avgProgress}%</strong></span>` : ''}
    `;
    strip.style.display = 'flex';
}

function patchCard(entry) {
    const grid = document.getElementById('cardGrid');
    if (!grid) return;
    const oldCard = grid.querySelector(`.vn-card[data-id="${CSS.escape(entry.id)}"]`);
    if (!oldCard) {
        renderGrid();
        return;
    }
    oldCard.replaceWith(buildCard(entry));
}

function patchRunningCards(ids) {
    const grid = document.getElementById('cardGrid');
    if (!grid) return;
    for (const id of ids) {
        const entry = state.entries.find(e => e.id === id);
        if (!entry) continue;
        const card = grid.querySelector(`.vn-card[data-id="${CSS.escape(id)}"]`);
        if (!card) continue;
        card.replaceWith(buildCard(entry));
    }
}

function bindCardEvents(card) {
    card.setAttribute('data-bound', '1');

    const playBtn = card.querySelector('.vn-card-play');
    if (playBtn) {
        playBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            send('launchVn', { id: playBtn.dataset.id });
        });
    }

    card.addEventListener('click', (e) => {
        const id = card.dataset.id;
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            toggleSelect(id);
            return;
        }
        if (state.selectedIds && state.selectedIds.size > 0) {
            toggleSelect(id);
            return;
        }
        const entry = state.entries.find(en => en.id === id);
        if (entry) openDetail(entry);
    });

    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const id = card.dataset.id;
        const entry = state.entries.find(en => en.id === id);
        if (entry) showContextMenu(e.clientX, e.clientY, entry);
    });
}
