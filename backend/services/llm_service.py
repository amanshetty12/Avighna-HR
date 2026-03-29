import os
import json
import base64
import google.generativeai as genai
from groq import AsyncGroq
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Ensure env vars are loaded
load_dotenv()

class LLMService:
    def __init__(self):
        gemini_key = os.getenv("GEMINI_API_KEY")
        groq_key = os.getenv("GROQ_API_KEY")
        
        self.gemini_model = None
        if gemini_key:
            genai.configure(api_key=gemini_key)
            # Keeping Gemini only for possible fallback or embeddings if needed
        
        self.groq_client = None
        if groq_key:
            self.groq_client = AsyncGroq(api_key=groq_key)

    async def generate_response(self, prompt: str, model: str = "llama-3.3-70b-specdec") -> str:
        """Generic method to generate response from Groq."""
        try:
            if not self.groq_client:
                return "Groq Client not initialized. Check API Key."
            
            chat_completion = await self.groq_client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model=model,
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            return f"Error with {model}: {str(e)}"

    async def get_embedding(self, text: str) -> List[float]:
        """Generate embeddings using Gemini (Threaded)."""
        import asyncio
        import time
        try:
            if not os.getenv("GEMINI_API_KEY"):
                return [0.0] * 768
            
            start = time.time()
            result = await asyncio.to_thread(
                genai.embed_content,
                model="models/embedding-001",
                content=text,
                task_type="retrieval_document"
            )
            print(f"DEBUG: Embedding Latency: {time.time() - start:.2f}s")
            return result['embedding']
        except Exception as e:
            print(f"Embedding error: {e}")
            return [0.0] * 768

    async def analyze_cv_and_compare(self, cv_text: str, jd_text: str) -> Dict[str, Any]:
        """
        Consolidated method using Groq for extraction and comparison.
        This uses raw text as Groq does not support native PDF.
        """
        import time
        start_all = time.time()
        
        prompt = f"""
        TASK:
        1. Extract candidate information (Name, Contact, Experience, Skills, Education) from the CV.
        2. Compare this candidate against the provided Job Description (JD).
        3. Provide a matching score (0-100), matched requirements, top skills, gaps, and a justification.

        JD:
        {jd_text}

        CV TEXT:
        {cv_text}

        OUTPUT FORMAT (Return ONLY raw JSON):
        {{
            "structured_data": {{
                "full_name": "",
                "contact": {{ "email": "", "phone": "", "location": "" }},
                "experience": [],
                "skills": {{ "technical": [], "soft": [], "domain": [] }},
                "education": []
            }},
            "comparison": {{
                "matching_score": 0,
                "matched_requirements": [],
                "top_skills": [],
                "gaps": [],
                "justification": ""
            }}
        }}
        """

        try:
            print("DEBUG: Starting Groq Analysis...")
            response_text = await self.generate_response(prompt)
            print(f"DEBUG: Groq Analysis complete in {time.time() - start_all:.2f}s")
            
            import re
            match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if match:
                return json.loads(match.group(0))
            return {"error": "Could not parse JSON from model response", "raw": response_text}
            
        except Exception as e:
            print(f"Consolidated analysis error: {e}")
            return {"error": str(e)}

llm_service = LLMService()
