from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from services.cv_parser import cv_parser
from services.llm_service import llm_service
from services.vector_db import vector_service
import os
import uuid
import json
import asyncio

router = APIRouter(prefix="/candidates", tags=["Candidates"])

@router.post("/upload-cv")
async def upload_cv(
    file: UploadFile = File(...),
    jd_text: str = Form(None)
):
    """Upload, parse, and analyze a CV against a JD in parallel for <5s performance."""
    if not file.filename.endswith((".pdf", ".docx")):
        raise HTTPException(status_code=400, detail="Unsupported file format.")
    
    temp_path = f"/tmp/{file.filename}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())
    
    try:
        # 1. Fast Local Parse for ALL types
        is_pdf = file.filename.endswith(".pdf")
        
        if is_pdf:
            import fitz
            doc = fitz.open(temp_path)
            cv_text = "".join([page.get_text() for page in doc])
        else:
            cv_text = await cv_parser.parse_document(temp_path)
        
        # 2. Parallel LLM Analysis and Embedding
        print(f"DEBUG: Starting Parallel Analysis for {file.filename}...")
        
        # Define tasks for parallel execution
        analysis_task = llm_service.analyze_cv_and_compare(cv_text, jd_text or "")
        embedding_task = llm_service.get_embedding(cv_text[:5000]) # Limit for embedding
        
        # Run both in parallel
        analysis_result, embedding = await asyncio.gather(analysis_task, embedding_task)
        
        candidate_id = str(uuid.uuid4())
        
        # 3. Index in Vector DB
        await vector_service.add_candidate(
            candidate_id=candidate_id,
            vector=embedding,
            payload={
                "name": file.filename, 
                "summary": str(analysis_result.get("structured_data", ""))
            }
        )
        
        return {
            "candidate_id": candidate_id,
            "candidate_data": analysis_result.get("structured_data"),
            "comparison": analysis_result.get("comparison"),
            "indexed": True
        }
    except Exception as e:
        print(f"DEBUG ERROR in upload_cv: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
