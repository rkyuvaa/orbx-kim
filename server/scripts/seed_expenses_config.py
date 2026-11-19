import sqlite3
import os

db_paths = [os.path.join("server", "dev.db"), "dev.db"]

for db_path in db_paths:
    if not os.path.exists(db_path):
        continue
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. Branches
    existing_branches = cursor.execute("SELECT COUNT(*) FROM branches").fetchone()[0]
    if existing_branches == 0:
        cursor.execute("""
            INSERT INTO branches (code, name, address, is_active, created_at, updated_at) VALUES 
            ('BLR', 'Bangalore Branch', 'Bangalore, Karnataka', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
            ('CBE', 'Coimbatore Branch', 'Coimbatore, Tamil Nadu', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """)
        print(f"Seeded Bangalore and Coimbatore branches into {db_path}")

    # 2. Expense Policies
    policies = [
        ("manual_claim_submission_enabled", "false", "Enable manual claim submission by employees instead of automatic cycle bundling", "BOOLEAN"),
        ("accountant_escalation_hours", "72", "Hours before escalating unconfirmed payout to accountant reminder queue", "INTEGER"),
        ("auto_reconcile_days", "7", "Days before auto-reconciling unconfirmed payout", "INTEGER"),
        ("auto_reconcile_enabled", "true", "Enable automatic reconciliation after N days of no dispute", "BOOLEAN"),
        ("max_bill_age_days", "90", "Maximum allowed age of expense receipt in days", "INTEGER"),
        ("gst_is_mandatory", "false", "Whether GST split is strictly required on all bills", "BOOLEAN")
    ]
    for k, v, d, t in policies:
        cursor.execute("SELECT COUNT(*) FROM expense_policies WHERE policy_key = ?", (k,))
        if cursor.fetchone()[0] == 0:
            cursor.execute(
                "INSERT INTO expense_policies (policy_key, policy_value, description, data_type, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                (k, v, d, t)
            )

    # 3. AI Providers
    providers = [
        ("GOOGLE", "Google Gemini API", "gemini-1.5-flash", "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent", "GEMINI_API_KEY", 1, 1),
        ("NVIDIA", "Nvidia NIM", "meta/llama-3.2-11b-vision-instruct", "https://integrate.api.nvidia.com/v1/chat/completions", "NVIDIA_API_KEY", 0, 1),
        ("OPENROUTER", "OpenRouter", "google/gemini-flash-1.5", "https://openrouter.ai/api/v1/chat/completions", "OPENROUTER_API_KEY", 0, 1),
        ("KILO", "Kilo AI", "kilo-vision-1", "https://api.kilo.ai/v1/chat/completions", "KILO_API_KEY", 0, 1),
        ("LOCAL", "Local Ollama", "llama3.2-vision", "http://localhost:11434/api/generate", None, 0, 1)
    ]
    for p, l, m, ep, env, is_def, is_act in providers:
        cursor.execute("SELECT COUNT(*) FROM ai_providers WHERE provider = ?", (p,))
        if cursor.fetchone()[0] == 0:
            cursor.execute(
                "INSERT INTO ai_providers (provider, label, model_name, api_endpoint, api_key_env_var, is_default, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
                (p, l, m, ep, env, is_def, is_act)
            )

    conn.commit()
    conn.close()

print("Seeding completed successfully.")
