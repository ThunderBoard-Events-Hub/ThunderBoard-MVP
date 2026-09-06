/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
    pgm.addColumn("organizations", {
        approval_status: { type: "varchar(20)", notNull: true, default: "pending" },
    });

    pgm.addConstraint("organizations", "organizations_approval_status_check", {
        check: "approval_status IN ('pending', 'approved', 'rejected')",
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
    pgm.dropConstraint("organizations", "organizations_approval_status_check");
    pgm.dropColumn("organizations", "approval_status");
};
