export interface SyncRequestResult {
  status: number;
  json: Record<string, any>;
}

export function getSyncStore(): unknown;
export function handleSyncRequest(params: {
  pathname: string;
  searchParams: URLSearchParams;
  method: string;
  body: any;
  getOrCreateSession: (room: string) => string;
  verifyAdminToken: (token: string) => boolean;
}): SyncRequestResult | null;
