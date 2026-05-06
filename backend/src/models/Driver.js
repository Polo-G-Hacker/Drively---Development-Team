const { query, queryWithReturning } = require('../config/database');
const { buildPoint, parseJsonField, toBoolean, toId, toNumber } = require('./helpers');
const User = require('./User');

function normalizeRoute(route = {}) {
  const originCoordinates = route.originCoords?.coordinates || route.originCoords || route.originCoordinates || null;
  const destinationCoordinates =
    route.destinationCoords?.coordinates || route.destinationCoords || route.destinationCoordinates || null;

  return {
    origin: route.origin || null,
    destination: route.destination || null,
    originCoords: Array.isArray(originCoordinates)
      ? {
          type: 'Point',
          coordinates: [toNumber(originCoordinates[0]), toNumber(originCoordinates[1])],
        }
      : null,
    destinationCoords: Array.isArray(destinationCoordinates)
      ? {
          type: 'Point',
          coordinates: [toNumber(destinationCoordinates[0]), toNumber(destinationCoordinates[1])],
        }
      : null,
    waypoints: Array.isArray(route.waypoints) ? route.waypoints : [],
  };
}

function mapDriverRow(row, { user = null } = {}) {
  if (!row) {
    return null;
  }

  return {
    _id: toId(row.id),
    id: toId(row.id),
    user: user || toId(row.user_id),
    vehicleType: row.vehicle_type,
    vehicleModel: row.vehicle_model,
    vehiclePlateNumber: row.vehicle_plate_number,
    vehicleColor: row.vehicle_color,
    licenseNumber: row.license_number,
    isAvailable: toBoolean(row.is_available),
    currentRoute: {
      origin: row.current_route_origin,
      destination: row.current_route_destination,
      originCoords: buildPoint(row.current_route_origin_longitude, row.current_route_origin_latitude),
      destinationCoords: buildPoint(row.current_route_destination_longitude, row.current_route_destination_latitude),
      waypoints: parseJsonField(row.current_waypoints_json, []),
    },
    currentRide: toId(row.current_ride_id),
    maxPassengers: toNumber(row.max_passengers, 3),
    currentPassengerCount: toNumber(row.current_passenger_count),
    totalEarnings: toNumber(row.total_earnings),
    totalRides: toNumber(row.total_rides),
    rating:
      user && typeof user === 'object' && user.rating !== undefined
        ? toNumber(user.rating)
        : toNumber(row.rating),
    isPremium: toBoolean(row.is_premium),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function enrichDriver(row, options = {}, connection = null) {
  if (!row) {
    return null;
  }

  const user = options.includeUser ? await User.findById(row.user_id, {}, connection) : null;
  return mapDriverRow(row, { user });
}

async function create(payload, connection = null) {
  const normalizedRoute = normalizeRoute(payload.currentRoute);

  const rows = await queryWithReturning(
    `
      INSERT INTO drivers (
        user_id,
        vehicle_type,
        vehicle_model,
        vehicle_plate_number,
        vehicle_color,
        license_number,
        is_available,
        current_route_origin,
        current_route_destination,
        current_route_origin_latitude,
        current_route_origin_longitude,
        current_route_destination_latitude,
        current_route_destination_longitude,
        current_waypoints_json,
        max_passengers,
        current_passenger_count,
        total_earnings,
        total_rides,
        rating,
        is_premium
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
    [
      payload.userId,
      payload.vehicleType || 'car',
      payload.vehicleModel,
      payload.vehiclePlateNumber,
      payload.vehicleColor,
      payload.licenseNumber || payload.vehiclePlateNumber,
      payload.isAvailable === undefined ? true : payload.isAvailable,
      normalizedRoute.origin,
      normalizedRoute.destination,
      normalizedRoute.originCoords?.coordinates?.[1] ?? null,
      normalizedRoute.originCoords?.coordinates?.[0] ?? null,
      normalizedRoute.destinationCoords?.coordinates?.[1] ?? null,
      normalizedRoute.destinationCoords?.coordinates?.[0] ?? null,
      JSON.stringify(normalizedRoute.waypoints),
      payload.maxPassengers || 3,
      payload.currentPassengerCount || 0,
      payload.totalEarnings || 0,
      payload.totalRides || 0,
      payload.rating || 0,
      payload.isPremium ? true : false,
    ],
    connection
  );

  return findById(rows[0].id, { includeUser: true }, connection);
}

async function findByUserId(userId, options = {}, connection = null) {
  const rows = await query('SELECT * FROM drivers WHERE user_id = ? LIMIT 1', [userId], connection);
  return enrichDriver(rows[0], options, connection);
}

async function findById(driverId, options = {}, connection = null) {
  const rows = await query('SELECT * FROM drivers WHERE id = ? LIMIT 1', [driverId], connection);
  return enrichDriver(rows[0], options, connection);
}

async function updateById(driverId, updates, connection = null) {
  const current = await findById(driverId, {}, connection);
  if (!current) {
    return null;
  }

  const normalizedRoute = normalizeRoute(updates.currentRoute || current.currentRoute);

  await query(
    `
      UPDATE drivers
      SET
        vehicle_type = ?,
        vehicle_model = ?,
        vehicle_plate_number = ?,
        vehicle_color = ?,
        license_number = ?,
        is_available = ?,
        current_route_origin = ?,
        current_route_destination = ?,
        current_route_origin_latitude = ?,
        current_route_origin_longitude = ?,
        current_route_destination_latitude = ?,
        current_route_destination_longitude = ?,
        current_waypoints_json = ?,
        current_ride_id = ?,
        max_passengers = ?,
        current_passenger_count = ?,
        total_earnings = ?,
        total_rides = ?,
        rating = ?,
        is_premium = ?
      WHERE id = ?
    `,
    [
      updates.vehicleType || current.vehicleType,
      updates.vehicleModel || current.vehicleModel,
      updates.vehiclePlateNumber || current.vehiclePlateNumber,
      updates.vehicleColor || current.vehicleColor,
      updates.licenseNumber || current.licenseNumber,
      updates.isAvailable === undefined ? current.isAvailable : updates.isAvailable,
      normalizedRoute.origin,
      normalizedRoute.destination,
      normalizedRoute.originCoords?.coordinates?.[1] ?? null,
      normalizedRoute.originCoords?.coordinates?.[0] ?? null,
      normalizedRoute.destinationCoords?.coordinates?.[1] ?? null,
      normalizedRoute.destinationCoords?.coordinates?.[0] ?? null,
      JSON.stringify(normalizedRoute.waypoints || []),
      updates.currentRide === undefined ? current.currentRide : updates.currentRide,
      updates.maxPassengers ?? current.maxPassengers,
      updates.currentPassengerCount ?? current.currentPassengerCount,
      updates.totalEarnings ?? current.totalEarnings,
      updates.totalRides ?? current.totalRides,
      updates.rating ?? current.rating,
      updates.isPremium === undefined ? current.isPremium : updates.isPremium,
      driverId,
    ],
    connection
  );

  return findById(driverId, { includeUser: Boolean(updates.includeUser) }, connection);
}

async function listAvailableWithRoutes(connection = null) {
  const rows = await query(
    `
      SELECT *
      FROM drivers
      WHERE is_available = 1
        AND current_route_origin_latitude IS NOT NULL
        AND current_route_origin_longitude IS NOT NULL
        AND current_route_destination_latitude IS NOT NULL
        AND current_route_destination_longitude IS NOT NULL
    `,
    [],
    connection
  );

  const users = await Promise.all(rows.map((row) => User.findById(row.user_id, {}, connection)));
  return rows.map((row, index) => mapDriverRow(row, { user: users[index] }));
}

async function listNearby({ latitude, longitude, radius = 5000 }, connection = null) {
  const rows = await query(
    `
      SELECT d.*, u.current_latitude, u.current_longitude
      FROM drivers d
      INNER JOIN users u ON u.id = d.user_id
      WHERE d.is_available = 1
        AND u.current_latitude IS NOT NULL
        AND u.current_longitude IS NOT NULL
    `,
    [],
    connection
  );

  const matches = rows.filter((row) => {
    const distance = calculateDistance(
      latitude,
      longitude,
      toNumber(row.current_latitude),
      toNumber(row.current_longitude)
    );

    return distance <= radius;
  });

  const users = await Promise.all(matches.map((row) => User.findById(row.user_id, {}, connection)));
  return matches.map((row, index) => mapDriverRow(row, { user: users[index] }));
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const radius = 6371e3;
  const lat1Radians = (lat1 * Math.PI) / 180;
  const lat2Radians = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Radians) * Math.cos(lat2Radians) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function listAll(options = {}, connection = null) {
  const rows = await query('SELECT * FROM drivers', [], connection);
  return Promise.all(rows.map(row => enrichDriver(row, options, connection)));
}

module.exports = {
  create,
  findById,
  findByUserId,
  listAll,
  listAvailableWithRoutes,
  listNearby,
  mapDriverRow,
  normalizeRoute,
  updateById,
};
