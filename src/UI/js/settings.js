function initSettings() {
    document.querySelectorAll('.settings-tab').forEach(tab => {
        if (tab.dataset.bound) return;
        tab.dataset.bound = '1';
        tab.addEventListener('click', () => {
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const content = document.querySelector(`.settings-tab-content[data-tab-content="${tab.dataset.tab}"]`);
            if (content) content.classList.add('active');
        });
    });

    document.querySelectorAll('.theme-btn').forEach(btn => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.settings.theme = btn.dataset.theme;
            applyTheme(btn.dataset.theme);
            saveSettingsFromUI();
        });
    });

    bindOnce(document.getElementById('btnPickDefaultFolder'), 'click', () => {
        state.pickTarget = 'settings';
        send('pickFolder');
    });

    bindOnce(document.getElementById('btnOpenDbFolder'), 'click', () => {
        send('openDbFolder');
    });

    bindOnce(document.getElementById('settingsProxy'), 'change', (e) => {
        const val = e.target.value.trim();
        if (val && !/^https?:\/\/.+:\d+/.test(val)) {
            showToast(t('invalidProxy') || 'Invalid proxy format. Use http://host:port', 'error');
            return;
        }
        state.settings.proxyAddress = val;
        saveSettingsFromUI();
    });

    bindOnce(document.getElementById('settingsLanguage'), 'change', (e) => {
        state.settings.language = e.target.value;
        setLanguage(e.target.value);
        saveSettingsFromUI();
        document.getElementById('langMachineTranslationHint').style.display = ['ja', 'zh'].includes(e.target.value) ? '' : 'none';
    });

    bindOnce(document.getElementById('btnExportLibrary'), 'click', () => {
        send('exportLibrary');
    });

    bindOnce(document.getElementById('btnImportLibrary'), 'click', () => {
        send('importLibrary');
    });

    bindOnce(document.getElementById('btnExportCsv'), 'click', () => {
        send('exportCsv');
    });

    bindOnce(document.getElementById('btnExportHtml'), 'click', () => {
        send('exportHtml');
    });

    bindOnce(document.getElementById('btnExportJson'), 'click', () => {
        send('exportJson');
    });

    bindOnce(document.getElementById('btnExportSettings'), 'click', () => {
        send('exportSettings');
    });

    bindOnce(document.getElementById('btnImportSettings'), 'click', async () => {
        const ok = await showConfirmModal(t('importSettings'), t('importSettingsConfirm'));
        if (!ok) return;
        send('importSettings');
    });

    bindOnce(document.getElementById('settingsVndb'), 'change', (e) => {
        state.settings.vndbEnabled = e.target.checked;
        saveSettingsFromUI();
    });

    bindOnce(document.getElementById('settingsMetadataProvider'), 'change', (e) => {
        const val = e.target.value;
        state.settings.metadataProvider = val;
        toggleProviderCredentials(val);
        saveSettingsFromUI();
    });

    bindOnce(document.getElementById('settingsIgdbClientId'), 'change', (e) => {
        state.settings.igdbClientId = e.target.value.trim();
        saveSettingsFromUI();
    });

    bindOnce(document.getElementById('settingsIgdbClientSecret'), 'change', (e) => {
        state.settings.igdbClientSecret = e.target.value.trim();
        saveSettingsFromUI();
    });

    bindOnce(document.getElementById('settingsRawgApiKey'), 'change', (e) => {
        state.settings.rawgApiKey = e.target.value.trim();
        saveSettingsFromUI();
    });

    bindOnce(document.getElementById('settingsAutoStart'), 'change', (e) => {
        state.settings.autoStart = e.target.checked;
        send('setAutoStart', { enabled: e.target.checked });
        saveSettingsFromUI();
    });

    bindOnce(document.getElementById('settingsMinimizeToTray'), 'change', (e) => {
        state.settings.minimizeToTray = e.target.checked;
        saveSettingsFromUI();
    });

    bindOnce(document.getElementById('settingsStartMinimized'), 'change', (e) => {
        state.settings.startMinimized = e.target.checked;
        saveSettingsFromUI();
    });

    bindOnce(document.getElementById('btnBackupNow'), 'click', () => {
        send('backupNow');
    });

    bindOnce(document.getElementById('btnShowBackups'), 'click', () => {
        const list = document.getElementById('backupList');
        if (list.style.display === 'none') {
            send('getBackups');
            list.style.display = '';
        } else {
            list.style.display = 'none';
        }
    });

    bindOnce(document.getElementById('settingsBackupInterval'), 'change', (e) => {
        state.settings.backupInterval = e.target.value;
        saveSettingsFromUI();
    });

    bindOnce(document.getElementById('settingsMaxBackups'), 'change', (e) => {
        state.settings.maxBackups = parseInt(e.target.value) || 5;
        saveSettingsFromUI();
    });

    bindOnce(document.getElementById('btnOpenCoversFolder'), 'click', () => {
        send('openCoversFolder');
    });

    bindOnce(document.getElementById('btnOpenLogsFolder'), 'click', () => {
        send('openLogsFolder');
    });

    bindOnce(document.getElementById('btnViewLogs'), 'click', () => {
        const viewer = document.getElementById('logViewer');
        if (viewer && !viewer.hidden) {
            viewer.hidden = true;
            return;
        }
        send('readLogs');
    });

    bindOnce(document.getElementById('btnClearLogs'), 'click', async () => {
        const ok = await showConfirmModal(t('clearLogs'), t('clearLogsConfirm'), t('delete') || 'Delete');
        if (!ok) return;
        send('clearLogs');
    });

    bindOnce(document.getElementById('settingsScanBlacklistExe'), 'change', (e) => {
        state.settings.scanBlacklistExe = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
        saveSettingsFromUI();
    });
    bindOnce(document.getElementById('settingsScanBlacklistDirs'), 'change', (e) => {
        state.settings.scanBlacklistDirs = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
        saveSettingsFromUI();
    });
    bindOnce(document.getElementById('settingsScanSortBy'), 'change', (e) => {
        state.settings.scanSortBy = e.target.value;
        saveSettingsFromUI();
    });
    bindOnce(document.getElementById('settingsScanSortDir'), 'change', (e) => {
        state.settings.scanSortDir = e.target.value;
        saveSettingsFromUI();
    });
    bindOnce(document.getElementById('settingsScanSkipExisting'), 'change', (e) => {
        state.settings.scanSkipExisting = e.target.checked;
        saveSettingsFromUI();
    });
    bindOnce(document.getElementById('settingsScanRecursive'), 'change', (e) => {
        state.settings.scanRecursive = e.target.checked;
        saveSettingsFromUI();
    });

    bindOnce(document.getElementById('btnResetSettings'), 'click', async () => {
        const ok = await showConfirmModal(t('resetSettings'), t('resetSettingsConfirm'));
        if (!ok) return;
        const preserved = {
            dbPath: state.settings.dbPath,
            coversPath: state.settings.coversPath,
            logsPath: state.settings.logsPath,
            windowX: state.settings.windowX,
            windowY: state.settings.windowY,
            windowWidth: state.settings.windowWidth,
            windowHeight: state.settings.windowHeight,
            windowMaximized: state.settings.windowMaximized
        };
        state.settings = {
            theme: 'dark',
            defaultFolder: '',
            language: 'en',
            vndbEnabled: true,
            autoStart: false,
            minimizeToTray: false,
            startMinimized: false,
            maxBackups: 5,
            backupInterval: 'startup',
            shortcuts: {},
            proxyAddress: '',
            metadataProvider: 'vndb',
            igdbClientId: '',
            igdbClientSecret: '',
            rawgApiKey: '',
            sortBy: 'title',
            sortDir: 'asc',
            gridSize: 'medium',
            scanBlacklistExe: [],
            scanBlacklistDirs: [],
            scanSortBy: 'title',
            scanSortDir: 'asc',
            scanSkipExisting: true,
            scanRecursive: false,
            ...preserved
        };
        applyTheme('dark');
        setLanguage('en');
        state.sortBy = 'title';
        state.sortDir = 'asc';
        state.gridSize = 'medium';
        restoreSortAndGridUI();
        renderSettings();
        saveSettingsFromUI();
        send('setAutoStart', { enabled: false });
        showToast(t('resetSettingsDone'), 'success');
    });

    initShortcutButtons();
    if (typeof initCustomization === 'function') initCustomization();
}

