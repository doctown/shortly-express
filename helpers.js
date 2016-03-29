
/*
 * Assignes a user to a session and redirects to home page
 */
exports.createSession = function(req, res, username) {
  req.session.regenerate(function() {
    req.session.user = username;
    res.status(200).redirect('/');
  });
};
