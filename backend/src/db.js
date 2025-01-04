const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../database.sqlite'));

function init() {
  db.run(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playerName TEXT NOT NULL,
      score INTEGER NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function saveScore(playerName, score) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO scores (playerName, score) VALUES (?, ?)',
      [playerName, score],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function getTopScores(limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM scores ORDER BY score DESC LIMIT ?',
      [limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

module.exports = {
  init,
  saveScore,
  getTopScores
};
