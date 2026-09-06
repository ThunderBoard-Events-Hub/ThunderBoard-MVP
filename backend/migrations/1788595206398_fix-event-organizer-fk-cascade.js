/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * The original schema (see 1757000000000_init-schema.cjs) declared organizer_id as
 * ON DELETE CASCADE, but the live table's fk_event_organizer constraint was actually
 * created as NO ACTION — discovered when deleting an organization with events threw
 * a 23503 foreign key violation instead of cascading. This corrects the constraint
 * to match the original intent.
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
    pgm.dropConstraint("events", "fk_event_organizer");
    pgm.addConstraint("events", "fk_event_organizer", {
        foreignKeys: {
            columns: "organizer_id",
            references: "organizations(id)",
            onDelete: "CASCADE",
        },
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropConstraint("events", "fk_event_organizer");
    pgm.addConstraint("events", "fk_event_organizer", {
        foreignKeys: {
            columns: "organizer_id",
            references: "organizations(id)",
        },
    });
};
