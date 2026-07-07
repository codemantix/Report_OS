/**
 * Upload a single file to Cloudinary via unsigned upload.
 * @param {File} file - The file to upload
 * @returns {Promise<{name: string, size: number, type: string, url: string, publicId: string}>}
 */
export async function uploadFile(file) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || 'Upload failed');
  }

  const result = await response.json();

  return {
    name: file.name,
    size: file.size,
    type: file.type,
    url: result.secure_url,
    publicId: result.public_id,
    format: result.format,
    originalName: result.original_filename,
  };
}

/**
 * Upload multiple files to Cloudinary sequentially.
 * @param {File[]} files - Array of files to upload
 * @param {function} [onProgress] - Called with { uploaded, total } after each file
 * @returns {Promise<Array>} Array of upload results
 */
export async function uploadFiles(files, onProgress = () => {}) {
  const results = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    try {
      const result = await uploadFile(files[i]);
      results.push(result);
    } catch (err) {
      results.push({ name: files[i].name, error: err.message });
    }
    onProgress({ uploaded: i + 1, total });
  }

  return results;
}

/**
 * Delete a file from Cloudinary by publicId.
 * Note: This requires a server-side API route since the deletion
 * needs the Cloudinary API secret. For MVP, files can remain uploaded.
 * @param {string} publicId
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteUploadedFile(publicId) {
  // For unsigned uploads, deletion requires a signed request via a server API.
  // For MVP, we skip deletion. Files will remain in Cloudinary.
  console.warn('Cloudinary deletion requires a server-side API route. File retained:', publicId);
  return { success: false, message: 'Server-side deletion not implemented in MVP' };
}
