/**
 * TradeFourge Companion Extension v3.0 — Local Cache Module
 * Interface for chrome.storage.local persistence with in-memory fallback.
 */

import { Logger } from '../logger/Logger.js';

export class LocalCache {
  static inMemoryStore = {};

  static async get(key, defaultValue = null) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve) => {
          chrome.storage.local.get([key], (result) => {
            resolve(result && result[key] !== undefined ? result[key] : defaultValue);
          });
        });
      }
    } catch (err) {
      Logger.warn('LocalCache', `Failed reading chrome.storage.local for key: ${key}`, err);
    }
    return LocalCache.inMemoryStore[key] !== undefined ? LocalCache.inMemoryStore[key] : defaultValue;
  }

  static async set(key, value) {
    LocalCache.inMemoryStore[key] = value;
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve) => {
          chrome.storage.local.set({ [key]: value }, () => {
            resolve(true);
          });
        });
      }
    } catch (err) {
      Logger.warn('LocalCache', `Failed setting chrome.storage.local for key: ${key}`, err);
    }
    return true;
  }

  static async remove(key) {
    delete LocalCache.inMemoryStore[key];
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return new Promise((resolve) => {
          chrome.storage.local.remove([key], () => {
            resolve(true);
          });
        });
      }
    } catch (err) {
      Logger.warn('LocalCache', `Failed removing chrome.storage.local key: ${key}`, err);
    }
    return true;
  }
}
