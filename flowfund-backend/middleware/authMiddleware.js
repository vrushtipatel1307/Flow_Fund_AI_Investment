const jwt = require('jsonwebtoken');
const pool = require('../config/db');

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    // Verify JWT first (checks signature + expiry)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check session still exists (not logged out)
    const [sessions] = await pool.query(
      'SELECT 1 FROM user_sessions WHERE jwt_token = ? LIMIT 1',
      [token]
    );
    if (sessions.length === 0) return res.status(401).json({ error: 'Session expired or invalid' });
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
