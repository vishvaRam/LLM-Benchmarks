from fastapi import APIRouter, HTTPException

from app.schemas.endpoints import EndpointRegistration, ModelInfo
from app.services.endpoint_store import EndpointStore

router = APIRouter(prefix="/endpoints", tags=["Endpoints Registry"])


@router.get("/", response_model=list[EndpointRegistration])
async def list_endpoints():
    """Retrieve all endpoints saved in data/endpoints.json."""
    return list(EndpointStore.load_all().values())


@router.post("/", response_model=EndpointRegistration)
async def save_endpoint(endpoint: EndpointRegistration):
    """Add or update an endpoint and save directly to data/endpoints.json."""
    EndpointStore.save_one(endpoint)
    return endpoint


@router.post("/{endpoint_id}/models", response_model=EndpointRegistration)
async def add_model_to_endpoint(endpoint_id: str, model: ModelInfo):
    """Append or update a model inside an existing endpoint config in JSON."""
    ep = EndpointStore.get(endpoint_id)
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")

    ep.models = [m for m in ep.models if m.id != model.id]
    ep.models.append(model)
    EndpointStore.save_one(ep)
    return ep


@router.get("/{endpoint_id:path}", response_model=EndpointRegistration)
async def get_endpoint(endpoint_id: str):
    ep = EndpointStore.get(endpoint_id)
    if not ep:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    return ep


@router.delete("/")
@router.delete("")
async def delete_endpoint_query(endpoint_id: str):
    """Delete an endpoint from data/endpoints.json via query param."""
    success = EndpointStore.delete_one(endpoint_id)
    if not success:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    return {"message": f"Endpoint '{endpoint_id}' deleted successfully from JSON file."}


@router.delete("/{endpoint_id:path}")
async def delete_endpoint(endpoint_id: str):
    """Delete an endpoint from data/endpoints.json."""
    success = EndpointStore.delete_one(endpoint_id)
    if not success:
        raise HTTPException(status_code=404, detail="Endpoint not found")
    return {"message": f"Endpoint '{endpoint_id}' deleted successfully from JSON file."}
