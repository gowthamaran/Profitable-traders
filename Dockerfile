FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY sri_wagmi ./sri_wagmi

# State lives on a volume so the repeat-suppression window and the job on/off
# switches survive a restart.
VOLUME ["/app/state"]
ENV STATE_PATH=/app/state/sri_wagmi.sqlite3

RUN useradd --create-home --uid 10001 wagmi && chown -R wagmi:wagmi /app
USER wagmi

CMD ["python", "-m", "sri_wagmi"]
