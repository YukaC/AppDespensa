export function requirePin(req, res, next) {
  const pin = req.headers['x-admin-pin'] || req.body?.pin;
  const expected = process.env.ADMIN_PIN || '1234';
  if (pin === expected) return next();
  res.status(401).json({ error: 'PIN requerido o incorrecto' });
}
