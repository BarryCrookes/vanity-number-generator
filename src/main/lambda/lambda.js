const VanityNumberGenerator = require('./VanityNumberGenerator');

/**
 * Entry point handler
 * @param {Object} event - Lex event
 * @returns
 */
exports.handler = async (event, context) => {

  const response = new VanityNumberGenerator(event).execute();

  return response;

};
