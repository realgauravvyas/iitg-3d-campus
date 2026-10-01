// Roll numbers: BSc students have 11 digits, every other student has 9. One place decides what is valid,
// so OneStop and the hostel's visitors' register agree.
export const ROLL_LABEL = 'Roll number (9 digits, or 11 for BSc)';
export const ROLL_PLACEHOLDER = '214101001';
export const ROLL_ERROR = 'The roll number has 9 digits (11 for BSc students), like 214101001 or 23015004512.';
export const ROLL_MAX = 11;

/** digits only, at most 11 */
export const cleanRoll = (s) => String(s ?? '').replace(/\D/g, '').slice(0, ROLL_MAX);
export const isRoll = (s) => /^(\d{9}|\d{11})$/.test(String(s ?? ''));
