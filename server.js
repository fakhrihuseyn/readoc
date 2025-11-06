const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const NOTES_DIR = path.join(__dirname, 'notes');

if (!fs.existsSync(NOTES_DIR)) fs.mkdirSync(NOTES_DIR, { recursive: true });

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({ limit: '1mb' }));

// List notes
app.get('/api/notes', (req, res) => {
  fs.readdir(NOTES_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: 'failed to read notes' });
    const notes = files.filter(f => f.endsWith('.md')).map(f => ({ id: f, title: f.replace(/\.md$/, '') }));
    res.json(notes);
  });
});

// Read note
app.get('/api/notes/:id', (req, res) => {
  const id = req.params.id;
  const file = path.join(NOTES_DIR, id);
  if (!file.startsWith(NOTES_DIR)) return res.status(400).json({ error: 'invalid id' });
  fs.readFile(file, 'utf8', (err, data) => {
    if (err) return res.status(404).json({ error: 'note not found' });
    res.json({ id, content: data });
  });
});

// Save (create/update) note
app.post('/api/notes/:id', (req, res) => {
  const id = req.params.id;
  const content = req.body.content || '';
  // sanitize id to prevent directory traversal
  const safeName = path.basename(id);
  const file = path.join(NOTES_DIR, safeName);
  fs.writeFile(file, content, 'utf8', (err) => {
    if (err) return res.status(500).json({ error: 'failed to save' });
    res.json({ ok: true, id: safeName });
  });
});

// Create new note with title
app.post('/api/notes', (req, res) => {
  const title = req.body.title || 'untitled';
  const safe = title.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');
  const filename = safe + '.md';
  const file = path.join(NOTES_DIR, filename);
  if (fs.existsSync(file)) return res.status(400).json({ error: 'note exists' });
  fs.writeFile(file, '# ' + title + '\n', 'utf8', (err) => {
    if (err) return res.status(500).json({ error: 'failed to create' });
    res.json({ ok: true, id: filename });
  });
});

// Delete note
app.delete('/api/notes/:id', (req, res) => {
  const id = req.params.id;
  const safeName = path.basename(id);
  const file = path.join(NOTES_DIR, safeName);
  if (!file.startsWith(NOTES_DIR)) return res.status(400).json({ error: 'invalid id' });
  fs.unlink(file, (err) => {
    if (err) return res.status(404).json({ error: 'not found or failed to delete' });
    res.json({ ok: true });
  });
});

// Rename note
app.post('/api/notes/:id/rename', (req, res) => {
  const id = req.params.id;
  const newTitle = req.body.title;
  if (!newTitle) return res.status(400).json({ error: 'missing title' });
  const safeOld = path.basename(id);
  const safeNewBase = newTitle.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');
  const newFilename = safeNewBase + '.md';
  const oldPath = path.join(NOTES_DIR, safeOld);
  const newPath = path.join(NOTES_DIR, newFilename);
  if (!oldPath.startsWith(NOTES_DIR) || !newPath.startsWith(NOTES_DIR)) return res.status(400).json({ error: 'invalid names' });
  fs.rename(oldPath, newPath, (err) => {
    if (err) return res.status(500).json({ error: 'rename failed' });
    res.json({ ok: true, id: newFilename });
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`App running at http://localhost:${port}`));
