const bcrypt = require('bcryptjs');

const { query } = require('../config/database');
const { buildPoint, parseJsonField, toBoolean, toId, toNumber } = require('./helpers');

const DEFAULT_USER_SETTINGS = {
  notifications: {
    rideUpdates: true,
    smsUpdates: true,
    promotions: false,
  },
  privacy: {
    shareLiveLocation: true,
    communityVisibility: true,
  },
  security: {
    loginAlerts: true,
  },
  payments: {
    defaultMethod: null,
  },
};

function cloneDefaultSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_USER_SETTINGS));
}

function normalizeSettings(settings) {
  const base = cloneDefaultSettings();

  if (!settings || typeof settings !== 'object') {
    return base;
  }

  return {
    notifications: {
      ...base.notifications,
      ...(settings.notifications && typeof settings.notifications === 'object' ? settings.notifications : {}),
    },
    privacy: {
      ...base.privacy,
      ...(settings.privacy && typeof settings.privacy === 'object' ? settings.privacy : {}),
    },
    security: {
      ...base.security,
      ...(settings.security && typeof settings.security === 'object' ? settings.security : {}),
    },
    payments: {
      ...base.payments,
      ...(settings.payments && typeof settings.payments === 'object' ? settings.payments : {}),
    },
  };
}

function parseUserSettings(value) {
  return normalizeSettings(parseJsonField(value, {}));
}

function mergeUserSettings(currentSettings, updates) {
  return normalizeSettings({
    notifications: {
      ...parseUserSettings(currentSettings).notifications,
      ...(updates?.notifications && typeof updates.notifications === 'object' ? updates.notifications : {}),
    },
    privacy: {
      ...parseUserSettings(currentSettings).privacy,
      ...(updates?.privacy && typeof updates.privacy === 'object' ? updates.privacy : {}),
    },
    security: {
      ...parseUserSettings(currentSettings).security,
      ...(updates?.security && typeof updates.security === 'object' ? updates.security : {}),
    },
    payments: {
      ...parseUserSettings(currentSettings).payments,
      ...(updates?.payments && typeof updates.payments === 'object' ? updates.payments : {}),
    },
  });
}

function mapUserRow(row, { includePassword = false, communities = null } = {}) {
  if (!row) {
    return null;
  }

  const user = {
    _id: toId(row.id),
    id: toId(row.id),
    phoneNumber: row.phone_number,
    name: row.name,
    role: row.role,
    email: row.email,
    profileImage: row.profile_image,
    settings: parseUserSettings(row.settings_json),
    rating: toNumber(row.rating),
    totalRatings: toNumber(row.total_ratings),
    isVerified: toBoolean(row.is_verified),
    isOnline: toBoolean(row.is_online),
    currentLocation: buildPoint(row.current_longitude, row.current_latitude) || {
      type: 'Point',
      coordinates: [0, 0],
    },
    wallet: {
      balance: toNumber(row.wallet_balance),
      currency: row.wallet_currency || 'XAF',
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (communities) {
    user.communities = communities;
  }

  if (includePassword) {
    user.password = row.password_hash;
  }

  return user;
}

async function findByPhoneNumber(phoneNumber, options = {}, connection = null) {
  const rows = await query('SELECT * FROM users WHERE phone_number = ? LIMIT 1', [phoneNumber], connection);
  return mapUserRow(rows[0], options);
}

async function findById(userId, options = {}, connection = null) {
  const rows = await query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId], connection);
  return mapUserRow(rows[0], options);
}

async function create({ phoneNumber, password, name, role, email = null }, connection = null) {
  const passwordHash = await bcrypt.hash(password, 10);

  const result = await query(
    `
      INSERT INTO users (phone_number, password_hash, name, role, email)
      VALUES (?, ?, ?, ?, ?)
    `,
    [phoneNumber, passwordHash, name, role, email],
    connection
  );

  return findById(result.insertId, {}, connection);
}

async function comparePassword(user, candidatePassword) {
  if (!user?.password) {
    return false;
  }

  return bcrypt.compare(candidatePassword, user.password);
}

async function updateOnlineStatus(userId, isOnline, connection = null) {
  await query('UPDATE users SET is_online = ? WHERE id = ?', [isOnline ? 1 : 0, userId], connection);
  return findById(userId, {}, connection);
}

async function updateLocation(userId, { latitude, longitude }, connection = null) {
  await query(
    'UPDATE users SET current_latitude = ?, current_longitude = ? WHERE id = ?',
    [latitude, longitude, userId],
    connection
  );

  return findById(userId, {}, connection);
}

async function updateById(userId, updates, connection = null) {
  const current = await findById(userId, {}, connection);
  if (!current) {
    return null;
  }

  const nextSettings =
    updates.settings === undefined ? current.settings : mergeUserSettings(current.settings, updates.settings);

  await query(
    `
      UPDATE users
      SET
        phone_number = ?,
        name = ?,
        email = ?,
        profile_image = ?,
        settings_json = ?
      WHERE id = ?
    `,
    [
      updates.phoneNumber || current.phoneNumber,
      updates.name || current.name,
      updates.email === undefined ? current.email : updates.email || null,
      updates.profileImage === undefined ? current.profileImage : updates.profileImage || null,
      JSON.stringify(nextSettings),
      userId,
    ],
    connection
  );

  return findById(userId, {}, connection);
}

async function updatePassword(userId, currentPassword, nextPassword, connection = null) {
  const currentUser = await findById(userId, { includePassword: true }, connection);

  if (!currentUser) {
    return null;
  }

  const passwordMatches = await comparePassword(currentUser, currentPassword);
  if (!passwordMatches) {
    const error = new Error('Current password is incorrect');
    error.code = 'INVALID_CURRENT_PASSWORD';
    throw error;
  }

  const isSamePassword = await bcrypt.compare(nextPassword, currentUser.password);
  if (isSamePassword) {
    const error = new Error('New password must be different from the current password');
    error.code = 'PASSWORD_REUSE';
    throw error;
  }

  const nextPasswordHash = await bcrypt.hash(nextPassword, 10);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [nextPasswordHash, userId], connection);

  return findById(userId, {}, connection);
}

async function adjustWalletBalance(userId, amountDelta, connection = null) {
  await query(
    'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
    [amountDelta, userId],
    connection
  );

  return findById(userId, {}, connection);
}

module.exports = {
  DEFAULT_USER_SETTINGS,
  adjustWalletBalance,
  comparePassword,
  create,
  findById,
  findByPhoneNumber,
  mapUserRow,
  updateById,
  updateLocation,
  updateOnlineStatus,
  updatePassword,
};
