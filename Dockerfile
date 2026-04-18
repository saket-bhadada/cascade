FROM node:20-bookworm-slim

# Install Python and essential build tools
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv build-essential && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Copy package.json and install server dependencies
COPY server/package.json ./server/
RUN cd server && npm install

# Copy client package.json and install client dependencies
COPY client/package.json client/package-lock.json* client/yarn.lock* ./client/
RUN cd client && npm install

# Copy the rest of the application
COPY . .

# Build the client
RUN cd client && npm run build

# Setup Python environment and install numpy and torch (cpu version for smaller size)
RUN python3 -m venv /app/model/venv
# Force use of the venv Python for pip installs
RUN /app/model/venv/bin/pip install --upgrade pip
RUN /app/model/venv/bin/pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
RUN /app/model/venv/bin/pip install pandas numpy

# Expose port
EXPOSE 3001

# Start the application
# We need to set the PYTHON_PATH to the venv linux path so the node server knows where to find it.
ENV PYTHON_PATH="/app/model/venv/bin/python"
ENV PORT=3001
ENV NODE_ENV="production"

CMD ["node", "server/server.js"]
