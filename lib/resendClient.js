let resendClient;

export function getResendClient() {
  if (resendClient) return resendClient;

  const { Resend } = require('resend');
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn('Resend API key not configured');
    return null;
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}
