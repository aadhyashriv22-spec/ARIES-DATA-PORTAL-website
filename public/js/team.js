(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        renderLeadership();
        renderProjects();
        renderSidebar();
        renderGrid('all');
    });

    function getInitials(name) {
        return String(name || '')
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0].toUpperCase())
            .join('');
    }

    // ------------------------------------------------------------------
    // Project Lead spotlight — T. S. Kumar's profile (PROJECT_LEAD in
    // team-data.js) is a lot richer than a regular roster entry, so it
    // gets its own section rendered straight into the page rather than
    // being squeezed into a team-card. Renders nothing if PROJECT_LEAD
    // is unset or null.
    // ------------------------------------------------------------------

    const LEADER_LINK_LABELS = {
        website: 'Personal Website (Maintained by individual)',
        scholar: 'Google Scholar',
        github: 'GitHub',
        linkedin: 'LinkedIn'
    };

    function renderLeadership() {
        const rootEl = document.getElementById('team-leader-root');
        if (!rootEl) return;

        if (typeof PROJECT_LEAD === 'undefined' || !PROJECT_LEAD) {
            rootEl.innerHTML = '';
            return;
        }

        const lead = PROJECT_LEAD;

        const avatar = lead.photo
            ? `<img class="member-photo leader-photo" src="${escapeHtml(lead.photo)}" alt="${escapeHtml(lead.name)}">`
            : `<div class="avatar leader-avatar">${escapeHtml(getInitials(lead.name))}</div>`;

        const tagsHtml = (lead.researchAreas || []).length
            ? `<div class="leader-tags">${lead.researchAreas.map((t) => `<span class="leader-tag">${escapeHtml(t)}</span>`).join('')}</div>`
            : '';

        const emailAddress = lead.email
            ? (lead.email.includes('@') ? lead.email : `${lead.email}@aries.res.in`)
            : '';

        const contactHtml = [
            emailAddress ? `<a href="mailto:${escapeHtml(emailAddress)}">${escapeHtml(emailAddress)}</a>` : '',
            lead.phone ? `<span>Ext. ${escapeHtml(lead.phone)}</span>` : ''
        ].filter(Boolean).join('');

        // ------------------------------------------------------------
        // Everything below the header ("main highlights" — avatar, name,
        // role badge, designation, contact, research-area tags, all
        // rendered further down and unchanged) is now organized as tabs
        // instead of one long stacked column. Each section's content is
        // built WITHOUT its own <h3> here, since the tab button itself
        // now serves as that heading — repeating it inside the panel
        // would be redundant.
        // ------------------------------------------------------------
        const educationContent = lead.education
            ? `<p class="leader-education"><strong>Education:</strong> ${escapeHtml(lead.education)}</p>`
            : '';

        const experienceContent = (lead.experience || []).length
            ? `<div class="leader-timeline">
                ${lead.experience.map((entry) => `
                    <div class="leader-timeline-item">
                        <div class="leader-timeline-head">
                            <span class="leader-timeline-role">${escapeHtml(entry.role)}${entry.org ? `, ${escapeHtml(entry.org)}` : ''}</span>
                            <span class="leader-timeline-period">${escapeHtml(entry.period || '')}</span>
                        </div>
                        ${(entry.points || []).length
                            ? `<ul class="leader-timeline-points">${entry.points.map((pt) => `<li>${escapeHtml(pt)}</li>`).join('')}</ul>`
                            : ''}
                    </div>`).join('')}
            </div>`
            : '';

        const interestsContent = (lead.interests || []).length
            ? `<ul class="leader-bullet-list">${lead.interests.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
            : '';

        // "Externally Funded Projects" — data still lives in
        // PROJECT_LEAD.projects in team-data.js; add a tab for it below
        // (push into the `tabs` array) if you want it visible again.

        const openToContent = (lead.openTo && (lead.openTo.note || (lead.openTo.points || []).length))
            ? `${lead.openTo.note ? `<p>${escapeHtml(lead.openTo.note)}</p>` : ''}
               ${(lead.openTo.points || []).length
                    ? `<ul class="leader-bullet-list">${lead.openTo.points.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`
                    : ''}`
            : '';

        // General office contact — used instead of listing personal numbers
        // for every team member. Edit the extensions below if they change.
        const officeContactContent = `
            <p>For general enquiries, please reach the ARIES SSA office:</p>
            <div class="office-ext-list">
                <span class="office-ext-pill">Ext. 792</span>
                <span class="office-ext-pill">Ext. 791</span>
            </div>`;

        const links = lead.links || {};
        const linkEntries = Object.keys(LEADER_LINK_LABELS).filter((key) => links[key]);
        const linksContent = linkEntries.length
            ? `<div class="link-list">${linkEntries.map((key) => `
                <a href="${escapeHtml(links[key])}" target="_blank" rel="noopener noreferrer">
                    ${LEADER_LINK_LABELS[key]}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>`).join('')}</div>`
            : '';

        // Only sections with real content become tabs — same conditional
        // pattern the old markup used per-section, just collected into
        // one list now instead of being unconditionally positioned.
        const tabs = [
            { id: 'expertise', label: 'Area of Expertise', html: educationContent },
            { id: 'experience', label: 'Professional Experience', html: experienceContent },
            { id: 'interests', label: 'Research Interests', html: interestsContent },
            { id: 'interns', label: 'Open to Interns', html: openToContent },
            { id: 'contact', label: 'Office Contact', html: officeContactContent },
            { id: 'links', label: 'Links', html: linksContent }
        ].filter((tab) => tab.html);

        const tabsHtml = tabs.length
            ? `<div class="leader-tabs" role="tablist" aria-label="${escapeHtml(lead.name)}'s profile sections">
                ${tabs.map((tab, i) => `
                    <button type="button" class="leader-tab${i === 0 ? ' active' : ''}" role="tab"
                        aria-selected="${i === 0}" aria-controls="leader-panel-${tab.id}" id="leader-tab-${tab.id}"
                        data-tab-target="${tab.id}">${escapeHtml(tab.label)}</button>`).join('')}
            </div>
            <div class="leader-tab-panels">
                ${tabs.map((tab, i) => `
                    <div class="leader-tab-panel${i === 0 ? ' active' : ''}" role="tabpanel"
                        id="leader-panel-${tab.id}" aria-labelledby="leader-tab-${tab.id}"
                        data-tab-panel="${tab.id}">${tab.html}</div>`).join('')}
            </div>`
            : '';

        rootEl.innerHTML = `
        <section class="leader-section-wrap" aria-labelledby="team-leader-heading">
            <h2 id="team-leader-heading" class="leader-eyebrow">Project Leadership</h2>
            <div class="leader-panel">
                <div class="leader-header">
                    ${avatar}
                    <div class="leader-header-info">
                        <span class="leader-role-badge">${escapeHtml(lead.role || 'Project Lead')}</span>
                        <div class="member-name leader-name">${escapeHtml(lead.name)}</div>
                        <div class="member-designation leader-designation">${escapeHtml(lead.designation)}${lead.organization ? ` &middot; ${escapeHtml(lead.organization)}` : ''}</div>
                        <div class="member-contact">${contactHtml}</div>
                        ${tagsHtml}
                    </div>
                </div>
                ${tabsHtml}
            </div>
        </section>`;

        setupLeaderTabs(rootEl);
    }

    // Click-to-switch tabs for the leadership panel — same simple
    // class-toggle approach as toggleCard()'s expand/collapse below, just
    // for a tab bar instead of a single expand button. Only one panel
    // visible at a time; each panel can internally scroll (see
    // .leader-tab-panel in team.css) rather than growing the whole card
    // taller for longer sections.
    function setupLeaderTabs(rootEl) {
        const tabButtons = rootEl.querySelectorAll('.leader-tab');
        if (!tabButtons.length) return;

        tabButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-tab-target');

                rootEl.querySelectorAll('.leader-tab').forEach((b) => {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                });
                rootEl.querySelectorAll('.leader-tab-panel').forEach((p) => {
                    p.classList.remove('active');
                });

                btn.classList.add('active');
                btn.setAttribute('aria-selected', 'true');
                const panel = rootEl.querySelector(`.leader-tab-panel[data-tab-panel="${targetId}"]`);
                if (panel) panel.classList.add('active');
            });
        });
    }

    function renderProjects() {
        const gridEl = document.getElementById('team-projects-grid');
        if (!gridEl) return;

        if (typeof PROJECTS === 'undefined' || !PROJECTS.length) {
            gridEl.innerHTML = '<div class="empty">No current projects listed yet.</div>';
            return;
        }

        gridEl.innerHTML = PROJECTS.map((project) => {
            const orgTags = (project.orgs || [])
                .map((org) => `<span class="project-org-tag">${escapeHtml(org)}</span>`)
                .join('');

            return `
            <div class="project-card">
                <div class="project-card-head">
                    <span class="project-status project-status-${escapeHtml((project.status || '').toLowerCase())}">${escapeHtml(project.status || '')}</span>
                </div>
                <div class="project-card-title">${escapeHtml(project.title)}</div>
                <p class="project-card-desc">${escapeHtml(project.description || '')}</p>
                <div class="project-org-tags">${orgTags}</div>
            </div>`;
        }).join('');
    }

    // ------------------------------------------------------------------
    // Sidebar filter (COLUMN_GROUPS from team-data.js becomes the list of
    // filter options) + a single member grid, instead of showing every
    // group as its own column at once. Clicking a card expands it in
    // place (see toggleCard below) rather than opening anything separate.
    // ------------------------------------------------------------------

    let activeFilterCategories = null; // null = "All"
    let currentGridMembers = [];

    function renderSidebar() {
        const listEl = document.getElementById('team-sidebar-list');
        if (!listEl) return;

        if (typeof COLUMN_GROUPS === 'undefined' || !COLUMN_GROUPS.length) {
            listEl.innerHTML = '<div class="empty">No categories configured yet.</div>';
            return;
        }

        // Any category that isn't claimed by a COLUMN_GROUPS entry falls
        // into an auto "Others" bucket, so nobody silently disappears from
        // the filter list if a category gets added to TEAM_MEMBERS without
        // updating COLUMN_GROUPS.
        // Only published members count toward the roster shown on the
        // live site — see the "published" field in team-data.js. This is
        // what lets people fill in their own info without it (or anyone
        // else's unfinished entry) appearing until it's ready.
        const publishedMembers = TEAM_MEMBERS.filter((m) => m.published);

        const groupedCategories = new Set(COLUMN_GROUPS.flatMap((g) => g.categories));
        const otherCategories = [...new Set(publishedMembers.map((m) => m.category))].filter((c) => !groupedCategories.has(c));

        const items = COLUMN_GROUPS.map((g) => ({ title: g.title, categories: g.categories }));
        if (otherCategories.length) {
            items.push({ title: 'Others', categories: otherCategories });
        }

        const allCount = publishedMembers.length;
        const rowsHtml = items.map((item) => {
            const count = publishedMembers.filter((m) => item.categories.includes(m.category)).length;
            return `
            <button class="team-sidebar-item" data-categories='${JSON.stringify(item.categories)}'>
                <span>${escapeHtml(item.title)}</span>
                <span class="team-sidebar-count">${count}</span>
            </button>`;
        }).join('');

        listEl.innerHTML = `
            <button class="team-sidebar-item active" data-categories="all">
                <span>All</span>
                <span class="team-sidebar-count">${allCount}</span>
            </button>
            ${rowsHtml}`;

        listEl.querySelectorAll('.team-sidebar-item').forEach((btn) => {
            btn.addEventListener('click', () => {
                listEl.querySelectorAll('.team-sidebar-item').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');

                const raw = btn.dataset.categories;
                activeFilterCategories = raw === 'all' ? null : JSON.parse(raw);
                renderGrid(activeFilterCategories);
            });
        });
    }

    function renderGrid(categoriesOrLegacyString) {
        const gridEl = document.getElementById('team-grid');
        if (!gridEl) return;

        // Accepts either an array of category keys, null (= all), or the
        // legacy 'all' string from the initial call above.
        const categories = (categoriesOrLegacyString === 'all' || !categoriesOrLegacyString)
            ? null
            : categoriesOrLegacyString;

        const publishedMembers = TEAM_MEMBERS.filter((m) => m.published);
        currentGridMembers = categories
            ? publishedMembers.filter((m) => categories.includes(m.category))
            : publishedMembers.slice();

        if (!currentGridMembers.length) {
            gridEl.innerHTML = '<div class="empty">No members in this category yet.</div>';
            return;
        }

        gridEl.innerHTML = currentGridMembers.map(cardHtml).join('');

        gridEl.querySelectorAll('.team-card').forEach((card) => {
            card.addEventListener('click', () => toggleCard(card));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleCard(card);
                }
            });
        });
    }

    function cardHtml(member) {
        const meta = CATEGORY_META[member.category] || { tag: '' };
        const avatar = member.photo
            ? `<img class="member-photo" style="width:44px;height:44px" src="${escapeHtml(member.photo)}" alt="${escapeHtml(member.name)}">`
            : `<div class="avatar team-card-avatar">${escapeHtml(getInitials(member.name))}</div>`;

        const orgHtml = member.organization
            ? `<div class="team-card-org">${escapeHtml(member.organization)}</div>`
            : '';

        const workingOnHtml = member.workingOn
            ? `<div class="team-card-project">Working on: ${escapeHtml(member.workingOn)}</div>`
            : '';

        return `
        <div class="team-card" data-id="${escapeHtml(member.id)}" role="button" tabindex="0"
             aria-expanded="false" aria-label="Toggle details for ${escapeHtml(member.name)}">
            <span class="class-tag">${escapeHtml(meta.tag || '')}</span>
            <div class="team-card-top">
                ${avatar}
                <div>
                    <div class="team-card-name">${escapeHtml(member.name)}</div>
                    <div class="team-card-role">${escapeHtml(member.designation)}</div>
                    ${orgHtml}
                </div>
            </div>
            ${workingOnHtml}
            <div class="team-card-view">
                <span class="team-card-view-label">View Details</span>
                <svg class="team-card-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div class="team-card-expand"></div>
        </div>`;
    }

    // ------------------------------------------------------------------
    // Expand-in-place details — clicking a card grows it to full width
    // right there in the grid, with the background photo showing through
    // (see .team-card.expanded in team.css). Only one card open at a time.
    // ------------------------------------------------------------------

    const LINK_ICONS = {
        website: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
        scholar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10L12 4 2 10l10 6 10-6z"/><path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/></svg>',
        github: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.55 2.87 8.4 6.84 9.77.5.1.68-.22.68-.5 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.46-1.19-1.11-1.51-1.11-1.51-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.28 2.75 1.05a9.32 9.32 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .28.18.61.69.5A10.02 10.02 0 0 0 22 12.26C22 6.58 17.52 2 12 2z"/></svg>',
        linkedin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z"/></svg>'
    };

    const ICON_EMAIL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M22 6l-10 7L2 6"/></svg>';

    function toggleCard(card) {
        const isOpen = card.classList.contains('expanded');

        // Accordion behavior: close any other open card first
        document.querySelectorAll('.team-card.expanded').forEach((openCard) => {
            if (openCard !== card) collapseCard(openCard);
        });

        if (isOpen) {
            collapseCard(card);
        } else {
            expandCard(card);
        }
    }

    function expandCard(card) {
        const id = card.dataset.id;
        const member = currentGridMembers.find((m) => m.id === id);
        if (!member) return;

        const expandEl = card.querySelector('.team-card-expand');
        expandEl.innerHTML = expandDetailHtml(member);

        card.classList.add('expanded');
        card.setAttribute('aria-expanded', 'true');
        const label = card.querySelector('.team-card-view-label');
        if (label) label.textContent = 'Hide Details';

        requestAnimationFrame(() => {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    }

    function collapseCard(card) {
        card.classList.remove('expanded');
        card.setAttribute('aria-expanded', 'false');
        const label = card.querySelector('.team-card-view-label');
        if (label) label.textContent = 'View Details';
    }

    function expandDetailHtml(member) {
        // Note: no name/avatar repeated here on purpose — that's already
        // shown once in the card header above. This panel only adds new
        // information (working on / organization / contact / links) plus
        // a link out to the person's full profile page.

        const bioHtml = (member.bio || []).length
            ? member.bio.map((p) => `<p>${escapeHtml(p)}</p>`).join('')
            : `<p class="modal-empty">Bio not yet added.</p>`;

        const infoRows = [
            member.workingOn ? { label: 'Working On', value: member.workingOn } : null,
            member.organization ? { label: 'Organization', value: member.organization } : null,
            member.field ? { label: 'Field', value: member.field } : null
        ].filter(Boolean);

        const infoRowsHtml = infoRows.length
            ? infoRows.map((row) => `
                <div class="modal-info-row">
                    <span class="modal-info-label">${escapeHtml(row.label)}</span>
                    <span class="modal-info-value">${escapeHtml(row.value)}</span>
                </div>`).join('')
            : `<p class="modal-empty">No current work listed yet.</p>`;

        const emailAddress = member.email || '';
        const contactHtml = emailAddress
            ? `<div class="modal-contact-row">${ICON_EMAIL}<a href="mailto:${escapeHtml(emailAddress)}">${escapeHtml(emailAddress)}</a></div>`
            : '';

        const links = member.links || {};
        const socialEntries = Object.keys(LINK_ICONS).filter((key) => links[key]);
        const socialHtml = socialEntries.length
            ? `<div class="modal-social-row">${socialEntries.map((key) => `
                <a href="${escapeHtml(links[key])}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(key)}" onclick="event.stopPropagation()">${LINK_ICONS[key]}</a>`).join('')}</div>`
            : '';

        return `
        <div class="modal-left" onclick="event.stopPropagation()">
            <div class="modal-info-rows">
                ${infoRowsHtml}
            </div>
            ${contactHtml}
            ${socialHtml}
            <a class="btn-view-profile" href="/member.html?id=${encodeURIComponent(member.id)}" onclick="event.stopPropagation()">
                View Profile
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </a>
        </div>
        <div class="modal-right" onclick="event.stopPropagation()">
            <div class="modal-section">
                <h4>About</h4>
                ${bioHtml}
            </div>
        </div>`;
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
})();