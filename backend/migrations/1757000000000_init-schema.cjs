exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("organizations", {
    id: "id",
    name: { type: "varchar(255)", notNull: true, unique: true },
    email: { type: "varchar(255)", notNull: true, unique: true },
    password_hash: { type: "varchar(255)", notNull: true },
    description: { type: "text" },
    image_url: { type: "text" },
    followers_count: { type: "integer", default: 0 },
    created_at: { type: "timestamptz", default: pgm.func("current_timestamp") },
  });

  pgm.createTable("events", {
    id: "id",
    organizer_id: {
      type: "integer",
      notNull: true,
      references: "organizations",
      onDelete: "CASCADE",
    },
    title: { type: "varchar(255)", notNull: true },
    description: { type: "text" },
    start_date: { type: "date", notNull: true },
    start_time: { type: "time" },
    end_time: { type: "time" },
    location: { type: "varchar(255)" },
    image_url: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("current_timestamp") },
    updated_at: { type: "timestamptz" },
    status: { type: "varchar(20)", default: "draft" },
  });

  pgm.createTable("tags", {
    id: "id",
    name: { type: "varchar(255)", unique: true },
  });

  pgm.createTable(
    "event_tags",
    {
      event_id: {
        type: "integer",
        notNull: true,
        references: "events",
        onDelete: "CASCADE",
      },
      tag_id: {
        type: "integer",
        notNull: true,
        references: "tags",
        onDelete: "CASCADE",
      },
    },
    {
      constraints: {
        primaryKey: ["event_id", "tag_id"],
      },
    }
  );
};

exports.down = (pgm) => {
  pgm.dropTable("event_tags");
  pgm.dropTable("tags");
  pgm.dropTable("events");
  pgm.dropTable("organizations");
};

// Ran it with --fake so your local DB is marked as 
// having this migration applied without re-running the DDL — your existing data is untouched.

// Going forward: any schema change/creation should be 
// npm run migrate:create <name> -> give a descriptive name for the migration, e.g. "add-users-table" and it will generate a query file you can edit
// edit the generated file, 
// then npm run migrate:up. 
// 
// On a fresh database (e.g. Heroku),
//  running migrate:up for real (no --fake) will build the whole schema from scratch.
// On a genuinely fresh database (nothing in pgmigrations, no tables), you'd run the real 
// migrate:up (no --fake) and it would create everything for the first time.

// migrate:down will undo the last migration, and migrate:reset will undo all migrations.
