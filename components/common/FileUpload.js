import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, FileSpreadsheet, Presentation, Image, File, X } from 'lucide-react';
import styles from './FileUpload.module.css';
import toast from 'react-hot-toast';
import {
  ATTACHMENT_ACCEPT_VALUE,
  getAttachmentCategory,
  isSupportedAttachmentName,
} from '../../utils/attachmentFileTypes';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(file) {
  const category = getAttachmentCategory(file);
  if (category === 'image') return Image;
  if (category === 'spreadsheet') return FileSpreadsheet;
  if (category === 'presentation') return Presentation;
  if (category === 'document') return FileText;
  return File;
}

function validateFile(file) {
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" exceeds the 10MB limit`;
  }
  if (!isSupportedAttachmentName(file.name)) {
    return `"${file.name}" has an unsupported file type`;
  }
  return null;
}

export default function FileUpload({ files, onFilesChange, disabled = false, label = 'Attachments', required = false, error = '' }) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback(
    (newFiles) => {
      const valid = [];
      const invalid = [];

      for (const file of newFiles) {
        const error = validateFile(file);
        if (error) {
          invalid.push(error);
        } else {
          valid.push(file);
        }
      }

      if (invalid.length > 0) {
        toast.error(invalid.join('\n'));
      }

      if (valid.length > 0) {
        onFilesChange([...files, ...valid]);
      }
    },
    [files, onFilesChange]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (disabled) return;

      const droppedFiles = Array.from(e.dataTransfer.files);
      handleFiles(droppedFiles);
    },
    [disabled, handleFiles]
  );

  const handleDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setDragActive(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
    },
    []
  );

  const handleBrowse = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  }, [disabled]);

  const handleInputChange = useCallback(
    (e) => {
      const selectedFiles = Array.from(e.target.files || []);
      handleFiles(selectedFiles);
      // Reset input so the same file can be selected again
      e.target.value = '';
    },
    [handleFiles]
  );

  const removeFile = useCallback(
    (index) => {
      onFilesChange(files.filter((_, i) => i !== index));
    },
    [files, onFilesChange]
  );

  return (
    <div className={styles.wrapper}>
      <label className={styles.label}>
        {label}{required && <span className={styles.requiredMark}> *</span>}
      </label>

      {/* Drop Zone */}
      <div
        className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ''} ${error ? styles.dropZoneError : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleBrowse}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleBrowse();
        }}
        aria-label="Upload file attachment"
      >
        <Upload className={styles.dropIcon} />
        <p className={styles.dropText}>
          {dragActive ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className={styles.dropHint}>
          or click to browse &middot; PDF, images, Word, Excel, PowerPoint, OpenDocument &amp; text files &middot; max 10MB each
        </p>
      </div>

      {error && <p className={styles.errorText}>{error}</p>}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT_VALUE}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      {/* File List */}
      {files.length > 0 && (
        <div className={styles.fileList}>
          {files.map((file, index) => {
            const FileIcon = getFileIcon(file);
            return (
              <div key={`${file.name}-${index}`} className={styles.fileItem}>
                <div className={styles.fileInfo}>
                  <span className={styles.fileIcon}>
                    <FileIcon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className={styles.fileName}>{file.name}</p>
                    <p className={styles.fileSize}>{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  disabled={disabled}
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
