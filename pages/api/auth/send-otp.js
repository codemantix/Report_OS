import { getAdminClient } from '../../../lib/supabaseAdmin';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = normalizeEmail(req.body?.email);

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getAdminClient();
  } catch {
    return res.status(500).json({ error: 'Authentication service unavailable.' });
  }

  // Look up the user from the public users table by email
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (profileError) {
    console.error('Error looking up user profile:', profileError);
    return res.status(500).json({ error: 'Failed to verify account.' });
  }

  if (!profile) {
    return res.status(404).json({ error: 'No account found with this email address.' });
  }

  // Verify the auth user actually exists (uses the ID from the users table)
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(profile.id);

  if (authError || !authUser?.user) {
    console.error('Auth user lookup error:', authError || 'User not found');
    return res.status(404).json({ error: 'No account found with this email address.' });
  }

  // Mark any previous OTPs for this email as used
  await supabaseAdmin
    .from('password_resets')
    .update({ used: true })
    .eq('email', email)
    .eq('used', false);

  // Generate and store new OTP
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error: insertError } = await supabaseAdmin
    .from('password_resets')
    .insert({ email, otp, expires_at: expiresAt, used: false });

  if (insertError) {
    console.error('Failed to store OTP:', insertError);
    return res.status(500).json({ error: 'Failed to generate reset code.' });
  }

  // If Resend is not configured, return the OTP for development
  if (!resend) {
    console.warn(`Resend not configured. Development OTP for ${email}: ${otp}`);
    return res.status(200).json({ message: 'OTP sent.', devOtp: otp });
  }

  const fromEmail = process.env.FROM_EMAIL || 'noreply@codemantix.com';
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Codemantix';

  try {
    const emailResult = await resend.emails.send({
      from: `${appName} <${fromEmail}>`,
      to: email,
      subject: `${appName} — Your Password Reset Code`,
      html: `<div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
        <h1 style="font-size:22px;font-weight:600;margin:0 0 16px 0;">Password Reset Code</h1>
        <p style="font-size:15px;color:#374151;margin:0 0 24px 0;">
          Use the code below to reset your password. It expires in <strong>15 minutes</strong>.
        </p>
        <div style="background:#F3F4F6;border-radius:12px;padding:24px;text-align:center;letter-spacing:8px;font-size:36px;font-weight:700;color:#1E3A8A;">
          ${otp.split('').join(' ')}
        </div>
        <p style="font-size:13px;color:#6B7280;margin:24px 0 0 0;text-align:center;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>`,
    });

    console.log('Resend send result:', JSON.stringify(emailResult));
  } catch (emailError) {
    console.error('Resend send error:', emailError?.message || emailError);
    return res.status(502).json({
      error: 'Failed to send the email. Check that FROM_EMAIL is a verified sender in Resend.',
      detail: emailError?.message || 'Unknown email error',
    });
  }

  return res.status(200).json({ message: 'OTP sent.' });
}
