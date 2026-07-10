import { Eye, X } from 'lucide-react';
import FileUpload from './FileUpload';
import { formatFileSize, getFileIcon } from './AttachmentsList';
import styles from './AttachmentsField.module.css';

/**
 * Form-facing attachments control. Combines:
 *  - A list of already-uploaded attachments (from `initialData`), each with
 *    a "View" link and a remove (x) button.
 *  - A `FileUpload` dropzone for adding new files, uploaded on submit.
 *
 * The parent form owns both pieces of state and is responsible for merging
 * `existingAttachments` (after removals) with the freshly uploaded files
 * before saving.
 */
export default function AttachmentsField({
  existingAttachments = [],
  onRemoveExisting,
  newFiles,
  onNewFilesChange,
  disabled = false,
  label = 'Attachments',
}) {
  return (
    <div className={styles.wrapper}>
      {existingAttachments.length > 0 && (
        <div className={styles.existingList}>
          {existingAttachments.map((att, index) => {
            const Icon = getFileIcon(att);
            const displayName = att.originalName || att.name || `Attachment ${index + 1}`;
            return (
              <div key={att.publicId || att.url || index} className={styles.existingItem}>
                <Icon className={styles.existingIcon} />
                <div className={styles.existingInfo}>
                  <p className={styles.existingName} title={displayName}>{displayName}</p>
                  {att.size != null && <p className={styles.existingSize}>{formatFileSize(att.size)}</p>}
                </div>
                {att.url && (
                  <a
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.existingActionBtn}
                    title="View attachment"
                    aria-label={`View ${displayName}`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </a>
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onRemoveExisting(index)}
                    className={styles.existingRemoveBtn}
                    title="Remove attachment"
                    aria-label={`Remove ${displayName}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <FileUpload
        files={newFiles}
        onFilesChange={onNewFilesChange}
        disabled={disabled}
        label={existingAttachments.length > 0 ? 'Add more files' : label}
      />
    </div>
  );
}
