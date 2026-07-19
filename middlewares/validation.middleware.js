/**
 * Middleware to validate that request body fields are simple, non-empty strings.
 * This prevents NoSQL injection attacks where nested query objects (e.g. { $gt: "" })
 * are passed instead of strings.
 */
function validateStringFields(fields) {
    return (req, res, next) => {
        for (const field of fields) {
            const value = req.body[field];
            
            // If the field is present, check that it is a plain string
            if (value !== undefined && value !== null) {
                if (typeof value !== 'string') {
                    return res.status(400).send(`Security Error: Invalid input type for ${field}.`);
                }
                // Prevent empty/whitespace-only values for required inputs
                if (value.trim() === '') {
                    return res.status(400).send(`Input Error: ${field} cannot be blank.`);
                }
            } else {
                // If it's a required field and missing, return error
                return res.status(400).send(`Input Error: Missing required field ${field}.`);
            }
        }
        next();
    };
}

module.exports = {
    validateStringFields
};
