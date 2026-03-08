FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

# Install build deps so extensions like wsaccel/tiktoken can compile
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app

ENV PORT=8080
EXPOSE 8080
CMD ["sh","-c","python manage.py migrate --noinput && daphne -b 0.0.0.0 -p 8080 apps.conf.asgi:application"]
