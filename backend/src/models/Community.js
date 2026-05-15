const { query, queryWithReturning, withTransaction } = require('../config/database');
const { buildPoint, parseJsonField, toBoolean, toId, toNumber } = require('./helpers');

const LOCATION_SIMILARITY_THRESHOLD = 0.72;

function mapCommunityRow(row) {
  if (!row) {
    return null;
  }

  return {
    _id: toId(row.id),
    id: toId(row.id),
    name: row.name,
    description: row.description || '',
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

function normalizeLocationText(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildNGrams(value, size = 2) {
  if (!value) {
    return [];
  }

  const padded = ` ${value} `;
  if (padded.length <= size) {
    return [padded];
  }

  const grams = [];
  for (let index = 0; index <= padded.length - size; index += 1) {
    grams.push(padded.slice(index, index + size));
  }

  return grams;
}

function getDiceSimilarity(first, second) {
  if (!first || !second) {
    return 0;
  }

  if (first === second) {
    return 1;
  }

  const firstGrams = buildNGrams(first);
  const secondGrams = buildNGrams(second);
  const counts = new Map();

  for (const gram of firstGrams) {
    counts.set(gram, (counts.get(gram) || 0) + 1);
  }

  let intersectionCount = 0;
  for (const gram of secondGrams) {
    const count = counts.get(gram) || 0;
    if (count > 0) {
      counts.set(gram, count - 1);
      intersectionCount += 1;
    }
  }

  return (2 * intersectionCount) / (firstGrams.length + secondGrams.length);
}

function isApproximateLocationMatch(first, second) {
  const normalizedFirst = normalizeLocationText(first);
  const normalizedSecond = normalizeLocationText(second);

  if (!normalizedFirst || !normalizedSecond) {
    return false;
  }

  if (normalizedFirst === normalizedSecond) {
    return true;
  }

  const shortestLength = Math.min(normalizedFirst.length, normalizedSecond.length);
  if (shortestLength >= 4 && (normalizedFirst.includes(normalizedSecond) || normalizedSecond.includes(normalizedFirst))) {
    return true;
  }

  return getDiceSimilarity(normalizedFirst, normalizedSecond) >= LOCATION_SIMILARITY_THRESHOLD;
}

function buildCommunityName(origin, destination) {
  return `${origin} -> ${destination}`;
}

function buildCommunityDescription(origin, destination, description) {
  const trimmedDescription = typeof description === 'string' ? description.trim() : '';
  if (trimmedDescription) {
    return trimmedDescription;
  }

  return `Community rides between ${origin} and ${destination}.`;
}

async function findById(communityId, connection = null) {
  const rows = await query('SELECT * FROM communities WHERE id = ? LIMIT 1', [communityId], connection);
  return mapCommunityRow(rows[0]);
}

async function listAll(connection = null) {
  const rows = await query(
    `
      SELECT *
      FROM communities
      WHERE is_active = TRUE
      ORDER BY member_count DESC, name ASC
    `,
    [],
    connection
  );

  return rows.map(mapCommunityRow);
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

async function findApproximateRoute(origin, destination, connection = null) {
  const communities = await listAll(connection);

  return (
    communities.find(
      (community) =>
        isApproximateLocationMatch(community.origin, origin) &&
        isApproximateLocationMatch(community.destination, destination)
    ) || null
  );
}

async function create({ origin, destination, description = null }, creatorUserId = null) {
  return withTransaction(async (connection) => {
    await query('LOCK TABLE communities IN SHARE ROW EXCLUSIVE MODE', [], connection);

    const similarCommunity = await findApproximateRoute(origin, destination, connection);
    if (similarCommunity) {
      const error = new Error(
        `A similar community already exists from ${similarCommunity.origin} to ${similarCommunity.destination}.`
      );
      error.code = 'SIMILAR_COMMUNITY_EXISTS';
      error.community = similarCommunity;
      throw error;
    }

    const rows = await queryWithReturning(
      `
        INSERT INTO communities (
          name,
          description,
          origin,
          destination,
          member_count
        )
        VALUES (?, ?, ?, ?, 0)
        RETURNING *
      `,
      [
        buildCommunityName(origin, destination),
        buildCommunityDescription(origin, destination, description),
        origin,
        destination,
      ],
      connection
    );

    const createdCommunity = mapCommunityRow(rows[0]);

    if (creatorUserId) {
      await query(
        'INSERT INTO user_communities (user_id, community_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
        [creatorUserId, createdCommunity.id],
        connection
      );
      await refreshMemberCount(createdCommunity.id, connection);
    }

    return findById(createdCommunity.id, connection);
  });
}

async function joinCommunity(userId, communityId) {
  return withTransaction(async (connection) => {
    const community = await findById(communityId, connection);
    if (!community) {
      return null;
    }

    await query(
      'INSERT INTO user_communities (user_id, community_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
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
  create,
  findById,
  findApproximateRoute,
  joinCommunity,
  leaveCommunity,
  listAll,
  listByUserId,
  mapCommunityRow,
};
