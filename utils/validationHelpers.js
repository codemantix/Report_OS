export const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_MAX_SIZE = 2 * 1024 * 1024;

export function isValidPhoneNumber(value) {
  if (!value) return true;
  const normalized = String(value).trim();
  return /^[+]?[(]?[0-9\s().-]{7,20}$/.test(normalized);
}

export function validateAvatarFile(file) {
  if (!file) return null;

  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
    return 'Avatar must be a JPG, PNG, or WebP image.';
  }

  if (file.size > AVATAR_MAX_SIZE) {
    return 'Avatar file must not exceed 2MB.';
  }

  return null;
}

export function validateProfilePayload(values) {
  const errors = {};
  const fullName = String(values.full_name || '').trim();
  const displayName = String(values.display_name || '').trim();
  const phoneNumber = String(values.phone_number || '').trim();
  const jobTitle = String(values.job_title || '').trim();
  const bio = String(values.bio || '').trim();

  if (!fullName) {
    errors.full_name = 'Full name is required.';
  } else if (fullName.length < 2) {
    errors.full_name = 'Full name must be at least 2 characters.';
  }

  if (displayName.length > 50) {
    errors.display_name = 'Display name must not be more than 50 characters.';
  }

  if (phoneNumber && !isValidPhoneNumber(phoneNumber)) {
    errors.phone_number = 'Enter a valid phone number.';
  }

  if (jobTitle.length > 80) {
    errors.job_title = 'Job title must not be more than 80 characters.';
  }

  if (bio.length > 300) {
    errors.bio = 'Bio must not be more than 300 characters.';
  }

  return errors;
}

export function hasValidationErrors(errors) {
  return Object.values(errors || {}).some(Boolean);
}
