/**
 * Storage provider factory.
 *
 * Returns the active StorageProvider based on the STORAGE_PROVIDER env var.
 * Defaults to 'google-drive' for backwards compatibility.
 *
 * To add a new provider:
 *  1. Implement StorageProvider in a new <name>-provider.ts file.
 *  2. Add a case to the switch statement below.
 *  3. Set STORAGE_PROVIDER=<name> in the environment.
 *
 * No page components, upload flows, or sync routes need to change.
 */
import type { StorageProvider } from './types';
import { GoogleDriveProvider } from './google-drive-provider';

let _provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (_provider) return _provider;

  const name = process.env.STORAGE_PROVIDER ?? 'google-drive';

  switch (name) {
    case 'google-drive':
      _provider = new GoogleDriveProvider();
      return _provider;

    default:
      throw new Error(
        `Unknown STORAGE_PROVIDER value: "${name}". ` +
        'Supported values: google-drive',
      );
  }
}
