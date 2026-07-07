import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Image, File, X } from 'lucide-react';
import styles from './FileUpload.module.css';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

const ACCEPTED_STRING = Object.values(ACCEPTED_TYPES).flat().join(',');

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type) {
  if (type.startsWith('image/')) return Image;
  if (type.includes('pdf')) return FileText;
  if (type.includes('word') || type.includes('document')) return FileText;
  return File;
}

function validateFile(file) {
  if (file.size > MAX_FILE_SIZE) {
    return `"${file.name}" exceeds the 10MB limit`;
  }
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  const acceptedExts = Object.values(ACCEPTED_TYPES).flat();
  if (!acceptedExts.includes(ext)) {
    return `"${file.name}" has an unsupported file type`;
  }
  return null;
}

export default function FileUpload({ files, onFilesChange, disabled = false, label = 'Attachments' }) {
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
        // Could dispatch a toast from parent, but we just alert for now
        alert(invalid.join('\n'));
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
      <label className={styles.label}>{label}</label>

      {/* Drop Zone */}
      <div
        className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          or click to browse &middot; PDF, images, docs &middot; max 10MB each
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_STRING}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      {/* File List */}
      {files.length > 0 && (
        <div className={styles.fileList}>
          {files.map((file, index) => {
            const FileIcon = getFileIcon(file.type);
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
