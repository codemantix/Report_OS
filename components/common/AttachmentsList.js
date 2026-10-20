import {
  FileText,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  File as FileIcon,
  Download,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { getAttachmentCategory } from '../../utils/attachmentFileTypes';
import styles from './AttachmentsList.module.css';

export function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageAttachment(att) {
  return getAttachmentCategory(att) === 'image';
}

export function getFileIcon(att) {
  const category = getAttachmentCategory(att);
  if (category === 'image') return ImageIcon;
  if (category === 'spreadsheet') return FileSpreadsheet;
  if (category === 'presentation') return Presentation;
  if (category === 'document') return FileText;
  return FileIcon;
}

// Forces a "download" Content-Disposition for Cloudinary-hosted files so the
// browser saves the file instead of navigating to it. Falls back to the raw
// URL for any other host (the native `download` attribute still applies for
// same-origin resources).
function getDownloadUrl(url, filename) {
  if (!url) return url;
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    const baseName = filename ? filename.replace(/\.[^/.]+$/, '') : '';
    const flag = baseName ? `fl_attachment:${encodeURIComponent(baseName)}` : 'fl_attachment';
    return url.replace('/upload/', `/upload/${flag}/`);
  }
  return url;
}

/**
 * Parses the raw `attachments` value stored on a task/goal/plan/report
 * (JSON string or already-parsed array) into a normalized array. Safe to
 * call with null/undefined/malformed input.
 */
export function parseAttachments(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Renders the attachments of a task, goal, plan, or report as a grid of
 * cards, each offering a "View" (opens in a new tab) and "Download" (forces
 * a save) action. Attachments that failed to upload (no `url`, only an
 * `error`) are shown in a muted, actionless state.
 */
export default function AttachmentsList({ attachments }) {
  const items = parseAttachments(attachments);
  if (items.length === 0) return null;

  const validItems = items.filter((a) => a.url && !a.error);
  const failedItems = items.filter((a) => a.error);

  if (validItems.length === 0 && failedItems.length === 0) return null;

  return (
    <div className={styles.grid}>
      {validItems.map((att, index) => {
        const Icon = getFileIcon(att);
        const displayName = att.originalName || att.name || `Attachment ${index + 1}`;
        const downloadUrl = getDownloadUrl(att.url, displayName);

        return (
          <div key={att.publicId || att.url || index} className={styles.card}>
            <div className={styles.preview}>
              {isImageAttachment(att) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={att.url} alt={displayName} className={styles.thumb} />
              ) : (
                <Icon className={styles.fileIconLg} />
              )}
            </div>
            <div className={styles.info}>
              <p className={styles.name} title={displayName}>{displayName}</p>
              {att.size != null && <p className={styles.size}>{formatFileSize(att.size)}</p>}
            </div>
            <div className={styles.actions}>
              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.actionBtn}
                title="View attachment"
                aria-label={`View ${displayName}`}
              >
                <Eye className="w-4 h-4" />
              </a>
              <a
                href={downloadUrl}
                download={displayName}
                className={styles.actionBtn}
                title="Download attachment"
                aria-label={`Download ${displayName}`}
              >
                <Download className="w-4 h-4" />
              </a>
            </div>
          </div>
        );
      })}

      {failedItems.map((att, index) => (
        <div key={`failed-${index}`} className={styles.cardFailed}>
          <div className={styles.preview}>
            <AlertTriangle className={styles.fileIconLg} />
          </div>
          <div className={styles.info}>
            <p className={styles.name} title={att.name}>{att.name || 'Unknown file'}</p>
            <p className={styles.errorText}>Upload failed</p>
          </div>
        </div>
      ))}
    </div>
  );
}
