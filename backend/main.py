from fastapi import FastAPI

app = FastAPI(title="Cleopatra API")


@app.get("/health")
def health_check():
    return {"status": "ok"}
