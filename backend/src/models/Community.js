const { query, withTransaction } = require('../config/database');
const { buildPoint, parseJsonField, toBoolean, toId, toNumber } = require('./helpers');

function mapCommunityRow(row) {
  if (!row) {
    return null;
  }

  return {
    _id: toId(row.id),
    id: toId(row.id),
    name: row.name,
    description: row.description,
    origin: row.origin,
    destination: row.destination,
    originCoords: buildPoint(row.origin_longitude, row.origin_latitude),
    destinationCoords: buildPoint(row.destination_longitude, row.destination_latitude),
    frequentRoutes: parseJsonField(row.frequent_routes_json, []),
    isActive: toBoolean(row.is_active),
    memberCount: toNumber(row.member_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findById(communityId, connection = null) {
  const rows = await query('SELECT * FROM communities WHERE id = ? LIMIT 1', [communityId], connection);
  return mapCommunityRow(rows[0]);
}

async function listByUserId(userId, connection = null) {
  const rows = await query(
    `
      SELECT c.*
      FROM communities c
      INNER JOIN user_communities uc ON uc.community_id = c.id
      WHERE uc.user_id = ?
      ORDER BY c.name ASC
    `,
    [userId],
    connection
  );

  return rows.map(mapCommunityRow);
}

async function refreshMemberCount(communityId, connection = null) {
  await query(
    `
      UPDATE communities
      SET member_count = (
        SELECT COUNT(*)
        FROM user_communities
        WHERE community_id = ?
      )
      WHERE id = ?
    `,
    [communityId, communityId],
    connection
  );
}

async function joinCommunity(userId, communityId) {
  return withTransaction(async (connection) => {
    const community = await findById(communityId, connection);
    if (!community) {
      return null;
    }

    await query(
      'INSERT IGNORE INTO user_communities (user_id, community_id) VALUES (?, ?)',
      [userId, communityId],
      connection
    );

    await refreshMemberCount(communityId, connection);
    return findById(communityId, connection);
  });
}

async function leaveCommunity(userId, communityId) {
  return withTransaction(async (connection) => {
    await query(
      'DELETE FROM user_communities WHERE user_id = ? AND community_id = ?',
      [userId, communityId],
      connection
    );

    await refreshMemberCount(communityId, connection);
    return findById(communityId, connection);
  });
}

module.exports = {
  findById,
  joinCommunity,
  leaveCommunity,
  listByUserId,
  mapCommunityRow,
};
