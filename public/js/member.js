(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        const member = TEAM_MEMBERS.find((m) => m.id === id && m.published);

        if (!member) {
            renderNotFound();
            return;
        }

        renderMember(member);
    });

    function getInitials(name) {
        return String(name || '')
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0].toUpperCase())
            .join('');
    }

    const LINK_LABELS = {
        website: 'Personal Website (Maintained by individual)',
        scholar: 'Google Scholar',
        github: 'GitHub',
        linkedin: 'LinkedIn'
    };

    function renderMember(member) {
        document.title = `${member.name} — ARIES SSA Team`;
        document.getElementById('page-title').textContent = `${member.name} — ARIES SSA Team`;
        document.getElementById('breadcrumb-name').textContent = member.name;

        const avatar = member.photo
            ? `<img class="member-photo" src="${escapeHtml(member.photo)}" alt="${escapeHtml(member.name)}">`
            : `<div class="avatar">${escapeHtml(getInitials(member.name))}</div>`;

        const bioHtml = (member.bio || []).length
            ? (member.bio || []).map((para) => `<p>${escapeHtml(para)}</p>`).join('')
            : `<p class="no-links">Bio not yet added.</p>`;

        const fieldWorkHtml = `
            <div class="field-work-row">
                <span class="field-work-label">Field</span>
                <span class="field-work-value ${member.field ? '' : 'placeholder'}">${member.field ? escapeHtml(member.field) : 'Not yet added'}</span>
            </div>
            <div class="field-work-row">
                <span class="field-work-label">Currently Working On</span>
                <span class="field-work-value ${member.workingOn ? '' : 'placeholder'}">${member.workingOn ? escapeHtml(member.workingOn) : 'Not yet added'}</span>
            </div>
            <div class="field-work-row">
                <span class="field-work-label">Research Area</span>
                <span class="field-work-value ${member.researchArea ? '' : 'placeholder'}">${member.researchArea ? escapeHtml(member.researchArea) : 'Not yet added'}</span>
            </div>`;

        const interestsHtml = (member.interests || []).length
            ? `<ul class="interest-list">${member.interests.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
            : `<p class="no-links">No research interests listed yet.</p>`;

        const experienceHtml = (member.researchExperience || []).length
            ? `<ul class="experience-list">${member.researchExperience.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`
            : `<p class="no-links">Research experience not yet added.</p>`;

const publicationsHtml = (member.publications || []).length
    ? `<ol class="publication-list">${member.publications.map((p) => {
        const title = escapeHtml(p.title || p.citation || '');
        const journal = escapeHtml(p.journal || '');
        const status = escapeHtml(p.status || '');

        return `
            <li>
                <div class="publication-title">${title}</div>
                ${journal ? `<div class="publication-journal">${journal}</div>` : ''}
                ${status ? `<div class="publication-status">${status}</div>` : ''}
            </li>
        `;
    }).join('')}</ol>`
    : `<p class="no-links">No publications listed yet.</p>`;

        const links = member.links || {};
        const linkEntries = Object.keys(LINK_LABELS).filter((key) => links[key]);
        const linksHtml = linkEntries.length
            ? `<div class="link-list">${linkEntries.map((key) => `
                <a href="${escapeHtml(links[key])}" target="_blank" rel="noopener noreferrer">
                    ${LINK_LABELS[key]}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>`).join('')}</div>`
            : `<p class="no-links">No external links added yet.</p>`;

        const emailAddress = member.email
            ? (member.email.includes('@') ? member.email : `${member.email}@aries.res.in`)
            : '';

        const contactHtml = [
            emailAddress ? `<a href="mailto:${escapeHtml(emailAddress)}">${escapeHtml(emailAddress)}</a>` : '',
            member.phone ? `<span>Ext. ${escapeHtml(member.phone)}</span>` : ''
        ].filter(Boolean).join('');

        const root = document.getElementById('member-root');
        root.innerHTML = `
        <div class="member-profile-panel">
            <div class="member-header">
                ${avatar}
                <div>
                    <div class="member-name">${escapeHtml(member.name)}</div>
                    <div class="member-designation">${escapeHtml(member.designation)}</div>
                    <div class="member-contact">${contactHtml}</div>
                </div>
            </div>
            <div class="member-body">
                <div>
                    <div class="member-section">
                        <h2>Field &amp; Current Work</h2>
                        ${fieldWorkHtml}
                    </div>
                    <div class="member-section">
                        <h2>Research Experience</h2>
                        ${experienceHtml}
                    </div>
                    <div class="member-section">
                        <h2>Research Interest and Description</h2>
                        <div class="member-bio">${bioHtml}</div>
                        ${interestsHtml}
                    </div>
                    <div class="member-section">
                        <h2>Recent Publications</h2>
                        ${publicationsHtml}
                    </div>
                </div>
                <div>
                    <div class="member-section">
                        <h2>Links</h2>
                        ${linksHtml}
                    </div>
                </div>
            </div>
        </div>`;
    }

    function renderNotFound() {
        document.getElementById('breadcrumb-name').textContent = 'Not Found';
        document.getElementById('member-root').innerHTML = `
        <div class="empty">
            Team member not found. <a href="/team.html" style="color:var(--color-accent-hover)">Return to the team page</a>.
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