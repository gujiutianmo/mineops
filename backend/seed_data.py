import sqlite3
import uuid
import os
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
db_path = os.path.join(os.path.dirname(__file__), 'mineops.db')
print(f'Database path: {db_path}')
print(f'Exists: {os.path.exists(db_path)}')

conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute('SELECT name FROM sqlite_master WHERE type="table"')
tables = [r[0] for r in c.fetchall()]
print(f'Tables: {tables}')

if 'mine_account' not in tables:
    # Create table
    c.execute('''CREATE TABLE mine_account (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'mine',
        mine_id TEXT,
        active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    print('Created mine_account table')

c.execute('SELECT COUNT(*) FROM mine_account')
count = c.fetchone()[0]
print(f'Existing users: {count}')

if count == 0:
    # Hash passwords with bcrypt
    admin_hash = pwd_context.hash('admin')
    mine_a_hash = pwd_context.hash('mine123')
    mine_b_hash = pwd_context.hash('mine123')

    c.execute('''INSERT INTO mine_account (id, username, password_hash, display_name, role, mine_id, active) 
                 VALUES (?, ?, ?, ?, ?, ?, 1)''',
              (str(uuid.uuid4()), 'admin', admin_hash, '总管理员', 'super', None))
    c.execute('''INSERT INTO mine_account (id, username, password_hash, display_name, role, mine_id, active) 
                 VALUES (?, ?, ?, ?, ?, ?, 1)''',
              (str(uuid.uuid4()), 'mine_a', mine_a_hash, '矿山A管理员', 'mine', 'mine_a'))
    c.execute('''INSERT INTO mine_account (id, username, password_hash, display_name, role, mine_id, active) 
                 VALUES (?, ?, ?, ?, ?, ?, 1)''',
              (str(uuid.uuid4()), 'mine_b', mine_b_hash, '矿山B管理员', 'mine', 'mine_b'))
    conn.commit()
    print('Inserted 3 users')
else:
    print('Users already exist')

# Verify
c.execute('SELECT username, role FROM mine_account')
for r in c.fetchall():
    print(f'  User: {r[0]}, Role: {r[1]}')

conn.close()
print('Done!')
