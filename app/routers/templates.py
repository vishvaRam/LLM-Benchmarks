import base64
from pathlib import Path

from fastapi import APIRouter, HTTPException

from app.schemas.template import PromptTemplate
from app.services.template_store import TemplateStore

router = APIRouter(prefix="/templates", tags=["Templates"])

IMAGES_DIR = Path(__file__).resolve().parent.parent.parent / "Images"


def load_image_data_uri(filename: str) -> str | None:
    path = IMAGES_DIR / filename
    if not path.exists():
        return None
    suffix = path.suffix.lower().lstrip(".")
    mime = "jpeg" if suffix in ["jpg", "jpeg"] else suffix
    encoded = base64.b64encode(path.read_bytes()).decode("utf-8")
    return f"data:image/{mime};base64,{encoded}"


cats_uri = load_image_data_uri("cats.jpg")
ocr_uri = load_image_data_uri("ocr.jpeg")
aadhar_uri = load_image_data_uri("aadhar.jpg")

BUILTIN_TEMPLATES: dict[str, PromptTemplate] = {
    # --- Multimodal Presets using Images/ ---
    "vlm_cat_detection": PromptTemplate(
        id="vlm_cat_detection",
        category="Multimodal",
        name="Cat Detection & Counting",
        description="Detects, counts, and describes all cats visible in the image.",
        system_prompt="You are an expert visual recognition and object detection AI.",
        template="Identify and count all the cats in this picture. For each cat, describe its color/pattern, where it is positioned in the frame, and what it is doing.",
        sample_image_url=cats_uri,
    ),
    "vlm_spatial_reasoning": PromptTemplate(
        id="vlm_spatial_reasoning",
        category="Multimodal",
        name="Visual Spatial Reasoning",
        description="Evaluates scene layout, object relationships, and spatial positioning.",
        system_prompt="You are an expert visual analytics assistant with strong spatial reasoning abilities.",
        template=(
            "Answer the following spatial reasoning questions based on the image:\n"
            "1. How many distinct subjects are present in the scene?\n"
            "2. Describe the spatial arrangement of the subjects from left to right and foreground to background.\n"
            "3. Describe the resting surface and surrounding environment."
        ),
        sample_image_url=cats_uri,
    ),
    "vlm_multilingual_ocr": PromptTemplate(
        id="vlm_multilingual_ocr",
        category="Multimodal",
        name="Multilingual Document OCR",
        description="Transcribes text from documents preserving layout, headings, and structure.",
        system_prompt="You are a high-accuracy multilingual OCR system. Preserve exact character representations, script fidelity, and layout formatting.",
        template=(
            "Perform a complete transcription of all visible text in this document image into clean GitHub-flavored Markdown:\n"
            "- Use proper headings matching font hierarchy\n"
            "- Keep bulleted/numbered lists intact\n"
            "- Transcribe in the original language and script exactly as written."
        ),
        sample_image_url=ocr_uri,
    ),
    "vlm_document_summary": PromptTemplate(
        id="vlm_document_summary",
        category="Multimodal",
        name="Document Reading & Summary",
        description="Reads document image text and synthesizes a concise executive summary.",
        system_prompt="You are an executive document analyst AI. Read the text thoroughly and synthesize key insights.",
        template=(
            "Read and comprehend all the visible text in this document image:\n"
            "1. Provide a concise 3-bullet executive summary of the document.\n"
            "2. Identify the main themes and intended audience.\n"
            "3. Highlight any key dates, figures, or important takeaways."
        ),
        sample_image_url=ocr_uri,
    ),
    "vlm_data_extraction": PromptTemplate(
        id="vlm_data_extraction",
        category="Multimodal",
        name="ID Card Field Extraction",
        description="Extracts personal metadata and credentials into strict, valid JSON.",
        system_prompt="You are an expert document information extraction AI. Output strictly valid JSON without conversational text.",
        template=(
            "Analyze this identity document image and extract all visible data into a clean, valid JSON object:\n"
            "{{\n"
            '  "full_name": "...",\n'
            '  "date_of_birth": "...",\n'
            '  "gender": "...",\n'
            '  "id_number": "...",\n'
            '  "address": "...",\n'
            '  "issuing_authority": "..."\n'
            "}}\n"
            "If any field is missing or unreadable, set its value to null."
        ),
        sample_image_url=aadhar_uri,
    ),
    "vlm_security_audit": PromptTemplate(
        id="vlm_security_audit",
        category="Multimodal",
        name="Document Security Audit",
        description="Checks identity card visual integrity, logos, and readability score.",
        system_prompt="You are a digital document verification and fraud detection specialist.",
        template=(
            "Perform a security and visual integrity audit on this identity document:\n"
            "1. Identify the document type and issuing nation/authority.\n"
            "2. Check for security markers such as official emblems, holograms, barcodes, or QR codes.\n"
            "3. Assess text clarity and legibility, providing a readability score from 1 to 10.\n"
            "4. Note any potential distortions, occlusions, or abnormalities."
        ),
        sample_image_url=aadhar_uri,
    ),
    # --- Text & Reasoning Presets ---
    "hard_math": PromptTemplate(
        id="hard_math",
        category="Reasoning",
        name="Hard Math Olympiad",
        description="Math problem to stress test chain of thought reasoning.",
        system_prompt="Solve step by step with extreme precision.",
        template="Find all positive integers n such that 2^n + 12^n + 2024^n is a perfect square.",
    ),
    "html_page": PromptTemplate(
        id="html_page",
        category="Coding",
        name="HTML Web Page Generator",
        description="Generates an end-to-end single-file HTML/CSS page.",
        system_prompt="You are a friendly and useful assistant.",
        template=(
            "Create a complete, polished home page for the '{retreat_name}', "
            "a luxury wellness retreat in {location}. Output ONLY a single self-contained HTML document "
            "inside a ```html code block (inline CSS in a <style> tag, no external files). "
            "Include a hero section with the retreat name and a tagline, a nav bar, a short about section, "
            "three feature cards (Spa & Sauna, Yoga & Meditation, Farm-to-Table Dining), a testimonial, "
            "and a booking call-to-action with a footer. Make it visually attractive and responsive."
        ),
        default_variables={
            "retreat_name": "Dario Wellness Retreat",
            "location": "the Tuscan hills",
        },
    ),
    "system_design": PromptTemplate(
        id="system_design",
        category="Architecture",
        name="Distributed System Design",
        description="Architects a scalable distributed URL shortening service.",
        system_prompt="You are a Principal Software Architect.",
        template=(
            "Design a distributed, highly available URL shortening service capable of handling 500 million new URLs per month and 100:1 read/write ratio.\n"
            "Detail:\n"
            "1. Capacity estimations (storage, bandwidth, IOPS).\n"
            "2. High-level architecture and API contracts.\n"
            "3. Database selection (SQL vs NoSQL) and schema design.\n"
            "4. Unique hash generation strategy (Base62 vs KGS).\n"
            "5. Caching, replication, and rate-limiting considerations."
        ),
    ),
    "long_form_guide": PromptTemplate(
        id="long_form_guide",
        category="Long Form",
        name="Comprehensive Architecture Guide (Long-Form)",
        description="Stress tests maximum output token generation and sustained throughput with an exhaustive, long-form technical guide.",
        system_prompt="You are a Principal Technical Writer and Software Architect. Provide exhaustive, production-grade, end-to-end documentation without skipping details or using placeholders.",
        template=(
            "Write an exhaustive, multi-chapter architectural deep-dive on designing and deploying a globally distributed, "
            "multi-region database engine from scratch.\n\n"
            "Cover the following sections in maximum technical detail:\n"
            "1. Core Storage Engine: LSM-trees vs B-Trees, write-ahead logging (WAL), SSTable compaction strategies, and memory pooling.\n"
            "2. Distributed Consensus: Raft vs Multi-Paxos implementation details, leader election, log replication edge cases, split-brain scenarios, and heartbeat timing.\n"
            "3. Concurrency Control & Transactions: Multi-Version Concurrency Control (MVCC), snapshot isolation, distributed deadlocks, and two-phase commits (2PC).\n"
            "4. Global Replication & Consistency: Tunable consistency, handling high network latency, cross-datacenter partition recovery, and CRDTs.\n"
            "5. Observability, Failure Injection & Chaos Engineering: Tracing, disk corruption detection, node failure recovery, and automated stress testing.\n\n"
            "Provide concrete schema examples, pseudo-code algorithms, and deep failure-mode analysis. Avoid summaries or brevity."
        ),
    ),
}


