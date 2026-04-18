FROM python:3.10-slim

# Set up working directory
WORKDIR /code

# Copy requirements
COPY ./requirements.txt /code/requirements.txt

# Install dependencies (use CPU version of torch to save space and time if no GPU)
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r /code/requirements.txt

# Create a user to avoid running as root (HF requirement)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
	PATH=/home/user/.local/bin:$PATH

# Switch workspace permission
WORKDIR $HOME/app
COPY --chown=user . $HOME/app

# Hugging face spaces map port 7860 by default
EXPOSE 7860

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
