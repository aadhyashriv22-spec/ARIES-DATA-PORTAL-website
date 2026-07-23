let activeMirror = null;
let navStack = [];

const ICONS = {
    folder: `<svg class="file-icon folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>`,
    fits: `<svg class="file-icon fits" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="12" cy="15" r="2"/></svg>`,
    excel: `<svg class="file-icon excel" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="16" y2="16"/><line x1="11" y1="12" x2="11" y2="20"/></svg>`,
    pdf: `<svg class="file-icon pdf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    image: `<svg class="file-icon image" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    file: `<svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    download: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`
};

const MIRROR_NAMES = {
    gdrive: 'Mirror 1',
    onedrive: 'Mirror 2',
    local: 'Mirror 3'
};

function selectMirror(mirror) {
    activeMirror = mirror;
    navStack = [];

    document.querySelectorAll('.mirror-btn').forEach((button) => button.classList.remove('active'));

    const mirrorButtonIndex = { gdrive: 0, onedrive: 1, local: 2 };
    const selectedButton = document.querySelectorAll('.mirror-btn')[mirrorButtonIndex[mirror]];

    if (selectedButton) {
        selectedButton.classList.add('active');
    }

    loadRoot();
}

function loadRoot() {
    navStack = [];
    updateBreadcrumb();

    if (activeMirror === 'gdrive') {
        loadFiles('/gdrive/list/root', 'gdrive');
        return;
    }

    if (activeMirror === 'onedrive') {
        loadFiles('/onedrive/list/root', 'onedrive');
        return;
    }

    if (activeMirror === 'local') {
        loadFiles('/local/list', 'local');
    }
}

async function loadFiles(url, mirror) {
    const filesContainer = document.getElementById('files');
    filesContainer.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const response = await fetch(url, {
            headers: {
                Accept: 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(await readErrorMessage(response));
        }

        const files = await response.json();
        renderFiles(files, mirror);
    } catch (error) {
        filesContainer.innerHTML = `<div class="empty">${escapeHtml(error.message || 'Failed to load files.')}</div>`;
    }
}

function renderFiles(files, mirror) {
    const filesContainer = document.getElementById('files');

    if (!Array.isArray(files) || files.length === 0) {
        filesContainer.innerHTML = '<div class="empty">No files found.</div>';
        return;
    }

    files.sort((a, b) => {
        const aIsFolder = String(a.mimeType || '').includes('folder');
        const bIsFolder = String(b.mimeType || '').includes('folder');

        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;
        return String(a.name || '').localeCompare(String(b.name || ''));
    });

    let html = '';

    files.forEach((file) => {
        const isFolder = String(file.mimeType || '').includes('folder');
        const icon = isFolder ? ICONS.folder : getIcon(file.name);
        const size = file.size !== null && file.size !== undefined ? formatSize(Number(file.size)) : '';

        if (isFolder) {
            const folderIdentifier = JSON.stringify(file.id || file.path);
            const folderName = JSON.stringify(file.name);

            html += `
            <div class="file-row">
                <div class="file-info">
                    ${icon}
                    <div>
                        <div class="folder-name" onclick='openFolder(${folderIdentifier}, ${folderName})'>${file.name}</div>
                    </div>
                </div>
            </div>`;
            return;
        }

        const downloadUrl = getDownloadUrl(file, mirror);
        html += `
        <div class="file-row">
            <div class="file-info">
                ${icon}
                <div>
                    <div>${file.name}</div>
                    <div class="file-size">${size}</div>
                </div>
            </div>
            <a href="${downloadUrl}"><button class="dl-btn">${ICONS.download} Download</button></a>
        </div>`;
    });

    filesContainer.innerHTML = html;
}

function openFolder(idOrPath, name) {
    navStack.push({ id: idOrPath, name });
    updateBreadcrumb();
    loadCurrentFolder(idOrPath);
}

function goBack(index) {
    navStack = navStack.slice(0, index);
    updateBreadcrumb();

    if (navStack.length === 0) {
        loadRoot();
        return;
    }

    const current = navStack[navStack.length - 1];
    loadCurrentFolder(current.id);
}

function updateBreadcrumb() {
    const breadcrumb = document.getElementById('breadcrumb');

    if (!activeMirror) {
        breadcrumb.style.display = 'none';
        breadcrumb.innerHTML = '';
        return;
    }

    breadcrumb.style.display = 'flex';

    let html = `<span onclick="goBack(0)">${MIRROR_NAMES[activeMirror]}</span>`;

    navStack.forEach((item, index) => {
        html += ` <span aria-hidden="true">&rsaquo;</span> <span onclick="goBack(${index + 1})">${item.name}</span>`;
    });

    breadcrumb.innerHTML = html;
}

function getDownloadUrl(file, mirror) {
    if (mirror === 'gdrive') {
        return `/gdrive/download/${encodeURIComponent(file.id)}`;
    }

    if (mirror === 'onedrive') {
        return `/onedrive/download/${encodeURIComponent(file.id)}`;
    }

    if (mirror === 'local') {
        return `/local/download?path=${encodeURIComponent(file.path)}`;
    }

    return '#';
}

function loadCurrentFolder(idOrPath) {
    if (activeMirror === 'gdrive') {
        loadFiles(`/gdrive/list/${encodeURIComponent(idOrPath)}`, 'gdrive');
        return;
    }

    if (activeMirror === 'onedrive') {
        loadFiles(`/onedrive/list/${encodeURIComponent(idOrPath)}`, 'onedrive');
        return;
    }

    if (activeMirror === 'local') {
        loadFiles(`/local/list?path=${encodeURIComponent(idOrPath)}`, 'local');
    }
}

function getIcon(name) {
    const lowerName = String(name || '').toLowerCase();

    if (lowerName.endsWith('.fits') || lowerName.endsWith('.fit')) return ICONS.fits;
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) return ICONS.excel;
    if (lowerName.endsWith('.pdf')) return ICONS.pdf;
    if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.svg')) return ICONS.image;
    return ICONS.file;
}

function formatSize(bytes) {
    const numericBytes = Number(bytes);

    if (!Number.isFinite(numericBytes)) {
        return '';
    }

    if (numericBytes < 1024) return `${numericBytes} B`;
    if (numericBytes < 1024 * 1024) return `${(numericBytes / 1024).toFixed(1)} KB`;
    return `${(numericBytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readErrorMessage(response) {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        try {
            const data = await response.json();

            if (data && typeof data.error === 'string' && data.error.trim()) {
                return data.error;
            }
        } catch (error) {
            // Fall back to text below.
        }
    }

    const text = await response.text();
    return text || `Request failed (${response.status})`;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
