import os
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from typing import List, Dict, Any
import numpy as np

class VectorService:
    def __init__(self):
        # Using local Qdrant for a "professional but ready-to-use" setup
        # For cloud, use url and api_key from os.getenv
        # Use persistent local storage so data is NOT lost after restarting
        db_path = os.path.join(os.path.dirname(__file__), "..", "qdrant_storage")
        self.client = QdrantClient(path=db_path) 
        self.collection_name = "candidates"
        
        # Initialize collection
        self.client.recreate_collection(
            collection_name=self.collection_name,
            vectors_config=VectorParams(size=768, distance=Distance.COSINE),
        )

    async def add_candidate(self, candidate_id: str, vector: List[float], payload: Dict[str, Any]):
        self.client.upsert(
            collection_name=self.collection_name,
            points=[
                PointStruct(
                    id=candidate_id, 
                    vector=vector, 
                    payload=payload
                )
            ]
        )

    async def search_candidates(self, query_vector: List[float], limit: int = 5):
        return self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            limit=limit
        )

vector_service = VectorService()
