import { resolveFriaStaffFromToken } from '../../lib/resolveTenant.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  const staff = await resolveFriaStaffFromToken(token);
  if (!staff) {
    return res.status(200).json({ isStaff: false });
  }

  return res.status(200).json({ isStaff: true, name: staff.name });
}
