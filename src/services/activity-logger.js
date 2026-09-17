import mysql from "mysql2/promise";

const createTableSql = `
  CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_name VARCHAR(64) NOT NULL,
    yahoo_user_id VARCHAR(255) NULL,
    display_name VARCHAR(255) NULL,
    route VARCHAR(128) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code SMALLINT UNSIGNED NULL,
    metadata JSON NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    INDEX idx_activity_created_at (created_at),
    INDEX idx_activity_user_created (yahoo_user_id, created_at),
    INDEX idx_activity_event_created (event_name, created_at)
  ) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`;

const insertSql = `
  INSERT INTO activity_logs
    (event_name, yahoo_user_id, display_name, route, method, status_code, metadata)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;

export class ActivityLogger {
  constructor(config, pool = null) {
    const mysqlConfig = config.mysql || {};
    const hasDatabaseConfig = Boolean(
      mysqlConfig.host && mysqlConfig.database && mysqlConfig.user && mysqlConfig.password
    );

    this.enabled = Boolean(pool || hasDatabaseConfig);
    this.pool = pool || (this.enabled ? mysql.createPool({
      host: mysqlConfig.host,
      port: mysqlConfig.port || 3306,
      database: mysqlConfig.database,
      user: mysqlConfig.user,
      password: mysqlConfig.password,
      waitForConnections: true,
      connectionLimit: mysqlConfig.connectionLimit || 5,
      maxIdle: mysqlConfig.connectionLimit || 5,
      idleTimeout: 60_000,
      queueLimit: 0,
      enableKeepAlive: true
    }) : null);
    this.warningShown = false;
    this.schemaReady = this.enabled ? this.initialize() : Promise.resolve(false);
  }

  async initialize() {
    try {
      await this.pool.query(createTableSql);
      return true;
    } catch (error) {
      this.warn(error);
      return false;
    }
  }

  async log({ eventName, route, req, res, session, metadata = null }) {
    if (!this.enabled || !(await this.schemaReady)) return;

    const profile = session?.profile || {};
    const values = [
      limitText(eventName, 64),
      limitText(profile.sub, 255),
      limitText(profile.name || profile.given_name || profile.nickname, 255),
      limitText(route, 128) || "/",
      limitText(req?.method, 10) || "GET",
      validStatusCode(res?.statusCode),
      serializeMetadata(metadata)
    ];

    try {
      await this.pool.execute(insertSql, values);
    } catch (error) {
      this.warn(error);
    }
  }

  warn(error) {
    if (this.warningShown) return;
    this.warningShown = true;
    console.warn(`Activity logging is unavailable: ${error.message}`);
  }
}

function limitText(value, length) {
  if (value === undefined || value === null || value === "") return null;
  return String(value).slice(0, length);
}

function validStatusCode(value) {
  return Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
}

function serializeMetadata(metadata) {
  if (metadata === undefined || metadata === null) return null;
  try {
    return JSON.stringify(metadata);
  } catch {
    return null;
  }
}

