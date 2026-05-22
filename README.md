# CVDL Moodle — Q&A Explorer

A **zero-dependency, single-page web app** for studying Computer Vision & Deep Learning questions. Features real-time live search (no Enter required), topic filter pills, and a modal that reveals the correct answer.

## 📂 File Structure

```
cvdlMoodle/
├── index.html        ← Main app shell
├── style.css         ← Dark glassmorphism design
├── app.js            ← Live search, filter & modal logic
└── questions.json    ← Your questions (edit this freely)
```

## 🚀 Running Locally

Since the app fetches `questions.json` via `fetch()`, you need a simple HTTP server (not just opening `index.html` directly due to CORS):

```bash
# Python (built-in)
python -m http.server 8080

# Node.js (npx)
npx serve .

# VS Code: use "Live Server" extension
```

Then open [http://localhost:8080](http://localhost:8080).

## 🌐 Deploying

### GitHub Pages (free, recommended)
1. Push this folder to a GitHub repository
2. Go to **Settings → Pages** → set source to `main` branch, `/` root
3. Your site will be live at `https://<username>.github.io/<repo-name>/`

### Netlify / Vercel
Drag and drop the folder into [netlify.com/drop](https://netlify.com/drop) — done instantly.

## ✏️ Adding Questions

Edit `questions.json`. Each question follows this schema:

```json
{
  "question_id": 9,
  "topic": "Your Topic Here",
  "question": "Full question text?",
  "options": {
    "a": "First option",
    "b": "Second option",
    "c": "Third option",
    "d": "Fourth option"
  },
  "correct_answer": "b",
  "text_answer": "A more detailed explanation of the answer"
}
```

## 🔍 Search Features

- **Live filter** — results update as you type, zero delay
- **Multi-word search** — "conv layers" finds questions containing both words
- **Ctrl+F** — intercepted and focused to the search bar
- **Topic pills** — filter by topic (multi-select supported)
- **Highlighted matches** — search terms are highlighted inside cards
