// Support BigInt serialization in JSON responses
BigInt.prototype.toJSON = function () {
  return Number(this);
};

export function sendSuccess(
  res,
  data,
  message,
  statusCode = 200,
  pagination
) {
  const response = {
    success: true,
    data,
    ...(message && { message }),
    ...(pagination && { pagination }),
  };
  return res.status(statusCode).json(response);
}

export function sendError(
  res,
  message,
  statusCode = 500,
  error
) {
  const response = {
    success: false,
    message,
    ...(error && { error }),
  };
  return res.status(statusCode).json(response);
}

export function getPagination(page, limit) {
  const pageNum = Math.max(1, parseInt(page || '1', 10));
  const limitNum = Math.min(500, Math.max(1, parseInt(limit || '50', 10)));
  const skip = (pageNum - 1) * limitNum;
  return { page: pageNum, limit: limitNum, skip };
}
