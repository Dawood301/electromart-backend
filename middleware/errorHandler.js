// middleware/errorHandler.js
// Central error handler — always returns consistent JSON

const errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${err.stack || err.message}`);

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'A record with that value already exists.' });
  }

  // express-validator passes an array of errors via next()
  if (Array.isArray(err)) {
    return res.status(422).json({ success: false, errors: err });
  }

  const status  = err.statusCode || 500;
  const message = err.message    || 'Internal server error';
  res.status(status).json({ success: false, message });
};

module.exports = errorHandler;
