# Pulse — Social Media Dashboard

A full-stack social media analytics dashboard with a **Python/Flask** REST API backend, a polished **HTML/CSS/JS** frontend, and a **Java** data export utility

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Backend   | Python 3.9+, Flask, Flask-CORS      |
| Frontend  | Vanilla HTML5 / CSS3 / JavaScript, Chart.js |
| Exporter  | Java 11+ (zero dependencies)        |
| Data      | JSON file (no database needed)      |

---

## Project Structure

```
social-dashboard/
├── backend/
│   ├── app.py              # Flask REST API
│   └── requirements.txt
├── frontend/
│   ├── index.html          # Single-page dashboard
│   └── static/
│       ├── css/style.css
│       └── js/app.js
├── java-exporter/
│   └── src/main/java/com/pulse/
│       └── DashboardExporter.java   # Export analytics to CSV/JSON
├── data/
│   └── dashboard_data.json  # Auto-generated on first run
└── README.md
```

---

## Quick Start

### 1 — Python Backend

**Requirements:** Python 3.9 or higher

```bash
# Move into the backend directory
cd social-dashboard/backend

# (Recommended) Create a virtual environment
python -m venv venv
source venv/bin/activate        # macOS / Linux
venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt

# Start the API server
python app.py
```

The API will be live at **http://localhost:5000**.  
On first boot it auto-generates realistic sample data in `data/dashboard_data.json`.

---

### 2 — Open the Dashboard

With the backend running, open the dashboard in your browser:

```
http://localhost:5000
```

The Flask server serves the frontend files automatically — no separate web server needed.

Alternatively, open `frontend/index.html` directly in any browser (note: API calls will only work when the Flask server is running).

---

### 3 — Java Data Exporter (optional)

**Requirements:** Java 11 or higher (`java -version` to check)

```bash
# Navigate to the Java source
cd social-dashboard/java-exporter

# Compile (no build tool needed)
mkdir -p out
javac -d out src/main/java/com/pulse/DashboardExporter.java

# Run — make sure the Python API is running first!
java -cp out com.pulse.DashboardExporter
```

**Custom options:**

```bash
java -cp out com.pulse.DashboardExporter \
  --host localhost \
  --port 5000 \
  --out ./my-exports
```

The exporter creates three files in `./exports/`:

| File                              | Contents                         |
|-----------------------------------|----------------------------------|
| `analytics_report_<ts>.csv`       | Per-platform stats               |
| `posts_export_<ts>.csv`           | All posts with metrics           |
| `dashboard_snapshot_<ts>.json`    | Full API snapshot                |

---

## API Reference

All endpoints return JSON. Base URL: `http://localhost:5000/api`

| Method | Endpoint                   | Description                        |
|--------|----------------------------|------------------------------------|
| GET    | `/dashboard`               | Full dashboard summary             |
| GET    | `/platforms`               | Platform stats only                |
| GET    | `/posts?platform=<name>`   | All posts (filter by platform)     |
| POST   | `/posts`                   | Create a new post                  |
| DELETE | `/posts/<id>`              | Delete a post                      |
| GET    | `/analytics?platform=&period=` | Chart data                     |
| POST   | `/schedule`                | Schedule a post                    |
| POST   | `/notifications/read`      | Mark all notifications as read     |
| POST   | `/refresh`                 | Simulate live stats refresh        |

**POST /posts** body:
```json
{ "platform": "twitter", "caption": "Hello world!" }
```

**POST /schedule** body:
```json
{ "platform": "instagram", "caption": "Coming soon!", "scheduled_time": "2025-09-01T10:00:00" }
```

---

## Dashboard Features

- **Overview** — summary KPI cards, 30-day follower growth line chart, platform donut split, recent posts, and upcoming scheduled posts
- **Analytics** — engagement trend chart, per-platform follower bar chart, and aggregate metrics
- **Posts** — card grid with per-post metrics; filter by platform; compose and delete posts
- **Schedule** — full schedule table; create new scheduled posts
- **Platforms** — per-platform stat cards with connected status
- **Notifications** — dropdown panel with unread badge
- **Live Refresh** — hits `/api/refresh` to simulate real-time stat updates
- **Responsive** — collapsible sidebar on mobile

---

## Customization

### Swap mock data for real APIs

Replace the relevant section in `backend/app.py`'s `generate_initial_data()` with calls to your actual social platform SDKs (Twitter/X API v2, Instagram Graph API, etc.).

### Change the port

```bash
# Backend
python app.py --port 8080     # or edit app.run(port=...) in app.py

# Java exporter
java -cp out com.pulse.DashboardExporter --port 8080
```

### Add a database

Swap `load_data()` / `save_data()` in `app.py` with SQLite via `sqlite3` or PostgreSQL via `psycopg2`. The rest of the API is unchanged.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ModuleNotFoundError: flask` | Run `pip install -r requirements.txt` inside your venv |
| CORS errors in browser | Ensure `flask-cors` is installed and the server is running on port 5000 |
| `Connection refused` in Java | Start the Python server before running the exporter |
| `javac: command not found` | Install JDK 11+: https://adoptium.net |
| Charts not rendering | Make sure Chart.js CDN loads (requires internet); check browser console |

---

## License

MIT — free to use, modify, and distribute.
