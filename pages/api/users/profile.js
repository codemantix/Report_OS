import { getAuthenticatedUser } from '../../../lib/apiAuth';
import { updateCurrentUserProfile } from '../../../services/userService';
import { hasValidationErrors, validateProfilePayload } from '../../../utils/validationHelpers';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const currentUser = await getAuthenticatedUser(req, res);
    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const validationErrors = validateProfilePayload({ ...currentUser, ...payload });

    if (hasValidationErrors(validationErrors)) {
      return res.status(400).json({
        error: 'Please correct the invalid profile information.',
        fields: validationErrors,
      });
    }

    const { data, error } = await updateCurrentUserProfile(currentUser.id, payload);
    if (error) {
      console.error('Profile update failed:', error.message);
      return res.status(500).json({ error: 'Failed to update profile.' });
    }

    return res.status(200).json({
      success: true,
      profile: data,
    });
  } catch (error) {
    console.error('Profile update API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
