from flask import Flask, render_template, request, jsonify, redirect, url_for
import sqlite3
import os
from datetime import datetime, timedelta
from collections import defaultdict
import json

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), 'data', 'expenses.db')

CATEGORIES = [
    {"id": "food",          "name": "Alimentación",     "icon": "🍔", "color": "#f97316"},
    {"id": "transport",     "name": "Transporte",        "icon": "🚗", "color": "#3b82f6"},
    {"id": "housing",       "name": "Vivienda",          "icon": "🏠", "color": "#8b5cf6"},
    {"id": "health",        "name": "Salud",             "icon": "💊", "color": "#22c55e"},
    {"id": "entertainment", "name": "Entretenimiento",   "icon": "🎬", "color": "#ec4899"},
    {"id": "shopping",      "name": "Compras",           "icon": "🛍️", "color": "#eab308"},
    {"id": "education",     "name": "Educación",         "icon": "📚", "color": "#06b6d4"},
    {"id": "savings",       "name": "Ahorros",           "icon": "💰", "color": "#10b981"},
    {"id": "other",         "name": "Otros",             "icon": "📦", "color": "#6b7280"},
]

CAT_MAP = {c["id"]: c for c in CATEGORIES}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_db()
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS expenses (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            amount      REAL    NOT NULL,
            category    TEXT    NOT NULL,
            description TEXT    NOT NULL,
            date        TEXT    NOT NULL,
            created_at  TEXT    NOT NULL
        );
        CREATE TABLE IF NOT EXISTS budgets (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            category    TEXT    NOT NULL UNIQUE,
            amount      REAL    NOT NULL
        );
        CREATE TABLE IF NOT EXISTS income (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            amount      REAL    NOT NULL,
            source      TEXT    NOT NULL,
            date        TEXT    NOT NULL,
            created_at  TEXT    NOT NULL
        );
    """)
    conn.commit()
    conn.close()


def row_to_dict(row):
    return dict(row)


# ── Routes ──────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html", categories=CATEGORIES)


# ── Expenses ─────────────────────────────────────────────────────────────────

@app.route("/api/expenses", methods=["GET"])
def get_expenses():
    month  = request.args.get("month")   # YYYY-MM
    cat    = request.args.get("category")
    limit  = request.args.get("limit", 50, type=int)

    conn = get_db()
    q = "SELECT * FROM expenses WHERE 1=1"
    params = []
    if month:
        q += " AND date LIKE ?"
        params.append(f"{month}%")
    if cat:
        q += " AND category = ?"
        params.append(cat)
    q += " ORDER BY date DESC, id DESC LIMIT ?"
    params.append(limit)

    rows = [row_to_dict(r) for r in conn.execute(q, params).fetchall()]
    conn.close()

    for r in rows:
        r["category_info"] = CAT_MAP.get(r["category"], CAT_MAP["other"])
    return jsonify(rows)


@app.route("/api/expenses", methods=["POST"])
def add_expense():
    data = request.json
    conn = get_db()
    conn.execute(
        "INSERT INTO expenses (amount, category, description, date, created_at) VALUES (?,?,?,?,?)",
        (data["amount"], data["category"], data["description"],
         data["date"], datetime.now().isoformat())
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/expenses/<int:eid>", methods=["DELETE"])
def delete_expense(eid):
    conn = get_db()
    conn.execute("DELETE FROM expenses WHERE id = ?", (eid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/expenses/<int:eid>", methods=["PUT"])
def update_expense(eid):
    data = request.json
    conn = get_db()
    conn.execute(
        "UPDATE expenses SET amount=?, category=?, description=?, date=? WHERE id=?",
        (data["amount"], data["category"], data["description"], data["date"], eid)
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ── Income ───────────────────────────────────────────────────────────────────

@app.route("/api/income", methods=["GET"])
def get_income():
    month = request.args.get("month")
    conn  = get_db()
    q     = "SELECT * FROM income WHERE 1=1"
    params = []
    if month:
        q += " AND date LIKE ?"
        params.append(f"{month}%")
    q += " ORDER BY date DESC"
    rows = [row_to_dict(r) for r in conn.execute(q, params).fetchall()]
    conn.close()
    return jsonify(rows)


@app.route("/api/income", methods=["POST"])
def add_income():
    data = request.json
    conn = get_db()
    conn.execute(
        "INSERT INTO income (amount, source, date, created_at) VALUES (?,?,?,?)",
        (data["amount"], data["source"], data["date"], datetime.now().isoformat())
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/income/<int:iid>", methods=["DELETE"])
def delete_income(iid):
    conn = get_db()
    conn.execute("DELETE FROM income WHERE id = ?", (iid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ── Budgets ──────────────────────────────────────────────────────────────────

@app.route("/api/budgets", methods=["GET"])
def get_budgets():
    conn = get_db()
    rows = {r["category"]: r["amount"]
            for r in conn.execute("SELECT * FROM budgets").fetchall()}
    conn.close()
    return jsonify(rows)


@app.route("/api/budgets", methods=["POST"])
def set_budget():
    data = request.json
    conn = get_db()
    conn.execute(
        "INSERT INTO budgets (category, amount) VALUES (?,?) "
        "ON CONFLICT(category) DO UPDATE SET amount=excluded.amount",
        (data["category"], data["amount"])
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ── Stats ────────────────────────────────────────────────────────────────────

@app.route("/api/stats/summary", methods=["GET"])
def stats_summary():
    month = request.args.get("month", datetime.now().strftime("%Y-%m"))
    conn  = get_db()

    total_exp = conn.execute(
        "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE date LIKE ?",
        (f"{month}%",)
    ).fetchone()[0]

    total_inc = conn.execute(
        "SELECT COALESCE(SUM(amount),0) FROM income WHERE date LIKE ?",
        (f"{month}%",)
    ).fetchone()[0]

    by_cat = conn.execute(
        "SELECT category, SUM(amount) as total FROM expenses "
        "WHERE date LIKE ? GROUP BY category ORDER BY total DESC",
        (f"{month}%",)
    ).fetchall()

    # Last 6 months trend
    trend = []
    for i in range(5, -1, -1):
        d = datetime.now().replace(day=1) - timedelta(days=i * 28)
        m = d.strftime("%Y-%m")
        exp = conn.execute(
            "SELECT COALESCE(SUM(amount),0) FROM expenses WHERE date LIKE ?",
            (f"{m}%",)
        ).fetchone()[0]
        inc = conn.execute(
            "SELECT COALESCE(SUM(amount),0) FROM income WHERE date LIKE ?",
            (f"{m}%",)
        ).fetchone()[0]
        trend.append({"month": m, "expenses": exp, "income": inc})

    budgets = {r["category"]: r["amount"]
               for r in conn.execute("SELECT * FROM budgets").fetchall()}
    conn.close()

    categories_data = []
    for row in by_cat:
        cat_id = row["category"]
        info   = CAT_MAP.get(cat_id, CAT_MAP["other"])
        categories_data.append({
            "id":      cat_id,
            "name":    info["name"],
            "icon":    info["icon"],
            "color":   info["color"],
            "total":   row["total"],
            "budget":  budgets.get(cat_id, 0),
        })

    return jsonify({
        "month":       month,
        "total_exp":   total_exp,
        "total_inc":   total_inc,
        "balance":     total_inc - total_exp,
        "categories":  categories_data,
        "trend":       trend,
    })


if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)
