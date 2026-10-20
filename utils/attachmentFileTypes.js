export const IMAGE_FILE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
];

export const DOCUMENT_FILE_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.odt',
  '.rtf',
  '.txt',
  '.md',
  '.pages',
];

export const SPREADSHEET_FILE_EXTENSIONS = [
  '.xls',
  '.xlsx',
  '.csv',
  '.tsv',
  '.ods',
  '.numbers',
];

export const PRESENTATION_FILE_EXTENSIONS = [
  '.ppt',
  '.pptx',
  '.odp',
  '.key',
];

export const ACCEPTED_ATTACHMENT_EXTENSIONS = [
  ...IMAGE_FILE_EXTENSIONS,
  ...DOCUMENT_FILE_EXTENSIONS,
  ...SPREADSHEET_FILE_EXTENSIONS,
  ...PRESENTATION_FILE_EXTENSIONS,
];

export const ATTACHMENT_ACCEPT_VALUE = ACCEPTED_ATTACHMENT_EXTENSIONS.join(',');

export function getFileExtension(name = '') {
  const normalizedName = String(name).trim().toLowerCase();
  const dotIndex = normalizedName.lastIndexOf('.');
  return dotIndex > -1 ? normalizedName.slice(dotIndex) : '';
}

export function isSupportedAttachmentName(name) {
  return ACCEPTED_ATTACHMENT_EXTENSIONS.includes(getFileExtension(name));
}

export function getAttachmentCategory({ name = '', type = '', format = '' } = {}) {
  const normalizedType = String(type).toLowerCase();
  const normalizedFormat = String(format).toLowerCase().replace(/^\./, '');
  const extension = getFileExtension(name) || (normalizedFormat ? `.${normalizedFormat}` : '');

  if (normalizedType.startsWith('image/') || IMAGE_FILE_EXTENSIONS.includes(extension)) {
    return 'image';
  }
  if (
    normalizedType.includes('spreadsheet')
    || normalizedType.includes('excel')
    || normalizedType.includes('csv')
    || SPREADSHEET_FILE_EXTENSIONS.includes(extension)
  ) {
    return 'spreadsheet';
  }
  if (
    normalizedType.includes('presentation')
    || normalizedType.includes('powerpoint')
    || PRESENTATION_FILE_EXTENSIONS.includes(extension)
  ) {
    return 'presentation';
  }
  if (
    normalizedType.includes('pdf')
    || normalizedType.includes('word')
    || normalizedType.includes('document')
    || normalizedType.startsWith('text/')
    || DOCUMENT_FILE_EXTENSIONS.includes(extension)
  ) {
    return 'document';
  }
  return 'file';
}
