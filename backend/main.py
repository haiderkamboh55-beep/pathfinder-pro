from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import router  # This line caused the error
from dotenv import load_dotenv

load_dotenv()
app = FastAPI()

# Configure CORS for your React app (allow all origins for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the router we just fixed
app.include_router(router)