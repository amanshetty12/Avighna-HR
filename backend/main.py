import os
import sys

print(">>> [DEBUG] STARTING MAIN.PY")

try:
    from dotenv import load_dotenv
    print(">>> [DEBUG] LOADING DOTENV")
    load_dotenv()
except Exception as e:
    print(f">>> [DEBUG] DOTENV ERROR: {e}")

try:
    print(">>> [DEBUG] IMPORTING FASTAPI")
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn
    print(">>> [DEBUG] FASTAPI IMPORTED")

    print(">>> [DEBUG] IMPORTING ROUTERS...")
    import routers.job_description as job_description
    import routers.candidate as candidate
    import routers.interview as interview
    import routers.psychometric as psychometric
    print(">>> [DEBUG] ROUTERS IMPORTED")

    app = FastAPI(title="AI-Powered TA Module API")
    print(">>> [DEBUG] APP INSTANCE CREATED")

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    print(">>> [DEBUG] CORS CONFIGURED")

    # Include Routers
    app.include_router(job_description.router)
    app.include_router(candidate.router)
    app.include_router(interview.router)
    app.include_router(psychometric.router)
    print(">>> [DEBUG] ALL ROUTERS INCLUDED")

    @app.get("/")
    async def root():
        return {"message": "AI-Powered TA Module API is running"}

    print(">>> [DEBUG] SETUP COMPLETE")

except Exception as e:
    print(f">>> [DEBUG] CRITICAL ERROR DURING BOOTSTRAP: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f">>> [DEBUG] STARTING UVICORN ON PORT {port}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
