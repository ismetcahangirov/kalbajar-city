// Shared with the sign-in form, which must not import the database code in ./throttle.

/** Failed sign-ins in a row that lock an address (#9: "ten failed logins"). */
export const maxFailures = 10;
export const lockMinutes = 15;
