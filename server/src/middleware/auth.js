const jwt = require('jsonwebtoken');

function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      if (!required) return next();
      return res.status(401).json({ error: 'Please sign in to continue.' });
    }
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev_only_change_me');
      next();
    } catch {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
  };
}

function photographerOnly(req, res, next) {
  if (req.user?.role !== 'photographer') return res.status(403).json({ error: 'Photographer account required.' });
  next();
}

module.exports = { auth, photographerOnly };
