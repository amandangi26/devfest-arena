export function errorHandler(err, req, res, next) {
  // eslint-disable-next-line no-unused-vars
  const unused = next;
  console.error('[ServerError]', err);

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    error: {
      code: err.code || (status === 401 ? 'UNAUTHORIZED' : 'INTERNAL_ERROR'),
      message: status === 500 && process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : message,
    },
  });
}