# Proxy dict for BenchmarkService backward compatibility
class DynamicTemplateStore(dict):
    def get(self, key, default=None):
        user_tpls = TemplateStore.load_user_templates()
        if key in user_tpls:
            return user_tpls[key]
        return BUILTIN_TEMPLATES.get(key, default)

    def __getitem__(self, key):
        val = self.get(key)
        if val is None:
            raise KeyError(key)
        return val

TEMPLATE_STORE = DynamicTemplateStore()


# Proxy dict for BenchmarkService backward compatibility
class DynamicTemplateStore(dict):
    def get(self, key, default=None):
        user_tpls = TemplateStore.load_user_templates()
        if key in user_tpls:
            return user_tpls[key]
        return BUILTIN_TEMPLATES.get(key, default)

    def __getitem__(self, key):
        val = self.get(key)
        if val is None:
            raise KeyError(key)
        return val

TEMPLATE_STORE = DynamicTemplateStore()


def get_all_templates() -> dict[str, PromptTemplate]:
    all_tpls = BUILTIN_TEMPLATES.copy()
    all_tpls.update(TemplateStore.load_user_templates())
    return all_tpls


@router.get("/", response_model=list[PromptTemplate])
async def list_templates():
    return list(get_all_templates().values())


@router.get("/{template_id}", response_model=PromptTemplate)
async def get_template(template_id: str):
    tpls = get_all_templates()
    if template_id not in tpls:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpls[template_id]


@router.post("/", response_model=PromptTemplate)
async def add_template(template: PromptTemplate):
    TemplateStore.save_one(template)
    return template


@router.delete("/{template_id}")
async def delete_template(template_id: str):
    user_templates = TemplateStore.load_user_templates()
    if template_id not in user_templates:
        raise HTTPException(
            status_code=403, 
            detail="Cannot delete built-in presets or non-existent template."
        )
    
    success = TemplateStore.delete_one(template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": f"User preset '{template_id}' deleted successfully."}