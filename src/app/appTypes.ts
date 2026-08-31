export type { HistoryState } from '../domain/types';

export interface StorageHealthView {
  available: boolean;
  reason: string;
}
