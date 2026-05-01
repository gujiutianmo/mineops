import os
class Settings:
    # Use SQLite for simplicity in demo
    DB_DIR = os.path.dirname(os.path.abspath(__file__))
    DB_PATH = os.getenv("DB_PATH", os.path.join(DB_DIR, "mineops.db"))
    JWT_SECRET = os.getenv("JWT_SECRET", "mineops-super-secret-key-2024")
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRE_MINUTES = 480
    @property
    def DATABASE_URL(self):
        return f"sqlite:///{self.DB_PATH}"
settings = Settings()
