/**
 * Simple validation utility for request bodies.
 * @param {Object} data - The request body.
 * @param {Object} schema - The validation rules.
 * @returns {Object|null} - Returns an object with an error message if invalid, otherwise null.
 */
const validateRequest = (data, schema) => {
  for (const field in schema) {
    const rules = schema[field];
    const value = data[field];

    if (rules.required && (value === undefined || value === null || value === "")) {
      return { message: `${field.replace(/_/g, " ")} is required.` };
    }

    if (value !== undefined && value !== null && value !== "") {
      if (rules.minLength && value.length < rules.minLength) {
        return { message: `${field.replace(/_/g, " ")} must be at least ${rules.minLength} characters.` };
      }

      if (rules.pattern && !rules.pattern.test(value)) {
        return { message: `Invalid ${field.replace(/_/g, " ")} format.` };
      }

      if (rules.type === "number" && isNaN(Number(value))) {
        return { message: `${field.replace(/_/g, " ")} must be a number.` };
      }
      
      if (rules.enum && !rules.enum.includes(value)) {
        return { message: `Invalid value for ${field.replace(/_/g, " ")}.` };
      }
    }
  }
  return null;
};

module.exports = { validateRequest };
