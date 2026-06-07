export const capitialize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

const NAME_REGEX = /^[a-zA-ZÀ-ÿ\s'\-]+$/;
export const isValidPersonName = (v) => !v || NAME_REGEX.test(v);
export const NAME_ERROR = "Name may only contain letters, spaces, hyphens, and apostrophes";