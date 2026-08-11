function initStatsTabs() {
    const tabs = document.querySelectorAll('.stats-tab');
    if (!tabs.length || tabs[0].dataset.bound) return;
    tabs.forEach(tab => {
        tab.dataset.bound = '1';
        tab.addEventListener('click', () => {
            document.querySelectorAll('.stats-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.stats-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const content = document.querySelector(`.stats-tab-content[data-tab-content="${tab.dataset.tab}"]`);
            if (content) content.classList.add('active');
        });
    });
}

let _statsRenderSig = null;

function renderStats(data) {
    const sig = currentLang + '\u241F' + JSON.stringify(data);
    if (sig === _statsRenderSig) return;
    _statsRenderSig = sig;

    const statusLabels = getStatusLabels();
    const statusColors = ['var(--status-reading)', 'var(--status-completed)', 'var(--status-onhold)', 'var(--status-dropped)', 'var(--status-plan)'];

    const icons = { library: ICONS.book, clock: ICONS.clock, check: ICONS.check, book: ICONS.books, heart: ICONS.heart, star: ICONS.star, target: ICONS.target, flame: ICONS.flame };
    const cardsEl = document.getElementById('statsCards');
    cardsEl.innerHTML = `
        <div class="stat-card stat-card-accent">
            <div class="stat-card-icon">${icons.library}</div>
            <div class="stat-card-body">
                <div class="stat-card-value">${data.totalVn}</div>
                <div class="stat-card-label">${t('statsTotalVn')}</div>
            </div>
        </div>
        <div class="stat-card stat-card-accent">
            <div class="stat-card-icon">${icons.clock}</div>
            <div class="stat-card-body">
                <div class="stat-card-value">${formatPlayTime(data.totalPlayTime)}</div>
                <div class="stat-card-label">${t('statsTotalPlayTime')}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-icon">${icons.check}</div>
            <div class="stat-card-body">
                <div class="stat-card-value">${data.byStatus?.[1] || 0}</div>
                <div class="stat-card-label">${t('statusCompleted')}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-icon">${icons.book}</div>
            <div class="stat-card-body">
                <div class="stat-card-value">${data.byStatus?.[0] || 0}</div>
                <div class="stat-card-label">${t('statusReading')}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-icon">${icons.heart}</div>
            <div class="stat-card-body">
                <div class="stat-card-value">${data.favCount || 0}</div>
                <div class="stat-card-label">${t('favorites')}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-icon">${icons.star}</div>
            <div class="stat-card-body">
                <div class="stat-card-value">${data.avgRating || '—'}</div>
                <div class="stat-card-label">${t('statsAvgRating')}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-icon">${icons.target}</div>
            <div class="stat-card-body">
                <div class="stat-card-value">${data.avgCompletionTime > 0 ? formatPlayTime(data.avgCompletionTime) : '—'}</div>
                <div class="stat-card-label">${t('statsAvgCompletion')}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-icon">${icons.flame}</div>
            <div class="stat-card-body">
                <div class="stat-card-value">${data.streak?.current || 0}</div>
                <div class="stat-card-label">${t('statsCurrentStreak') || 'Current Streak'}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-card-icon">${icons.flame}</div>
            <div class="stat-card-body">
                <div class="stat-card-value">${data.streak?.longest || 0}</div>
                <div class="stat-card-label">${t('statsLongestStreak') || 'Longest Streak'}</div>
            </div>
        </div>
    `;

    renderHeatmap(data.heatmap);

    renderRanking('statsTopPlayed', data.topPlayed, 'playTime');
    renderRanking('statsTopRated', data.topRated, 'userRating');

    const barsEl = document.getElementById('statsStatusBars');
    const totalByStatus = Object.values(data.byStatus || {}).reduce((s, v) => s + v, 0);
    if (totalByStatus === 0) {
        barsEl.innerHTML = `<div class="stats-empty-state">${ICONS.gridFour}<p>${t('statsNoStatus')}</p></div>`;
    } else {
        const maxCount = Math.max(...Object.values(data.byStatus || {}), 1);
        let barsHTML = '';
        for (let i = 0; i <= 4; i++) {
            const count = data.byStatus?.[i] || 0;
            const pct = (count / maxCount * 100).toFixed(1);
            barsHTML += `
            <div class="stats-bar-row">
                <span class="stats-bar-label">${statusLabels[i]}</span>
                <div class="stats-bar-track">
                    <div class="stats-bar-fill" style="width: ${pct}%; background: ${statusColors[i]};"></div>
                </div>
                <span class="stats-bar-count">${count}</span>
            </div>`;
        }
        barsEl.innerHTML = barsHTML;
    }

    const chartEl = document.getElementById('statsChart');
    const months = data.monthlyAdds || {};
    const sortedMonths = Object.keys(months).sort();
    if (sortedMonths.length === 0) {
        chartEl.innerHTML = `<div class="stats-empty-state">${ICONS.tableGrid}<p>${t('statsNoMonthly')}</p></div>`;
    } else {
        const maxMonth = Math.max(...Object.values(months), 1);
        let chartHTML = '<div class="stats-chart-bars">';
        for (const m of sortedMonths) {
            const h = (months[m] / maxMonth * 100).toFixed(1);
            chartHTML += `
            <div class="stats-chart-col">
                <div class="stats-chart-bar" style="height: ${h}%;" title="${months[m]}"></div>
                <span class="stats-chart-label">${m.slice(2)}</span>
            </div>`;
        }
        chartHTML += '</div>';
        chartEl.innerHTML = chartHTML;
    }

    renderAchievements(data);
    renderRatingDistribution(data.byRating);
    renderTopTags(data.topTags);
    renderCategoryRatings(data.categoryAvgs);
    initStatsTabs();
    initStatsExport();
}

function initStatsExport() {
    const btn = document.getElementById('statsExportBtn');
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => send('exportStats'));
}