function renderSettings() {
    const s = state.settings;
    document.getElementById('settingsDefaultFolder').value = s.defaultFolder || '';
    document.getElementById('settingsDbPath').value = s.dbPath || '';
    document.getElementById('settingsCoversPath').value = s.coversPath || '';
    document.getElementById('settingsLanguage').value = s.language || 'en';
    document.getElementById('langMachineTranslationHint').style.display = (s.language === 'ja' || s.language === 'zh') ? '' : 'none';
    document.querySelectorAll('.theme-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.theme === s.theme);
    });
    document.getElementById('settingsVndb').checked = s.vndbEnabled !== false;
    const provider = s.metadataProvider || 'vndb';
    document.getElementById('settingsMetadataProvider').value = provider;
    toggleProviderCredentials(provider);
    document.getElementById('settingsIgdbClientId').value = s.igdbClientId || '';
    document.getElementById('settingsIgdbClientSecret').value = s.igdbClientSecret || '';
    document.getElementById('settingsRawgApiKey').value = s.rawgApiKey || '';
    document.getElementById('settingsAutoStart').checked = s.autoStart === true;
    document.getElementById('settingsMinimizeToTray').checked = s.minimizeToTray === true;
    document.getElementById('settingsStartMinimized').checked = s.startMinimized === true;
    document.getElementById('settingsBackupInterval').value = s.backupInterval || 'startup';
    document.getElementById('settingsMaxBackups').value = s.maxBackups || 5;
    document.getElementById('settingsProxy').value = s.proxyAddress || '';

    document.getElementById('settingsScanBlacklistExe').value = (s.scanBlacklistExe || []).join('\n');
    document.getElementById('settingsScanBlacklistDirs').value = (s.scanBlacklistDirs || []).join('\n');
    document.getElementById('settingsScanSortBy').value = s.scanSortBy || 'title';
    document.getElementById('settingsScanSortDir').value = s.scanSortDir || 'asc';
    document.getElementById('settingsScanSkipExisting').checked = s.scanSkipExisting !== false;
    document.getElementById('settingsScanRecursive').checked = s.scanRecursive === true;
    renderShortcutButtons();
    if (typeof renderCustomization === 'function') renderCustomization();
    const verEl = document.getElementById('appVersionDisplay');
    if (verEl && s.appVersion) verEl.textContent = s.appVersion;
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme || 'dark');
    if (typeof applyCustomization === 'function') applyCustomization();
    if (typeof renderCustomColors === 'function') renderCustomColors();
}

