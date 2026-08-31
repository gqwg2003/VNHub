const LANG = {
    en: LANG_EN,
    ru: LANG_RU,
    ja: LANG_JA,
    zh: LANG_ZH,
};

let currentLang = 'en';

function t(key) {
    return LANG[currentLang]?.[key] || LANG.en[key] || key;
}

function tp(key, count) {
    let form;
    if (currentLang === 'ru') {
        const n = Math.abs(count) % 100;
        const n10 = n % 10;
        if (n10 === 1 && n !== 11) form = 'one';
        else if (n10 >= 2 && n10 <= 4 && (n < 12 || n > 14)) form = 'few';
        else form = 'many';
    } else {
        form = count === 1 ? 'one' : 'other';
    }
    return t(`${key}_${form}`) || t(key);
}

function setLanguage(lang) {
    currentLang = lang;
    applyLanguage();
}

function getStatusLabels() {
    return [t('statusReading'), t('statusCompleted'), t('statusOnHold'), t('statusDropped'), t('statusPlanToRead')];
}

function applyLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (key) el.textContent = t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.dataset.i18nPlaceholder;
        if (key) el.placeholder = t(key);
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        const tab = btn.dataset.tab;
        const span = btn.querySelector('span');
        if (span && tab) span.textContent = t(tab);
    });

    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.textContent = t(btn.dataset.theme);
    });

    document.querySelectorAll('.detail-field').forEach(field => {
        const label = field.querySelector('label');
        if (!label) return;
        if (field.querySelector('#detailTitle')) label.textContent = t('title');
        else if (field.querySelector('#detailStatus')) label.textContent = t('status');
        else if (field.querySelector('#detailNotes')) { label.textContent = t('notes'); const n = field.querySelector('#detailNotes'); if (n) n.placeholder = t('notesPlaceholder'); }
        else if (field.querySelector('#tagsContainer')) label.textContent = t('tags');
        else if (field.querySelector('#detailDate')) label.textContent = t('dateAdded');
        else if (field.querySelector('#detailExe')) label.textContent = t('executable');
        else if (field.querySelector('#detailPlayTime')) label.textContent = t('playTime');
        else if (field.querySelector('#detailLastLaunched')) label.textContent = t('lastLaunched');
    });

    const detailFavSpan = document.querySelector('#detailFav span');
    const detailPinSpan = document.querySelector('#detailPin span');
    if (detailFavSpan) detailFavSpan.textContent = t('favorite');
    if (detailPinSpan) detailPinSpan.textContent = t('pin');

    const browseExe = document.getElementById('btnBrowseExe');
    if (browseExe) browseExe.textContent = t('browse');
    const changeCover = document.getElementById('btnChangeCover');
    if (changeCover) changeCover.textContent = t('changeCover');
    const deleteVn = document.getElementById('btnDeleteVn');
    if (deleteVn) deleteVn.textContent = t('deleteEntry');
    const tagInput = document.getElementById('detailTagInput');
    if (tagInput) tagInput.placeholder = t('tagPlaceholder');

    const detailStatus = document.getElementById('detailStatus');
    if (detailStatus) {
        const labels = getStatusLabels();
        detailStatus.querySelectorAll('option').forEach((opt, i) => {
            if (labels[i]) opt.textContent = labels[i];
        });
    }

    if (typeof renderGrid === 'function') renderGrid();
    if (typeof renderGroupsSidebar === 'function') renderGroupsSidebar();
}
