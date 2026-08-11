let _ctxMenu = null;

function showContextMenu(x, y, entry) {
    hideContextMenu();

    const isRunning = state.runningGames.has(entry.id);
    const statusLabels = getStatusLabels();

    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    menu.setAttribute('role', 'menu');

    menu.appendChild(ctxItem(
        isRunning ? t('running') : t('launch'),
        ICONS.play,
        () => { if (!isRunning) send('launchVn', { id: entry.id }); },
        isRunning ? 'disabled' : ''
    ));

    menu.appendChild(ctxSep());

    menu.appendChild(ctxItem(
        t('favorite') + (entry.isFavorite ? ' ✓' : ''),
        ICONS.heart,
        () => { send('toggleFavorite', { id: entry.id }); }
    ));

    menu.appendChild(ctxItem(
        t('pin') + (entry.isPinned ? ' ✓' : ''),
        ICONS.pin,
        () => { send('togglePin', { id: entry.id }); }
    ));

    menu.appendChild(ctxSep());

    const statusSub = document.createElement('div');
    statusSub.className = 'ctx-submenu';

    const statusTrigger = document.createElement('div');
    statusTrigger.className = 'ctx-menu-item';
    statusTrigger.innerHTML = `
        ${ICONS.clock}
        <span>${t('status')}</span>
        <span style="margin-left:auto;opacity:0.5">▸</span>
    `;
    statusSub.appendChild(statusTrigger);

    const subList = document.createElement('div');
    subList.className = 'ctx-sub-list';
    statusLabels.forEach((label, i) => {
        const item = ctxItem(
            label + (entry.status === i ? ' ✓' : ''),
            '',
            () => { send('setStatus', { id: entry.id, status: i }); }
        );
        subList.appendChild(item);
    });
    statusSub.appendChild(subList);
    menu.appendChild(statusSub);

    if (state.groups && state.groups.length > 0) {
        const groupSub = document.createElement('div');
        groupSub.className = 'ctx-submenu';

        const groupTrigger = document.createElement('div');
        groupTrigger.className = 'ctx-menu-item';
        groupTrigger.innerHTML = `
            ${ICONS.folder}
            <span>${t('setGroup')}</span>
            <span style="margin-left:auto;opacity:0.5">▸</span>
        `;
        groupSub.appendChild(groupTrigger);

        const gSubList = document.createElement('div');
        gSubList.className = 'ctx-sub-list';


        gSubList.appendChild(ctxItem(
            t('noGroup') + (!entry.groupId ? ' ✓' : ''),
            '',
            () => { send('setVnGroup', { id: entry.id, groupId: null }); }
        ));

        state.groups.forEach(g => {
            gSubList.appendChild(ctxItem(
                g.name + (entry.groupId === g.id ? ' ✓' : ''),
                `<span class="group-dot" style="background:${escapeAttr(g.color)}"></span>`,
                () => { send('setVnGroup', { id: entry.id, groupId: g.id }); }
            ));
        });

        groupSub.appendChild(gSubList);
        menu.appendChild(groupSub);
    }

    menu.appendChild(ctxSep());

    if (state.settings?.vndbEnabled !== false) {
        menu.appendChild(ctxItem(
            t('refreshMetadata') || 'Refresh Metadata',
            ICONS.refresh,
            () => { send('refreshMetadata', { id: entry.id }); }
        ));
    }

    if (entry.exePath) {
        menu.appendChild(ctxItem(
            t('openFolder'),
            ICONS.folder,
            () => { send('openFolder', { id: entry.id }); }
        ));
    }

    menu.appendChild(ctxItem(
        t('delete'),
        ICONS.trash,
        () => {
            openDetail(entry);
            document.getElementById('deleteModal').style.display = '';
        },
        'danger'
    ));

    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    document.body.appendChild(menu);

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';

    _ctxMenu = menu;

    setTimeout(() => document.addEventListener('click', hideContextMenu, { once: true }), 0);
}

function hideContextMenu() {
    if (_ctxMenu) {
        _ctxMenu.remove();
        _ctxMenu = null;
    }
}

function ctxItem(label, icon, onClick, cls) {
    const el = document.createElement('div');
    el.className = 'ctx-menu-item' + (cls ? ` ${cls}` : '');
    el.setAttribute('role', 'menuitem');
    el.setAttribute('tabindex', '-1');
    el.innerHTML = (icon ? icon + ' ' : '') + `<span>${escapeHTML(label)}</span>`;
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        hideContextMenu();
        if (onClick) onClick();
    });
    return el;
}

function ctxSep() {
    const el = document.createElement('div');
    el.className = 'ctx-menu-sep';
    return el;
}
