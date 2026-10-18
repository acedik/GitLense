"""
chitgit root entrypoint for WSGI servers / Vercel
"""
from api.index import app

if __name__ == "__main__":
    app.run()
