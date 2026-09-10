// middleware/teamAccess.js
//
// Separate, lightweight gate for the Team Workspace page (PPTs, meeting
// notes, MoM). Deliberately independent from the /portal authCheck —
// different audience, different passcode, different cookie.

module.exports = function teamAccessCheck(req, res, next) {
    if (req.signedCookies && req.signedCookies.team_access === 'granted') {
        return next();
    }

    // Direct navigation to /team-workspace.html without the cookie
    // (e.g. someone bookmarked the URL, or typed it in) — bounce back
    // to the demonstration page with a flag the frontend can read.
    return res.redirect('/demonstration.html?teamAccess=denied');
};