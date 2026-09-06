/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // Auth is moving to Auth0 — organizations no longer hold their own password.
  // Existing rows are dev/test seed data with no real Auth0 account behind them,
  // so they can't be backfilled with a valid auth0_id; clear the tables instead.
  // events isn't reliably ON DELETE CASCADE from organizations in every environment,
  // so delete events (and their event_tags rows) first.
  pgm.sql("DELETE FROM event_tags");
  pgm.sql("DELETE FROM events");
  pgm.sql("DELETE FROM organizations");

  pgm.addColumn("organizations", {
    auth0_id: { type: "varchar(255)", notNull: true, unique: true },
  });

  pgm.dropColumn("organizations", "password_hash");
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.addColumn("organizations", {
    password_hash: { type: "varchar(255)", notNull: true, default: "" },
  });
  pgm.dropColumn("organizations", "auth0_id");
};
