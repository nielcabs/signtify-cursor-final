# Render API Folder

This folder is the deploy target for your Flask sign-language API on Render.

It uses your existing root `app.py` and `ml` assets, so you do not need to duplicate model files.

## Render Setup

1. Push this repo to GitHub.
2. In Render, create a new **Web Service** from the repo.
3. Set **Root Directory** to `render-api`.
4. Render should auto-detect:
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn wsgi:app --bind 0.0.0.0:$PORT --timeout 180`

## Health Check

After deploy, open:

`https://<your-render-service>.onrender.com/health`

## Frontend Environment Variable

Set this in Vercel (or your frontend host):

`VITE_FLASK_PREDICT_URL=https://<your-render-service>.onrender.com/predict`
