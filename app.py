from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import json
import os
import random
from datetime import datetime, timedelta
import time

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

DATA_FILE = os.path.join(os.path.dirname(__file__), '../data/dashboard_data.json')

# ──────────────────────────────────────────────
# Seed / load persistent data
# ──────────────────────────────────────────────
def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE) as f:
            return json.load(f)
    return generate_initial_data()

def save_data(data):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def generate_initial_data():
    platforms = ['twitter', 'instagram', 'facebook', 'linkedin', 'youtube', 'tiktok']
    platform_colors = {
        'twitter':   '#1DA1F2',
        'instagram': '#E1306C',
        'facebook':  '#4267B2',
        'linkedin':  '#0A66C2',
        'youtube':   '#FF0000',
        'tiktok':    '#010101',
    }
    platform_icons = {
        'twitter':   '𝕏',
        'instagram': '📸',
        'facebook':  '👤',
        'linkedin':  '💼',
        'youtube':   '▶',
        'tiktok':    '♪',
    }

    data = {
        'user': {
            'name': 'Alex Rivera',
            'handle': '@alexrivera',
            'avatar': 'AR',
            'plan': 'Pro',
        },
        'platforms': {},
        'posts': [],
        'notifications': [],
        'scheduled': [],
    }

    # Per-platform stats
    for p in platforms:
        base_followers = random.randint(1000, 500000)
        data['platforms'][p] = {
            'name': p.capitalize(),
            'color': platform_colors[p],
            'icon': platform_icons[p],
            'connected': True,
            'followers': base_followers,
            'following': random.randint(100, 5000),
            'posts_count': random.randint(50, 2000),
            'engagement_rate': round(random.uniform(1.5, 8.5), 2),
            'reach': random.randint(base_followers // 2, base_followers * 3),
            'impressions': random.randint(base_followers, base_followers * 10),
            'likes_total': random.randint(5000, 200000),
            'comments_total': random.randint(500, 20000),
            'shares_total': random.randint(200, 10000),
            'daily_growth': [random.randint(-50, 500) for _ in range(30)],
            'weekly_engagement': [round(random.uniform(1, 9), 2) for _ in range(12)],
        }

    # Recent posts
    captions = [
        "Just launched something big 🚀 Stay tuned!",
        "Morning coffee and big ideas ☕",
        "Behind the scenes of my creative process 🎨",
        "Grateful for every single one of you 🙏",
        "New tutorial is live! Link in bio 📹",
        "This view never gets old 🌅",
        "Collaboration > Competition. Always.",
        "The grind is real but so are the results 💪",
        "Q&A session tomorrow – drop your questions below 👇",
        "Throwback to when this all started 📸",
    ]

    for i in range(20):
        p = random.choice(platforms)
        ts = datetime.now() - timedelta(hours=random.randint(1, 720))
        data['posts'].append({
            'id': i + 1,
            'platform': p,
            'caption': random.choice(captions),
            'likes': random.randint(10, 50000),
            'comments': random.randint(0, 5000),
            'shares': random.randint(0, 2000),
            'reach': random.randint(100, 100000),
            'timestamp': ts.isoformat(),
            'status': random.choice(['published', 'published', 'published', 'archived']),
            'image': f'https://picsum.photos/seed/{i+1}/400/300',
        })

    data['posts'].sort(key=lambda x: x['timestamp'], reverse=True)

    # Notifications
    notif_msgs = [
        ("New milestone: 10K followers on Instagram!", "milestone"),
        ("Your post is trending on Twitter 🔥", "trending"),
        ("Scheduled post published successfully", "success"),
        ("Engagement spike detected on LinkedIn", "info"),
        ("Weekly report is ready to view", "report"),
    ]
    for i, (msg, t) in enumerate(notif_msgs):
        ts = datetime.now() - timedelta(minutes=random.randint(5, 1440))
        data['notifications'].append({
            'id': i + 1,
            'message': msg,
            'type': t,
            'read': False,
            'timestamp': ts.isoformat(),
        })

    # Scheduled posts
    for i in range(5):
        ts = datetime.now() + timedelta(hours=random.randint(1, 168))
        data['scheduled'].append({
            'id': i + 1,
            'platform': random.choice(platforms),
            'caption': random.choice(captions),
            'scheduled_time': ts.isoformat(),
            'status': 'scheduled',
        })

    save_data(data)
    return data

# ──────────────────────────────────────────────
# API Routes
# ──────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    data = load_data()
    total_followers = sum(p['followers'] for p in data['platforms'].values())
    total_engagement = round(
        sum(p['engagement_rate'] for p in data['platforms'].values()) / len(data['platforms']), 2
    )
    total_reach = sum(p['reach'] for p in data['platforms'].values())
    total_posts = len([p for p in data['posts'] if p['status'] == 'published'])

    return jsonify({
        'user': data['user'],
        'summary': {
            'total_followers': total_followers,
            'total_engagement': total_engagement,
            'total_reach': total_reach,
            'total_posts': total_posts,
            'platforms_connected': len(data['platforms']),
        },
        'platforms': data['platforms'],
        'recent_posts': data['posts'][:6],
        'notifications': data['notifications'],
        'scheduled': data['scheduled'],
    })

@app.route('/api/platforms', methods=['GET'])
def get_platforms():
    data = load_data()
    return jsonify(data['platforms'])

@app.route('/api/posts', methods=['GET'])
def get_posts():
    data = load_data()
    platform_filter = request.args.get('platform')
    posts = data['posts']
    if platform_filter and platform_filter != 'all':
        posts = [p for p in posts if p['platform'] == platform_filter]
    return jsonify(posts)

@app.route('/api/posts', methods=['POST'])
def create_post():
    data = load_data()
    body = request.json
    new_post = {
        'id': max((p['id'] for p in data['posts']), default=0) + 1,
        'platform': body.get('platform', 'twitter'),
        'caption': body.get('caption', ''),
        'likes': 0,
        'comments': 0,
        'shares': 0,
        'reach': 0,
        'timestamp': datetime.now().isoformat(),
        'status': 'published',
        'image': None,
    }
    data['posts'].insert(0, new_post)
    save_data(data)
    return jsonify(new_post), 201

@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    data = load_data()
    data['posts'] = [p for p in data['posts'] if p['id'] != post_id]
    save_data(data)
    return jsonify({'success': True})

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    data = load_data()
    platform = request.args.get('platform', 'all')
    period = int(request.args.get('period', 30))

    if platform == 'all':
        growth = [
            sum(data['platforms'][p]['daily_growth'][i] for p in data['platforms'])
            for i in range(period)
        ]
        engagement = [
            round(sum(data['platforms'][p]['weekly_engagement'][i % 12] for p in data['platforms']) / len(data['platforms']), 2)
            for i in range(12)
        ]
    else:
        pd = data['platforms'].get(platform, {})
        growth = pd.get('daily_growth', [])[:period]
        engagement = pd.get('weekly_engagement', [])

    labels_daily = [(datetime.now() - timedelta(days=period - i - 1)).strftime('%b %d') for i in range(period)]
    labels_weekly = [(datetime.now() - timedelta(weeks=11 - i)).strftime('%b %d') for i in range(12)]

    return jsonify({
        'follower_growth': {'labels': labels_daily, 'data': growth},
        'engagement_trend': {'labels': labels_weekly, 'data': engagement},
        'platform_breakdown': {
            p: {
                'followers': pd_['followers'],
                'engagement_rate': pd_['engagement_rate'],
                'reach': pd_['reach'],
            }
            for p, pd_ in data['platforms'].items()
        },
    })

@app.route('/api/notifications/read', methods=['POST'])
def mark_read():
    data = load_data()
    for n in data['notifications']:
        n['read'] = True
    save_data(data)
    return jsonify({'success': True})

@app.route('/api/schedule', methods=['POST'])
def schedule_post():
    data = load_data()
    body = request.json
    item = {
        'id': max((s['id'] for s in data['scheduled']), default=0) + 1,
        'platform': body.get('platform'),
        'caption': body.get('caption'),
        'scheduled_time': body.get('scheduled_time'),
        'status': 'scheduled',
    }
    data['scheduled'].append(item)
    save_data(data)
    return jsonify(item), 201

@app.route('/api/refresh', methods=['POST'])
def refresh_stats():
    """Simulate live stat refresh with small random deltas."""
    data = load_data()
    for p in data['platforms'].values():
        p['followers'] += random.randint(-10, 100)
        p['engagement_rate'] = round(max(0.5, p['engagement_rate'] + random.uniform(-0.3, 0.3)), 2)
        p['reach'] += random.randint(-500, 2000)
        p['impressions'] += random.randint(100, 5000)
        p['daily_growth'].append(random.randint(-50, 500))
        p['daily_growth'] = p['daily_growth'][-30:]
    save_data(data)
    return jsonify({'success': True, 'refreshed_at': datetime.now().isoformat()})

if __name__ == '__main__':
    load_data()          # ensure data exists on start
    app.run(debug=True, port=5000)
