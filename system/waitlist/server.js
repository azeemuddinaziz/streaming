const express = require("express");
const Database = require("better-sqlite3");
const cors = require("cors");

const app = express();
const PORT = 3002; // The port Nginx will proxy to

// Middleware to parse incoming JSON requests
app.use(cors());
app.use(express.json());

// Initialize SQLite database (creates 'waitlist.db' if it doesn't exist)
const db = new Database("waitlist.db");

// Create the table safely
db.exec(`
  CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// The POST endpoint to receive emails
app.post("/api/waitlist", (req, res) => {
  const { email } = req.body;

  // Basic validation
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  try {
    // Secure, parameterized query to prevent SQL injection
    const stmt = db.prepare("INSERT INTO emails (email) VALUES (?)");
    stmt.run(email);

    console.log(`Added to waitlist: ${email}`);
    res.status(200).json({ message: "Successfully joined the waitlist!" });
  } catch (err) {
    // Handle duplicate emails gracefully
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res
        .status(409)
        .json({ error: "Email is already on the waitlist" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Waitlist micro-server running on http://127.0.0.1:${PORT}`);
});
