const { query, queryWithReturning } = require('../config/database');
const { toId, toNumber } = require('./helpers');
const User = require('./User');

function mapReviewRow(row, { reviewer = null, reviewee = null } = {}) {
  if (!row) {
    return null;
  }

  return {
    _id: toId(row.id),
    id: toId(row.id),
    rideId: toId(row.ride_id),
    reviewer: reviewer || toId(row.reviewer_id),
    reviewee: reviewee || toId(row.reviewee_id),
    rating: toNumber(row.rating),
    comment: row.comment,
    reviewerRole: row.reviewer_role,
    createdAt: row.created_at,
  };
}

async function syncDriverRating(revieweeId, connection = null) {
  await query(
    `
      UPDATE drivers
      SET rating = u.rating
      FROM users u
      WHERE drivers.user_id = u.id
        AND drivers.user_id = ?
    `,
    [revieweeId],
    connection
  );
}

async function findByRevieweeId(revieweeId, { limit = 50 } = {}, connection = null) {
  const rows = await query(
    `
      SELECT r.*, u.name as reviewer_name, u.profile_image as reviewer_image
      FROM reviews r
      JOIN users u ON r.reviewer_id = u.id
      WHERE r.reviewee_id = ?
      ORDER BY r.created_at DESC
      LIMIT ?
    `,
    [revieweeId, limit],
    connection
  );

  return rows.map(row => {
    const reviewer = {
      id: toId(row.reviewer_id),
      name: row.reviewer_name,
      profileImage: row.reviewer_image,
    };
    return mapReviewRow(row, { reviewer });
  });
}

async function findByReviewerAndReviewee(reviewerId, revieweeId, connection = null) {
  const rows = await query(
    'SELECT * FROM reviews WHERE reviewer_id = ? AND reviewee_id = ? LIMIT 1',
    [reviewerId, revieweeId],
    connection
  );
  return mapReviewRow(rows[0]);
}

async function findByReviewerId(reviewerId, { limit = 50 } = {}, connection = null) {
  const rows = await query(
    `
      SELECT r.*, u.name as reviewee_name, u.profile_image as reviewee_image
      FROM reviews r
      JOIN users u ON r.reviewee_id = u.id
      WHERE r.reviewer_id = ?
      ORDER BY r.created_at DESC
      LIMIT ?
    `,
    [reviewerId, limit],
    connection
  );

  return rows.map(row => {
    const reviewee = {
      id: toId(row.reviewee_id),
      name: row.reviewee_name,
      profileImage: row.reviewee_image,
    };
    return mapReviewRow(row, { reviewee });
  });
}

async function create(payload, connection = null) {
  const rows = await queryWithReturning(
    `
      INSERT INTO reviews (
        ride_id,
        reviewer_id,
        reviewee_id,
        rating,
        comment,
        reviewer_role
      ) VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
    [
      payload.rideId || null,
      payload.reviewerId,
      payload.revieweeId,
      payload.rating,
      payload.comment || null,
      payload.reviewerRole,
    ],
    connection
  );

  // Update reviewee's rating
  await query(
    `
      UPDATE users
      SET 
        rating = (rating * total_ratings + ?) / (total_ratings + 1),
        total_ratings = total_ratings + 1
      WHERE id = ?
    `,
    [payload.rating, payload.revieweeId],
    connection
  );

  await syncDriverRating(payload.revieweeId, connection);

  const resultRows = await query('SELECT * FROM reviews WHERE id = ? LIMIT 1', [rows[0].id], connection);
  return mapReviewRow(resultRows[0]);
}

async function updateById(id, updates, connection = null) {
  const current = await query('SELECT * FROM reviews WHERE id = ? LIMIT 1', [id], connection);
  if (!current.length) {
    return null;
  }

  const review = current[0];
  const ratingDiff = updates.rating ? updates.rating - review.rating : 0;

  await query(
    `
      UPDATE reviews
      SET
        rating = ?,
        comment = ?
      WHERE id = ?
    `,
    [
      updates.rating ?? review.rating,
      updates.comment !== undefined ? updates.comment : review.comment,
      id
    ],
    connection
  );

  if (ratingDiff !== 0) {
    await query(
      `
        UPDATE users
        SET rating = (rating * total_ratings + ?) / total_ratings
        WHERE id = ?
      `,
      [ratingDiff, review.reviewee_id],
      connection
    );
  }

  await syncDriverRating(review.reviewee_id, connection);

  const rows = await query('SELECT * FROM reviews WHERE id = ? LIMIT 1', [id], connection);
  return mapReviewRow(rows[0]);
}

module.exports = {
  create,
  updateById,
  findByRevieweeId,
  findByReviewerId,
  findByReviewerAndReviewee,
};
