'use strict';

const TrackerConfig = require('../models/TrackerConfig');
const { getUserInfo } = require('./codeforcesService');

const CONFIG_KEY = 'primary';
const MAX_FRIENDS = 50;

function cleanHandle(value) {
  return String(value || '').trim();
}

function uniqueHandles(handles, meHandle) {
  const seen = new Set([meHandle.toLowerCase()]);
  const out = [];

  for (const raw of handles || []) {
    const handle = cleanHandle(raw);
    if (!handle) continue;
    const key = handle.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(handle);
  }

  return out;
}

async function getTrackerConfig() {
  const doc = await TrackerConfig.findOne({ key: CONFIG_KEY }).lean();

  if (!doc) {
    return {
      configured: false,
      meHandle: '',
      friends: [],
      allHandles: []
    };
  }

  const friends = Array.isArray(doc.friends) ? doc.friends : [];
  return {
    configured: true,
    meHandle: doc.meHandle,
    friends,
    allHandles: [doc.meHandle, ...friends],
    updatedAt: doc.updatedAt || null
  };
}

async function saveTrackerConfig(meHandle, friends = []) {
  const me = cleanHandle(meHandle);
  if (!me) throw new Error('Your Codeforces handle is required.');

  const normalizedFriends = uniqueHandles(friends, me);
  if (normalizedFriends.length > MAX_FRIENDS) {
    throw new Error(`You can track at most ${MAX_FRIENDS} friends.`);
  }

  const requested = [me, ...normalizedFriends];

  let users;
  try {
    users = await getUserInfo(requested);
  } catch (err) {
    const detail = String(err.message || '').replace(/^handles:\s*/i, '');
    throw new Error(`Codeforces handle validation failed: ${detail}`);
  }

  const canonicalByLower = new Map(
    (users || []).map(user => [String(user.handle).toLowerCase(), user.handle])
  );

  const canonicalMe = canonicalByLower.get(me.toLowerCase());
  if (!canonicalMe) throw new Error(`Codeforces handle '${me}' was not found.`);

  const canonicalFriends = normalizedFriends.map(handle => {
    const canonical = canonicalByLower.get(handle.toLowerCase());
    if (!canonical) throw new Error(`Codeforces handle '${handle}' was not found.`);
    return canonical;
  });

  await TrackerConfig.findOneAndUpdate(
    { key: CONFIG_KEY },
    {
      $set: {
        meHandle: canonicalMe,
        friends: canonicalFriends,
        updatedAt: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return getTrackerConfig();
}

module.exports = {
  getTrackerConfig,
  saveTrackerConfig,
  MAX_FRIENDS
};