function renderHeatmap(cells) {
    const el = document.getElementById('statsHeatmap');
    if (!el) return;

    const map = {};
    (cells || []).forEach(c => { map[c.day] = c.seconds || 0; });

    const weeks = 53;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (weeks * 7 - 1));
    start.setDate(start.getDate() - start.getDay());

    const toLocalIso = dt => {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const day = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const maxSec = Math.max(...Object.values(map), 1);
    const level = sec => {
        if (sec <= 0) return 0;
        const r = sec / maxSec;
        if (r > 0.66) return 4;
        if (r > 0.33) return 3;
        if (r > 0.1) return 2;
        return 1;
    };

    let cols = '';
    const cursor = new Date(start);
    for (let w = 0; w < weeks; w++) {
        let days = '';
        for (let d = 0; d < 7; d++) {
            const iso = toLocalIso(cursor);
            const future = cursor > today;
            const sec = map[iso] || 0;
            const lvl = future ? -1 : level(sec);
            const title = future ? '' : `${iso} — ${formatPlayTime(sec)}`;
            days += `<div class="heatmap-cell" data-level="${lvl}" title="${title}"></div>`;
            cursor.setDate(cursor.getDate() + 1);
        }
        cols += `<div class="heatmap-col">${days}</div>`;
    }

    const less = t('statsHeatmapLess') || 'Less';
    const more = t('statsHeatmapMore') || 'More';
    el.innerHTML = `
        <div class="heatmap-grid">${cols}</div>
        <div class="heatmap-legend">
            <span>${less}</span>
            <div class="heatmap-cell" data-level="0"></div>
            <div class="heatmap-cell" data-level="1"></div>
            <div class="heatmap-cell" data-level="2"></div>
            <div class="heatmap-cell" data-level="3"></div>
            <div class="heatmap-cell" data-level="4"></div>
            <span>${more}</span>
        </div>`;
}

