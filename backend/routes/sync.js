'use strict';

const express = require('express');
const { syncAll, getSyncStatus } = require('../services/syncService');

const router = express.Router();

// In-process guard — prevents multiple concurrent full-sync runs
const runningAccounts = new Set();

/**
 * POST /api/sync
 * Starts a background sync for all tracked handles.
 * Returns immediately; does not wait for sync to complete.
 */
router.post('/', (req, res) => {
  if (runningAccounts.has(req.accountId)) {
    return res.json({
      status:  'already_running',
      message: 'A sync job is already in progress.'
    });
  }

  runningAccounts.add(req.accountId);
  res.json({
    status:  'started',
    message: 'Sync started in background. Poll /api/sync/status for progress.'
  });

  // Fire-and-forget: runs asynchronously, does NOT block the response
  syncAll(req.accountId)
    .then(results => {
      const succeeded = results.filter(r => r.success).length;
      const failed    = results.filter(r => !r.success).length;
      console.log(`[sync] Completed: ${succeeded} succeeded, ${failed} failed`);
    })
    .catch(err => console.error('[sync] Fatal error during syncAll:', err))
    .finally(() => { runningAccounts.delete(req.accountId); });
});

/**
 * GET /api/sync/status
 * Returns per-handle sync state for all tracked users.
 */
router.get('/status', async (req, res) => {
  try {
    const handles = await getSyncStatus(req.accountId);
    res.json({
      jobRunning: runningAccounts.has(req.accountId),
      handles
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
