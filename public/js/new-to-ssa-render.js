(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        renderTerms();
        renderCategories();
        renderOrgs();
        setupViewAllCollaborators();
    });

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    // ---- 02 Understanding SSA — click-to-expand term cards ----
    function renderTerms() {
        const el = document.getElementById('term-grid');
        if (!el || typeof SSA_TERMS === 'undefined') return;

        el.innerHTML = SSA_TERMS.map((t, i) => `
            <div class="term-card" data-term-index="${i}">
                <div class="term-card-head">
                    <span>${escapeHtml(t.term)}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="term-chevron"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <div class="term-definition">${escapeHtml(t.definition)}</div>
            </div>`).join('');

        el.querySelectorAll('.term-card').forEach((card) => {
            card.addEventListener('click', () => card.classList.toggle('open'));
        });
    }

    // ---- 03 Learn & Explore — expandable category cards ----
    function renderCategories() {
        const el = document.getElementById('category-row');
        if (!el || typeof SSA_CATEGORIES === 'undefined') return;

        el.innerHTML = SSA_CATEGORIES.map((cat) => `
            <div class="category-card" data-category-id="${cat.id}">
                <button type="button" class="category-card-head" aria-expanded="false">
                    <span class="category-icon">${cat.icon}</span>
                    <span class="category-title-wrap">
                        <span class="category-title">${escapeHtml(cat.title)}</span>
                        <span class="category-count">${cat.items.length} resource${cat.items.length === 1 ? '' : 's'}</span>
                    </span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="category-chevron"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="category-body">
                    <div class="category-items">
                        ${cat.items.map((item) => `
                            <div class="category-item">
                                <span class="category-item-title">${escapeHtml(item.title)}${item.isPlaceholder ? ' <span class="placeholder-badge">Sample</span>' : ''}</span>
                                <span class="category-item-meta">${escapeHtml(item.meta)}</span>
                            </div>`).join('')}
                        <div class="category-add-tile">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            More resources coming soon
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

    // ---- 04 The SSA Ecosystem — click a badge, detail appears below ----
    function renderOrgs() {
        const row = document.getElementById('org-row');
        const panel = document.getElementById('org-detail-panel');
        if (!row || !panel || typeof SSA_ORGS === 'undefined') return;

        row.innerHTML = SSA_ORGS.map((org, i) => `
            <button type="button" class="org-badge${i === 0 ? ' active' : ''}" data-org-id="${org.id}">${escapeHtml(org.name)}</button>
        `).join('');

        function showOrg(org) {
            panel.innerHTML = `<strong>${escapeHtml(org.name)}</strong>${escapeHtml(org.detail)}`;
            panel.hidden = false;
        }

        row.querySelectorAll('.org-badge').forEach((btn) => {
            btn.addEventListener('click', () => {
                row.querySelectorAll('.org-badge').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                const org = SSA_ORGS.find((o) => o.id === btn.getAttribute('data-org-id'));
                if (org) showOrg(org);
            });
        });

        // Show the first org's detail by default so the panel isn't empty
        // on load.
        if (SSA_ORGS.length) showOrg(SSA_ORGS[0]);
    }

    // "View All Collaborators" — reveals the broader ecosystem note rather
    // than navigating anywhere (there's no dedicated collaborators page
    // yet; this keeps the interaction honest about what actually exists).
    function setupViewAllCollaborators() {
        const btn = document.getElementById('view-all-collaborators');
        const expand = document.getElementById('ecosystem-expand');
        if (!btn || !expand || typeof SSA_ECOSYSTEM_NOTE === 'undefined') return;

        btn.addEventListener('click', () => {
            const isOpen = !expand.hidden;
            if (isOpen) {
                expand.hidden = true;
                btn.textContent = 'View All Collaborators';
            } else {
                expand.textContent = SSA_ECOSYSTEM_NOTE;
                expand.hidden = false;
                btn.textContent = 'Hide';
            }
        });
    }
})();