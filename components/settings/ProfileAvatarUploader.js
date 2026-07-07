import { useRef } from 'react';
import { Camera, Trash2, Upload } from 'lucide-react';
import { validateAvatarFile } from '../../utils/validationHelpers';
import styles from './Settings.module.css';
import Image from 'next/image';

function getInitials(profile) {
  const source = profile?.display_name || profile?.full_name || profile?.email || 'User';
  return source
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function ProfileAvatarUploader({ profile, avatarUrl, uploading, onUpload, onRemove }) {
  const inputRef = useRef(null);

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const error = validateAvatarFile(file);
    if (error) {
      onUpload(null, error);
      event.target.value = '';
      return;
    }

    onUpload(file);
    event.target.value = '';
  }

  return (
    <div className={styles.avatarCard}>
      <div className={styles.avatarWrap}>
        <div className={styles.avatarPreview}>
          {avatarUrl ? (
            <Image src={avatarUrl} alt="Profile avatar" className={styles.avatarImage} width={112} height={112} />
          ) : (
            <span>{getInitials(profile)}</span>
          )}
        </div>

        <p className={styles.avatarTitle}>Profile photo</p>
        <p className={styles.avatarHint}>JPG, PNG or WebP. Maximum 2MB.</p>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={styles.fileInput}
          onChange={handleFileChange}
        />

        <div className={styles.avatarActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Upload size={16} /> : <Camera size={16} />}
            {uploading ? 'Uploading...' : avatarUrl ? 'Change photo' : 'Upload photo'}
          </button>

          {avatarUrl && (
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={onRemove}
              disabled={uploading}
            >
              <Trash2 size={16} />
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
