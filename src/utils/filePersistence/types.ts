// Stub for filePersistence types and constants
export interface FilePersistenceConfig {
  enabled: boolean;
  path?: string;
}

export interface FilePersistenceState {
  files: Map<string, string>;
  lastModified: Map<string, number>;
}

export const DEFAULT_UPLOAD_CONCURRENCY = 5;
export const FILE_COUNT_LIMIT = 100;
export const OUTPUTS_SUBDIR = 'outputs';