function renderRanking(elId, items, mode) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!items || items.length === 0) {
        el.innerHTML = `<div class="stats-empty-state">${ICONS.barChart}<p>${t('statsNoRanking')}</p></div>`;
        return;
    }
    el.innerHTML = items.map((item, i) => {
        const rank = i + 1;
        const medalClass = rank <= 3 ? ` rank-${rank}` : '';
        const coverSrc = item.cover
            ? `https://covers.vnhub.local/${encodeURIComponent(item.cover)}`
            : '';
        const coverEl = coverSrc
            ? `<img class="ranking-cover" src="${coverSrc}" alt="${escapeAttr(item.title)}" loading="lazy">`
            : `<div class="ranking-cover ranking-no-cover">?</div>`;
        const value = mode === 'userRating'
            ? `${'★'.repeat(item.userRating || 0)}${'☆'.repeat(10 - (item.userRating || 0))}`
            : formatPlayTime(item.playTime);
        const sub = mode === 'userRating'
            ? `<span class="ranking-sub">${formatPlayTime(item.playTime)}</span>`
            : (item.userRating ? `<span class="ranking-sub">${'★'.repeat(item.userRating)}</span>` : '');

        return `<div class="ranking-item${medalClass}" data-id="${escapeAttr(item.id)}">
            <span class="ranking-pos">${rank}</span>
            ${coverEl}
            <div class="ranking-info">
                <span class="ranking-title">${escapeHTML(item.title)}</span>
                <span class="ranking-value">${value}</span>
                ${sub}
            </div>
        </div>`;
    }).join('');

    el.querySelectorAll('.ranking-item').forEach(row => {
        row.addEventListener('click', () => {
            const id = row.dataset.id;
            const entry = state.entries.find(e => e.id === id);
            if (entry) openDetail(entry);
        });
    });
}

function renderPlayStats(data) {
    state._playStatsDays = data.days || 30;
    renderPlayTimeChart('statsPlayChart', data.data, data.days || 30);
    initPlayStatsPeriod();
}

function initPlayStatsPeriod() {
    const container = document.getElementById('playStatsPeriod');
    if (!container || container.dataset.bound) return;
    container.dataset.bound = '1';
    container.addEventListener('click', (e) => {
        const btn = e.target.closest('.stats-period-btn');
        if (!btn) return;
        container.querySelectorAll('.stats-period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const days = parseInt(btn.dataset.days);
        send('getPlayStats', { days });
    });
}

function renderPlayTimeChart(elId, dayData, days) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!dayData || dayData.length === 0) {
        el.innerHTML = `<div class="stats-empty-state">${ICONS.tableGrid}<p>${t('statsNoPlayData')}</p></div>`;
        return;
    }
    const map = {};
    dayData.forEach(d => { map[d.day] = d.seconds || d.totalSeconds || 0; });

    let labels;
    if (days <= 0) {
        labels = Object.keys(map).sort();
    } else {
        labels = [];
        const now = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            labels.push(d.toISOString().slice(0, 10));
        }
    }

    const maxVal = Math.max(...labels.map(l => map[l] || 0), 1);

    const showEvery = labels.length > 60 ? Math.ceil(labels.length / 30) :
                       labels.length > 30 ? 2 : 1;

    let html = '<div class="stats-chart-bars">';
    for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        const sec = map[label] || 0;
        const h = (sec / maxVal * 100).toFixed(1);
        const shortLabel = label.slice(5);
        const title = formatPlayTime(sec);
        const showLabel = i % showEvery === 0;
        html += `
        <div class="stats-chart-col">
            <div class="stats-chart-bar" style="height: ${h}%;" title="${title}"></div>
            <span class="stats-chart-label">${showLabel ? shortLabel : ''}</span>
        </div>`;
    }
    html += '</div>';
    el.innerHTML = html;
}

