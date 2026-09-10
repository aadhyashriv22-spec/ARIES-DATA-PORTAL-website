(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        renderCategoryRow('conf-ppt-row', [
            { id: 'conferences', title: 'Conference Presentations', icon: ICON_PRESENTATION, items: typeof TEAM_CONFERENCES !== 'undefined' ? TEAM_CONFERENCES : [] },
            { id: 'ppts', title: 'Technical PPTs', icon: ICON_SLIDES, items: typeof TEAM_PPTS !== 'undefined' ? TEAM_PPTS : [] }
        ]);
        renderCategoryRow('meetings-row', [
            { id: 'meetings', title: 'Upcoming Meetings', icon: ICON_CALENDAR, items: typeof TEAM_MEETINGS !== 'undefined' ? TEAM_MEETINGS : [] }
        ]);
        renderBrainstormSessions();
    });

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    const ICON_PRESENTATION = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
    const ICON_SLIDES = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>';
    const ICON_CALENDAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

    // Builds one or more accordion .category-card entries inside the
    // .category-row with the given id — same markup/CSS as new-to-ssa's
    // renderCategories(), extended so an item with a real `url` or
    // `fileUrl` renders as an actual link instead of a static row.
    function renderCategoryRow(rowId, categories) {
        const el = document.getElementById(rowId);
        if (!el) return;

        el.innerHTML = categories.map((cat) => `
            <div class="category-card" data-category-id="${cat.id}">
                <button type="button" class="category-card-head" aria-expanded="false">
                    <span class="category-icon">${cat.icon}</span>
                    <span class="category-title-wrap">
                        <span class="category-title">${escapeHtml(cat.title)}</span>
                        <span class="category-count">${cat.items.length} item${cat.items.length === 1 ? '' : 's'}</span>
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="category-chevron"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="category-body">
                    <div class="category-items">
                        ${cat.items.map((item) => renderCategoryItem(item)).join('')}
                        <div class="category-add-tile">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            More coming soon
                        </div>
                    </div>
                </div>
            </div>`).join('');

        el.querySelectorAll('.category-card-head').forEach((btn) => {
            btn.addEventListener('click', () => {
                const card = btn.closest('.category-card');
                const isOpen = card.classList.toggle('open');
                btn.setAttribute('aria-expanded', String(isOpen));
            });
        });
    }

    function renderCategoryItem(item) {
        const href = item.url || item.fileUrl;
        const actionLabel = item.url ? 'View \u2192' : (item.fileUrl ? 'Download \u2192' : '');
        const titleHtml = `${escapeHtml(item.title)}${item.isPlaceholder ? ' <span class="placeholder-badge">Sample</span>' : ''}`;
        // meta + action grouped together so the row still reads as
        // "title on the left, everything else on the right" (matching
        // .category-item's existing 2-child space-between layout) even
        // when a third piece (the action label) is present.
        const trailing = actionLabel
            ? `<span class="category-item-trailing"><span class="category-item-meta">${escapeHtml(item.meta)}</span><span class="category-item-action">${actionLabel}</span></span>`
            : `<span class="category-item-meta">${escapeHtml(item.meta)}</span>`;
        const inner = `<span class="category-item-title">${titleHtml}</span>${trailing}`;

        if (href) {
            const external = item.url ? ' target="_blank" rel="noopener"' : '';
            return `<a class="category-item" href="${escapeHtml(href)}"${external}>${inner}</a>`;
        }
        return `<div class="category-item">${inner}</div>`;
    }

    // Brainstorming sessions — reuses the exact same click-to-expand
    // .term-card component new-to-ssa.html uses for SSA_TERMS.
    function renderBrainstormSessions() {
        const el = document.getElementById('brainstorm-grid');
        if (!el || typeof TEAM_BRAINSTORM_SESSIONS === 'undefined') return;

        el.innerHTML = TEAM_BRAINSTORM_SESSIONS.map((s, i) => `
            <div class="term-card" data-session-index="${i}">
                <div class="term-card-head">
                    <span>${escapeHtml(s.term)}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="term-chevron"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <div class="term-definition">${escapeHtml(s.definition)}</div>
            </div>`).join('');

        el.querySelectorAll('.term-card').forEach((card) => {
            card.addEventListener('click', () => card.classList.toggle('open'));
        });
    }
})();