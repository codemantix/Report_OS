import { getAdminClient } from '../../../lib/supabaseAdmin';

function isStrongPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const fullName = String(req.body?.full_name || '').trim();
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');

  if (!fullName) {
    return res.status(400).json({ error: 'Full name is required.' });
  }

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({
      error: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.',
    });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = getAdminClient();
  } catch (error) {
    return res.status(500).json({ error: 'Registration service is not configured.' });
  }

  const { data: existingProfile } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingProfile) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  });

  if (authError || !authData?.user) {
    const message = authError?.message || 'Unable to create account.';
    const lowerMessage = message.toLowerCase();
    const status = lowerMessage.includes('already') || lowerMessage.includes('registered') ? 409 : 500;

    return res.status(status).json({
      error: message,
      hint: status === 500
        ? 'Check Supabase Auth logs. Signup failures can be caused by SMTP/email template errors or Auth database hooks.'
        : undefined,
    });
  }

  const { error: profileError } = await supabaseAdmin.from('users').insert({
    id: authData.user.id,
    email,
    full_name: fullName,
    role: 'team_member',
    status: 'active',
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

    return res.status(500).json({
      error: profileError.message || 'Account was created, but profile setup failed.',
      hint: 'The auth user was rolled back. Check the users table schema, constraints, and migration status.',
    });
  }

  return res.status(201).json({
    user: {
      id: authData.user.id,
      email,
      full_name: fullName,
      role: 'team_member',
      status: 'active',
    },
  });
}
