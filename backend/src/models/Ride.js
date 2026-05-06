const { query, queryWithReturning } = require('../config/database');
const { buildPoint, toId, toNumber } = require('./helpers');
const Driver = require('./Driver');
const User = require('./User');

function mapRideRow(row, { driver = null, passengers = null } = {}) {
  if (!row) {
    return null;
  }

  return {
    _id: toId(row.id),
    id: toId(row.id),
    driver: driver || toId(row.driver_id),
    passengers: passengers || [],
    route: {
      origin: row.route_origin,
      destination: row.route_destination,
      originCoords: buildPoint(row.route_origin_longitude, row.route_origin_latitude),
      destinationCoords: buildPoint(row.route_destination_longitude, row.route_destination_latitude),
    },
    status: row.status,
    totalFare: toNumber(row.total_fare),
    commission: toNumber(row.commission),
    driverEarnings: toNumber(row.driver_earnings),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    community: toId(row.community_id),
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    transactionId: row.transaction_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRidePassengerRow(row, { user = null } = {}) {
  return {
    _id: toId(row.id),
    id: toId(row.id),
    user: user || toId(row.user_id),
    pickupLocation: {
      type: 'Point',
      coordinates: [toNumber(row.pickup_longitude), toNumber(row.pickup_latitude)],
    },
    dropoffLocation: {
      type: 'Point',
      coordinates: [toNumber(row.dropoff_longitude), toNumber(row.dropoff_latitude)],
    },
    pickupAddress: row.pickup_address,
    dropoffAddress: row.dropoff_address,
    status: row.status,
    fare: toNumber(row.fare),
    distance: toNumber(row.distance),
    duration: toNumber(row.duration),
    joinedAt: row.joined_at,
  };
}

async function getPassengersForRide(rideId, { includeUsers = false } = {}, connection = null) {
  const rows = await query(
    'SELECT * FROM ride_passengers WHERE ride_id = ? ORDER BY joined_at ASC',
    [rideId],
    connection
  );

  if (!includeUsers) {
    return rows.map((row) => mapRidePassengerRow(row));
  }

  const users = await Promise.all(rows.map((row) => User.findById(row.user_id, {}, connection)));
  return rows.map((row, index) => mapRidePassengerRow(row, { user: users[index] }));
}

async function findById(rideId, options = {}, connection = null) {
  const rows = await query('SELECT * FROM rides WHERE id = ? LIMIT 1', [rideId], connection);
  const rideRow = rows[0];

  if (!rideRow) {
    return null;
  }

  const driver = options.includeDriver ? await Driver.findById(rideRow.driver_id, { includeUser: true }, connection) : null;
  const passengers = options.includePassengers
    ? await getPassengersForRide(rideId, { includeUsers: options.includePassengerUsers }, connection)
    : null;

  return mapRideRow(rideRow, { driver, passengers });
}

async function create(payload, connection = null) {
  const rows = await queryWithReturning(
    `
      INSERT INTO rides (
        driver_id,
        route_origin,
        route_destination,
        route_origin_latitude,
        route_origin_longitude,
        route_destination_latitude,
        route_destination_longitude,
        status,
        total_fare,
        commission,
        driver_earnings,
        started_at,
        completed_at,
        community_id,
        payment_status,
        payment_method,
        transaction_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
    [
      payload.driverId,
      payload.route.origin,
      payload.route.destination,
      payload.route.originCoords?.coordinates?.[1] ?? null,
      payload.route.originCoords?.coordinates?.[0] ?? null,
      payload.route.destinationCoords?.coordinates?.[1] ?? null,
      payload.route.destinationCoords?.coordinates?.[0] ?? null,
      payload.status || 'searching',
      payload.totalFare || 0,
      payload.commission || 0,
      payload.driverEarnings || 0,
      payload.startedAt || null,
      payload.completedAt || null,
      payload.communityId || null,
      payload.paymentStatus || 'pending',
      payload.paymentMethod || null,
      payload.transactionId || null,
    ],
    connection
  );

  const rideId = rows[0].id;

  if (Array.isArray(payload.passengers) && payload.passengers.length > 0) {
    for (const passenger of payload.passengers) {
      await addPassenger(rideId, passenger, connection);
    }
  }

  return findById(rideId, { includeDriver: true, includePassengers: true, includePassengerUsers: true }, connection);
}

async function addPassenger(rideId, passenger, connection = null) {
  const pickupCoordinates = passenger.pickupLocation?.coordinates || passenger.pickupLocation || [];
  const dropoffCoordinates = passenger.dropoffLocation?.coordinates || passenger.dropoffLocation || [];

  const rows = await queryWithReturning(
    `
      INSERT INTO ride_passengers (
        ride_id,
        user_id,
        pickup_latitude,
        pickup_longitude,
        dropoff_latitude,
        dropoff_longitude,
        pickup_address,
        dropoff_address,
        status,
        fare,
        distance,
        duration
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
    [
      rideId,
      passenger.userId,
      pickupCoordinates[1],
      pickupCoordinates[0],
      dropoffCoordinates[1],
      dropoffCoordinates[0],
      passenger.pickupAddress,
      passenger.dropoffAddress,
      passenger.status || 'pending',
      passenger.fare,
      passenger.distance,
      passenger.duration,
    ],
    connection
  );

  const resultRows = await query('SELECT * FROM ride_passengers WHERE id = ? LIMIT 1', [rows[0].id], connection);
  return mapRidePassengerRow(resultRows[0]);
}

async function updateById(rideId, updates, connection = null) {
  const current = await findById(rideId, {}, connection);
  if (!current) {
    return null;
  }

  const route = updates.route || current.route;

  await query(
    `
      UPDATE rides
      SET
        route_origin = ?,
        route_destination = ?,
        route_origin_latitude = ?,
        route_origin_longitude = ?,
        route_destination_latitude = ?,
        route_destination_longitude = ?,
        status = ?,
        total_fare = ?,
        commission = ?,
        driver_earnings = ?,
        started_at = ?,
        completed_at = ?,
        community_id = ?,
        payment_status = ?,
        payment_method = ?,
        transaction_id = ?
      WHERE id = ?
    `,
    [
      route.origin,
      route.destination,
      route.originCoords?.coordinates?.[1] ?? null,
      route.originCoords?.coordinates?.[0] ?? null,
      route.destinationCoords?.coordinates?.[1] ?? null,
      route.destinationCoords?.coordinates?.[0] ?? null,
      updates.status || current.status,
      updates.totalFare ?? current.totalFare,
      updates.commission ?? current.commission,
      updates.driverEarnings ?? current.driverEarnings,
      updates.startedAt ?? current.startedAt,
      updates.completedAt ?? current.completedAt,
      updates.communityId ?? current.community,
      updates.paymentStatus || current.paymentStatus,
      updates.paymentMethod ?? current.paymentMethod,
      updates.transactionId ?? current.transactionId,
      rideId,
    ],
    connection
  );

  return findById(rideId, { includeDriver: true, includePassengers: true, includePassengerUsers: true }, connection);
}

async function findHistoryForUser(userId, { completedOnly = false, limit = 20 } = {}, connection = null) {
  const rows = await query(
    `
      SELECT DISTINCT r.*
      FROM rides r
      INNER JOIN ride_passengers rp ON rp.ride_id = r.id
      WHERE rp.user_id = ?
        ${completedOnly ? "AND r.status = 'completed'" : ''}
      ORDER BY r.created_at DESC
      LIMIT ?
    `,
    [userId, limit],
    connection
  );

  const rides = [];
  for (const row of rows) {
    rides.push(
      await findById(row.id, { includeDriver: true, includePassengers: true, includePassengerUsers: true }, connection)
    );
  }

  return rides;
}

async function findHistoryForDriverUser(userId, { completedOnly = false, limit = 20 } = {}, connection = null) {
  const rows = await query(
    `
      SELECT DISTINCT r.*
      FROM rides r
      INNER JOIN drivers d ON d.id = r.driver_id
      WHERE d.user_id = ?
        ${completedOnly ? "AND r.status = 'completed'" : ''}
      ORDER BY r.created_at DESC
      LIMIT ?
    `,
    [userId, limit],
    connection
  );

  const rides = [];
  for (const row of rows) {
    rides.push(
      await findById(row.id, { includeDriver: true, includePassengers: true, includePassengerUsers: true }, connection)
    );
  }

  return rides;
}

module.exports = {
  addPassenger,
  create,
  findById,
  findHistoryForDriverUser,
  findHistoryForUser,
  getPassengersForRide,
  mapRidePassengerRow,
  mapRideRow,
  updateById,
};