function toggleProviderCredentials(provider) {
    document.getElementById('igdbCredentialsGroup').style.display = provider === 'igdb' ? '' : 'none';
    document.getElementById('rawgCredentialsGroup').style.display = provider === 'rawg' ? '' : 'none';
}

function saveSettingsFromUI() {
    state.settings.defaultFolder = document.getElementById('settingsDefaultFolder').value;
    send('saveSettings', state.settings);
}

const DEFAULT_SHORTCUTS = {
    addVn: 'Ctrl+N',
    search: 'Ctrl+F',
    delete: 'Delete'
};

function getShortcuts() {
    const custom = state.settings.shortcuts || {};
    return { ...DEFAULT_SHORTCUTS, ...custom };
}

function initShortcutButtons() {
    document.querySelectorAll('.shortcut-key-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.shortcut-key-btn.recording').forEach(b => {
                b.classList.remove('recording');
            });
            btn.classList.add('recording');
            btn.innerHTML = '<kbd>...</kbd>';

            const downHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                if (e.key === 'Escape' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                    cleanup();
                    renderShortcutButtons();
                    return;
                }

                if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

                const parts = [];
                if (e.ctrlKey) parts.push('Ctrl');
                if (e.shiftKey) parts.push('Shift');
                if (e.altKey) parts.push('Alt');
                const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
                parts.push(key);

                const combo = parts.join('+');
                const action = btn.dataset.action;
                if (!state.settings.shortcuts) state.settings.shortcuts = {};
                state.settings.shortcuts[action] = combo;
                saveSettingsFromUI();
                cleanup();
                renderShortcutButtons();
            };

            const cleanup = () => {
                btn.classList.remove('recording');
                document.removeEventListener('keydown', downHandler, true);
            };

            document.addEventListener('keydown', downHandler, true);
        });
    });
}

function renderShortcutButtons() {
    const sc = getShortcuts();
    document.querySelectorAll('.shortcut-key-btn').forEach(btn => {
        const action = btn.dataset.action;
        const combo = sc[action] || '';
        btn.innerHTML = combo.split('+').map(k => `<kbd>${k}</kbd>`).join('+');
    });
}

function shortcutMatches(action, e) {
    const sc = getShortcuts();
    const combo = sc[action];
    if (!combo) return false;
    const parts = combo.split('+');
    const needCtrl = parts.includes('Ctrl');
    const needShift = parts.includes('Shift');
    const needAlt = parts.includes('Alt');
    const key = parts.filter(p => !['Ctrl', 'Shift', 'Alt'].includes(p))[0];
    if (!key) return false;
    if (needCtrl !== e.ctrlKey) return false;
    if (needShift !== e.shiftKey) return false;
    if (needAlt !== e.altKey) return false;
    const eKey = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    return eKey === key;
}
