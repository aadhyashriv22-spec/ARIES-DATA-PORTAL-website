// Renders /collaborators.html (overview) and /collaborator.html?id=<id>
// (one organization) from COLLABORATORS in collaborators-data.js. Team
// members on each project come from TEAM_MEMBERS in team-data.js.

(function () {
    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    const ICON_ARROW = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
    const ICON_PIN = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>';
    const ICON_LINK = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

    function list(items) {
        return `<ul class="collab-list">${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
    }

    function teamMembersFor(org) {
        if (typeof TEAM_MEMBERS === 'undefined') return [];
        return TEAM_MEMBERS.filter((member) =>
            member.published !== false &&
            (org.teamOrgMatch || []).some((key) =>
                String(member.organization || '').toUpperCase().includes(key.toUpperCase())
            )
        );
    }

    function initials(name) {
        return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
    }

    function renderOverview(root) {
        root.innerHTML = COLLABORATORS.map((org) => `
            <article class="collab-card">
                <div class="collab-card-head">
                    <span class="collab-monogram" aria-hidden="true">${escapeHtml(org.monogram)}</span>
                    <div>
                        <h2 class="collab-card-name">${escapeHtml(org.name)}</h2>
                        <div class="collab-card-full">${escapeHtml(org.fullName)}</div>
                    </div>
                </div>
                <div class="collab-card-meta">
                    <span>${ICON_PIN}${escapeHtml(org.location)}</span>
                    <span class="collab-chip">MoU · ${escapeHtml(org.mou.signed)}</span>
                </div>
                <p class="collab-card-summary">${escapeHtml(org.summary)}</p>
                <a class="collab-read-more" href="/collaborator.html?id=${encodeURIComponent(org.id)}">
                    Read more about ${escapeHtml(org.name)} ${ICON_ARROW}
                </a>
            </article>`).join('');
    }

    function renderDetail(root) {
        const id = new URLSearchParams(window.location.search).get('id');
        const org = COLLABORATORS.find((item) => item.id === id);
        const crumb = document.getElementById('breadcrumb-name');

        if (!org) {
            if (crumb) crumb.textContent = 'Not found';
            root.innerHTML = '<div class="empty">Collaborator not found. <a href="/collaborators.html">See all collaborators</a>.</div>';
            return;
        }

        document.title = `${org.name} — Collaborators — ARIES Observe`;
        if (crumb) crumb.textContent = org.name;

        const members = teamMembersFor(org);
        const membersHtml = members.length
            ? `<ul class="collab-members">${members.map((member) => `
                <li>
                    <a href="/member.html?id=${encodeURIComponent(member.id)}">
                        ${member.photo
                            ? `<img src="${escapeHtml(member.photo)}" alt="" class="collab-member-photo">`
                            : `<span class="collab-member-photo collab-member-initials" aria-hidden="true">${escapeHtml(initials(member.name))}</span>`}
                        <span>
                            <span class="collab-member-name">${escapeHtml(member.name)}</span>
                            <span class="collab-member-role">${escapeHtml(member.designation)}</span>
                        </span>
                    </a>
                </li>`).join('')}</ul>`
            : '<p class="collab-muted">Team members will be listed here.</p>';

        const others = COLLABORATORS.filter((item) => item.id !== org.id);

        root.innerHTML = `
            <section class="collab-detail">
                <header class="collab-detail-header">
                    <span class="collab-monogram collab-monogram-lg" aria-hidden="true">${escapeHtml(org.monogram)}</span>
                    <div>
                        <h1 class="collab-detail-name">${escapeHtml(org.name)}</h1>
                        <div class="collab-detail-full">${escapeHtml(org.fullName)}</div>
                        <div class="collab-card-meta">
                            <span>${ICON_PIN}${escapeHtml(org.location)}</span>
                            <span>${escapeHtml(org.parent)}</span>
                        </div>
                    </div>
                </header>

                <div class="collab-detail-body">
                    <div class="collab-main">
                        <section class="collab-section">
                            <h2>Collaboration in Space Situational Awareness</h2>
                            <p>${escapeHtml(org.summary)}</p>
                        </section>

                        <section class="collab-section">
                            <h2>About ${escapeHtml(org.name)}</h2>
                            ${org.about.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
                        </section>

                        <section class="collab-section">
                            <h2>The MoU</h2>
                            ${org.mou.text.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
                        </section>

                        <section class="collab-section">
                            <h2>Focus areas</h2>
                            ${list(org.focusAreas)}
                        </section>

                        <section class="collab-section">
                            <h2>Work being carried out at ARIES</h2>
                            ${list(org.workAtAries)}
                        </section>

                        <section class="collab-section">
                            <h2>Sources</h2>
                            <ul class="collab-sources">
                                ${org.sources.map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)} ${ICON_LINK}</a></li>`).join('')}
                            </ul>
                        </section>
                    </div>

                    <aside class="collab-side">
                        <div class="collab-facts">
                            <h3>MoU at a glance</h3>
                            <dl>
                                <dt>Signed</dt><dd>${escapeHtml(org.mou.signed)}</dd>
                                <dt>Place</dt><dd>${escapeHtml(org.mou.place)}</dd>
                                <dt>Signatories</dt><dd>${org.mou.signatories.map(escapeHtml).join('<br>')}</dd>
                                <dt>Facilities</dt><dd>${org.mou.facilities.map(escapeHtml).join('<br>')}</dd>
                            </dl>
                        </div>

                        <div class="collab-facts">
                            <h3>Team on this project</h3>
                            ${membersHtml}
                        </div>

                        <div class="collab-facts">
                            <h3>Other collaborators</h3>
                            <ul class="collab-others">
                                ${others.map((item) => `<li><a href="/collaborator.html?id=${encodeURIComponent(item.id)}">${escapeHtml(item.name)} ${ICON_ARROW}</a></li>`).join('')}
                            </ul>
                        </div>
                    </aside>
                </div>
            </section>`;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const overviewRoot = document.getElementById('collaborators-grid');
        const detailRoot = document.getElementById('collaborator-root');

        if (overviewRoot) renderOverview(overviewRoot);
        if (detailRoot) renderDetail(detailRoot);
    });
})();
