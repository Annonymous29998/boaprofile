require('dotenv').config();

const app = require('../server/app');

module.exports = function handler(req, res) {
    return app(req, res);
};
