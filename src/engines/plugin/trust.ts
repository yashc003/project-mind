import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import logger from '../../utils/logger.js';
import { getProjectMindVersion } from '../../utils/version.js';

interface TrustedPluginInfo {
  trusted: boolean;
  sha256: string | null;
  trustedAt: string;
  projectMindVersion: string;
}

interface TrustRegistry {
  trustedPlugins: Record<string, TrustedPluginInfo>;
}

const getTrustFilePath = (): string => {
  if (process.env.PROJECT_MIND_TRUST_PATH) {
    return process.env.PROJECT_MIND_TRUST_PATH;
  }
  return path.join(os.homedir(), '.project-mind', 'trust.json');
};

const ensureTrustFile = async (): Promise<void> => {
  const trustFile = getTrustFilePath();
  const dir = path.dirname(trustFile);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {}

  try {
    await fs.access(trustFile);
  } catch {
    await fs.writeFile(trustFile, JSON.stringify({ trustedPlugins: {} }, null, 2), 'utf-8');
  }
};

const computeFileHash = async (filePath: string): Promise<string | null> => {
  try {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  } catch {
    return null; // Might be a remote npm package
  }
};

export const getTrustedPlugins = async (): Promise<Record<string, TrustedPluginInfo>> => {
  await ensureTrustFile();
  const trustFile = getTrustFilePath();
  try {
    const content = await fs.readFile(trustFile, 'utf-8');
    const data = JSON.parse(content) as TrustRegistry;
    return data.trustedPlugins || {};
  } catch {
    return {};
  }
};

export const isPluginTrusted = async (pluginIdentifier: string): Promise<boolean> => {
  const trusted = await getTrustedPlugins();
  const info = trusted[pluginIdentifier];
  
  if (!info || !info.trusted) return false;

  // Verify hash if it's a local file
  if (info.sha256) {
    const currentHash = await computeFileHash(pluginIdentifier);
    if (currentHash !== info.sha256) {
      logger.error(`\n⚠ Plugin Tampering Detected!`);
      logger.info(`Plugin: ${pluginIdentifier}`);
      logger.info(`The file contents have changed since you last trusted it.`);
      logger.info(`Trust has been automatically revoked. To re-trust: npx project-mind plugin trust ${pluginIdentifier}\n`);
      return false;
    }
  }

  return true;
};

export const trustPlugin = async (pluginIdentifier: string): Promise<void> => {
  await ensureTrustFile();
  const trustFile = getTrustFilePath();
  
  // Try to compute hash (if local file)
  const sha256 = await computeFileHash(pluginIdentifier);

  try {
    const content = await fs.readFile(trustFile, 'utf-8');
    const data = JSON.parse(content) as TrustRegistry;
    if (!data.trustedPlugins) {
      data.trustedPlugins = {};
    }
    
    data.trustedPlugins[pluginIdentifier] = {
      trusted: true,
      sha256,
      trustedAt: new Date().toISOString(),
      projectMindVersion: getProjectMindVersion()
    };
    
    await fs.writeFile(trustFile, JSON.stringify(data, null, 2), 'utf-8');
    logger.success(`Successfully trusted plugin: ${pluginIdentifier}`);
    if (sha256) {
      logger.info(`Fingerprint (SHA-256): ${sha256}`);
    }
  } catch (error: any) {
    logger.error(`Failed to trust plugin: ${error.message}`);
  }
};

export const untrustPlugin = async (pluginIdentifier: string): Promise<void> => {
  await ensureTrustFile();
  const trustFile = getTrustFilePath();
  try {
    const content = await fs.readFile(trustFile, 'utf-8');
    const data = JSON.parse(content) as TrustRegistry;
    if (data.trustedPlugins && data.trustedPlugins[pluginIdentifier]) {
      delete data.trustedPlugins[pluginIdentifier];
      await fs.writeFile(trustFile, JSON.stringify(data, null, 2), 'utf-8');
      logger.success(`Successfully untrusted plugin: ${pluginIdentifier}`);
    }
  } catch (error: any) {
    logger.error(`Failed to untrust plugin: ${error.message}`);
  }
};
