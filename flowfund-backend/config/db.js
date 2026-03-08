const mysql = require('mysql2/promise');
const { getPoolConfig, connectionUrl } = require('./dbConfig');

const config = getPoolConfig();
const pool =
  typeof config === 'string'
    ? mysql.createPool(config, { timezone: '+00:00' })
    : mysql.createPool(config);
module.exports = pool;
