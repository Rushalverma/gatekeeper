-- ─────────────────────────────────────────────────────────────────────────────
-- API Gateway SaaS — Database Schema
-- Run: mysql -u root -p gateway_saas < config/schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS gateway_saas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gateway_saas;

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               CHAR(36)      NOT NULL DEFAULT (UUID()),
  email            VARCHAR(255)  NOT NULL,
  password_hash    VARCHAR(255)  NOT NULL,
  subscription_tier ENUM('FREE', 'PRO', 'ENTERPRISE') NOT NULL DEFAULT 'FREE',
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- ─── API Keys ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  key_id      VARCHAR(80)  NOT NULL,
  user_id     CHAR(36)     NOT NULL,
  status      ENUM('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (key_id),
  CONSTRAINT fk_apikeys_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── Request Logs (Analytics) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS request_logs (
  log_id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  key_id           VARCHAR(80)     NOT NULL,
  endpoint_accessed VARCHAR(500)   NOT NULL,
  status_code      SMALLINT        NOT NULL,
  response_time_ms INT             DEFAULT NULL,
  timestamp        TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id),
  -- Soft FK: key may be revoked/deleted but logs are retained
  KEY idx_logs_key_id   (key_id),
  KEY idx_logs_timestamp (timestamp)
) ENGINE=InnoDB;
