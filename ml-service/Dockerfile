FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Train both models at build time so the image is ready to serve immediately.
# For real deployments, swap this for a step that pulls pre-trained model
# artifacts from your model registry / object storage instead of training
# fresh inside the image.
RUN python train_schedule_model.py && python train_compliance_model.py

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
