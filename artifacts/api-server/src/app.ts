import path from "path";
import fs from "fs";
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Enable trust proxy for cloud deployment (Railway, Render, AWS, Fly.io, Cloudflare)
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const possibleStaticDirs = [
  process.env.STATIC_DIR,
  path.resolve(process.cwd(), "artifacts/lifeos/dist/public"),
  path.resolve(import.meta.dirname, "../../lifeos/dist/public"),
  path.resolve(import.meta.dirname, "../../../artifacts/lifeos/dist/public"),
].filter((d): d is string => Boolean(d && fs.existsSync(d)));

const staticDir = possibleStaticDirs[0];

// Serve static assets directly (CSS, JS, images) before API-specific middlewares
if (staticDir) {
  app.use(express.static(staticDir, { index: false }));
}

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

const rawAllowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

const isOriginAllowed = (origin: string | undefined, hostHeader?: string, forwardedHost?: string): boolean => {
  if (!origin) return true;
  if (process.env.NODE_ENV !== "production") return true;

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.host;

    // Allow same-origin requests (direct host or cloud reverse-proxy host)
    if (hostHeader && originHost === hostHeader) return true;
    if (forwardedHost && originHost === forwardedHost.split(",")[0].trim()) return true;

    // Automatically allow Render deployments
    if (originHost.endsWith(".onrender.com")) return true;

    // Allow explicitly configured origins
    if (rawAllowedOrigins.some((allowed) => allowed === origin || allowed === originUrl.origin)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
};

// Apply CORS with dynamic host inspection (never throw unhandled 500 error)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const host = req.headers.host;
  const forwardedHost = req.headers["x-forwarded-host"] as string | undefined;

  if (isOriginAllowed(origin, host, forwardedHost)) {
    cors({
      credentials: true,
      origin: origin || true,
    })(req, res, next);
  } else {
    next();
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req) => req.path === "/healthz",
  message: { error: "Too many requests, please try again later." },
});

app.use(
  clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  }),
);

app.use("/api", apiLimiter, router);

// SPA client routing fallback (injects runtime Clerk publishable key into index.html)
if (staticDir) {
  const indexPath = path.join(staticDir, "index.html");
  let cachedIndexHtml: string | null = null;

  const getTransformedIndexHtml = () => {
    const rawHtml = fs.readFileSync(indexPath, "utf-8");
    const clerkKey =
      process.env.CLERK_PUBLISHABLE_KEY ||
      process.env.VITE_CLERK_PUBLISHABLE_KEY ||
      "";
    if (clerkKey) {
      const sanitizedKey = JSON.stringify(clerkKey);
      const scriptTag = `<script>window.__CLERK_PUBLISHABLE_KEY__ = ${sanitizedKey};</script>`;
      if (rawHtml.includes("<head>")) {
        return rawHtml.replace("<head>", `<head>\n    ${scriptTag}`);
      }
      return rawHtml.includes("</head>")
        ? rawHtml.replace("</head>", `${scriptTag}</head>`)
        : `${scriptTag}${rawHtml}`;
    }
    return rawHtml;
  };

  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      try {
        if (!cachedIndexHtml || process.env.NODE_ENV !== "production") {
          cachedIndexHtml = getTransformedIndexHtml();
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(cachedIndexHtml);
        return;
      } catch (err) {
        logger.error({ err }, "Failed to serve index.html");
        res.sendFile(indexPath);
        return;
      }
    }
    next();
  });
}

export default app;