function renderAchievements(data) {
    const el = document.getElementById('statsAchievements');
    if (!el) return;

    const svg = ICONS;

    const iconMap = {
        achFirstVn:       svg.book,
        ach10Vn:          svg.books,
        ach50Vn:          svg.library,
        ach100Vn:         svg.archive,
        achFirstComplete: svg.check,
        ach10Complete:    svg.award,
        ach25Complete:    svg.crown,
        ach10Hours:       svg.clock,
        ach100Hours:      svg.flame,
        ach500Hours:      svg.gem,
        achFirstFav:      svg.heart,
        achFirstRating:   svg.star,
        tagMilf5:         svg.moon,
        tagMilf10:        svg.moon,
        tagMilf25:        svg.moon,
        tagHarem5:        svg.users,
        tagHarem10:       svg.users,
        tagHarem25:       svg.users,
        tagYuri5:         svg.flower,
        tagYuri25:        svg.flower,
        tagSchool5:       svg.school,
        tagSchool25:      svg.school,
        tagFantasy5:      svg.sword,
        tagFantasy25:     svg.sword,
        tagTsundere5:     svg.zap,
        tagTsundere10:    svg.zap,
        tagMoege5:        svg.star,
        tagMoege25:       svg.star,
        tagRomance5:      svg.heart,
        tagRomance25:     svg.heart,
        tagIncest5:       svg.drama,
        tagIncest10:      svg.drama,
        tagIncest25:      svg.drama,
        tagAhegao5:       svg.eye,
        tagAhegao25:      svg.eye,
        tagExhibit5:      svg.eye,
        tagExhibit25:     svg.eye,
        tagCreampie5:     svg.drop,
        tagCreampie25:    svg.drop,
        tagPregnancy5:    svg.baby,
        tagPregnancy25:   svg.baby,
        tagBdsm5:         svg.chain,
        tagBdsm10:        svg.chain,
        tagBdsm25:        svg.chain,
        tagGrandma5:      svg.moon,
        tagGrandma10:     svg.moon,
        tagGrandma25:     svg.moon,
        tagMotherSon5:    svg.heart,
        tagMotherSon10:   svg.heart,
        tagMotherSon25:   svg.heart,
        tagAunt5:         svg.family,
        tagAunt10:        svg.family,
        tagAunt25:        svg.family,
        tagSiblings5:     svg.users,
        tagSiblings10:    svg.users,
        tagSiblings25:    svg.users,
        tagCousin5:       svg.family,
        tagCousin10:      svg.family,
        tagCousin25:      svg.family,
    };

    const list = Array.isArray(data.achievements) ? data.achievements : [];
    const newlyUnlocked = Array.isArray(data.newlyUnlocked) ? data.newlyUnlocked : [];

    for (const key of newlyUnlocked) {
        showToast(t('achievementUnlocked') + ' ' + t(key), 'success');
    }

    el.innerHTML = list.map(a => {
        const icon = iconMap[a.key] || svg.star;
        const dateStr = a.unlockedAt ? new Date(a.unlockedAt).toLocaleDateString() : '';
        const flavorText = a.unlocked ? escapeHTML(t(a.key + 'Flavor')) : '???';
        const flavorClass = a.unlocked ? 'achievement-flavor' : 'achievement-flavor achievement-flavor-locked';
        const showProgress = !a.unlocked && a.target > 1;
        const pct = showProgress ? Math.min(100, (a.progress || 0) / a.target * 100).toFixed(1) : 0;
        const progressHTML = showProgress ? `
                    <div class="achievement-progress">
                        <div class="achievement-progress-track">
                            <div class="achievement-progress-fill" style="width: ${pct}%;"></div>
                        </div>
                        <span class="achievement-progress-text">${a.progress || 0}/${a.target}</span>
                    </div>` : '';
        return `
        <div class="achievement${a.unlocked ? ' unlocked' : ''}" data-key="${escapeAttr(a.key)}">
            <div class="achievement-header">
                <span class="achievement-icon">${icon}</span>
                <div class="achievement-info">
                    <span class="achievement-title">${escapeHTML(t(a.key))}</span>
                    <span class="achievement-desc">${escapeHTML(t(a.key + 'Desc'))}</span>
                    ${dateStr ? `<span class="achievement-date">${dateStr}</span>` : ''}
                    ${progressHTML}
                </div>
                <button class="achievement-expand-btn" aria-label="expand">${svg.chevron}</button>
            </div>
            <div class="achievement-body">
                <div class="achievement-body-inner">
                    <div class="achievement-flavor-block">
                        <div class="achievement-section-label">${escapeHTML(t('achFlavorLabel'))}</div>
                        <div class="${flavorClass}">${flavorText}</div>
                    </div>
                    <div class="achievement-info-block">
                        <div class="achievement-section-label">${escapeHTML(t('achInfoLabel'))}</div>
                        <div class="achievement-real-info">${escapeHTML(t(a.key + 'Info'))}</div>
                    </div>
                </div>
            </div>
        </div>
    `}).join('');

    el.querySelectorAll('.achievement').forEach(card => {
        card.addEventListener('click', () => {
            const body = card.querySelector('.achievement-body');
            const expanded = card.classList.toggle('expanded');
            body.style.maxHeight = expanded ? body.scrollHeight + 'px' : '0';
        });
    });
}

