# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies:
#   libgomp1       - LightGBM OpenMP
#   fonts-nanum    - Korean text rendering in Pillow
#   ffmpeg         - MoviePy video encoding
#   Playwright OS deps - Chromium headless browser for screen recording
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    fonts-nanum \
    ffmpeg \
    # Playwright Chromium dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container at /app
COPY requirements.txt /app/

# Install any needed packages specified in requirements.txt
# --no-cache-dir to keep image small
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright and download Chromium browser
RUN pip install --no-cache-dir playwright==1.52.0 \
    && playwright install chromium

# Copy the rest of the application code
COPY . /app/

# Cloud Run uses PORT env var (default 8080)
ENV PORT=8080

# Run with Cloud Run's PORT
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
