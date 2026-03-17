from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import router  # This line caused the error
from dotenv import load_dotenv

load_dotenv()
app = FastAPI()

# Configure CORS for your React app (allow multiple ports)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the router we just fixed
app.include_router(router)