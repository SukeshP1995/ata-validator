'use strict';

// Public subpath: `ata-validator/build`
// Re-exports the programmatic build API. The CLI in bin/ata.js is a thin
// wrapper around the same module.
module.exports = require('./lib/aot-build');
