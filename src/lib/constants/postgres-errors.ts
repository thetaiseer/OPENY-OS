// PostgreSQL error codes used across API routes

/** Relation (table/view) does not exist — migration not yet applied */
export const PG_UNDEFINED_TABLE = '42P01';

/** Unique constraint violation — duplicate key */
export const PG_UNIQUE_VIOLATION = '23505';

/** Column does not exist — schema drift between envs */
export const PG_UNDEFINED_COLUMN = '42703';
