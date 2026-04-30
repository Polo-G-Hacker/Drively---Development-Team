const bcrypt = require('bcryptjs');

const { query } = require('../config/database');
const { buildPoint, toBoolean, toId, toNumber } = require('./helpers');

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

async function adjustWalletBalance(userId, amountDelta, connection = null) {
  await query(
    'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
    [amountDelta, userId],
    connection
  );

  return findById(userId, {}, connection);
}

module.exports = {
  adjustWalletBalance,
  comparePassword,
  create,
  findById,
  findByPhoneNumber,
  mapUserRow,
  updateLocation,
  updateOnlineStatus,
};
