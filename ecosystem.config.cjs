// Compatibility entry point. Keep one canonical PM2 configuration so runtime
// and environment handling cannot drift between .js and .cjs files.
module.exports = require('./ecosystem.config.js');
