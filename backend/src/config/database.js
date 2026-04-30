const mysql = require('mysql2/promise');
let pool;

function getConfig(includeDatabase = true) {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: Number(process.env.DB_PORT || 3306),
    multipleStatements: true,
  };

  if (includeDatabase) {
    config.database = process.env.DB_NAME || 'drively';
    config.waitForConnections = true;
    config.connectionLimit = Number(process.env.DB_CONNECTION_LIMIT || 10);
    config.queueLimit = 0;
  }

  return config;
}

async function initializeSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone_number VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role ENUM('driver', 'passenger', 'admin') NOT NULL,
      email VARCHAR(255) NULL,
      profile_image VARCHAR(255) NULL,
      rating DECIMAL(3,2) NOT NULL DEFAULT 0,
      total_ratings INT NOT NULL DEFAULT 0,
      is_verified TINYINT(1) NOT NULL DEFAULT 0,
      is_online TINYINT(1) NOT NULL DEFAULT 0,
      current_latitude DECIMAL(10,7) NULL,
      current_longitude DECIMAL(10,7) NULL,
      wallet_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
      wallet_currency VARCHAR(10) NOT NULL DEFAULT 'XAF',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS communities (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      origin VARCHAR(255) NOT NULL,
      destination VARCHAR(255) NOT NULL,
      origin_latitude DECIMAL(10,7) NULL,
      origin_longitude DECIMAL(10,7) NULL,
      destination_latitude DECIMAL(10,7) NULL,
      destination_longitude DECIMAL(10,7) NULL,
      frequent_routes_json JSON NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      member_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_communities (
      user_id INT NOT NULL,
      community_id INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, community_id),
      CONSTRAINT fk_user_communities_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_user_communities_community
        FOREIGN KEY (community_id) REFERENCES communities(id)
        ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS drivers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      vehicle_type ENUM('car', 'bike', 'minibus') NOT NULL DEFAULT 'car',
      vehicle_model VARCHAR(255) NOT NULL,
      vehicle_plate_number VARCHAR(50) NOT NULL UNIQUE,
      vehicle_color VARCHAR(100) NOT NULL,
      license_number VARCHAR(100) NOT NULL,
      is_available TINYINT(1) NOT NULL DEFAULT 1,
      current_route_origin VARCHAR(255) NULL,
      current_route_destination VARCHAR(255) NULL,
      current_route_origin_latitude DECIMAL(10,7) NULL,
      current_route_origin_longitude DECIMAL(10,7) NULL,
      current_route_destination_latitude DECIMAL(10,7) NULL,
      current_route_destination_longitude DECIMAL(10,7) NULL,
      current_waypoints_json JSON NULL,
      current_ride_id INT NULL,
      max_passengers INT NOT NULL DEFAULT 3,
      current_passenger_count INT NOT NULL DEFAULT 0,
      total_earnings DECIMAL(12,2) NOT NULL DEFAULT 0,
      total_rides INT NOT NULL DEFAULT 0,
      rating DECIMAL(3,2) NOT NULL DEFAULT 0,
      is_premium TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_drivers_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS rides (
      id INT AUTO_INCREMENT PRIMARY KEY,
      driver_id INT NOT NULL,
      route_origin VARCHAR(255) NOT NULL,
      route_destination VARCHAR(255) NOT NULL,
      route_origin_latitude DECIMAL(10,7) NULL,
      route_origin_longitude DECIMAL(10,7) NULL,
      route_destination_latitude DECIMAL(10,7) NULL,
      route_destination_longitude DECIMAL(10,7) NULL,
      status ENUM('searching', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'searching',
      total_fare DECIMAL(12,2) NOT NULL DEFAULT 0,
      commission DECIMAL(12,2) NOT NULL DEFAULT 0,
      driver_earnings DECIMAL(12,2) NOT NULL DEFAULT 0,
      started_at DATETIME NULL,
      completed_at DATETIME NULL,
      community_id INT NULL,
      payment_status ENUM('pending', 'paid', 'failed') NOT NULL DEFAULT 'pending',
      payment_method VARCHAR(50) NULL,
      transaction_id VARCHAR(100) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_rides_driver
        FOREIGN KEY (driver_id) REFERENCES drivers(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_rides_community
        FOREIGN KEY (community_id) REFERENCES communities(id)
        ON DELETE SET NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS ride_passengers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ride_id INT NOT NULL,
      user_id INT NOT NULL,
      pickup_latitude DECIMAL(10,7) NOT NULL,
      pickup_longitude DECIMAL(10,7) NOT NULL,
      dropoff_latitude DECIMAL(10,7) NOT NULL,
      dropoff_longitude DECIMAL(10,7) NOT NULL,
      pickup_address VARCHAR(255) NOT NULL,
      dropoff_address VARCHAR(255) NOT NULL,
      status ENUM('pending', 'accepted', 'picked_up', 'dropped_off', 'cancelled') NOT NULL DEFAULT 'pending',
      fare DECIMAL(12,2) NOT NULL,
      distance DECIMAL(12,2) NOT NULL,
      duration DECIMAL(12,2) NOT NULL,
      joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_ride_passengers_ride
        FOREIGN KEY (ride_id) REFERENCES rides(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_ride_passengers_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);
}

async function connectDB() {
  const bootstrapConnection = await mysql.createConnection(getConfig(false));
  const databaseName = process.env.DB_NAME || 'drively';

  try {
    await bootstrapConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await bootstrapConnection.end();
  }

  pool = mysql.createPool(getConfig(true));
  await pool.query('SELECT 1');
  await initializeSchema();

  const config = getConfig(true);
  console.log(`MySQL connected to ${config.database} on ${config.host}:${config.port}`);
  return pool;
}

function getPool() {
  if (!pool) {
    throw new Error('Database pool has not been initialized');
  }

  return pool;
}

async function query(sql, params = [], connection = null) {
  const executor = connection || getPool();
  const [rows] = await executor.query(sql, params);
  return rows;
}

async function withTransaction(callback) {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  connectDB,
  getPool,
  query,
  withTransaction,
};
