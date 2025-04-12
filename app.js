import { readFile, writeFile } from "fs/promises";
import { createServer } from "http";
import path, { resolve, join } from "path";
import crypto from "crypto";
import { link } from "fs";

const __dirname = resolve();
const PORT = 0.0.0.0;
const DATA_FILE = path.join("data", "links.json");

// Load existing links from file
const loadLinks = async () => {
    try {
        const Data = await readFile(DATA_FILE, "utf-8");

        if (!Data.trim()) return {};

        return JSON.parse(Data);
    } catch (error) {
        if (error.code === "ENOENT") {
            await writeFile(DATA_FILE, JSON.stringify({}), "utf-8"); // Ensure file is created
            return {};
        }
        throw error;
    }
};

// Save links to file
const saveLinks = async (links) => {
    await writeFile(DATA_FILE, JSON.stringify(links, null, 2), "utf-8");
};

const server = createServer(async (req, res) => {
    if (req.method === "GET") {
        if (req.url === "/links") {
            try {
                const links = await loadLinks();
                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify(links));
            } catch (error) {
                res.writeHead(500, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ error: "Failed to load links" }));
            }
        }else{
            const links = await loadLinks()
            const shortCode = req.url.slice(1)
            if(links[shortCode]){
                res.writeHead(302,{location:links[shortCode]})
               return  res.end()
            }
            // res.writeHead(404, { "Content-Type": "text/plain" });
            // return res.end("404 Page Not Found");
        }

        let filePath = join(__dirname, "public", "index.html");
        try {
            const data = await readFile(filePath, "utf-8");
            res.writeHead(200, { "Content-Type": "text/html" });
            return res.end(data);
        } catch (error) {
            console.error("Error reading file:", error.message);
            res.writeHead(404, { "Content-Type": "text/html" });
            return res.end("404 Page Not Found");
        }
    }

    if (req.method === "POST" && req.url === "/shorten") {
        const links = await loadLinks();
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

                if (links[finalShortCode]) {
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    return res.end("SHORT CODE already exists");
                }

                links[finalShortCode] = url;
                await saveLinks(links);

                res.writeHead(200, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ success: true, shortCode: finalShortCode }));
            } catch (error) {
                res.writeHead(400, { "Content-Type": "application/json" });
                return res.end(JSON.stringify({ success: false, error: "Invalid JSON input" }));
            }
        });
    }
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
