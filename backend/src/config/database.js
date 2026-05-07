const { Pool } = require('pg');

let pool;

function getConfig() {
  return {
    host: process.env.DB_HOST ,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    max: Number(process.env.DB_CONNECTION_LIMIT || 10),
  };
}

async function initializeSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      phone_number VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('driver', 'passenger', 'admin')),
      email VARCHAR(255) NULL,
      profile_image TEXT NULL,
      settings_json JSONB NULL,
      rating DECIMAL(3,2) NOT NULL DEFAULT 0,
      total_ratings INT NOT NULL DEFAULT 0,
      is_verified BOOLEAN NOT NULL DEFAULT FALSE,
      is_online BOOLEAN NOT NULL DEFAULT FALSE,
      current_latitude DECIMAL(10,7) NULL,
      current_longitude DECIMAL(10,7) NULL,
      wallet_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
      wallet_currency VARCHAR(10) NOT NULL DEFAULT 'XAF',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'set_updated_at_users'
      ) THEN
        CREATE TRIGGER set_updated_at_users
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      END IF;
    END $$;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS communities (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      origin VARCHAR(255) NOT NULL,
      destination VARCHAR(255) NOT NULL,
      origin_latitude DECIMAL(10,7) NULL,
      origin_longitude DECIMAL(10,7) NULL,
      destination_latitude DECIMAL(10,7) NULL,
      destination_longitude DECIMAL(10,7) NULL,
      frequent_routes_json JSONB NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      member_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'set_updated_at_communities'
      ) THEN
        CREATE TRIGGER set_updated_at_communities
        BEFORE UPDATE ON communities
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      END IF;
    END $$;
  `);

  await client.query(`
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

  await client.query(`
    CREATE TABLE IF NOT EXISTS drivers (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      vehicle_type VARCHAR(20) NOT NULL DEFAULT 'car' CHECK (vehicle_type IN ('car', 'bike', 'minibus')),
      vehicle_model VARCHAR(255) NOT NULL,
      vehicle_plate_number VARCHAR(50) NOT NULL UNIQUE,
      vehicle_color VARCHAR(100) NOT NULL,
      license_number VARCHAR(100) NOT NULL,
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      current_route_origin VARCHAR(255) NULL,
      current_route_destination VARCHAR(255) NULL,
      current_route_origin_latitude DECIMAL(10,7) NULL,
      current_route_origin_longitude DECIMAL(10,7) NULL,
      current_route_destination_latitude DECIMAL(10,7) NULL,
      current_route_destination_longitude DECIMAL(10,7) NULL,
      current_waypoints_json JSONB NULL,
      current_ride_id INT NULL,
      max_passengers INT NOT NULL DEFAULT 3,
      current_passenger_count INT NOT NULL DEFAULT 0,
      total_earnings DECIMAL(12,2) NOT NULL DEFAULT 0,
      total_rides INT NOT NULL DEFAULT 0,
      rating DECIMAL(3,2) NOT NULL DEFAULT 0,
      is_premium BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_drivers_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'set_updated_at_drivers'
      ) THEN
        CREATE TRIGGER set_updated_at_drivers
        BEFORE UPDATE ON drivers
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      END IF;
    END $$;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS rides (
      id SERIAL PRIMARY KEY,
      driver_id INT NOT NULL,
      route_origin VARCHAR(255) NOT NULL,
      route_destination VARCHAR(255) NOT NULL,
      route_origin_latitude DECIMAL(10,7) NULL,
      route_origin_longitude DECIMAL(10,7) NULL,
      route_destination_latitude DECIMAL(10,7) NULL,
      route_destination_longitude DECIMAL(10,7) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'searching' CHECK (status IN ('searching', 'active', 'completed', 'cancelled')),
      total_fare DECIMAL(12,2) NOT NULL DEFAULT 0,
      commission DECIMAL(12,2) NOT NULL DEFAULT 0,
      driver_earnings DECIMAL(12,2) NOT NULL DEFAULT 0,
      started_at TIMESTAMP NULL,
      completed_at TIMESTAMP NULL,
      community_id INT NULL,
      payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
      payment_method VARCHAR(50) NULL,
      transaction_id VARCHAR(100) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_rides_driver
        FOREIGN KEY (driver_id) REFERENCES drivers(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_rides_community
        FOREIGN KEY (community_id) REFERENCES communities(id)
        ON DELETE SET NULL
    )
  `);

  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'set_updated_at_rides'
      ) THEN
        CREATE TRIGGER set_updated_at_rides
        BEFORE UPDATE ON rides
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      END IF;
    END $$;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS ride_passengers (
      id SERIAL PRIMARY KEY,
      ride_id INT NOT NULL,
      user_id INT NOT NULL,
      pickup_latitude DECIMAL(10,7) NOT NULL,
      pickup_longitude DECIMAL(10,7) NOT NULL,
      dropoff_latitude DECIMAL(10,7) NOT NULL,
      dropoff_longitude DECIMAL(10,7) NOT NULL,
      pickup_address VARCHAR(255) NOT NULL,
      dropoff_address VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'picked_up', 'dropped_off', 'cancelled')),
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

  await client.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      ride_id INT NULL,
      reviewer_id INT NOT NULL,
      reviewee_id INT NOT NULL,
      rating INT NOT NULL,
      comment TEXT NULL,
      reviewer_role VARCHAR(20) NOT NULL CHECK (reviewer_role IN ('passenger', 'driver')),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_reviews_ride
        FOREIGN KEY (ride_id) REFERENCES rides(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_reviews_reviewer
        FOREIGN KEY (reviewer_id) REFERENCES users(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_reviews_reviewee
        FOREIGN KEY (reviewee_id) REFERENCES users(id)
        ON DELETE CASCADE
    )
  `);
}

async function connectDB() {
  const config = getConfig();
  const bootstrapClient = new (require('pg').Client)({
    host: config.host,
    user: config.user,
    password: config.password,
    port: config.port,
  });

  await bootstrapClient.connect();
  const databaseName = process.env.DB_NAME || 'drively';

  try {
    const dbExists = await bootstrapClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [databaseName]
    );

    if (!dbExists.rows.length) {
      await bootstrapClient.query(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await bootstrapClient.end();
  }

  pool = new Pool(config);
  await pool.query('SELECT 1');

  const client = await pool.connect();
  try {
    await initializeSchema(client);
  } finally {
    client.release();
  }

  console.log(`PostgreSQL connected to ${config.database} on ${config.host}:${config.port}`);
  return pool;
}

function getPool() {
  if (!pool) {
    throw new Error('Database pool has not been initialized');
  }

  return pool;
}

function replacePlaceholders(sql, params) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function query(sql, params = [], connection = null) {
  const formattedSql = replacePlaceholders(sql, params);
  const executor = connection || getPool();
  const { rows } = await executor.query(formattedSql, params);
  return rows;
}

async function queryWithReturning(sql, params = [], connection = null) {
  const formattedSql = replacePlaceholders(sql, params);
  const executor = connection || getPool();
  const { rows } = await executor.query(formattedSql, params);
  return rows;
}

async function withTransaction(callback) {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  connectDB,
  getPool,
  query,
  queryWithReturning,
  withTransaction,
};
