const express = require("express");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();
const PORT = 3000;
const SECRET_KEY = "your_secret_key";

const users = {
  admin: { password: "adminpass", type: "admin" },
  regular: { password: "regularpass", type: "regular" },
};

const regularCsv = "regularUser.csv";
const adminCsv = "adminUser.csv";

app.use(bodyParser.json());

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (users[username] && password === users[username].password) {
    const token = jwt.sign({ username }, SECRET_KEY);
    res.json(token);
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

const authenticateToken = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.user = user;
    next();
  });
};

app.get("/home", authenticateToken, (req, res) => {
  const userType = users[req.user.username].type;

  let books = [];

  if (userType === "regular") {
    books = getBooksFromCsv(regularCsv);
  } else if (userType === "admin") {
    books = [...getBooksFromCsv(regularCsv), ...getBooksFromCsv(adminCsv)];
  }

  res.json({ books });
});

app.post("/addBook", authenticateToken, (req, res) => {
  const userType = users[req.user.username].type;

  if (userType !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { bookName, author, publicationYear } = req.body;

  if (
    typeof bookName !== "string" ||
    typeof author !== "string" ||
    isNaN(publicationYear)
  ) {
    return res.status(400).json({ error: "Invalid parameters" });
  }

  // Add the book to adminUser.csv
  appendToCsv(regularCsv, `${bookName},${author},${publicationYear}`);

  res.json({ success: true });
});

app.delete("/deleteBook", authenticateToken, (req, res) => {
  const userType = users[req.user.username].type;

  if (userType !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { bookName } = req.body;

  if (typeof bookName !== "string") {
    return res.status(400).json({ error: "Invalid parameters" });
  }

  // Remove the book from adminUser.csv
  removeFromCsv(regularCsv, bookName);

  res.json({ success: true });
});

// Helper function to read books from CSV
const getBooksFromCsv = (csvFile) => {
  const books = [];
  try {
    const fileContent = fs.readFileSync(csvFile, "utf-8");
    const rows = fileContent.split("\n");
    for (const row of rows) {
      if(row!=="BookName,Author,PublicationYear"){
        const [bookName] = row.split(",");
        if (bookName != "") books.push(bookName);
      }
    }
  } catch (error) {
    console.error("Error reading CSV file:", error.message);
  }
  return books;
};

// Helper function to append data to CSV
const appendToCsv = (csvFile, data) => {
  try {
    fs.appendFileSync(csvFile, `${data}\n`);
  } catch (error) {
    console.error("Error appending to CSV file:", error.message);
  }
};

// Helper function to remove data from CSV
const removeFromCsv = (csvFile, bookNameToRemove) => {
  try {
    const fileContent = fs.readFileSync(csvFile, "utf-8");
    const rows = fileContent.split("\n");
    const updatedRows = rows.filter((row, index) => {
      if (index === 0) {
        // Keep the header row
        return true;
      }
      if(index!=0){
        const [bookName] = row.split(",");
        return bookName.toLowerCase() !== bookNameToRemove.toLowerCase();
      }
    });
    fs.writeFileSync(csvFile, updatedRows.join("\n"));
  } catch (error) {
    console.error("Error removing from CSV file:", error.message);
  }
};

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
