import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

// Get proper __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use environment variable for PORT
const PORT = process.env.PORT || 3006;

// Use absolute path for data directory
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "links.json");

// Ensure data directory exists before trying to use it
const ensureDataDirExists = async () => {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
    console.log(`Created data directory at: ${DATA_DIR}`);
  }
};

// Load existing links from file
const loadLinks = async () => {
  try {
    await ensureDataDirExists(); // Make sure directory exists first
    
    try {
      const data = await readFile(DATA_FILE, "utf-8");
      if (!data.trim()) return {};
      return JSON.parse(data);
    } catch (error) {
      if (error.code === "ENOENT") {
        await writeFile(DATA_FILE, JSON.stringify({}), "utf-8");
        console.log(`Created empty links file at: ${DATA_FILE}`);
        return {};
      }
      throw error;
    }
  } catch (error) {
    console.error(`Error in loadLinks: ${error.message}`);
    throw error;
  }
};

// Save links to file
const saveLinks = async (links) => {
  try {
    await ensureDataDirExists(); // Ensure directory exists
    await writeFile(DATA_FILE, JSON.stringify(links, null, 2), "utf-8");
  } catch (error) {
    console.error(`Error saving links: ${error.message}`);
    throw error;
  }
};

const server = createServer(async (req, res) => {
  // Set CORS headers to allow all origins
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === "GET") {
    if (req.url === "/links") {
      try {
        const links = await loadLinks();
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(links));
      } catch (error) {
        console.error(`Error fetching links: ${error.message}`);
        res.writeHead(500, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Failed to load links" }));
      }
    } else {
      try {
        const links = await loadLinks();
        const shortCode = req.url.slice(1);
        
        if (links[shortCode]) {
          res.writeHead(302, { Location: links[shortCode] });
          return res.end();
        }
        
        // Serve the index.html file if no redirect found
        const filePath = path.join(__dirname, "public", "index.html");
        try {
          const data = await readFile(filePath, "utf-8");
          res.writeHead(200, { "Content-Type": "text/html" });
          return res.end(data);
        } catch (error) {
          console.error(`Error reading file: ${error.message}`);
          res.writeHead(404, { "Content-Type": "text/html" });
          return res.end("404 Page Not Found");
        }
      } catch (error) {
        console.error(`Error processing request: ${error.message}`);
        res.writeHead(500, { "Content-Type": "text/plain" });
        return res.end("Internal Server Error");
      }
    }
  }

  if (req.method === "POST" && req.url === "/shorten") {
    try {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          console.log("Received Data:", body);
          const { url, shortCode } = JSON.parse(body);
          
          if (!url) {
            res.writeHead(400, { "Content-Type": "text/plain" });
            return res.end("URL IS REQUIRED !!");
          }
          
          const finalShortCode = shortCode || crypto.randomBytes(4).toString("hex");
          const links = await loadLinks();
          
          if (links[finalShortCode]) {
            res.writeHead(400, { "Content-Type": "text/plain" });
            return res.end("SHORT CODE already exists");
          }
          
          links[finalShortCode] = url;
          await saveLinks(links);
          
          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ success: true, shortCode: finalShortCode }));
        } catch (error) {
          console.error(`Error processing POST data: ${error.message}`);
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ success: false, error: "Invalid JSON input" }));
        }
      });
    } catch (error) {
      console.error(`Error in POST handler: ${error.message}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ success: false, error: "Server error" }));
    }
  } else if (req.method === "POST") {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ success: false, error: "Endpoint not found" }));
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
