const { buildSnapshot } = require('../services/snapshotService');

// GET /api/financial/snapshot
exports.getSnapshot = async (req, res) => {
  try {
    const snapshot = await buildSnapshot(req.user.user_id);
    res.json(snapshot);
  } catch (err) {
    console.error('snapshot error:', err.message);
    res.status(500).json({ error: 'Failed to build financial snapshot' });
  }
};
