import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import practiceRoutes from "./routes/practice.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/api/v1/health', (_req, res) => {
  console.log('Health check success');
  res.status(200).json({ status: 'ok' });
});

// Routes
app.use('/api/v1/practice', practiceRoutes);

// Serve static web files (Expo web export)
// Look for client/dist in multiple possible locations
const webDistCandidates = [
  path.resolve(__dirname, 'web'),                          // bundled: dist/web (inside server dist)
  path.resolve(process.cwd(), 'dist', 'web'),              // prod FaaS: cwd/dist/web
  path.resolve(__dirname, '..', 'client', 'dist'),         // dev: server/src/ -> ../client/dist
  path.resolve(process.cwd(), '..', 'client', 'dist'),     // prod: server dir -> ../client/dist
];

const webDistPath = webDistCandidates.find(p => fs.existsSync(path.join(p, 'index.html')));

if (webDistPath) {
  console.log(`[Web] Serving static files from: ${webDistPath}`);
  app.use(express.static(webDistPath));

  // SPA fallback: all non-API routes serve index.html
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(webDistPath, 'index.html'));
  });
} else {
  console.log('[Web] No static web files found, running in API-only mode');
}

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/`);
});
