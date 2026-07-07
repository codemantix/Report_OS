import { getAdminClient } from '../../../lib/supabaseAdmin';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = normalizeEmail(req.body?.email);
  const otp = String(req.body?.otp || '').trim();
  const newPassword = req.body?.password; // optional — only on third step

  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP code are required.' });
  }

  if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: 'Invalid OTP format.' });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getAdminClient();
  } catch {
    return res.status(500).json({ error: 'Authentication service unavailable.' });
  }

  // Find valid, unused, non-expired OTP
  const now = new Date().toISOString();

  const { data: resetRecord, error: fetchError } = await supabaseAdmin
    .from('password_resets')
    .select('*')
    .eq('email', email)
    .eq('otp', otp)
    .eq('used', false)
    .gte('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    return res.status(500).json({ error: 'Failed to verify code.' });
  }

  if (!resetRecord) {
    return res.status(400).json({ error: 'Invalid or expired code. Please request a new one.' });
  }

  // If this is step 2 (verify only, no password yet)
  if (!newPassword) {
    return res.status(200).json({ message: 'OTP verified.' });
  }

  // Step 3: verify AND update password
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  // Mark OTP as used
  await supabaseAdmin
    .from('password_resets')
    .update({ used: true })
    .eq('id', resetRecord.id);

  // Find the auth user and update password
  const { data: users } = await supabaseAdmin.auth.admin.listUsers();
  const authUser = users?.users?.find((u) => u.email === email);

  if (!authUser) {
    return res.status(404).json({ error: 'User account not found.' });
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    authUser.id,
    { password: newPassword }
  );

  if (updateError) {
    return res.status(500).json({ error: updateError.message || 'Failed to update password.' });
  }

  return res.status(200).json({ message: 'Password updated successfully.' });
}