function renderRatingDistribution(byRating) {
    const el = document.getElementById('statsRatingDist');
    if (!el) return;
    const total = Object.values(byRating || {}).reduce((s, v) => s + v, 0);
    if (total === 0) {
        el.innerHTML = `<div class="stats-empty-state">${ICONS.star}<p>${t('statsNoRatingData')}</p></div>`;
        return;
    }
    const maxCount = Math.max(...Object.values(byRating), 1);
    let html = '';
    for (let r = 10; r >= 1; r--) {
        const count = byRating[r] || 0;
        const pct = (count / maxCount * 100).toFixed(1);
        html += `
        <div class="stats-bar-row">
            <span class="stats-bar-label">${r}</span>
            <div class="stats-bar-track">
                <div class="stats-bar-fill" style="width: ${pct}%; background: var(--accent);"></div>
            </div>
            <span class="stats-bar-count">${count}</span>
        </div>`;
    }
    el.innerHTML = html;
}

function renderTopTags(topTags) {
    const el = document.getElementById('statsTopTags');
    if (!el) return;
    if (!topTags || topTags.length === 0) {
        el.innerHTML = `<div class="stats-empty-state">${ICONS.tag}<p>${t('statsNoTagData')}</p></div>`;
        return;
    }
    const maxCount = topTags[0].count || 1;
    el.innerHTML = topTags.map(({ tag, count }) => {
        const pct = (count / maxCount * 100).toFixed(1);
        return `
        <div class="stats-bar-row">
            <span class="stats-bar-label">${escapeHTML(tag)}</span>
            <div class="stats-bar-track">
                <div class="stats-bar-fill" style="width: ${pct}%; background: var(--accent);"></div>
            </div>
            <span class="stats-bar-count">${count}</span>
        </div>`;
    }).join('');
}

function renderCategoryRatings(categoryAvgs) {
    const el = document.getElementById('statsCategoryRatings');
    if (!el) return;
    const cats = [
        { label: t('storyRating'),     val: categoryAvgs?.story },
        { label: t('artRating'),       val: categoryAvgs?.art },
        { label: t('musicRating'),     val: categoryAvgs?.music },
        { label: t('characterRating'), val: categoryAvgs?.character },
    ];
    if (!cats.some(c => c.val != null)) {
        el.innerHTML = `<div class="stats-empty-state">${ICONS.barChart3}<p>${t('statsNoCategoryData')}</p></div>`;
        return;
    }
    const colors = ['var(--status-reading)', 'var(--status-completed)', 'var(--status-onhold)', 'var(--status-dropped)'];
    el.innerHTML = cats.map(({ label, val }, i) => {
        const pct = val != null ? (val / 10 * 100).toFixed(1) : 0;
        const display = val != null ? val.toFixed(1) : '—';
        return `
        <div class="stats-bar-row">
            <span class="stats-bar-label">${label}</span>
            <div class="stats-bar-track">
                <div class="stats-bar-fill" style="width: ${pct}%; background: ${colors[i]};"></div>
            </div>
            <span class="stats-bar-count">${display}</span>
        </div>`;
    }).join('');
}
