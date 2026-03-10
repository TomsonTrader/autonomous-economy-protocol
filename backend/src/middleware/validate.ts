import { Request, Response, NextFunction } from "express";
import { ethers } from "ethers";

// ── Error response helper ────────────────────────────────────────────────

export function apiError(res: Response, code: string, message: string, status = 400) {
  return res.status(status).json({ error: true, code, message });
}

// ── Address validator ────────────────────────────────────────────────────

export function requireAddress(param: "params" | "body" | "query", field: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const value: string = (req as any)[param]?.[field];
    if (!value) return apiError(res, "MISSING_ADDRESS", `${field} is required`);
    if (!/^0x[0-9a-fA-F]{40}$/.test(value))
      return apiError(res, "INVALID_ADDRESS", `${field} must be a valid Ethereum address`);
    try { (req as any)[param][field] = ethers.getAddress(value); }
    catch { return apiError(res, "INVALID_ADDRESS", `${field} is not checksummed correctly`); }
    next();
  };
}

// ── Amount validator ─────────────────────────────────────────────────────

export function requirePositiveAmount(source: "body" | "query", field: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const raw: string = (req as any)[source]?.[field];
    if (raw === undefined || raw === null)
      return apiError(res, "MISSING_AMOUNT", `${field} is required`);
    try {
      const val = ethers.parseEther(String(raw));
      if (val <= 0n) throw new Error();
    } catch {
      return apiError(res, "INVALID_AMOUNT", `${field} must be a positive number (e.g. "10" or "0.5")`);
    }
    next();
  };
}

// ── String validator ─────────────────────────────────────────────────────

export function requireString(source: "body" | "query", field: string, maxLen = 256) {
  return (req: Request, res: Response, next: NextFunction) => {
    const val: string = (req as any)[source]?.[field];
    if (!val || typeof val !== "string" || val.trim().length === 0)
      return apiError(res, "MISSING_FIELD", `${field} is required and cannot be empty`);
    if (val.length > maxLen)
      return apiError(res, "FIELD_TOO_LONG", `${field} must be ${maxLen} chars or fewer`);
    next();
  };
}

// ── String array validator ───────────────────────────────────────────────

export function requireStringArray(source: "body", field: string, maxItems = 10, maxItemLen = 64) {
  return (req: Request, res: Response, next: NextFunction) => {
    const arr = (req as any)[source]?.[field];
    if (!Array.isArray(arr) || arr.length === 0)
      return apiError(res, "MISSING_ARRAY", `${field} must be a non-empty array`);
    if (arr.length > maxItems)
      return apiError(res, "ARRAY_TOO_LONG", `${field} can have at most ${maxItems} items`);
    for (const item of arr) {
      if (typeof item !== "string" || item.length > maxItemLen)
        return apiError(res, "INVALID_ARRAY_ITEM", `Each item in ${field} must be a string of max ${maxItemLen} chars`);
    }
    next();
  };
}

// ── Deadline validator ───────────────────────────────────────────────────

export function requireFutureDeadline(source: "body", field: string, minSecondsFromNow = 300) {
  return (req: Request, res: Response, next: NextFunction) => {
    const val = (req as any)[source]?.[field];
    if (val === undefined) return apiError(res, "MISSING_DEADLINE", `${field} is required`);
    const ts = Number(val);
    if (!Number.isFinite(ts)) return apiError(res, "INVALID_DEADLINE", `${field} must be a Unix timestamp`);
    if (ts < Math.floor(Date.now() / 1000) + minSecondsFromNow)
      return apiError(res, "DEADLINE_TOO_SOON", `${field} must be at least ${minSecondsFromNow}s in the future`);
    next();
  };
}

// ── Private key validator ────────────────────────────────────────────────

export function requirePrivateKey(req: Request, res: Response, next: NextFunction) {
  const key: string = req.body?.privateKey;
  if (!key) return apiError(res, "MISSING_PRIVATE_KEY", "privateKey is required", 401);
  if (!/^(0x)?[0-9a-fA-F]{64}$/.test(key))
    return apiError(res, "INVALID_PRIVATE_KEY", "privateKey must be a 32-byte hex string", 401);
  next();
}

// ── Sanitize string body fields (strip HTML tags) ────────────────────────

export function sanitizeBody(fields: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    for (const field of fields) {
      if (typeof req.body?.[field] === "string") {
        req.body[field] = req.body[field].replace(/<[^>]*>/g, "").trim();
      }
    }
    next();
  };
}
