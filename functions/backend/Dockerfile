# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY requirements.txt /app/

# Install any needed packages specified in requirements.txt
# --no-cache-dir to keep image small
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . /app/

# Make port 8000 available to the world outside this container
EXPOSE 8000

# Define environment variable
# Use 0.0.0.0 for host to allow external access (important for Docker)
ENV DATABASE_URL=postgresql+asyncpg://user:password@db/smartproto

# Run app.py when the container launches
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
